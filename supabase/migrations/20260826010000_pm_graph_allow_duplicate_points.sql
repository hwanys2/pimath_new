-- pm_graph: 교사 설정 allowDuplicatePoints=false 이면 동일 좌표 중복 제출 차단
-- settings jsonb 키만 사용(스키마 컬럼 추가 없음). 기존 방은 키 없으면 true(현행 유지).
-- 동시 제출 레이스는 세션 행 FOR UPDATE 로 직렬화해 막는다.

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
  v_allow_dup boolean;
  v_max int;
  v_count int;
  v_point_id uuid;
BEGIN
  IF p_x IS NULL OR p_y IS NULL
     OR NOT (abs(p_x) <= 1e6 AND abs(p_y) <= 1e6) THEN
    RAISE EXCEPTION 'invalid point';
  END IF;

  -- 같은 세션 동시 제출을 직렬화 (중복 허용 OFF 시 레이스 방지)
  SELECT * INTO v_sess
  FROM public.pm_graph_sessions s
  WHERE s.id = p_session_id AND s.status = 'live'
  FOR UPDATE;

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
  -- 키 없음/파싱 실패 → 기존 동작(중복 허용)
  v_allow_dup := COALESCE((v_sess.settings->>'allowDuplicatePoints')::boolean, true);

  IF NOT v_allow_dup THEN
    IF EXISTS (
      SELECT 1
      FROM public.pm_graph_points pt
      WHERE pt.session_id = p_session_id
        AND abs(pt.x - p_x) < 1e-9
        AND abs(pt.y - p_y) < 1e-9
    ) THEN
      RAISE EXCEPTION 'duplicate point';
    END IF;
  END IF;

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
