-- Optional cleanup after independent migrations are applied on a new project.
-- Do NOT run on the shared foreducator database.

DROP FUNCTION IF EXISTS public.ensure_supabase_django_user(uuid, text);
DROP FUNCTION IF EXISTS public.create_notification(integer, integer, text, text, text, text);
DROP FUNCTION IF EXISTS public.django_user_id();
DROP FUNCTION IF EXISTS public.pm_forum_django_user_id(uuid);

DROP TABLE IF EXISTS public.school_schoolinfo;
DROP TABLE IF EXISTS public.auth_user_supabase_mapping;
DROP TABLE IF EXISTS public.common_profile;
DROP TABLE IF EXISTS public.auth_user;
