-- pm_inquiry: teacher-paced inquiry classroom sessions (pimath only)
-- Apply to shared DB only after explicit human confirmation.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.pm_inquiry_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.pm_classes(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL,
  content_key text NOT NULL,
  phase text NOT NULL DEFAULT 'setup'
    CHECK (phase IN ('setup', 'live', 'closed')),
  step_index int NOT NULL DEFAULT 0 CHECK (step_index >= 0),
  step_count int NOT NULL CHECK (step_count > 0),
  join_code text,
  started_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pm_inquiry_sessions_content_key_not_blank
    CHECK (length(trim(content_key)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS pm_inquiry_one_active_per_class
  ON public.pm_inquiry_sessions (class_id)
  WHERE phase <> 'closed';

CREATE INDEX IF NOT EXISTS pm_inquiry_sessions_class_idx
  ON public.pm_inquiry_sessions (class_id, phase, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.pm_inquiry_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.pm_inquiry_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.pm_students(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '탐험가',
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pm_inquiry_participants_unique_student UNIQUE (session_id, student_id)
);

CREATE INDEX IF NOT EXISTS pm_inquiry_participants_session_idx
  ON public.pm_inquiry_participants (session_id, joined_at ASC);

CREATE TABLE IF NOT EXISTS public.pm_inquiry_step_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.pm_inquiry_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.pm_students(id) ON DELETE CASCADE,
  step_index int NOT NULL CHECK (step_index >= 0),
  response jsonb NOT NULL DEFAULT '{}'::jsonb,
  result text CHECK (result IS NULL OR result IN ('correct', 'wrong', 'neutral')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pm_inquiry_step_responses_unique
    UNIQUE (session_id, student_id, step_index)
);

CREATE INDEX IF NOT EXISTS pm_inquiry_step_responses_session_idx
  ON public.pm_inquiry_step_responses (session_id, step_index, student_id);

ALTER TABLE public.pm_inquiry_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_inquiry_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_inquiry_step_responses ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.pm_inquiry_sessions FROM anon, authenticated;
REVOKE ALL ON TABLE public.pm_inquiry_participants FROM anon, authenticated;
REVOKE ALL ON TABLE public.pm_inquiry_step_responses FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_inquiry_assert_teacher(p_session_id uuid)
RETURNS public.pm_inquiry_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_teacher uuid := auth.uid();
  v_row public.pm_inquiry_sessions%ROWTYPE;
BEGIN
  IF v_teacher IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO v_row
  FROM public.pm_inquiry_sessions s
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

CREATE OR REPLACE FUNCTION public.pm_inquiry_create_session(
  p_class_id uuid,
  p_content_key text,
  p_step_count int
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_teacher uuid := auth.uid();
  v_key text := trim(p_content_key);
  v_steps int := COALESCE(p_step_count, 0);
  v_class public.pm_classes%ROWTYPE;
  v_id uuid;
BEGIN
  IF v_teacher IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF v_key IS NULL OR v_key = '' THEN
    RAISE EXCEPTION 'content_key required';
  END IF;

  IF v_steps <= 0 THEN
    RAISE EXCEPTION 'step_count must be positive';
  END IF;

  SELECT * INTO v_class
  FROM public.pm_classes c
  WHERE c.id = p_class_id AND c.teacher_id = v_teacher;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'class not found or not owned';
  END IF;

  UPDATE public.pm_inquiry_sessions
  SET phase = 'closed',
      closed_at = now(),
      updated_at = now()
  WHERE class_id = p_class_id AND phase <> 'closed';

  INSERT INTO public.pm_inquiry_sessions (
    class_id, teacher_id, content_key, phase, step_index, step_count
  )
  VALUES (
    p_class_id, v_teacher, v_key, 'setup', 0, v_steps
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Start session (teacher): setup -> live
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_inquiry_start(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_row public.pm_inquiry_sessions%ROWTYPE;
BEGIN
  v_row := public.pm_inquiry_assert_teacher(p_session_id);

  IF v_row.phase <> 'setup' THEN
    RAISE EXCEPTION 'invalid phase for start';
  END IF;

  UPDATE public.pm_inquiry_sessions
  SET phase = 'live',
      step_index = 0,
      started_at = now(),
      updated_at = now()
  WHERE id = p_session_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Advance step (teacher)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_inquiry_advance_step(
  p_session_id uuid,
  p_delta int
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_row public.pm_inquiry_sessions%ROWTYPE;
  v_next int;
BEGIN
  v_row := public.pm_inquiry_assert_teacher(p_session_id);

  IF v_row.phase <> 'live' THEN
    RAISE EXCEPTION 'session not live';
  END IF;

  v_next := GREATEST(0, LEAST(v_row.step_count - 1, v_row.step_index + COALESCE(p_delta, 0)));

  UPDATE public.pm_inquiry_sessions
  SET step_index = v_next,
      updated_at = now()
  WHERE id = p_session_id;

  RETURN v_next;
END;
$$;

-- ---------------------------------------------------------------------------
-- Close session (teacher)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_inquiry_close(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_row public.pm_inquiry_sessions%ROWTYPE;
BEGIN
  v_row := public.pm_inquiry_assert_teacher(p_session_id);

  IF v_row.phase = 'closed' THEN
    RETURN;
  END IF;

  UPDATE public.pm_inquiry_sessions
  SET phase = 'closed',
      closed_at = now(),
      updated_at = now()
  WHERE id = p_session_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Join session (student)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_inquiry_join(
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
  v_sess public.pm_inquiry_sessions%ROWTYPE;
  v_name text;
BEGIN
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'invalid session';
  END IF;

  SELECT * INTO v_sess
  FROM public.pm_inquiry_sessions s
  WHERE s.class_id = p_class_id AND s.phase <> 'closed'
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no active session';
  END IF;

  SELECT st.display_name INTO v_name
  FROM public.pm_students st
  WHERE st.id = v_student;

  INSERT INTO public.pm_inquiry_participants (
    session_id, student_id, display_name, last_seen_at
  )
  VALUES (
    v_sess.id, v_student, COALESCE(NULLIF(trim(v_name), ''), '탐험가'), now()
  )
  ON CONFLICT (session_id, student_id) DO UPDATE
  SET last_seen_at = now(),
      display_name = EXCLUDED.display_name;

  RETURN v_sess.id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Submit response (student) — result graded server-side in app layer
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_inquiry_submit_response(
  p_session_token text,
  p_session_id uuid,
  p_step_index int,
  p_response jsonb,
  p_result text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_student uuid := public.pm_student_id_from_session(p_session_token);
  v_sess public.pm_inquiry_sessions%ROWTYPE;
  v_result text := NULLIF(trim(p_result), '');
BEGIN
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'invalid session';
  END IF;

  IF v_result IS NOT NULL AND v_result NOT IN ('correct', 'wrong', 'neutral') THEN
    RAISE EXCEPTION 'invalid result';
  END IF;

  SELECT * INTO v_sess
  FROM public.pm_inquiry_sessions s
  WHERE s.id = p_session_id AND s.phase = 'live'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session not live';
  END IF;

  IF v_sess.step_index <> p_step_index THEN
    RAISE EXCEPTION 'step mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.pm_inquiry_participants p
    WHERE p.session_id = p_session_id AND p.student_id = v_student
  ) THEN
    RAISE EXCEPTION 'not a participant';
  END IF;

  INSERT INTO public.pm_inquiry_step_responses (
    session_id, student_id, step_index, response, result
  )
  VALUES (
    p_session_id, v_student, p_step_index, COALESCE(p_response, '{}'::jsonb), v_result
  )
  ON CONFLICT (session_id, student_id, step_index) DO UPDATE
  SET response = EXCLUDED.response,
      result = EXCLUDED.result,
      submitted_at = now();

  UPDATE public.pm_inquiry_participants
  SET last_seen_at = now()
  WHERE session_id = p_session_id AND student_id = v_student;
END;
$$;

-- ---------------------------------------------------------------------------
-- Find active session (student)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_inquiry_find_active(p_class_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT s.id INTO v_id
  FROM public.pm_inquiry_sessions s
  WHERE s.class_id = p_class_id AND s.phase <> 'closed'
  ORDER BY s.created_at DESC
  LIMIT 1;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Find active session (teacher)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_inquiry_teacher_find_active(p_class_id uuid)
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
  FROM public.pm_inquiry_sessions s
  JOIN public.pm_classes c ON c.id = s.class_id
  WHERE s.class_id = p_class_id
    AND c.teacher_id = v_teacher
    AND s.phase <> 'closed'
  ORDER BY s.created_at DESC
  LIMIT 1;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Poll (student)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_inquiry_poll(
  p_session_token text,
  p_session_id uuid
)
RETURNS TABLE (
  session_id uuid,
  class_id uuid,
  class_name text,
  content_key text,
  phase text,
  step_index int,
  step_count int,
  student_id uuid,
  display_name text,
  last_seen_at timestamptz,
  step_result text,
  is_me boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_student uuid := public.pm_student_id_from_session(p_session_token);
  v_sess public.pm_inquiry_sessions%ROWTYPE;
  v_class_name text;
BEGIN
  IF v_student IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_sess
  FROM public.pm_inquiry_sessions s
  WHERE s.id = p_session_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT c.name INTO v_class_name
  FROM public.pm_classes c
  WHERE c.id = v_sess.class_id;

  UPDATE public.pm_inquiry_participants p
  SET last_seen_at = now()
  WHERE p.session_id = p_session_id AND p.student_id = v_student;

  RETURN QUERY
  SELECT
    v_sess.id,
    v_sess.class_id,
    v_class_name,
    v_sess.content_key,
    v_sess.phase,
    v_sess.step_index,
    v_sess.step_count,
    p.student_id,
    p.display_name,
    p.last_seen_at,
    r.result AS step_result,
    (p.student_id = v_student) AS is_me
  FROM public.pm_inquiry_participants p
  LEFT JOIN public.pm_inquiry_step_responses r
    ON r.session_id = p.session_id
   AND r.student_id = p.student_id
   AND r.step_index = v_sess.step_index
  WHERE p.session_id = v_sess.id
  ORDER BY p.joined_at ASC;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      v_sess.id,
      v_sess.class_id,
      v_class_name,
      v_sess.content_key,
      v_sess.phase,
      v_sess.step_index,
      v_sess.step_count,
      NULL::uuid,
      NULL::text,
      NULL::timestamptz,
      NULL::text,
      false;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Poll (teacher)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_inquiry_teacher_poll(p_session_id uuid)
RETURNS TABLE (
  session_id uuid,
  class_id uuid,
  class_name text,
  content_key text,
  phase text,
  step_index int,
  step_count int,
  student_id uuid,
  display_name text,
  last_seen_at timestamptz,
  step_result text,
  is_me boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_sess public.pm_inquiry_sessions%ROWTYPE;
  v_class_name text;
BEGIN
  v_sess := public.pm_inquiry_assert_teacher(p_session_id);

  IF v_sess.phase = 'closed' THEN
    RETURN;
  END IF;

  SELECT c.name INTO v_class_name
  FROM public.pm_classes c
  WHERE c.id = v_sess.class_id;

  RETURN QUERY
  SELECT
    v_sess.id,
    v_sess.class_id,
    v_class_name,
    v_sess.content_key,
    v_sess.phase,
    v_sess.step_index,
    v_sess.step_count,
    p.student_id,
    p.display_name,
    p.last_seen_at,
    r.result AS step_result,
    false AS is_me
  FROM public.pm_inquiry_participants p
  LEFT JOIN public.pm_inquiry_step_responses r
    ON r.session_id = p.session_id
   AND r.student_id = p.student_id
   AND r.step_index = v_sess.step_index
  WHERE p.session_id = v_sess.id
  ORDER BY p.joined_at ASC;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      v_sess.id,
      v_sess.class_id,
      v_class_name,
      v_sess.content_key,
      v_sess.phase,
      v_sess.step_index,
      v_sess.step_count,
      NULL::uuid,
      NULL::text,
      NULL::timestamptz,
      NULL::text,
      false;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- List all step responses (teacher)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_inquiry_list_responses(p_session_id uuid)
RETURNS TABLE (
  student_id uuid,
  display_name text,
  step_index int,
  result text,
  response jsonb,
  submitted_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM public.pm_inquiry_assert_teacher(p_session_id);

  RETURN QUERY
  SELECT
    r.student_id,
    p.display_name,
    r.step_index,
    r.result,
    r.response,
    r.submitted_at
  FROM public.pm_inquiry_step_responses r
  JOIN public.pm_inquiry_participants p
    ON p.session_id = r.session_id AND p.student_id = r.student_id
  WHERE r.session_id = p_session_id
  ORDER BY r.step_index ASC, p.joined_at ASC;
END;
$$;

-- ---------------------------------------------------------------------------
-- Record session scores (teacher) — mirrors pm_submit_game_run per student
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_inquiry_record_session_runs(
  p_session_id uuid,
  p_runs jsonb
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_sess public.pm_inquiry_sessions%ROWTYPE;
  v_run jsonb;
  v_student uuid;
  v_score int;
  v_details jsonb;
  v_row public.pm_students%ROWTYPE;
  v_xp int;
  v_before int;
  v_after int;
  v_new_total bigint;
  v_active boolean;
  v_count int := 0;
BEGIN
  v_sess := public.pm_inquiry_assert_teacher(p_session_id);

  IF p_runs IS NULL OR jsonb_typeof(p_runs) <> 'array' THEN
    RAISE EXCEPTION 'p_runs must be a json array';
  END IF;

  FOR v_run IN SELECT * FROM jsonb_array_elements(p_runs)
  LOOP
    v_student := (v_run->>'student_id')::uuid;
    v_score := GREATEST(0, LEAST(5000, COALESCE((v_run->>'score')::int, 0)));
    v_details := COALESCE(v_run->'details', '{}'::jsonb);

    IF v_student IS NULL THEN
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.pm_inquiry_participants p
      WHERE p.session_id = p_session_id AND p.student_id = v_student
    ) THEN
      CONTINUE;
    END IF;

    SELECT * INTO v_row FROM public.pm_students WHERE id = v_student FOR UPDATE;
    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.pm_class_contents cc
      WHERE cc.class_id = v_row.class_id
        AND cc.content_key = trim(v_sess.content_key)
        AND cc.is_active = true
    ) INTO v_active;

    IF NOT v_active THEN
      CONTINUE;
    END IF;

    INSERT INTO public.pm_game_runs (student_id, class_id, content_key, score, details)
    VALUES (v_student, v_row.class_id, trim(v_sess.content_key), v_score, v_details);

    v_xp := v_score;
    v_before := v_row.level;
    v_new_total := LEAST(500000::bigint, v_row.total_xp + v_xp);
    v_after := public.pm_level_from_xp(v_new_total);

    UPDATE public.pm_students
    SET total_xp = v_new_total,
        level = v_after,
        updated_at = now()
    WHERE id = v_student;

    INSERT INTO public.pm_xp_events (
      student_id, teacher_id, game_key, score, xp_awarded, level_before, level_after, meta
    )
    VALUES (
      v_student, v_row.teacher_id, trim(v_sess.content_key), v_score, v_xp, v_before, v_after, v_details
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.pm_inquiry_assert_teacher(uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.pm_inquiry_create_session(uuid, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_inquiry_create_session(uuid, text, int) TO authenticated;

REVOKE ALL ON FUNCTION public.pm_inquiry_start(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_inquiry_start(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.pm_inquiry_advance_step(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_inquiry_advance_step(uuid, int) TO authenticated;

REVOKE ALL ON FUNCTION public.pm_inquiry_close(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_inquiry_close(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.pm_inquiry_join(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_inquiry_join(text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.pm_inquiry_submit_response(text, uuid, int, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_inquiry_submit_response(text, uuid, int, jsonb, text) TO authenticated;

REVOKE ALL ON FUNCTION public.pm_inquiry_find_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_inquiry_find_active(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.pm_inquiry_teacher_find_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_inquiry_teacher_find_active(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.pm_inquiry_poll(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_inquiry_poll(text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.pm_inquiry_teacher_poll(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_inquiry_teacher_poll(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.pm_inquiry_list_responses(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_inquiry_list_responses(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.pm_inquiry_record_session_runs(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_inquiry_record_session_runs(uuid, jsonb) TO authenticated;
