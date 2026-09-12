-- Fix alkagi try_match rematch-block schema mismatch, and allow game_key 'alkagi'.
-- try_match used non-existent columns (player_a_key / expires_at), so every join_queue
-- failed inside pm_alkagi_try_match even for a single waiter.

ALTER TABLE public.pm_pvp_rematch_block
  DROP CONSTRAINT IF EXISTS pm_pvp_rematch_block_game_key_check;

ALTER TABLE public.pm_pvp_rematch_block
  ADD CONSTRAINT pm_pvp_rematch_block_game_key_check
  CHECK (game_key = ANY (ARRAY['omok'::text, 'quad'::text, 'sq'::text, 'alkagi'::text]));

CREATE OR REPLACE FUNCTION public.pm_pvp_record_rematch_block(
  p_game_key text,
  p_black_key text,
  p_white_key text,
  p_seconds integer DEFAULT NULL
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
  IF p_game_key NOT IN ('omok', 'quad', 'sq', 'alkagi') THEN
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
