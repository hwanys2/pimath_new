-- pm_graph: 그래프 탐구(순서쌍 모으기) 도구
-- 교사가 함수식으로 방을 만들고(QR/참가코드), 학생은 로그인 없이 이름만으로
-- 입장해 순서쌍을 제출한다. 정오 판정은 서버(Node)에서 수식 평가 후 전달.
-- 신규 pm_graph_* 객체만 생성. 기존 foreducator/pimath 객체는 건드리지 않음.
-- 공유 DB에는 명시적 확인 후에만 적용.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.pm_graph_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  join_code text,
  expression text NOT NULL,
  expression_display text NOT NULL,
  status text NOT NULL DEFAULT 'live',          -- live | closed
  reveal boolean NOT NULL DEFAULT false,        -- 그래프 개형 공개 여부
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS pm_graph_sessions_join_code_active
  ON public.pm_graph_sessions (join_code)
  WHERE join_code IS NOT NULL AND status <> 'closed';

CREATE INDEX IF NOT EXISTS pm_graph_sessions_teacher
  ON public.pm_graph_sessions (teacher_id, status);

CREATE TABLE IF NOT EXISTS public.pm_graph_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL
    REFERENCES public.pm_graph_sessions(id) ON DELETE CASCADE,
  guest_key text NOT NULL,
  name text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, guest_key)
);

CREATE INDEX IF NOT EXISTS pm_graph_participants_session
  ON public.pm_graph_participants (session_id, joined_at);

