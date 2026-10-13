#!/bin/sh
set -eu
APP_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$APP_ROOT"

if command -v curl >/dev/null 2>&1 && curl -fsS -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi

npm run dev >>"${TMPDIR:-/tmp}/misdeudas-dev.log" 2>&1 </dev/null &
