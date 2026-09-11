# Supabase split runbook (pimath independent project)

Companion to [`docs/supabase-pm-conventions.md`](../../docs/supabase-pm-conventions.md).

## Scripts

| Script | Purpose |
|--------|---------|
| `00-bootstrap-stubs.sql` | Temporary foreducator-shaped stubs so historical migrations apply on a blank DB |
| `bootstrap-new-project.sh` | stubs → all migrations → drop stubs |
| `01-list-pimath-teachers.sql` | Count/list teachers to migrate |
| `export-pm-data.sh` / `import-pm-data.sh` | CSV dump/load via `psql` (needs DB URL) |
| `api-migrate-dry-run.py` | Full Auth+data copy via Management SQL API (Keychain CLI token) |
| `api-migrate-resume.py` | Resume remaining `pm_*` tables after a partial API migrate |
| `copy-pm-forum-storage.sh` | Copy `pm_forum` bucket objects |
| `verify-orphans.sql` | Post-import integrity |
| `99-drop-foreducator-stubs.sql` | Remove stubs after independent migrations |
| `PROJECT.md` | Live independent project ref / URLs |
| `CUTOVER.md` | Phase 2–5 checklist |

## Environment

```bash
# Source = shared foreducator project (read-only during export)
export SOURCE_DB_URL='postgresql://postgres.…@db.jmgoqpqyrnoamfjngcmy.supabase.co:5432/postgres'

# Target = new pimath project
export TARGET_DB_URL='postgresql://postgres.…@db.<NEW_REF>.supabase.co:5432/postgres'

# Storage copy only
export SOURCE_SUPABASE_URL='https://jmgoqpqyrnoamfjngcmy.supabase.co'
export SOURCE_SERVICE_ROLE_KEY='…'   # ops machine only
export TARGET_SUPABASE_URL='https://<NEW_REF>.supabase.co'
export TARGET_SERVICE_ROLE_KEY='…'
```

Never put service role keys in the Next.js app or Vercel `NEXT_PUBLIC_*`.

## OAuth (cutover)

Reuse the **same** Google/Kakao Client ID and Secret on the new project.
Add `https://<NEW_REF>.supabase.co/auth/v1/callback` to provider consoles.
Do not create new OAuth clients until after cutover + identity remapping plan.
