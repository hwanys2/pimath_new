#!/usr/bin/env bash
# Export pimath Auth (allowlisted teachers) + pm_* data from the SHARED source DB.
#
# Required env:
#   SOURCE_DB_URL  — postgres connection string for shared project
# Optional:
#   OUT_DIR        — default scripts/supabase-split/out

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="${OUT_DIR:-$ROOT/out}"
mkdir -p "$OUT_DIR"

if [[ -z "${SOURCE_DB_URL:-}" ]]; then
  echo "SOURCE_DB_URL is required" >&2
  exit 1
fi

export PGOPTIONS='-c statement_timeout=0'
PSQL=(psql "$SOURCE_DB_URL" -v ON_ERROR_STOP=1)

echo "==> Building teacher allowlist → $OUT_DIR/teacher_ids.txt"
"${PSQL[@]}" -Atc "
SELECT DISTINCT teacher_id::text
FROM (
  SELECT teacher_id FROM public.pm_classes
  UNION SELECT teacher_id FROM public.pm_students
  UNION SELECT teacher_id FROM public.pm_teacher_schools
  UNION SELECT author_id FROM public.pm_forum_posts
  UNION SELECT author_id FROM public.pm_forum_comments
  UNION SELECT author_id FROM public.pm_diagram_feedback
  UNION SELECT resolved_by FROM public.pm_diagram_feedback WHERE resolved_by IS NOT NULL
) t
WHERE teacher_id IS NOT NULL
ORDER BY 1;
" > "$OUT_DIR/teacher_ids.txt"

TEACHER_COUNT=$(wc -l < "$OUT_DIR/teacher_ids.txt" | tr -d ' ')
echo "    teachers: $TEACHER_COUNT"

echo "==> Exporting auth.users + auth.identities"
"${PSQL[@]}" <<SQL
CREATE TEMP TABLE _pm_teachers (uid uuid PRIMARY KEY);
\\copy _pm_teachers FROM '$OUT_DIR/teacher_ids.txt'

\\copy (
  SELECT * FROM auth.users u WHERE u.id IN (SELECT uid FROM _pm_teachers)
) TO '$OUT_DIR/auth_users.csv' WITH (FORMAT csv, HEADER true);

\\copy (
  SELECT i.* FROM auth.identities i
  WHERE i.user_id IN (SELECT uid FROM _pm_teachers)
) TO '$OUT_DIR/auth_identities.csv' WITH (FORMAT csv, HEADER true);

\\copy (
  SELECT * FROM public.pm_schools ORDER BY id
) TO '$OUT_DIR/pm_schools.csv' WITH (FORMAT csv, HEADER true);
SQL

# If pm_schools does not exist yet on source, rebuild from teacher snapshots + school_schoolinfo.
if [[ ! -s "$OUT_DIR/pm_schools.csv" ]]; then
  echo "==> pm_schools empty — exporting catalog fallback"
  "${PSQL[@]}" <<SQL
\\copy (
  SELECT DISTINCT
    ts.school_info_id AS id,
    ts.school_name,
    ts.region,
    now() AS created_at
  FROM public.pm_teacher_schools ts
  WHERE length(trim(ts.school_name)) > 0
) TO '$OUT_DIR/pm_schools.csv' WITH (FORMAT csv, HEADER true);
SQL
  # Prefer full catalog when available
  has_catalog=$("${PSQL[@]}" -Atc "SELECT to_regclass('public.school_schoolinfo') IS NOT NULL")
  if [[ "$has_catalog" == "t" ]]; then
    "${PSQL[@]}" <<SQL
\\copy (
  SELECT
    s.id,
    trim(s."SCHUL_NM") AS school_name,
    NULLIF(trim(s."LCTN_SC_NM"), '') AS region,
    now() AS created_at
  FROM public.school_schoolinfo s
  WHERE length(trim(s."SCHUL_NM")) > 0
  ORDER BY s.id
) TO '$OUT_DIR/pm_schools.csv' WITH (FORMAT csv, HEADER true);
SQL
  fi
fi

# Profiles: prefer pm_profiles; else synthesize from common_profile / metadata.
has_profiles=$("${PSQL[@]}" -Atc "SELECT to_regclass('public.pm_profiles') IS NOT NULL")
if [[ "$has_profiles" == "t" ]]; then
  "${PSQL[@]}" <<SQL
CREATE TEMP TABLE _pm_teachers (uid uuid PRIMARY KEY);
\\copy _pm_teachers FROM '$OUT_DIR/teacher_ids.txt'
\\copy (
  SELECT * FROM public.pm_profiles p WHERE p.user_id IN (SELECT uid FROM _pm_teachers)
) TO '$OUT_DIR/pm_profiles.csv' WITH (FORMAT csv, HEADER true);
SQL
else
  echo "==> Synthesizing pm_profiles from common_profile / auth metadata"
  "${PSQL[@]}" <<SQL
CREATE TEMP TABLE _pm_teachers (uid uuid PRIMARY KEY);
\\copy _pm_teachers FROM '$OUT_DIR/teacher_ids.txt'
\\copy (
  SELECT
    u.id AS user_id,
    lower(nullif(trim(u.email), '')) AS email,
    coalesce(
      nullif(trim(pr.nickname), ''),
      nullif(trim(u.raw_user_meta_data ->> 'nickname'), ''),
      nullif(trim(u.raw_user_meta_data ->> 'name'), '')
    ) AS nickname,
    now() AS created_at,
    now() AS updated_at
  FROM auth.users u
  JOIN _pm_teachers t ON t.uid = u.id
  LEFT JOIN public.auth_user_supabase_mapping m ON m.supabase_uid = u.id
  LEFT JOIN public.common_profile pr ON pr.user_id = m.django_user_id
) TO '$OUT_DIR/pm_profiles.csv' WITH (FORMAT csv, HEADER true);
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

echo "==> Exporting pm_* table data"
for table in "${PM_TABLES[@]}"; do
  exists=$("${PSQL[@]}" -Atc "SELECT to_regclass('public.$table') IS NOT NULL")
  if [[ "$exists" != "t" ]]; then
    echo "    skip missing $table"
    continue
  fi
  echo "    $table"
  "${PSQL[@]}" -c "\\copy (SELECT * FROM public.$table) TO '$OUT_DIR/${table}.csv' WITH (FORMAT csv, HEADER true)"
done

cat > "$OUT_DIR/MANIFEST.txt" <<EOF
exported_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
teacher_count=$TEACHER_COUNT
source=shared
EOF

echo "==> Done. Files in $OUT_DIR"
ls -la "$OUT_DIR"
