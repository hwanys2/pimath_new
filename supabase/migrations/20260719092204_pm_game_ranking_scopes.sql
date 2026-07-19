-- pimath: game ranking scopes — world / school (teacher) / class
-- Apply to shared DB only after explicit human confirmation.

CREATE INDEX IF NOT EXISTS pm_game_runs_content_score_idx
  ON public.pm_game_runs (content_key, score DESC, created_at ASC);

-- ---------------------------------------------------------------------------
-- Unified ranking RPC
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
      st.display_name,
      c.name AS class_name,
      gr.score,
      gr.created_at,
      (gr.student_id = v_student) AS is_me
    FROM public.pm_game_runs gr
    JOIN public.pm_students st ON st.id = gr.student_id
    JOIN public.pm_classes c ON c.id = gr.class_id
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
      st.display_name,
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
    ORDER BY best.score DESC, best.created_at ASC
    LIMIT 30;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_list_game_ranking(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_list_game_ranking(text, text, text, text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Legacy wrapper → class scope
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_list_class_game_ranking(
  p_session_token text,
  p_content_key text,
  p_mode text DEFAULT 'best'
)
RETURNS TABLE (
  rank int,
  student_id uuid,
  display_name text,
  score int,
  created_at timestamptz,
  is_me boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    r.rank,
    r.student_id,
    r.display_name,
    r.score,
    r.created_at,
    r.is_me
  FROM public.pm_list_game_ranking(
    p_session_token,
    p_content_key,
    'class',
    p_mode
  ) r;
$$;

REVOKE ALL ON FUNCTION public.pm_list_class_game_ranking(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_list_class_game_ranking(text, text, text) TO anon, authenticated;
