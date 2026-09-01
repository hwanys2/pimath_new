-- pimath: simple tools-menu feedback board (posts + comments + images).
-- Isolates data in pm_* objects. Do not touch tboard_* or create_notification.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.pm_forum_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  category text NOT NULL
    CHECK (category IN ('issue', 'idea', 'talk')),
  title text NOT NULL,
  body text NOT NULL,
  image_paths text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pm_forum_posts_title_len
    CHECK (length(trim(title)) BETWEEN 2 AND 80),
  CONSTRAINT pm_forum_posts_body_len
    CHECK (length(trim(body)) BETWEEN 1 AND 4000),
  CONSTRAINT pm_forum_posts_images_len
    CHECK (cardinality(image_paths) <= 5)
);

CREATE INDEX pm_forum_posts_created_idx
  ON public.pm_forum_posts (created_at DESC);
CREATE INDEX pm_forum_posts_category_created_idx
  ON public.pm_forum_posts (category, created_at DESC);

CREATE TRIGGER pm_forum_posts_set_updated_at
  BEFORE UPDATE ON public.pm_forum_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.pm_set_updated_at();

CREATE TABLE public.pm_forum_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.pm_forum_posts (id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  body text NOT NULL,
  image_paths text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pm_forum_comments_body_len
    CHECK (length(trim(body)) BETWEEN 1 AND 2000),
  CONSTRAINT pm_forum_comments_images_len
    CHECK (cardinality(image_paths) <= 3)
);

CREATE INDEX pm_forum_comments_post_created_idx
  ON public.pm_forum_comments (post_id, created_at);

ALTER TABLE public.pm_forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_forum_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY pm_forum_posts_select_own
  ON public.pm_forum_posts FOR SELECT TO authenticated
  USING (author_id = auth.uid());

CREATE POLICY pm_forum_comments_select_own
  ON public.pm_forum_comments FOR SELECT TO authenticated
  USING (author_id = auth.uid());

REVOKE ALL ON TABLE public.pm_forum_posts FROM anon;
REVOKE ALL ON TABLE public.pm_forum_posts FROM authenticated;
REVOKE ALL ON TABLE public.pm_forum_comments FROM anon;
REVOKE ALL ON TABLE public.pm_forum_comments FROM authenticated;
GRANT SELECT ON TABLE public.pm_forum_posts TO authenticated;
GRANT SELECT ON TABLE public.pm_forum_comments TO authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_forum_clean_image_paths(
  p_uid uuid,
  p_paths text[],
  p_max integer
)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_out text[] := ARRAY[]::text[];
  v_path text;
  v_prefix text := lower(p_uid::text) || '/';
BEGIN
  IF p_uid IS NULL THEN
    RAISE EXCEPTION 'invalid image';
  END IF;
  IF p_paths IS NULL THEN
    RETURN v_out;
  END IF;
  FOREACH v_path IN ARRAY p_paths LOOP
    v_path := lower(trim(coalesce(v_path, '')));
    IF v_path = '' THEN
      CONTINUE;
    END IF;
    IF position(v_prefix IN v_path) <> 1 THEN
      RAISE EXCEPTION 'invalid image';
    END IF;
    IF v_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|gif)$' THEN
      RAISE EXCEPTION 'invalid image';
    END IF;
    IF NOT (v_path = ANY (v_out)) THEN
      v_out := array_append(v_out, v_path);
    END IF;
  END LOOP;
  IF cardinality(v_out) > p_max THEN
    RAISE EXCEPTION 'too many images';
  END IF;
  RETURN v_out;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_forum_clean_image_paths(uuid, text[], integer) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.pm_forum_author_name(p_uid uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    nullif(trim(pr.nickname), ''),
    nullif(trim(dj.username), ''),
    '회원'
  )
  FROM (SELECT p_uid AS uid) s
  LEFT JOIN public.auth_user_supabase_mapping m
    ON m.supabase_uid = s.uid
  LEFT JOIN public.auth_user dj
    ON dj.id = m.django_user_id
  LEFT JOIN public.common_profile pr
    ON pr.user_id = m.django_user_id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.pm_forum_author_name(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.pm_forum_django_user_id(p_uid uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id integer;
BEGIN
  IF p_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT m.django_user_id
  INTO v_id
  FROM public.auth_user_supabase_mapping m
  WHERE m.supabase_uid = p_uid
  LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  SELECT dj.id
  INTO v_id
  FROM auth.users su
  JOIN public.auth_user dj ON lower(dj.email) = lower(su.email)
  WHERE su.id = p_uid
  LIMIT 1;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_forum_django_user_id(uuid) FROM PUBLIC;

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
  IF p_recipient IS NULL OR p_sender IS NULL THEN
    RETURN;
  END IF;
  IF to_regprocedure('public.create_notification(integer, integer, text, text, text, text)') IS NULL THEN
    RETURN;
  END IF;
  PERFORM public.create_notification(
    p_recipient,
    p_sender,
    p_title,
    p_message,
    'comment',
    p_url
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pm_forum_notify(integer, integer, text, text, text) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Storage bucket (pimath-owned; do not alter existing buckets)
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pm_forum',
  'pm_forum',
  true,
  4194304,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY pm_forum_storage_select
  ON storage.objects FOR SELECT
  USING (bucket_id = 'pm_forum');

CREATE POLICY pm_forum_storage_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'pm_forum'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|gif)$'
  );

CREATE POLICY pm_forum_storage_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'pm_forum'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.pm_is_diagram_admin()
    )
  );

