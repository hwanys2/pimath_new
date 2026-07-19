-- pimath: teacher classes + student accounts (isolated from foreducator Auth)
-- Uses extensions.pgcrypto (already installed) for password hashing.
-- Apply to shared DB only after explicit human confirmation.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.pm_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  grade smallint CHECK (grade IS NULL OR grade BETWEEN 1 AND 3),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pm_classes_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE INDEX pm_classes_teacher_id_idx ON public.pm_classes (teacher_id);

CREATE TABLE public.pm_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.pm_classes (id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  login_id text NOT NULL,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pm_students_login_id_not_blank CHECK (length(trim(login_id)) > 0),
  CONSTRAINT pm_students_display_name_not_blank CHECK (length(trim(display_name)) > 0),
  CONSTRAINT pm_students_login_id_no_space CHECK (login_id !~ '\s'),
  CONSTRAINT pm_students_login_id_lower CHECK (login_id = lower(login_id))
);

CREATE UNIQUE INDEX pm_students_login_id_uidx ON public.pm_students (login_id);
CREATE INDEX pm_students_class_id_idx ON public.pm_students (class_id);
CREATE INDEX pm_students_teacher_id_idx ON public.pm_students (teacher_id);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER pm_classes_set_updated_at
  BEFORE UPDATE ON public.pm_classes
  FOR EACH ROW
  EXECUTE FUNCTION public.pm_set_updated_at();

CREATE TRIGGER pm_students_set_updated_at
  BEFORE UPDATE ON public.pm_students
  FOR EACH ROW
  EXECUTE FUNCTION public.pm_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.pm_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_students ENABLE ROW LEVEL SECURITY;

CREATE POLICY pm_classes_select_own
  ON public.pm_classes FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY pm_classes_insert_own
  ON public.pm_classes FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY pm_classes_update_own
  ON public.pm_classes FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY pm_classes_delete_own
  ON public.pm_classes FOR DELETE TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY pm_students_select_own
  ON public.pm_students FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY pm_students_update_own
  ON public.pm_students FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY pm_students_delete_own
  ON public.pm_students FOR DELETE TO authenticated
  USING (teacher_id = auth.uid());

-- No direct INSERT on pm_students for authenticated — use RPCs that hash passwords.
-- No policies for anon on tables.

REVOKE ALL ON TABLE public.pm_classes FROM anon;
REVOKE ALL ON TABLE public.pm_students FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pm_classes TO authenticated;
GRANT SELECT, UPDATE, DELETE ON TABLE public.pm_students TO authenticated;

-- Hide password hashes from the Data API / PostgREST for authenticated role.
REVOKE SELECT (password_hash) ON TABLE public.pm_students FROM authenticated;
REVOKE UPDATE (password_hash) ON TABLE public.pm_students FROM authenticated;
GRANT SELECT (
  id, class_id, teacher_id, login_id, display_name, created_at, updated_at
) ON TABLE public.pm_students TO authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_normalize_login_id(p_login_id text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(p_login_id));
$$;

