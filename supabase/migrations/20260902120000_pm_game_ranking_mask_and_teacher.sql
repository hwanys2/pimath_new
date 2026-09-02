-- pimath: mask other-school names on game ranking; teacher school/world boards
-- Additive CREATE OR REPLACE of pm_* only. Does not ALTER/DROP foreducator objects.

-- ---------------------------------------------------------------------------
-- Student ranking: same signature. Mask display_name unless self / same class /
-- same teacher / same actual school (pm_teacher_schools.school_info_id).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_list_game_ranking(
  p_session_token text,
  p_content_key text,
  p_scope text DEFAULT 'class',
  p_mode text DEFAULT 'best'
)
RETURNS TABLE (
  rank int,
  student_id uuid,
  display_name text,
  class_name text,
  score int,
  created_at timestamptz,
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
  v_school bigint;
  v_scope text;
  v_mode text;
  v_key text;
BEGIN
  IF v_student IS NULL THEN
    RETURN;
  END IF;

  IF p_content_key IS NULL OR length(trim(p_content_key)) = 0 THEN
    RETURN;
  END IF;

  v_key := trim(p_content_key);

  SELECT st.class_id, st.teacher_id
  INTO v_class, v_teacher
  FROM public.pm_students st
  WHERE st.id = v_student;

  IF v_class IS NULL OR v_teacher IS NULL THEN
    RETURN;
  END IF;

  SELECT ts.school_info_id
  INTO v_school
  FROM public.pm_teacher_schools ts
  WHERE ts.teacher_id = v_teacher;

  v_scope := lower(coalesce(nullif(trim(p_scope), ''), 'class'));
  IF v_scope NOT IN ('world', 'school', 'class') THEN
    v_scope := 'class';
  END IF;

  v_mode := lower(coalesce(nullif(trim(p_mode), ''), 'best'));
  IF v_mode NOT IN ('all', 'best') THEN
    v_mode := 'best';
  END IF;

  IF v_mode = 'all' THEN
    RETURN QUERY
    SELECT
      (row_number() OVER (ORDER BY gr.score DESC, gr.created_at ASC))::int AS rank,
      gr.student_id,
      CASE
        WHEN gr.student_id = v_student THEN st.display_name
        WHEN st.class_id = v_class THEN st.display_name
        WHEN st.teacher_id = v_teacher THEN st.display_name
        WHEN v_school IS NOT NULL AND ts.school_info_id = v_school THEN st.display_name
        ELSE public.pm_anonymize_display_name(st.display_name)
      END AS display_name,
      c.name AS class_name,
      gr.score,
      gr.created_at,
      (gr.student_id = v_student) AS is_me
    FROM public.pm_game_runs gr
    JOIN public.pm_students st ON st.id = gr.student_id
    JOIN public.pm_classes c ON c.id = gr.class_id
    LEFT JOIN public.pm_teacher_schools ts ON ts.teacher_id = st.teacher_id
    WHERE gr.content_key = v_key
      AND (
        v_scope = 'world'
        OR (v_scope = 'school' AND st.teacher_id = v_teacher)
        OR (v_scope = 'class' AND gr.class_id = v_class)
      )
    ORDER BY gr.score DESC, gr.created_at ASC
    LIMIT 30;
  ELSE
    RETURN QUERY
    SELECT
      (row_number() OVER (ORDER BY best.score DESC, best.created_at ASC))::int AS rank,
      best.student_id,
      CASE
        WHEN best.student_id = v_student THEN st.display_name
        WHEN st.class_id = v_class THEN st.display_name
        WHEN st.teacher_id = v_teacher THEN st.display_name
        WHEN v_school IS NOT NULL AND ts.school_info_id = v_school THEN st.display_name
        ELSE public.pm_anonymize_display_name(st.display_name)
      END AS display_name,
      c.name AS class_name,
      best.score,
      best.created_at,
      (best.student_id = v_student) AS is_me
    FROM (
      SELECT DISTINCT ON (gr.student_id)
        gr.student_id,
        gr.class_id,
        gr.score,
        gr.created_at
      FROM public.pm_game_runs gr
      JOIN public.pm_students st2 ON st2.id = gr.student_id
      WHERE gr.content_key = v_key
        AND (
          v_scope = 'world'
          OR (v_scope = 'school' AND st2.teacher_id = v_teacher)
          OR (v_scope = 'class' AND gr.class_id = v_class)
        )
      ORDER BY gr.student_id, gr.score DESC, gr.created_at ASC
    ) best
    JOIN public.pm_students st ON st.id = best.student_id
    JOIN public.pm_classes c ON c.id = best.class_id
    LEFT JOIN public.pm_teacher_schools ts ON ts.teacher_id = st.teacher_id
    ORDER BY best.score DESC, best.created_at ASC
    LIMIT 30;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Teacher dashboard: class / school (same teacher) / world ranking.
-- World names masked unless the row is the teacher's student or same school.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_teacher_list_game_ranking(
  p_class_id uuid,
  p_content_key text,
  p_scope text DEFAULT 'class',
  p_mode text DEFAULT 'best'
)
RETURNS TABLE (
  rank int,
  student_id uuid,
  display_name text,
  class_name text,
  school_name text,
  student_number smallint,
  score int,
  created_at timestamptz,
  run_count int,
  is_masked boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_teacher uuid := auth.uid();
  v_class uuid;
  v_school bigint;
  v_scope text;
  v_mode text;
  v_key text;
BEGIN
  IF v_teacher IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_class_id IS NULL OR p_content_key IS NULL OR length(trim(p_content_key)) = 0 THEN
    RETURN;
  END IF;

  SELECT c.id
  INTO v_class
  FROM public.pm_classes c
  WHERE c.id = p_class_id AND c.teacher_id = v_teacher;

  IF v_class IS NULL THEN
    RAISE EXCEPTION 'class not found';
  END IF;

  v_key := trim(p_content_key);

  SELECT ts.school_info_id
  INTO v_school
  FROM public.pm_teacher_schools ts
  WHERE ts.teacher_id = v_teacher;

  v_scope := lower(coalesce(nullif(trim(p_scope), ''), 'class'));
  IF v_scope NOT IN ('world', 'school', 'class') THEN
    v_scope := 'class';
  END IF;

  v_mode := lower(coalesce(nullif(trim(p_mode), ''), 'best'));
  IF v_mode NOT IN ('all', 'best') THEN
    v_mode := 'best';
  END IF;

  IF v_mode = 'all' THEN
    RETURN QUERY
    SELECT
      (row_number() OVER (ORDER BY gr.score DESC, gr.created_at ASC))::int AS rank,
      gr.student_id,
      CASE
        WHEN st.teacher_id = v_teacher THEN st.display_name
        WHEN v_school IS NOT NULL AND ts.school_info_id = v_school THEN st.display_name
        ELSE public.pm_anonymize_display_name(st.display_name)
      END AS display_name,
      c.name AS class_name,
      ts.school_name,
      CASE
        WHEN st.teacher_id = v_teacher THEN st.student_number
        WHEN v_school IS NOT NULL AND ts.school_info_id = v_school THEN st.student_number
        ELSE NULL
      END AS student_number,
      gr.score,
      gr.created_at,
      1 AS run_count,
      NOT (
        st.teacher_id = v_teacher
        OR (v_school IS NOT NULL AND ts.school_info_id = v_school)
      ) AS is_masked
    FROM public.pm_game_runs gr
    JOIN public.pm_students st ON st.id = gr.student_id
    JOIN public.pm_classes c ON c.id = gr.class_id
    LEFT JOIN public.pm_teacher_schools ts ON ts.teacher_id = st.teacher_id
    WHERE gr.content_key = v_key
      AND (
        v_scope = 'world'
        OR (v_scope = 'school' AND st.teacher_id = v_teacher)
        OR (v_scope = 'class' AND gr.class_id = v_class)
      )
    ORDER BY gr.score DESC, gr.created_at ASC
    LIMIT 30;
  ELSE
    RETURN QUERY
    SELECT
      (row_number() OVER (ORDER BY best.score DESC, best.created_at ASC))::int AS rank,
      best.student_id,
      CASE
        WHEN st.teacher_id = v_teacher THEN st.display_name
        WHEN v_school IS NOT NULL AND ts.school_info_id = v_school THEN st.display_name
        ELSE public.pm_anonymize_display_name(st.display_name)
      END AS display_name,
      c.name AS class_name,
      ts.school_name,
      CASE
        WHEN st.teacher_id = v_teacher THEN st.student_number
        WHEN v_school IS NOT NULL AND ts.school_info_id = v_school THEN st.student_number
        ELSE NULL
      END AS student_number,
      best.score,
      best.created_at,
      rc.run_count,
      NOT (
        st.teacher_id = v_teacher
        OR (v_school IS NOT NULL AND ts.school_info_id = v_school)
      ) AS is_masked
    FROM (
      SELECT DISTINCT ON (gr.student_id)
        gr.student_id,
        gr.class_id,
        gr.score,
        gr.created_at
      FROM public.pm_game_runs gr
      JOIN public.pm_students st2 ON st2.id = gr.student_id
      WHERE gr.content_key = v_key
        AND (
          v_scope = 'world'
          OR (v_scope = 'school' AND st2.teacher_id = v_teacher)
          OR (v_scope = 'class' AND gr.class_id = v_class)
        )
      ORDER BY gr.student_id, gr.score DESC, gr.created_at ASC
    ) best
    JOIN public.pm_students st ON st.id = best.student_id
    JOIN public.pm_classes c ON c.id = best.class_id
    LEFT JOIN public.pm_teacher_schools ts ON ts.teacher_id = st.teacher_id
    JOIN (
      SELECT gr.student_id, count(*)::int AS run_count
      FROM public.pm_game_runs gr
      WHERE gr.content_key = v_key
      GROUP BY gr.student_id
    ) rc ON rc.student_id = best.student_id
    ORDER BY best.score DESC, best.created_at ASC
    LIMIT 30;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_teacher_list_game_ranking(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_teacher_list_game_ranking(uuid, text, text, text) TO authenticated;
