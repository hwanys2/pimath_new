-- Inquiry: list closed sessions for teacher results recovery +
-- record game_runs even when content was deactivated after class
-- (XP still requires is_active).
-- Apply to shared DB only after explicit human confirmation.

-- ---------------------------------------------------------------------------
-- List inquiry sessions for a class + content (teacher)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_inquiry_list_class_sessions(
  p_class_id uuid,
  p_content_key text
)
RETURNS TABLE (
  session_id uuid,
  phase text,
  step_count int,
  started_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz,
  response_count bigint,
  participant_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_teacher uuid := auth.uid();
  v_key text := trim(p_content_key);
BEGIN
  IF v_teacher IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF v_key IS NULL OR v_key = '' THEN
    RAISE EXCEPTION 'content_key required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.pm_classes c
    WHERE c.id = p_class_id AND c.teacher_id = v_teacher
  ) THEN
    RAISE EXCEPTION 'class not found or not owned';
  END IF;

  RETURN QUERY
  SELECT
    s.id AS session_id,
    s.phase,
    s.step_count,
    s.started_at,
    s.closed_at,
    s.created_at,
    (
      SELECT count(*)::bigint
      FROM public.pm_inquiry_step_responses r
      WHERE r.session_id = s.id
    ) AS response_count,
    (
      SELECT count(*)::bigint
      FROM public.pm_inquiry_participants p
      WHERE p.session_id = s.id
    ) AS participant_count
  FROM public.pm_inquiry_sessions s
  WHERE s.class_id = p_class_id
    AND s.teacher_id = v_teacher
    AND trim(s.content_key) = v_key
  ORDER BY s.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_inquiry_list_class_sessions(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_inquiry_list_class_sessions(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Record session runs: always persist pm_game_runs for participants;
-- award XP only when content is currently active.
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

    -- Always keep the learning record so 결과보기 is not empty after class.
    INSERT INTO public.pm_game_runs (student_id, class_id, content_key, score, details)
    VALUES (v_student, v_row.class_id, trim(v_sess.content_key), v_score, v_details);

    v_count := v_count + 1;

    -- XP only while the assignment is active (same gate as solo games).
    IF NOT v_active THEN
      CONTINUE;
    END IF;

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
  END LOOP;

  RETURN v_count;
END;
$$;
