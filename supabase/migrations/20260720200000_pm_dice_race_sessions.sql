-- pm_dice_race: teacher-led dice sum classroom game (pimath only)
-- Apply to shared DB only after explicit human confirmation.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.pm_dice_race_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.pm_classes(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL,
  content_key text NOT NULL,
  phase text NOT NULL DEFAULT 'lobby'
    CHECK (phase IN ('lobby', 'picking', 'rolling', 'round_end', 'closed')),
  counts jsonb NOT NULL DEFAULT '{"2":0,"3":0,"4":0,"5":0,"6":0,"7":0,"8":0,"9":0,"10":0,"11":0,"12":0}'::jsonb,
  round_number int NOT NULL DEFAULT 1 CHECK (round_number >= 1),
  winning_sum int CHECK (winning_sum IS NULL OR (winning_sum >= 2 AND winning_sum <= 12)),
  last_d1 int CHECK (last_d1 IS NULL OR (last_d1 >= 1 AND last_d1 <= 6)),
  last_d2 int CHECK (last_d2 IS NULL OR (last_d2 >= 1 AND last_d2 <= 6)),
  last_sum int CHECK (last_sum IS NULL OR (last_sum >= 2 AND last_sum <= 12)),
  roll_count int NOT NULL DEFAULT 0 CHECK (roll_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pm_dice_race_sessions_content_key_not_blank
    CHECK (length(trim(content_key)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS pm_dice_race_one_active_per_class
  ON public.pm_dice_race_sessions (class_id)
  WHERE phase <> 'closed';

CREATE INDEX IF NOT EXISTS pm_dice_race_sessions_class_idx
  ON public.pm_dice_race_sessions (class_id, phase, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.pm_dice_race_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.pm_dice_race_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.pm_students(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '탐험가',
  pick int CHECK (pick IS NULL OR (pick >= 2 AND pick <= 12)),
  session_score int NOT NULL DEFAULT 0 CHECK (session_score >= 0),
  round_score int NOT NULL DEFAULT 0 CHECK (round_score >= 0),
  xp_claimed_round int NOT NULL DEFAULT 0 CHECK (xp_claimed_round >= 0),
  joined_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pm_dice_race_players_unique_student UNIQUE (session_id, student_id)
);

CREATE INDEX IF NOT EXISTS pm_dice_race_players_session_idx
  ON public.pm_dice_race_players (session_id, session_score DESC);

ALTER TABLE public.pm_dice_race_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_dice_race_players ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.pm_dice_race_sessions FROM anon, authenticated;
REVOKE ALL ON TABLE public.pm_dice_race_players FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_dice_race_empty_counts()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT '{"2":0,"3":0,"4":0,"5":0,"6":0,"7":0,"8":0,"9":0,"10":0,"11":0,"12":0}'::jsonb;
$$;

CREATE OR REPLACE FUNCTION public.pm_dice_race_assert_teacher(p_session_id uuid)
RETURNS public.pm_dice_race_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_teacher uuid := auth.uid();
  v_row public.pm_dice_race_sessions%ROWTYPE;
BEGIN
  IF v_teacher IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO v_row
  FROM public.pm_dice_race_sessions s
  WHERE s.id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session not found';
  END IF;

  IF v_row.teacher_id <> v_teacher THEN
    RAISE EXCEPTION 'not session owner';
  END IF;

  RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- Create session (teacher)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_dice_race_create_session(
  p_class_id uuid,
  p_content_key text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_teacher uuid := auth.uid();
  v_key text := trim(p_content_key);
  v_class public.pm_classes%ROWTYPE;
  v_id uuid;
BEGIN
  IF v_teacher IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF v_key IS NULL OR v_key = '' THEN
    RAISE EXCEPTION 'content_key required';
  END IF;

  SELECT * INTO v_class
  FROM public.pm_classes c
  WHERE c.id = p_class_id AND c.teacher_id = v_teacher;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'class not found or not owned';
  END IF;

  UPDATE public.pm_dice_race_sessions
  SET phase = 'closed', updated_at = now()
  WHERE class_id = p_class_id AND phase <> 'closed';

  INSERT INTO public.pm_dice_race_sessions (
    class_id, teacher_id, content_key, phase, counts
  )
  VALUES (
    p_class_id, v_teacher, v_key, 'lobby', public.pm_dice_race_empty_counts()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Open picking (teacher)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_dice_race_open_picking(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_row public.pm_dice_race_sessions%ROWTYPE;
BEGIN
  v_row := public.pm_dice_race_assert_teacher(p_session_id);

  IF v_row.phase NOT IN ('lobby', 'round_end') THEN
    RAISE EXCEPTION 'invalid phase for open picking';
  END IF;

  UPDATE public.pm_dice_race_sessions
  SET phase = 'picking',
      counts = public.pm_dice_race_empty_counts(),
      winning_sum = NULL,
      last_d1 = NULL,
      last_d2 = NULL,
      last_sum = NULL,
      roll_count = 0,
      updated_at = now()
  WHERE id = p_session_id;

  UPDATE public.pm_dice_race_players
  SET pick = NULL,
      round_score = 0
  WHERE session_id = p_session_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Join session (student)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_dice_race_join(
  p_session_token text,
  p_class_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_student uuid := public.pm_student_id_from_session(p_session_token);
  v_row public.pm_students%ROWTYPE;
  v_session public.pm_dice_race_sessions%ROWTYPE;
BEGIN
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'invalid session';
  END IF;

  SELECT * INTO v_row FROM public.pm_students WHERE id = v_student;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'student not found';
  END IF;

  IF v_row.class_id <> p_class_id THEN
    RAISE EXCEPTION 'wrong class';
  END IF;

  SELECT * INTO v_session
  FROM public.pm_dice_race_sessions s
  WHERE s.class_id = p_class_id
    AND s.phase <> 'closed'
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no active session';
  END IF;

  INSERT INTO public.pm_dice_race_players (
    session_id, student_id, display_name
  )
  VALUES (
    v_session.id,
    v_student,
    COALESCE(NULLIF(trim(v_row.display_name), ''), v_row.login_id, '탐험가')
  )
  ON CONFLICT (session_id, student_id) DO NOTHING;

  RETURN v_session.id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Pick number (student)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_dice_race_pick(
  p_session_token text,
  p_session_id uuid,
  p_pick int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_student uuid := public.pm_student_id_from_session(p_session_token);
  v_sess public.pm_dice_race_sessions%ROWTYPE;
BEGIN
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'invalid session';
  END IF;

  IF p_pick IS NULL OR p_pick < 2 OR p_pick > 12 THEN
    RAISE EXCEPTION 'invalid pick';
  END IF;

  SELECT * INTO v_sess
  FROM public.pm_dice_race_sessions s
  WHERE s.id = p_session_id;

  IF NOT FOUND OR v_sess.phase <> 'picking' THEN
    RAISE EXCEPTION 'cannot pick now';
  END IF;

  UPDATE public.pm_dice_race_players p
  SET pick = p_pick
  WHERE p.session_id = p_session_id
    AND p.student_id = v_student;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not in session';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Start rolling (teacher)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_dice_race_start_rolling(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_row public.pm_dice_race_sessions%ROWTYPE;
BEGIN
  v_row := public.pm_dice_race_assert_teacher(p_session_id);

  IF v_row.phase <> 'picking' THEN
    RAISE EXCEPTION 'invalid phase for start rolling';
  END IF;

  UPDATE public.pm_dice_race_sessions
  SET phase = 'rolling', updated_at = now()
  WHERE id = p_session_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Roll dice (teacher)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_dice_race_roll(p_session_id uuid)
RETURNS TABLE (
  d1 int,
  d2 int,
  sum int,
  phase text,
  winning_sum int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_row public.pm_dice_race_sessions%ROWTYPE;
  v_d1 int;
  v_d2 int;
  v_sum int;
  v_key text;
  v_count int;
  v_new_counts jsonb;
BEGIN
  v_row := public.pm_dice_race_assert_teacher(p_session_id);

  IF v_row.phase <> 'rolling' THEN
    RAISE EXCEPTION 'cannot roll now';
  END IF;

  v_d1 := floor(random() * 6)::int + 1;
  v_d2 := floor(random() * 6)::int + 1;
  v_sum := v_d1 + v_d2;
  v_key := v_sum::text;

  v_new_counts := v_row.counts;
  v_count := COALESCE((v_new_counts ->> v_key)::int, 0) + 1;
  v_new_counts := jsonb_set(v_new_counts, ARRAY[v_key], to_jsonb(v_count), true);

  UPDATE public.pm_dice_race_sessions
  SET counts = v_new_counts,
      last_d1 = v_d1,
      last_d2 = v_d2,
      last_sum = v_sum,
      roll_count = roll_count + 1,
      updated_at = now()
  WHERE id = p_session_id
  RETURNING * INTO v_row;

  UPDATE public.pm_dice_race_players p
  SET round_score = p.round_score + 10,
      session_score = p.session_score + 10
  WHERE p.session_id = p_session_id
    AND p.pick = v_sum;

  IF v_count >= 10 THEN
    UPDATE public.pm_dice_race_sessions
    SET phase = 'round_end',
        winning_sum = v_sum,
        updated_at = now()
    WHERE id = p_session_id;

    SELECT * INTO v_row FROM public.pm_dice_race_sessions WHERE id = p_session_id;
  END IF;

  d1 := v_d1;
  d2 := v_d2;
  sum := v_sum;
  phase := v_row.phase;
  winning_sum := v_row.winning_sum;
  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- Next round (teacher)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_dice_race_next_round(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_row public.pm_dice_race_sessions%ROWTYPE;
BEGIN
  v_row := public.pm_dice_race_assert_teacher(p_session_id);

  IF v_row.phase <> 'round_end' THEN
    RAISE EXCEPTION 'invalid phase for next round';
  END IF;

  UPDATE public.pm_dice_race_sessions
  SET phase = 'picking',
      counts = public.pm_dice_race_empty_counts(),
      winning_sum = NULL,
      last_d1 = NULL,
      last_d2 = NULL,
      last_sum = NULL,
      roll_count = 0,
      round_number = round_number + 1,
      updated_at = now()
  WHERE id = p_session_id;

  UPDATE public.pm_dice_race_players
  SET pick = NULL,
      round_score = 0
  WHERE session_id = p_session_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Close session (teacher)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_dice_race_close(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM public.pm_dice_race_assert_teacher(p_session_id);

  UPDATE public.pm_dice_race_sessions
  SET phase = 'closed', updated_at = now()
  WHERE id = p_session_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Claim round XP marker (student)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_dice_race_claim_round_xp(
  p_session_token text,
  p_session_id uuid
)
RETURNS TABLE (
  round_score int,
  round_number int,
  already_claimed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_student uuid := public.pm_student_id_from_session(p_session_token);
  v_sess public.pm_dice_race_sessions%ROWTYPE;
  v_player public.pm_dice_race_players%ROWTYPE;
BEGIN
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'invalid session';
  END IF;

  SELECT * INTO v_sess
  FROM public.pm_dice_race_sessions s
  WHERE s.id = p_session_id;

  IF NOT FOUND OR v_sess.phase <> 'round_end' THEN
    RAISE EXCEPTION 'cannot claim now';
  END IF;

  SELECT * INTO v_player
  FROM public.pm_dice_race_players p
  WHERE p.session_id = p_session_id AND p.student_id = v_student
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not in session';
  END IF;

  IF v_player.xp_claimed_round >= v_sess.round_number THEN
    round_score := v_player.round_score;
    round_number := v_sess.round_number;
    already_claimed := true;
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE public.pm_dice_race_players
  SET xp_claimed_round = v_sess.round_number
  WHERE id = v_player.id;

  round_score := v_player.round_score;
  round_number := v_sess.round_number;
  already_claimed := false;
  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- Poll (student)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_dice_race_poll(
  p_session_token text,
  p_session_id uuid
)
RETURNS TABLE (
  session_id uuid,
  class_id uuid,
  class_name text,
  phase text,
  round_number int,
  counts jsonb,
  winning_sum int,
  last_d1 int,
  last_d2 int,
  last_sum int,
  roll_count int,
  student_id uuid,
  display_name text,
  pick int,
  session_score int,
  round_score int,
  xp_claimed_round int,
  is_me boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_student uuid := public.pm_student_id_from_session(p_session_token);
  v_sess public.pm_dice_race_sessions%ROWTYPE;
  v_class_name text;
BEGIN
  IF v_student IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_sess
  FROM public.pm_dice_race_sessions s
  WHERE s.id = p_session_id AND s.phase <> 'closed';

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT c.name INTO v_class_name
  FROM public.pm_classes c
  WHERE c.id = v_sess.class_id;

  RETURN QUERY
  SELECT
    v_sess.id,
    v_sess.class_id,
    v_class_name,
    v_sess.phase,
    v_sess.round_number,
    v_sess.counts,
    v_sess.winning_sum,
    v_sess.last_d1,
    v_sess.last_d2,
    v_sess.last_sum,
    v_sess.roll_count,
    p.student_id,
    p.display_name,
    p.pick,
    COALESCE(p.session_score, 0),
    COALESCE(p.round_score, 0),
    COALESCE(p.xp_claimed_round, 0),
    (p.student_id = v_student) AS is_me
  FROM public.pm_dice_race_players p
  WHERE p.session_id = v_sess.id
  ORDER BY p.session_score DESC, p.joined_at ASC;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      v_sess.id,
      v_sess.class_id,
      v_class_name,
      v_sess.phase,
      v_sess.round_number,
      v_sess.counts,
      v_sess.winning_sum,
      v_sess.last_d1,
      v_sess.last_d2,
      v_sess.last_sum,
      v_sess.roll_count,
      NULL::uuid,
      NULL::text,
      NULL::int,
      0,
      0,
      0,
      false;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Poll (teacher)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_dice_race_teacher_poll(p_session_id uuid)
RETURNS TABLE (
  session_id uuid,
  class_id uuid,
  class_name text,
  phase text,
  round_number int,
  counts jsonb,
  winning_sum int,
  last_d1 int,
  last_d2 int,
  last_sum int,
  roll_count int,
  student_id uuid,
  display_name text,
  pick int,
  session_score int,
  round_score int,
  xp_claimed_round int,
  is_me boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_sess public.pm_dice_race_sessions%ROWTYPE;
  v_class_name text;
BEGIN
  v_sess := public.pm_dice_race_assert_teacher(p_session_id);

  IF v_sess.phase = 'closed' THEN
    RETURN;
  END IF;

  SELECT c.name INTO v_class_name
  FROM public.pm_classes c
  WHERE c.id = v_sess.class_id;

  RETURN QUERY
  SELECT
    v_sess.id,
    v_sess.class_id,
    v_class_name,
    v_sess.phase,
    v_sess.round_number,
    v_sess.counts,
    v_sess.winning_sum,
    v_sess.last_d1,
    v_sess.last_d2,
    v_sess.last_sum,
    v_sess.roll_count,
    p.student_id,
    p.display_name,
    p.pick,
    COALESCE(p.session_score, 0),
    COALESCE(p.round_score, 0),
    COALESCE(p.xp_claimed_round, 0),
    false AS is_me
  FROM public.pm_dice_race_players p
  WHERE p.session_id = v_sess.id
  ORDER BY p.session_score DESC, p.joined_at ASC;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      v_sess.id,
      v_sess.class_id,
      v_class_name,
      v_sess.phase,
      v_sess.round_number,
      v_sess.counts,
      v_sess.winning_sum,
      v_sess.last_d1,
      v_sess.last_d2,
      v_sess.last_sum,
      v_sess.roll_count,
      NULL::uuid,
      NULL::text,
      NULL::int,
      0,
      0,
      0,
      false;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Find active session for class (student)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_dice_race_find_active(p_class_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT s.id INTO v_id
  FROM public.pm_dice_race_sessions s
  WHERE s.class_id = p_class_id AND s.phase <> 'closed'
  ORDER BY s.created_at DESC
  LIMIT 1;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Find active session for class (teacher)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_dice_race_teacher_find_active(p_class_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_teacher uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_teacher IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT s.id INTO v_id
  FROM public.pm_dice_race_sessions s
  JOIN public.pm_classes c ON c.id = s.class_id
  WHERE s.class_id = p_class_id
    AND s.phase <> 'closed'
    AND c.teacher_id = v_teacher
  ORDER BY s.created_at DESC
  LIMIT 1;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.pm_dice_race_empty_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_dice_race_empty_counts() TO anon, authenticated;

REVOKE ALL ON FUNCTION public.pm_dice_race_assert_teacher(uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.pm_dice_race_create_session(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_dice_race_create_session(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.pm_dice_race_open_picking(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_dice_race_open_picking(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.pm_dice_race_join(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_dice_race_join(text, uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.pm_dice_race_pick(text, uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_dice_race_pick(text, uuid, int) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.pm_dice_race_start_rolling(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_dice_race_start_rolling(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.pm_dice_race_roll(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_dice_race_roll(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.pm_dice_race_next_round(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_dice_race_next_round(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.pm_dice_race_close(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_dice_race_close(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.pm_dice_race_claim_round_xp(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_dice_race_claim_round_xp(text, uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.pm_dice_race_poll(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_dice_race_poll(text, uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.pm_dice_race_teacher_poll(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_dice_race_teacher_poll(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.pm_dice_race_find_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_dice_race_find_active(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.pm_dice_race_teacher_find_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_dice_race_teacher_find_active(uuid) TO authenticated;
