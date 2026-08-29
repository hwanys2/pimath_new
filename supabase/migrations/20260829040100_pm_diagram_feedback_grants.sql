-- Tighten EXECUTE on diagram feedback RPCs. Supabase default privileges
-- grant EXECUTE to anon on new public functions; revoke where login is required.

REVOKE ALL ON FUNCTION public.pm_create_diagram_feedback(text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.pm_resolve_diagram_feedback(uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.pm_is_diagram_admin() FROM anon;

GRANT EXECUTE ON FUNCTION public.pm_create_diagram_feedback(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pm_resolve_diagram_feedback(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pm_is_diagram_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pm_list_diagram_feedback(text) TO anon, authenticated;
