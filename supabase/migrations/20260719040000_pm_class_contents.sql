-- pimath: class content assignments (bookmark + activate)
-- Catalog lives in code (lib/contents.ts). DB stores class ↔ content_key only.
-- Apply to shared DB only after explicit human confirmation.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

CREATE TABLE public.pm_class_contents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.pm_classes (id) ON DELETE CASCADE,
  content_key text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pm_class_contents_content_key_not_blank
    CHECK (length(trim(content_key)) > 0),
  CONSTRAINT pm_class_contents_class_content_uidx UNIQUE (class_id, content_key)
);

CREATE INDEX pm_class_contents_class_id_idx
  ON public.pm_class_contents (class_id);

CREATE INDEX pm_class_contents_content_key_idx
  ON public.pm_class_contents (content_key);

CREATE TRIGGER pm_class_contents_set_updated_at
  BEFORE UPDATE ON public.pm_class_contents
  FOR EACH ROW
  EXECUTE FUNCTION public.pm_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — teachers manage own class rows via pm_classes.teacher_id
-- ---------------------------------------------------------------------------

ALTER TABLE public.pm_class_contents ENABLE ROW LEVEL SECURITY;

CREATE POLICY pm_class_contents_select_own
  ON public.pm_class_contents FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.pm_classes c
      WHERE c.id = class_id
        AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY pm_class_contents_insert_own
  ON public.pm_class_contents FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.pm_classes c
      WHERE c.id = class_id
        AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY pm_class_contents_update_own
  ON public.pm_class_contents FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.pm_classes c
      WHERE c.id = class_id
        AND c.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.pm_classes c
      WHERE c.id = class_id
        AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY pm_class_contents_delete_own
  ON public.pm_class_contents FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.pm_classes c
      WHERE c.id = class_id
        AND c.teacher_id = auth.uid()
    )
  );

REVOKE ALL ON TABLE public.pm_class_contents FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pm_class_contents TO authenticated;

-- ---------------------------------------------------------------------------
-- Student RPC: list assigned contents for own class
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_list_my_class_contents(p_session_token text)
RETURNS TABLE (
  content_key text,
  is_active boolean,
  assigned_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_student uuid := public.pm_student_id_from_session(p_session_token);
  v_class uuid;
BEGIN
  IF v_student IS NULL THEN
    RETURN;
  END IF;

  SELECT st.class_id INTO v_class
  FROM public.pm_students st
  WHERE st.id = v_student;

  IF v_class IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    cc.content_key,
    cc.is_active,
    cc.created_at
  FROM public.pm_class_contents cc
  WHERE cc.class_id = v_class
  ORDER BY cc.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_list_my_class_contents(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_list_my_class_contents(text) TO anon, authenticated;
