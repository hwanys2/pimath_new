-- Sync inquiry session step_count when content catalog grows (e.g. 10 → 15 problems).

CREATE OR REPLACE FUNCTION public.pm_inquiry_sync_step_count(
  p_session_id uuid,
  p_step_count int
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_teacher uuid := auth.uid();
  v_row public.pm_inquiry_sessions%ROWTYPE;
  v_next int;
BEGIN
  IF v_teacher IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_step_count IS NULL OR p_step_count <= 0 THEN
    RAISE EXCEPTION 'step_count must be positive';
  END IF;

  SELECT s.* INTO v_row
  FROM public.pm_inquiry_sessions s
  JOIN public.pm_classes c ON c.id = s.class_id
  WHERE s.id = p_session_id
    AND c.teacher_id = v_teacher;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session not found or not owned';
  END IF;

  IF v_row.phase = 'closed' THEN
    RETURN v_row.step_count;
  END IF;

  v_next := GREATEST(v_row.step_count, p_step_count);

  IF v_next <> v_row.step_count THEN
    UPDATE public.pm_inquiry_sessions
    SET step_count = v_next,
        updated_at = now()
    WHERE id = p_session_id;
  END IF;

  RETURN v_next;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_inquiry_sync_step_count(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_inquiry_sync_step_count(uuid, int) TO authenticated;

-- Backfill open balance sessions created before 15-problem expansion.
UPDATE public.pm_inquiry_sessions
SET step_count = 15,
    updated_at = now()
WHERE content_key = 'g1-u2-2-linear-equation-balance'
  AND step_count < 15
  AND phase <> 'closed';
