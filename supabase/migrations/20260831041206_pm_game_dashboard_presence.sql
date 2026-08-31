-- pimath: live game presence table for teacher game dashboard
-- Apply to shared DB only after explicit human confirmation.
-- Additive only: new pm_ table. Does not ALTER/DROP foreducator objects.

CREATE TABLE public.pm_game_presence (
  student_id uuid NOT NULL REFERENCES public.pm_students (id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.pm_classes (id) ON DELETE CASCADE,
  content_key text NOT NULL,
  phase text NOT NULL DEFAULT 'playing'
    CHECK (phase IN ('lobby', 'waiting', 'playing', 'ended')),
  live_score int CHECK (live_score IS NULL OR live_score >= 0),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, content_key),
  CONSTRAINT pm_game_presence_content_key_not_blank
    CHECK (length(trim(content_key)) > 0)
);

CREATE INDEX pm_game_presence_class_content_seen_idx
  ON public.pm_game_presence (class_id, content_key, last_seen_at DESC);

ALTER TABLE public.pm_game_presence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pm_game_presence FROM anon, authenticated;
