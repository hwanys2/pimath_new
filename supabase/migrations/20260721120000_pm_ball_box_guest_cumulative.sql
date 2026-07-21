-- pm_ball_box: guest (QR, no class) mode + cumulative session score + rank tracking
-- Modifies only pm_ball_box_* objects (owned by pimath). Apply to shared DB only
-- after explicit human confirmation.

-- ---------------------------------------------------------------------------
-- Schema changes
-- ---------------------------------------------------------------------------

-- Guest sessions have no class.
ALTER TABLE public.pm_ball_box_sessions
  ALTER COLUMN class_id DROP NOT NULL;

ALTER TABLE public.pm_ball_box_sessions
  ADD COLUMN IF NOT EXISTS join_code text;

CREATE UNIQUE INDEX IF NOT EXISTS pm_ball_box_join_code_active
  ON public.pm_ball_box_sessions (join_code)
  WHERE join_code IS NOT NULL AND phase <> 'closed';

-- Cumulative score across rounds/sets + guest players (no pm_students row).
ALTER TABLE public.pm_ball_box_players
  ADD COLUMN IF NOT EXISTS session_score int NOT NULL DEFAULT 0
    CHECK (session_score >= 0);

ALTER TABLE public.pm_ball_box_players
  ALTER COLUMN student_id DROP NOT NULL;

ALTER TABLE public.pm_ball_box_players
  ADD COLUMN IF NOT EXISTS guest_key text;

