-- pimath: game run scores + class ranking (assigned+active only)
-- Apply to shared DB only after explicit human confirmation.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

CREATE TABLE public.pm_game_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.pm_students (id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.pm_classes (id) ON DELETE CASCADE,
  content_key text NOT NULL,
  score int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pm_game_runs_content_key_not_blank
    CHECK (length(trim(content_key)) > 0),
  CONSTRAINT pm_game_runs_score_range
    CHECK (score >= 0 AND score <= 1000)
);

CREATE INDEX pm_game_runs_class_content_score_idx
  ON public.pm_game_runs (class_id, content_key, score DESC, created_at DESC);

CREATE INDEX pm_game_runs_student_content_score_idx
  ON public.pm_game_runs (student_id, content_key, score DESC);

ALTER TABLE public.pm_game_runs ENABLE ROW LEVEL SECURITY;

-- No direct table access — session RPCs only (same pattern as pm_xp_events)
REVOKE ALL ON TABLE public.pm_game_runs FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Submit: record run + award XP only when class has content assigned+active
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

  v_score := GREATEST(0, LEAST(1000, COALESCE(p_score, 0)));

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

REVOKE ALL ON FUNCTION public.pm_submit_game_run(text, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_submit_game_run(text, text, int) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ranking: all runs vs best-per-student
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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_student uuid := public.pm_student_id_from_session(p_session_token);
  v_class uuid;
  v_mode text;
BEGIN
  IF v_student IS NULL THEN
    RETURN;
  END IF;

  IF p_content_key IS NULL OR length(trim(p_content_key)) = 0 THEN
    RETURN;
  END IF;

  SELECT st.class_id INTO v_class
  FROM public.pm_students st
  WHERE st.id = v_student;

  IF v_class IS NULL THEN
    RETURN;
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
      gr.score,
      gr.created_at,
      (gr.student_id = v_student) AS is_me
    FROM public.pm_game_runs gr
    JOIN public.pm_students st ON st.id = gr.student_id
    WHERE gr.class_id = v_class
      AND gr.content_key = trim(p_content_key)
    ORDER BY gr.score DESC, gr.created_at ASC
    LIMIT 30;
  ELSE
    RETURN QUERY
    SELECT
      (row_number() OVER (ORDER BY best.score DESC, best.created_at ASC))::int AS rank,
      best.student_id,
      st.display_name,
      best.score,
      best.created_at,
      (best.student_id = v_student) AS is_me
    FROM (
      SELECT DISTINCT ON (gr.student_id)
        gr.student_id,
        gr.score,
        gr.created_at
      FROM public.pm_game_runs gr
      WHERE gr.class_id = v_class
        AND gr.content_key = trim(p_content_key)
      ORDER BY gr.student_id, gr.score DESC, gr.created_at ASC
    ) best
    JOIN public.pm_students st ON st.id = best.student_id
    ORDER BY best.score DESC, best.created_at ASC
    LIMIT 30;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_list_class_game_ranking(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_list_class_game_ranking(text, text, text) TO anon, authenticated;
