-- Rebalance: max XP 500_000, curve exponent 2.25 (sync with lib/xp.ts)

CREATE OR REPLACE FUNCTION public.pm_cumulative_xp_for_level(p_level int)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_level <= 1 THEN 0::bigint
    WHEN p_level >= 100 THEN 500000::bigint
    ELSE FLOOR(500000 * POWER(((p_level - 1)::numeric / 99), 2.25))::bigint
  END;
$$;

CREATE OR REPLACE FUNCTION public.pm_level_from_xp(p_total_xp bigint)
RETURNS int
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_xp bigint := GREATEST(0, COALESCE(p_total_xp, 0));
  v_lo int := 1;
  v_hi int := 100;
  v_mid int;
  v_need numeric;
BEGIN
  IF v_xp >= 500000 THEN
    RETURN 100;
  END IF;

  WHILE v_lo < v_hi LOOP
    v_mid := CEIL((v_lo + v_hi + 1)::numeric / 2)::int;
    IF v_mid <= 1 THEN
      v_need := 0;
    ELSIF v_mid >= 100 THEN
      v_need := 500000;
    ELSE
      v_need := FLOOR(500000 * POWER(((v_mid - 1)::numeric / 99), 2.25));
    END IF;

    IF v_need <= v_xp THEN
      v_lo := v_mid;
    ELSE
      v_hi := v_mid - 1;
    END IF;
  END LOOP;

  RETURN v_lo;
END;
$$;

CREATE OR REPLACE FUNCTION public.pm_award_student_xp(
  p_session_token text,
  p_game_key text,
  p_score int
)
RETURNS TABLE (
  total_xp bigint,
  level int,
  xp_awarded int,
  level_before int,
  level_after int,
  leveled_up boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_student uuid := public.pm_student_id_from_session(p_session_token);
  v_row public.pm_students%ROWTYPE;
  v_score int;
  v_xp int;
  v_before int;
  v_after int;
  v_new_total bigint;
BEGIN
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'invalid session';
  END IF;

  IF p_game_key IS NULL OR length(trim(p_game_key)) = 0 THEN
    RAISE EXCEPTION 'game_key required';
  END IF;

  v_score := GREATEST(0, LEAST(1000, COALESCE(p_score, 0)));
  v_xp := v_score;

  SELECT * INTO v_row FROM public.pm_students WHERE public.pm_students.id = v_student FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'student not found';
  END IF;

  v_before := v_row.level;
  v_new_total := LEAST(500000::bigint, v_row.total_xp + v_xp);
  v_after := public.pm_level_from_xp(v_new_total);

  UPDATE public.pm_students
  SET total_xp = v_new_total,
      level = v_after,
      updated_at = now()
  WHERE public.pm_students.id = v_student;

  INSERT INTO public.pm_xp_events (
    student_id, teacher_id, game_key, score, xp_awarded, level_before, level_after
  )
  VALUES (
    v_student, v_row.teacher_id, trim(p_game_key), v_score, v_xp, v_before, v_after
  );

  total_xp := v_new_total;
  level := v_after;
  xp_awarded := v_xp;
  level_before := v_before;
  level_after := v_after;
  leveled_up := v_after > v_before;
  RETURN NEXT;
END;
$$;

-- Cap any existing totals and recompute levels under the new curve
UPDATE public.pm_students
SET total_xp = LEAST(total_xp, 500000),
    level = public.pm_level_from_xp(LEAST(total_xp, 500000));
