-- pm_graph v2: 무제한 점, 방제목/latex, 익명 교사, 로그인 교사 다중 방
-- 신규/변경 pm_graph_* 객체만. 기존 foreducator 객체 무변경.

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

ALTER TABLE public.pm_graph_sessions
  ALTER COLUMN teacher_id DROP NOT NULL;

ALTER TABLE public.pm_graph_sessions
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '그래프 탐구',
  ADD COLUMN IF NOT EXISTS expression_latex text,
  ADD COLUMN IF NOT EXISTS guest_teacher_key text;

ALTER TABLE public.pm_graph_sessions
  DROP CONSTRAINT IF EXISTS pm_graph_sessions_owner_check;

ALTER TABLE public.pm_graph_sessions
  ADD CONSTRAINT pm_graph_sessions_owner_check CHECK (
    teacher_id IS NOT NULL OR guest_teacher_key IS NOT NULL
  );

CREATE INDEX IF NOT EXISTS pm_graph_sessions_guest_teacher
  ON public.pm_graph_sessions (guest_teacher_key, status)
  WHERE guest_teacher_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Owner assert (auth teacher OR anon guest_teacher_key)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_graph_assert_owner(
  p_session_id uuid,
  p_guest_teacher_key text DEFAULT NULL
)
RETURNS public.pm_graph_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_teacher uuid := auth.uid();
  v_sess public.pm_graph_sessions%ROWTYPE;
  v_gk text := NULLIF(trim(p_guest_teacher_key), '');
BEGIN
  SELECT * INTO v_sess
  FROM public.pm_graph_sessions s
  WHERE s.id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session not found';
  END IF;

  IF v_sess.teacher_id IS NOT NULL THEN
    IF v_teacher IS NULL OR v_teacher <> v_sess.teacher_id THEN
      RAISE EXCEPTION 'not session owner';
    END IF;
  ELSE
    IF v_gk IS NULL OR v_gk <> v_sess.guest_teacher_key THEN
      RAISE EXCEPTION 'not session owner';
    END IF;
  END IF;

  RETURN v_sess;
END;
$$;

-- backward compat wrapper
CREATE OR REPLACE FUNCTION public.pm_graph_assert_teacher(p_session_id uuid)
RETURNS public.pm_graph_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN public.pm_graph_assert_owner(p_session_id, NULL);
END;
$$;

-- ---------------------------------------------------------------------------
-- 로그인 교사: 방 생성 (기존 방 auto-close 제거, title/latex 추가)
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.pm_graph_create_session(text, text, jsonb);

