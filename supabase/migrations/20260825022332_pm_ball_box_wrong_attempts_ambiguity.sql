-- Fix PL/pgSQL ambiguity: RETURNS TABLE (... wrong_attempts ...) OUT param
-- shadowed the column in SET wrong_attempts = wrong_attempts + 1, so wrong
-- guesses did not increment the column.
-- Only CREATE OR REPLACE pm_ball_box_guess / pm_ball_box_guest_guess.
-- Apply to shared DB only after explicit human confirmation.

-- ---------------------------------------------------------------------------
-- Guest guess (no XP)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_ball_box_guest_guess(
  p_guest_key text,
  p_session_id uuid,
  p_guess jsonb
)
RETURNS TABLE (
  correct boolean,
  score int,
  already_solved boolean,
  draw_count int,
  wrong_attempts int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_sess public.pm_ball_box_sessions%ROWTYPE;
  v_player public.pm_ball_box_players%ROWTYPE;
  v_key text;
  v_expected int;
  v_guessed int;
  v_correct boolean := true;
  v_score int;
BEGIN
  IF p_guess IS NULL OR jsonb_typeof(p_guess) <> 'object' THEN
    RAISE EXCEPTION 'invalid guess';
  END IF;

  SELECT * INTO v_sess
  FROM public.pm_ball_box_sessions s
  WHERE s.id = p_session_id;

  IF NOT FOUND OR v_sess.phase <> 'playing' THEN
    RAISE EXCEPTION 'cannot guess now';
  END IF;

  SELECT * INTO v_player
  FROM public.pm_ball_box_players p
  WHERE p.session_id = p_session_id AND p.guest_key = trim(p_guest_key)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not in session';
  END IF;

  IF v_player.solved THEN
    correct := true;
    score := v_player.score;
    already_solved := true;
    draw_count := v_player.draw_count;
    wrong_attempts := v_player.wrong_attempts;
    RETURN NEXT;
    RETURN;
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(v_sess.answer) LOOP
    v_expected := COALESCE((v_sess.answer ->> v_key)::int, 0);
    v_guessed := COALESCE(NULLIF(p_guess ->> v_key, '')::int, -1);
    IF v_guessed <> v_expected THEN
      v_correct := false;
    END IF;
  END LOOP;

  IF NOT v_correct THEN
    UPDATE public.pm_ball_box_players AS p
    SET wrong_attempts = p.wrong_attempts + 1
    WHERE p.id = v_player.id
    RETURNING * INTO v_player;

    correct := false;
    score := 0;
    already_solved := false;
    draw_count := v_player.draw_count;
    wrong_attempts := v_player.wrong_attempts;
    RETURN NEXT;
    RETURN;
  END IF;

  v_score := public.pm_ball_box_score(v_player.draw_count, v_player.wrong_attempts);

  UPDATE public.pm_ball_box_players
  SET solved = true,
      score = v_score,
      session_score = session_score + v_score,
      solved_at = now()
  WHERE id = v_player.id;

  correct := true;
  score := v_score;
  already_solved := false;
  draw_count := v_player.draw_count;
  wrong_attempts := v_player.wrong_attempts;
  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- Student guess
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_ball_box_guess(
  p_session_token text,
  p_session_id uuid,
  p_guess jsonb
)
RETURNS TABLE (
  correct boolean,
  score int,
  already_solved boolean,
  draw_count int,
  wrong_attempts int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_student uuid := public.pm_student_id_from_session(p_session_token);
  v_sess public.pm_ball_box_sessions%ROWTYPE;
  v_player public.pm_ball_box_players%ROWTYPE;
  v_key text;
  v_expected int;
  v_guessed int;
  v_correct boolean := true;
  v_score int;
BEGIN
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'invalid session';
  END IF;

  IF p_guess IS NULL OR jsonb_typeof(p_guess) <> 'object' THEN
    RAISE EXCEPTION 'invalid guess';
  END IF;

  SELECT * INTO v_sess
  FROM public.pm_ball_box_sessions s
  WHERE s.id = p_session_id;

  IF NOT FOUND OR v_sess.phase <> 'playing' THEN
    RAISE EXCEPTION 'cannot guess now';
  END IF;

  SELECT * INTO v_player
  FROM public.pm_ball_box_players p
  WHERE p.session_id = p_session_id AND p.student_id = v_student
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not in session';
  END IF;

  IF v_player.solved THEN
    correct := true;
    score := v_player.score;
    already_solved := true;
    draw_count := v_player.draw_count;
    wrong_attempts := v_player.wrong_attempts;
    RETURN NEXT;
    RETURN;
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(v_sess.answer) LOOP
    v_expected := COALESCE((v_sess.answer ->> v_key)::int, 0);
    v_guessed := COALESCE(NULLIF(p_guess ->> v_key, '')::int, -1);
    IF v_guessed <> v_expected THEN
      v_correct := false;
    END IF;
  END LOOP;

  IF NOT v_correct THEN
    UPDATE public.pm_ball_box_players AS p
    SET wrong_attempts = p.wrong_attempts + 1
    WHERE p.id = v_player.id
    RETURNING * INTO v_player;

    correct := false;
    score := 0;
    already_solved := false;
    draw_count := v_player.draw_count;
    wrong_attempts := v_player.wrong_attempts;
    RETURN NEXT;
    RETURN;
  END IF;

  v_score := public.pm_ball_box_score(v_player.draw_count, v_player.wrong_attempts);

  UPDATE public.pm_ball_box_players
  SET solved = true,
      score = v_score,
      session_score = session_score + v_score,
      solved_at = now()
  WHERE id = v_player.id;

  correct := true;
  score := v_score;
  already_solved := false;
  draw_count := v_player.draw_count;
  wrong_attempts := v_player.wrong_attempts;
  RETURN NEXT;
END;
$$;
