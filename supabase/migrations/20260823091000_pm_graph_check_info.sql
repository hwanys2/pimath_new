-- pm_graph: 제출 정오 판정용 내부 조회 RPC
-- 서버 액션(Node)이 학생 제출을 판정하려면 함수식과 설정이 필요하다.
-- 세션 참가자(guest_key 일치)에게만 반환한다.

CREATE OR REPLACE FUNCTION public.pm_graph_check_info(
  p_session_id uuid,
  p_guest_key text
)
RETURNS TABLE (expression text, settings jsonb, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_sess public.pm_graph_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_sess
  FROM public.pm_graph_sessions s
  WHERE s.id = p_session_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.pm_graph_participants p
    WHERE p.session_id = p_session_id AND p.guest_key = trim(p_guest_key)
  ) THEN
    RETURN;
  END IF;

  expression := v_sess.expression;
  settings := v_sess.settings;
  status := v_sess.status;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_graph_check_info(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_graph_check_info(uuid, text) TO anon, authenticated;
