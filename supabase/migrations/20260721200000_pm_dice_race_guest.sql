-- pm_dice_race: guest (QR, no class) mode
-- Modifies only pm_dice_race_* objects (owned by pimath). Apply to shared DB only
-- after explicit human confirmation.

-- ---------------------------------------------------------------------------
-- Schema changes
-- ---------------------------------------------------------------------------

ALTER TABLE public.pm_dice_race_sessions
  ALTER COLUMN class_id DROP NOT NULL;

ALTER TABLE public.pm_dice_race_sessions
  ADD COLUMN IF NOT EXISTS join_code text;

CREATE UNIQUE INDEX IF NOT EXISTS pm_dice_race_join_code_active
  ON public.pm_dice_race_sessions (join_code)
  WHERE join_code IS NOT NULL AND phase <> 'closed';

ALTER TABLE public.pm_dice_race_players
  ALTER COLUMN student_id DROP NOT NULL;

ALTER TABLE public.pm_dice_race_players
  ADD COLUMN IF NOT EXISTS guest_key text;

CREATE UNIQUE INDEX IF NOT EXISTS pm_dice_race_players_unique_guest
  ON public.pm_dice_race_players (session_id, guest_key)
  WHERE guest_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Create guest session (teacher, no class) — returns id + join code
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_dice_race_create_guest_session(
  p_content_key text
)
RETURNS TABLE (session_id uuid, join_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_teacher uuid := auth.uid();
  v_key text := trim(p_content_key);
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_i int;
  v_id uuid;
BEGIN
  IF v_teacher IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF v_key IS NULL OR v_key = '' THEN
    RAISE EXCEPTION 'content_key required';
  END IF;

  UPDATE public.pm_dice_race_sessions
  SET phase = 'closed', updated_at = now()
  WHERE teacher_id = v_teacher AND class_id IS NULL AND phase <> 'closed';

  LOOP
    v_code := '';
    FOR v_i IN 1..6 LOOP
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars))::int + 1, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.pm_dice_race_sessions s
      WHERE s.join_code = v_code AND s.phase <> 'closed'
    );
  END LOOP;

  INSERT INTO public.pm_dice_race_sessions (
    class_id, teacher_id, content_key, phase, counts, join_code
  )
  VALUES (
    NULL, v_teacher, v_key, 'lobby', public.pm_dice_race_empty_counts(), v_code
  )
  RETURNING id INTO v_id;

  session_id := v_id;
  join_code := v_code;
  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- Find open session by join code / teacher's open guest session
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_dice_race_find_by_code(p_join_code text)
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
  WHERE upper(trim(p_join_code)) = s.join_code AND s.phase <> 'closed'
  ORDER BY s.created_at DESC
  LIMIT 1;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_dice_race_teacher_find_guest()
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
  WHERE s.teacher_id = v_teacher AND s.class_id IS NULL AND s.phase <> 'closed'
  ORDER BY s.created_at DESC
  LIMIT 1;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Guest join (name only)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_dice_race_guest_join(
  p_join_code text,
  p_guest_key text,
  p_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session public.pm_dice_race_sessions%ROWTYPE;
  v_name text;
BEGIN
  IF p_guest_key IS NULL OR length(trim(p_guest_key)) < 8 THEN
    RAISE EXCEPTION 'invalid guest key';
  END IF;

  SELECT * INTO v_session
  FROM public.pm_dice_race_sessions s
  WHERE upper(trim(p_join_code)) = s.join_code AND s.phase <> 'closed'
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no active session';
  END IF;

  v_name := left(COALESCE(NULLIF(trim(p_name), ''), '탐험가'), 20);

  INSERT INTO public.pm_dice_race_players (
    session_id, student_id, guest_key, display_name
  )
  VALUES (
    v_session.id, NULL, trim(p_guest_key), v_name
  )
  ON CONFLICT (session_id, guest_key) WHERE guest_key IS NOT NULL
  DO UPDATE SET display_name = EXCLUDED.display_name;

  RETURN v_session.id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Guest pick
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_dice_race_guest_pick(
  p_guest_key text,
  p_session_id uuid,
  p_pick int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_sess public.pm_dice_race_sessions%ROWTYPE;
BEGIN
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
    AND p.guest_key = trim(p_guest_key);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not in session';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Poll (guest)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_dice_race_guest_poll(
  p_guest_key text,
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
  join_code text,
  pid text,
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
  v_gk text := trim(p_guest_key);
BEGIN
  SELECT * INTO v_sess
  FROM public.pm_dice_race_sessions s
  WHERE s.id = p_session_id AND s.phase <> 'closed';

  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    v_sess.id,
    v_sess.class_id,
    NULL::text,
    v_sess.phase,
    v_sess.round_number,
    v_sess.counts,
    v_sess.winning_sum,
    v_sess.last_d1,
    v_sess.last_d2,
    v_sess.last_sum,
    v_sess.roll_count,
    v_sess.join_code,
    COALESCE(p.student_id::text, 'g:' || p.guest_key),
    p.student_id,
    p.display_name,
    CASE WHEN p.guest_key = v_gk THEN p.pick ELSE NULL END,
    COALESCE(p.session_score, 0),
    CASE WHEN p.guest_key = v_gk THEN COALESCE(p.round_score, 0) ELSE 0 END,
    CASE WHEN p.guest_key = v_gk THEN COALESCE(p.xp_claimed_round, 0) ELSE 0 END,
    (p.guest_key = v_gk) AS is_me
  FROM public.pm_dice_race_players p
  WHERE p.session_id = v_sess.id
  ORDER BY p.session_score DESC, p.joined_at ASC;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      v_sess.id,
      v_sess.class_id,
      NULL::text,
      v_sess.phase,
      v_sess.round_number,
      v_sess.counts,
      v_sess.winning_sum,
      v_sess.last_d1,
      v_sess.last_d2,
      v_sess.last_sum,
      v_sess.roll_count,
      v_sess.join_code,
      NULL::text,
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
-- Poll (teacher) — add join_code, pid, guest players
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.pm_dice_race_teacher_poll(uuid);

CREATE FUNCTION public.pm_dice_race_teacher_poll(p_session_id uuid)
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
  join_code text,
  pid text,
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
    v_sess.join_code,
    COALESCE(p.student_id::text, 'g:' || p.guest_key),
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
      v_sess.join_code,
      NULL::text,
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
-- Grants
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.pm_dice_race_create_guest_session(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_dice_race_create_guest_session(text) TO authenticated;

REVOKE ALL ON FUNCTION public.pm_dice_race_teacher_find_guest() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_dice_race_teacher_find_guest() TO authenticated;

REVOKE ALL ON FUNCTION public.pm_dice_race_find_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_dice_race_find_by_code(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.pm_dice_race_guest_join(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_dice_race_guest_join(text, text, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.pm_dice_race_guest_pick(text, uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_dice_race_guest_pick(text, uuid, int) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.pm_dice_race_guest_poll(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_dice_race_guest_poll(text, uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.pm_dice_race_teacher_poll(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_dice_race_teacher_poll(uuid) TO authenticated;
