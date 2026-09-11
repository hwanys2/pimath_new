-- Mail prefs on profiles + admin mailing campaigns (SES).

ALTER TABLE public.pm_profiles
  ADD COLUMN IF NOT EXISTS mail_system_ok boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS mail_marketing_consent boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS mail_marketing_consent_at timestamptz;

UPDATE public.pm_profiles
SET mail_marketing_consent_at = coalesce(mail_marketing_consent_at, now())
WHERE mail_marketing_consent_at IS NULL;

CREATE OR REPLACE FUNCTION public.pm_get_my_mail_prefs()
RETURNS TABLE (
  mail_system_ok boolean,
  mail_marketing_consent boolean,
  mail_marketing_consent_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT
    p.mail_system_ok,
    p.mail_marketing_consent,
    p.mail_marketing_consent_at
  FROM public.pm_profiles p
  WHERE p.user_id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_get_my_mail_prefs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_get_my_mail_prefs() TO authenticated;

CREATE OR REPLACE FUNCTION public.pm_set_mail_marketing_consent(p_consent boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  INSERT INTO public.pm_profiles (user_id, email, mail_marketing_consent, mail_marketing_consent_at)
  VALUES (
    v_uid,
    coalesce((SELECT lower(u.email) FROM auth.users u WHERE u.id = v_uid), ''),
    coalesce(p_consent, false),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    mail_marketing_consent = coalesce(p_consent, false),
    mail_marketing_consent_at = now(),
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.pm_set_mail_marketing_consent(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_set_mail_marketing_consent(boolean) TO authenticated;

CREATE TABLE IF NOT EXISTS public.pm_mailing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  subject text NOT NULL,
  body_html text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'running', 'paused', 'completed', 'cancelled', 'failed')),
  total_recipients integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  error_message text,
  locked_until timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pm_mailing_campaigns_subject_len CHECK (length(trim(subject)) BETWEEN 1 AND 200),
  CONSTRAINT pm_mailing_campaigns_body_len CHECK (length(trim(body_html)) BETWEEN 1 AND 100000)
);

CREATE TABLE IF NOT EXISTS public.pm_mailing_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.pm_mailing_campaigns (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, user_id)
);

CREATE INDEX IF NOT EXISTS pm_mailing_campaigns_created_idx
  ON public.pm_mailing_campaigns (created_at DESC);

CREATE INDEX IF NOT EXISTS pm_mailing_campaigns_status_idx
  ON public.pm_mailing_campaigns (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS pm_mailing_recipients_campaign_status_idx
  ON public.pm_mailing_recipients (campaign_id, status);

CREATE INDEX IF NOT EXISTS pm_mailing_recipients_stale_sending_idx
  ON public.pm_mailing_recipients (campaign_id, status, updated_at)
  WHERE status = 'sending';

CREATE INDEX IF NOT EXISTS pm_profiles_marketing_consent_idx
  ON public.pm_profiles (mail_marketing_consent)
  WHERE mail_marketing_consent = true;

ALTER TABLE public.pm_mailing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_mailing_recipients ENABLE ROW LEVEL SECURITY;

-- Service role / API only; no client policies.
REVOKE ALL ON TABLE public.pm_mailing_campaigns FROM anon, authenticated;
REVOKE ALL ON TABLE public.pm_mailing_recipients FROM anon, authenticated;
