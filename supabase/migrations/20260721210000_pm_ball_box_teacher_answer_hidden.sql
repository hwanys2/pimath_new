-- Teacher poll: hide box composition until phase = 'revealed' (same as student/guest).

DROP FUNCTION IF EXISTS public.pm_ball_box_teacher_poll(uuid);

CREATE FUNCTION public.pm_ball_box_teacher_poll(p_session_id uuid)
RETURNS TABLE (
  session_id uuid,
  class_id uuid,
  class_name text,
  phase text,
  round_number int,
  total int,
  answer_colors jsonb,
  revealed_answer jsonb,
  join_code text,
  pid text,
  student_id uuid,
  display_name text,
  observed jsonb,
  draw_count int,
  wrong_attempts int,
  solved boolean,
  score int,
  session_score int,
  is_me boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_sess public.pm_ball_box_sessions%ROWTYPE;
  v_class_name text;
  v_colors jsonb;
  v_revealed jsonb;
BEGIN
  v_sess := public.pm_ball_box_assert_teacher(p_session_id);

  IF v_sess.phase = 'closed' THEN
    RETURN;
  END IF;

  -- teacher sees composition only when phase = 'revealed'
  v_revealed := CASE WHEN v_sess.phase = 'revealed' THEN v_sess.answer ELSE NULL END;

  SELECT c.name INTO v_class_name
  FROM public.pm_classes c
  WHERE c.id = v_sess.class_id;

  SELECT COALESCE(jsonb_agg(k ORDER BY idx), '[]'::jsonb) INTO v_colors
  FROM (
    SELECT k, array_position(public.pm_ball_box_colors(), k) AS idx
    FROM jsonb_object_keys(v_sess.answer) AS k
  ) t;

  RETURN QUERY
  SELECT
    v_sess.id,
    v_sess.class_id,
    v_class_name,
    v_sess.phase,
    v_sess.round_number,
    v_sess.total,
    v_colors,
    v_revealed,
    v_sess.join_code,
    COALESCE(p.student_id::text, 'g:' || p.guest_key),
    p.student_id,
    p.display_name,
    '{}'::jsonb,
    p.draw_count,
    p.wrong_attempts,
    p.solved,
    p.score,
    p.session_score,
    false AS is_me
  FROM public.pm_ball_box_players p
  WHERE p.session_id = v_sess.id
  ORDER BY p.session_score DESC, p.score DESC, p.joined_at ASC;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      v_sess.id,
      v_sess.class_id,
      v_class_name,
      v_sess.phase,
      v_sess.round_number,
      v_sess.total,
      v_colors,
      v_revealed,
      v_sess.join_code,
      NULL::text,
      NULL::uuid,
      NULL::text,
      '{}'::jsonb,
      0,
      0,
      false,
      0,
      0,
      false;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_ball_box_teacher_poll(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_ball_box_teacher_poll(uuid) TO authenticated;
