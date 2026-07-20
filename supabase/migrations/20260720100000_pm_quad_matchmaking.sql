-- pm_quad: quadrilateral-maker matchmaking + games + ratings (pimath only)

CREATE TABLE IF NOT EXISTS public.pm_quad_queue (
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
  CONSTRAINT pm_quad_queue_player_key_nonempty CHECK (length(trim(player_key)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS pm_quad_queue_one_waiting
  ON public.pm_quad_queue (player_key)
  WHERE status = 'waiting';

CREATE INDEX IF NOT EXISTS pm_quad_queue_match_idx
  ON public.pm_quad_queue (scope, class_id, status, created_at)
  WHERE status = 'waiting';

CREATE TABLE IF NOT EXISTS public.pm_quad_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('class', 'global', 'ai')),
  black_key text NOT NULL,
  white_key text NOT NULL,
  black_name text NOT NULL DEFAULT '흑',
  white_name text NOT NULL DEFAULT '백',
  black_student_id uuid REFERENCES public.pm_students(id) ON DELETE SET NULL,
  white_student_id uuid REFERENCES public.pm_students(id) ON DELETE SET NULL,
  board jsonb NOT NULL DEFAULT '{}'::jsonb,
  turn text CHECK (turn IN ('black', 'white')),
  status text NOT NULL DEFAULT 'playing'
    CHECK (status IN ('playing', 'black_win', 'white_win', 'draw')),
  game_phase text NOT NULL DEFAULT 'rps'
    CHECK (game_phase IN ('rps', 'shape_winner', 'shape_loser', 'playing')),
  rps_black text CHECK (rps_black IN ('rock', 'paper', 'scissors')),
  rps_white text CHECK (rps_white IN ('rock', 'paper', 'scissors')),
  rps_winner_key text,
  shape_black text CHECK (shape_black IN ('parallelogram', 'rectangle', 'rhombus', 'square')),
  shape_white text CHECK (shape_white IN ('parallelogram', 'rectangle', 'rhombus', 'square')),
  last_x int,
  last_y int,
  move_count int NOT NULL DEFAULT 0,
  claimed_black boolean NOT NULL DEFAULT false,
  claimed_white boolean NOT NULL DEFAULT false,
  turn_deadline timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pm_quad_games_active_idx
  ON public.pm_quad_games (status, updated_at)
  WHERE status = 'playing';

CREATE TABLE IF NOT EXISTS public.pm_quad_ratings (
  student_id uuid PRIMARY KEY REFERENCES public.pm_students(id) ON DELETE CASCADE,
  total_score int NOT NULL DEFAULT 0 CHECK (total_score >= 0),
  games_played int NOT NULL DEFAULT 0 CHECK (games_played >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pm_quad_ratings_score_idx
  ON public.pm_quad_ratings (total_score DESC);

DO $$ BEGIN
  ALTER TABLE public.pm_quad_queue
    ADD CONSTRAINT pm_quad_queue_game_fk
    FOREIGN KEY (game_id) REFERENCES public.pm_quad_games(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.pm_quad_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_quad_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_quad_ratings ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pm_quad_resolve_identity(
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

-- RPS: a beats b?
CREATE OR REPLACE FUNCTION public.pm_quad_rps_beats(p_a text, p_b text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_a = p_b THEN false
    WHEN p_a = 'rock' AND p_b = 'scissors' THEN true
    WHEN p_a = 'paper' AND p_b = 'rock' THEN true
    WHEN p_a = 'scissors' AND p_b = 'paper' THEN true
    ELSE false
  END;
$$;

-- ---------------------------------------------------------------------------
-- Matchmaking
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pm_quad_try_match(p_queue_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_me public.pm_quad_queue%ROWTYPE;
  v_other public.pm_quad_queue%ROWTYPE;
  v_game_id uuid;
  v_black public.pm_quad_queue%ROWTYPE;
  v_white public.pm_quad_queue%ROWTYPE;
BEGIN
  UPDATE public.pm_quad_queue
  SET status = 'cancelled', updated_at = now()
  WHERE status = 'waiting'
    AND updated_at < now() - interval '2 minutes';

  SELECT * INTO v_me FROM public.pm_quad_queue WHERE id = p_queue_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_me.status <> 'waiting' THEN RETURN v_me.game_id; END IF;

  IF v_me.scope = 'class' THEN
    SELECT * INTO v_other
    FROM public.pm_quad_queue q
    WHERE q.status = 'waiting'
      AND q.id <> v_me.id
      AND q.scope = 'class'
      AND q.class_id IS NOT NULL
      AND q.class_id = v_me.class_id
      AND q.player_key <> v_me.player_key
      AND q.updated_at > now() - interval '15 seconds'
    ORDER BY q.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1;
  ELSE
    SELECT * INTO v_other
    FROM public.pm_quad_queue q
    WHERE q.status = 'waiting'
      AND q.id <> v_me.id
      AND q.scope = 'global'
      AND q.player_key <> v_me.player_key
      AND q.updated_at > now() - interval '15 seconds'
    ORDER BY q.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN RETURN NULL; END IF;

  IF v_me.created_at <= v_other.created_at THEN
    v_black := v_me;
    v_white := v_other;
  ELSE
    v_black := v_other;
    v_white := v_me;
  END IF;

  INSERT INTO public.pm_quad_games (
    scope, black_key, white_key, black_name, white_name,
    black_student_id, white_student_id, game_phase
  )
  VALUES (
    v_me.scope,
    v_black.player_key,
    v_white.player_key,
    v_black.display_name,
    v_white.display_name,
    v_black.student_id,
    v_white.student_id,
    'rps'
  )
  RETURNING id INTO v_game_id;

  UPDATE public.pm_quad_queue
  SET status = 'matched', game_id = v_game_id, updated_at = now()
  WHERE id IN (v_me.id, v_other.id);

  RETURN v_game_id;
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
  WHERE q.player_key = v_key AND q.status = 'waiting';

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

CREATE OR REPLACE FUNCTION public.pm_quad_expand_queue_global(
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
BEGIN
  SELECT r.o_player_key INTO v_key
  FROM public.pm_quad_resolve_identity(p_session_token, p_guest_id) r;
  IF v_key IS NULL THEN RAISE EXCEPTION 'identity required'; END IF;

  SELECT q.id INTO v_qid
  FROM public.pm_quad_queue q
  WHERE q.player_key = v_key AND q.status = 'waiting'
  ORDER BY q.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_qid IS NULL THEN
    RETURN QUERY
    SELECT j.queue_id, j.game_id, j.scope, j.status, j.player_key
    FROM public.pm_quad_join_queue(p_session_token, p_guest_id, 'global') j;
    RETURN;
  END IF;

  UPDATE public.pm_quad_queue
  SET scope = 'global', class_id = NULL, updated_at = now()
  WHERE id = v_qid;

  PERFORM public.pm_quad_try_match(v_qid);

  RETURN QUERY
  SELECT q.id, q.game_id, q.scope, q.status, q.player_key
  FROM public.pm_quad_queue q
  WHERE q.id = v_qid;
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
  WHERE player_key = v_key AND status = 'waiting';

  RETURN true;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPS + shape pick
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pm_quad_submit_rps(
  p_session_token text,
  p_guest_id text,
  p_game_id uuid,
  p_choice text
)
RETURNS TABLE (
  ok boolean,
  game_phase text,
  rps_tie boolean,
  error_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key text;
  v_g public.pm_quad_games%ROWTYPE;
  v_winner text;
  v_loser text;
  v_tmp_key text;
  v_tmp_name text;
  v_tmp_sid uuid;
BEGIN
  IF p_choice NOT IN ('rock', 'paper', 'scissors') THEN
    ok := false; error_code := 'bad_choice'; RETURN NEXT; RETURN;
  END IF;

  SELECT r.o_player_key INTO v_key
  FROM public.pm_quad_resolve_identity(p_session_token, p_guest_id) r;
  IF v_key IS NULL THEN ok := false; error_code := 'identity'; RETURN NEXT; RETURN; END IF;

  SELECT * INTO v_g FROM public.pm_quad_games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND OR (v_g.black_key <> v_key AND v_g.white_key <> v_key) THEN
    ok := false; error_code := 'not_player'; RETURN NEXT; RETURN;
  END IF;
  IF v_g.game_phase <> 'rps' OR v_g.status <> 'playing' THEN
    ok := false; error_code := 'wrong_phase'; game_phase := v_g.game_phase; RETURN NEXT; RETURN;
  END IF;

  IF v_g.black_key = v_key THEN
    UPDATE public.pm_quad_games SET rps_black = p_choice, updated_at = now() WHERE id = p_game_id;
    v_g.rps_black := p_choice;
  ELSE
    UPDATE public.pm_quad_games SET rps_white = p_choice, updated_at = now() WHERE id = p_game_id;
    v_g.rps_white := p_choice;
  END IF;

  IF v_g.rps_black IS NULL OR v_g.rps_white IS NULL THEN
    ok := true; game_phase := 'rps'; rps_tie := false; error_code := NULL;
    RETURN NEXT; RETURN;
  END IF;

  IF v_g.rps_black = v_g.rps_white THEN
    UPDATE public.pm_quad_games
    SET rps_black = NULL, rps_white = NULL, updated_at = now()
    WHERE id = p_game_id;
    ok := true; game_phase := 'rps'; rps_tie := true; error_code := NULL;
    RETURN NEXT; RETURN;
  END IF;

  IF public.pm_quad_rps_beats(v_g.rps_black, v_g.rps_white) THEN
    v_winner := v_g.black_key;
    v_loser := v_g.white_key;
  ELSE
    v_winner := v_g.white_key;
    v_loser := v_g.black_key;
  END IF;

  -- Loser = black (first move), winner = white — swap keys + rps choices together
  IF v_loser <> v_g.black_key THEN
    v_tmp_key := v_g.black_key;
    v_tmp_name := v_g.black_name;
    v_tmp_sid := v_g.black_student_id;
    UPDATE public.pm_quad_games SET
      black_key = v_g.white_key,
      white_key = v_tmp_key,
      black_name = v_g.white_name,
      white_name = v_tmp_name,
      black_student_id = v_g.white_student_id,
      white_student_id = v_tmp_sid,
      rps_black = v_g.rps_white,
      rps_white = v_g.rps_black
    WHERE id = p_game_id;
  END IF;

  UPDATE public.pm_quad_games
  SET rps_winner_key = v_winner,
      game_phase = 'shape_winner',
      updated_at = now()
  WHERE id = p_game_id;

  ok := true; game_phase := 'shape_winner'; rps_tie := false; error_code := NULL;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_quad_pick_shape(
  p_session_token text,
  p_guest_id text,
  p_game_id uuid,
  p_shape text
)
RETURNS TABLE (
  ok boolean,
  game_phase text,
  error_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key text;
  v_g public.pm_quad_games%ROWTYPE;
  v_loser_key text;
BEGIN
  IF p_shape NOT IN ('parallelogram', 'rectangle', 'rhombus', 'square') THEN
    ok := false; error_code := 'bad_shape'; RETURN NEXT; RETURN;
  END IF;

  SELECT r.o_player_key INTO v_key
  FROM public.pm_quad_resolve_identity(p_session_token, p_guest_id) r;
  IF v_key IS NULL THEN ok := false; error_code := 'identity'; RETURN NEXT; RETURN; END IF;

  SELECT * INTO v_g FROM public.pm_quad_games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND OR (v_g.black_key <> v_key AND v_g.white_key <> v_key) THEN
    ok := false; error_code := 'not_player'; RETURN NEXT; RETURN;
  END IF;

  v_loser_key := v_g.black_key;

  IF v_g.game_phase = 'shape_winner' THEN
    IF v_key <> v_g.rps_winner_key THEN
      ok := false; error_code := 'not_your_turn'; RETURN NEXT; RETURN;
    END IF;
    IF v_g.shape_white IS NOT NULL THEN
      ok := false; error_code := 'already_picked'; RETURN NEXT; RETURN;
    END IF;
    UPDATE public.pm_quad_games
    SET shape_white = p_shape, game_phase = 'shape_loser', updated_at = now()
    WHERE id = p_game_id;
    ok := true; game_phase := 'shape_loser'; error_code := NULL;
    RETURN NEXT; RETURN;
  END IF;

  IF v_g.game_phase = 'shape_loser' THEN
    IF v_key <> v_loser_key THEN
      ok := false; error_code := 'not_your_turn'; RETURN NEXT; RETURN;
    END IF;
    IF v_g.shape_black IS NOT NULL THEN
      ok := false; error_code := 'already_picked'; RETURN NEXT; RETURN;
    END IF;
    IF p_shape = v_g.shape_white THEN
      ok := false; error_code := 'shape_taken'; RETURN NEXT; RETURN;
    END IF;
    UPDATE public.pm_quad_games
    SET shape_black = p_shape,
        game_phase = 'playing',
        turn = 'black',
        turn_deadline = now() + interval '20 seconds',
        updated_at = now()
    WHERE id = p_game_id;
    ok := true; game_phase := 'playing'; error_code := NULL;
    RETURN NEXT; RETURN;
  END IF;

  ok := false; error_code := 'wrong_phase'; game_phase := v_g.game_phase;
  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- Moves
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pm_quad_apply_move(
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
  v_g public.pm_quad_games%ROWTYPE;
  v_stone text;
  v_cell text;
BEGIN
  SELECT r.o_player_key INTO v_key
  FROM public.pm_quad_resolve_identity(p_session_token, p_guest_id) r;
  IF v_key IS NULL THEN ok := false; error_code := 'identity'; RETURN NEXT; RETURN; END IF;

  SELECT * INTO v_g FROM public.pm_quad_games WHERE id = p_game_id FOR UPDATE;
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

  UPDATE public.pm_quad_games g
  SET board = p_board,
      turn = CASE WHEN p_status = 'playing' THEN p_next_turn ELSE g.turn END,
      status = p_status,
      last_x = p_x,
      last_y = p_y,
      move_count = p_move_count,
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

CREATE OR REPLACE FUNCTION public.pm_quad_timeout_apply_move(
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
  v_g public.pm_quad_games%ROWTYPE;
  v_cell text;
BEGIN
  SELECT r.o_player_key INTO v_key
  FROM public.pm_quad_resolve_identity(p_session_token, p_guest_id) r;
  IF v_key IS NULL THEN ok := false; error_code := 'identity'; RETURN NEXT; RETURN; END IF;

  SELECT * INTO v_g FROM public.pm_quad_games WHERE id = p_game_id FOR UPDATE;
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

  UPDATE public.pm_quad_games g
  SET board = p_board,
      turn = CASE WHEN p_status = 'playing' THEN p_next_turn ELSE g.turn END,
      status = p_status,
      last_x = p_x,
      last_y = p_y,
      move_count = p_move_count,
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

-- ---------------------------------------------------------------------------
-- Poll
-- ---------------------------------------------------------------------------
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
    END IF;
    IF v_gid IS NULL THEN v_gid := v_q.game_id; END IF;
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

CREATE OR REPLACE FUNCTION public.pm_quad_claim_result(
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
  v_g public.pm_quad_games%ROWTYPE;
  v_stone text;
  v_claimed boolean;
BEGIN
  SELECT r.o_player_key INTO v_key
  FROM public.pm_quad_resolve_identity(p_session_token, p_guest_id) r;
  IF v_key IS NULL THEN ok := false; RETURN NEXT; RETURN; END IF;

  SELECT * INTO v_g FROM public.pm_quad_games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND OR (v_g.black_key <> v_key AND v_g.white_key <> v_key) THEN
    ok := false; RETURN NEXT; RETURN;
  END IF;

  IF v_g.status = 'playing' THEN
    ok := false; game_status := v_g.status; RETURN NEXT; RETURN;
  END IF;

  v_stone := CASE WHEN v_g.black_key = v_key THEN 'black' ELSE 'white' END;
  v_claimed := CASE WHEN v_stone = 'black' THEN v_g.claimed_black ELSE v_g.claimed_white END;

  IF v_g.status = 'black_win' THEN
    outcome := CASE WHEN v_stone = 'black' THEN 'win' ELSE 'loss' END;
  ELSIF v_g.status = 'white_win' THEN
    outcome := CASE WHEN v_stone = 'white' THEN 'win' ELSE 'loss' END;
  ELSE
    outcome := 'draw';
  END IF;

  my_score := CASE outcome WHEN 'win' THEN 300 WHEN 'loss' THEN 100 ELSE 150 END;

  IF v_stone = 'black' THEN
    UPDATE public.pm_quad_games SET claimed_black = true WHERE id = p_game_id;
  ELSE
    UPDATE public.pm_quad_games SET claimed_white = true WHERE id = p_game_id;
  END IF;

  ok := true;
  already_claimed := v_claimed;
  game_status := v_g.status;
  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- Ratings
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pm_quad_delta_for_outcome(
  p_total int,
  p_outcome text
)
RETURNS int
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  t int := GREATEST(0, COALESCE(p_total, 0));
BEGIN
  IF p_outcome NOT IN ('win', 'loss', 'draw') THEN RAISE EXCEPTION 'bad outcome'; END IF;
  IF t >= 3000 THEN
    IF p_outcome = 'win' THEN RETURN 100; END IF;
    IF p_outcome = 'loss' THEN RETURN -100; END IF;
    RETURN 50;
  ELSIF t >= 2000 THEN
    IF p_outcome = 'win' THEN RETURN 150; END IF;
    IF p_outcome = 'loss' THEN RETURN -100; END IF;
    RETURN 50;
  ELSIF t >= 1000 THEN
    IF p_outcome = 'win' THEN RETURN 200; END IF;
    IF p_outcome = 'loss' THEN RETURN -100; END IF;
    RETURN 75;
  ELSE
    IF p_outcome = 'win' THEN RETURN 300; END IF;
    IF p_outcome = 'loss' THEN RETURN 100; END IF;
    RETURN 150;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_quad_apply_rating(
  p_session_token text,
  p_outcome text
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
      AND cc.content_key = 'g2-u3-1-quadrilateral-maker'
      AND cc.is_active = true
  ) INTO v_active;

  SELECT r.total_score INTO v_before FROM public.pm_quad_ratings r WHERE r.student_id = v_student;
  IF NOT FOUND THEN v_before := 0; END IF;

  v_delta := public.pm_quad_delta_for_outcome(v_before, p_outcome);
  v_after := GREATEST(0, v_before + v_delta);

  IF NOT v_active THEN
    recorded := false; practice_only := true; outcome := p_outcome;
    delta := v_delta; total_before := v_before; total_after := v_before;
    RETURN NEXT; RETURN;
  END IF;

  INSERT INTO public.pm_quad_ratings (student_id, total_score, games_played, updated_at)
  VALUES (v_student, v_after, 1, now())
  ON CONFLICT (student_id) DO UPDATE
  SET total_score = v_after,
      games_played = public.pm_quad_ratings.games_played + 1,
      updated_at = now();

  recorded := true; practice_only := false; outcome := p_outcome;
  delta := v_delta; total_before := v_before; total_after := v_after;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_quad_list_rating_ranking(
  p_session_token text,
  p_scope text DEFAULT 'class'
)
RETURNS TABLE (
  rank int,
  student_id uuid,
  display_name text,
  class_name text,
  score int,
  is_me boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_student uuid := public.pm_student_id_from_session(p_session_token);
  v_class uuid;
  v_teacher uuid;
  v_scope text;
BEGIN
  IF v_student IS NULL THEN RETURN; END IF;

  SELECT st.class_id, st.teacher_id INTO v_class, v_teacher
  FROM public.pm_students st WHERE st.id = v_student;

  IF v_class IS NULL OR v_teacher IS NULL THEN RETURN; END IF;

  v_scope := lower(coalesce(nullif(trim(p_scope), ''), 'class'));
  IF v_scope NOT IN ('world', 'school', 'class') THEN v_scope := 'class'; END IF;

  RETURN QUERY
  SELECT
    (row_number() OVER (ORDER BY r.total_score DESC, st.display_name ASC))::int,
    st.id,
    st.display_name,
    c.name,
    r.total_score,
    (st.id = v_student)
  FROM public.pm_quad_ratings r
  JOIN public.pm_students st ON st.id = r.student_id
  JOIN public.pm_classes c ON c.id = st.class_id
  WHERE r.total_score > 0
    AND (
      v_scope = 'world'
      OR (v_scope = 'school' AND st.teacher_id = v_teacher)
      OR (v_scope = 'class' AND st.class_id = v_class)
    )
  ORDER BY r.total_score DESC, st.display_name ASC
  LIMIT 20;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pm_quad_join_queue(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_quad_expand_queue_global(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_quad_leave_queue(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_quad_poll(text, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_quad_submit_rps(text, text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_quad_pick_shape(text, text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_quad_apply_move(text, text, uuid, int, int, jsonb, text, text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_quad_timeout_apply_move(text, text, uuid, int, int, jsonb, text, text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_quad_claim_result(text, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_quad_apply_rating(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_quad_list_rating_ranking(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_quad_delta_for_outcome(int, text) TO anon, authenticated;