CREATE FUNCTION public.pm_graph_create_session(
  p_title text,
  p_expression text,
  p_expression_display text,
  p_expression_latex text,
  p_settings jsonb
)
RETURNS TABLE (session_id uuid, join_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_teacher uuid := auth.uid();
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_i int;
  v_id uuid;
  v_title text;
BEGIN
  IF v_teacher IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_expression IS NULL OR trim(p_expression) = '' THEN
    RAISE EXCEPTION 'expression required';
  END IF;

  v_title := left(COALESCE(NULLIF(trim(p_title), ''), '그래프 탐구'), 60);

  LOOP
    v_code := '';
    FOR v_i IN 1..6 LOOP
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars))::int + 1, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.pm_graph_sessions s
      WHERE s.join_code = v_code AND s.status <> 'closed'
    );
  END LOOP;

  INSERT INTO public.pm_graph_sessions (
    teacher_id, guest_teacher_key, join_code, title,
    expression, expression_display, expression_latex, settings
  )
  VALUES (
    v_teacher, NULL, v_code, v_title,
    trim(p_expression),
    left(trim(COALESCE(p_expression_display, p_expression)), 120),
    left(trim(COALESCE(p_expression_latex, p_expression_display, p_expression)), 200),
    COALESCE(p_settings, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  session_id := v_id;
  join_code := v_code;
  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- 익명 교사: 방 생성 (같은 guest_teacher_key의 이전 live만 close)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_graph_create_anon_session(
  p_guest_teacher_key text,
  p_expression text,
  p_expression_display text,
  p_expression_latex text,
  p_settings jsonb
)
RETURNS TABLE (session_id uuid, join_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_gk text := trim(p_guest_teacher_key);
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_i int;
  v_id uuid;
BEGIN
  IF v_gk IS NULL OR length(v_gk) < 8 THEN
    RAISE EXCEPTION 'invalid guest teacher key';
  END IF;

  IF p_expression IS NULL OR trim(p_expression) = '' THEN
    RAISE EXCEPTION 'expression required';
  END IF;

  UPDATE public.pm_graph_sessions
  SET status = 'closed', updated_at = now()
  WHERE guest_teacher_key = v_gk AND status <> 'closed';

  LOOP
    v_code := '';
    FOR v_i IN 1..6 LOOP
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars))::int + 1, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.pm_graph_sessions s
      WHERE s.join_code = v_code AND s.status <> 'closed'
    );
  END LOOP;

  INSERT INTO public.pm_graph_sessions (
    teacher_id, guest_teacher_key, join_code, title,
    expression, expression_display, expression_latex, settings
  )
  VALUES (
    NULL, v_gk, v_code, '그래프 탐구',
    trim(p_expression),
    left(trim(COALESCE(p_expression_display, p_expression)), 120),
    left(trim(COALESCE(p_expression_latex, p_expression_display, p_expression)), 200),
    COALESCE(p_settings, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  session_id := v_id;
  join_code := v_code;
  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- 익명 교사: 진행 중 방 찾기
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_graph_anon_find_active(p_guest_teacher_key text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_gk text := trim(p_guest_teacher_key);
  v_id uuid;
BEGIN
  IF v_gk IS NULL OR length(v_gk) < 8 THEN
    RETURN NULL;
  END IF;

  SELECT s.id INTO v_id
  FROM public.pm_graph_sessions s
  WHERE s.guest_teacher_key = v_gk AND s.status <> 'closed'
  ORDER BY s.created_at DESC
  LIMIT 1;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 로그인 교사: 전체 방 목록 (live + closed)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_graph_list_teacher_sessions()
RETURNS TABLE (
  session_id uuid,
  title text,
  status text,
  join_code text,
  expression_display text,
  expression_latex text,
  reveal boolean,
  participant_count bigint,
  point_count bigint,
  correct_count bigint,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_teacher uuid := auth.uid();
BEGIN
  IF v_teacher IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.title,
    s.status,
    s.join_code,
    s.expression_display,
    s.expression_latex,
    s.reveal,
    (SELECT count(*) FROM public.pm_graph_participants p WHERE p.session_id = s.id),
    (SELECT count(*) FROM public.pm_graph_points pt WHERE pt.session_id = s.id),
    (SELECT count(*) FROM public.pm_graph_points pt WHERE pt.session_id = s.id AND pt.is_correct),
    s.created_at,
    s.updated_at
  FROM public.pm_graph_sessions s
  WHERE s.teacher_id = v_teacher
  ORDER BY s.created_at DESC
  LIMIT 100;
END;
$$;

-- ---------------------------------------------------------------------------
-- Mutations: optional guest_teacher_key for anon owner
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_graph_update_settings(
  p_session_id uuid,
  p_settings jsonb,
  p_guest_teacher_key text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM public.pm_graph_assert_owner(p_session_id, p_guest_teacher_key);

  UPDATE public.pm_graph_sessions
  SET settings = COALESCE(p_settings, '{}'::jsonb), updated_at = now()
  WHERE id = p_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_graph_update_expression(
  p_session_id uuid,
  p_expression text,
  p_expression_display text,
  p_expression_latex text,
  p_guest_teacher_key text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM public.pm_graph_assert_owner(p_session_id, p_guest_teacher_key);

  IF p_expression IS NULL OR trim(p_expression) = '' THEN
    RAISE EXCEPTION 'expression required';
  END IF;

  DELETE FROM public.pm_graph_points WHERE session_id = p_session_id;

  UPDATE public.pm_graph_sessions
  SET expression = trim(p_expression),
      expression_display = left(trim(COALESCE(p_expression_display, p_expression)), 120),
      expression_latex = left(trim(COALESCE(p_expression_latex, p_expression_display, p_expression)), 200),
      reveal = false,
      updated_at = now()
  WHERE id = p_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_graph_set_reveal(
  p_session_id uuid,
  p_reveal boolean,
  p_guest_teacher_key text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM public.pm_graph_assert_owner(p_session_id, p_guest_teacher_key);

  UPDATE public.pm_graph_sessions
  SET reveal = COALESCE(p_reveal, false), updated_at = now()
  WHERE id = p_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_graph_clear_points(
  p_session_id uuid,
  p_guest_teacher_key text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM public.pm_graph_assert_owner(p_session_id, p_guest_teacher_key);
  DELETE FROM public.pm_graph_points WHERE session_id = p_session_id;
  UPDATE public.pm_graph_sessions SET updated_at = now() WHERE id = p_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_graph_remove_point(
  p_session_id uuid,
  p_point_id uuid,
  p_guest_teacher_key text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM public.pm_graph_assert_owner(p_session_id, p_guest_teacher_key);
  DELETE FROM public.pm_graph_points
  WHERE id = p_point_id AND session_id = p_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_graph_close(
  p_session_id uuid,
  p_guest_teacher_key text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM public.pm_graph_assert_owner(p_session_id, p_guest_teacher_key);
  UPDATE public.pm_graph_sessions
  SET status = 'closed', updated_at = now()
  WHERE id = p_session_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Teacher poll (+ title, latex, guest key owner)
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.pm_graph_teacher_poll(uuid);

CREATE FUNCTION public.pm_graph_teacher_poll(
  p_session_id uuid,
  p_guest_teacher_key text DEFAULT NULL
)
RETURNS TABLE (
  session_id uuid,
  title text,
  status text,
  join_code text,
  expression text,
  expression_display text,
  expression_latex text,
  reveal boolean,
  settings jsonb,
  participant_id uuid,
  participant_name text,
  participant_joined_at timestamptz,
  point_id uuid,
  x double precision,
  y double precision,
  is_correct boolean,
  point_created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_sess public.pm_graph_sessions%ROWTYPE;
BEGIN
  v_sess := public.pm_graph_assert_owner(p_session_id, p_guest_teacher_key);

  RETURN QUERY
  SELECT
    v_sess.id,
    v_sess.title,
    v_sess.status,
    v_sess.join_code,
    v_sess.expression,
    v_sess.expression_display,
    v_sess.expression_latex,
    v_sess.reveal,
    v_sess.settings,
    p.id,
    p.name,
    p.joined_at,
    pt.id,
    pt.x,
    pt.y,
    pt.is_correct,
    pt.created_at
  FROM public.pm_graph_participants p
  LEFT JOIN public.pm_graph_points pt ON pt.participant_id = p.id
  WHERE p.session_id = v_sess.id
  ORDER BY p.joined_at ASC, pt.created_at ASC;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      v_sess.id,
      v_sess.title,
      v_sess.status,
      v_sess.join_code,
      v_sess.expression,
      v_sess.expression_display,
      v_sess.expression_latex,
      v_sess.reveal,
      v_sess.settings,
      NULL::uuid,
      NULL::text,
      NULL::timestamptz,
      NULL::uuid,
      NULL::double precision,
      NULL::double precision,
      NULL::boolean,
      NULL::timestamptz;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Submit: unlimited points skip
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_graph_submit_point(
  p_session_id uuid,
  p_guest_key text,
  p_x double precision,
  p_y double precision,
  p_is_correct boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_sess public.pm_graph_sessions%ROWTYPE;
  v_participant public.pm_graph_participants%ROWTYPE;
  v_unlimited boolean;
  v_max int;
  v_count int;
  v_point_id uuid;
BEGIN
  IF p_x IS NULL OR p_y IS NULL
     OR NOT (abs(p_x) <= 1e6 AND abs(p_y) <= 1e6) THEN
    RAISE EXCEPTION 'invalid point';
  END IF;

  SELECT * INTO v_sess
  FROM public.pm_graph_sessions s
  WHERE s.id = p_session_id AND s.status = 'live';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no active session';
  END IF;

  SELECT * INTO v_participant
  FROM public.pm_graph_participants p
  WHERE p.session_id = p_session_id AND p.guest_key = trim(p_guest_key);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not in session';
  END IF;

  v_unlimited := COALESCE((v_sess.settings->>'unlimitedPoints')::boolean, false);

  IF NOT v_unlimited THEN
    v_max := LEAST(GREATEST(
      COALESCE((v_sess.settings->>'maxPointsPerStudent')::int, 3), 1), 20);

    SELECT count(*) INTO v_count
    FROM public.pm_graph_points pt
    WHERE pt.participant_id = v_participant.id;

    IF v_count >= v_max THEN
      RAISE EXCEPTION 'point limit reached';
    END IF;
  END IF;

  INSERT INTO public.pm_graph_points (
    session_id, participant_id, x, y, is_correct
  )
  VALUES (
    p_session_id, v_participant.id, p_x, p_y, COALESCE(p_is_correct, false)
  )
  RETURNING id INTO v_point_id;

  UPDATE public.pm_graph_sessions SET updated_at = now()
  WHERE id = p_session_id;

  RETURN v_point_id;
END;
$$;

-- Guest poll: add expression_latex
DROP FUNCTION IF EXISTS public.pm_graph_guest_poll(uuid, text);

CREATE FUNCTION public.pm_graph_guest_poll(
  p_session_id uuid,
  p_guest_key text
)
RETURNS TABLE (
  session_id uuid,
  status text,
  reveal boolean,
  settings jsonb,
  expression text,
  expression_display text,
  expression_latex text,
  participant_count int,
  my_name text,
  point_id uuid,
  participant_name text,
  x double precision,
  y double precision,
  is_correct boolean,
  is_me boolean,
  point_created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_sess public.pm_graph_sessions%ROWTYPE;
  v_gk text := trim(p_guest_key);
  v_me public.pm_graph_participants%ROWTYPE;
  v_count int;
  v_share boolean;
  v_hide_expr boolean;
  v_expr text;
  v_expr_display text;
  v_expr_latex text;
BEGIN
  SELECT * INTO v_sess
  FROM public.pm_graph_sessions s
  WHERE s.id = p_session_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT * INTO v_me
  FROM public.pm_graph_participants p
  WHERE p.session_id = p_session_id AND p.guest_key = v_gk;

  SELECT count(*)::int INTO v_count
  FROM public.pm_graph_participants p
  WHERE p.session_id = p_session_id;

  v_share := COALESCE((v_sess.settings->>'shareBoardWithStudents')::boolean, true);
  v_hide_expr := COALESCE((v_sess.settings->>'hideExpression')::boolean, false);
  v_expr := CASE WHEN v_sess.reveal THEN v_sess.expression ELSE NULL END;
  v_expr_display := CASE
    WHEN v_hide_expr AND NOT v_sess.reveal THEN NULL
    ELSE v_sess.expression_display
  END;
  v_expr_latex := CASE
    WHEN v_hide_expr AND NOT v_sess.reveal THEN NULL
    ELSE v_sess.expression_latex
  END;

  RETURN QUERY
  SELECT
    v_sess.id,
    v_sess.status,
    v_sess.reveal,
    v_sess.settings,
    v_expr,
    v_expr_display,
    v_expr_latex,
    v_count,
    v_me.name,
    pt.id,
    p.name,
    pt.x,
    pt.y,
    pt.is_correct,
    (v_me.id IS NOT NULL AND pt.participant_id = v_me.id) AS is_me,
    pt.created_at
  FROM public.pm_graph_points pt
  JOIN public.pm_graph_participants p ON p.id = pt.participant_id
  WHERE pt.session_id = v_sess.id
    AND (v_share OR (v_me.id IS NOT NULL AND pt.participant_id = v_me.id))
  ORDER BY pt.created_at ASC;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      v_sess.id,
      v_sess.status,
      v_sess.reveal,
      v_sess.settings,
      v_expr,
      v_expr_display,
      v_expr_latex,
      v_count,
      v_me.name,
      NULL::uuid,
      NULL::text,
      NULL::double precision,
      NULL::double precision,
      NULL::boolean,
      false,
      NULL::timestamptz;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.pm_graph_assert_owner(uuid, text) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.pm_graph_create_session(text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_graph_create_session(text, text, text, text, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.pm_graph_create_anon_session(text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_graph_create_anon_session(text, text, text, text, jsonb) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.pm_graph_anon_find_active(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_graph_anon_find_active(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.pm_graph_list_teacher_sessions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_graph_list_teacher_sessions() TO authenticated;

REVOKE ALL ON FUNCTION public.pm_graph_update_settings(uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_graph_update_settings(uuid, jsonb, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.pm_graph_update_expression(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_graph_update_expression(uuid, text, text, text, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.pm_graph_set_reveal(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_graph_set_reveal(uuid, boolean, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.pm_graph_clear_points(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_graph_clear_points(uuid, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.pm_graph_remove_point(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_graph_remove_point(uuid, uuid, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.pm_graph_close(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_graph_close(uuid, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.pm_graph_teacher_poll(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_graph_teacher_poll(uuid, text) TO anon, authenticated;
