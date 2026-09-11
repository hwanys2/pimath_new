-- Orphan / integrity checks after importing into the NEW pimath project.

SELECT 'pm_classes_orphan_teacher' AS check_name, count(*) AS bad
FROM public.pm_classes c
LEFT JOIN auth.users u ON u.id = c.teacher_id
WHERE u.id IS NULL

UNION ALL
SELECT 'pm_students_orphan_teacher', count(*)
FROM public.pm_students s
LEFT JOIN auth.users u ON u.id = s.teacher_id
WHERE u.id IS NULL

UNION ALL
SELECT 'pm_students_orphan_class', count(*)
FROM public.pm_students s
LEFT JOIN public.pm_classes c ON c.id = s.class_id
WHERE c.id IS NULL

UNION ALL
SELECT 'pm_forum_orphan_author', count(*)
FROM public.pm_forum_posts p
LEFT JOIN auth.users u ON u.id = p.author_id
WHERE u.id IS NULL

UNION ALL
SELECT 'pm_teacher_schools_orphan', count(*)
FROM public.pm_teacher_schools ts
LEFT JOIN auth.users u ON u.id = ts.teacher_id
WHERE u.id IS NULL

UNION ALL
SELECT 'pm_teacher_schools_missing_catalog', count(*)
FROM public.pm_teacher_schools ts
LEFT JOIN public.pm_schools s ON s.id = ts.school_info_id
WHERE s.id IS NULL

UNION ALL
SELECT 'auth_users', count(*)::bigint FROM auth.users
UNION ALL
SELECT 'pm_classes', count(*)::bigint FROM public.pm_classes
UNION ALL
SELECT 'pm_students', count(*)::bigint FROM public.pm_students
UNION ALL
SELECT 'pm_profiles', count(*)::bigint FROM public.pm_profiles
UNION ALL
SELECT 'pm_schools', count(*)::bigint FROM public.pm_schools;
