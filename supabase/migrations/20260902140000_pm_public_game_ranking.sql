-- pimath: public top-5 game ranking preview (unit cards / 랭킹보기)
-- Additive CREATE of pm_* only. Does not ALTER/DROP foreducator objects.

CREATE OR REPLACE FUNCTION public.pm_list_public_game_ranking(
  p_content_key text,
  p_session_token text DEFAULT NULL
)
RETURNS TABLE (
  rank int,
  display_name text,
  class_name text,
  school_name text,
  score int,
  is_me boolean,
  is_masked boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_student uuid;
  v_teacher uuid;
  v_class uuid;
  v_school bigint;
  v_key text;
BEGIN
  IF p_content_key IS NULL OR length(trim(p_content_key)) = 0 THEN
    RETURN;
  END IF;

  v_key := trim(p_content_key);

  SELECT v.student_id, v.teacher_id, v.class_id, v.school_info_id
  INTO v_student, v_teacher, v_class, v_school
  FROM public.pm_hof_resolve_viewer(p_session_token) v;

  RETURN QUERY
  SELECT
    ranked.rnk,
    CASE
      WHEN ranked.reveal THEN ranked.raw_name
      ELSE public.pm_anonymize_display_name(ranked.raw_name)
    END,
    ranked.cname,
    ranked.sname,
    ranked.score,
    ranked.mine,
    (NOT ranked.reveal)
  FROM (
    SELECT
      (row_number() OVER (ORDER BY best.score DESC, best.created_at ASC))::int AS rnk,
      st.display_name AS raw_name,
      c.name AS cname,
      ts.school_name AS sname,
      best.score,
      (v_student IS NOT NULL AND best.student_id = v_student) AS mine,
      (
        (v_student IS NOT NULL AND best.student_id = v_student)
        OR (v_class IS NOT NULL AND st.class_id = v_class)
        OR (v_teacher IS NOT NULL AND st.teacher_id = v_teacher)
        OR (v_school IS NOT NULL AND ts.school_info_id = v_school)
      ) AS reveal
    FROM (
      SELECT DISTINCT ON (gr.student_id)
        gr.student_id,
        gr.class_id,
        gr.score,
        gr.created_at
      FROM public.pm_game_runs gr
      WHERE gr.content_key = v_key
      ORDER BY gr.student_id, gr.score DESC, gr.created_at ASC
    ) best
    JOIN public.pm_students st ON st.id = best.student_id
    JOIN public.pm_classes c ON c.id = best.class_id
    LEFT JOIN public.pm_teacher_schools ts ON ts.teacher_id = st.teacher_id
    ORDER BY best.score DESC, best.created_at ASC
    LIMIT 5
  ) ranked
  ORDER BY ranked.rnk;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_list_public_game_ranking(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_list_public_game_ranking(text, text) TO anon, authenticated;
