-- pimath: student XP / level / sessions (additive only)
-- Keep level formula in sync with lib/xp.ts

-- ---------------------------------------------------------------------------
-- Columns on pm_students
-- ---------------------------------------------------------------------------

ALTER TABLE public.pm_students
  ADD COLUMN IF NOT EXISTS total_xp bigint NOT NULL DEFAULT 0
    CHECK (total_xp >= 0),
  ADD COLUMN IF NOT EXISTS level int NOT NULL DEFAULT 1
    CHECK (level >= 1 AND level <= 100),
  ADD COLUMN IF NOT EXISTS active_avatar text NOT NULL DEFAULT 'pi'
    CHECK (active_avatar IN ('pi', 'chowon', 'eondeok', 'byeolbit'));

GRANT SELECT (total_xp, level, active_avatar) ON TABLE public.pm_students TO authenticated;

-- ---------------------------------------------------------------------------
-- XP event log
-- ---------------------------------------------------------------------------

CREATE TABLE public.pm_xp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.pm_students (id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  game_key text NOT NULL,
  score int NOT NULL CHECK (score >= 0 AND score <= 1000),
  xp_awarded int NOT NULL CHECK (xp_awarded >= 0 AND xp_awarded <= 1000),
  level_before int NOT NULL,
  level_after int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT pm_xp_events_game_key_not_blank CHECK (length(trim(game_key)) > 0)
);

CREATE INDEX pm_xp_events_student_id_idx ON public.pm_xp_events (student_id);
CREATE INDEX pm_xp_events_teacher_id_idx ON public.pm_xp_events (teacher_id);
CREATE INDEX pm_xp_events_created_at_idx ON public.pm_xp_events (created_at DESC);

ALTER TABLE public.pm_xp_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY pm_xp_events_select_own
  ON public.pm_xp_events FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

REVOKE ALL ON TABLE public.pm_xp_events FROM anon;
GRANT SELECT ON TABLE public.pm_xp_events TO authenticated;

-- ---------------------------------------------------------------------------
-- Student sessions (opaque token hash)
-- ---------------------------------------------------------------------------

