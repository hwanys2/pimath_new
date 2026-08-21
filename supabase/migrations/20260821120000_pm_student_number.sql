-- pimath: class roster student number (번호)
-- Additive only: nullable column on pm_students + pimath RPC updates.
-- Apply to shared DB only after explicit human confirmation.

-- ---------------------------------------------------------------------------
-- Column
-- ---------------------------------------------------------------------------

ALTER TABLE public.pm_students
  ADD COLUMN IF NOT EXISTS student_number smallint
  CONSTRAINT pm_students_student_number_range
    CHECK (student_number IS NULL OR (student_number >= 1 AND student_number <= 999));

CREATE UNIQUE INDEX IF NOT EXISTS pm_students_class_student_number_uidx
  ON public.pm_students (class_id, student_number)
  WHERE student_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS pm_students_class_id_student_number_idx
  ON public.pm_students (class_id, student_number);

GRANT SELECT (student_number) ON TABLE public.pm_students TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: create student (adds optional p_student_number)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_create_student(
  p_class_id uuid,
  p_display_name text,
  p_login_id text,
  p_password text,
  p_student_number smallint DEFAULT NULL
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

  IF p_student_number IS NOT NULL AND (p_student_number < 1 OR p_student_number > 999) THEN
    RAISE EXCEPTION 'invalid student_number';
  END IF;

  SELECT * INTO v_class
  FROM public.pm_classes c
  WHERE c.id = p_class_id AND c.teacher_id = v_teacher;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'class not found or not owned';
  END IF;

  INSERT INTO public.pm_students (
    class_id, teacher_id, login_id, password_hash, display_name, student_number
  )
  VALUES (
    p_class_id,
    v_teacher,
    v_login,
    public.pm_hash_password(p_password),
    v_name,
    p_student_number
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

DROP FUNCTION IF EXISTS public.pm_create_student(uuid, text, text, text);

REVOKE ALL ON FUNCTION public.pm_create_student(uuid, text, text, text, smallint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pm_create_student(uuid, text, text, text, smallint) FROM anon;
GRANT EXECUTE ON FUNCTION public.pm_create_student(uuid, text, text, text, smallint) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: bulk create students
-- p_students: jsonb array of { "display_name", "login_id", "password", "student_number"? }
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
  v_number_text text;
  v_number smallint;
  v_created jsonb := '[]'::jsonb;
  v_errors jsonb := '[]'::jsonb;
  v_row public.pm_students;
  v_constraint text;
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
      v_number_text := trim(COALESCE(v_elem ->> 'student_number', ''));
      v_number := NULL;

      IF v_name = '' THEN
        RAISE EXCEPTION 'display_name required';
      END IF;
      IF v_login = '' OR v_login ~ '\s' THEN
        RAISE EXCEPTION 'invalid login_id';
      END IF;
      IF v_password = '' THEN
        RAISE EXCEPTION 'password required';
      END IF;
      IF v_number_text <> '' THEN
        IF v_number_text !~ '^[0-9]+$' THEN
          RAISE EXCEPTION 'invalid student_number';
        END IF;
        v_number := v_number_text::smallint;
        IF v_number < 1 OR v_number > 999 THEN
          RAISE EXCEPTION 'invalid student_number';
        END IF;
      END IF;

      INSERT INTO public.pm_students (
        class_id, teacher_id, login_id, password_hash, display_name, student_number
      )
      VALUES (
        p_class_id,
        v_teacher,
        v_login,
        public.pm_hash_password(v_password),
        v_name,
        v_number
      )
      RETURNING * INTO v_row;

      v_created := v_created || jsonb_build_array(
        jsonb_build_object(
          'id', v_row.id,
          'login_id', v_row.login_id,
          'display_name', v_row.display_name,
          'student_number', v_row.student_number,
          'class_id', v_row.class_id
        )
      );
    EXCEPTION
      WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        v_errors := v_errors || jsonb_build_array(
          jsonb_build_object(
            'index', v_idx,
            'login_id', COALESCE(v_login, ''),
            'message', CASE
              WHEN COALESCE(v_constraint, '') LIKE '%student_number%'
                OR SQLERRM LIKE '%student_number%'
              THEN '같은 학급에 이미 있는 번호예요'
              ELSE '이미 사용 중인 아이디예요'
            END
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
REVOKE ALL ON FUNCTION public.pm_bulk_create_students(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.pm_bulk_create_students(uuid, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: update student profile fields (not password)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_update_student(
  p_student_id uuid,
  p_display_name text,
  p_login_id text,
  p_student_number smallint DEFAULT NULL
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

  IF p_student_number IS NOT NULL AND (p_student_number < 1 OR p_student_number > 999) THEN
    RAISE EXCEPTION 'invalid student_number';
  END IF;

  UPDATE public.pm_students s
  SET display_name = v_name,
      login_id = v_login,
      student_number = p_student_number,
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

DROP FUNCTION IF EXISTS public.pm_update_student(uuid, text, text);

REVOKE ALL ON FUNCTION public.pm_update_student(uuid, text, text, smallint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pm_update_student(uuid, text, text, smallint) FROM anon;
GRANT EXECUTE ON FUNCTION public.pm_update_student(uuid, text, text, smallint) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: class QR tokens — sort by student_number, include number in result
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.pm_list_or_create_class_qr_tokens(uuid);

CREATE OR REPLACE FUNCTION public.pm_list_or_create_class_qr_tokens(
  p_class_id uuid
)
RETURNS TABLE (
  student_id uuid,
  display_name text,
  login_id text,
  token text,
  student_number smallint
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
    ORDER BY s.student_number ASC NULLS LAST, s.display_name ASC, s.login_id ASC
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
    student_number := v_student.student_number;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_list_or_create_class_qr_tokens(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pm_list_or_create_class_qr_tokens(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.pm_list_or_create_class_qr_tokens(uuid) TO authenticated;
