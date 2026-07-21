-- pm_pvp: block rematching the same opponent for 20s after a game ends

CREATE TABLE IF NOT EXISTS public.pm_pvp_rematch_block (
  game_key text NOT NULL CHECK (game_key IN ('omok', 'quad', 'sq')),
  player_key text NOT NULL,
  opponent_key text NOT NULL,
  blocked_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (game_key, player_key, opponent_key),
  CONSTRAINT pm_pvp_rematch_block_player_key_nonempty CHECK (length(trim(player_key)) > 0),
  CONSTRAINT pm_pvp_rematch_block_opponent_key_nonempty CHECK (length(trim(opponent_key)) > 0)
);

CREATE INDEX IF NOT EXISTS pm_pvp_rematch_block_active_idx
  ON public.pm_pvp_rematch_block (game_key, player_key, blocked_until);

ALTER TABLE public.pm_pvp_rematch_block ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.pm_pvp_rematch_seconds()
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 20;
$$;

CREATE OR REPLACE FUNCTION public.pm_pvp_record_rematch_block(
  p_game_key text,
  p_black_key text,
  p_white_key text,
  p_seconds int DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_seconds int := COALESCE(NULLIF(p_seconds, 0), public.pm_pvp_rematch_seconds());
  v_until timestamptz := now() + make_interval(secs => v_seconds);
BEGIN
  IF p_game_key NOT IN ('omok', 'quad', 'sq') THEN
    RAISE EXCEPTION 'bad game_key';
  END IF;
  IF p_black_key IS NULL OR p_white_key IS NULL THEN
    RETURN;
  END IF;
  IF length(trim(p_black_key)) = 0 OR length(trim(p_white_key)) = 0 THEN
    RETURN;
  END IF;
  IF p_black_key = p_white_key THEN
    RETURN;
  END IF;

  INSERT INTO public.pm_pvp_rematch_block (game_key, player_key, opponent_key, blocked_until)
  VALUES
    (p_game_key, p_black_key, p_white_key, v_until),
    (p_game_key, p_white_key, p_black_key, v_until)
  ON CONFLICT (game_key, player_key, opponent_key) DO UPDATE
  SET blocked_until = EXCLUDED.blocked_until;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_pvp_omok_games_rematch_block_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF OLD.status = 'playing'
     AND NEW.status IN ('black_win', 'white_win', 'draw') THEN
    PERFORM public.pm_pvp_record_rematch_block(
      'omok', NEW.black_key, NEW.white_key, public.pm_pvp_rematch_seconds()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_pvp_quad_games_rematch_block_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF OLD.status = 'playing'
     AND NEW.status IN ('black_win', 'white_win', 'draw') THEN
    PERFORM public.pm_pvp_record_rematch_block(
      'quad', NEW.black_key, NEW.white_key, public.pm_pvp_rematch_seconds()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_pvp_sq_games_rematch_block_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF OLD.status = 'playing'
     AND NEW.status IN ('black_win', 'white_win', 'draw') THEN
    PERFORM public.pm_pvp_record_rematch_block(
      'sq', NEW.black_key, NEW.white_key, public.pm_pvp_rematch_seconds()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pm_pvp_omok_games_rematch_block ON public.pm_omok_games;
CREATE TRIGGER pm_pvp_omok_games_rematch_block
  AFTER UPDATE OF status ON public.pm_omok_games
  FOR EACH ROW
  EXECUTE FUNCTION public.pm_pvp_omok_games_rematch_block_trg();

DROP TRIGGER IF EXISTS pm_pvp_quad_games_rematch_block ON public.pm_quad_games;
CREATE TRIGGER pm_pvp_quad_games_rematch_block
  AFTER UPDATE OF status ON public.pm_quad_games
  FOR EACH ROW
  EXECUTE FUNCTION public.pm_pvp_quad_games_rematch_block_trg();

DROP TRIGGER IF EXISTS pm_pvp_sq_games_rematch_block ON public.pm_sq_games;
CREATE TRIGGER pm_pvp_sq_games_rematch_block
  AFTER UPDATE OF status ON public.pm_sq_games
  FOR EACH ROW
  EXECUTE FUNCTION public.pm_pvp_sq_games_rematch_block_trg();

-- ---------------------------------------------------------------------------
-- try_match: skip recently-finished opponents
-- ---------------------------------------------------------------------------
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
    now() + interval '20 seconds'
  )
  RETURNING id INTO v_game_id;

  UPDATE public.pm_omok_queue
  SET status = 'matched', game_id = v_game_id, updated_at = now()
  WHERE id IN (v_me.id, v_other.id);

  RETURN v_game_id;
END;
$$;

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
  DELETE FROM public.pm_pvp_rematch_block WHERE blocked_until < now();

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
      AND NOT EXISTS (
        SELECT 1 FROM public.pm_pvp_rematch_block b
        WHERE b.game_key = 'quad'
          AND b.player_key = v_me.player_key
          AND b.opponent_key = q.player_key
          AND b.blocked_until > now()
      )
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
      AND NOT EXISTS (
        SELECT 1 FROM public.pm_pvp_rematch_block b
        WHERE b.game_key = 'quad'
          AND b.player_key = v_me.player_key
          AND b.opponent_key = q.player_key
          AND b.blocked_until > now()
      )
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

CREATE OR REPLACE FUNCTION public.pm_sq_try_match(p_queue_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_me public.pm_sq_queue%ROWTYPE;
  v_other public.pm_sq_queue%ROWTYPE;
  v_game_id uuid;
  v_black public.pm_sq_queue%ROWTYPE;
  v_white public.pm_sq_queue%ROWTYPE;
BEGIN
  DELETE FROM public.pm_pvp_rematch_block WHERE blocked_until < now();

  UPDATE public.pm_sq_queue
  SET status = 'cancelled', updated_at = now()
  WHERE status = 'waiting'
    AND updated_at < now() - interval '2 minutes';

  SELECT * INTO v_me FROM public.pm_sq_queue WHERE id = p_queue_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_me.status <> 'waiting' THEN RETURN v_me.game_id; END IF;

  IF v_me.scope = 'class' THEN
    SELECT * INTO v_other
    FROM public.pm_sq_queue q
    WHERE q.status = 'waiting'
      AND q.id <> v_me.id
      AND q.scope = 'class'
      AND q.class_id IS NOT NULL
      AND q.class_id = v_me.class_id
      AND q.player_key <> v_me.player_key
      AND q.updated_at > now() - interval '15 seconds'
      AND NOT EXISTS (
        SELECT 1 FROM public.pm_pvp_rematch_block b
        WHERE b.game_key = 'sq'
          AND b.player_key = v_me.player_key
          AND b.opponent_key = q.player_key
          AND b.blocked_until > now()
      )
    ORDER BY q.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1;
  ELSE
    SELECT * INTO v_other
    FROM public.pm_sq_queue q
    WHERE q.status = 'waiting'
      AND q.id <> v_me.id
      AND q.scope = 'global'
      AND q.player_key <> v_me.player_key
      AND q.updated_at > now() - interval '15 seconds'
      AND NOT EXISTS (
        SELECT 1 FROM public.pm_pvp_rematch_block b
        WHERE b.game_key = 'sq'
          AND b.player_key = v_me.player_key
          AND b.opponent_key = q.player_key
          AND b.blocked_until > now()
      )
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

  INSERT INTO public.pm_sq_games (
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

  UPDATE public.pm_sq_queue
  SET status = 'matched', game_id = v_game_id, updated_at = now()
  WHERE id IN (v_me.id, v_other.id);

  RETURN v_game_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pm_pvp_rematch_seconds() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_pvp_record_rematch_block(text, text, text, int) TO anon, authenticated;
