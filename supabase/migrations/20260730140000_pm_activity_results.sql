-- pimath: activity result details + simulation sessions + teacher read access
-- Apply to shared DB only after explicit human confirmation.

-- ---------------------------------------------------------------------------
-- pm_game_runs: per-run details (problem breakdown, etc.)
-- ---------------------------------------------------------------------------

ALTER TABLE public.pm_game_runs
  ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS pm_game_runs_class_content_created_idx
  ON public.pm_game_runs (class_id, content_key, created_at DESC);

-- Teachers read runs for their own classes (students still use RPC only)
CREATE POLICY pm_game_runs_select_own
  ON public.pm_game_runs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pm_classes c
    WHERE c.id = pm_game_runs.class_id AND c.teacher_id = auth.uid()
  ));

GRANT SELECT ON TABLE public.pm_game_runs TO authenticated;

-- ---------------------------------------------------------------------------
-- pm_activity_sessions: simulations & non-scored activities
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.pm_activity_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.pm_students (id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.pm_classes (id) ON DELETE CASCADE,
  content_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('started', 'completed')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  duration_sec int CHECK (duration_sec IS NULL OR duration_sec >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT pm_activity_sessions_content_key_not_blank
    CHECK (length(trim(content_key)) > 0)
);

CREATE INDEX IF NOT EXISTS pm_activity_sessions_class_content_idx
  ON public.pm_activity_sessions (class_id, content_key, created_at DESC);

CREATE INDEX IF NOT EXISTS pm_activity_sessions_student_content_idx
  ON public.pm_activity_sessions (student_id, content_key, created_at DESC);

ALTER TABLE public.pm_activity_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY pm_activity_sessions_select_own
  ON public.pm_activity_sessions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pm_classes c
    WHERE c.id = pm_activity_sessions.class_id AND c.teacher_id = auth.uid()
  ));

REVOKE ALL ON TABLE public.pm_activity_sessions FROM anon;
GRANT SELECT ON TABLE public.pm_activity_sessions TO authenticated;

