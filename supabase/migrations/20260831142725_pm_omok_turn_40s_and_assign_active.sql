-- Omok PvP turn window: 20s -> 40s (accounts for hybrid sync move visibility delay).

CREATE OR REPLACE FUNCTION public.pm_omok_apply_move(
  p_session_token text,
  p_guest_id text,
  p_game_id uuid,
  p_x int,
  p_y int,
  p_board jsonb,
  p_next_turn text,
  p_status text,
  p_move_count int
)
RETURNS TABLE (
  ok boolean,
  game_id uuid,
  board jsonb,
  turn text,
  status text,
  last_x int,
  last_y int,
  move_count int,
  error_code text,
  turn_deadline timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key text;
  v_g public.pm_omok_games%ROWTYPE;
  v_stone text;
  v_cell text;
BEGIN
  SELECT r.o_player_key INTO v_key
  FROM public.pm_omok_resolve_identity(p_session_token, p_guest_id) r;
  IF v_key IS NULL THEN
    ok := false;
    error_code := 'identity';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT * INTO v_g FROM public.pm_omok_games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND THEN
    ok := false;
    error_code := 'not_found';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_g.status <> 'playing' THEN
    ok := false;
    error_code := 'game_over';
    game_id := v_g.id;
    board := v_g.board;
    turn := v_g.turn;
    status := v_g.status;
    last_x := v_g.last_x;
    last_y := v_g.last_y;
    move_count := v_g.move_count;
    turn_deadline := v_g.turn_deadline;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_g.black_key = v_key THEN
    v_stone := 'black';
  ELSIF v_g.white_key = v_key THEN
    v_stone := 'white';
  ELSE
    ok := false;
    error_code := 'not_player';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_g.turn <> v_stone THEN
    ok := false;
    error_code := 'not_your_turn';
    game_id := v_g.id;
    board := v_g.board;
    turn := v_g.turn;
    status := v_g.status;
    last_x := v_g.last_x;
    last_y := v_g.last_y;
    move_count := v_g.move_count;
    turn_deadline := v_g.turn_deadline;
    RETURN NEXT;
    RETURN;
  END IF;

  v_cell := v_g.board ->> (p_x::text || ',' || p_y::text);
  IF v_cell IS NOT NULL THEN
    ok := false;
    error_code := 'occupied';
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_status NOT IN ('playing', 'black_win', 'white_win', 'draw') THEN
    ok := false;
    error_code := 'bad_status';
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_next_turn NOT IN ('black', 'white') THEN
    ok := false;
    error_code := 'bad_turn';
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE public.pm_omok_games g
  SET board = p_board,
      turn = CASE WHEN p_status = 'playing' THEN p_next_turn ELSE g.turn END,
      status = p_status,
      last_x = p_x,
      last_y = p_y,
      move_count = p_move_count,
      turn_deadline = CASE
        WHEN p_status = 'playing' THEN now() + interval '40 seconds'
        ELSE NULL
      END,
      updated_at = now()
  WHERE g.id = p_game_id
  RETURNING * INTO v_g;

  ok := true;
  error_code := NULL;
  game_id := v_g.id;
  board := v_g.board;
  turn := v_g.turn;
  status := v_g.status;
  last_x := v_g.last_x;
  last_y := v_g.last_y;
  move_count := v_g.move_count;
  turn_deadline := v_g.turn_deadline;
  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) timeout_apply_move: same turn qualification fix
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.pm_omok_timeout_apply_move(text, text, uuid, int, int, jsonb, text, text, int);

