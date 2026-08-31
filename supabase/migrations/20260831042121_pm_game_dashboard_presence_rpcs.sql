-- pimath: teacher game dashboard RPCs (presence ping + live PvP/session)
-- Additive only. Does not ALTER/DROP foreducator objects.

CREATE OR REPLACE FUNCTION public.pm_ping_game_presence(
  p_session_token text,
  p_content_key text,
  p_phase text DEFAULT 'playing',
  p_live_score int DEFAULT NULL,
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_student uuid := public.pm_student_id_from_session(p_session_token);
  v_class uuid;
  v_phase text;
BEGIN
  IF v_student IS NULL THEN
    RETURN false;
  END IF;

  IF p_content_key IS NULL OR length(trim(p_content_key)) = 0 THEN
    RETURN false;
  END IF;

  SELECT s.class_id INTO v_class
  FROM public.pm_students s
  WHERE s.id = v_student;
  IF v_class IS NULL THEN
    RETURN false;
  END IF;

  v_phase := CASE
    WHEN p_phase IN ('lobby', 'waiting', 'playing', 'ended') THEN p_phase
    ELSE 'playing'
  END;

  INSERT INTO public.pm_game_presence (
    student_id, class_id, content_key, phase, live_score, meta, last_seen_at
  )
  VALUES (
    v_student,
    v_class,
    trim(p_content_key),
    v_phase,
    CASE WHEN p_live_score IS NULL THEN NULL ELSE GREATEST(0, p_live_score) END,
    COALESCE(p_meta, '{}'::jsonb),
    now()
  )
  ON CONFLICT (student_id, content_key) DO UPDATE
  SET
    class_id = EXCLUDED.class_id,
    phase = EXCLUDED.phase,
    live_score = EXCLUDED.live_score,
    meta = EXCLUDED.meta,
    last_seen_at = now();

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_leave_game_presence(
  p_session_token text,
  p_content_key text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_student uuid := public.pm_student_id_from_session(p_session_token);
BEGIN
  IF v_student IS NULL THEN
    RETURN false;
  END IF;

  IF p_content_key IS NULL OR length(trim(p_content_key)) = 0 THEN
    RETURN false;
  END IF;

  DELETE FROM public.pm_game_presence
  WHERE student_id = v_student
    AND content_key = trim(p_content_key);

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_ping_game_presence(text, text, text, int, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_ping_game_presence(text, text, text, int, jsonb) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.pm_leave_game_presence(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_leave_game_presence(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.pm_teacher_list_game_presence(
  p_class_id uuid,
  p_content_key text
)
RETURNS TABLE (
  student_id uuid,
  display_name text,
  phase text,
  live_score int,
  meta jsonb,
  last_seen_at timestamptz
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

  RETURN QUERY
  SELECT
    p.student_id,
    st.display_name,
    p.phase,
    p.live_score,
    p.meta,
    p.last_seen_at
  FROM public.pm_game_presence p
  JOIN public.pm_students st ON st.id = p.student_id
  WHERE p.class_id = p_class_id
    AND p.content_key = trim(p_content_key)
    AND p.last_seen_at > now() - interval '20 seconds'
  ORDER BY p.last_seen_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_teacher_list_game_presence(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_teacher_list_game_presence(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.pm_teacher_list_live_pvp(
  p_class_id uuid,
  p_table text
)
RETURNS TABLE (
  game_id uuid,
  black_student_id uuid,
  white_student_id uuid,
  black_name text,
  white_name text,
  turn text,
  move_count int,
  game_phase text,
  scope text,
  updated_at timestamptz
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
      g.id,
      g.black_student_id,
      g.white_student_id,
      g.black_name,
      g.white_name,
      g.turn,
      g.move_count,
      'playing'::text,
      g.scope,
      g.updated_at
    FROM public.pm_omok_games g
    WHERE g.status = 'playing'
      AND g.scope <> 'ai'
      AND (
        g.black_student_id IN (SELECT s.id FROM public.pm_students s WHERE s.class_id = p_class_id)
        OR g.white_student_id IN (SELECT s.id FROM public.pm_students s WHERE s.class_id = p_class_id)
      )
    ORDER BY g.updated_at DESC;
  ELSIF p_table = 'quad' THEN
    RETURN QUERY
    SELECT
      g.id,
      g.black_student_id,
      g.white_student_id,
      g.black_name,
      g.white_name,
      g.turn,
      g.move_count,
      g.game_phase,
      g.scope,
      g.updated_at
    FROM public.pm_quad_games g
    WHERE g.status = 'playing'
      AND g.scope <> 'ai'
      AND (
        g.black_student_id IN (SELECT s.id FROM public.pm_students s WHERE s.class_id = p_class_id)
        OR g.white_student_id IN (SELECT s.id FROM public.pm_students s WHERE s.class_id = p_class_id)
      )
    ORDER BY g.updated_at DESC;
  ELSIF p_table = 'sq' THEN
    RETURN QUERY
    SELECT
      g.id,
      g.black_student_id,
      g.white_student_id,
      g.black_name,
      g.white_name,
      g.turn,
      g.move_count,
      g.game_phase,
      g.scope,
      g.updated_at
    FROM public.pm_sq_games g
    WHERE g.status = 'playing'
      AND g.scope <> 'ai'
      AND (
        g.black_student_id IN (SELECT s.id FROM public.pm_students s WHERE s.class_id = p_class_id)
        OR g.white_student_id IN (SELECT s.id FROM public.pm_students s WHERE s.class_id = p_class_id)
      )
    ORDER BY g.updated_at DESC;
  ELSE
    RAISE EXCEPTION 'unknown table';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_teacher_list_live_pvp(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_teacher_list_live_pvp(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.pm_teacher_list_pvp_queue(
  p_class_id uuid,
  p_table text
)
RETURNS TABLE (
  student_id uuid,
  display_name text,
  scope text,
  updated_at timestamptz
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
    SELECT q.student_id, q.display_name, q.scope, q.updated_at
    FROM public.pm_omok_queue q
    WHERE q.status = 'waiting'
      AND q.student_id IS NOT NULL
      AND (
        q.class_id = p_class_id
        OR q.student_id IN (SELECT s.id FROM public.pm_students s WHERE s.class_id = p_class_id)
      )
    ORDER BY q.updated_at DESC;
  ELSIF p_table = 'quad' THEN
    RETURN QUERY
    SELECT q.student_id, q.display_name, q.scope, q.updated_at
    FROM public.pm_quad_queue q
    WHERE q.status = 'waiting'
      AND q.student_id IS NOT NULL
      AND (
        q.class_id = p_class_id
        OR q.student_id IN (SELECT s.id FROM public.pm_students s WHERE s.class_id = p_class_id)
      )
    ORDER BY q.updated_at DESC;
  ELSIF p_table = 'sq' THEN
    RETURN QUERY
    SELECT q.student_id, q.display_name, q.scope, q.updated_at
    FROM public.pm_sq_queue q
    WHERE q.status = 'waiting'
      AND q.student_id IS NOT NULL
      AND (
        q.class_id = p_class_id
        OR q.student_id IN (SELECT s.id FROM public.pm_students s WHERE s.class_id = p_class_id)
      )
    ORDER BY q.updated_at DESC;
  ELSE
    RAISE EXCEPTION 'unknown table';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_teacher_list_pvp_queue(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_teacher_list_pvp_queue(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.pm_teacher_list_live_session_players(
  p_class_id uuid,
  p_game text
)
RETURNS TABLE (
  session_id uuid,
  session_phase text,
  round_number int,
  student_id uuid,
  display_name text,
  score int,
  extra jsonb,
  updated_at timestamptz
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
      s.id,
      s.phase,
      s.round_number,
      p.student_id,
      p.display_name,
      p.session_score,
      jsonb_build_object(
        'pick', p.pick,
        'roundScore', p.round_score
      ),
      s.updated_at
    FROM public.pm_dice_race_sessions s
    JOIN public.pm_dice_race_players p ON p.session_id = s.id
    WHERE s.class_id = p_class_id
      AND s.teacher_id = v_teacher
      AND s.phase <> 'closed'
    ORDER BY p.session_score DESC, p.joined_at ASC;
  ELSIF p_game = 'ball_box' THEN
    RETURN QUERY
    SELECT
      s.id,
      s.phase,
      s.round_number,
      p.student_id,
      p.display_name,
      p.score,
      jsonb_build_object(
        'solved', p.solved,
        'drawCount', p.draw_count,
        'wrongAttempts', p.wrong_attempts
      ),
      s.updated_at
    FROM public.pm_ball_box_sessions s
    JOIN public.pm_ball_box_players p ON p.session_id = s.id
    WHERE s.class_id = p_class_id
      AND s.teacher_id = v_teacher
      AND s.phase <> 'closed'
    ORDER BY p.score DESC, p.joined_at ASC;
  ELSE
    RAISE EXCEPTION 'unknown game';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_teacher_list_live_session_players(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_teacher_list_live_session_players(uuid, text) TO authenticated;
