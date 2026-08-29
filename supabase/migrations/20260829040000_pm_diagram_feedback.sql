-- pimath: per-tool feedback on 문제 그림 그리기 pages.
-- Isolates data in pm_* objects. Notifications go through existing
-- public.create_notification (foreducator) — do not ALTER that function.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

CREATE TABLE public.pm_diagram_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id text NOT NULL,
  author_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'applied', 'rejected')),
  admin_note text,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pm_diagram_feedback_tool_id_format
    CHECK (tool_id ~ '^[a-z0-9]+(-[a-z0-9]+)+$' AND length(tool_id) <= 64),
  CONSTRAINT pm_diagram_feedback_body_len
    CHECK (length(trim(body)) BETWEEN 1 AND 2000),
  CONSTRAINT pm_diagram_feedback_admin_note_len
    CHECK (admin_note IS NULL OR length(trim(admin_note)) <= 2000)
);

CREATE INDEX pm_diagram_feedback_tool_created_idx
  ON public.pm_diagram_feedback (tool_id, created_at);

CREATE TRIGGER pm_diagram_feedback_set_updated_at
  BEFORE UPDATE ON public.pm_diagram_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.pm_set_updated_at();

ALTER TABLE public.pm_diagram_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY pm_diagram_feedback_select_own
  ON public.pm_diagram_feedback FOR SELECT TO authenticated
  USING (author_id = auth.uid());

REVOKE ALL ON TABLE public.pm_diagram_feedback FROM anon;
REVOKE ALL ON TABLE public.pm_diagram_feedback FROM authenticated;
GRANT SELECT ON TABLE public.pm_diagram_feedback TO authenticated;

-- ---------------------------------------------------------------------------
-- Admin helper (email is the product-specified owner)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_is_diagram_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = auth.uid()
      AND lower(u.email) = 'hwanys2@naver.com'
  );
$$;

REVOKE ALL ON FUNCTION public.pm_is_diagram_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pm_is_diagram_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.pm_is_diagram_admin() TO authenticated;

-- ---------------------------------------------------------------------------
-- List (public read via RPC)
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
    coalesce(
      nullif(trim(pr.nickname), ''),
      nullif(trim(dj.username), ''),
      '회원'
    ) AS author_name,
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
  LEFT JOIN public.auth_user_supabase_mapping m
    ON m.supabase_uid = f.author_id
  LEFT JOIN public.auth_user dj
    ON dj.id = m.django_user_id
  LEFT JOIN public.common_profile pr
    ON pr.user_id = m.django_user_id
  WHERE f.tool_id = v_tool
  ORDER BY f.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_list_diagram_feedback(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_list_diagram_feedback(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Create + notify admin via existing create_notification
-- ---------------------------------------------------------------------------

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
  v_sender integer;
  v_admin integer;
  v_nickname text;
  v_preview text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'login_required';
  END IF;

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

  SELECT au.id
  INTO v_admin
  FROM public.auth_user au
  WHERE lower(au.email) = 'hwanys2@naver.com'
  LIMIT 1;

  v_sender := public.django_user_id();
  IF v_sender IS NULL THEN
    SELECT m.django_user_id
    INTO v_sender
    FROM public.auth_user_supabase_mapping m
    WHERE m.supabase_uid = v_uid
    LIMIT 1;
  END IF;
  IF v_sender IS NULL THEN
    SELECT dj.id
    INTO v_sender
    FROM auth.users su
    JOIN public.auth_user dj ON lower(dj.email) = lower(su.email)
    WHERE su.id = v_uid
    LIMIT 1;
  END IF;

  SELECT coalesce(
    nullif(trim(pr.nickname), ''),
    nullif(trim(dj.username), ''),
    '회원'
  )
  INTO v_nickname
  FROM public.auth_user_supabase_mapping m
  LEFT JOIN public.auth_user dj ON dj.id = m.django_user_id
  LEFT JOIN public.common_profile pr ON pr.user_id = m.django_user_id
  WHERE m.supabase_uid = v_uid
  LIMIT 1;

  IF v_nickname IS NULL THEN
    v_nickname := '회원';
  END IF;

  v_preview := left(v_body, 40);

  IF v_admin IS NOT NULL
     AND v_sender IS NOT NULL
     AND to_regprocedure('public.create_notification(integer, integer, text, text, text, text)') IS NOT NULL
  THEN
    PERFORM public.create_notification(
      v_admin,
      v_sender,
      '문제 그림 의견',
      v_nickname || '님이 "' || left(v_title, 30) || '"에 의견을 남겼습니다: ' || v_preview,
      'comment',
      'https://www.pimath.kr/tools/figures/' || v_tool || '#feedback'
    );
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_create_diagram_feedback(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pm_create_diagram_feedback(text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.pm_create_diagram_feedback(text, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Admin resolve
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_resolve_diagram_feedback(
  p_id uuid,
  p_status text,
  p_admin_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_status text;
  v_note text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'login_required';
  END IF;
  IF NOT public.pm_is_diagram_admin() THEN
    RAISE EXCEPTION 'not admin';
  END IF;

  v_status := trim(coalesce(p_status, ''));
  IF v_status NOT IN ('applied', 'rejected', 'open') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  v_note := nullif(trim(coalesce(p_admin_note, '')), '');
  IF v_note IS NOT NULL AND length(v_note) > 2000 THEN
    RAISE EXCEPTION 'note_too_long';
  END IF;

  UPDATE public.pm_diagram_feedback
  SET
    status = v_status,
    admin_note = v_note,
    resolved_at = CASE WHEN v_status = 'open' THEN NULL ELSE now() END,
    resolved_by = CASE WHEN v_status = 'open' THEN NULL ELSE v_uid END
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_resolve_diagram_feedback(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pm_resolve_diagram_feedback(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.pm_resolve_diagram_feedback(uuid, text, text) TO authenticated;
