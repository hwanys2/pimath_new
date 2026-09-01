-- pimath: always ping admin (hwanys2) on new forum posts via existing
-- create_notification. Do not ALTER that function.
-- Self-alerts are dropped inside create_notification, so when the author
-- is the admin we omit sender_id. Unmapped authors also omit sender
-- instead of skipping the ping.

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
  IF p_recipient IS NULL THEN
    RETURN;
  END IF;
  BEGIN
    PERFORM public.create_notification(
      p_recipient,
      p_sender,
      p_title,
      p_message,
      'comment',
      p_url
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'pm_forum_notify failed: %', SQLERRM;
  END;
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
  IF v_sender IS NOT DISTINCT FROM v_admin THEN
    v_sender := NULL;
  END IF;

  PERFORM public.pm_forum_notify(
    v_admin,
    v_sender,
    'pimath 새 글',
    v_nickname || '님이 글을 남겼습니다: ' || left(v_title, 40),
    'https://www.pimath.kr/tools/forum/' || v_id::text
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_create_forum_post(text, text, text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pm_create_forum_post(text, text, text, text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.pm_create_forum_post(text, text, text, text[]) TO authenticated;
