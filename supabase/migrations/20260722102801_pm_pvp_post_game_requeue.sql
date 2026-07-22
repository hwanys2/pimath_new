-- PvP post-game requeue: clear stale matched queue rows so players leave ended games
-- and can match new opponents (global + class scopes).

-- ---------------------------------------------------------------------------
-- leave_queue: cancel waiting AND matched rows
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pm_omok_leave_queue(
  p_session_token text,
  p_guest_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key text;
BEGIN
  SELECT r.o_player_key INTO v_key
  FROM public.pm_omok_resolve_identity(p_session_token, p_guest_id) r;
  IF v_key IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.pm_omok_queue
  SET status = 'cancelled', updated_at = now()
  WHERE player_key = v_key AND status IN ('waiting', 'matched');

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_quad_leave_queue(
  p_session_token text,
  p_guest_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key text;
BEGIN
  SELECT r.o_player_key INTO v_key
  FROM public.pm_quad_resolve_identity(p_session_token, p_guest_id) r;
  IF v_key IS NULL THEN RETURN false; END IF;

  UPDATE public.pm_quad_queue
  SET status = 'cancelled', updated_at = now()
  WHERE player_key = v_key AND status IN ('waiting', 'matched');

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_sq_leave_queue(
  p_session_token text,
  p_guest_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key text;
BEGIN
  SELECT r.o_player_key INTO v_key
  FROM public.pm_sq_resolve_identity(p_session_token, p_guest_id) r;
  IF v_key IS NULL THEN RETURN false; END IF;

  UPDATE public.pm_sq_queue
  SET status = 'cancelled', updated_at = now()
  WHERE player_key = v_key AND status IN ('waiting', 'matched');

  RETURN true;
END;
$$;

-- ---------------------------------------------------------------------------
-- join_queue: cancel stale waiting AND matched rows before re-entering
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pm_omok_join_queue(
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
  v_can_class boolean := false;
BEGIN
  SELECT r.o_player_key, r.o_display_name, r.o_class_id, r.o_student_id
  INTO v_key, v_name, v_class, v_student
  FROM public.pm_omok_resolve_identity(p_session_token, p_guest_id) r;

  IF v_key IS NULL THEN
    RAISE EXCEPTION 'identity required';
  END IF;

  v_can_class := v_class IS NOT NULL AND v_student IS NOT NULL;
  v_scope := CASE
    WHEN p_scope = 'class' AND v_can_class THEN 'class'
    ELSE 'global'
  END;

  UPDATE public.pm_omok_games g
  SET status = CASE
        WHEN g.black_key = v_key THEN 'white_win'
        ELSE 'black_win'
      END,
      turn_deadline = NULL,
      updated_at = now()
  WHERE g.status = 'playing'
    AND (g.black_key = v_key OR g.white_key = v_key);

  UPDATE public.pm_omok_queue q
  SET status = 'cancelled', updated_at = now()
  WHERE q.player_key = v_key AND q.status IN ('waiting', 'matched');

  INSERT INTO public.pm_omok_queue (
    player_key, display_name, scope, class_id, student_id, guest_id, status
  )
  VALUES (
    v_key,
    v_name,
    v_scope,
    CASE WHEN v_scope = 'class' THEN v_class ELSE NULL END,
    v_student,
    CASE WHEN v_key LIKE 'guest:%' THEN trim(p_guest_id) ELSE NULL END,
    'waiting'
  )
  RETURNING id INTO v_qid;

  v_gid := public.pm_omok_try_match(v_qid);

  RETURN QUERY
  SELECT q.id, q.game_id, q.scope, q.status, q.player_key, q.display_name, q.class_id, v_can_class
  FROM public.pm_omok_queue q
  WHERE q.id = v_qid;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_quad_join_queue(
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
  v_can_class boolean := false;
BEGIN
  SELECT r.o_player_key, r.o_display_name, r.o_class_id, r.o_student_id
  INTO v_key, v_name, v_class, v_student
  FROM public.pm_quad_resolve_identity(p_session_token, p_guest_id) r;

  IF v_key IS NULL THEN RAISE EXCEPTION 'identity required'; END IF;

  v_can_class := v_class IS NOT NULL AND v_student IS NOT NULL;
  v_scope := CASE
    WHEN p_scope = 'class' AND v_can_class THEN 'class'
    ELSE 'global'
  END;

  UPDATE public.pm_quad_games g
  SET status = CASE WHEN g.black_key = v_key THEN 'white_win' ELSE 'black_win' END,
      game_phase = 'playing',
      turn_deadline = NULL,
      updated_at = now()
  WHERE g.status = 'playing'
    AND g.game_phase = 'playing'
    AND (g.black_key = v_key OR g.white_key = v_key);

  UPDATE public.pm_quad_queue q
  SET status = 'cancelled', updated_at = now()
  WHERE q.player_key = v_key AND q.status IN ('waiting', 'matched');

  INSERT INTO public.pm_quad_queue (
    player_key, display_name, scope, class_id, student_id, guest_id, status
  )
  VALUES (
    v_key, v_name, v_scope,
    CASE WHEN v_scope = 'class' THEN v_class ELSE NULL END,
    v_student,
    CASE WHEN v_key LIKE 'guest:%' THEN trim(p_guest_id) ELSE NULL END,
    'waiting'
  )
  RETURNING id INTO v_qid;

  PERFORM public.pm_quad_try_match(v_qid);

  RETURN QUERY
  SELECT q.id, q.game_id, q.scope, q.status, q.player_key, q.display_name, q.class_id, v_can_class
  FROM public.pm_quad_queue q
  WHERE q.id = v_qid;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_sq_join_queue(
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
  v_can_class boolean := false;
BEGIN
  SELECT r.o_player_key, r.o_display_name, r.o_class_id, r.o_student_id
  INTO v_key, v_name, v_class, v_student
  FROM public.pm_sq_resolve_identity(p_session_token, p_guest_id) r;

  IF v_key IS NULL THEN RAISE EXCEPTION 'identity required'; END IF;

  v_can_class := v_class IS NOT NULL AND v_student IS NOT NULL;
  v_scope := CASE
    WHEN p_scope = 'class' AND v_can_class THEN 'class'
    ELSE 'global'
  END;

  UPDATE public.pm_sq_games g
  SET status = CASE WHEN g.black_key = v_key THEN 'white_win' ELSE 'black_win' END,
      game_phase = 'playing',
      turn_deadline = NULL,
      updated_at = now()
  WHERE g.status = 'playing'
    AND g.game_phase = 'playing'
    AND (g.black_key = v_key OR g.white_key = v_key);

  UPDATE public.pm_sq_queue q
  SET status = 'cancelled', updated_at = now()
  WHERE q.player_key = v_key AND q.status IN ('waiting', 'matched');

  INSERT INTO public.pm_sq_queue (
    player_key, display_name, scope, class_id, student_id, guest_id, status
  )
  VALUES (
    v_key, v_name, v_scope,
    CASE WHEN v_scope = 'class' THEN v_class ELSE NULL END,
    v_student,
    CASE WHEN v_key LIKE 'guest:%' THEN trim(p_guest_id) ELSE NULL END,
    'waiting'
  )
  RETURNING id INTO v_qid;

  PERFORM public.pm_sq_try_match(v_qid);

  RETURN QUERY
  SELECT q.id, q.game_id, q.scope, q.status, q.player_key, q.display_name, q.class_id, v_can_class
  FROM public.pm_sq_queue q
  WHERE q.id = v_qid;
END;
$$;

-- ---------------------------------------------------------------------------
-- poll: drop stale matched rows that still point at ended games
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pm_omok_poll(
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
  opponent_name text,
  turn_deadline timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key text;
  v_q public.pm_omok_queue%ROWTYPE;
  v_g public.pm_omok_games%ROWTYPE;
  v_gid uuid := p_game_id;
  v_stone text;
  v_score int := NULL;
  v_opp text;
  v_has_queue boolean := false;
  v_linked_status text;
BEGIN
  SELECT r.o_player_key INTO v_key
  FROM public.pm_omok_resolve_identity(p_session_token, p_guest_id) r;
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'identity required';
  END IF;

  SELECT * INTO v_q
  FROM public.pm_omok_queue q
  WHERE q.player_key = v_key
    AND q.status IN ('waiting', 'matched')
  ORDER BY q.created_at DESC
  LIMIT 1;
  v_has_queue := FOUND;

  IF v_has_queue THEN
    IF v_q.status = 'waiting' THEN
      UPDATE public.pm_omok_queue
      SET updated_at = now()
      WHERE id = v_q.id;
      PERFORM public.pm_omok_try_match(v_q.id);
      SELECT * INTO v_q FROM public.pm_omok_queue WHERE id = v_q.id;
    ELSIF v_q.status = 'matched' AND v_q.game_id IS NOT NULL THEN
      SELECT g.status INTO v_linked_status
      FROM public.pm_omok_games g
      WHERE g.id = v_q.game_id;
      IF v_linked_status IS DISTINCT FROM 'playing' THEN
        UPDATE public.pm_omok_queue
        SET status = 'cancelled', updated_at = now()
        WHERE id = v_q.id;
        IF v_gid = v_q.game_id THEN
          v_gid := NULL;
        END IF;
        v_has_queue := false;
      END IF;
    END IF;
    IF v_has_queue AND v_gid IS NULL THEN
      v_gid := v_q.game_id;
    END IF;
  END IF;

  IF v_gid IS NULL THEN
    SELECT g.id INTO v_gid
    FROM public.pm_omok_games g
    WHERE g.status = 'playing'
      AND (g.black_key = v_key OR g.white_key = v_key)
    ORDER BY g.updated_at DESC
    LIMIT 1;
  END IF;

  IF v_gid IS NOT NULL THEN
    SELECT * INTO v_g FROM public.pm_omok_games WHERE id = v_gid;
    IF FOUND AND (v_g.black_key = v_key OR v_g.white_key = v_key) THEN
      v_stone := CASE WHEN v_g.black_key = v_key THEN 'black' ELSE 'white' END;
      v_opp := CASE WHEN v_g.black_key = v_key THEN v_g.white_name ELSE v_g.black_name END;

      IF v_g.status = 'black_win' THEN
        v_score := CASE WHEN v_stone = 'black' THEN 300 ELSE 100 END;
      ELSIF v_g.status = 'white_win' THEN
        v_score := CASE WHEN v_stone = 'white' THEN 300 ELSE 100 END;
      ELSIF v_g.status = 'draw' THEN
        v_score := 150;
      END IF;

      phase := CASE WHEN v_g.status = 'playing' THEN 'playing' ELSE 'ended' END;
      queue_id := CASE WHEN v_has_queue THEN v_q.id ELSE NULL END;
      queue_scope := CASE WHEN v_has_queue THEN v_q.scope ELSE NULL END;
      queue_status := CASE WHEN v_has_queue THEN v_q.status ELSE NULL END;
      game_id := v_g.id;
      game_status := v_g.status;
      scope := v_g.scope;
      board := v_g.board;
      turn := v_g.turn;
      black_key := v_g.black_key;
      white_key := v_g.white_key;
      black_name := v_g.black_name;
      white_name := v_g.white_name;
      my_key := v_key;
      my_stone := v_stone;
      last_x := v_g.last_x;
      last_y := v_g.last_y;
      move_count := v_g.move_count;
      my_score := v_score;
      opponent_name := v_opp;
      turn_deadline := v_g.turn_deadline;
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
    opponent_name := NULL;
    turn_deadline := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  phase := 'idle';
  my_key := v_key;
  turn_deadline := NULL;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_quad_poll(
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
  v_q public.pm_quad_queue%ROWTYPE;
  v_g public.pm_quad_games%ROWTYPE;
  v_gid uuid := p_game_id;
  v_stone text;
  v_score int := NULL;
  v_opp text;
  v_has_queue boolean := false;
  v_loser_key text;
  v_poll_phase text;
  v_picker text := NULL;
  v_linked_status text;
BEGIN
  SELECT r.o_player_key INTO v_key
  FROM public.pm_quad_resolve_identity(p_session_token, p_guest_id) r;
  IF v_key IS NULL THEN RAISE EXCEPTION 'identity required'; END IF;

  SELECT * INTO v_q
  FROM public.pm_quad_queue q
  WHERE q.player_key = v_key
    AND q.status IN ('waiting', 'matched')
  ORDER BY q.created_at DESC
  LIMIT 1;
  v_has_queue := FOUND;

  IF v_has_queue THEN
    IF v_q.status = 'waiting' THEN
      UPDATE public.pm_quad_queue SET updated_at = now() WHERE id = v_q.id;
      PERFORM public.pm_quad_try_match(v_q.id);
      SELECT * INTO v_q FROM public.pm_quad_queue WHERE id = v_q.id;
    ELSIF v_q.status = 'matched' AND v_q.game_id IS NOT NULL THEN
      SELECT g.status INTO v_linked_status
      FROM public.pm_quad_games g
      WHERE g.id = v_q.game_id;
      IF v_linked_status IS DISTINCT FROM 'playing' THEN
        UPDATE public.pm_quad_queue
        SET status = 'cancelled', updated_at = now()
        WHERE id = v_q.id;
        IF v_gid = v_q.game_id THEN
          v_gid := NULL;
        END IF;
        v_has_queue := false;
      END IF;
    END IF;
    IF v_has_queue AND v_gid IS NULL THEN v_gid := v_q.game_id; END IF;
  END IF;

  IF v_gid IS NULL THEN
    SELECT g.id INTO v_gid
    FROM public.pm_quad_games g
    WHERE g.status = 'playing'
      AND (g.black_key = v_key OR g.white_key = v_key)
    ORDER BY g.updated_at DESC
    LIMIT 1;
  END IF;

  IF v_gid IS NOT NULL THEN
    SELECT * INTO v_g FROM public.pm_quad_games WHERE id = v_gid;
    IF FOUND AND (v_g.black_key = v_key OR v_g.white_key = v_key) THEN
      v_stone := CASE WHEN v_g.black_key = v_key THEN 'black' ELSE 'white' END;
      v_opp := CASE WHEN v_g.black_key = v_key THEN v_g.white_name ELSE v_g.black_name END;
      v_loser_key := v_g.black_key;

      IF v_g.status = 'black_win' THEN
        v_score := CASE WHEN v_stone = 'black' THEN 300 ELSE 100 END;
      ELSIF v_g.status = 'white_win' THEN
        v_score := CASE WHEN v_stone = 'white' THEN 300 ELSE 100 END;
      ELSIF v_g.status = 'draw' THEN
        v_score := 150;
      END IF;

      IF v_g.status <> 'playing' THEN
        v_poll_phase := 'ended';
      ELSIF v_g.game_phase = 'rps' THEN
        v_poll_phase := 'rps';
      ELSIF v_g.game_phase IN ('shape_winner', 'shape_loser') THEN
        v_poll_phase := 'shape_pick';
        IF v_g.game_phase = 'shape_winner' THEN
          v_picker := CASE WHEN v_key = v_g.rps_winner_key THEN 'me' ELSE 'opponent' END;
        ELSE
          v_picker := CASE WHEN v_key = v_loser_key THEN 'me' ELSE 'opponent' END;
        END IF;
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
  v_linked_status text;
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
    ELSIF v_q.status = 'matched' AND v_q.game_id IS NOT NULL THEN
      SELECT g.status INTO v_linked_status
      FROM public.pm_sq_games g
      WHERE g.id = v_q.game_id;
      IF v_linked_status IS DISTINCT FROM 'playing' THEN
        UPDATE public.pm_sq_queue
        SET status = 'cancelled', updated_at = now()
        WHERE id = v_q.id;
        IF v_gid = v_q.game_id THEN
          v_gid := NULL;
        END IF;
        v_has_queue := false;
      END IF;
    END IF;
    IF v_has_queue AND v_gid IS NULL THEN v_gid := v_q.game_id; END IF;
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
