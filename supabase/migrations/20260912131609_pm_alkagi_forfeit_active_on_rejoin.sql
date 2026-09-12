-- Keep rejoining players from leaving orphaned "playing" games behind.
-- This mirrors the established omok queue behavior.
CREATE OR REPLACE FUNCTION public.pm_alkagi_join_queue(
  p_session_token text,
  p_guest_id text,
  p_scope text DEFAULT 'class'
)
RETURNS TABLE (
  queue_id uuid,
  game_id uuid,
  scope text,
  status text,
  player_key text,
  display_name text,
  class_id uuid,
  can_use_class boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key text;
  v_name text;
  v_class uuid;
  v_student uuid;
  v_scope text;
  v_qid uuid;
  v_gid uuid;
BEGIN
  SELECT r.o_player_key, r.o_display_name, r.o_class_id, r.o_student_id
  INTO v_key, v_name, v_class, v_student
  FROM public.pm_alkagi_resolve_identity(p_session_token, p_guest_id) r;

  IF v_key IS NULL THEN
    RAISE EXCEPTION 'cannot resolve identity';
  END IF;

  v_scope := lower(trim(coalesce(p_scope, 'class')));
  IF v_scope NOT IN ('class', 'global') THEN v_scope := 'class'; END IF;
  IF v_scope = 'class' AND v_class IS NULL THEN v_scope := 'global'; END IF;

  UPDATE public.pm_alkagi_games g
  SET status = CASE
        WHEN g.black_key = v_key THEN 'white_win'
        ELSE 'black_win'
      END,
      turn = NULL,
      turn_deadline = NULL,
      updated_at = now()
  WHERE g.status = 'playing'
    AND (g.black_key = v_key OR g.white_key = v_key);

  UPDATE public.pm_alkagi_queue q
  SET status = 'cancelled', updated_at = now()
  WHERE q.player_key = v_key AND q.status IN ('waiting', 'matched');

  INSERT INTO public.pm_alkagi_queue (
    player_key, display_name, scope, class_id, student_id, guest_id, status, updated_at
  ) VALUES (
    v_key,
    v_name,
    v_scope,
    CASE WHEN v_scope = 'class' THEN v_class ELSE NULL END,
    v_student,
    CASE WHEN v_key LIKE 'guest:%' THEN trim(p_guest_id) ELSE NULL END,
    'waiting',
    now()
  ) RETURNING id INTO v_qid;

  v_gid := public.pm_alkagi_try_match(v_qid);

  RETURN QUERY
  SELECT
    q.id,
    q.game_id,
    q.scope,
    q.status,
    q.player_key,
    q.display_name,
    q.class_id,
    (v_class IS NOT NULL)
  FROM public.pm_alkagi_queue q
  WHERE q.id = v_qid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pm_alkagi_join_queue(text, text, text)
TO anon, authenticated;