CREATE OR REPLACE FUNCTION public.pm_omok_timeout_apply_move(
  p_session_token text,
  p_guest_id text,
  p_game_id uuid,
  p_x int,
  p_y int,
  p_board jsonb,
  p_next_turn text,
  p_status text,
  p_move_count int
)
RETURNS TABLE (
  ok boolean,
  game_id uuid,
  board jsonb,
  turn text,
  status text,
  last_x int,
  last_y int,
  move_count int,
  error_code text,
  turn_deadline timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key text;
  v_g public.pm_omok_games%ROWTYPE;
  v_cell text;
BEGIN
  SELECT r.o_player_key INTO v_key
  FROM public.pm_omok_resolve_identity(p_session_token, p_guest_id) r;
  IF v_key IS NULL THEN
    ok := false;
    error_code := 'identity';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT * INTO v_g FROM public.pm_omok_games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND THEN
    ok := false;
    error_code := 'not_found';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_g.black_key <> v_key AND v_g.white_key <> v_key THEN
    ok := false;
    error_code := 'not_player';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_g.status <> 'playing' THEN
    ok := false;
    error_code := 'game_over';
    game_id := v_g.id;
    board := v_g.board;
    turn := v_g.turn;
    status := v_g.status;
    last_x := v_g.last_x;
    last_y := v_g.last_y;
    move_count := v_g.move_count;
    turn_deadline := v_g.turn_deadline;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_g.turn_deadline IS NULL OR now() < v_g.turn_deadline THEN
    ok := false;
    error_code := 'not_expired';
    game_id := v_g.id;
    board := v_g.board;
    turn := v_g.turn;
    status := v_g.status;
    last_x := v_g.last_x;
    last_y := v_g.last_y;
    move_count := v_g.move_count;
    turn_deadline := v_g.turn_deadline;
    RETURN NEXT;
    RETURN;
  END IF;

  v_cell := v_g.board ->> (p_x::text || ',' || p_y::text);
  IF v_cell IS NOT NULL THEN
    ok := false;
    error_code := 'occupied';
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_status NOT IN ('playing', 'black_win', 'white_win', 'draw') THEN
    ok := false;
    error_code := 'bad_status';
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_next_turn NOT IN ('black', 'white') THEN
    ok := false;
    error_code := 'bad_turn';
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE public.pm_omok_games g
  SET board = p_board,
      turn = CASE WHEN p_status = 'playing' THEN p_next_turn ELSE g.turn END,
      status = p_status,
      last_x = p_x,
      last_y = p_y,
      move_count = p_move_count,
      turn_deadline = CASE
        WHEN p_status = 'playing' THEN now() + interval '40 seconds'
        ELSE NULL
      END,
      updated_at = now()
  WHERE g.id = p_game_id
  RETURNING * INTO v_g;

  ok := true;
  error_code := NULL;
  game_id := v_g.id;
  board := v_g.board;
  turn := v_g.turn;
  status := v_g.status;
  last_x := v_g.last_x;
  last_y := v_g.last_y;
  move_count := v_g.move_count;
  turn_deadline := v_g.turn_deadline;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pm_omok_apply_move(text, text, uuid, int, int, jsonb, text, text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_omok_timeout_apply_move(text, text, uuid, int, int, jsonb, text, text, int) TO anon, authenticated;


CREATE OR REPLACE FUNCTION public.pm_omok_try_match(p_queue_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_me public.pm_omok_queue%ROWTYPE;
  v_other public.pm_omok_queue%ROWTYPE;
  v_game_id uuid;
  v_black public.pm_omok_queue%ROWTYPE;
  v_white public.pm_omok_queue%ROWTYPE;
BEGIN
  DELETE FROM public.pm_pvp_rematch_block WHERE blocked_until < now();

  UPDATE public.pm_omok_queue
  SET status = 'cancelled', updated_at = now()
  WHERE status = 'waiting'
    AND updated_at < now() - interval '2 minutes';

  SELECT * INTO v_me FROM public.pm_omok_queue WHERE id = p_queue_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF v_me.status <> 'waiting' THEN
    RETURN v_me.game_id;
  END IF;

  IF v_me.scope = 'class' THEN
    SELECT * INTO v_other
    FROM public.pm_omok_queue q
    WHERE q.status = 'waiting'
      AND q.id <> v_me.id
      AND q.scope = 'class'
      AND q.class_id IS NOT NULL
      AND q.class_id = v_me.class_id
      AND q.player_key <> v_me.player_key
      AND q.updated_at > now() - interval '15 seconds'
      AND NOT EXISTS (
        SELECT 1 FROM public.pm_pvp_rematch_block b
        WHERE b.game_key = 'omok'
          AND b.player_key = v_me.player_key
          AND b.opponent_key = q.player_key
          AND b.blocked_until > now()
      )
    ORDER BY q.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1;
  ELSE
    SELECT * INTO v_other
    FROM public.pm_omok_queue q
    WHERE q.status = 'waiting'
      AND q.id <> v_me.id
      AND q.scope = 'global'
      AND q.player_key <> v_me.player_key
      AND q.updated_at > now() - interval '15 seconds'
      AND NOT EXISTS (
        SELECT 1 FROM public.pm_pvp_rematch_block b
        WHERE b.game_key = 'omok'
          AND b.player_key = v_me.player_key
          AND b.opponent_key = q.player_key
          AND b.blocked_until > now()
      )
    ORDER BY q.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_me.created_at <= v_other.created_at THEN
    v_black := v_me;
    v_white := v_other;
  ELSE
    v_black := v_other;
    v_white := v_me;
  END IF;

  INSERT INTO public.pm_omok_games (
    scope, black_key, white_key, black_name, white_name,
    black_student_id, white_student_id, turn_deadline
  )
  VALUES (
    v_me.scope,
    v_black.player_key,
    v_white.player_key,
    v_black.display_name,
    v_white.display_name,
    v_black.student_id,
    v_white.student_id,
    now() + interval '40 seconds'
  )
  RETURNING id INTO v_game_id;

  UPDATE public.pm_omok_queue
  SET status = 'matched', game_id = v_game_id, updated_at = now()
  WHERE id IN (v_me.id, v_other.id);

  RETURN v_game_id;
END;
$$;

