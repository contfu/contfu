#!/usr/bin/env bash
#
# Run service app E2E tests inside a Docker container.
# Starts NATS, mock servers, and the dev server automatically.
# Multiple runs can execute in parallel (each container is isolated).
#
# Usage:
#   ./scripts/e2e-local.sh              # run all e2e tests
#   ./scripts/e2e-local.sh my-test.e2e  # pass extra args to playwright
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
IMAGE_NAME="contfu-e2e"

# Build the image if it doesn't exist
if ! docker image inspect "$IMAGE_NAME" &>/dev/null; then
  echo "Building $IMAGE_NAME image..."
  docker build -f "$ROOT_DIR/Dockerfile.e2e" -t "$IMAGE_NAME" "$ROOT_DIR"
fi

# Use a named volume for node_modules so Linux-native binaries don't
# overwrite the host's macOS node_modules, and vice versa.
exec docker run --rm \
  -v "$ROOT_DIR:/app" \
  -v contfu-e2e-modules:/app/node_modules \
  -v contfu-e2e-buncache:/root/.bun/install/cache \
  -w /app \
  "$IMAGE_NAME" \
  bash -c 'bun install --frozen-lockfile --ignore-scripts && cd packages/service/app && bunx playwright test "$@"' \
  -- "$@"
