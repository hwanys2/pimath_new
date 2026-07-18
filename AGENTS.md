<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

Notably in this version (Next.js 16): `middleware.ts` is deprecated and renamed to `proxy.ts` (Node.js runtime by default). Use `proxy.ts` at the project root.
<!-- END:nextjs-agent-rules -->

# Supabase (shared with foreducator.com)

This project shares a single Supabase project with **foreducator.com**. Auth/accounts are shared, but all pimath-specific data MUST be isolated with a `pm_` prefix, and foreducator.com must never be affected.

Before any Supabase work (auth, tables, RLS, migrations, keys), READ and FOLLOW [`docs/supabase-pm-conventions.md`](docs/supabase-pm-conventions.md). Key rules:

- Never ALTER/DROP/mutate existing foreducator objects; never reuse legacy `pimath_*` tables.
- Prefix every new DB object (tables, RPCs, buckets, policies) with `pm_`.
- After signup/login, call the existing `ensure_supabase_django_user` RPC to sync the foreducator account (same email = same account). Never write `auth_user`/`common_profile`/mapping tables directly.
- Frontend uses the publishable key only. Verify sessions server-side with `getClaims()`/`getUser()`, never `getSession()`.
- Apply migrations to the shared DB only after explicit human confirmation.
