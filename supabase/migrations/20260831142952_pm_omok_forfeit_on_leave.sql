-- Omok PvP: forfeit when a player leaves the page (explicit resign + absent heartbeat).

ALTER TABLE public.pm_omok_games
  ADD COLUMN IF NOT EXISTS black_last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS white_last_seen_at timestamptz;

UPDATE public.pm_omok_games
SET
  black_last_seen_at = COALESCE(black_last_seen_at, updated_at, now()),
  white_last_seen_at = COALESCE(white_last_seen_at, updated_at, now())
WHERE status = 'playing';

CREATE OR REPLACE FUNCTION public.pm_omok_forfeit_game(
  p_session_token text,
  p_guest_id text,
  p_game_id uuid DEFAULT NULL
)
RETURNS TABLE (
  ok boolean,
  game_id uuid,
  game_status text,
  error_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key text;
  v_gid uuid := p_game_id;
  v_g public.pm_omok_games%ROWTYPE;
BEGIN
  SELECT r.o_player_key INTO v_key
  FROM public.pm_omok_resolve_identity(p_session_token, p_guest_id) r;
  IF v_key IS NULL THEN
    ok := false;
    error_code := 'identity';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_gid IS NULL THEN
    SELECT g.id INTO v_gid
    FROM public.pm_omok_games g
    WHERE g.status = 'playing'
      AND (g.black_key = v_key OR g.white_key = v_key)
    ORDER BY g.updated_at DESC
    LIMIT 1;
  END IF;

  IF v_gid IS NULL THEN
    UPDATE public.pm_omok_queue
    SET status = 'cancelled', updated_at = now()
    WHERE player_key = v_key AND status IN ('waiting', 'matched');
    ok := true;
    error_code := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT * INTO v_g
  FROM public.pm_omok_games
  WHERE id = v_gid
  FOR UPDATE;

  IF NOT FOUND OR (v_g.black_key <> v_key AND v_g.white_key <> v_key) THEN
    ok := false;
    error_code := 'not_player';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_g.status = 'playing' THEN
    UPDATE public.pm_omok_games g
    SET status = CASE
          WHEN g.black_key = v_key THEN 'white_win'
          ELSE 'black_win'
        END,
        turn_deadline = NULL,
        updated_at = now()
    WHERE g.id = v_gid
    RETURNING * INTO v_g;
  END IF;

  UPDATE public.pm_omok_queue
  SET status = 'cancelled', updated_at = now()
  WHERE player_key = v_key AND status IN ('waiting', 'matched');

  ok := true;
  error_code := NULL;
  game_id := v_g.id;
  game_status := v_g.status;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pm_omok_forfeit_game(text, text, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.pm_omok_touch_game(
  p_session_token text,
  p_guest_id text,
  p_game_id uuid
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
  IF v_key IS NULL OR p_game_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.pm_omok_games g
  SET
    black_last_seen_at = CASE WHEN g.black_key = v_key THEN now() ELSE g.black_last_seen_at END,
    white_last_seen_at = CASE WHEN g.white_key = v_key THEN now() ELSE g.white_last_seen_at END
  WHERE g.id = p_game_id
    AND g.status = 'playing'
    AND (g.black_key = v_key OR g.white_key = v_key);

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pm_omok_touch_game(text, text, uuid) TO anon, authenticated;

-- try_match: seed presence timestamps for both players.
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
    black_student_id, white_student_id, turn_deadline,
    black_last_seen_at, white_last_seen_at
  )
  VALUES (
    v_me.scope,
    v_black.player_key,
    v_white.player_key,
    v_black.display_name,
    v_white.display_name,
    v_black.student_id,
    v_white.student_id,
    now() + interval '40 seconds',
    now(),
    now()
  )
  RETURNING id INTO v_game_id;

  UPDATE public.pm_omok_queue
  SET status = 'matched', game_id = v_game_id, updated_at = now()
  WHERE id IN (v_me.id, v_other.id);

  RETURN v_game_id;
END;
$$;

-- poll: refresh presence + forfeit absent opponents (~25s without heartbeat).
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
    SELECT * INTO v_g FROM public.pm_omok_games WHERE id = v_gid FOR UPDATE;
    IF FOUND AND (v_g.black_key = v_key OR v_g.white_key = v_key) THEN
      IF v_g.status = 'playing' THEN
        UPDATE public.pm_omok_games g
        SET
          black_last_seen_at = CASE WHEN g.black_key = v_key THEN now() ELSE g.black_last_seen_at END,
          white_last_seen_at = CASE WHEN g.white_key = v_key THEN now() ELSE g.white_last_seen_at END
        WHERE g.id = v_gid
        RETURNING * INTO v_g;

        IF v_g.black_key = v_key
           AND v_g.white_last_seen_at IS NOT NULL
           AND v_g.white_last_seen_at < now() - interval '25 seconds' THEN
          UPDATE public.pm_omok_games g
          SET status = 'black_win', turn_deadline = NULL, updated_at = now()
          WHERE g.id = v_gid AND g.status = 'playing'
          RETURNING * INTO v_g;
        ELSIF v_g.white_key = v_key
           AND v_g.black_last_seen_at IS NOT NULL
           AND v_g.black_last_seen_at < now() - interval '25 seconds' THEN
          UPDATE public.pm_omok_games g
          SET status = 'white_win', turn_deadline = NULL, updated_at = now()
          WHERE g.id = v_gid AND g.status = 'playing'
          RETURNING * INTO v_g;
        END IF;
      END IF;

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
