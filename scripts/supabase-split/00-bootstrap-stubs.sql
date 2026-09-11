-- Run on a FRESH pimath-only Supabase project BEFORE replaying
-- supabase/migrations/*.sql so historical migrations that reference
-- foreducator objects do not fail.
-- After all migrations (including pm_independent_supabase) succeed,
-- optionally drop these stubs with 99-drop-foreducator-stubs.sql.

CREATE TABLE IF NOT EXISTS public.auth_user (
  id integer PRIMARY KEY,
  email varchar(254),
  username varchar(150)
);

CREATE TABLE IF NOT EXISTS public.common_profile (
  user_id integer PRIMARY KEY,
  nickname text,
  school_id bigint
);

CREATE TABLE IF NOT EXISTS public.auth_user_supabase_mapping (
  supabase_uid uuid PRIMARY KEY,
  django_user_id integer NOT NULL
);

CREATE TABLE IF NOT EXISTS public.school_schoolinfo (
  id bigint PRIMARY KEY,
  "SCHUL_NM" text,
  "LCTN_SC_NM" text
);

CREATE OR REPLACE FUNCTION public.django_user_id()
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT NULL::integer;
$$;

CREATE OR REPLACE FUNCTION public.create_notification(
  p_recipient integer,
  p_sender integer,
  p_title text,
  p_message text,
  p_kind text,
  p_url text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_supabase_django_user(
  p_supabase_uid uuid,
  p_email text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN;
END;
$$;
