#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${APP_URL:-}" ]]; then
  echo "APP_URL is required." >&2
  exit 2
fi

if [[ -z "${SCHEDULE_RUN_TOKEN:-}" ]]; then
  echo "SCHEDULE_RUN_TOKEN is required." >&2
  exit 2
fi

base_url="${APP_URL%/}"

curl --fail --show-error --silent \
  --request POST \
  --header "Authorization: Bearer ${SCHEDULE_RUN_TOKEN}" \
  --header "Content-Type: application/json" \
  --data '{}' \
  "${base_url}/api/scans/schedules/run-due"
