#!/usr/bin/env bash
# Bootstrap a brand-new pimath Supabase database:
#   stubs → supabase db push / migration up → optional stub drop
#
# Required env:
#   TARGET_DB_URL
# Optional:
#   SUPABASE_DB_PASSWORD / linked project via `supabase link`

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SPLIT="$(cd "$(dirname "$0")" && pwd)"

if [[ -z "${TARGET_DB_URL:-}" ]]; then
  echo "TARGET_DB_URL is required" >&2
  exit 1
fi

PSQL=(psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1)

echo "==> Applying foreducator stubs"
"${PSQL[@]}" -f "$SPLIT/00-bootstrap-stubs.sql"

echo "==> Applying tracked migrations in order"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "    $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done

echo "==> Dropping stubs (independent mode)"
"${PSQL[@]}" -f "$SPLIT/99-drop-foreducator-stubs.sql"

echo "==> Bootstrap complete. Next: configure Auth providers + redirect URLs in dashboard."
