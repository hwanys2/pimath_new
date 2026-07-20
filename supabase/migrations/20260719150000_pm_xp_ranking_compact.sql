-- Compact adventure XP ranking: top 3 ∪ my rank ±1 (deduped).

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
  WITH ranked AS (
    SELECT
      (row_number() OVER (
        ORDER BY st.total_xp DESC, st.level DESC, st.display_name ASC
      ))::int AS rank,
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
  ),
  my AS (
    SELECT r.rank AS my_rank
    FROM ranked r
    WHERE r.is_me
    LIMIT 1
  )
  SELECT
    r.rank,
    r.student_id,
    r.display_name,
    r.class_name,
    r.total_xp,
    r.level,
    r.is_me
  FROM ranked r
  CROSS JOIN my
  WHERE r.rank <= 3
     OR r.rank BETWEEN my.my_rank - 1 AND my.my_rank + 1
  ORDER BY r.rank;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_list_xp_ranking(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_list_xp_ranking(text, text) TO anon, authenticated;
