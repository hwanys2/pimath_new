#!/usr/bin/env bash
# Copy pm_forum storage objects from source project to target project.
#
# Required env:
#   SOURCE_SERVICE_ROLE_KEY
#   SOURCE_SUPABASE_URL
#   TARGET_SERVICE_ROLE_KEY
#   TARGET_SUPABASE_URL
#
# Uses the Supabase Storage API via curl. Requires jq.

set -euo pipefail

need() { [[ -n "${!1:-}" ]] || { echo "$1 required" >&2; exit 1; }; }
need SOURCE_SERVICE_ROLE_KEY
need SOURCE_SUPABASE_URL
need TARGET_SERVICE_ROLE_KEY
need TARGET_SUPABASE_URL
command -v jq >/dev/null || { echo "jq required" >&2; exit 1; }

BUCKET=pm_forum
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

list_prefix() {
  local url="$1" key="$2" prefix="$3"
  curl -sS "${url}/storage/v1/object/list/${BUCKET}" \
    -H "Authorization: Bearer ${key}" \
    -H "apikey: ${key}" \
    -H "Content-Type: application/json" \
    -d "{\"prefix\":\"${prefix}\",\"limit\":1000}"
}

echo "==> Listing root folders in $BUCKET"
roots=$(list_prefix "$SOURCE_SUPABASE_URL" "$SOURCE_SERVICE_ROLE_KEY" "" | jq -r '.[].name // empty')

for root in $roots; do
  echo "    folder $root"
  files=$(list_prefix "$SOURCE_SUPABASE_URL" "$SOURCE_SERVICE_ROLE_KEY" "${root}/" | jq -r '.[].name // empty')
  for name in $files; do
    path="${root}/${name}"
    echo "      $path"
    curl -sS "${SOURCE_SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}" \
      -H "Authorization: Bearer ${SOURCE_SERVICE_ROLE_KEY}" \
      -H "apikey: ${SOURCE_SERVICE_ROLE_KEY}" \
      -o "$TMP/file"
    curl -sS -X POST "${TARGET_SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}" \
      -H "Authorization: Bearer ${TARGET_SERVICE_ROLE_KEY}" \
      -H "apikey: ${TARGET_SERVICE_ROLE_KEY}" \
      -H "Content-Type: application/octet-stream" \
      -H "x-upsert: true" \
      --data-binary @"$TMP/file" >/dev/null
  done
done

echo "==> Storage copy done"
