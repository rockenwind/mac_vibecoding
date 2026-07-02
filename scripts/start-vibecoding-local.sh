#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/apps/vibecoding"
ENV_FILE="${VIBECODING_ENV_FILE:-$APP_DIR/.env.local}"
HOST="${VIBECODING_HOST:-127.0.0.1}"
PORT="${VIBECODING_PORT:-8000}"

if [ ! -d "$APP_DIR" ]; then
  echo "apps/vibecoding 하위 모듈을 찾을 수 없습니다."
  echo "먼저 git submodule update --init --recursive 를 실행하세요."
  exit 1
fi

cd "$APP_DIR"

if [ ! -d ".venv" ]; then
  PYTHON_BIN="${PYTHON_BIN:-}"
  if [ -z "$PYTHON_BIN" ]; then
    for candidate in python3.12 python3.11 python3; do
      if command -v "$candidate" >/dev/null 2>&1; then
        PYTHON_BIN="$candidate"
        break
      fi
    done
  fi

  if [ -z "$PYTHON_BIN" ]; then
    echo "Python 3.11 이상을 찾을 수 없습니다."
    exit 1
  fi

  "$PYTHON_BIN" - <<'PY'
import sys
if sys.version_info < (3, 11):
    raise SystemExit("Python 3.11 이상이 필요합니다.")
PY

  "$PYTHON_BIN" -m venv .venv
  .venv/bin/python -m pip install -e ".[dev]"
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "환경 파일을 찾을 수 없습니다: $ENV_FILE"
  echo "docs/security-network-jobs-service.md를 보고 .env.local을 먼저 준비하세요."
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

.venv/bin/alembic upgrade head

echo "vibecoding 대시보드: http://$HOST:$PORT/login"
exec .venv/bin/uvicorn job_agent.web.app:create_app_from_environment \
  --factory \
  --host "$HOST" \
  --port "$PORT" \
  --env-file "$ENV_FILE"
