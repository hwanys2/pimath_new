-- pm_omok: ordered-pair omok matchmaking + games (pimath only)
-- Does not touch foreducator objects.

CREATE TABLE IF NOT EXISTS public.pm_omok_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_key text NOT NULL,
  display_name text NOT NULL DEFAULT '탐험가',
  scope text NOT NULL CHECK (scope IN ('class', 'global')),
  class_id uuid REFERENCES public.pm_classes(id) ON DELETE SET NULL,
  student_id uuid REFERENCES public.pm_students(id) ON DELETE SET NULL,
  guest_id text,
  status text NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'matched', 'cancelled')),
  game_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pm_omok_queue_player_key_nonempty CHECK (length(trim(player_key)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS pm_omok_queue_one_waiting
  ON public.pm_omok_queue (player_key)
  WHERE status = 'waiting';

CREATE INDEX IF NOT EXISTS pm_omok_queue_match_idx
  ON public.pm_omok_queue (scope, class_id, status, created_at)
  WHERE status = 'waiting';

CREATE TABLE IF NOT EXISTS public.pm_omok_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('class', 'global', 'ai')),
  black_key text NOT NULL,
  white_key text NOT NULL,
  black_name text NOT NULL DEFAULT '흑',
  white_name text NOT NULL DEFAULT '백',
  black_student_id uuid REFERENCES public.pm_students(id) ON DELETE SET NULL,
  white_student_id uuid REFERENCES public.pm_students(id) ON DELETE SET NULL,
  board jsonb NOT NULL DEFAULT '{}'::jsonb,
  turn text NOT NULL DEFAULT 'black' CHECK (turn IN ('black', 'white')),
  status text NOT NULL DEFAULT 'playing'
    CHECK (status IN ('playing', 'black_win', 'white_win', 'draw')),
  last_x int,
  last_y int,
  move_count int NOT NULL DEFAULT 0,
  claimed_black boolean NOT NULL DEFAULT false,
  claimed_white boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pm_omok_games_playing_idx
  ON public.pm_omok_games (status, updated_at)
  WHERE status = 'playing';

DO $$ BEGIN
  ALTER TABLE public.pm_omok_queue
    ADD CONSTRAINT pm_omok_queue_game_fk
    FOREIGN KEY (game_id) REFERENCES public.pm_omok_games(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.pm_omok_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_omok_games ENABLE ROW LEVEL SECURITY;
-- No direct table policies for anon/authenticated — access via SECURITY DEFINER RPCs only.

CREATE OR REPLACE FUNCTION public.pm_omok_player_key_from_session(p_session_token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_student uuid := public.pm_student_id_from_session(p_session_token);
BEGIN
  IF v_student IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN 'student:' || v_student::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_omok_resolve_identity(
  p_session_token text,
  p_guest_id text,
  OUT o_player_key text,
  OUT o_display_name text,
  OUT o_class_id uuid,
  OUT o_student_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_student uuid;
  v_row public.pm_students%ROWTYPE;
BEGIN
  o_player_key := NULL;
  o_display_name := NULL;
  o_class_id := NULL;
  o_student_id := NULL;

  IF p_session_token IS NOT NULL AND length(p_session_token) >= 16 THEN
    v_student := public.pm_student_id_from_session(p_session_token);
    IF v_student IS NOT NULL THEN
      SELECT * INTO v_row FROM public.pm_students WHERE id = v_student;
      IF FOUND THEN
        o_player_key := 'student:' || v_student::text;
        o_display_name := COALESCE(NULLIF(trim(v_row.display_name), ''), v_row.login_id, '학생');
        o_class_id := v_row.class_id;
        o_student_id := v_student;
        RETURN;
      END IF;
    END IF;
  END IF;

  IF p_guest_id IS NOT NULL AND length(trim(p_guest_id)) >= 8 THEN
    o_player_key := 'guest:' || trim(p_guest_id);
    o_display_name := '게스트';
    RETURN;
  END IF;
END;
$$;

-- Try to pair two waiting rows for the same scope (and class_id when scope=class).
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
    ORDER BY q.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Earlier joiner is black (first)
  IF v_me.created_at <= v_other.created_at THEN
    v_black := v_me;
    v_white := v_other;
  ELSE
    v_black := v_other;
    v_white := v_me;
  END IF;

  INSERT INTO public.pm_omok_games (
    scope, black_key, white_key, black_name, white_name,
    black_student_id, white_student_id
  )
  VALUES (
    v_me.scope,
    v_black.player_key,
    v_white.player_key,
    v_black.display_name,
    v_white.display_name,
    v_black.student_id,
    v_white.student_id
  )
  RETURNING id INTO v_game_id;

  UPDATE public.pm_omok_queue
  SET status = 'matched', game_id = v_game_id, updated_at = now()
  WHERE id IN (v_me.id, v_other.id);

  RETURN v_game_id;
END;
$$;

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

  -- Cancel any previous waiting entries for this player
  UPDATE public.pm_omok_queue q
  SET status = 'cancelled', updated_at = now()
  WHERE q.player_key = v_key AND q.status = 'waiting';

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

CREATE OR REPLACE FUNCTION public.pm_omok_expand_queue_global(
  p_session_token text,
  p_guest_id text
)
RETURNS TABLE (
  queue_id uuid,
  game_id uuid,
  scope text,
  status text,
  player_key text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key text;
  v_qid uuid;
  v_gid uuid;
BEGIN
  SELECT r.o_player_key INTO v_key
  FROM public.pm_omok_resolve_identity(p_session_token, p_guest_id) r;

  IF v_key IS NULL THEN
    RAISE EXCEPTION 'identity required';
  END IF;

  SELECT q.id INTO v_qid
  FROM public.pm_omok_queue q
  WHERE q.player_key = v_key AND q.status = 'waiting'
  ORDER BY q.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_qid IS NULL THEN
    -- Re-join as global
    RETURN QUERY
    SELECT j.queue_id, j.game_id, j.scope, j.status, j.player_key
    FROM public.pm_omok_join_queue(p_session_token, p_guest_id, 'global') j;
    RETURN;
  END IF;

  UPDATE public.pm_omok_queue
  SET scope = 'global', class_id = NULL, updated_at = now()
  WHERE id = v_qid;

  v_gid := public.pm_omok_try_match(v_qid);

  RETURN QUERY
  SELECT q.id, q.game_id, q.scope, q.status, q.player_key
  FROM public.pm_omok_queue q
  WHERE q.id = v_qid;
END;
$$;

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
  WHERE player_key = v_key AND status = 'waiting';

  RETURN true;
END;
$$;

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
  opponent_name text
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
      PERFORM public.pm_omok_try_match(v_q.id);
      SELECT * INTO v_q FROM public.pm_omok_queue WHERE id = v_q.id;
    END IF;
    IF v_gid IS NULL THEN
      v_gid := v_q.game_id;
    END IF;
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
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  -- Still waiting
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
    RETURN NEXT;
    RETURN;
  END IF;

  phase := 'idle';
  my_key := v_key;
  RETURN NEXT;
END;
$$;

-- Apply a move already validated by the app server (board + outcome).
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
  error_code text
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
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_omok_claim_result(
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
  v_g public.pm_omok_games%ROWTYPE;
  v_stone text;
  v_claimed boolean;
BEGIN
  SELECT r.o_player_key INTO v_key
  FROM public.pm_omok_resolve_identity(p_session_token, p_guest_id) r;
  IF v_key IS NULL THEN
    ok := false;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT * INTO v_g FROM public.pm_omok_games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND OR (v_g.black_key <> v_key AND v_g.white_key <> v_key) THEN
    ok := false;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_g.status = 'playing' THEN
    ok := false;
    game_status := v_g.status;
    RETURN NEXT;
    RETURN;
  END IF;

  v_stone := CASE WHEN v_g.black_key = v_key THEN 'black' ELSE 'white' END;
  v_claimed := CASE WHEN v_stone = 'black' THEN v_g.claimed_black ELSE v_g.claimed_white END;

  IF v_g.status = 'black_win' THEN
    my_score := CASE WHEN v_stone = 'black' THEN 300 ELSE 100 END;
    outcome := CASE WHEN v_stone = 'black' THEN 'win' ELSE 'loss' END;
  ELSIF v_g.status = 'white_win' THEN
    my_score := CASE WHEN v_stone = 'white' THEN 300 ELSE 100 END;
    outcome := CASE WHEN v_stone = 'white' THEN 'win' ELSE 'loss' END;
  ELSE
    my_score := 150;
    outcome := 'draw';
  END IF;

  IF v_stone = 'black' THEN
    UPDATE public.pm_omok_games SET claimed_black = true WHERE id = p_game_id;
  ELSE
    UPDATE public.pm_omok_games SET claimed_white = true WHERE id = p_game_id;
  END IF;

  ok := true;
  already_claimed := v_claimed;
  game_status := v_g.status;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pm_omok_join_queue(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_omok_expand_queue_global(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_omok_leave_queue(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_omok_poll(text, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_omok_apply_move(text, text, uuid, int, int, jsonb, text, text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_omok_claim_result(text, text, uuid) TO anon, authenticated;
