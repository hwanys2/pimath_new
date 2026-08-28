-- Hall of Fame school/class boards: student_count is every enrolled student.
-- SUM(total_xp) already includes zeros, so ranking is unchanged; only COUNT was
-- previously limited by WHERE total_xp > 0.

CREATE OR REPLACE FUNCTION public.pm_list_hof_schools(
  p_limit int DEFAULT 20,
  p_session_token text DEFAULT NULL
)
RETURNS TABLE (
  rank int,
  school_info_id bigint,
  school_name text,
  region text,
  total_xp bigint,
  student_count int,
  is_mine boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit int := GREATEST(1, LEAST(coalesce(p_limit, 20), 50));
  v_school bigint;
BEGIN
  SELECT v.school_info_id INTO v_school
  FROM public.pm_hof_resolve_viewer(p_session_token) v;

  RETURN QUERY
  WITH ranked AS (
    SELECT
      (row_number() OVER (
        ORDER BY SUM(st.total_xp) DESC, MAX(ts.school_name) ASC
      ))::int AS rnk,
      ts.school_info_id AS sid,
      MAX(ts.school_name) AS sname,
      MAX(ts.region) AS sregion,
      SUM(st.total_xp)::bigint AS xp,
      COUNT(*)::int AS scount,
      (v_school IS NOT NULL AND ts.school_info_id = v_school) AS mine
    FROM public.pm_students st
    JOIN public.pm_teacher_schools ts ON ts.teacher_id = st.teacher_id
    GROUP BY ts.school_info_id
  )
  SELECT r.rnk, r.sid, r.sname, r.sregion, r.xp, r.scount, r.mine
  FROM ranked r
  WHERE r.rnk <= v_limit OR r.mine
  ORDER BY r.rnk;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_list_hof_schools(int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_list_hof_schools(int, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.pm_list_hof_classes(
  p_limit int DEFAULT 20,
  p_session_token text DEFAULT NULL
)
RETURNS TABLE (
  rank int,
  class_id uuid,
  class_name text,
  school_info_id bigint,
  school_name text,
  region text,
  total_xp bigint,
  student_count int,
  is_mine boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit int := GREATEST(1, LEAST(coalesce(p_limit, 20), 50));
  v_student uuid;
  v_teacher uuid;
  v_class uuid;
BEGIN
  SELECT v.student_id, v.teacher_id, v.class_id
  INTO v_student, v_teacher, v_class
  FROM public.pm_hof_resolve_viewer(p_session_token) v;

  RETURN QUERY
  WITH ranked AS (
    SELECT
      (row_number() OVER (
        ORDER BY SUM(st.total_xp) DESC, c.name ASC
      ))::int AS rnk,
      c.id AS cid,
      c.name AS cname,
      ts.school_info_id AS sid,
      ts.school_name AS sname,
      ts.region AS sregion,
      SUM(st.total_xp)::bigint AS xp,
      COUNT(*)::int AS scount,
      (
        (v_class IS NOT NULL AND c.id = v_class)
        OR (v_student IS NULL AND v_teacher IS NOT NULL AND c.teacher_id = v_teacher)
      ) AS mine
    FROM public.pm_students st
    JOIN public.pm_classes c ON c.id = st.class_id
    LEFT JOIN public.pm_teacher_schools ts ON ts.teacher_id = st.teacher_id
    GROUP BY c.id, c.name, c.teacher_id, ts.school_info_id, ts.school_name, ts.region
  )
  SELECT r.rnk, r.cid, r.cname, r.sid, r.sname, r.sregion, r.xp, r.scount, r.mine
  FROM ranked r
  WHERE r.rnk <= v_limit OR r.mine
  ORDER BY r.rnk;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_list_hof_classes(int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_list_hof_classes(int, text) TO anon, authenticated;
