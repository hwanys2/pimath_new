# Independent Supabase project (created 2026-09-11)

| Item | Value |
|------|-------|
| Name | pimath |
| Ref | `ldkteahouacxazcmijav` |
| Region | `ap-northeast-2` |
| URL | `https://ldkteahouacxazcmijav.supabase.co` |
| Org | Foreducator (`nrrpwrmgzbboghxqrhuj`) |

## App env (after dry-run / cutover)

```bash
PM_SUPABASE_URL=https://ldkteahouacxazcmijav.supabase.co
PM_SUPABASE_ANON_KEY=<legacy anon JWT from dashboard or get_publishable_keys>
PM_SITE_URL=https://pimath.kr
PM_STUDENT_SESSION_SECRET=<unchanged from production>
```

## Dashboard still required (human)

1. ~~Authentication → URL / Providers~~ — applied via API (Site URL + Google/Kakao same secrets + allow list)
2. **Google Cloud Console / Kakao Developers:** add  
   `https://ldkteahouacxazcmijav.supabase.co/auth/v1/callback`
3. Preview smoke, then Vercel Production env switch (see CUTOVER.md Phase 4)

## Schema + dry-run data

- Schema: all migrations applied; stubs dropped; `pm_profiles` / `pm_schools` / `pm_notifications` present
- Dry-run data: 56 teachers, 99 classes, 1310 students, orphan checks 0 (2026-09-11)

Do not point production Vercel at this project until Google/Kakao redirect URIs are added and preview smoke passes.
