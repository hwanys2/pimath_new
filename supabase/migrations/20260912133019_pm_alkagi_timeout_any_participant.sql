-- Allow either participant to advance an expired turn. This keeps a match
-- moving even when the player whose clock expired closed or hid the tab.
-- expected_move_count makes concurrent timeout claims idempotent.
CREATE OR REPLACE FUNCTION public.pm_alkagi_timeout_move(
  p_session_token text,
  p_guest_id text,
  p_game_id uuid,
  p_expected_move_count int,
  p_board jsonb,
  p_last_shot jsonb,
  p_new_status text,
  p_next_turn text
)
RETURNS TABLE (
  ok boolean,
  error text,
  move_count int,
  game_status text,
  next_turn text,
  next_deadline timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key text;
  v_game public.pm_alkagi_games%ROWTYPE;
BEGIN
  SELECT r.o_player_key INTO v_key
  FROM public.pm_alkagi_resolve_identity(p_session_token, p_guest_id) r;

  IF v_key IS NULL THEN
    RETURN QUERY
    SELECT false, 'invalid_identity'::text, NULL::int, NULL::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT * INTO v_game
  FROM public.pm_alkagi_games g
  WHERE g.id = p_game_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT false, 'game_not_found'::text, NULL::int, NULL::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  IF v_key <> v_game.black_key AND v_key <> v_game.white_key THEN
    RETURN QUERY
    SELECT false, 'not_participant'::text, v_game.move_count, v_game.status, v_game.turn, v_game.turn_deadline;
    RETURN;
  END IF;

  IF v_game.status <> 'playing' THEN
    RETURN QUERY
    SELECT false, 'game_not_playing'::text, v_game.move_count, v_game.status, v_game.turn, v_game.turn_deadline;
    RETURN;
  END IF;

  IF v_game.move_count <> p_expected_move_count THEN
    RETURN QUERY
    SELECT false, 'stale_move'::text, v_game.move_count, v_game.status, v_game.turn, v_game.turn_deadline;
    RETURN;
  END IF;

  IF v_game.turn_deadline IS NULL OR v_game.turn_deadline > now() THEN
    RETURN QUERY
    SELECT false, 'not_expired'::text, v_game.move_count, v_game.status, v_game.turn, v_game.turn_deadline;
    RETURN;
  END IF;

  IF p_new_status NOT IN ('playing', 'black_win', 'white_win', 'draw') THEN
    RETURN QUERY
    SELECT false, 'invalid_status'::text, v_game.move_count, v_game.status, v_game.turn, v_game.turn_deadline;
    RETURN;
  END IF;

  IF p_new_status = 'playing' AND p_next_turn NOT IN ('black', 'white') THEN
    RETURN QUERY
    SELECT false, 'invalid_turn'::text, v_game.move_count, v_game.status, v_game.turn, v_game.turn_deadline;
    RETURN;
  END IF;

  UPDATE public.pm_alkagi_games g
  SET board = p_board,
      last_shot = p_last_shot,
      turn = CASE WHEN p_new_status = 'playing' THEN p_next_turn ELSE NULL END,
      status = p_new_status,
      move_count = v_game.move_count + 1,
      turn_deadline = CASE
        WHEN p_new_status = 'playing' THEN now() + interval '30 seconds'
        ELSE NULL
      END,
      updated_at = now()
  WHERE g.id = v_game.id;

  RETURN QUERY
  SELECT
    true,
    NULL::text,
    g.move_count,
    g.status,
    g.turn,
    g.turn_deadline
  FROM public.pm_alkagi_games g
  WHERE g.id = v_game.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pm_alkagi_timeout_move(
  text, text, uuid, int, jsonb, jsonb, text, text
) TO anon, authenticated;