-- ---------------------------------------------------------------------------
-- List posts (public)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_list_forum_posts(
  p_category text DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  category text,
  title text,
  body_preview text,
  author_name text,
  is_author boolean,
  is_admin_author boolean,
  comment_count integer,
  image_count integer,
  created_at timestamptz,
  total_count integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category text;
  v_limit integer;
  v_offset integer;
BEGIN
  v_category := nullif(trim(coalesce(p_category, '')), '');
  IF v_category IS NOT NULL AND v_category NOT IN ('issue', 'idea', 'talk') THEN
    RETURN;
  END IF;
  v_limit := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_offset := greatest(coalesce(p_offset, 0), 0);

  RETURN QUERY
  SELECT
    p.id,
    p.category,
    p.title,
    left(p.body, 120) AS body_preview,
    public.pm_forum_author_name(p.author_id) AS author_name,
    (p.author_id = auth.uid()) AS is_author,
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = p.author_id
        AND lower(au.email) = 'hwanys2@naver.com'
    ) AS is_admin_author,
    (
      SELECT count(*)::integer
      FROM public.pm_forum_comments c
      WHERE c.post_id = p.id
    ) AS comment_count,
    coalesce(cardinality(p.image_paths), 0) AS image_count,
    p.created_at,
    count(*) OVER ()::integer AS total_count
  FROM public.pm_forum_posts p
  WHERE v_category IS NULL OR p.category = v_category
  ORDER BY p.created_at DESC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_list_forum_posts(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_list_forum_posts(text, integer, integer) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Get post
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_get_forum_post(p_id uuid)
RETURNS TABLE (
  id uuid,
  category text,
  title text,
  body text,
  image_paths text[],
  author_name text,
  is_author boolean,
  is_admin_author boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.category,
    p.title,
    p.body,
    p.image_paths,
    public.pm_forum_author_name(p.author_id) AS author_name,
    (p.author_id = auth.uid()) AS is_author,
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = p.author_id
        AND lower(au.email) = 'hwanys2@naver.com'
    ) AS is_admin_author,
    p.created_at,
    p.updated_at
  FROM public.pm_forum_posts p
  WHERE p.id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_get_forum_post(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_get_forum_post(uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Create / update / delete post
-- ---------------------------------------------------------------------------

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
  v_sender integer;
  v_admin integer;
  v_nickname text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'login_required';
  END IF;

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

  SELECT au.id
  INTO v_admin
  FROM public.auth_user au
  WHERE lower(au.email) = 'hwanys2@naver.com'
  LIMIT 1;

  v_sender := coalesce(public.django_user_id(), public.pm_forum_django_user_id(v_uid));
  v_nickname := public.pm_forum_author_name(v_uid);

  PERFORM public.pm_forum_notify(
    v_admin,
    v_sender,
    '의견 게시판',
    v_nickname || '님이 글을 남겼습니다: ' || left(v_title, 40),
    'https://www.pimath.kr/tools/forum/' || v_id::text
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_create_forum_post(text, text, text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pm_create_forum_post(text, text, text, text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.pm_create_forum_post(text, text, text, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.pm_update_forum_post(
  p_id uuid,
  p_category text,
  p_title text,
  p_body text,
  p_image_paths text[] DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_author uuid;
  v_category text;
  v_title text;
  v_body text;
  v_paths text[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'login_required';
  END IF;

  SELECT p.author_id INTO v_author
  FROM public.pm_forum_posts p
  WHERE p.id = p_id;
  IF v_author IS NULL THEN
    RAISE EXCEPTION 'not found';
  END IF;
  IF v_author <> v_uid THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

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

  UPDATE public.pm_forum_posts
  SET
    category = v_category,
    title = v_title,
    body = v_body,
    image_paths = v_paths
  WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_update_forum_post(uuid, text, text, text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pm_update_forum_post(uuid, text, text, text, text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.pm_update_forum_post(uuid, text, text, text, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.pm_delete_forum_post(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_author uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'login_required';
  END IF;

  SELECT p.author_id INTO v_author
  FROM public.pm_forum_posts p
  WHERE p.id = p_id;
  IF v_author IS NULL THEN
    RAISE EXCEPTION 'not found';
  END IF;
  IF v_author <> v_uid AND NOT public.pm_is_diagram_admin() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  DELETE FROM public.pm_forum_posts WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_delete_forum_post(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pm_delete_forum_post(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.pm_delete_forum_post(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_list_forum_comments(p_post_id uuid)
RETURNS TABLE (
  id uuid,
  body text,
  image_paths text[],
  author_name text,
  is_author boolean,
  is_admin_author boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_post_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.body,
    c.image_paths,
    public.pm_forum_author_name(c.author_id) AS author_name,
    (c.author_id = auth.uid()) AS is_author,
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = c.author_id
        AND lower(au.email) = 'hwanys2@naver.com'
    ) AS is_admin_author,
    c.created_at
  FROM public.pm_forum_comments c
  WHERE c.post_id = p_post_id
  ORDER BY c.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_list_forum_comments(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_list_forum_comments(uuid) TO anon, authenticated;

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
  v_sender integer;
  v_admin integer;
  v_post_django integer;
  v_nickname text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'login_required';
  END IF;
  IF p_post_id IS NULL THEN
    RAISE EXCEPTION 'not found';
  END IF;

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

  SELECT au.id
  INTO v_admin
  FROM public.auth_user au
  WHERE lower(au.email) = 'hwanys2@naver.com'
  LIMIT 1;

  v_sender := coalesce(public.django_user_id(), public.pm_forum_django_user_id(v_uid));
  v_post_django := public.pm_forum_django_user_id(v_post_author);
  v_nickname := public.pm_forum_author_name(v_uid);

  PERFORM public.pm_forum_notify(
    v_admin,
    v_sender,
    '의견 게시판 댓글',
    v_nickname || '님이 "' || left(coalesce(v_post_title, '글'), 30) || '"에 댓글을 남겼습니다',
    'https://www.pimath.kr/tools/forum/' || p_post_id::text
  );
  PERFORM public.pm_forum_notify(
    v_post_django,
    v_sender,
    '의견 게시판 댓글',
    v_nickname || '님이 회원님 글에 댓글을 남겼습니다',
    'https://www.pimath.kr/tools/forum/' || p_post_id::text
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_create_forum_comment(uuid, text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pm_create_forum_comment(uuid, text, text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.pm_create_forum_comment(uuid, text, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.pm_delete_forum_comment(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_author uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'login_required';
  END IF;

  SELECT c.author_id INTO v_author
  FROM public.pm_forum_comments c
  WHERE c.id = p_id;
  IF v_author IS NULL THEN
    RAISE EXCEPTION 'not found';
  END IF;
  IF v_author <> v_uid AND NOT public.pm_is_diagram_admin() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  DELETE FROM public.pm_forum_comments WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_delete_forum_comment(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pm_delete_forum_comment(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.pm_delete_forum_comment(uuid) TO authenticated;
