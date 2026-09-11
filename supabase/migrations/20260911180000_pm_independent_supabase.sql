-- pimath: decouple from shared foreducator objects for an independent Supabase.
-- Safe on both shared DB (conditional backfill) and a fresh pimath project.
-- Does NOT ALTER/DROP foreducator tables. Apply to shared DB only after human OK;
-- preferred path is apply on the new pimath-only project after migration replay.

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.pm_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text,
  nickname text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pm_profiles_nickname_len
    CHECK (nickname IS NULL OR length(trim(nickname)) BETWEEN 1 AND 40)
);

CREATE TRIGGER pm_profiles_set_updated_at
  BEFORE UPDATE ON public.pm_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.pm_set_updated_at();

ALTER TABLE public.pm_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pm_profiles_select_own ON public.pm_profiles;
CREATE POLICY pm_profiles_select_own
  ON public.pm_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS pm_profiles_update_own ON public.pm_profiles;
CREATE POLICY pm_profiles_update_own
  ON public.pm_profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.pm_profiles FROM anon;
GRANT SELECT, UPDATE ON TABLE public.pm_profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.pm_ensure_profile(
  p_uid uuid DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_nickname text DEFAULT NULL
)
RETURNS public.pm_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := coalesce(p_uid, auth.uid());
  v_email text;
  v_nick text;
  v_row public.pm_profiles;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  SELECT lower(nullif(trim(u.email), ''))
  INTO v_email
  FROM auth.users u
  WHERE u.id = v_uid;

  v_email := coalesce(lower(nullif(trim(p_email), '')), v_email);
  v_nick := nullif(trim(coalesce(p_nickname, '')), '');
  IF v_nick IS NOT NULL AND length(v_nick) > 40 THEN
    v_nick := left(v_nick, 40);
  END IF;

  INSERT INTO public.pm_profiles (user_id, email, nickname)
  VALUES (v_uid, v_email, v_nick)
  ON CONFLICT (user_id) DO UPDATE
    SET email = coalesce(EXCLUDED.email, public.pm_profiles.email),
        nickname = coalesce(EXCLUDED.nickname, public.pm_profiles.nickname)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_ensure_profile(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_ensure_profile(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.pm_set_profile_nickname(p_nickname text)
RETURNS public.pm_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_nick text := nullif(trim(coalesce(p_nickname, '')), '');
  v_row public.pm_profiles;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF v_nick IS NULL THEN
    RAISE EXCEPTION 'nickname_required';
  END IF;
  IF length(v_nick) > 40 THEN
    RAISE EXCEPTION 'nickname_too_long';
  END IF;

  INSERT INTO public.pm_profiles (user_id, email, nickname)
  SELECT v_uid, lower(nullif(trim(u.email), '')), v_nick
  FROM auth.users u
  WHERE u.id = v_uid
  ON CONFLICT (user_id) DO UPDATE
    SET nickname = EXCLUDED.nickname
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_set_profile_nickname(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_set_profile_nickname(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.pm_display_name(p_uid uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    nullif(trim(pr.nickname), ''),
    nullif(trim(u.raw_user_meta_data ->> 'nickname'), ''),
    nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    '회원'
  )
  FROM auth.users u
  LEFT JOIN public.pm_profiles pr ON pr.user_id = u.id
  WHERE u.id = p_uid
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.pm_display_name(uuid) FROM PUBLIC;

-- Backfill nicknames from foreducator if those tables still exist (shared DB).
DO $$
BEGIN
  IF to_regclass('public.auth_user_supabase_mapping') IS NOT NULL
     AND to_regclass('public.common_profile') IS NOT NULL
  THEN
    INSERT INTO public.pm_profiles (user_id, email, nickname)
    SELECT
      m.supabase_uid,
      lower(nullif(trim(u.email), '')),
      nullif(trim(pr.nickname), '')
    FROM public.auth_user_supabase_mapping m
    JOIN auth.users u ON u.id = m.supabase_uid
    LEFT JOIN public.common_profile pr ON pr.user_id = m.django_user_id
    WHERE EXISTS (
      SELECT 1 FROM public.pm_classes c WHERE c.teacher_id = m.supabase_uid
      UNION ALL
      SELECT 1 FROM public.pm_students s WHERE s.teacher_id = m.supabase_uid
      UNION ALL
      SELECT 1 FROM public.pm_forum_posts f WHERE f.author_id = m.supabase_uid
      UNION ALL
      SELECT 1 FROM public.pm_diagram_feedback d WHERE d.author_id = m.supabase_uid
      UNION ALL
      SELECT 1 FROM public.pm_teacher_schools t WHERE t.teacher_id = m.supabase_uid
    )
    ON CONFLICT (user_id) DO UPDATE
      SET nickname = coalesce(public.pm_profiles.nickname, EXCLUDED.nickname),
          email = coalesce(public.pm_profiles.email, EXCLUDED.email);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Schools catalog (replaces school_schoolinfo reads)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.pm_schools (
  id bigint PRIMARY KEY,
  school_name text NOT NULL,
  region text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pm_schools_name_not_blank CHECK (length(trim(school_name)) > 0)
);

CREATE INDEX IF NOT EXISTS pm_schools_name_idx
  ON public.pm_schools (school_name);

ALTER TABLE public.pm_schools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pm_schools_select_authenticated ON public.pm_schools;
CREATE POLICY pm_schools_select_authenticated
  ON public.pm_schools FOR SELECT TO authenticated
  USING (true);

REVOKE ALL ON TABLE public.pm_schools FROM anon;
GRANT SELECT ON TABLE public.pm_schools TO authenticated;

-- Seed from existing teacher snapshots (always available).
INSERT INTO public.pm_schools (id, school_name, region)
SELECT DISTINCT
  ts.school_info_id,
  ts.school_name,
  ts.region
FROM public.pm_teacher_schools ts
WHERE length(trim(ts.school_name)) > 0
ON CONFLICT (id) DO NOTHING;

-- Full catalog copy when still on shared DB.
DO $$
BEGIN
  IF to_regclass('public.school_schoolinfo') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO public.pm_schools (id, school_name, region)
      SELECT
        s.id,
        trim(s."SCHUL_NM"),
        NULLIF(trim(s."LCTN_SC_NM"), '')
      FROM public.school_schoolinfo s
      WHERE length(trim(s."SCHUL_NM")) > 0
      ON CONFLICT (id) DO UPDATE
        SET school_name = EXCLUDED.school_name,
            region = coalesce(EXCLUDED.region, public.pm_schools.region)
    $sql$;
  END IF;
END $$;

ALTER TABLE public.pm_teacher_schools
  DROP CONSTRAINT IF EXISTS pm_teacher_schools_source_check;

ALTER TABLE public.pm_teacher_schools
  ADD CONSTRAINT pm_teacher_schools_source_check
  CHECK (source IN ('foreducator', 'manual', 'catalog'));

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
    s.school_name,
    s.region
  FROM public.pm_schools s
  WHERE s.school_name ILIKE '%' || v_q || '%'
  ORDER BY
    CASE WHEN s.school_name ILIKE v_q || '%' THEN 0 ELSE 1 END,
    s.school_name,
    s.region NULLS LAST
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

  SELECT s.school_name, s.region
  INTO v_name, v_region
  FROM public.pm_schools s
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

-- Keep RPC name for any stale callers; now a no-op read of the snapshot.
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

REVOKE ALL ON FUNCTION public.pm_sync_teacher_school_from_foreducator() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_sync_teacher_school_from_foreducator() TO authenticated;

-- ---------------------------------------------------------------------------
-- In-app notifications (replaces create_notification)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.pm_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  title text NOT NULL,
  message text NOT NULL,
  url text,
  kind text NOT NULL DEFAULT 'comment',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pm_notifications_title_len CHECK (length(trim(title)) BETWEEN 1 AND 120),
  CONSTRAINT pm_notifications_message_len CHECK (length(trim(message)) BETWEEN 1 AND 500)
);

CREATE INDEX IF NOT EXISTS pm_notifications_recipient_created_idx
  ON public.pm_notifications (recipient_id, created_at DESC);

ALTER TABLE public.pm_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pm_notifications_select_own ON public.pm_notifications;
CREATE POLICY pm_notifications_select_own
  ON public.pm_notifications FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS pm_notifications_update_own ON public.pm_notifications;
CREATE POLICY pm_notifications_update_own
  ON public.pm_notifications FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

REVOKE ALL ON TABLE public.pm_notifications FROM anon;
GRANT SELECT, UPDATE ON TABLE public.pm_notifications TO authenticated;

CREATE OR REPLACE FUNCTION public.pm_admin_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id
  FROM auth.users u
  WHERE lower(u.email) = 'hwanys2@naver.com'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.pm_admin_user_id() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.pm_notify(
  p_recipient uuid,
  p_sender uuid,
  p_title text,
  p_message text,
  p_url text DEFAULT NULL,
  p_kind text DEFAULT 'comment'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_recipient IS NULL THEN
    RETURN;
  END IF;
  -- Skip self-alerts (same rule as foreducator create_notification).
  IF p_sender IS NOT NULL AND p_sender = p_recipient THEN
    RETURN;
  END IF;

  INSERT INTO public.pm_notifications (
    recipient_id, sender_id, title, message, url, kind
  ) VALUES (
    p_recipient,
    p_sender,
    left(trim(coalesce(p_title, '알림')), 120),
    left(trim(coalesce(p_message, '')), 500),
    nullif(trim(coalesce(p_url, '')), ''),
    coalesce(nullif(trim(p_kind), ''), 'comment')
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pm_notify failed: %', SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_notify(uuid, uuid, text, text, text, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.pm_list_my_notifications(
  p_limit integer DEFAULT 30,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  title text,
  message text,
  url text,
  kind text,
  read_at timestamptz,
  created_at timestamptz,
  total_count integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_limit integer;
  v_offset integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;
  v_limit := least(greatest(coalesce(p_limit, 30), 1), 100);
  v_offset := greatest(coalesce(p_offset, 0), 0);

  RETURN QUERY
  SELECT
    n.id,
    n.title,
    n.message,
    n.url,
    n.kind,
    n.read_at,
    n.created_at,
    count(*) OVER ()::integer AS total_count
  FROM public.pm_notifications n
  WHERE n.recipient_id = v_uid
  ORDER BY n.created_at DESC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_list_my_notifications(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_list_my_notifications(integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.pm_mark_notification_read(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  UPDATE public.pm_notifications
  SET read_at = coalesce(read_at, now())
  WHERE id = p_id AND recipient_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.pm_mark_notification_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_mark_notification_read(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Forum: author names + notify via pm_*
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_forum_author_name(p_uid uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(public.pm_display_name(p_uid), '회원');
$$;

REVOKE ALL ON FUNCTION public.pm_forum_author_name(uuid) FROM PUBLIC;

-- Legacy integer notify shim (no-op when create_notification is absent).
CREATE OR REPLACE FUNCTION public.pm_forum_notify(
  p_recipient integer,
  p_sender integer,
  p_title text,
  p_message text,
  p_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Intentionally no-op on independent DB. Callers rewritten to pm_notify(uuid...).
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_forum_notify(integer, integer, text, text, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.pm_create_forum_post(
  p_category text,
  p_title text,
  p_body text,
  p_image_paths text[] DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_category text;
  v_title text;
  v_body text;
  v_paths text[];
  v_id uuid;
  v_admin uuid;
  v_sender uuid;
  v_nickname text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'login_required';
  END IF;

  PERFORM public.pm_ensure_profile(v_uid);

  v_category := trim(coalesce(p_category, ''));
  IF v_category NOT IN ('issue', 'idea', 'talk') THEN
    RAISE EXCEPTION 'invalid category';
  END IF;

  v_title := trim(coalesce(p_title, ''));
  IF length(v_title) < 2 THEN
    RAISE EXCEPTION 'title_too_short';
  END IF;
  IF length(v_title) > 80 THEN
    RAISE EXCEPTION 'title_too_long';
  END IF;

  v_body := trim(coalesce(p_body, ''));
  IF length(v_body) = 0 THEN
    RAISE EXCEPTION 'body_required';
  END IF;
  IF length(v_body) > 4000 THEN
    RAISE EXCEPTION 'body_too_long';
  END IF;

  v_paths := public.pm_forum_clean_image_paths(v_uid, p_image_paths, 5);

  IF EXISTS (
    SELECT 1
    FROM public.pm_forum_posts p
    WHERE p.author_id = v_uid
      AND p.created_at > now() - interval '15 seconds'
  ) THEN
    RAISE EXCEPTION 'too fast';
  END IF;

  INSERT INTO public.pm_forum_posts (
    author_id, category, title, body, image_paths
  )
  VALUES (v_uid, v_category, v_title, v_body, v_paths)
  RETURNING pm_forum_posts.id INTO v_id;

  v_admin := public.pm_admin_user_id();
  v_sender := v_uid;
  IF v_sender IS NOT DISTINCT FROM v_admin THEN
    v_sender := NULL;
  END IF;
  v_nickname := public.pm_forum_author_name(v_uid);

  PERFORM public.pm_notify(
    v_admin,
    v_sender,
    'pimath 새 글',
    v_nickname || '님이 글을 남겼습니다: ' || left(v_title, 40),
    'https://www.pimath.kr/tools/forum/' || v_id::text,
    'comment'
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_create_forum_post(text, text, text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pm_create_forum_post(text, text, text, text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.pm_create_forum_post(text, text, text, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.pm_create_forum_comment(
  p_post_id uuid,
  p_body text,
  p_image_paths text[] DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_body text;
  v_paths text[];
  v_id uuid;
  v_post_author uuid;
  v_post_title text;
  v_admin uuid;
  v_nickname text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'login_required';
  END IF;
  IF p_post_id IS NULL THEN
    RAISE EXCEPTION 'not found';
  END IF;

  PERFORM public.pm_ensure_profile(v_uid);

  SELECT p.author_id, p.title
  INTO v_post_author, v_post_title
  FROM public.pm_forum_posts p
  WHERE p.id = p_post_id;
  IF v_post_author IS NULL THEN
    RAISE EXCEPTION 'not found';
  END IF;

  v_body := trim(coalesce(p_body, ''));
  IF length(v_body) = 0 THEN
    RAISE EXCEPTION 'body_required';
  END IF;
  IF length(v_body) > 2000 THEN
    RAISE EXCEPTION 'comment_too_long';
  END IF;

  v_paths := public.pm_forum_clean_image_paths(v_uid, p_image_paths, 3);

  IF EXISTS (
    SELECT 1
    FROM public.pm_forum_comments c
    WHERE c.author_id = v_uid
      AND c.created_at > now() - interval '10 seconds'
  ) THEN
    RAISE EXCEPTION 'too fast';
  END IF;

  INSERT INTO public.pm_forum_comments (
    post_id, author_id, body, image_paths
  )
  VALUES (p_post_id, v_uid, v_body, v_paths)
  RETURNING pm_forum_comments.id INTO v_id;

  v_admin := public.pm_admin_user_id();
  v_nickname := public.pm_forum_author_name(v_uid);

  PERFORM public.pm_notify(
    v_admin,
    v_uid,
    '의견 게시판 댓글',
    v_nickname || '님이 "' || left(coalesce(v_post_title, '글'), 30) || '"에 댓글을 남겼습니다',
    'https://www.pimath.kr/tools/forum/' || p_post_id::text,
    'comment'
  );
  PERFORM public.pm_notify(
    v_post_author,
    v_uid,
    '의견 게시판 댓글',
    v_nickname || '님이 회원님 글에 댓글을 남겼습니다',
    'https://www.pimath.kr/tools/forum/' || p_post_id::text,
    'comment'
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_create_forum_comment(uuid, text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pm_create_forum_comment(uuid, text, text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.pm_create_forum_comment(uuid, text, text[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- Diagram feedback: author names + notify via pm_*
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_list_diagram_feedback(p_tool_id text)
RETURNS TABLE (
  id uuid,
  body text,
  status text,
  admin_note text,
  author_name text,
  is_author boolean,
  is_admin_author boolean,
  created_at timestamptz,
  resolved_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tool text;
BEGIN
  v_tool := trim(coalesce(p_tool_id, ''));
  IF v_tool !~ '^[a-z0-9]+(-[a-z0-9]+)+$' OR length(v_tool) > 64 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    f.id,
    f.body,
    f.status,
    f.admin_note,
    coalesce(public.pm_display_name(f.author_id), '회원') AS author_name,
    (f.author_id = auth.uid()) AS is_author,
    EXISTS (
      SELECT 1
      FROM auth.users au
      WHERE au.id = f.author_id
        AND lower(au.email) = 'hwanys2@naver.com'
    ) AS is_admin_author,
    f.created_at,
    f.resolved_at
  FROM public.pm_diagram_feedback f
  WHERE f.tool_id = v_tool
  ORDER BY f.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_list_diagram_feedback(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_list_diagram_feedback(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.pm_create_diagram_feedback(
  p_tool_id text,
  p_body text,
  p_tool_title text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tool text;
  v_body text;
  v_title text;
  v_id uuid;
  v_admin uuid;
  v_sender uuid;
  v_nickname text;
  v_preview text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'login_required';
  END IF;

  PERFORM public.pm_ensure_profile(v_uid);

  v_tool := trim(coalesce(p_tool_id, ''));
  IF v_tool !~ '^[a-z0-9]+(-[a-z0-9]+)+$' OR length(v_tool) > 64 THEN
    RAISE EXCEPTION 'invalid tool_id';
  END IF;

  v_body := trim(coalesce(p_body, ''));
  IF length(v_body) = 0 THEN
    RAISE EXCEPTION 'body_required';
  END IF;
  IF length(v_body) > 2000 THEN
    RAISE EXCEPTION 'body_too_long';
  END IF;

  v_title := left(trim(coalesce(p_tool_title, v_tool)), 80);
  IF length(v_title) = 0 THEN
    v_title := v_tool;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.pm_diagram_feedback f
    WHERE f.author_id = v_uid
      AND f.created_at > now() - interval '10 seconds'
  ) THEN
    RAISE EXCEPTION 'too fast';
  END IF;

  INSERT INTO public.pm_diagram_feedback (tool_id, author_id, body)
  VALUES (v_tool, v_uid, v_body)
  RETURNING pm_diagram_feedback.id INTO v_id;

  v_admin := public.pm_admin_user_id();
  v_sender := v_uid;
  IF v_sender IS NOT DISTINCT FROM v_admin THEN
    v_sender := NULL;
  END IF;
  v_nickname := coalesce(public.pm_display_name(v_uid), '회원');
  v_preview := left(v_body, 40);

  PERFORM public.pm_notify(
    v_admin,
    v_sender,
    '문제 그림 의견',
    v_nickname || '님이 "' || left(v_title, 30) || '"에 의견을 남겼습니다: ' || v_preview,
    'https://www.pimath.kr/tools/figures/' || v_tool || '#feedback',
    'comment'
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_create_diagram_feedback(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pm_create_diagram_feedback(text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.pm_create_diagram_feedback(text, text, text) TO authenticated;
