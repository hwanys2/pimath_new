-- Student inquiry RPCs use pm_student_session + anon Supabase client (same as games).
-- Original migration granted only authenticated; students could not join or poll.

GRANT EXECUTE ON FUNCTION public.pm_inquiry_find_active(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.pm_inquiry_join(text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.pm_inquiry_poll(text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.pm_inquiry_submit_response(text, uuid, int, jsonb, text) TO anon;
