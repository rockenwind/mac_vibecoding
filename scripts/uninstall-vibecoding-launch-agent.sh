#!/usr/bin/env bash
set -euo pipefail

LABEL="com.rockenwind.vibecoding.local"
PLIST_PATH="$HOME/Library/LaunchAgents/$LABEL.plist"
RUNTIME_DIR="$HOME/Library/Application Support/vibecoding/runtime"
USER_ID="$(id -u)"

if launchctl print "gui/$USER_ID/$LABEL" >/dev/null 2>&1; then
  launchctl bootout "gui/$USER_ID/$LABEL" >/dev/null 2>&1 || true
fi

if [ -f "$PLIST_PATH" ]; then
  rm "$PLIST_PATH"
fi

if [ -d "$RUNTIME_DIR" ]; then
  rm -rf "$RUNTIME_DIR"
fi

echo "vibecoding 자동 실행이 해제됐습니다."
