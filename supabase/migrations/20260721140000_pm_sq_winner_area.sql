-- pm_sq: winner square area + axis-aligned scoring (200/300)

ALTER TABLE public.pm_sq_games
  ADD COLUMN IF NOT EXISTS winner_area int,
  ADD COLUMN IF NOT EXISTS winner_axis_aligned boolean;

CREATE OR REPLACE FUNCTION public.pm_sq_score_for_win(p_axis_aligned boolean)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN COALESCE(p_axis_aligned, false) THEN 200 ELSE 300 END;
$$;

DROP FUNCTION IF EXISTS public.pm_sq_poll(text, text, uuid);
DROP FUNCTION IF EXISTS public.pm_sq_apply_move(text, text, uuid, int, int, jsonb, text, text, int);
DROP FUNCTION IF EXISTS public.pm_sq_timeout_apply_move(text, text, uuid, int, int, jsonb, text, text, int);
DROP FUNCTION IF EXISTS public.pm_sq_apply_rating(text, text);

CREATE OR REPLACE FUNCTION public.pm_sq_apply_move(
  p_session_token text,
  p_guest_id text,
  p_game_id uuid,
  p_x int,
  p_y int,
  p_board jsonb,
  p_next_turn text,
  p_status text,
  p_move_count int,
  p_winner_area int DEFAULT NULL,
  p_winner_axis_aligned boolean DEFAULT NULL
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
  v_g public.pm_sq_games%ROWTYPE;
  v_stone text;
  v_cell text;
BEGIN
  SELECT r.o_player_key INTO v_key
  FROM public.pm_sq_resolve_identity(p_session_token, p_guest_id) r;
  IF v_key IS NULL THEN ok := false; error_code := 'identity'; RETURN NEXT; RETURN; END IF;

  SELECT * INTO v_g FROM public.pm_sq_games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND THEN ok := false; error_code := 'not_found'; RETURN NEXT; RETURN; END IF;

  IF v_g.game_phase <> 'playing' OR v_g.status <> 'playing' THEN
    ok := false; error_code := 'game_over';
    game_id := v_g.id; board := v_g.board; turn := v_g.turn; status := v_g.status;
    last_x := v_g.last_x; last_y := v_g.last_y; move_count := v_g.move_count;
    turn_deadline := v_g.turn_deadline;
    RETURN NEXT; RETURN;
  END IF;

  IF v_g.black_key = v_key THEN v_stone := 'black';
  ELSIF v_g.white_key = v_key THEN v_stone := 'white';
  ELSE ok := false; error_code := 'not_player'; RETURN NEXT; RETURN;
  END IF;

  IF v_g.turn <> v_stone THEN
    ok := false; error_code := 'not_your_turn';
    game_id := v_g.id; board := v_g.board; turn := v_g.turn; status := v_g.status;
    last_x := v_g.last_x; last_y := v_g.last_y; move_count := v_g.move_count;
    turn_deadline := v_g.turn_deadline;
    RETURN NEXT; RETURN;
  END IF;

  v_cell := v_g.board ->> (p_x::text || ',' || p_y::text);
  IF v_cell IS NOT NULL THEN ok := false; error_code := 'occupied'; RETURN NEXT; RETURN; END IF;

  IF p_status NOT IN ('playing', 'black_win', 'white_win', 'draw') THEN
    ok := false; error_code := 'bad_status'; RETURN NEXT; RETURN;
  END IF;
  IF p_next_turn NOT IN ('black', 'white') THEN
    ok := false; error_code := 'bad_turn'; RETURN NEXT; RETURN;
  END IF;

  UPDATE public.pm_sq_games g
  SET board = p_board,
      turn = CASE WHEN p_status = 'playing' THEN p_next_turn ELSE g.turn END,
      status = p_status,
      last_x = p_x,
      last_y = p_y,
      move_count = p_move_count,
      winner_area = CASE
        WHEN p_status IN ('black_win', 'white_win') THEN p_winner_area
        ELSE g.winner_area
      END,
      winner_axis_aligned = CASE
        WHEN p_status IN ('black_win', 'white_win') THEN p_winner_axis_aligned
        ELSE g.winner_axis_aligned
      END,
      turn_deadline = CASE
        WHEN p_status = 'playing' THEN now() + interval '20 seconds'
        ELSE NULL
      END,
      updated_at = now()
  WHERE g.id = p_game_id
  RETURNING * INTO v_g;

  ok := true; error_code := NULL;
  game_id := v_g.id; board := v_g.board; turn := v_g.turn; status := v_g.status;
  last_x := v_g.last_x; last_y := v_g.last_y; move_count := v_g.move_count;
  turn_deadline := v_g.turn_deadline;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_sq_timeout_apply_move(
  p_session_token text,
  p_guest_id text,
  p_game_id uuid,
  p_x int,
  p_y int,
  p_board jsonb,
  p_next_turn text,
  p_status text,
  p_move_count int,
  p_winner_area int DEFAULT NULL,
  p_winner_axis_aligned boolean DEFAULT NULL
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
  v_g public.pm_sq_games%ROWTYPE;
  v_cell text;
BEGIN
  SELECT r.o_player_key INTO v_key
  FROM public.pm_sq_resolve_identity(p_session_token, p_guest_id) r;
  IF v_key IS NULL THEN ok := false; error_code := 'identity'; RETURN NEXT; RETURN; END IF;

  SELECT * INTO v_g FROM public.pm_sq_games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND THEN ok := false; error_code := 'not_found'; RETURN NEXT; RETURN; END IF;

  IF v_g.black_key <> v_key AND v_g.white_key <> v_key THEN
    ok := false; error_code := 'not_player'; RETURN NEXT; RETURN;
  END IF;

  IF v_g.game_phase <> 'playing' OR v_g.status <> 'playing' THEN
    ok := false; error_code := 'game_over';
    game_id := v_g.id; board := v_g.board; turn := v_g.turn; status := v_g.status;
    last_x := v_g.last_x; last_y := v_g.last_y; move_count := v_g.move_count;
    turn_deadline := v_g.turn_deadline;
    RETURN NEXT; RETURN;
  END IF;

  IF v_g.turn_deadline IS NULL OR now() < v_g.turn_deadline THEN
    ok := false; error_code := 'not_expired';
    game_id := v_g.id; board := v_g.board; turn := v_g.turn; status := v_g.status;
    last_x := v_g.last_x; last_y := v_g.last_y; move_count := v_g.move_count;
    turn_deadline := v_g.turn_deadline;
    RETURN NEXT; RETURN;
  END IF;

  v_cell := v_g.board ->> (p_x::text || ',' || p_y::text);
  IF v_cell IS NOT NULL THEN ok := false; error_code := 'occupied'; RETURN NEXT; RETURN; END IF;

  IF p_status NOT IN ('playing', 'black_win', 'white_win', 'draw') THEN
    ok := false; error_code := 'bad_status'; RETURN NEXT; RETURN;
  END IF;
  IF p_next_turn NOT IN ('black', 'white') THEN
    ok := false; error_code := 'bad_turn'; RETURN NEXT; RETURN;
  END IF;

  UPDATE public.pm_sq_games g
  SET board = p_board,
      turn = CASE WHEN p_status = 'playing' THEN p_next_turn ELSE g.turn END,
      status = p_status,
      last_x = p_x,
      last_y = p_y,
      move_count = p_move_count,
      winner_area = CASE
        WHEN p_status IN ('black_win', 'white_win') THEN p_winner_area
        ELSE g.winner_area
      END,
      winner_axis_aligned = CASE
        WHEN p_status IN ('black_win', 'white_win') THEN p_winner_axis_aligned
        ELSE g.winner_axis_aligned
      END,
      turn_deadline = CASE
        WHEN p_status = 'playing' THEN now() + interval '20 seconds'
        ELSE NULL
      END,
      updated_at = now()
  WHERE g.id = p_game_id
  RETURNING * INTO v_g;

  ok := true; error_code := NULL;
  game_id := v_g.id; board := v_g.board; turn := v_g.turn; status := v_g.status;
  last_x := v_g.last_x; last_y := v_g.last_y; move_count := v_g.move_count;
  turn_deadline := v_g.turn_deadline;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_sq_poll(
  p_session_token text,
  p_guest_id text,
  p_game_id uuid DEFAULT NULL
)
RETURNS TABLE (
  phase text,
  queue_id uuid,
  queue_scope text,
  queue_status text,
  game_id uuid,
  game_status text,
  game_phase text,
  scope text,
  board jsonb,
  turn text,
  black_key text,
  white_key text,
  black_name text,
  white_name text,
  my_key text,
  my_stone text,
  last_x int,
  last_y int,
  move_count int,
  my_score int,
  winner_area int,
  winner_axis_aligned boolean,
  opponent_name text,
  turn_deadline timestamptz,
  rps_winner_key text,
  shape_black text,
  shape_white text,
  my_rps_choice text,
  opponent_rps_choice text,
  shape_picker_role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key text;
  v_q public.pm_sq_queue%ROWTYPE;
  v_g public.pm_sq_games%ROWTYPE;
  v_gid uuid := p_game_id;
  v_stone text;
  v_score int := NULL;
  v_opp text;
  v_has_queue boolean := false;
  v_loser_key text;
  v_poll_phase text;
  v_picker text := NULL;
  v_win_score int;
BEGIN
  SELECT r.o_player_key INTO v_key
  FROM public.pm_sq_resolve_identity(p_session_token, p_guest_id) r;
  IF v_key IS NULL THEN RAISE EXCEPTION 'identity required'; END IF;

  SELECT * INTO v_q
  FROM public.pm_sq_queue q
  WHERE q.player_key = v_key
    AND q.status IN ('waiting', 'matched')
  ORDER BY q.created_at DESC
  LIMIT 1;
  v_has_queue := FOUND;

  IF v_has_queue THEN
    IF v_q.status = 'waiting' THEN
      UPDATE public.pm_sq_queue SET updated_at = now() WHERE id = v_q.id;
      PERFORM public.pm_sq_try_match(v_q.id);
      SELECT * INTO v_q FROM public.pm_sq_queue WHERE id = v_q.id;
    END IF;
    IF v_gid IS NULL THEN v_gid := v_q.game_id; END IF;
  END IF;

  IF v_gid IS NULL THEN
    SELECT g.id INTO v_gid
    FROM public.pm_sq_games g
    WHERE g.status = 'playing'
      AND (g.black_key = v_key OR g.white_key = v_key)
    ORDER BY g.updated_at DESC
    LIMIT 1;
  END IF;

  IF v_gid IS NOT NULL THEN
    SELECT * INTO v_g FROM public.pm_sq_games WHERE id = v_gid;
    IF FOUND AND (v_g.black_key = v_key OR v_g.white_key = v_key) THEN
      v_stone := CASE WHEN v_g.black_key = v_key THEN 'black' ELSE 'white' END;
      v_opp := CASE WHEN v_g.black_key = v_key THEN v_g.white_name ELSE v_g.black_name END;
      v_loser_key := v_g.black_key;
      v_win_score := public.pm_sq_score_for_win(v_g.winner_axis_aligned);

      IF v_g.status = 'black_win' THEN
        v_score := CASE WHEN v_stone = 'black' THEN v_win_score ELSE 100 END;
      ELSIF v_g.status = 'white_win' THEN
        v_score := CASE WHEN v_stone = 'white' THEN v_win_score ELSE 100 END;
      ELSIF v_g.status = 'draw' THEN
        v_score := 150;
      END IF;

      IF v_g.status <> 'playing' THEN
        v_poll_phase := 'ended';
      ELSIF v_g.game_phase = 'rps' THEN
        v_poll_phase := 'rps';
      ELSE
        v_poll_phase := 'playing';
      END IF;

      phase := v_poll_phase;
      queue_id := CASE WHEN v_has_queue THEN v_q.id ELSE NULL END;
      queue_scope := CASE WHEN v_has_queue THEN v_q.scope ELSE NULL END;
      queue_status := CASE WHEN v_has_queue THEN v_q.status ELSE NULL END;
      game_id := v_g.id;
      game_status := v_g.status;
      game_phase := v_g.game_phase;
      scope := v_g.scope;
      board := COALESCE(v_g.board, '{}'::jsonb);
      turn := v_g.turn;
      black_key := v_g.black_key;
      white_key := v_g.white_key;
      black_name := v_g.black_name;
      white_name := v_g.white_name;
      my_key := v_key;
      my_stone := CASE WHEN v_g.game_phase = 'playing' THEN v_stone ELSE NULL END;
      last_x := v_g.last_x;
      last_y := v_g.last_y;
      move_count := v_g.move_count;
      my_score := v_score;
      winner_area := v_g.winner_area;
      winner_axis_aligned := v_g.winner_axis_aligned;
      opponent_name := v_opp;
      turn_deadline := v_g.turn_deadline;
      rps_winner_key := v_g.rps_winner_key;
      shape_black := v_g.shape_black;
      shape_white := v_g.shape_white;
      my_rps_choice := CASE
        WHEN v_key = v_g.black_key THEN v_g.rps_black
        WHEN v_key = v_g.white_key THEN v_g.rps_white
        ELSE NULL
      END;
      opponent_rps_choice := CASE
        WHEN v_key = v_g.black_key THEN v_g.rps_white
        WHEN v_key = v_g.white_key THEN v_g.rps_black
        ELSE NULL
      END;
      shape_picker_role := v_picker;
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  IF v_has_queue AND v_q.status = 'waiting' THEN
    phase := 'waiting';
    queue_id := v_q.id;
    queue_scope := v_q.scope;
    queue_status := v_q.status;
    game_id := NULL;
    game_status := NULL;
    game_phase := NULL;
    scope := v_q.scope;
    board := NULL;
    turn := NULL;
    black_key := NULL;
    white_key := NULL;
    black_name := NULL;
    white_name := NULL;
    my_key := v_key;
    my_stone := NULL;
    last_x := NULL;
    last_y := NULL;
    move_count := 0;
    my_score := NULL;
    winner_area := NULL;
    winner_axis_aligned := NULL;
    opponent_name := NULL;
    turn_deadline := NULL;
    rps_winner_key := NULL;
    shape_black := NULL;
    shape_white := NULL;
    my_rps_choice := NULL;
    opponent_rps_choice := NULL;
    shape_picker_role := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  phase := 'idle';
  my_key := v_key;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_sq_claim_result(
  p_session_token text,
  p_guest_id text,
  p_game_id uuid
)
RETURNS TABLE (
  ok boolean,
  my_score int,
  outcome text,
  already_claimed boolean,
  game_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key text;
  v_g public.pm_sq_games%ROWTYPE;
  v_stone text;
  v_claimed boolean;
  v_win_score int;
BEGIN
  SELECT r.o_player_key INTO v_key
  FROM public.pm_sq_resolve_identity(p_session_token, p_guest_id) r;
  IF v_key IS NULL THEN ok := false; RETURN NEXT; RETURN; END IF;

  SELECT * INTO v_g FROM public.pm_sq_games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND OR (v_g.black_key <> v_key AND v_g.white_key <> v_key) THEN
    ok := false; RETURN NEXT; RETURN;
  END IF;

  IF v_g.status = 'playing' THEN
    ok := false; game_status := v_g.status; RETURN NEXT; RETURN;
  END IF;

  v_stone := CASE WHEN v_g.black_key = v_key THEN 'black' ELSE 'white' END;
  v_claimed := CASE WHEN v_stone = 'black' THEN v_g.claimed_black ELSE v_g.claimed_white END;
  v_win_score := public.pm_sq_score_for_win(v_g.winner_axis_aligned);

  IF v_g.status = 'black_win' THEN
    outcome := CASE WHEN v_stone = 'black' THEN 'win' ELSE 'loss' END;
  ELSIF v_g.status = 'white_win' THEN
    outcome := CASE WHEN v_stone = 'white' THEN 'win' ELSE 'loss' END;
  ELSE
    outcome := 'draw';
  END IF;

  my_score := CASE outcome
    WHEN 'win' THEN v_win_score
    WHEN 'loss' THEN 100
    ELSE 150
  END;

  IF v_stone = 'black' THEN
    UPDATE public.pm_sq_games SET claimed_black = true WHERE id = p_game_id;
  ELSE
    UPDATE public.pm_sq_games SET claimed_white = true WHERE id = p_game_id;
  END IF;

  ok := true;
  already_claimed := v_claimed;
  game_status := v_g.status;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_sq_apply_rating(
  p_session_token text,
  p_outcome text,
  p_run_score int DEFAULT NULL
)
RETURNS TABLE (
  recorded boolean,
  practice_only boolean,
  outcome text,
  delta int,
  total_before int,
  total_after int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_student uuid := public.pm_student_id_from_session(p_session_token);
  v_row public.pm_students%ROWTYPE;
  v_before int := 0;
  v_delta int;
  v_after int;
  v_active boolean;
BEGIN
  IF v_student IS NULL THEN RAISE EXCEPTION 'invalid session'; END IF;
  IF p_outcome NOT IN ('win', 'loss', 'draw') THEN RAISE EXCEPTION 'bad outcome'; END IF;

  SELECT * INTO v_row FROM public.pm_students WHERE id = v_student FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'student not found'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.pm_class_contents cc
    WHERE cc.class_id = v_row.class_id
      AND cc.content_key = 'g3-u1-square-maker'
      AND cc.is_active = true
  ) INTO v_active;

  SELECT r.total_score INTO v_before FROM public.pm_sq_ratings r WHERE r.student_id = v_student;
  IF NOT FOUND THEN v_before := 0; END IF;

  v_delta := COALESCE(
    p_run_score,
    public.pm_sq_delta_for_outcome(v_before, p_outcome)
  );
  v_after := GREATEST(0, v_before + v_delta);

  IF NOT v_active THEN
    recorded := false; practice_only := true; outcome := p_outcome;
    delta := v_delta; total_before := v_before; total_after := v_before;
    RETURN NEXT; RETURN;
  END IF;

  INSERT INTO public.pm_sq_ratings (student_id, total_score, games_played, updated_at)
  VALUES (v_student, v_after, 1, now())
  ON CONFLICT (student_id) DO UPDATE
  SET total_score = v_after,
      games_played = public.pm_sq_ratings.games_played + 1,
      updated_at = now();

  recorded := true; practice_only := false; outcome := p_outcome;
  delta := v_delta; total_before := v_before; total_after := v_after;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pm_sq_score_for_win(boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_sq_apply_move(text, text, uuid, int, int, jsonb, text, text, int, int, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_sq_timeout_apply_move(text, text, uuid, int, int, jsonb, text, text, int, int, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_sq_poll(text, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_sq_apply_rating(text, text, int) TO anon, authenticated;