CREATE TABLE IF NOT EXISTS public.pm_graph_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL
    REFERENCES public.pm_graph_sessions(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL
    REFERENCES public.pm_graph_participants(id) ON DELETE CASCADE,
  x double precision NOT NULL,
  y double precision NOT NULL,
  is_correct boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pm_graph_points_session
  ON public.pm_graph_points (session_id, created_at);

-- RLS on, 정책 없음: 모든 접근은 SECURITY DEFINER RPC로만
ALTER TABLE public.pm_graph_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_graph_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_graph_points ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.pm_graph_sessions FROM anon, authenticated;
REVOKE ALL ON public.pm_graph_participants FROM anon, authenticated;
REVOKE ALL ON public.pm_graph_points FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helper: 세션 소유 교사 확인
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_graph_assert_teacher(p_session_id uuid)
RETURNS public.pm_graph_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_teacher uuid := auth.uid();
  v_sess public.pm_graph_sessions%ROWTYPE;
BEGIN
  IF v_teacher IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO v_sess
  FROM public.pm_graph_sessions s
  WHERE s.id = p_session_id;

  IF NOT FOUND OR v_sess.teacher_id <> v_teacher THEN
    RAISE EXCEPTION 'not session owner';
  END IF;

  RETURN v_sess;
END;
$$;

-- ---------------------------------------------------------------------------
-- 방 생성 (교사) — 이전 열린 방은 자동 종료, 참가코드 반환
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_graph_create_session(
  p_expression text,
  p_expression_display text,
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
BEGIN
  IF v_teacher IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_expression IS NULL OR trim(p_expression) = '' THEN
    RAISE EXCEPTION 'expression required';
  END IF;

  UPDATE public.pm_graph_sessions
  SET status = 'closed', updated_at = now()
  WHERE teacher_id = v_teacher AND status <> 'closed';

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
    teacher_id, join_code, expression, expression_display, settings
  )
  VALUES (
    v_teacher, v_code, trim(p_expression),
    left(trim(COALESCE(p_expression_display, p_expression)), 120),
    COALESCE(p_settings, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  session_id := v_id;
  join_code := v_code;
  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- 진행 중인 내 방 찾기 (교사)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_graph_find_my_active()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_teacher uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_teacher IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT s.id INTO v_id
  FROM public.pm_graph_sessions s
  WHERE s.teacher_id = v_teacher AND s.status <> 'closed'
  ORDER BY s.created_at DESC
  LIMIT 1;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 설정/식 변경, 개형 공개, 점 정리, 종료 (교사)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_graph_update_settings(
  p_session_id uuid,
  p_settings jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_sess public.pm_graph_sessions%ROWTYPE;
BEGIN
  v_sess := public.pm_graph_assert_teacher(p_session_id);

  UPDATE public.pm_graph_sessions
  SET settings = COALESCE(p_settings, '{}'::jsonb), updated_at = now()
  WHERE id = p_session_id;
END;
$$;

-- 식 변경: 기존 점의 정오 판정이 무의미해지므로 점을 모두 지우고 공개 해제
CREATE OR REPLACE FUNCTION public.pm_graph_update_expression(
  p_session_id uuid,
  p_expression text,
  p_expression_display text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_sess public.pm_graph_sessions%ROWTYPE;
BEGIN
  v_sess := public.pm_graph_assert_teacher(p_session_id);

  IF p_expression IS NULL OR trim(p_expression) = '' THEN
    RAISE EXCEPTION 'expression required';
  END IF;

  DELETE FROM public.pm_graph_points WHERE session_id = p_session_id;

  UPDATE public.pm_graph_sessions
  SET expression = trim(p_expression),
      expression_display = left(trim(COALESCE(p_expression_display, p_expression)), 120),
      reveal = false,
      updated_at = now()
  WHERE id = p_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_graph_set_reveal(
  p_session_id uuid,
  p_reveal boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_sess public.pm_graph_sessions%ROWTYPE;
BEGIN
  v_sess := public.pm_graph_assert_teacher(p_session_id);

  UPDATE public.pm_graph_sessions
  SET reveal = COALESCE(p_reveal, false), updated_at = now()
  WHERE id = p_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_graph_clear_points(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_sess public.pm_graph_sessions%ROWTYPE;
BEGIN
  v_sess := public.pm_graph_assert_teacher(p_session_id);
  DELETE FROM public.pm_graph_points WHERE session_id = p_session_id;
  UPDATE public.pm_graph_sessions SET updated_at = now() WHERE id = p_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_graph_remove_point(
  p_session_id uuid,
  p_point_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_sess public.pm_graph_sessions%ROWTYPE;
BEGIN
  v_sess := public.pm_graph_assert_teacher(p_session_id);
  DELETE FROM public.pm_graph_points
  WHERE id = p_point_id AND session_id = p_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_graph_close(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_sess public.pm_graph_sessions%ROWTYPE;
BEGIN
  v_sess := public.pm_graph_assert_teacher(p_session_id);
  UPDATE public.pm_graph_sessions
  SET status = 'closed', updated_at = now()
  WHERE id = p_session_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 교사 폴링: 세션 헤더 + 참가자별 점 (점 없는 참가자도 한 행)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_graph_teacher_poll(p_session_id uuid)
RETURNS TABLE (
  session_id uuid,
  status text,
  join_code text,
  expression text,
  expression_display text,
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
  v_sess := public.pm_graph_assert_teacher(p_session_id);

  RETURN QUERY
  SELECT
    v_sess.id,
    v_sess.status,
    v_sess.join_code,
    v_sess.expression,
    v_sess.expression_display,
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
      v_sess.status,
      v_sess.join_code,
      v_sess.expression,
      v_sess.expression_display,
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
-- 참가코드로 방 찾기 (익명)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_graph_find_by_code(p_join_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT s.id INTO v_id
  FROM public.pm_graph_sessions s
  WHERE upper(trim(p_join_code)) = s.join_code AND s.status <> 'closed'
  ORDER BY s.created_at DESC
  LIMIT 1;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 학생 입장 (이름만, 로그인 없음)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_graph_guest_join(
  p_join_code text,
  p_guest_key text,
  p_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session public.pm_graph_sessions%ROWTYPE;
  v_name text;
BEGIN
  IF p_guest_key IS NULL OR length(trim(p_guest_key)) < 8 THEN
    RAISE EXCEPTION 'invalid guest key';
  END IF;

  SELECT * INTO v_session
  FROM public.pm_graph_sessions s
  WHERE upper(trim(p_join_code)) = s.join_code AND s.status <> 'closed'
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no active session';
  END IF;

  v_name := left(COALESCE(NULLIF(trim(p_name), ''), '탐험가'), 20);

  INSERT INTO public.pm_graph_participants (session_id, guest_key, name)
  VALUES (v_session.id, trim(p_guest_key), v_name)
  ON CONFLICT (session_id, guest_key)
  DO UPDATE SET name = EXCLUDED.name;

  RETURN v_session.id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 순서쌍 제출 (익명) — is_correct는 서버(Node) 수식 평가 결과
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

  v_max := LEAST(GREATEST(
    COALESCE((v_sess.settings->>'maxPointsPerStudent')::int, 3), 1), 20);

  SELECT count(*) INTO v_count
  FROM public.pm_graph_points pt
  WHERE pt.participant_id = v_participant.id;

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'point limit reached';
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

-- 학생이 자신의 점 지우기 (다시 제출할 기회 확보)
CREATE OR REPLACE FUNCTION public.pm_graph_delete_own_point(
  p_session_id uuid,
  p_guest_key text,
  p_point_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_participant public.pm_graph_participants%ROWTYPE;
BEGIN
  SELECT * INTO v_participant
  FROM public.pm_graph_participants p
  WHERE p.session_id = p_session_id AND p.guest_key = trim(p_guest_key);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not in session';
  END IF;

  DELETE FROM public.pm_graph_points
  WHERE id = p_point_id
    AND session_id = p_session_id
    AND participant_id = v_participant.id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 학생 폴링 — 설정에 따라 식/전체 점 노출 제어
--   · expression: 개형 공개(reveal) 시에만 반환 (곡선 그리기용)
--   · expression_display: hideExpression이고 미공개면 숨김
--   · 전체 점: shareBoardWithStudents=false면 내 점만
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_graph_guest_poll(
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

  SELECT count(*) INTO v_count
  FROM public.pm_graph_participants p
  WHERE p.session_id = p_session_id;

  v_share := COALESCE((v_sess.settings->>'shareBoardWithStudents')::boolean, true);
  v_hide_expr := COALESCE((v_sess.settings->>'hideExpression')::boolean, false);
  v_expr := CASE WHEN v_sess.reveal THEN v_sess.expression ELSE NULL END;
  v_expr_display := CASE
    WHEN v_hide_expr AND NOT v_sess.reveal THEN NULL
    ELSE v_sess.expression_display
  END;

  RETURN QUERY
  SELECT
    v_sess.id,
    v_sess.status,
    v_sess.reveal,
    v_sess.settings,
    v_expr,
    v_expr_display,
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

REVOKE ALL ON FUNCTION public.pm_graph_assert_teacher(uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.pm_graph_create_session(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_graph_create_session(text, text, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.pm_graph_find_my_active() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_graph_find_my_active() TO authenticated;

REVOKE ALL ON FUNCTION public.pm_graph_update_settings(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_graph_update_settings(uuid, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.pm_graph_update_expression(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_graph_update_expression(uuid, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.pm_graph_set_reveal(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_graph_set_reveal(uuid, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.pm_graph_clear_points(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_graph_clear_points(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.pm_graph_remove_point(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_graph_remove_point(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.pm_graph_close(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_graph_close(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.pm_graph_teacher_poll(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_graph_teacher_poll(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.pm_graph_find_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_graph_find_by_code(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.pm_graph_guest_join(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_graph_guest_join(text, text, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.pm_graph_submit_point(uuid, text, double precision, double precision, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_graph_submit_point(uuid, text, double precision, double precision, boolean) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.pm_graph_delete_own_point(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_graph_delete_own_point(uuid, text, uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.pm_graph_guest_poll(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_graph_guest_poll(uuid, text) TO anon, authenticated;
