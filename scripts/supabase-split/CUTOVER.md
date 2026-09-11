# Independent Supabase cutover checklist

Independent project: **`ldkteahouacxazcmijav`** — see [PROJECT.md](PROJECT.md).

## Phase 2 — New project setup

- [x] Create Supabase project `pimath` (`ap-northeast-2`) — ref `ldkteahouacxazcmijav`
- [x] Schema bootstrap (all migrations + independent patch + stub drop)
- [x] Auth Site URL → `https://pimath.kr`
- [x] Auth redirect allow list (pimath / localhost / reset-password / vercel)
- [x] Google / Kakao providers enabled with **same** Client ID/Secret as shared project
- [ ] **Human:** Google Cloud Console — add redirect  
  `https://ldkteahouacxazcmijav.supabase.co/auth/v1/callback`  
  (keep foreducator redirect)
- [ ] **Human:** Kakao Developers — add the same new Supabase callback URI
- [ ] Optional: email templates / SMTP

## Phase 3 — Dry-run data migration

- [x] Allowlisted teachers: **56**
- [x] Auth users + identities copied (UUID + password hashes preserved)
- [x] `pm_*` data copied (classes 99, students 1310, game_runs/xp 38660, schools 14103, …)
- [x] `pm_profiles` backfilled (56)
- [x] `verify-orphans.sql` — all orphan checks **0**
- [x] `pm_forum` storage — empty on source (nothing to copy)
- [ ] **Human:** smoke on preview env pointing at new project (email / Google / Kakao / student)

Resume / re-run:

```bash
PYTHONUNBUFFERED=1 python3 scripts/supabase-split/api-migrate-dry-run.py
# or after partial:
PYTHONUNBUFFERED=1 python3 scripts/supabase-split/api-migrate-resume.py
```

## Phase 4 — Production cutover

After Google/Kakao redirect URIs are added and preview smoke passes:

1. Announce short maintenance (re-login once)
2. Re-run `api-migrate-dry-run.py` for a final snapshot (or resume if only deltas)
3. Re-run `verify-orphans.sql`
4. Vercel Production env:

```bash
PM_SUPABASE_URL=https://ldkteahouacxazcmijav.supabase.co
PM_SUPABASE_ANON_KEY=<legacy anon from `supabase projects api-keys --project-ref ldkteahouacxazcmijav`>
PM_SITE_URL=https://pimath.kr
# keep PM_STUDENT_SESSION_SECRET unchanged
```

5. Redeploy + smoke
6. Rollback = restore previous `PM_SUPABASE_URL` / `PM_SUPABASE_ANON_KEY` (shared DB untouched)

**Do not** copy JWT secret from foreducator.

## Phase 5 — Stabilize (1–2 weeks later)

See [PHASE5-STABILIZE.md](PHASE5-STABILIZE.md).

- [ ] Monitor auth errors
- [ ] Remove pimath URLs from **shared** Supabase redirect allow list when traffic is 100% on new project
- [ ] Optional: dedicated Google/Kakao OAuth apps (after identity remapping plan)
- [ ] Agree archive date for shared `pm_*` (do not DROP until agreed)
- [ ] foreducator Auth/data remain untouched
