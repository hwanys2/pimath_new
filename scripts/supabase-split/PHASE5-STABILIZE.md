# Phase 5 — post-cutover stabilize

Run only after production traffic uses `ldkteahouacxazcmijav` for ≥1–2 weeks with no rollback.

## Shared project cleanup (safe order)

1. Confirm Vercel Production `PM_SUPABASE_URL` is the new project.
2. On shared project `jmgoqpqyrnoamfjngcmy` Auth URL config, remove pimath redirect URLs once no clients use them.
3. Leave Google/Kakao Client IDs shared until a dedicated-app remapping is planned.
4. Do **not** DROP shared `pm_*` tables until an explicit archive decision (keep for audit/rollback).

## Optional OAuth app split

Creating new Google/Kakao clients changes provider `sub` values. Requires identity remapping or email-based linking — schedule as a separate project after cutover is stable.

## Monitoring signals

- Teacher login failures (`signInWithPassword` / OAuth callback errors)
- Student login (`pm_authenticate_student` / QR)
- Orphan teacher_id checks (`verify-orphans.sql`)
- Forum / diagram notification rows in `pm_notifications`
