-- Audience selector for mailing campaigns: test | marketing | system

ALTER TABLE public.pm_mailing_campaigns
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'marketing';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pm_mailing_campaigns_audience_check'
  ) THEN
    ALTER TABLE public.pm_mailing_campaigns
      ADD CONSTRAINT pm_mailing_campaigns_audience_check
      CHECK (audience IN ('test', 'marketing', 'system'));
  END IF;
END $$;