-- ---------------------------------------------------------------------------
-- pm_submit_game_run: accept optional details, copy to xp_events.meta
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_submit_game_run(
  p_session_token text,
  p_content_key text,
  p_score int,
  p_details jsonb DEFAULT '{}'::jsonb
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
  v_details jsonb := COALESCE(p_details, '{}'::jsonb);
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

  INSERT INTO public.pm_game_runs (student_id, class_id, content_key, score, details)
  VALUES (v_student, v_row.class_id, trim(p_content_key), v_score, v_details);

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
    student_id, teacher_id, game_key, score, xp_awarded, level_before, level_after, meta
  )
  VALUES (
    v_student, v_row.teacher_id, trim(p_content_key), v_score, v_xp, v_before, v_after, v_details
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

REVOKE ALL ON FUNCTION public.pm_submit_game_run(text, text, int, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_submit_game_run(text, text, int, jsonb) TO anon, authenticated;

-- Keep 3-arg overload for backward compatibility
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
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT * FROM public.pm_submit_game_run(p_session_token, p_content_key, p_score, '{}'::jsonb);
$$;

REVOKE ALL ON FUNCTION public.pm_submit_game_run(text, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_submit_game_run(text, text, int) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- pm_submit_activity: simulation / non-scored activity sessions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_submit_activity(
  p_session_token text,
  p_content_key text,
  p_status text,
  p_details jsonb DEFAULT '{}'::jsonb,
  p_duration_sec int DEFAULT NULL
)
RETURNS TABLE (
  recorded boolean,
  practice_only boolean,
  session_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_student uuid := public.pm_student_id_from_session(p_session_token);
  v_row public.pm_students%ROWTYPE;
  v_active boolean;
  v_status text;
  v_details jsonb := COALESCE(p_details, '{}'::jsonb);
  v_id uuid;
BEGIN
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'invalid session';
  END IF;

  IF p_content_key IS NULL OR length(trim(p_content_key)) = 0 THEN
    RAISE EXCEPTION 'content_key required';
  END IF;

  v_status := lower(coalesce(nullif(trim(p_status), ''), 'completed'));
  IF v_status NOT IN ('started', 'completed') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  SELECT * INTO v_row FROM public.pm_students WHERE public.pm_students.id = v_student;
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
    session_id := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO public.pm_activity_sessions (
    student_id, class_id, content_key, status, details, duration_sec, completed_at
  )
  VALUES (
    v_student,
    v_row.class_id,
    trim(p_content_key),
    v_status,
    v_details,
    p_duration_sec,
    CASE WHEN v_status = 'completed' THEN now() ELSE NULL END
  )
  RETURNING id INTO v_id;

  recorded := true;
  practice_only := false;
  session_id := v_id;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_submit_activity(text, text, text, jsonb, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_submit_activity(text, text, text, jsonb, int) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Teacher read: PvP game history for a class
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_teacher_list_pvp_games(
  p_class_id uuid,
  p_table text
)
RETURNS TABLE (
  game_id uuid,
  student_id uuid,
  display_name text,
  opponent_name text,
  result text,
  scope text,
  played_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_teacher uuid := auth.uid();
BEGIN
  IF v_teacher IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.pm_classes c
    WHERE c.id = p_class_id AND c.teacher_id = v_teacher
  ) THEN
    RAISE EXCEPTION 'class not found';
  END IF;

  IF p_table = 'omok' THEN
    RETURN QUERY
    SELECT
      g.id AS game_id,
      st.id AS student_id,
      st.display_name,
      CASE
        WHEN g.black_student_id = st.id THEN g.white_name
        ELSE g.black_name
      END AS opponent_name,
      CASE
        WHEN g.status = 'draw' THEN 'draw'
        WHEN (g.status = 'black_win' AND g.black_student_id = st.id)
          OR (g.status = 'white_win' AND g.white_student_id = st.id) THEN 'win'
        ELSE 'loss'
      END AS result,
      g.scope,
      g.updated_at AS played_at
    FROM public.pm_omok_games g
    JOIN public.pm_students st ON st.class_id = p_class_id
      AND (g.black_student_id = st.id OR g.white_student_id = st.id)
    WHERE g.status <> 'playing'
      AND g.scope <> 'ai'
    ORDER BY g.updated_at DESC;
  ELSIF p_table = 'quad' THEN
    RETURN QUERY
    SELECT
      g.id,
      st.id,
      st.display_name,
      CASE WHEN g.black_student_id = st.id THEN g.white_name ELSE g.black_name END,
      CASE
        WHEN g.status = 'draw' THEN 'draw'
        WHEN (g.status = 'black_win' AND g.black_student_id = st.id)
          OR (g.status = 'white_win' AND g.white_student_id = st.id) THEN 'win'
        ELSE 'loss'
      END,
      g.scope,
      g.updated_at
    FROM public.pm_quad_games g
    JOIN public.pm_students st ON st.class_id = p_class_id
      AND (g.black_student_id = st.id OR g.white_student_id = st.id)
    WHERE g.status <> 'playing'
      AND g.scope <> 'ai'
    ORDER BY g.updated_at DESC;
  ELSIF p_table = 'sq' THEN
    RETURN QUERY
    SELECT
      g.id,
      st.id,
      st.display_name,
      CASE WHEN g.black_student_id = st.id THEN g.white_name ELSE g.black_name END,
      CASE
        WHEN g.status = 'draw' THEN 'draw'
        WHEN (g.status = 'black_win' AND g.black_student_id = st.id)
          OR (g.status = 'white_win' AND g.white_student_id = st.id) THEN 'win'
        ELSE 'loss'
      END,
      g.scope,
      g.updated_at
    FROM public.pm_sq_games g
    JOIN public.pm_students st ON st.class_id = p_class_id
      AND (g.black_student_id = st.id OR g.white_student_id = st.id)
    WHERE g.status <> 'playing'
      AND g.scope <> 'ai'
    ORDER BY g.updated_at DESC;
  ELSE
    RAISE EXCEPTION 'unknown table';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_teacher_list_pvp_games(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_teacher_list_pvp_games(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Teacher read: session game player scores (dice race / ball box)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_teacher_list_session_players(
  p_class_id uuid,
  p_game text
)
RETURNS TABLE (
  session_id uuid,
  student_id uuid,
  display_name text,
  session_score int,
  round_score int,
  played_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_teacher uuid := auth.uid();
BEGIN
  IF v_teacher IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.pm_classes c
    WHERE c.id = p_class_id AND c.teacher_id = v_teacher
  ) THEN
    RAISE EXCEPTION 'class not found';
  END IF;

  IF p_game = 'dice_race' THEN
    RETURN QUERY
    SELECT
      s.id AS session_id,
      p.student_id,
      p.display_name,
      p.session_score,
      p.round_score,
      s.updated_at AS played_at
    FROM public.pm_dice_race_sessions s
    JOIN public.pm_dice_race_players p ON p.session_id = s.id
    WHERE s.class_id = p_class_id
      AND s.teacher_id = v_teacher
    ORDER BY s.updated_at DESC, p.session_score DESC;
  ELSIF p_game = 'ball_box' THEN
    RETURN QUERY
    SELECT
      s.id,
      p.student_id,
      p.display_name,
      p.session_score,
      p.round_score,
      s.updated_at
    FROM public.pm_ball_box_sessions s
    JOIN public.pm_ball_box_players p ON p.session_id = s.id
    WHERE s.class_id = p_class_id
      AND s.teacher_id = v_teacher
    ORDER BY s.updated_at DESC, p.session_score DESC;
  ELSE
    RAISE EXCEPTION 'unknown game';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_teacher_list_session_players(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_teacher_list_session_players(uuid, text) TO authenticated;
