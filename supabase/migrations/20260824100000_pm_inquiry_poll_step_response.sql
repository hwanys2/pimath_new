-- Return the current student's saved response jsonb in pm_inquiry_poll
-- so the client can restore workspace after refresh.
-- Apply to shared DB only after explicit human confirmation.

DROP FUNCTION IF EXISTS public.pm_inquiry_poll(text, uuid);

CREATE OR REPLACE FUNCTION public.pm_inquiry_poll(
  p_session_token text,
  p_session_id uuid
)
RETURNS TABLE (
  session_id uuid,
  class_id uuid,
  class_name text,
  content_key text,
  phase text,
  step_index int,
  step_count int,
  student_id uuid,
  display_name text,
  last_seen_at timestamptz,
  step_result text,
  step_response jsonb,
  is_me boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_student uuid := public.pm_student_id_from_session(p_session_token);
  v_sess public.pm_inquiry_sessions%ROWTYPE;
  v_class_name text;
BEGIN
  IF v_student IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_sess
  FROM public.pm_inquiry_sessions s
  WHERE s.id = p_session_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT c.name INTO v_class_name
  FROM public.pm_classes c
  WHERE c.id = v_sess.class_id;

  UPDATE public.pm_inquiry_participants p
  SET last_seen_at = now()
  WHERE p.session_id = p_session_id AND p.student_id = v_student;

  RETURN QUERY
  SELECT
    v_sess.id,
    v_sess.class_id,
    v_class_name,
    v_sess.content_key,
    v_sess.phase,
    v_sess.step_index,
    v_sess.step_count,
    p.student_id,
    p.display_name,
    p.last_seen_at,
    r.result AS step_result,
    r.response AS step_response,
    (p.student_id = v_student) AS is_me
  FROM public.pm_inquiry_participants p
  LEFT JOIN public.pm_inquiry_step_responses r
    ON r.session_id = p.session_id
   AND r.student_id = p.student_id
   AND r.step_index = v_sess.step_index
  WHERE p.session_id = v_sess.id
  ORDER BY p.joined_at ASC;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      v_sess.id,
      v_sess.class_id,
      v_class_name,
      v_sess.content_key,
      v_sess.phase,
      v_sess.step_index,
      v_sess.step_count,
      NULL::uuid,
      NULL::text,
      NULL::timestamptz,
      NULL::text,
      NULL::jsonb,
      false;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_inquiry_poll(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_inquiry_poll(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pm_inquiry_poll(text, uuid) TO anon;
