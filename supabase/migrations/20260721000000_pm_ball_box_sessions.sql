-- pm_ball_box: teacher-led "guess the hidden ball box" probability game (pimath only)
-- Apply to shared DB only after explicit human confirmation.
--
-- Colors: red, orange, yellow, green, blue, purple, black.
-- Teacher sets a hidden composition (answer). Box (draw pool) = colors with count > 0.
-- answer keys (including 0-count decoys) are the colors students must guess.
-- Students draw WITH REPLACEMENT and estimate each color's count from observed ratios.
-- The composition values are never sent to students until phase = 'revealed'.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.pm_ball_box_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.pm_classes(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL,
  content_key text NOT NULL,
  phase text NOT NULL DEFAULT 'lobby'
    CHECK (phase IN ('lobby', 'playing', 'revealed', 'closed')),
  answer jsonb NOT NULL DEFAULT '{}'::jsonb,
  total int NOT NULL DEFAULT 0 CHECK (total >= 0),
  round_number int NOT NULL DEFAULT 1 CHECK (round_number >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pm_ball_box_sessions_content_key_not_blank
    CHECK (length(trim(content_key)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS pm_ball_box_one_active_per_class
  ON public.pm_ball_box_sessions (class_id)
  WHERE phase <> 'closed';

CREATE INDEX IF NOT EXISTS pm_ball_box_sessions_class_idx
  ON public.pm_ball_box_sessions (class_id, phase, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.pm_ball_box_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.pm_ball_box_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.pm_students(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '탐험가',
  observed jsonb NOT NULL DEFAULT '{}'::jsonb,
  draw_count int NOT NULL DEFAULT 0 CHECK (draw_count >= 0),
  wrong_attempts int NOT NULL DEFAULT 0 CHECK (wrong_attempts >= 0),
  solved boolean NOT NULL DEFAULT false,
  score int NOT NULL DEFAULT 0 CHECK (score >= 0),
  solved_at timestamptz,
  joined_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pm_ball_box_players_unique_student UNIQUE (session_id, student_id)
);

CREATE INDEX IF NOT EXISTS pm_ball_box_players_session_idx
  ON public.pm_ball_box_players (session_id, solved DESC, score DESC);

ALTER TABLE public.pm_ball_box_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_ball_box_players ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.pm_ball_box_sessions FROM anon, authenticated;
REVOKE ALL ON TABLE public.pm_ball_box_players FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Allowed ball color keys (order defines draw iteration / display order).
CREATE OR REPLACE FUNCTION public.pm_ball_box_colors()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'black'];
$$;

-- Validate + normalize a teacher-provided answer jsonb.
-- Returns normalized answer (only allowed keys, integer >= 0 values).
-- Raises if invalid: unknown key, negative/non-integer value, no color entered,
-- or the draw box (colors with count > 0) is empty.
CREATE OR REPLACE FUNCTION public.pm_ball_box_normalize_answer(p_answer jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_colors text[] := public.pm_ball_box_colors();
  v_out jsonb := '{}'::jsonb;
  v_key text;
  v_val numeric;
  v_int int;
  v_entered int := 0;
  v_box int := 0;
BEGIN
  IF p_answer IS NULL OR jsonb_typeof(p_answer) <> 'object' THEN
    RAISE EXCEPTION 'invalid answer';
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(p_answer) LOOP
    IF NOT (v_key = ANY (v_colors)) THEN
      RAISE EXCEPTION 'unknown color: %', v_key;
    END IF;

    IF jsonb_typeof(p_answer -> v_key) <> 'number' THEN
      RAISE EXCEPTION 'invalid count for %', v_key;
    END IF;

    v_val := (p_answer ->> v_key)::numeric;
    IF v_val < 0 OR v_val <> floor(v_val) THEN
      RAISE EXCEPTION 'invalid count for %', v_key;
    END IF;

    v_int := v_val::int;
    IF v_int > 500 THEN
      RAISE EXCEPTION 'count too large for %', v_key;
    END IF;

    v_out := jsonb_set(v_out, ARRAY[v_key], to_jsonb(v_int), true);
    v_entered := v_entered + 1;
    v_box := v_box + v_int;
  END LOOP;

  IF v_entered = 0 THEN
    RAISE EXCEPTION 'no color entered';
  END IF;

  IF v_box = 0 THEN
    RAISE EXCEPTION 'box is empty';
  END IF;

  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_ball_box_total(p_answer jsonb)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(SUM((value)::int), 0)::int
  FROM jsonb_each_text(p_answer);
$$;

-- Score for a correct, first-time solve. Lower draws / fewer wrong attempts = higher.
CREATE OR REPLACE FUNCTION public.pm_ball_box_score(p_draw_count int, p_wrong_attempts int)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT GREATEST(20, LEAST(200,
    200 - GREATEST(0, p_draw_count) - 30 * GREATEST(0, p_wrong_attempts)
  ))::int;
$$;

CREATE OR REPLACE FUNCTION public.pm_ball_box_assert_teacher(p_session_id uuid)
RETURNS public.pm_ball_box_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_teacher uuid := auth.uid();
  v_row public.pm_ball_box_sessions%ROWTYPE;
BEGIN
  IF v_teacher IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO v_row
  FROM public.pm_ball_box_sessions s
  WHERE s.id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session not found';
  END IF;

  IF v_row.teacher_id <> v_teacher THEN
    RAISE EXCEPTION 'not session owner';
  END IF;

  RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- Create session (teacher)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_ball_box_create_session(
  p_class_id uuid,
  p_content_key text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_teacher uuid := auth.uid();
  v_key text := trim(p_content_key);
  v_class public.pm_classes%ROWTYPE;
  v_id uuid;
BEGIN
  IF v_teacher IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF v_key IS NULL OR v_key = '' THEN
    RAISE EXCEPTION 'content_key required';
  END IF;

  SELECT * INTO v_class
  FROM public.pm_classes c
  WHERE c.id = p_class_id AND c.teacher_id = v_teacher;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'class not found or not owned';
  END IF;

  UPDATE public.pm_ball_box_sessions
  SET phase = 'closed', updated_at = now()
  WHERE class_id = p_class_id AND phase <> 'closed';

  INSERT INTO public.pm_ball_box_sessions (
    class_id, teacher_id, content_key, phase, answer, total
  )
  VALUES (
    p_class_id, v_teacher, v_key, 'lobby', '{}'::jsonb, 0
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Start game with composition (teacher)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_ball_box_start(
  p_session_id uuid,
  p_answer jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_row public.pm_ball_box_sessions%ROWTYPE;
  v_answer jsonb;
  v_total int;
BEGIN
  v_row := public.pm_ball_box_assert_teacher(p_session_id);

  IF v_row.phase NOT IN ('lobby', 'revealed') THEN
    RAISE EXCEPTION 'invalid phase for start';
  END IF;

  v_answer := public.pm_ball_box_normalize_answer(p_answer);
  v_total := public.pm_ball_box_total(v_answer);

  UPDATE public.pm_ball_box_sessions
  SET phase = 'playing',
      answer = v_answer,
      total = v_total,
      updated_at = now()
  WHERE id = p_session_id;

  -- Fresh round for everyone already in the lobby/previous round.
  UPDATE public.pm_ball_box_players
  SET observed = '{}'::jsonb,
      draw_count = 0,
      wrong_attempts = 0,
      solved = false,
      score = 0,
      solved_at = NULL
  WHERE session_id = p_session_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Reveal answer (teacher)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_ball_box_reveal(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_row public.pm_ball_box_sessions%ROWTYPE;
BEGIN
  v_row := public.pm_ball_box_assert_teacher(p_session_id);

  IF v_row.phase <> 'playing' THEN
    RAISE EXCEPTION 'invalid phase for reveal';
  END IF;

  UPDATE public.pm_ball_box_sessions
  SET phase = 'revealed', updated_at = now()
  WHERE id = p_session_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Next round with new composition (teacher)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_ball_box_next_round(
  p_session_id uuid,
  p_answer jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_row public.pm_ball_box_sessions%ROWTYPE;
  v_answer jsonb;
  v_total int;
BEGIN
  v_row := public.pm_ball_box_assert_teacher(p_session_id);

  IF v_row.phase <> 'revealed' THEN
    RAISE EXCEPTION 'invalid phase for next round';
  END IF;

  v_answer := public.pm_ball_box_normalize_answer(p_answer);
  v_total := public.pm_ball_box_total(v_answer);

  UPDATE public.pm_ball_box_sessions
  SET phase = 'playing',
      answer = v_answer,
      total = v_total,
      round_number = round_number + 1,
      updated_at = now()
  WHERE id = p_session_id;

  UPDATE public.pm_ball_box_players
  SET observed = '{}'::jsonb,
      draw_count = 0,
      wrong_attempts = 0,
      solved = false,
      score = 0,
      solved_at = NULL
  WHERE session_id = p_session_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Close session (teacher)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_ball_box_close(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM public.pm_ball_box_assert_teacher(p_session_id);

  UPDATE public.pm_ball_box_sessions
  SET phase = 'closed', updated_at = now()
  WHERE id = p_session_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Join session (student)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_ball_box_join(
  p_session_token text,
  p_class_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_student uuid := public.pm_student_id_from_session(p_session_token);
  v_row public.pm_students%ROWTYPE;
  v_session public.pm_ball_box_sessions%ROWTYPE;
BEGIN
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'invalid session';
  END IF;

  SELECT * INTO v_row FROM public.pm_students WHERE id = v_student;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'student not found';
  END IF;

  IF v_row.class_id <> p_class_id THEN
    RAISE EXCEPTION 'wrong class';
  END IF;

  SELECT * INTO v_session
  FROM public.pm_ball_box_sessions s
  WHERE s.class_id = p_class_id
    AND s.phase <> 'closed'
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no active session';
  END IF;

  INSERT INTO public.pm_ball_box_players (
    session_id, student_id, display_name
  )
  VALUES (
    v_session.id,
    v_student,
    COALESCE(NULLIF(trim(v_row.display_name), ''), v_row.login_id, '탐험가')
  )
  ON CONFLICT (session_id, student_id) DO NOTHING;

  RETURN v_session.id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Draw one ball with replacement (student)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_ball_box_draw(
  p_session_token text,
  p_session_id uuid
)
RETURNS TABLE (color text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_student uuid := public.pm_student_id_from_session(p_session_token);
  v_sess public.pm_ball_box_sessions%ROWTYPE;
  v_player public.pm_ball_box_players%ROWTYPE;
  v_pick int;
  v_acc int := 0;
  v_key text;
  v_val int;
  v_chosen text := NULL;
  v_new_observed jsonb;
BEGIN
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'invalid session';
  END IF;

  SELECT * INTO v_sess
  FROM public.pm_ball_box_sessions s
  WHERE s.id = p_session_id;

  IF NOT FOUND OR v_sess.phase <> 'playing' THEN
    RAISE EXCEPTION 'cannot draw now';
  END IF;

  IF v_sess.total <= 0 THEN
    RAISE EXCEPTION 'box is empty';
  END IF;

  SELECT * INTO v_player
  FROM public.pm_ball_box_players p
  WHERE p.session_id = p_session_id AND p.student_id = v_student
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not in session';
  END IF;

  -- Weighted pick over colors with count > 0 (draw with replacement).
  v_pick := floor(random() * v_sess.total)::int; -- 0 .. total-1
  FOR v_key IN SELECT unnest(public.pm_ball_box_colors()) LOOP
    v_val := COALESCE((v_sess.answer ->> v_key)::int, 0);
    IF v_val > 0 THEN
      v_acc := v_acc + v_val;
      IF v_pick < v_acc THEN
        v_chosen := v_key;
        EXIT;
      END IF;
    END IF;
  END LOOP;

  IF v_chosen IS NULL THEN
    RAISE EXCEPTION 'draw failed';
  END IF;

  v_new_observed := v_player.observed;
  v_new_observed := jsonb_set(
    v_new_observed,
    ARRAY[v_chosen],
    to_jsonb(COALESCE((v_new_observed ->> v_chosen)::int, 0) + 1),
    true
  );

  UPDATE public.pm_ball_box_players
  SET observed = v_new_observed,
      draw_count = draw_count + 1
  WHERE id = v_player.id;

  color := v_chosen;
  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- Submit a guess (student)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_ball_box_guess(
  p_session_token text,
  p_session_id uuid,
  p_guess jsonb
)
RETURNS TABLE (
  correct boolean,
  score int,
  already_solved boolean,
  draw_count int,
  wrong_attempts int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_student uuid := public.pm_student_id_from_session(p_session_token);
  v_sess public.pm_ball_box_sessions%ROWTYPE;
  v_player public.pm_ball_box_players%ROWTYPE;
  v_key text;
  v_expected int;
  v_guessed int;
  v_correct boolean := true;
  v_score int;
BEGIN
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'invalid session';
  END IF;

  IF p_guess IS NULL OR jsonb_typeof(p_guess) <> 'object' THEN
    RAISE EXCEPTION 'invalid guess';
  END IF;

  SELECT * INTO v_sess
  FROM public.pm_ball_box_sessions s
  WHERE s.id = p_session_id;

  IF NOT FOUND OR v_sess.phase <> 'playing' THEN
    RAISE EXCEPTION 'cannot guess now';
  END IF;

  SELECT * INTO v_player
  FROM public.pm_ball_box_players p
  WHERE p.session_id = p_session_id AND p.student_id = v_student
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not in session';
  END IF;

  -- Already solved this round: idempotent, no penalty, no double XP.
  IF v_player.solved THEN
    correct := true;
    score := v_player.score;
    already_solved := true;
    draw_count := v_player.draw_count;
    wrong_attempts := v_player.wrong_attempts;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Compare the guess against every answerable color (keys of answer, incl 0).
  FOR v_key IN SELECT jsonb_object_keys(v_sess.answer) LOOP
    v_expected := COALESCE((v_sess.answer ->> v_key)::int, 0);
    v_guessed := COALESCE(NULLIF(p_guess ->> v_key, '')::int, -1);
    IF v_guessed <> v_expected THEN
      v_correct := false;
    END IF;
  END LOOP;

  IF NOT v_correct THEN
    UPDATE public.pm_ball_box_players
    SET wrong_attempts = wrong_attempts + 1
    WHERE id = v_player.id
    RETURNING * INTO v_player;

    correct := false;
    score := 0;
    already_solved := false;
    draw_count := v_player.draw_count;
    wrong_attempts := v_player.wrong_attempts;
    RETURN NEXT;
    RETURN;
  END IF;

  v_score := public.pm_ball_box_score(v_player.draw_count, v_player.wrong_attempts);

  UPDATE public.pm_ball_box_players
  SET solved = true,
      score = v_score,
      solved_at = now()
  WHERE id = v_player.id;

  correct := true;
  score := v_score;
  already_solved := false;
  draw_count := v_player.draw_count;
  wrong_attempts := v_player.wrong_attempts;
  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- Poll (student) — hides answer values unless phase = 'revealed'
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_ball_box_poll(
  p_session_token text,
  p_session_id uuid
)
RETURNS TABLE (
  session_id uuid,
  class_id uuid,
  class_name text,
  phase text,
  round_number int,
  total int,
  answer_colors jsonb,
  revealed_answer jsonb,
  student_id uuid,
  display_name text,
  observed jsonb,
  draw_count int,
  wrong_attempts int,
  solved boolean,
  score int,
  is_me boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_student uuid := public.pm_student_id_from_session(p_session_token);
  v_sess public.pm_ball_box_sessions%ROWTYPE;
  v_class_name text;
  v_colors jsonb;
  v_revealed jsonb;
BEGIN
  IF v_student IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_sess
  FROM public.pm_ball_box_sessions s
  WHERE s.id = p_session_id AND s.phase <> 'closed';

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT c.name INTO v_class_name
  FROM public.pm_classes c
  WHERE c.id = v_sess.class_id;

  -- Public: which colors have an answer field (keys only, no counts).
  SELECT COALESCE(jsonb_agg(k ORDER BY idx), '[]'::jsonb) INTO v_colors
  FROM (
    SELECT k, array_position(public.pm_ball_box_colors(), k) AS idx
    FROM jsonb_object_keys(v_sess.answer) AS k
  ) t;

  v_revealed := CASE WHEN v_sess.phase = 'revealed' THEN v_sess.answer ELSE NULL END;

  RETURN QUERY
  SELECT
    v_sess.id,
    v_sess.class_id,
    v_class_name,
    v_sess.phase,
    v_sess.round_number,
    v_sess.total,
    v_colors,
    v_revealed,
    p.student_id,
    p.display_name,
    CASE WHEN p.student_id = v_student THEN p.observed ELSE '{}'::jsonb END,
    p.draw_count,
    CASE WHEN p.student_id = v_student THEN p.wrong_attempts ELSE 0 END,
    p.solved,
    p.score,
    (p.student_id = v_student) AS is_me
  FROM public.pm_ball_box_players p
  WHERE p.session_id = v_sess.id
  ORDER BY p.solved DESC, p.score DESC, p.joined_at ASC;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      v_sess.id,
      v_sess.class_id,
      v_class_name,
      v_sess.phase,
      v_sess.round_number,
      v_sess.total,
      v_colors,
      v_revealed,
      NULL::uuid,
      NULL::text,
      '{}'::jsonb,
      0,
      0,
      false,
      0,
      false;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Poll (teacher) — always sees the composition
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_ball_box_teacher_poll(p_session_id uuid)
RETURNS TABLE (
  session_id uuid,
  class_id uuid,
  class_name text,
  phase text,
  round_number int,
  total int,
  answer_colors jsonb,
  revealed_answer jsonb,
  student_id uuid,
  display_name text,
  observed jsonb,
  draw_count int,
  wrong_attempts int,
  solved boolean,
  score int,
  is_me boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_sess public.pm_ball_box_sessions%ROWTYPE;
  v_class_name text;
  v_colors jsonb;
BEGIN
  v_sess := public.pm_ball_box_assert_teacher(p_session_id);

  IF v_sess.phase = 'closed' THEN
    RETURN;
  END IF;

  SELECT c.name INTO v_class_name
  FROM public.pm_classes c
  WHERE c.id = v_sess.class_id;

  SELECT COALESCE(jsonb_agg(k ORDER BY idx), '[]'::jsonb) INTO v_colors
  FROM (
    SELECT k, array_position(public.pm_ball_box_colors(), k) AS idx
    FROM jsonb_object_keys(v_sess.answer) AS k
  ) t;

  RETURN QUERY
  SELECT
    v_sess.id,
    v_sess.class_id,
    v_class_name,
    v_sess.phase,
    v_sess.round_number,
    v_sess.total,
    v_colors,
    v_sess.answer, -- teacher always sees full composition
    p.student_id,
    p.display_name,
    '{}'::jsonb,
    p.draw_count,
    p.wrong_attempts,
    p.solved,
    p.score,
    false AS is_me
  FROM public.pm_ball_box_players p
  WHERE p.session_id = v_sess.id
  ORDER BY p.solved DESC, p.score DESC, p.joined_at ASC;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      v_sess.id,
      v_sess.class_id,
      v_class_name,
      v_sess.phase,
      v_sess.round_number,
      v_sess.total,
      v_colors,
      v_sess.answer,
      NULL::uuid,
      NULL::text,
      '{}'::jsonb,
      0,
      0,
      false,
      0,
      false;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Find active session for class (student / teacher)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_ball_box_find_active(p_class_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT s.id INTO v_id
  FROM public.pm_ball_box_sessions s
  WHERE s.class_id = p_class_id AND s.phase <> 'closed'
  ORDER BY s.created_at DESC
  LIMIT 1;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_ball_box_teacher_find_active(p_class_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_teacher uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_teacher IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT s.id INTO v_id
  FROM public.pm_ball_box_sessions s
  JOIN public.pm_classes c ON c.id = s.class_id
  WHERE s.class_id = p_class_id
    AND s.phase <> 'closed'
    AND c.teacher_id = v_teacher
  ORDER BY s.created_at DESC
  LIMIT 1;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.pm_ball_box_colors() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_ball_box_colors() TO anon, authenticated;

REVOKE ALL ON FUNCTION public.pm_ball_box_normalize_answer(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pm_ball_box_total(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pm_ball_box_score(int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pm_ball_box_assert_teacher(uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.pm_ball_box_create_session(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_ball_box_create_session(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.pm_ball_box_start(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_ball_box_start(uuid, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.pm_ball_box_reveal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_ball_box_reveal(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.pm_ball_box_next_round(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_ball_box_next_round(uuid, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.pm_ball_box_close(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_ball_box_close(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.pm_ball_box_join(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_ball_box_join(text, uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.pm_ball_box_draw(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_ball_box_draw(text, uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.pm_ball_box_guess(text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_ball_box_guess(text, uuid, jsonb) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.pm_ball_box_poll(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_ball_box_poll(text, uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.pm_ball_box_teacher_poll(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_ball_box_teacher_poll(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.pm_ball_box_find_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_ball_box_find_active(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.pm_ball_box_teacher_find_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_ball_box_teacher_find_active(uuid) TO authenticated;
