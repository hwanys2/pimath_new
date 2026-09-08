-- pm_alkagi: Linear Function Slope Alkagi matchmaking + games + ratings
-- Follows docs/pvp-matchmaking.md standard

CREATE TABLE IF NOT EXISTS public.pm_alkagi_queue (
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
  CONSTRAINT pm_alkagi_queue_player_key_nonempty CHECK (length(trim(player_key)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS pm_alkagi_queue_one_waiting
  ON public.pm_alkagi_queue (player_key)
  WHERE status = 'waiting';

CREATE INDEX IF NOT EXISTS pm_alkagi_queue_match_idx
  ON public.pm_alkagi_queue (scope, class_id, status, created_at)
  WHERE status = 'waiting';

CREATE TABLE IF NOT EXISTS public.pm_alkagi_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('class', 'global', 'ai')),
  black_key text NOT NULL,
  white_key text NOT NULL,
  black_name text NOT NULL DEFAULT '흑',
  white_name text NOT NULL DEFAULT '백',
  black_student_id uuid REFERENCES public.pm_students(id) ON DELETE SET NULL,
  white_student_id uuid REFERENCES public.pm_students(id) ON DELETE SET NULL,
  board jsonb NOT NULL DEFAULT '[]'::jsonb,
  turn text CHECK (turn IN ('black', 'white')),
  status text NOT NULL DEFAULT 'playing'
    CHECK (status IN ('playing', 'black_win', 'white_win', 'draw')),
  last_shot jsonb,
  move_count int NOT NULL DEFAULT 0,
  claimed_black boolean NOT NULL DEFAULT false,
  claimed_white boolean NOT NULL DEFAULT false,
  turn_deadline timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pm_alkagi_games_active_idx
  ON public.pm_alkagi_games (status, updated_at)
  WHERE status = 'playing';

CREATE TABLE IF NOT EXISTS public.pm_alkagi_ratings (
  student_id uuid PRIMARY KEY REFERENCES public.pm_students(id) ON DELETE CASCADE,
  total_score int NOT NULL DEFAULT 0 CHECK (total_score >= 0),
  games_played int NOT NULL DEFAULT 0 CHECK (games_played >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pm_alkagi_ratings_score_idx
  ON public.pm_alkagi_ratings (total_score DESC);

DO $$ BEGIN
  ALTER TABLE public.pm_alkagi_queue
    ADD CONSTRAINT pm_alkagi_queue_game_fk
    FOREIGN KEY (game_id) REFERENCES public.pm_alkagi_games(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.pm_alkagi_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_alkagi_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_alkagi_ratings ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pm_alkagi_resolve_identity(
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

  IF p_guest_id IS NOT NULL AND length(trim(p_guest_id)) > 0 THEN
    o_player_key := 'guest:' || trim(p_guest_id);
    o_display_name := '게스트-' || right(replace(trim(p_guest_id), '-', ''), 4);
    o_class_id := NULL;
    o_student_id := NULL;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Leave queue (clears waiting AND matched rows)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pm_alkagi_leave_queue(
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
  FROM public.pm_alkagi_resolve_identity(p_session_token, p_guest_id) r;
  IF v_key IS NULL THEN RETURN false; END IF;

  UPDATE public.pm_alkagi_queue
  SET status = 'cancelled', updated_at = now()
  WHERE player_key = v_key AND status IN ('waiting', 'matched');

  RETURN true;
END;
$$;

-- ---------------------------------------------------------------------------
-- Initial board JSON
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pm_alkagi_initial_board()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT '[
    {"id":"b0","color":"black","x":-4,"y":-5,"alive":true},
    {"id":"b1","color":"black","x":-2,"y":-6,"alive":true},
    {"id":"b2","color":"black","x":0,"y":-5,"alive":true},
    {"id":"b3","color":"black","x":2,"y":-6,"alive":true},
    {"id":"b4","color":"black","x":4,"y":-5,"alive":true},
    {"id":"w0","color":"white","x":-4,"y":5,"alive":true},
    {"id":"w1","color":"white","x":-2,"y":6,"alive":true},
    {"id":"w2","color":"white","x":0,"y":5,"alive":true},
    {"id":"w3","color":"white","x":2,"y":6,"alive":true},
    {"id":"w4","color":"white","x":4,"y":5,"alive":true}
  ]'::jsonb;
$$;

-- ---------------------------------------------------------------------------
-- Try match
-- ---------------------------------------------------------------------------
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
        AND b.expires_at > now()
        AND (
          (b.player_a_key = v_me.player_key AND b.player_b_key = q.player_key)
          OR (b.player_a_key = q.player_key AND b.player_b_key = v_me.player_key)
        )
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
    now() + interval '30 seconds',
    now(),
    now()
  ) RETURNING id INTO v_game_id;

  UPDATE public.pm_alkagi_queue
  SET status = 'matched', game_id = v_game_id, updated_at = now()
  WHERE id IN (v_me.id, v_opp.id);

  RETURN v_game_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Join queue
-- ---------------------------------------------------------------------------
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

  IF v_scope = 'class' AND v_class IS NULL THEN
    v_scope := 'global';
  END IF;

  -- Cancel existing waiting or matched rows
  UPDATE public.pm_alkagi_queue
  SET status = 'cancelled', updated_at = now()
  WHERE player_key = v_key AND status IN ('waiting', 'matched');

  INSERT INTO public.pm_alkagi_queue (
    player_key, display_name, scope, class_id, student_id, guest_id, status, updated_at
  ) VALUES (
    v_key, v_name, v_scope, v_class, v_student, p_guest_id, 'waiting', now()
  ) RETURNING id INTO v_qid;

  v_gid := public.pm_alkagi_try_match(v_qid);

  RETURN QUERY
  SELECT
    v_qid,
    v_gid,
    v_scope,
    CASE WHEN v_gid IS NOT NULL THEN 'matched' ELSE 'waiting' END,
    v_key,
    v_name,
    v_class,
    (v_class IS NOT NULL);
END;
$$;

-- ---------------------------------------------------------------------------
-- Expand queue to global
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pm_alkagi_expand_queue_global(
  p_session_token text,
  p_guest_id text
)
RETURNS TABLE (
  queue_id uuid,
  game_id uuid,
  scope text,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key text;
  v_q public.pm_alkagi_queue%ROWTYPE;
  v_gid uuid;
BEGIN
  SELECT r.o_player_key INTO v_key
  FROM public.pm_alkagi_resolve_identity(p_session_token, p_guest_id) r;
  IF v_key IS NULL THEN RAISE EXCEPTION 'cannot resolve identity'; END IF;

  SELECT * INTO v_q FROM public.pm_alkagi_queue
  WHERE player_key = v_key AND status = 'waiting'
  LIMIT 1 FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.pm_alkagi_queue
  SET scope = 'global', updated_at = now()
  WHERE id = v_q.id;

  v_gid := public.pm_alkagi_try_match(v_q.id);

  RETURN QUERY
  SELECT
    v_q.id,
    v_gid,
    'global'::text,
    CASE WHEN v_gid IS NOT NULL THEN 'matched'::text ELSE 'waiting'::text END;
END;
$$;

-- ---------------------------------------------------------------------------
-- Poll
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pm_alkagi_poll(
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
  my_color text,
  last_shot jsonb,
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
  v_student uuid;
  v_q public.pm_alkagi_queue%ROWTYPE;
  v_g public.pm_alkagi_games%ROWTYPE;
  v_gid uuid;
  v_color text;
  v_opp text;
  v_linked_status text;
BEGIN
  SELECT r.o_player_key, r.o_student_id INTO v_key, v_student
  FROM public.pm_alkagi_resolve_identity(p_session_token, p_guest_id) r;

  IF v_key IS NULL THEN
    phase := 'idle';
    RETURN NEXT;
    RETURN;
  END IF;

  v_gid := p_game_id;

  -- 1. Check queue row
  SELECT * INTO v_q FROM public.pm_alkagi_queue
  WHERE player_key = v_key AND status IN ('waiting', 'matched')
  ORDER BY updated_at DESC
  LIMIT 1;

  IF FOUND THEN
    IF v_q.status = 'waiting' THEN
      UPDATE public.pm_alkagi_queue SET updated_at = now() WHERE id = v_q.id;
      v_gid := public.pm_alkagi_try_match(v_q.id);
      IF v_gid IS NULL THEN
        phase := 'waiting';
        queue_id := v_q.id;
        queue_scope := v_q.scope;
        queue_status := 'waiting';
        my_key := v_key;
        RETURN NEXT;
        RETURN;
      END IF;
    ELSIF v_q.status = 'matched' AND v_q.game_id IS NOT NULL THEN
      -- Stale matched check
      SELECT g.status INTO v_linked_status FROM public.pm_alkagi_games g WHERE g.id = v_q.game_id;
      IF v_linked_status IS DISTINCT FROM 'playing' THEN
        UPDATE public.pm_alkagi_queue SET status = 'cancelled', updated_at = now() WHERE id = v_q.id;
        IF p_game_id IS NULL OR p_game_id = v_q.game_id THEN
          v_gid := v_q.game_id;
        END IF;
      ELSE
        v_gid := v_q.game_id;
      END IF;
    END IF;
  END IF;

  IF v_gid IS NULL THEN
    phase := 'idle';
    my_key := v_key;
    RETURN NEXT;
    RETURN;
  END IF;

  -- 2. Fetch game
  SELECT * INTO v_g FROM public.pm_alkagi_games WHERE id = v_gid;
  IF NOT FOUND THEN
    phase := 'idle';
    my_key := v_key;
    RETURN NEXT;
    RETURN;
  END IF;

  v_color := CASE WHEN v_g.black_key = v_key THEN 'black' WHEN v_g.white_key = v_key THEN 'white' ELSE NULL END;
  v_opp := CASE WHEN v_g.black_key = v_key THEN v_g.white_name ELSE v_g.black_name END;

  phase := CASE WHEN v_g.status = 'playing' THEN 'playing' ELSE 'ended' END;
  queue_id := v_q.id;
  queue_scope := v_q.scope;
  queue_status := v_q.status;
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
  my_color := v_color;
  last_shot := v_g.last_shot;
  move_count := v_g.move_count;
  opponent_name := v_opp;
  turn_deadline := v_g.turn_deadline;

  IF v_student IS NOT NULL THEN
    SELECT r.total_score INTO my_score FROM public.pm_alkagi_ratings r WHERE r.student_id = v_student;
  END IF;

  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- Place Move
-- ---------------------------------------------------------------------------
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
      turn_deadline = CASE WHEN p_new_status = 'playing' THEN now() + interval '30 seconds' ELSE NULL END,
      updated_at = now()
  WHERE id = v_g.id;

  RETURN QUERY SELECT true, NULL::text;
END;
$$;

-- ---------------------------------------------------------------------------
-- Forfeit game
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pm_alkagi_forfeit_game(
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
  v_g public.pm_alkagi_games%ROWTYPE;
BEGIN
  SELECT r.o_player_key INTO v_key
  FROM public.pm_alkagi_resolve_identity(p_session_token, p_guest_id) r;
  IF v_key IS NULL THEN RETURN false; END IF;

  SELECT * INTO v_g FROM public.pm_alkagi_games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND OR v_g.status <> 'playing' THEN RETURN false; END IF;

  IF v_g.black_key = v_key THEN
    UPDATE public.pm_alkagi_games
    SET status = 'white_win', turn = NULL, turn_deadline = NULL, updated_at = now()
    WHERE id = v_g.id;
    RETURN true;
  ELSIF v_g.white_key = v_key THEN
    UPDATE public.pm_alkagi_games
    SET status = 'black_win', turn = NULL, turn_deadline = NULL, updated_at = now()
    WHERE id = v_g.id;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- ---------------------------------------------------------------------------
-- Claim result
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pm_alkagi_claim_result(
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
  v_g public.pm_alkagi_games%ROWTYPE;
BEGIN
  SELECT r.o_player_key INTO v_key
  FROM public.pm_alkagi_resolve_identity(p_session_token, p_guest_id) r;
  IF v_key IS NULL THEN RETURN false; END IF;

  SELECT * INTO v_g FROM public.pm_alkagi_games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  IF v_g.black_key = v_key THEN
    UPDATE public.pm_alkagi_games SET claimed_black = true WHERE id = v_g.id;
    RETURN true;
  ELSIF v_g.white_key = v_key THEN
    UPDATE public.pm_alkagi_games SET claimed_white = true WHERE id = v_g.id;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- ---------------------------------------------------------------------------
-- Rematch block trigger on game end
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pm_alkagi_record_rematch_block_on_end()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF OLD.status = 'playing' AND NEW.status IN ('black_win', 'white_win', 'draw') THEN
    PERFORM public.pm_pvp_record_rematch_block(
      'alkagi',
      NEW.black_key,
      NEW.white_key,
      public.pm_pvp_rematch_seconds()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pm_alkagi_games_rematch_trg ON public.pm_alkagi_games;
CREATE TRIGGER pm_alkagi_games_rematch_trg
  AFTER UPDATE OF status ON public.pm_alkagi_games
  FOR EACH ROW
  EXECUTE FUNCTION public.pm_alkagi_record_rematch_block_on_end();

-- ---------------------------------------------------------------------------
-- Rating & XP system
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pm_alkagi_delta_for_outcome(
  p_score int,
  p_outcome text
)
RETURNS int
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_outcome = 'win' THEN
    IF p_score < 300 THEN RETURN 30;
    ELSIF p_score < 600 THEN RETURN 25;
    ELSIF p_score < 1000 THEN RETURN 20;
    ELSE RETURN 15;
    END IF;
  ELSIF p_outcome = 'loss' THEN
    IF p_score < 150 THEN RETURN -5;
    ELSIF p_score < 500 THEN RETURN -10;
    ELSE RETURN -15;
    END IF;
  ELSE
    RETURN 5;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_alkagi_apply_rating(
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
      AND cc.content_key = 'g2-u2-4-slope-alkagi'
      AND cc.is_active = true
  ) INTO v_active;

  SELECT r.total_score INTO v_before FROM public.pm_alkagi_ratings r WHERE r.student_id = v_student;
  IF NOT FOUND THEN v_before := 0; END IF;

  v_delta := public.pm_alkagi_delta_for_outcome(v_before, p_outcome);
  v_after := GREATEST(0, v_before + v_delta);

  IF NOT v_active THEN
    recorded := false; practice_only := true; outcome := p_outcome;
    delta := v_delta; total_before := v_before; total_after := v_before;
    RETURN NEXT; RETURN;
  END IF;

  INSERT INTO public.pm_alkagi_ratings (student_id, total_score, games_played, updated_at)
  VALUES (v_student, v_after, 1, now())
  ON CONFLICT (student_id) DO UPDATE
  SET total_score = v_after,
      games_played = public.pm_alkagi_ratings.games_played + 1,
      updated_at = now();

  recorded := true; practice_only := false; outcome := p_outcome;
  delta := v_delta; total_before := v_before; total_after := v_after;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_alkagi_list_rating_ranking(
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
  FROM public.pm_alkagi_ratings r
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

-- ---------------------------------------------------------------------------
-- Update teacher dashboard PvP games function to support alkagi
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pm_teacher_list_pvp_games(
  p_class_id uuid,
  p_table text
)
RETURNS TABLE (
  game_id uuid,
  student_id uuid,
  display_name text,
  opponent_name text,
  result text,
  scope text,
  played_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_teacher uuid := auth.uid();
BEGIN
  IF v_teacher IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.pm_classes c
    WHERE c.id = p_class_id AND c.teacher_id = v_teacher
  ) THEN
    RAISE EXCEPTION 'class not found';
  END IF;

  IF p_table = 'omok' THEN
    RETURN QUERY
    SELECT
      g.id AS game_id,
      st.id AS student_id,
      st.display_name,
      CASE
        WHEN g.black_student_id = st.id THEN g.white_name
        ELSE g.black_name
      END AS opponent_name,
      CASE
        WHEN g.status = 'draw' THEN 'draw'
        WHEN (g.status = 'black_win' AND g.black_student_id = st.id)
          OR (g.status = 'white_win' AND g.white_student_id = st.id) THEN 'win'
        ELSE 'loss'
      END AS result,
      g.scope,
      g.updated_at AS played_at
    FROM public.pm_omok_games g
    JOIN public.pm_students st ON st.class_id = p_class_id
      AND (g.black_student_id = st.id OR g.white_student_id = st.id)
    WHERE g.status <> 'playing'
      AND g.scope <> 'ai'
    ORDER BY g.updated_at DESC;
  ELSIF p_table = 'quad' THEN
    RETURN QUERY
    SELECT
      g.id,
      st.id,
      st.display_name,
      CASE WHEN g.black_student_id = st.id THEN g.white_name ELSE g.black_name END,
      CASE
        WHEN g.status = 'draw' THEN 'draw'
        WHEN (g.status = 'black_win' AND g.black_student_id = st.id)
          OR (g.status = 'white_win' AND g.white_student_id = st.id) THEN 'win'
        ELSE 'loss'
      END,
      g.scope,
      g.updated_at
    FROM public.pm_quad_games g
    JOIN public.pm_students st ON st.class_id = p_class_id
      AND (g.black_student_id = st.id OR g.white_student_id = st.id)
    WHERE g.status <> 'playing'
      AND g.scope <> 'ai'
    ORDER BY g.updated_at DESC;
  ELSIF p_table = 'sq' THEN
    RETURN QUERY
    SELECT
      g.id,
      st.id,
      st.display_name,
      CASE WHEN g.black_student_id = st.id THEN g.white_name ELSE g.black_name END,
      CASE
        WHEN g.status = 'draw' THEN 'draw'
        WHEN (g.status = 'black_win' AND g.black_student_id = st.id)
          OR (g.status = 'white_win' AND g.white_student_id = st.id) THEN 'win'
        ELSE 'loss'
      END,
      g.scope,
      g.updated_at
    FROM public.pm_sq_games g
    JOIN public.pm_students st ON st.class_id = p_class_id
      AND (g.black_student_id = st.id OR g.white_student_id = st.id)
    WHERE g.status <> 'playing'
      AND g.scope <> 'ai'
    ORDER BY g.updated_at DESC;
  ELSIF p_table = 'alkagi' THEN
    RETURN QUERY
    SELECT
      g.id,
      st.id,
      st.display_name,
      CASE WHEN g.black_student_id = st.id THEN g.white_name ELSE g.black_name END,
      CASE
        WHEN g.status = 'draw' THEN 'draw'
        WHEN (g.status = 'black_win' AND g.black_student_id = st.id)
          OR (g.status = 'white_win' AND g.white_student_id = st.id) THEN 'win'
        ELSE 'loss'
      END,
      g.scope,
      g.updated_at
    FROM public.pm_alkagi_games g
    JOIN public.pm_students st ON st.class_id = p_class_id
      AND (g.black_student_id = st.id OR g.white_student_id = st.id)
    WHERE g.status <> 'playing'
      AND g.scope <> 'ai'
    ORDER BY g.updated_at DESC;
  ELSE
    RAISE EXCEPTION 'unknown table';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_teacher_list_pvp_games(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_teacher_list_pvp_games(uuid, text) TO authenticated;

-- Grants
GRANT EXECUTE ON FUNCTION public.pm_alkagi_join_queue(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_alkagi_expand_queue_global(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_alkagi_leave_queue(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_alkagi_poll(text, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_alkagi_place_move(text, text, uuid, jsonb, jsonb, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_alkagi_forfeit_game(text, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_alkagi_claim_result(text, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_alkagi_apply_rating(text, text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_alkagi_list_rating_ranking(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_alkagi_delta_for_outcome(int, text) TO anon, authenticated;
