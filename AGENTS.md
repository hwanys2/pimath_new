<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

Notably in this version (Next.js 16): `middleware.ts` is deprecated and renamed to `proxy.ts` (Node.js runtime by default). Use `proxy.ts` at the project root.
<!-- END:nextjs-agent-rules -->

# Supabase (pimath independent)

pimath uses its **own** Supabase project (Auth + `pm_*` data). Migration off the legacy shared foreducator project: [`scripts/supabase-split/`](scripts/supabase-split/), [`docs/supabase-pm-conventions.md`](docs/supabase-pm-conventions.md).

Before any Supabase work, READ and FOLLOW those docs. Key rules:

- Prefix every new DB object (tables, RPCs, buckets, policies) with `pm_`.
- After signup/login, call `pm_ensure_profile` (not `ensure_supabase_django_user`).
- Profiles / schools / notifications live in `pm_profiles`, `pm_schools`, `pm_notifications` — never write foreducator `auth_user` / `common_profile` / mapping tables.
- Frontend uses the publishable/anon key only. Verify sessions server-side with `getClaims()`/`getUser()`, never `getSession()`.
- Do not mutate the legacy shared foreducator DB. Apply migrations there only after explicit human confirmation.
- Cutover OAuth: reuse the same Google/Kakao Client ID/Secret; add the new project callback URI.

# 1:1 PvP games

When adding or changing **1:1 matchmaking games** (class/global queue, auto-requeue after game end), READ and FOLLOW [`docs/pvp-matchmaking.md`](docs/pvp-matchmaking.md). Product rules summary: [`docs/content-system.md`](docs/content-system.md) §5.4.

# 의견 게시판

When adding or changing the **tools-menu feedback board** (글·댓글·그림 첨부), READ and FOLLOW [`docs/user-forum.md`](docs/user-forum.md). Keep it simpler than foreducator 소통공간: no likes, follows, DMs, or `tboard_*`. Path is `/tools/forum`, never `/board` (전자칠판). Notifications use `pm_notifications` / `pm_notify`.

# 문제 그림 그리기

When adding or changing **exam-diagram tools** (학년별 카드, 원의 현 같은 소재별 생성기, PNG 저장), READ and FOLLOW [`docs/problem-diagram-tools.md`](docs/problem-diagram-tools.md) — especially §5.1 (three-column studio). These are specialized generators, not a GeoGebra-style construction app. New tools must go through the shared `[toolId]` page shell (`DiagramToolShell`) so the bottom feedback thread is always present — do not add a per-tool route or copy the comment UI into a studio. Copy the studio grid from `SimilarSolidsStudio` / `HistogramStudio` (`lg:grid-cols-[minmax(0,1fr)_minmax(14rem,16rem)_minmax(15rem,18rem)]`): column 1 figure fills leftover width (`lg:max-w-none`; do not cap at `22rem`) plus settings that strongly change the figure (도형 종류, 변의 수, 치수); column 2 detailed settings (display chips / view / 닮음비); column 3 빠른 그림 + 그림 스타일 only (style open by default). Do not start a new planar/solid/circle tool as a two-column layout (number-line and linear-inequality are the wide-axis exceptions).
