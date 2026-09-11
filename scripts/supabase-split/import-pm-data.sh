#!/usr/bin/env bash
# Import Auth + pm_* CSV dumps produced by export-pm-data.sh into the NEW project.
#
# Required env:
#   TARGET_DB_URL  — postgres connection string for the new pimath project
# Optional:
#   OUT_DIR        — default scripts/supabase-split/out
#
# Prerequisites on target:
#   1. bootstrap-new-project.sh (stubs + migrations + stub drop)
#   2. Fresh project preferred (import truncates listed pm_* tables)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="${OUT_DIR:-$ROOT/out}"

if [[ -z "${TARGET_DB_URL:-}" ]]; then
  echo "TARGET_DB_URL is required" >&2
  exit 1
fi
if [[ ! -f "$OUT_DIR/auth_users.csv" ]]; then
  echo "Missing $OUT_DIR/auth_users.csv — run export-pm-data.sh first" >&2
  exit 1
fi

PSQL=(psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1)

echo "==> Importing auth.users + auth.identities (fresh project truncate)"
"${PSQL[@]}" <<SQL
SET session_replication_role = replica;
TRUNCATE auth.identities CASCADE;
TRUNCATE auth.users CASCADE;
\\copy auth.users FROM '$OUT_DIR/auth_users.csv' WITH (FORMAT csv, HEADER true);
\\copy auth.identities FROM '$OUT_DIR/auth_identities.csv' WITH (FORMAT csv, HEADER true);
SET session_replication_role = origin;
SQL

if [[ -f "$OUT_DIR/pm_schools.csv" ]]; then
  echo "==> Importing pm_schools"
  "${PSQL[@]}" <<SQL
TRUNCATE public.pm_schools CASCADE;
\\copy public.pm_schools FROM '$OUT_DIR/pm_schools.csv' WITH (FORMAT csv, HEADER true);
SQL
fi

if [[ -f "$OUT_DIR/pm_profiles.csv" ]]; then
  echo "==> Importing pm_profiles"
  "${PSQL[@]}" <<SQL
TRUNCATE public.pm_profiles CASCADE;
\\copy public.pm_profiles FROM '$OUT_DIR/pm_profiles.csv' WITH (FORMAT csv, HEADER true);
SQL
fi

PM_TABLES=(
  pm_classes
  pm_students
  pm_student_sessions
  pm_student_qr_tokens
  pm_xp_events
  pm_class_contents
  pm_game_runs
  pm_activity_sessions
  pm_teacher_schools
  pm_game_presence
  pm_diagram_feedback
  pm_forum_posts
  pm_forum_comments
  pm_inquiry_sessions
  pm_inquiry_participants
  pm_inquiry_step_responses
  pm_dice_race_sessions
  pm_dice_race_players
  pm_ball_box_sessions
  pm_ball_box_players
  pm_graph_sessions
  pm_graph_participants
  pm_graph_points
  pm_omok_queue
  pm_omok_games
  pm_omok_ratings
  pm_quad_queue
  pm_quad_games
  pm_quad_ratings
  pm_sq_queue
  pm_sq_games
  pm_sq_ratings
  pm_alkagi_queue
  pm_alkagi_games
  pm_alkagi_ratings
  pm_pvp_rematch_block
  pm_notifications
)

echo "==> Importing pm_* tables"
"${PSQL[@]}" -c "SET session_replication_role = replica;"
for table in "${PM_TABLES[@]}"; do
  file="$OUT_DIR/${table}.csv"
  if [[ ! -f "$file" ]]; then
    echo "    skip missing $file"
    continue
  fi
  echo "    $table"
  "${PSQL[@]}" -c "TRUNCATE public.$table CASCADE;" 2>/dev/null || true
  "${PSQL[@]}" -c "\\copy public.$table FROM '$file' WITH (FORMAT csv, HEADER true)"
done
"${PSQL[@]}" -c "SET session_replication_role = origin;"

echo "==> Running orphan checks"
"${PSQL[@]}" -f "$ROOT/verify-orphans.sql"

echo "==> Import complete"
