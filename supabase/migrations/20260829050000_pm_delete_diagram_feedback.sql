-- pimath: authors may delete their own diagram feedback; admin may delete any.

CREATE OR REPLACE FUNCTION public.pm_delete_diagram_feedback(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_author uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'login_required';
  END IF;

  SELECT f.author_id
  INTO v_author
  FROM public.pm_diagram_feedback f
  WHERE f.id = p_id;

  IF v_author IS NULL THEN
    RAISE EXCEPTION 'not found';
  END IF;

  IF v_author <> v_uid AND NOT public.pm_is_diagram_admin() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  DELETE FROM public.pm_diagram_feedback
  WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_delete_diagram_feedback(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pm_delete_diagram_feedback(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.pm_delete_diagram_feedback(uuid) TO authenticated;
