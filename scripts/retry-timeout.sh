#!/usr/bin/env bash
# Retry a command with a per-attempt timeout.
#
# Usage: retry-timeout.sh [--timeout <seconds>] [--retries <n>] -- <command...>
#
# Defaults: timeout=60s, retries=3
# Exits with the command's exit code on success, or 1 after all retries fail.

set -euo pipefail

TIMEOUT=60
RETRIES=3

while [[ $# -gt 0 ]]; do
  case "$1" in
    --timeout) TIMEOUT="$2"; shift 2 ;;
    --retries) RETRIES="$2"; shift 2 ;;
    --) shift; break ;;
    *) break ;;
  esac
done

if [[ $# -eq 0 ]]; then
  echo "Usage: retry-timeout.sh [--timeout <s>] [--retries <n>] -- <command...>" >&2
  exit 1
fi

for attempt in $(seq 1 "$RETRIES"); do
  echo "Attempt $attempt/$RETRIES (timeout: ${TIMEOUT}s): $*"
  if timeout "$TIMEOUT" "$@"; then
    exit 0
  fi
  code=$?
  if [[ $code -eq 124 ]]; then
    echo "Timed out after ${TIMEOUT}s"
  else
    echo "Failed with exit code $code"
  fi
  if [[ $attempt -lt $RETRIES ]]; then
    echo "Retrying..."
  fi
done

echo "All $RETRIES attempts failed"
exit 1
