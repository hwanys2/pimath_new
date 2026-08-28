-- pimath: Hall of Fame — real school snapshot + public/student/teacher XP boards.
-- Reads foreducator school_schoolinfo / common_profile but never writes them.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

CREATE TABLE public.pm_teacher_schools (
  teacher_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  school_info_id bigint NOT NULL,
  school_name text NOT NULL,
  region text,
  source text NOT NULL CHECK (source IN ('foreducator', 'manual')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pm_teacher_schools_name_not_blank CHECK (length(trim(school_name)) > 0)
);

CREATE INDEX pm_teacher_schools_school_info_id_idx
  ON public.pm_teacher_schools (school_info_id);

CREATE INDEX pm_students_total_xp_desc_idx
  ON public.pm_students (total_xp DESC)
  WHERE total_xp > 0;

CREATE TRIGGER pm_teacher_schools_set_updated_at
  BEFORE UPDATE ON public.pm_teacher_schools
  FOR EACH ROW
  EXECUTE FUNCTION public.pm_set_updated_at();

ALTER TABLE public.pm_teacher_schools ENABLE ROW LEVEL SECURITY;

CREATE POLICY pm_teacher_schools_select_own
  ON public.pm_teacher_schools FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

REVOKE ALL ON TABLE public.pm_teacher_schools FROM anon;
GRANT SELECT ON TABLE public.pm_teacher_schools TO authenticated;

-- Backfill from foreducator profiles (read-only).
INSERT INTO public.pm_teacher_schools (
  teacher_id, school_info_id, school_name, region, source
)
SELECT DISTINCT
  c.teacher_id,
  p.school_id,
  s."SCHUL_NM",
  NULLIF(trim(s."LCTN_SC_NM"), ''),
  'foreducator'
FROM public.pm_classes c
JOIN public.auth_user_supabase_mapping m ON m.supabase_uid = c.teacher_id
JOIN public.common_profile p ON p.user_id = m.django_user_id
JOIN public.school_schoolinfo s ON s.id = p.school_id
WHERE p.school_id IS NOT NULL
  AND length(trim(s."SCHUL_NM")) > 0
ON CONFLICT (teacher_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_anonymize_display_name(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN v_name IS NULL OR v_len = 0 THEN '*'
    WHEN v_len = 1 THEN '*'
    WHEN v_len = 2 THEN left(v_name, 1) || '*'
    ELSE overlay(v_name placing '*' from (v_len / 2) + 1 for 1)
  END
  FROM (
    SELECT trim(p_name) AS v_name, length(trim(p_name)) AS v_len
  ) s;
$$;

REVOKE ALL ON FUNCTION public.pm_anonymize_display_name(text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.pm_hof_resolve_viewer(p_session_token text DEFAULT NULL)
RETURNS TABLE (
  student_id uuid,
  teacher_id uuid,
  class_id uuid,
  school_info_id bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student uuid;
  v_teacher uuid;
  v_class uuid;
  v_school bigint;
BEGIN
  v_student := public.pm_student_id_from_session(p_session_token);

  IF v_student IS NOT NULL THEN
    SELECT st.teacher_id, st.class_id
    INTO v_teacher, v_class
    FROM public.pm_students st
    WHERE st.id = v_student;

    SELECT ts.school_info_id
    INTO v_school
    FROM public.pm_teacher_schools ts
    WHERE ts.teacher_id = v_teacher;

    student_id := v_student;
    teacher_id := v_teacher;
    class_id := v_class;
    school_info_id := v_school;
    RETURN NEXT;
    RETURN;
  END IF;

  v_teacher := auth.uid();
  IF v_teacher IS NULL THEN
    RETURN;
  END IF;

  SELECT ts.school_info_id
  INTO v_school
  FROM public.pm_teacher_schools ts
  WHERE ts.teacher_id = v_teacher;

  student_id := NULL;
  teacher_id := v_teacher;
  class_id := NULL;
  school_info_id := v_school;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_hof_resolve_viewer(text) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Teacher school sync / search / set
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_sync_teacher_school_from_foreducator()
RETURNS TABLE (
  school_info_id bigint,
  school_name text,
  region text,
  source text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_school_id bigint;
  v_school_name text;
  v_region text;
  v_existing_source text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  SELECT p.school_id, s."SCHUL_NM", NULLIF(trim(s."LCTN_SC_NM"), '')
  INTO v_school_id, v_school_name, v_region
  FROM public.auth_user_supabase_mapping m
  JOIN public.common_profile p ON p.user_id = m.django_user_id
  LEFT JOIN public.school_schoolinfo s ON s.id = p.school_id
  WHERE m.supabase_uid = v_uid
  LIMIT 1;

  IF v_school_id IS NULL OR v_school_name IS NULL OR length(trim(v_school_name)) = 0 THEN
    RETURN QUERY
    SELECT ts.school_info_id, ts.school_name, ts.region, ts.source
    FROM public.pm_teacher_schools ts
    WHERE ts.teacher_id = v_uid;
    RETURN;
  END IF;

  SELECT ts.source INTO v_existing_source
  FROM public.pm_teacher_schools ts
  WHERE ts.teacher_id = v_uid;

  IF v_existing_source IS NOT NULL AND v_existing_source <> 'foreducator' THEN
    RETURN QUERY
    SELECT ts.school_info_id, ts.school_name, ts.region, ts.source
    FROM public.pm_teacher_schools ts
    WHERE ts.teacher_id = v_uid;
    RETURN;
  END IF;

  INSERT INTO public.pm_teacher_schools (
    teacher_id, school_info_id, school_name, region, source
  ) VALUES (
    v_uid, v_school_id, trim(v_school_name), v_region, 'foreducator'
  )
  ON CONFLICT (teacher_id) DO UPDATE
    SET school_info_id = EXCLUDED.school_info_id,
        school_name = EXCLUDED.school_name,
        region = EXCLUDED.region,
        source = 'foreducator'
    WHERE public.pm_teacher_schools.source = 'foreducator';

  RETURN QUERY
  SELECT ts.school_info_id, ts.school_name, ts.region, ts.source
  FROM public.pm_teacher_schools ts
  WHERE ts.teacher_id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_sync_teacher_school_from_foreducator() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_sync_teacher_school_from_foreducator() TO authenticated;

CREATE OR REPLACE FUNCTION public.pm_search_schools(p_query text)
RETURNS TABLE (
  school_info_id bigint,
  school_name text,
  region text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  v_q := trim(coalesce(p_query, ''));
  v_q := replace(replace(v_q, '%', ''), '_', '');
  IF length(v_q) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s."SCHUL_NM",
    NULLIF(trim(s."LCTN_SC_NM"), '')
  FROM public.school_schoolinfo s
  WHERE s."SCHUL_NM" ILIKE '%' || v_q || '%'
    AND length(trim(s."SCHUL_NM")) > 0
  ORDER BY
    CASE WHEN s."SCHUL_NM" ILIKE v_q || '%' THEN 0 ELSE 1 END,
    s."SCHUL_NM",
    s."LCTN_SC_NM" NULLS LAST
  LIMIT 20;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_search_schools(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_search_schools(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.pm_set_teacher_school(p_school_info_id bigint)
RETURNS TABLE (
  school_info_id bigint,
  school_name text,
  region text,
  source text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text;
  v_region text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_school_info_id IS NULL THEN
    RAISE EXCEPTION 'school required';
  END IF;

  SELECT s."SCHUL_NM", NULLIF(trim(s."LCTN_SC_NM"), '')
  INTO v_name, v_region
  FROM public.school_schoolinfo s
  WHERE s.id = p_school_info_id;

  IF v_name IS NULL OR length(trim(v_name)) = 0 THEN
    RAISE EXCEPTION 'school not found';
  END IF;

  INSERT INTO public.pm_teacher_schools (
    teacher_id, school_info_id, school_name, region, source
  ) VALUES (
    v_uid, p_school_info_id, trim(v_name), v_region, 'manual'
  )
  ON CONFLICT (teacher_id) DO UPDATE
    SET school_info_id = EXCLUDED.school_info_id,
        school_name = EXCLUDED.school_name,
        region = EXCLUDED.region,
        source = 'manual';

  RETURN QUERY
  SELECT ts.school_info_id, ts.school_name, ts.region, ts.source
  FROM public.pm_teacher_schools ts
  WHERE ts.teacher_id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_set_teacher_school(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_set_teacher_school(bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.pm_get_my_teacher_school()
RETURNS TABLE (
  school_info_id bigint,
  school_name text,
  region text,
  source text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT ts.school_info_id, ts.school_name, ts.region, ts.source
  FROM public.pm_teacher_schools ts
  WHERE ts.teacher_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.pm_get_my_teacher_school() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_get_my_teacher_school() TO authenticated;

-- ---------------------------------------------------------------------------
-- Viewer context (ranks + school/class)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_get_hof_viewer(p_session_token text DEFAULT NULL)
RETURNS TABLE (
  kind text,
  student_id uuid,
  teacher_id uuid,
  class_id uuid,
  class_name text,
  school_info_id bigint,
  school_name text,
  region text,
  world_rank int,
  school_rank int,
  class_rank int,
  school_board_rank int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student uuid;
  v_teacher uuid;
  v_class uuid;
  v_school bigint;
  v_kind text;
BEGIN
  SELECT v.student_id, v.teacher_id, v.class_id, v.school_info_id
  INTO v_student, v_teacher, v_class, v_school
  FROM public.pm_hof_resolve_viewer(p_session_token) v;

  IF v_student IS NOT NULL THEN
    v_kind := 'student';
  ELSIF v_teacher IS NOT NULL THEN
    v_kind := 'teacher';
  ELSE
    v_kind := 'anon';
  END IF;

  RETURN QUERY
  SELECT
    v_kind,
    v_student,
    v_teacher,
    v_class,
    c.name,
    v_school,
    ts.school_name,
    ts.region,
    CASE WHEN v_student IS NULL THEN NULL ELSE (
      SELECT wr.r FROM (
        SELECT st.id, (row_number() OVER (
          ORDER BY st.total_xp DESC, st.level DESC, st.display_name ASC
        ))::int AS r
        FROM public.pm_students st
        WHERE st.total_xp > 0
      ) wr WHERE wr.id = v_student
    ) END,
    CASE WHEN v_student IS NULL OR v_school IS NULL THEN NULL ELSE (
      SELECT sr.r FROM (
        SELECT st.id, (row_number() OVER (
          ORDER BY st.total_xp DESC, st.level DESC, st.display_name ASC
        ))::int AS r
        FROM public.pm_students st
        JOIN public.pm_teacher_schools t2 ON t2.teacher_id = st.teacher_id
        WHERE st.total_xp > 0 AND t2.school_info_id = v_school
      ) sr WHERE sr.id = v_student
    ) END,
    CASE WHEN v_student IS NULL OR v_class IS NULL THEN NULL ELSE (
      SELECT cr.r FROM (
        SELECT st.id, (row_number() OVER (
          ORDER BY st.total_xp DESC, st.level DESC, st.display_name ASC
        ))::int AS r
        FROM public.pm_students st
        WHERE st.total_xp > 0 AND st.class_id = v_class
      ) cr WHERE cr.id = v_student
    ) END,
    CASE WHEN v_school IS NULL THEN NULL ELSE (
      SELECT br.r FROM (
        SELECT t3.school_info_id, (row_number() OVER (
          ORDER BY SUM(st.total_xp) DESC, MAX(t3.school_name) ASC
        ))::int AS r
        FROM public.pm_students st
        JOIN public.pm_teacher_schools t3 ON t3.teacher_id = st.teacher_id
        WHERE st.total_xp > 0
        GROUP BY t3.school_info_id
      ) br WHERE br.school_info_id = v_school
    ) END
  FROM (SELECT 1) dummy
  LEFT JOIN public.pm_classes c ON c.id = v_class
  LEFT JOIN public.pm_teacher_schools ts ON ts.teacher_id = v_teacher;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_get_hof_viewer(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_get_hof_viewer(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- School / class aggregate boards
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_list_hof_schools(
  p_limit int DEFAULT 20,
  p_session_token text DEFAULT NULL
)
RETURNS TABLE (
  rank int,
  school_info_id bigint,
  school_name text,
  region text,
  total_xp bigint,
  student_count int,
  is_mine boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit int := GREATEST(1, LEAST(coalesce(p_limit, 20), 50));
  v_school bigint;
BEGIN
  SELECT v.school_info_id INTO v_school
  FROM public.pm_hof_resolve_viewer(p_session_token) v;

  RETURN QUERY
  WITH ranked AS (
    SELECT
      (row_number() OVER (
        ORDER BY SUM(st.total_xp) DESC, MAX(ts.school_name) ASC
      ))::int AS rnk,
      ts.school_info_id AS sid,
      MAX(ts.school_name) AS sname,
      MAX(ts.region) AS sregion,
      SUM(st.total_xp)::bigint AS xp,
      COUNT(*)::int AS scount,
      (v_school IS NOT NULL AND ts.school_info_id = v_school) AS mine
    FROM public.pm_students st
    JOIN public.pm_teacher_schools ts ON ts.teacher_id = st.teacher_id
    GROUP BY ts.school_info_id
  )
  SELECT r.rnk, r.sid, r.sname, r.sregion, r.xp, r.scount, r.mine
  FROM ranked r
  WHERE r.rnk <= v_limit OR r.mine
  ORDER BY r.rnk;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_list_hof_schools(int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_list_hof_schools(int, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.pm_list_hof_classes(
  p_limit int DEFAULT 20,
  p_session_token text DEFAULT NULL
)
RETURNS TABLE (
  rank int,
  class_id uuid,
  class_name text,
  school_info_id bigint,
  school_name text,
  region text,
  total_xp bigint,
  student_count int,
  is_mine boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit int := GREATEST(1, LEAST(coalesce(p_limit, 20), 50));
  v_student uuid;
  v_teacher uuid;
  v_class uuid;
BEGIN
  SELECT v.student_id, v.teacher_id, v.class_id
  INTO v_student, v_teacher, v_class
  FROM public.pm_hof_resolve_viewer(p_session_token) v;

  RETURN QUERY
  WITH ranked AS (
    SELECT
      (row_number() OVER (
        ORDER BY SUM(st.total_xp) DESC, c.name ASC
      ))::int AS rnk,
      c.id AS cid,
      c.name AS cname,
      ts.school_info_id AS sid,
      ts.school_name AS sname,
      ts.region AS sregion,
      SUM(st.total_xp)::bigint AS xp,
      COUNT(*)::int AS scount,
      (
        (v_class IS NOT NULL AND c.id = v_class)
        OR (v_student IS NULL AND v_teacher IS NOT NULL AND c.teacher_id = v_teacher)
      ) AS mine
    FROM public.pm_students st
    JOIN public.pm_classes c ON c.id = st.class_id
    LEFT JOIN public.pm_teacher_schools ts ON ts.teacher_id = st.teacher_id
    GROUP BY c.id, c.name, c.teacher_id, ts.school_info_id, ts.school_name, ts.region
  )
  SELECT r.rnk, r.cid, r.cname, r.sid, r.sname, r.sregion, r.xp, r.scount, r.mine
  FROM ranked r
  WHERE r.rnk <= v_limit OR r.mine
  ORDER BY r.rnk;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_list_hof_classes(int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_list_hof_classes(int, text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Student leaderboard
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_list_hof_students(
  p_scope text DEFAULT 'world',
  p_school_info_id bigint DEFAULT NULL,
  p_class_id uuid DEFAULT NULL,
  p_limit int DEFAULT 20,
  p_session_token text DEFAULT NULL
)
RETURNS TABLE (
  rank int,
  display_name text,
  class_name text,
  school_name text,
  school_info_id bigint,
  class_id uuid,
  total_xp bigint,
  level int,
  is_me boolean,
  is_masked boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit int := GREATEST(1, LEAST(coalesce(p_limit, 20), 50));
  v_scope text;
  v_student uuid;
  v_teacher uuid;
  v_class uuid;
  v_school bigint;
  v_filter_school bigint;
  v_filter_class uuid;
BEGIN
  v_scope := lower(coalesce(nullif(trim(p_scope), ''), 'world'));
  IF v_scope NOT IN ('world', 'school', 'class') THEN
    v_scope := 'world';
  END IF;

  SELECT v.student_id, v.teacher_id, v.class_id, v.school_info_id
  INTO v_student, v_teacher, v_class, v_school
  FROM public.pm_hof_resolve_viewer(p_session_token) v;

  v_filter_school := p_school_info_id;
  v_filter_class := p_class_id;

  IF v_scope = 'school' AND v_filter_school IS NULL THEN
    v_filter_school := v_school;
  END IF;

  IF v_scope = 'class' AND v_filter_class IS NULL THEN
    IF v_student IS NOT NULL THEN
      v_filter_class := v_class;
    END IF;
    -- teacher with no class_id: all of that teacher's students (handled in WHERE)
  END IF;

  IF v_scope = 'school' AND v_filter_school IS NULL THEN
    RETURN;
  END IF;

  IF v_scope = 'class' AND v_filter_class IS NULL AND v_teacher IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH ranked AS (
    SELECT
      (row_number() OVER (
        ORDER BY st.total_xp DESC, st.level DESC, st.display_name ASC
      ))::int AS rnk,
      st.display_name AS raw_name,
      c.name AS cname,
      ts.school_name AS sname,
      ts.school_info_id AS sid,
      st.class_id AS cid,
      st.total_xp AS xp,
      st.level AS lvl,
      (v_student IS NOT NULL AND st.id = v_student) AS mine,
      (
        (v_student IS NOT NULL AND st.id = v_student)
        OR (v_class IS NOT NULL AND st.class_id = v_class)
        OR (v_teacher IS NOT NULL AND v_student IS NULL AND st.teacher_id = v_teacher)
        OR (v_school IS NOT NULL AND ts.school_info_id = v_school)
      ) AS reveal
    FROM public.pm_students st
    JOIN public.pm_classes c ON c.id = st.class_id
    LEFT JOIN public.pm_teacher_schools ts ON ts.teacher_id = st.teacher_id
    WHERE st.total_xp > 0
      AND (
        v_scope = 'world'
        OR (v_scope = 'school' AND ts.school_info_id = v_filter_school)
        OR (
          v_scope = 'class'
          AND (
            (v_filter_class IS NOT NULL AND st.class_id = v_filter_class)
            OR (
              v_filter_class IS NULL
              AND v_teacher IS NOT NULL
              AND v_student IS NULL
              AND st.teacher_id = v_teacher
            )
          )
        )
      )
  ),
  mine_row AS (
    SELECT r.rnk AS my_rank
    FROM ranked r
    WHERE r.mine
    LIMIT 1
  )
  SELECT
    r.rnk,
    CASE
      WHEN r.reveal THEN r.raw_name
      ELSE public.pm_anonymize_display_name(r.raw_name)
    END,
    r.cname,
    r.sname,
    r.sid,
    r.cid,
    r.xp,
    r.lvl,
    r.mine,
    (NOT r.reveal)
  FROM ranked r
  LEFT JOIN mine_row m ON TRUE
  WHERE r.rnk <= v_limit
     OR (m.my_rank IS NOT NULL AND r.rnk BETWEEN m.my_rank - 1 AND m.my_rank + 1)
  ORDER BY r.rnk;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_list_hof_students(text, bigint, uuid, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_list_hof_students(text, bigint, uuid, int, text) TO anon, authenticated;
