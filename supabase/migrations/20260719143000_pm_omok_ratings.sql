-- pm_omok cumulative rating (ranking) — pimath only

CREATE TABLE IF NOT EXISTS public.pm_omok_ratings (
  student_id uuid PRIMARY KEY REFERENCES public.pm_students(id) ON DELETE CASCADE,
  total_score int NOT NULL DEFAULT 0 CHECK (total_score >= 0),
  games_played int NOT NULL DEFAULT 0 CHECK (games_played >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pm_omok_ratings_score_idx
  ON public.pm_omok_ratings (total_score DESC);

ALTER TABLE public.pm_omok_ratings ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.pm_omok_delta_for_outcome(
  p_total int,
  p_outcome text
)
RETURNS int
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  t int := GREATEST(0, COALESCE(p_total, 0));
BEGIN
  IF p_outcome NOT IN ('win', 'loss', 'draw') THEN
    RAISE EXCEPTION 'bad outcome';
  END IF;
  IF t >= 3000 THEN
    IF p_outcome = 'win' THEN RETURN 100; END IF;
    IF p_outcome = 'loss' THEN RETURN -100; END IF;
    RETURN 50;
  ELSIF t >= 2000 THEN
    IF p_outcome = 'win' THEN RETURN 150; END IF;
    IF p_outcome = 'loss' THEN RETURN -100; END IF;
    RETURN 50;
  ELSIF t >= 1000 THEN
    IF p_outcome = 'win' THEN RETURN 200; END IF;
    IF p_outcome = 'loss' THEN RETURN -100; END IF;
    RETURN 75;
  ELSE
    IF p_outcome = 'win' THEN RETURN 300; END IF;
    IF p_outcome = 'loss' THEN RETURN 100; END IF;
    RETURN 150;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_omok_apply_rating(
  p_session_token text,
  p_outcome text
)
RETURNS TABLE (
  recorded boolean,
  practice_only boolean,
  outcome text,
  delta int,
  total_before int,
  total_after int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_student uuid := public.pm_student_id_from_session(p_session_token);
  v_row public.pm_students%ROWTYPE;
  v_before int := 0;
  v_delta int;
  v_after int;
  v_active boolean;
BEGIN
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'invalid session';
  END IF;

  IF p_outcome NOT IN ('win', 'loss', 'draw') THEN
    RAISE EXCEPTION 'bad outcome';
  END IF;

  SELECT * INTO v_row FROM public.pm_students WHERE id = v_student FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'student not found';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.pm_class_contents cc
    WHERE cc.class_id = v_row.class_id
      AND cc.content_key = 'g1-u2-3-ordered-pair-omok'
      AND cc.is_active = true
  ) INTO v_active;

  SELECT r.total_score INTO v_before
  FROM public.pm_omok_ratings r
  WHERE r.student_id = v_student;
  IF NOT FOUND THEN
    v_before := 0;
  END IF;

  v_delta := public.pm_omok_delta_for_outcome(v_before, p_outcome);
  v_after := GREATEST(0, v_before + v_delta);

  IF NOT v_active THEN
    recorded := false;
    practice_only := true;
    outcome := p_outcome;
    delta := v_delta;
    total_before := v_before;
    total_after := v_before; -- no persist in practice
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO public.pm_omok_ratings (student_id, total_score, games_played, updated_at)
  VALUES (v_student, v_after, 1, now())
  ON CONFLICT (student_id) DO UPDATE
  SET total_score = v_after,
      games_played = public.pm_omok_ratings.games_played + 1,
      updated_at = now();

  recorded := true;
  practice_only := false;
  outcome := p_outcome;
  delta := v_delta;
  total_before := v_before;
  total_after := v_after;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_omok_get_rating(p_session_token text)
RETURNS TABLE (
  total_score int,
  games_played int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_student uuid := public.pm_student_id_from_session(p_session_token);
BEGIN
  IF v_student IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT COALESCE(r.total_score, 0), COALESCE(r.games_played, 0)
  FROM (SELECT v_student AS sid) s
  LEFT JOIN public.pm_omok_ratings r ON r.student_id = s.sid;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_omok_list_rating_ranking(
  p_session_token text,
  p_scope text DEFAULT 'class'
)
RETURNS TABLE (
  rank int,
  student_id uuid,
  display_name text,
  class_name text,
  score int,
  is_me boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_student uuid := public.pm_student_id_from_session(p_session_token);
  v_class uuid;
  v_teacher uuid;
  v_scope text;
BEGIN
  IF v_student IS NULL THEN
    RETURN;
  END IF;

  SELECT st.class_id, st.teacher_id
  INTO v_class, v_teacher
  FROM public.pm_students st
  WHERE st.id = v_student;

  IF v_class IS NULL OR v_teacher IS NULL THEN
    RETURN;
  END IF;

  v_scope := lower(coalesce(nullif(trim(p_scope), ''), 'class'));
  IF v_scope NOT IN ('world', 'school', 'class') THEN
    v_scope := 'class';
  END IF;

  RETURN QUERY
  SELECT
    (row_number() OVER (ORDER BY r.total_score DESC, st.display_name ASC))::int AS rank,
    st.id AS student_id,
    st.display_name,
    c.name AS class_name,
    r.total_score AS score,
    (st.id = v_student) AS is_me
  FROM public.pm_omok_ratings r
  JOIN public.pm_students st ON st.id = r.student_id
  JOIN public.pm_classes c ON c.id = st.class_id
  WHERE r.total_score > 0
    AND (
      v_scope = 'world'
      OR (v_scope = 'school' AND st.teacher_id = v_teacher)
      OR (v_scope = 'class' AND st.class_id = v_class)
    )
  ORDER BY r.total_score DESC, st.display_name ASC
  LIMIT 20;
END;
$$;

-- Improve claim_result: return outcome (scores come from rating RPC)
CREATE OR REPLACE FUNCTION public.pm_omok_claim_result(
  p_session_token text,
  p_guest_id text,
  p_game_id uuid
)
RETURNS TABLE (
  ok boolean,
  my_score int,
  outcome text,
  already_claimed boolean,
  game_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key text;
  v_g public.pm_omok_games%ROWTYPE;
  v_stone text;
  v_claimed boolean;
BEGIN
  SELECT r.o_player_key INTO v_key
  FROM public.pm_omok_resolve_identity(p_session_token, p_guest_id) r;
  IF v_key IS NULL THEN
    ok := false;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT * INTO v_g FROM public.pm_omok_games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND OR (v_g.black_key <> v_key AND v_g.white_key <> v_key) THEN
    ok := false;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_g.status = 'playing' THEN
    ok := false;
    game_status := v_g.status;
    RETURN NEXT;
    RETURN;
  END IF;

  v_stone := CASE WHEN v_g.black_key = v_key THEN 'black' ELSE 'white' END;
  v_claimed := CASE WHEN v_stone = 'black' THEN v_g.claimed_black ELSE v_g.claimed_white END;

  IF v_g.status = 'black_win' THEN
    outcome := CASE WHEN v_stone = 'black' THEN 'win' ELSE 'loss' END;
  ELSIF v_g.status = 'white_win' THEN
    outcome := CASE WHEN v_stone = 'white' THEN 'win' ELSE 'loss' END;
  ELSE
    outcome := 'draw';
  END IF;

  my_score := CASE outcome
    WHEN 'win' THEN 300
    WHEN 'loss' THEN 100
    ELSE 150
  END;

  IF v_stone = 'black' THEN
    UPDATE public.pm_omok_games SET claimed_black = true WHERE id = p_game_id;
  ELSE
    UPDATE public.pm_omok_games SET claimed_white = true WHERE id = p_game_id;
  END IF;

  ok := true;
  already_claimed := v_claimed;
  game_status := v_g.status;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_omok_apply_rating(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pm_omok_get_rating(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pm_omok_list_rating_ranking(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_omok_apply_rating(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_omok_get_rating(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_omok_list_rating_ranking(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_omok_delta_for_outcome(int, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_omok_claim_result(text, text, uuid) TO anon, authenticated;