CREATE UNIQUE INDEX IF NOT EXISTS pm_ball_box_players_unique_guest
  ON public.pm_ball_box_players (session_id, guest_key)
  WHERE guest_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Create guest session (teacher, no class) — returns id + join code
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_ball_box_create_guest_session(
  p_content_key text
)
RETURNS TABLE (session_id uuid, join_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_teacher uuid := auth.uid();
  v_key text := trim(p_content_key);
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_i int;
  v_id uuid;
BEGIN
  IF v_teacher IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF v_key IS NULL OR v_key = '' THEN
    RAISE EXCEPTION 'content_key required';
  END IF;

  -- Close this teacher's previous open guest sessions.
  UPDATE public.pm_ball_box_sessions
  SET phase = 'closed', updated_at = now()
  WHERE teacher_id = v_teacher AND class_id IS NULL AND phase <> 'closed';

  -- Generate a unique 6-char code among open sessions.
  LOOP
    v_code := '';
    FOR v_i IN 1..6 LOOP
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars))::int + 1, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.pm_ball_box_sessions s
      WHERE s.join_code = v_code AND s.phase <> 'closed'
    );
  END LOOP;

  INSERT INTO public.pm_ball_box_sessions (
    class_id, teacher_id, content_key, phase, answer, total, join_code
  )
  VALUES (
    NULL, v_teacher, v_key, 'lobby', '{}'::jsonb, 0, v_code
  )
  RETURNING id INTO v_id;

  session_id := v_id;
  join_code := v_code;
  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- Find open session by join code (anyone) / teacher's open guest session
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_ball_box_find_by_code(p_join_code text)
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
  WHERE upper(trim(p_join_code)) = s.join_code AND s.phase <> 'closed'
  ORDER BY s.created_at DESC
  LIMIT 1;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_ball_box_teacher_find_guest()
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
  WHERE s.teacher_id = v_teacher AND s.class_id IS NULL AND s.phase <> 'closed'
  ORDER BY s.created_at DESC
  LIMIT 1;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Guest join (name only)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_ball_box_guest_join(
  p_join_code text,
  p_guest_key text,
  p_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session public.pm_ball_box_sessions%ROWTYPE;
  v_name text;
BEGIN
  IF p_guest_key IS NULL OR length(trim(p_guest_key)) < 8 THEN
    RAISE EXCEPTION 'invalid guest key';
  END IF;

  SELECT * INTO v_session
  FROM public.pm_ball_box_sessions s
  WHERE upper(trim(p_join_code)) = s.join_code AND s.phase <> 'closed'
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no active session';
  END IF;

  v_name := left(COALESCE(NULLIF(trim(p_name), ''), '탐험가'), 20);

  INSERT INTO public.pm_ball_box_players (
    session_id, student_id, guest_key, display_name
  )
  VALUES (
    v_session.id, NULL, trim(p_guest_key), v_name
  )
  ON CONFLICT (session_id, guest_key) WHERE guest_key IS NOT NULL
  DO UPDATE SET display_name = EXCLUDED.display_name;

  RETURN v_session.id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Guest draw (with replacement)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_ball_box_guest_draw(
  p_guest_key text,
  p_session_id uuid
)
RETURNS TABLE (color text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_sess public.pm_ball_box_sessions%ROWTYPE;
  v_player public.pm_ball_box_players%ROWTYPE;
  v_pick int;
  v_acc int := 0;
  v_key text;
  v_val int;
  v_chosen text := NULL;
  v_new_observed jsonb;
BEGIN
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
  WHERE p.session_id = p_session_id AND p.guest_key = trim(p_guest_key)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not in session';
  END IF;

  v_pick := floor(random() * v_sess.total)::int;
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
-- Guest guess (no XP)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_ball_box_guest_guess(
  p_guest_key text,
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
  v_sess public.pm_ball_box_sessions%ROWTYPE;
  v_player public.pm_ball_box_players%ROWTYPE;
  v_key text;
  v_expected int;
  v_guessed int;
  v_correct boolean := true;
  v_score int;
BEGIN
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
  WHERE p.session_id = p_session_id AND p.guest_key = trim(p_guest_key)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not in session';
  END IF;

  IF v_player.solved THEN
    correct := true;
    score := v_player.score;
    already_solved := true;
    draw_count := v_player.draw_count;
    wrong_attempts := v_player.wrong_attempts;
    RETURN NEXT;
    RETURN;
  END IF;

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
      session_score = session_score + v_score,
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
-- Student guess — add cumulative session_score on solve
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

  IF v_player.solved THEN
    correct := true;
    score := v_player.score;
    already_solved := true;
    draw_count := v_player.draw_count;
    wrong_attempts := v_player.wrong_attempts;
    RETURN NEXT;
    RETURN;
  END IF;

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
      session_score = session_score + v_score,
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
-- Poll (student) — add session_score, join_code, pid; rank by cumulative
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.pm_ball_box_poll(text, uuid);

CREATE FUNCTION public.pm_ball_box_poll(
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
  join_code text,
  pid text,
  student_id uuid,
  display_name text,
  observed jsonb,
  draw_count int,
  wrong_attempts int,
  solved boolean,
  score int,
  session_score int,
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
    v_sess.join_code,
    COALESCE(p.student_id::text, 'g:' || p.guest_key),
    p.student_id,
    p.display_name,
    CASE WHEN p.student_id = v_student THEN p.observed ELSE '{}'::jsonb END,
    p.draw_count,
    CASE WHEN p.student_id = v_student THEN p.wrong_attempts ELSE 0 END,
    p.solved,
    p.score,
    p.session_score,
    (p.student_id = v_student) AS is_me
  FROM public.pm_ball_box_players p
  WHERE p.session_id = v_sess.id
  ORDER BY p.session_score DESC, p.score DESC, p.joined_at ASC;

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
      v_sess.join_code,
      NULL::text,
      NULL::uuid,
      NULL::text,
      '{}'::jsonb,
      0,
      0,
      false,
      0,
      0,
      false;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Poll (guest)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_ball_box_guest_poll(
  p_guest_key text,
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
  join_code text,
  pid text,
  student_id uuid,
  display_name text,
  observed jsonb,
  draw_count int,
  wrong_attempts int,
  solved boolean,
  score int,
  session_score int,
  is_me boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_sess public.pm_ball_box_sessions%ROWTYPE;
  v_colors jsonb;
  v_revealed jsonb;
  v_gk text := trim(p_guest_key);
BEGIN
  SELECT * INTO v_sess
  FROM public.pm_ball_box_sessions s
  WHERE s.id = p_session_id AND s.phase <> 'closed';

  IF NOT FOUND THEN
    RETURN;
  END IF;

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
    NULL::text,
    v_sess.phase,
    v_sess.round_number,
    v_sess.total,
    v_colors,
    v_revealed,
    v_sess.join_code,
    COALESCE(p.student_id::text, 'g:' || p.guest_key),
    p.student_id,
    p.display_name,
    CASE WHEN p.guest_key = v_gk THEN p.observed ELSE '{}'::jsonb END,
    p.draw_count,
    CASE WHEN p.guest_key = v_gk THEN p.wrong_attempts ELSE 0 END,
    p.solved,
    p.score,
    p.session_score,
    (p.guest_key = v_gk) AS is_me
  FROM public.pm_ball_box_players p
  WHERE p.session_id = v_sess.id
  ORDER BY p.session_score DESC, p.score DESC, p.joined_at ASC;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      v_sess.id,
      v_sess.class_id,
      NULL::text,
      v_sess.phase,
      v_sess.round_number,
      v_sess.total,
      v_colors,
      v_revealed,
      v_sess.join_code,
      NULL::text,
      NULL::uuid,
      NULL::text,
      '{}'::jsonb,
      0,
      0,
      false,
      0,
      0,
      false;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Poll (teacher) — add session_score, join_code, pid
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.pm_ball_box_teacher_poll(uuid);

CREATE FUNCTION public.pm_ball_box_teacher_poll(p_session_id uuid)
RETURNS TABLE (
  session_id uuid,
  class_id uuid,
  class_name text,
  phase text,
  round_number int,
  total int,
  answer_colors jsonb,
  revealed_answer jsonb,
  join_code text,
  pid text,
  student_id uuid,
  display_name text,
  observed jsonb,
  draw_count int,
  wrong_attempts int,
  solved boolean,
  score int,
  session_score int,
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
    v_sess.answer,
    v_sess.join_code,
    COALESCE(p.student_id::text, 'g:' || p.guest_key),
    p.student_id,
    p.display_name,
    '{}'::jsonb,
    p.draw_count,
    p.wrong_attempts,
    p.solved,
    p.score,
    p.session_score,
    false AS is_me
  FROM public.pm_ball_box_players p
  WHERE p.session_id = v_sess.id
  ORDER BY p.session_score DESC, p.score DESC, p.joined_at ASC;

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
      v_sess.join_code,
      NULL::text,
      NULL::uuid,
      NULL::text,
      '{}'::jsonb,
      0,
      0,
      false,
      0,
      0,
      false;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.pm_ball_box_create_guest_session(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_ball_box_create_guest_session(text) TO authenticated;

REVOKE ALL ON FUNCTION public.pm_ball_box_find_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_ball_box_find_by_code(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.pm_ball_box_teacher_find_guest() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_ball_box_teacher_find_guest() TO authenticated;

REVOKE ALL ON FUNCTION public.pm_ball_box_guest_join(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_ball_box_guest_join(text, text, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.pm_ball_box_guest_draw(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_ball_box_guest_draw(text, uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.pm_ball_box_guest_guess(text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_ball_box_guest_guess(text, uuid, jsonb) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.pm_ball_box_guest_poll(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_ball_box_guest_poll(text, uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.pm_ball_box_poll(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_ball_box_poll(text, uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.pm_ball_box_teacher_poll(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_ball_box_teacher_poll(uuid) TO authenticated;
