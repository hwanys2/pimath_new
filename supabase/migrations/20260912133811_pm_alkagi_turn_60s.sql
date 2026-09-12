-- Extend alkagi PvP turn clock from 30s to 60s.

CREATE OR REPLACE FUNCTION public.pm_alkagi_try_match(
  p_queue_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_me public.pm_alkagi_queue%ROWTYPE;
  v_opp public.pm_alkagi_queue%ROWTYPE;
  v_game_id uuid;
  v_black public.pm_alkagi_queue%ROWTYPE;
  v_white public.pm_alkagi_queue%ROWTYPE;
BEGIN
  DELETE FROM public.pm_pvp_rematch_block WHERE blocked_until < now();

  UPDATE public.pm_alkagi_queue
  SET status = 'cancelled', updated_at = now()
  WHERE status = 'waiting'
    AND updated_at < now() - interval '2 minutes';

  SELECT * INTO v_me FROM public.pm_alkagi_queue WHERE id = p_queue_id FOR UPDATE;
  IF NOT FOUND OR v_me.status <> 'waiting' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_opp
  FROM public.pm_alkagi_queue q
  WHERE q.status = 'waiting'
    AND q.id <> v_me.id
    AND q.player_key <> v_me.player_key
    AND q.updated_at >= now() - interval '15 seconds'
    AND (
      (v_me.scope = 'class' AND q.scope = 'class' AND q.class_id IS NOT NULL AND q.class_id = v_me.class_id)
      OR
      (v_me.scope = 'global' AND q.scope = 'global')
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.pm_pvp_rematch_block b
      WHERE b.game_key = 'alkagi'
        AND b.player_key = v_me.player_key
        AND b.opponent_key = q.player_key
        AND b.blocked_until > now()
    )
  ORDER BY q.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF random() < 0.5 THEN
    v_black := v_me;
    v_white := v_opp;
  ELSE
    v_black := v_opp;
    v_white := v_me;
  END IF;

  INSERT INTO public.pm_alkagi_games (
    scope,
    black_key,
    white_key,
    black_name,
    white_name,
    black_student_id,
    white_student_id,
    board,
    turn,
    status,
    turn_deadline,
    created_at,
    updated_at
  ) VALUES (
    v_me.scope,
    v_black.player_key,
    v_white.player_key,
    v_black.display_name,
    v_white.display_name,
    v_black.student_id,
    v_white.student_id,
    public.pm_alkagi_initial_board(),
    'black',
    'playing',
    now() + interval '60 seconds',
    now(),
    now()
  ) RETURNING id INTO v_game_id;

  UPDATE public.pm_alkagi_queue
  SET status = 'matched', game_id = v_game_id, updated_at = now()
  WHERE id IN (v_me.id, v_opp.id);

  RETURN v_game_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_alkagi_place_move(
  p_session_token text,
  p_guest_id text,
  p_game_id uuid,
  p_board jsonb,
  p_last_shot jsonb,
  p_new_status text,
  p_next_turn text
)
RETURNS TABLE (
  ok boolean,
  error text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key text;
  v_g public.pm_alkagi_games%ROWTYPE;
  v_color text;
BEGIN
  SELECT r.o_player_key INTO v_key
  FROM public.pm_alkagi_resolve_identity(p_session_token, p_guest_id) r;

  IF v_key IS NULL THEN
    RETURN QUERY SELECT false, 'invalid_identity'::text;
    RETURN;
  END IF;

  SELECT * INTO v_g FROM public.pm_alkagi_games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'game_not_found'::text;
    RETURN;
  END IF;

  IF v_g.status <> 'playing' THEN
    RETURN QUERY SELECT false, 'game_not_playing'::text;
    RETURN;
  END IF;

  v_color := CASE WHEN v_g.black_key = v_key THEN 'black' WHEN v_g.white_key = v_key THEN 'white' ELSE NULL END;
  IF v_color IS NULL OR v_color <> v_g.turn THEN
    RETURN QUERY SELECT false, 'not_your_turn'::text;
    RETURN;
  END IF;

  UPDATE public.pm_alkagi_games
  SET board = p_board,
      last_shot = p_last_shot,
      turn = CASE WHEN p_new_status = 'playing' THEN p_next_turn ELSE NULL END,
      status = p_new_status,
      move_count = v_g.move_count + 1,
      turn_deadline = CASE WHEN p_new_status = 'playing' THEN now() + interval '60 seconds' ELSE NULL END,
      updated_at = now()
  WHERE id = v_g.id;

  RETURN QUERY SELECT true, NULL::text;
END;
$$;

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
        WHEN p_new_status = 'playing' THEN now() + interval '60 seconds'
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

GRANT EXECUTE ON FUNCTION public.pm_alkagi_try_match(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_alkagi_place_move(text, text, uuid, jsonb, jsonb, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_alkagi_timeout_move(text, text, uuid, int, jsonb, jsonb, text, text) TO anon, authenticated;
