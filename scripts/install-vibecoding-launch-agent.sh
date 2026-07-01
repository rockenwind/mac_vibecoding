#!/usr/bin/env bash
set -euo pipefail

LABEL="com.rockenwind.vibecoding.local"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$HOME/Library/Application Support/vibecoding/runtime"
RUNTIME_APP_DIR="$RUNTIME_DIR/apps/vibecoding"
PLIST_DIR="$HOME/Library/LaunchAgents"
LOG_DIR="$HOME/Library/Logs/vibecoding"
PLIST_PATH="$PLIST_DIR/$LABEL.plist"
USER_ID="$(id -u)"
PYTHON_BIN="${PYTHON_BIN:-}"

if [ -z "$PYTHON_BIN" ]; then
  for candidate in \
    "/Users/rockenwind/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3" \
    python3.12 \
    python3.11 \
    python3; do
    if command -v "$candidate" >/dev/null 2>&1; then
      PYTHON_BIN="$(command -v "$candidate")"
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

mkdir -p "$PLIST_DIR" "$LOG_DIR" "$RUNTIME_DIR/scripts" "$RUNTIME_DIR/apps"

python3 - "$ROOT_DIR" "$RUNTIME_DIR" <<'PY'
from __future__ import annotations

import shutil
import sys
from pathlib import Path

root_dir = Path(sys.argv[1])
runtime_dir = Path(sys.argv[2])
source_app = root_dir / "apps" / "vibecoding"
target_app = runtime_dir / "apps" / "vibecoding"
target_scripts = runtime_dir / "scripts"

if not source_app.exists():
    raise SystemExit("apps/vibecoding 하위 모듈을 찾을 수 없습니다.")

if target_app.exists():
    shutil.rmtree(target_app)

def ignore(_directory: str, names: list[str]) -> set[str]:
    ignored = {
        ".DS_Store",
        ".git",
        ".mypy_cache",
        ".pytest_cache",
        ".ruff_cache",
        ".venv",
        "__pycache__",
        "data",
    }
    return set(names) & ignored

shutil.copytree(source_app, target_app, ignore=ignore)
shutil.copy2(root_dir / "scripts" / "start-vibecoding-local.sh", target_scripts)
PY

cd "$RUNTIME_APP_DIR"
"$PYTHON_BIN" -m venv .venv
.venv/bin/python -m pip install -e ".[dev]"

python3 - "$PLIST_PATH" "$RUNTIME_DIR" "$LOG_DIR" "$LABEL" "$PYTHON_BIN" <<'PY'
from __future__ import annotations

import plistlib
import shlex
import sys
from pathlib import Path

plist_path = Path(sys.argv[1])
root_dir = Path(sys.argv[2])
log_dir = Path(sys.argv[3])
label = sys.argv[4]
python_bin = sys.argv[5]

plist = {
    "Label": label,
    "ProgramArguments": [
        "/bin/bash",
        "-lc",
        f"cd {shlex.quote(str(root_dir))} && exec scripts/start-vibecoding-local.sh",
    ],
    "RunAtLoad": True,
    "KeepAlive": {"SuccessfulExit": False},
    "WorkingDirectory": str(root_dir),
    "EnvironmentVariables": {
        "PYTHON_BIN": python_bin,
        "VIBECODING_ENV_FILE": str(root_dir / "apps" / "vibecoding" / ".env.local"),
    },
    "StandardOutPath": str(log_dir / "launch-agent.out.log"),
    "StandardErrorPath": str(log_dir / "launch-agent.err.log"),
    "ProcessType": "Background",
}

plist_path.write_bytes(plistlib.dumps(plist, sort_keys=False))
PY

if launchctl print "gui/$USER_ID/$LABEL" >/dev/null 2>&1; then
  launchctl bootout "gui/$USER_ID/$LABEL" >/dev/null 2>&1 || true
fi

launchctl bootstrap "gui/$USER_ID" "$PLIST_PATH"
launchctl kickstart -k "gui/$USER_ID/$LABEL"

echo "vibecoding 자동 실행이 등록됐습니다."
echo "대시보드: http://127.0.0.1:8000/login"
echo "실행 복사본: $RUNTIME_DIR"
echo "로그: $LOG_DIR"
