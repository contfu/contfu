#!/bin/bash
#
# Local E2E testing: Strapi in Docker, tests on host
#
# Mirrors CI behavior:
# - Builds all packages first (bun run build)
# - Uses built Bun server (bun build/index.js) with WebSocket support
# - Tests both WS and stream transports
# - Uses native node_modules (no reinstall)
#
# Usage: ./scripts/run-e2e-local.sh [--keep] [--skip-build] [playwright-args...]
#   --keep        Keep Strapi running after tests (for debugging)
#   --skip-build  Skip the build step (use existing build)
#
# Examples:
#   ./scripts/run-e2e-local.sh                    # Build + run all E2E tests
#   ./scripts/run-e2e-local.sh --skip-build       # Run with existing build
#   ./scripts/run-e2e-local.sh --keep             # Keep Strapi for debugging
#   ./scripts/run-e2e-local.sh --headed           # Run with visible browser
#   ./scripts/run-e2e-local.sh -g "filter"        # Run tests matching pattern
#
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$PROJECT_DIR/docker/docker-compose.e2e.yaml"

# Parse flags
KEEP_RUNNING=false
SKIP_BUILD=false
PLAYWRIGHT_ARGS=()
for arg in "$@"; do
  if [[ "$arg" == "--keep" ]]; then
    KEEP_RUNNING=true
  elif [[ "$arg" == "--skip-build" ]]; then
    SKIP_BUILD=true
  else
    PLAYWRIGHT_ARGS+=("$arg")
  fi
done

cleanup() {
  if [[ "$KEEP_RUNNING" == "false" ]]; then
    echo ""
    echo "🧹 Stopping Strapi..."
    docker-compose -f "$COMPOSE_FILE" down --volumes --remove-orphans 2>/dev/null || true
  else
    echo ""
    echo "📦 Strapi still running at http://localhost:1337"
    echo "   Admin: http://localhost:1337/admin"
    echo "   To stop: docker-compose -f docker/docker-compose.e2e.yaml down"
  fi
}

trap cleanup EXIT

cd "$PROJECT_DIR"

# Build all packages first (same as CI)
if [[ "$SKIP_BUILD" == "false" ]]; then
  echo "📦 Building packages..."
  bun run build
else
  echo "⏭️  Skipping build (--skip-build)"
fi

# Check if Strapi is already running
if curl -sf http://localhost:1337/_health > /dev/null 2>&1; then
  echo "✅ Strapi already running at http://localhost:1337"
else
  echo "🐳 Starting Strapi container..."
  docker-compose -f "$COMPOSE_FILE" up -d strapi

  echo "⏳ Waiting for Strapi to be ready..."
  for i in $(seq 1 60); do
    if curl -sf http://localhost:1337/_health > /dev/null 2>&1; then
      echo "✅ Strapi is ready!"
      break
    fi
    if [[ $i -eq 60 ]]; then
      echo "❌ Strapi failed to start"
      docker-compose -f "$COMPOSE_FILE" logs strapi
      exit 1
    fi
    sleep 2
  done
fi

# Run E2E tests locally
# STRAPI_HOST tells setup.ts to use external Strapi (the one we just started)
echo ""
echo "🎭 Running E2E tests..."
STRAPI_HOST=localhost E2E_FULL_FLOW=true bun run test:e2e "${PLAYWRIGHT_ARGS[@]}"

echo ""
echo "✅ All tests passed!"