CREATE TABLE public.pm_student_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.pm_students (id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX pm_student_sessions_student_id_idx
  ON public.pm_student_sessions (student_id);

ALTER TABLE public.pm_student_sessions ENABLE ROW LEVEL SECURITY;
-- No policies for authenticated/anon — access only via SECURITY DEFINER RPCs.

REVOKE ALL ON TABLE public.pm_student_sessions FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Level from XP (mirror lib/xp.ts)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_level_from_xp(p_total_xp bigint)
RETURNS int
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_xp bigint := GREATEST(0, COALESCE(p_total_xp, 0));
  v_lo int := 1;
  v_hi int := 100;
  v_mid int;
  v_need numeric;
BEGIN
  IF v_xp >= 1000000 THEN
    RETURN 100;
  END IF;

  WHILE v_lo < v_hi LOOP
    v_mid := CEIL((v_lo + v_hi + 1)::numeric / 2)::int;
    IF v_mid <= 1 THEN
      v_need := 0;
    ELSIF v_mid >= 100 THEN
      v_need := 1000000;
    ELSE
      v_need := FLOOR(1000000 * POWER(((v_mid - 1)::numeric / 99), 2.4));
    END IF;

    IF v_need <= v_xp THEN
      v_lo := v_mid;
    ELSE
      v_hi := v_mid - 1;
    END IF;
  END LOOP;

  RETURN v_lo;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_level_from_xp(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_level_from_xp(bigint) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.pm_cumulative_xp_for_level(p_level int)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_level <= 1 THEN 0::bigint
    WHEN p_level >= 100 THEN 1000000::bigint
    ELSE FLOOR(1000000 * POWER(((p_level - 1)::numeric / 99), 2.4))::bigint
  END;
$$;

-- ---------------------------------------------------------------------------
-- Replace authenticate to also mint a session token
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.pm_authenticate_student(text, text);

CREATE OR REPLACE FUNCTION public.pm_authenticate_student(
  p_login_id text,
  p_password text
)
RETURNS TABLE (
  id uuid,
  login_id text,
  display_name text,
  class_id uuid,
  class_name text,
  teacher_id uuid,
  total_xp bigint,
  level int,
  active_avatar text,
  session_token text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_login text := public.pm_normalize_login_id(p_login_id);
  v_row public.pm_students%ROWTYPE;
  v_token text;
  v_hash text;
BEGIN
  IF v_login IS NULL OR v_login = '' OR p_password IS NULL OR p_password = '' THEN
    RETURN;
  END IF;

  IF v_login ~ '\s' THEN
    RETURN;
  END IF;

  SELECT * INTO v_row
  FROM public.pm_students s
  WHERE s.login_id = v_login;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_row.password_hash IS DISTINCT FROM extensions.crypt(p_password, v_row.password_hash) THEN
    RETURN;
  END IF;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  INSERT INTO public.pm_student_sessions (student_id, token_hash, expires_at)
  VALUES (v_row.id, v_hash, now() + interval '30 days');

  RETURN QUERY
  SELECT
    v_row.id,
    v_row.login_id,
    v_row.display_name,
    v_row.class_id,
    c.name,
    v_row.teacher_id,
    v_row.total_xp,
    v_row.level,
    v_row.active_avatar,
    v_token
  FROM public.pm_classes c
  WHERE c.id = v_row.class_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_authenticate_student(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_authenticate_student(text, text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Revoke session
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_revoke_student_session(p_session_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash text;
BEGIN
  IF p_session_token IS NULL OR p_session_token = '' THEN
    RETURN;
  END IF;

  v_hash := encode(extensions.digest(p_session_token, 'sha256'), 'hex');

  UPDATE public.pm_student_sessions
  SET revoked_at = now()
  WHERE token_hash = v_hash
    AND revoked_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_revoke_student_session(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_revoke_student_session(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Resolve session → student
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_student_id_from_session(p_session_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash text;
  v_student uuid;
BEGIN
  IF p_session_token IS NULL OR length(p_session_token) < 16 THEN
    RETURN NULL;
  END IF;

  v_hash := encode(extensions.digest(p_session_token, 'sha256'), 'hex');

  SELECT s.student_id INTO v_student
  FROM public.pm_student_sessions s
  WHERE s.token_hash = v_hash
    AND s.revoked_at IS NULL
    AND s.expires_at > now();

  RETURN v_student;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_student_id_from_session(text) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Get progress
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_get_student_progress(p_session_token text)
RETURNS TABLE (
  id uuid,
  login_id text,
  display_name text,
  class_id uuid,
  class_name text,
  teacher_id uuid,
  total_xp bigint,
  level int,
  active_avatar text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_student uuid := public.pm_student_id_from_session(p_session_token);
BEGIN
  IF v_student IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    st.id,
    st.login_id,
    st.display_name,
    st.class_id,
    c.name,
    st.teacher_id,
    st.total_xp,
    st.level,
    st.active_avatar
  FROM public.pm_students st
  JOIN public.pm_classes c ON c.id = st.class_id
  WHERE st.id = v_student;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_get_student_progress(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_get_student_progress(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Award XP
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_award_student_xp(
  p_session_token text,
  p_game_key text,
  p_score int
)
RETURNS TABLE (
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
BEGIN
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'invalid session';
  END IF;

  IF p_game_key IS NULL OR length(trim(p_game_key)) = 0 THEN
    RAISE EXCEPTION 'game_key required';
  END IF;

  v_score := GREATEST(0, LEAST(1000, COALESCE(p_score, 0)));
  v_xp := v_score;

  SELECT * INTO v_row FROM public.pm_students WHERE public.pm_students.id = v_student FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'student not found';
  END IF;

  v_before := v_row.level;
  v_new_total := LEAST(1000000::bigint, v_row.total_xp + v_xp);
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
    v_student, v_row.teacher_id, trim(p_game_key), v_score, v_xp, v_before, v_after
  );

  total_xp := v_new_total;
  level := v_after;
  xp_awarded := v_xp;
  level_before := v_before;
  level_after := v_after;
  leveled_up := v_after > v_before;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_award_student_xp(text, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_award_student_xp(text, text, int) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Set avatar
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_set_student_avatar(
  p_session_token text,
  p_avatar text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_student uuid := public.pm_student_id_from_session(p_session_token);
  v_level int;
  v_avatar text := lower(trim(COALESCE(p_avatar, '')));
  v_need int;
BEGIN
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'invalid session';
  END IF;

  IF v_avatar NOT IN ('pi', 'chowon', 'eondeok', 'byeolbit') THEN
    RAISE EXCEPTION 'invalid avatar';
  END IF;

  SELECT level INTO v_level FROM public.pm_students WHERE id = v_student;

  v_need := CASE v_avatar
    WHEN 'pi' THEN 1
    WHEN 'chowon' THEN 5
    WHEN 'eondeok' THEN 15
    WHEN 'byeolbit' THEN 30
  END;

  IF v_level < v_need THEN
    RAISE EXCEPTION 'avatar locked';
  END IF;

  UPDATE public.pm_students
  SET active_avatar = v_avatar,
      updated_at = now()
  WHERE id = v_student;

  RETURN v_avatar;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_set_student_avatar(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_set_student_avatar(text, text) TO anon, authenticated;
