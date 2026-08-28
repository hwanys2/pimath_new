-- Teacher-defined class list order, used everywhere classes are listed.

ALTER TABLE public.pm_classes
  ADD COLUMN IF NOT EXISTS sort_order integer;

UPDATE public.pm_classes c
SET sort_order = ranked.rn
FROM (
  SELECT
    id,
    (ROW_NUMBER() OVER (
      PARTITION BY teacher_id
      ORDER BY created_at DESC, name ASC
    ) - 1)::int AS rn
  FROM public.pm_classes
) ranked
WHERE c.id = ranked.id
  AND c.sort_order IS NULL;

ALTER TABLE public.pm_classes
  ALTER COLUMN sort_order SET DEFAULT 0,
  ALTER COLUMN sort_order SET NOT NULL;

CREATE INDEX IF NOT EXISTS pm_classes_teacher_sort_idx
  ON public.pm_classes (teacher_id, sort_order);

CREATE OR REPLACE FUNCTION public.pm_classes_assign_sort_order()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT COALESCE(MAX(sort_order), -1) + 1
    INTO NEW.sort_order
  FROM public.pm_classes
  WHERE teacher_id = NEW.teacher_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pm_classes_assign_sort_order ON public.pm_classes;
CREATE TRIGGER pm_classes_assign_sort_order
  BEFORE INSERT ON public.pm_classes
  FOR EACH ROW
  EXECUTE FUNCTION public.pm_classes_assign_sort_order();

CREATE OR REPLACE FUNCTION public.pm_reorder_teacher_classes(p_class_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher uuid := auth.uid();
  v_owned int;
BEGIN
  IF v_teacher IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_class_ids IS NULL OR cardinality(p_class_ids) = 0 THEN
    RAISE EXCEPTION 'class ids required';
  END IF;
  IF (
    SELECT COUNT(DISTINCT x) FROM unnest(p_class_ids) AS x
  ) <> cardinality(p_class_ids) THEN
    RAISE EXCEPTION 'duplicate class id';
  END IF;

  SELECT COUNT(*) INTO v_owned
  FROM public.pm_classes
  WHERE teacher_id = v_teacher
    AND id = ANY (p_class_ids);

  IF v_owned <> cardinality(p_class_ids) THEN
    RAISE EXCEPTION 'class not found or not owned';
  END IF;

  UPDATE public.pm_classes c
  SET sort_order = u.ord - 1
  FROM unnest(p_class_ids) WITH ORDINALITY AS u(id, ord)
  WHERE c.id = u.id
    AND c.teacher_id = v_teacher;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_reorder_teacher_classes(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_reorder_teacher_classes(uuid[]) TO authenticated;
