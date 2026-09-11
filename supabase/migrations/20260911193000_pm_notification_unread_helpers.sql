-- Unread count + mark-all-read for the in-app notification bell.

CREATE INDEX IF NOT EXISTS pm_notifications_recipient_unread_idx
  ON public.pm_notifications (recipient_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE OR REPLACE FUNCTION public.pm_unread_notification_count()
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN 0;
  END IF;
  RETURN (
    SELECT count(*)::integer
    FROM public.pm_notifications n
    WHERE n.recipient_id = v_uid
      AND n.read_at IS NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pm_unread_notification_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_unread_notification_count() TO authenticated;

CREATE OR REPLACE FUNCTION public.pm_mark_all_notifications_read()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  UPDATE public.pm_notifications
  SET read_at = coalesce(read_at, now())
  WHERE recipient_id = auth.uid()
    AND read_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_mark_all_notifications_read() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_mark_all_notifications_read() TO authenticated;
