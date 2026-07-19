-- pimath: soft score cap (hard max 5000) + cumulative XP ranking
-- Apply to shared DB only after explicit human confirmation.

-- ---------------------------------------------------------------------------
-- Relax score CHECKs: 0–5000
-- ---------------------------------------------------------------------------

ALTER TABLE public.pm_game_runs
  DROP CONSTRAINT IF EXISTS pm_game_runs_score_range;

ALTER TABLE public.pm_game_runs
  ADD CONSTRAINT pm_game_runs_score_range
    CHECK (score >= 0 AND score <= 5000);

ALTER TABLE public.pm_xp_events
  DROP CONSTRAINT IF EXISTS pm_xp_events_score_check;

ALTER TABLE public.pm_xp_events
  DROP CONSTRAINT IF EXISTS pm_xp_events_xp_awarded_check;

-- Inline CHECKs from original migration may use these names; drop any leftover
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'pm_xp_events'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%1000%'
  LOOP
    EXECUTE format('ALTER TABLE public.pm_xp_events DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.pm_xp_events
  ADD CONSTRAINT pm_xp_events_score_range
    CHECK (score >= 0 AND score <= 5000);

ALTER TABLE public.pm_xp_events
  ADD CONSTRAINT pm_xp_events_xp_awarded_range
    CHECK (xp_awarded >= 0 AND xp_awarded <= 5000);

-- ---------------------------------------------------------------------------
-- Award XP: hard clamp 5000
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_award_student_xp(
  p_session_token text,
  p_game_key text,
  p_score int
)
RETURNS TABLE (
  total_xp bigint,
  level int,
  xp_awarded int,
  level_before int,
  level_after int,
  leveled_up boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_student uuid := public.pm_student_id_from_session(p_session_token);
  v_row public.pm_students%ROWTYPE;
  v_score int;
  v_xp int;
  v_before int;
  v_after int;
  v_new_total bigint;
BEGIN
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'invalid session';
  END IF;

  IF p_game_key IS NULL OR length(trim(p_game_key)) = 0 THEN
    RAISE EXCEPTION 'game_key required';
  END IF;

  v_score := GREATEST(0, LEAST(5000, COALESCE(p_score, 0)));
  v_xp := v_score;

  SELECT * INTO v_row FROM public.pm_students WHERE public.pm_students.id = v_student FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'student not found';
  END IF;

  v_before := v_row.level;
  v_new_total := LEAST(500000::bigint, v_row.total_xp + v_xp);
  v_after := public.pm_level_from_xp(v_new_total);

  UPDATE public.pm_students
  SET total_xp = v_new_total,
      level = v_after,
      updated_at = now()
  WHERE public.pm_students.id = v_student;

  INSERT INTO public.pm_xp_events (
    student_id, teacher_id, game_key, score, xp_awarded, level_before, level_after
  )
  VALUES (
    v_student, v_row.teacher_id, trim(p_game_key), v_score, v_xp, v_before, v_after
  );

  total_xp := v_new_total;
  level := v_after;
  xp_awarded := v_xp;
  level_before := v_before;
  level_after := v_after;
  leveled_up := v_after > v_before;
  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- Submit game run: hard clamp 5000
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_submit_game_run(
  p_session_token text,
  p_content_key text,
  p_score int
)
RETURNS TABLE (
  recorded boolean,
  practice_only boolean,
  score int,
  total_xp bigint,
  level int,
  xp_awarded int,
  level_before int,
  level_after int,
  leveled_up boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_student uuid := public.pm_student_id_from_session(p_session_token);
  v_row public.pm_students%ROWTYPE;
  v_score int;
  v_xp int;
  v_before int;
  v_after int;
  v_new_total bigint;
  v_active boolean;
BEGIN
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'invalid session';
  END IF;

  IF p_content_key IS NULL OR length(trim(p_content_key)) = 0 THEN
    RAISE EXCEPTION 'content_key required';
  END IF;

  v_score := GREATEST(0, LEAST(5000, COALESCE(p_score, 0)));

  SELECT * INTO v_row FROM public.pm_students WHERE public.pm_students.id = v_student FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'student not found';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.pm_class_contents cc
    WHERE cc.class_id = v_row.class_id
      AND cc.content_key = trim(p_content_key)
      AND cc.is_active = true
  ) INTO v_active;

  IF NOT v_active THEN
    recorded := false;
    practice_only := true;
    score := v_score;
    total_xp := v_row.total_xp;
    level := v_row.level;
    xp_awarded := 0;
    level_before := v_row.level;
    level_after := v_row.level;
    leveled_up := false;
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO public.pm_game_runs (student_id, class_id, content_key, score)
  VALUES (v_student, v_row.class_id, trim(p_content_key), v_score);

  v_xp := v_score;
  v_before := v_row.level;
  v_new_total := LEAST(500000::bigint, v_row.total_xp + v_xp);
  v_after := public.pm_level_from_xp(v_new_total);

  UPDATE public.pm_students
  SET total_xp = v_new_total,
      level = v_after,
      updated_at = now()
  WHERE public.pm_students.id = v_student;

  INSERT INTO public.pm_xp_events (
    student_id, teacher_id, game_key, score, xp_awarded, level_before, level_after
  )
  VALUES (
    v_student, v_row.teacher_id, trim(p_content_key), v_score, v_xp, v_before, v_after
  );

  recorded := true;
  practice_only := false;
  score := v_score;
  total_xp := v_new_total;
  level := v_after;
  xp_awarded := v_xp;
  level_before := v_before;
  level_after := v_after;
  leveled_up := v_after > v_before;
  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- Cumulative XP ranking (adventure)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_list_xp_ranking(
  p_session_token text,
  p_scope text DEFAULT 'class'
)
RETURNS TABLE (
  rank int,
  student_id uuid,
  display_name text,
  class_name text,
  total_xp bigint,
  level int,
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
    (row_number() OVER (ORDER BY st.total_xp DESC, st.level DESC, st.display_name ASC))::int AS rank,
    st.id AS student_id,
    st.display_name,
    c.name AS class_name,
    st.total_xp,
    st.level,
    (st.id = v_student) AS is_me
  FROM public.pm_students st
  JOIN public.pm_classes c ON c.id = st.class_id
  WHERE
    v_scope = 'world'
    OR (v_scope = 'school' AND st.teacher_id = v_teacher)
    OR (v_scope = 'class' AND st.class_id = v_class)
  ORDER BY st.total_xp DESC, st.level DESC, st.display_name ASC
  LIMIT 20;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_list_xp_ranking(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_list_xp_ranking(text, text) TO anon, authenticated;
