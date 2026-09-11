-- List pimath teacher UUIDs that must be migrated into the new Auth project.
-- Run against the SHARED (source) database.

CREATE TEMP TABLE pm_teacher_allowlist ON COMMIT DROP AS
SELECT DISTINCT teacher_id AS uid
FROM (
  SELECT teacher_id FROM public.pm_classes
  UNION
  SELECT teacher_id FROM public.pm_students
  UNION
  SELECT teacher_id FROM public.pm_teacher_schools
  UNION
  SELECT author_id FROM public.pm_forum_posts
  UNION
  SELECT author_id FROM public.pm_forum_comments
  UNION
  SELECT author_id FROM public.pm_diagram_feedback
  UNION
  SELECT resolved_by FROM public.pm_diagram_feedback WHERE resolved_by IS NOT NULL
) t
WHERE teacher_id IS NOT NULL;

SELECT count(*) AS teacher_count FROM pm_teacher_allowlist;

SELECT
  u.id,
  u.email,
  u.created_at,
  array_agg(DISTINCT i.provider ORDER BY i.provider) AS providers
FROM auth.users u
JOIN pm_teacher_allowlist a ON a.uid = u.id
LEFT JOIN auth.identities i ON i.user_id = u.id
GROUP BY u.id, u.email, u.created_at
ORDER BY u.created_at;
