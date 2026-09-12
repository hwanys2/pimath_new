-- Fix PL/pgSQL RETURNS TABLE column ambiguity in alkagi queue RPCs.
-- Unqualified player_key / status / scope collide with OUT params and raise 42702,
-- which surfaces as "대기열에 들어가지 못했어요." (same class of bug as
-- 20260719154500_pm_omok_fix_ambiguity_and_matching).

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

  UPDATE public.pm_alkagi_queue q
  SET status = 'cancelled', updated_at = now()
  WHERE q.player_key = v_key AND q.status IN ('waiting', 'matched');

  INSERT INTO public.pm_alkagi_queue (
    player_key, display_name, scope, class_id, student_id, guest_id, status, updated_at
  ) VALUES (
    v_key, v_name, v_scope, v_class, v_student, p_guest_id, 'waiting', now()
  ) RETURNING id INTO v_qid;

  v_gid := public.pm_alkagi_try_match(v_qid);

  RETURN QUERY
  SELECT
    q.id,
    v_gid,
    q.scope,
    CASE WHEN v_gid IS NOT NULL THEN 'matched'::text ELSE 'waiting'::text END,
    q.player_key,
    q.display_name,
    q.class_id,
    (v_class IS NOT NULL)
  FROM public.pm_alkagi_queue q
  WHERE q.id = v_qid;
END;
$$;

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

  SELECT * INTO v_q FROM public.pm_alkagi_queue q
  WHERE q.player_key = v_key AND q.status = 'waiting'
  LIMIT 1 FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.pm_alkagi_queue q
  SET scope = 'global', updated_at = now()
  WHERE q.id = v_q.id;

  v_gid := public.pm_alkagi_try_match(v_q.id);

  RETURN QUERY
  SELECT
    v_q.id,
    v_gid,
    'global'::text,
    CASE WHEN v_gid IS NOT NULL THEN 'matched'::text ELSE 'waiting'::text END;
END;
$$;

-- Qualify poll queue lookups too (game_id / scope are OUT params).
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

  SELECT * INTO v_q FROM public.pm_alkagi_queue q
  WHERE q.player_key = v_key AND q.status IN ('waiting', 'matched')
  ORDER BY q.updated_at DESC
  LIMIT 1;

  IF FOUND THEN
    IF v_q.status = 'waiting' THEN
      UPDATE public.pm_alkagi_queue q SET updated_at = now() WHERE q.id = v_q.id;
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
      SELECT g.status INTO v_linked_status FROM public.pm_alkagi_games g WHERE g.id = v_q.game_id;
      IF v_linked_status IS DISTINCT FROM 'playing' THEN
        UPDATE public.pm_alkagi_queue q
        SET status = 'cancelled', updated_at = now()
        WHERE q.id = v_q.id;
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

  SELECT * INTO v_g FROM public.pm_alkagi_games g WHERE g.id = v_gid;
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

GRANT EXECUTE ON FUNCTION public.pm_alkagi_join_queue(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_alkagi_expand_queue_global(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pm_alkagi_poll(text, text, uuid) TO anon, authenticated;