CREATE OR REPLACE FUNCTION public.pm_hash_password(p_password text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT extensions.crypt(p_password, extensions.gen_salt('bf'));
$$;

REVOKE ALL ON FUNCTION public.pm_hash_password(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pm_normalize_login_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_normalize_login_id(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: authenticate student (anon + authenticated)
-- ---------------------------------------------------------------------------

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
  teacher_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_login text := public.pm_normalize_login_id(p_login_id);
  v_row public.pm_students%ROWTYPE;
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

  RETURN QUERY
  SELECT
    v_row.id,
    v_row.login_id,
    v_row.display_name,
    v_row.class_id,
    c.name,
    v_row.teacher_id
  FROM public.pm_classes c
  WHERE c.id = v_row.class_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_authenticate_student(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_authenticate_student(text, text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: set password (owner teacher only)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_set_student_password(
  p_student_id uuid,
  p_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_password IS NULL OR length(p_password) = 0 THEN
    RAISE EXCEPTION 'password required';
  END IF;

  UPDATE public.pm_students s
  SET password_hash = public.pm_hash_password(p_password),
      updated_at = now()
  WHERE s.id = p_student_id
    AND s.teacher_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'student not found or not owned';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_set_student_password(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_set_student_password(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: create student
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_create_student(
  p_class_id uuid,
  p_display_name text,
  p_login_id text,
  p_password text
)
RETURNS TABLE (
  id uuid,
  class_id uuid,
  teacher_id uuid,
  login_id text,
  display_name text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_teacher uuid := auth.uid();
  v_login text := public.pm_normalize_login_id(p_login_id);
  v_name text := trim(p_display_name);
  v_class public.pm_classes%ROWTYPE;
  v_row public.pm_students;
BEGIN
  IF v_teacher IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF v_name IS NULL OR v_name = '' THEN
    RAISE EXCEPTION 'display_name required';
  END IF;

  IF v_login IS NULL OR v_login = '' OR v_login ~ '\s' THEN
    RAISE EXCEPTION 'invalid login_id';
  END IF;

  IF p_password IS NULL OR length(p_password) = 0 THEN
    RAISE EXCEPTION 'password required';
  END IF;

  SELECT * INTO v_class
  FROM public.pm_classes c
  WHERE c.id = p_class_id AND c.teacher_id = v_teacher;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'class not found or not owned';
  END IF;

  INSERT INTO public.pm_students (
    class_id, teacher_id, login_id, password_hash, display_name
  )
  VALUES (
    p_class_id,
    v_teacher,
    v_login,
    public.pm_hash_password(p_password),
    v_name
  )
  RETURNING * INTO v_row;

  id := v_row.id;
  class_id := v_row.class_id;
  teacher_id := v_row.teacher_id;
  login_id := v_row.login_id;
  display_name := v_row.display_name;
  created_at := v_row.created_at;
  updated_at := v_row.updated_at;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_create_student(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_create_student(uuid, text, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: bulk create students
-- p_students: jsonb array of { "display_name", "login_id", "password" }
-- returns jsonb: { "created": [...], "errors": [{ "index", "login_id", "message" }] }
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_bulk_create_students(
  p_class_id uuid,
  p_students jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_teacher uuid := auth.uid();
  v_class public.pm_classes%ROWTYPE;
  v_elem jsonb;
  v_idx int := 0;
  v_login text;
  v_name text;
  v_password text;
  v_created jsonb := '[]'::jsonb;
  v_errors jsonb := '[]'::jsonb;
  v_row public.pm_students;
BEGIN
  IF v_teacher IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_students IS NULL OR jsonb_typeof(p_students) <> 'array' THEN
    RAISE EXCEPTION 'p_students must be a json array';
  END IF;

  SELECT * INTO v_class
  FROM public.pm_classes c
  WHERE c.id = p_class_id AND c.teacher_id = v_teacher;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'class not found or not owned';
  END IF;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_students)
  LOOP
    BEGIN
      v_name := trim(COALESCE(v_elem ->> 'display_name', ''));
      v_login := public.pm_normalize_login_id(COALESCE(v_elem ->> 'login_id', ''));
      v_password := COALESCE(v_elem ->> 'password', '');

      IF v_name = '' THEN
        RAISE EXCEPTION 'display_name required';
      END IF;
      IF v_login = '' OR v_login ~ '\s' THEN
        RAISE EXCEPTION 'invalid login_id';
      END IF;
      IF v_password = '' THEN
        RAISE EXCEPTION 'password required';
      END IF;

      INSERT INTO public.pm_students (
        class_id, teacher_id, login_id, password_hash, display_name
      )
      VALUES (
        p_class_id,
        v_teacher,
        v_login,
        public.pm_hash_password(v_password),
        v_name
      )
      RETURNING * INTO v_row;

      v_created := v_created || jsonb_build_array(
        jsonb_build_object(
          'id', v_row.id,
          'login_id', v_row.login_id,
          'display_name', v_row.display_name,
          'class_id', v_row.class_id
        )
      );
    EXCEPTION
      WHEN unique_violation THEN
        v_errors := v_errors || jsonb_build_array(
          jsonb_build_object(
            'index', v_idx,
            'login_id', COALESCE(v_login, ''),
            'message', '이미 사용 중인 아이디예요'
          )
        );
      WHEN OTHERS THEN
        v_errors := v_errors || jsonb_build_array(
          jsonb_build_object(
            'index', v_idx,
            'login_id', COALESCE(v_login, ''),
            'message', SQLERRM
          )
        );
    END;

    v_idx := v_idx + 1;
  END LOOP;

  RETURN jsonb_build_object('created', v_created, 'errors', v_errors);
END;
$$;

REVOKE ALL ON FUNCTION public.pm_bulk_create_students(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_bulk_create_students(uuid, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: update student profile fields (not password)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_update_student(
  p_student_id uuid,
  p_display_name text,
  p_login_id text
)
RETURNS TABLE (
  id uuid,
  class_id uuid,
  teacher_id uuid,
  login_id text,
  display_name text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher uuid := auth.uid();
  v_login text := public.pm_normalize_login_id(p_login_id);
  v_name text := trim(p_display_name);
  v_row public.pm_students;
BEGIN
  IF v_teacher IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF v_name IS NULL OR v_name = '' THEN
    RAISE EXCEPTION 'display_name required';
  END IF;

  IF v_login IS NULL OR v_login = '' OR v_login ~ '\s' THEN
    RAISE EXCEPTION 'invalid login_id';
  END IF;

  UPDATE public.pm_students s
  SET display_name = v_name,
      login_id = v_login,
      updated_at = now()
  WHERE s.id = p_student_id
    AND s.teacher_id = v_teacher
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'student not found or not owned';
  END IF;

  id := v_row.id;
  class_id := v_row.class_id;
  teacher_id := v_row.teacher_id;
  login_id := v_row.login_id;
  display_name := v_row.display_name;
  created_at := v_row.created_at;
  updated_at := v_row.updated_at;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_update_student(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_update_student(uuid, text, text) TO authenticated;
