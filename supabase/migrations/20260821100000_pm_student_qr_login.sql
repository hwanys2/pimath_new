-- pimath: reusable per-student QR login tokens (textbook stickers).
-- Apply to shared DB only after explicit human confirmation.
-- Tokens are independent of passwords. Regenerating a QR does not change
-- the password; changing a password does not invalidate the QR.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

CREATE TABLE public.pm_student_qr_tokens (
  student_id uuid PRIMARY KEY REFERENCES public.pm_students (id) ON DELETE CASCADE,
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pm_student_qr_tokens_token_hex CHECK (token ~ '^[a-f0-9]{64}$')
);

CREATE UNIQUE INDEX pm_student_qr_tokens_token_uidx
  ON public.pm_student_qr_tokens (token);

ALTER TABLE public.pm_student_qr_tokens ENABLE ROW LEVEL SECURITY;
-- No policies for authenticated/anon — access only via SECURITY DEFINER RPCs.

REVOKE ALL ON TABLE public.pm_student_qr_tokens FROM PUBLIC;
REVOKE ALL ON TABLE public.pm_student_qr_tokens FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Internal: insert a token for an already-owned student (retry rare collisions)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_insert_student_qr_token(p_student_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token text;
  v_tries int := 0;
BEGIN
  LOOP
    v_token := encode(extensions.gen_random_bytes(32), 'hex');
    BEGIN
      INSERT INTO public.pm_student_qr_tokens (student_id, token)
      VALUES (p_student_id, v_token)
      ON CONFLICT (student_id) DO NOTHING;
      EXIT;
    EXCEPTION
      WHEN unique_violation THEN
        v_tries := v_tries + 1;
        IF v_tries >= 8 THEN
          RAISE EXCEPTION 'qr token collision';
        END IF;
    END;
  END LOOP;

  SELECT t.token INTO v_token
  FROM public.pm_student_qr_tokens t
  WHERE t.student_id = p_student_id;

  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_insert_student_qr_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pm_insert_student_qr_token(uuid) FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: get or create one student's QR token (owner teacher only)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_get_or_create_student_qr_token(
  p_student_id uuid
)
RETURNS TABLE (
  student_id uuid,
  display_name text,
  login_id text,
  token text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_teacher uuid := auth.uid();
  v_student public.pm_students%ROWTYPE;
  v_token text;
BEGIN
  IF v_teacher IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO v_student
  FROM public.pm_students s
  WHERE s.id = p_student_id
    AND s.teacher_id = v_teacher;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'student not found or not owned';
  END IF;

  SELECT t.token INTO v_token
  FROM public.pm_student_qr_tokens t
  WHERE t.student_id = v_student.id;

  IF NOT FOUND THEN
    v_token := public.pm_insert_student_qr_token(v_student.id);
  END IF;

  student_id := v_student.id;
  display_name := v_student.display_name;
  login_id := v_student.login_id;
  token := v_token;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_get_or_create_student_qr_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pm_get_or_create_student_qr_token(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.pm_get_or_create_student_qr_token(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: get or create QR tokens for every student in a class
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_list_or_create_class_qr_tokens(
  p_class_id uuid
)
RETURNS TABLE (
  student_id uuid,
  display_name text,
  login_id text,
  token text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_teacher uuid := auth.uid();
  v_student public.pm_students%ROWTYPE;
  v_token text;
BEGIN
  IF v_teacher IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.pm_classes c
    WHERE c.id = p_class_id
      AND c.teacher_id = v_teacher
  ) THEN
    RAISE EXCEPTION 'class not found or not owned';
  END IF;

  FOR v_student IN
    SELECT *
    FROM public.pm_students s
    WHERE s.class_id = p_class_id
      AND s.teacher_id = v_teacher
    ORDER BY s.display_name ASC, s.login_id ASC
  LOOP
    SELECT t.token INTO v_token
    FROM public.pm_student_qr_tokens t
    WHERE t.student_id = v_student.id;

    IF NOT FOUND THEN
      v_token := public.pm_insert_student_qr_token(v_student.id);
    END IF;

    student_id := v_student.id;
    display_name := v_student.display_name;
    login_id := v_student.login_id;
    token := v_token;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_list_or_create_class_qr_tokens(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pm_list_or_create_class_qr_tokens(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.pm_list_or_create_class_qr_tokens(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: rotate (invalidate old textbook stickers)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_rotate_student_qr_token(
  p_student_id uuid
)
RETURNS TABLE (
  student_id uuid,
  display_name text,
  login_id text,
  token text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_teacher uuid := auth.uid();
  v_student public.pm_students%ROWTYPE;
  v_token text;
  v_tries int := 0;
BEGIN
  IF v_teacher IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO v_student
  FROM public.pm_students s
  WHERE s.id = p_student_id
    AND s.teacher_id = v_teacher;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'student not found or not owned';
  END IF;

  LOOP
    v_token := encode(extensions.gen_random_bytes(32), 'hex');
    BEGIN
      INSERT INTO public.pm_student_qr_tokens (student_id, token, created_at)
      VALUES (v_student.id, v_token, now())
      ON CONFLICT (student_id) DO UPDATE
        SET token = EXCLUDED.token,
            created_at = EXCLUDED.created_at;
      EXIT;
    EXCEPTION
      WHEN unique_violation THEN
        v_tries := v_tries + 1;
        IF v_tries >= 8 THEN
          RAISE EXCEPTION 'qr token collision';
        END IF;
    END;
  END LOOP;

  student_id := v_student.id;
  display_name := v_student.display_name;
  login_id := v_student.login_id;
  token := v_token;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_rotate_student_qr_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pm_rotate_student_qr_token(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.pm_rotate_student_qr_token(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: redeem QR token → same session shape as pm_authenticate_student
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_authenticate_student_qr(
  p_token text
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
  v_token text := lower(trim(COALESCE(p_token, '')));
  v_row public.pm_students%ROWTYPE;
  v_session text;
  v_hash text;
BEGIN
  IF v_token !~ '^[a-f0-9]{64}$' THEN
    RETURN;
  END IF;

  SELECT s.* INTO v_row
  FROM public.pm_student_qr_tokens t
  JOIN public.pm_students s ON s.id = t.student_id
  WHERE t.token = v_token;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_session := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := encode(extensions.digest(v_session, 'sha256'), 'hex');

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
    v_session
  FROM public.pm_classes c
  WHERE c.id = v_row.class_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_authenticate_student_qr(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_authenticate_student_qr(text) TO anon, authenticated;
