-- Compact student boards: top N plus a few neighbors around me (not ±1 only).

CREATE OR REPLACE FUNCTION public.pm_list_hof_students(
  p_scope text DEFAULT 'world',
  p_school_info_id bigint DEFAULT NULL,
  p_class_id uuid DEFAULT NULL,
  p_limit int DEFAULT 20,
  p_session_token text DEFAULT NULL
)
RETURNS TABLE (
  rank int,
  display_name text,
  class_name text,
  school_name text,
  school_info_id bigint,
  class_id uuid,
  total_xp bigint,
  level int,
  is_me boolean,
  is_masked boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit int := GREATEST(1, LEAST(coalesce(p_limit, 20), 50));
  v_scope text;
  v_student uuid;
  v_teacher uuid;
  v_class uuid;
  v_school bigint;
  v_filter_school bigint;
  v_filter_class uuid;
  v_around int := 3;
BEGIN
  v_scope := lower(coalesce(nullif(trim(p_scope), ''), 'world'));
  IF v_scope NOT IN ('world', 'school', 'class') THEN
    v_scope := 'world';
  END IF;

  SELECT v.student_id, v.teacher_id, v.class_id, v.school_info_id
  INTO v_student, v_teacher, v_class, v_school
  FROM public.pm_hof_resolve_viewer(p_session_token) v;

  v_filter_school := p_school_info_id;
  v_filter_class := p_class_id;

  IF v_scope = 'school' AND v_filter_school IS NULL THEN
    v_filter_school := v_school;
  END IF;

  IF v_scope = 'class' AND v_filter_class IS NULL THEN
    IF v_student IS NOT NULL THEN
      v_filter_class := v_class;
    END IF;
  END IF;

  IF v_scope = 'school' AND v_filter_school IS NULL THEN
    RETURN;
  END IF;

  IF v_scope = 'class' AND v_filter_class IS NULL AND v_teacher IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH ranked AS (
    SELECT
      (row_number() OVER (
        ORDER BY st.total_xp DESC, st.level DESC, st.display_name ASC
      ))::int AS rnk,
      st.display_name AS raw_name,
      c.name AS cname,
      ts.school_name AS sname,
      ts.school_info_id AS sid,
      st.class_id AS cid,
      st.total_xp AS xp,
      st.level AS lvl,
      (v_student IS NOT NULL AND st.id = v_student) AS mine,
      (
        (v_student IS NOT NULL AND st.id = v_student)
        OR (v_class IS NOT NULL AND st.class_id = v_class)
        OR (v_teacher IS NOT NULL AND v_student IS NULL AND st.teacher_id = v_teacher)
        OR (v_school IS NOT NULL AND ts.school_info_id = v_school)
      ) AS reveal
    FROM public.pm_students st
    JOIN public.pm_classes c ON c.id = st.class_id
    LEFT JOIN public.pm_teacher_schools ts ON ts.teacher_id = st.teacher_id
    WHERE st.total_xp > 0
      AND (
        v_scope = 'world'
        OR (v_scope = 'school' AND ts.school_info_id = v_filter_school)
        OR (
          v_scope = 'class'
          AND (
            (v_filter_class IS NOT NULL AND st.class_id = v_filter_class)
            OR (
              v_filter_class IS NULL
              AND v_teacher IS NOT NULL
              AND v_student IS NULL
              AND st.teacher_id = v_teacher
            )
          )
        )
      )
  ),
  mine_row AS (
    SELECT r.rnk AS my_rank
    FROM ranked r
    WHERE r.mine
    LIMIT 1
  )
  SELECT
    r.rnk,
    CASE
      WHEN r.reveal THEN r.raw_name
      ELSE public.pm_anonymize_display_name(r.raw_name)
    END,
    r.cname,
    r.sname,
    r.sid,
    r.cid,
    r.xp,
    r.lvl,
    r.mine,
    (NOT r.reveal)
  FROM ranked r
  LEFT JOIN mine_row m ON TRUE
  WHERE r.rnk <= v_limit
     OR (
       m.my_rank IS NOT NULL
       AND r.rnk BETWEEN m.my_rank - v_around AND m.my_rank + v_around
     )
  ORDER BY r.rnk;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_list_hof_students(text, bigint, uuid, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_list_hof_students(text, bigint, uuid, int, text) TO anon, authenticated;
