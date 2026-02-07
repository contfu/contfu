#!/bin/bash
#
# Local E2E testing: Strapi in Docker, tests on host
#
# Fast and simple:
# - Uses native node_modules (no reinstall)
# - Direct test output
# - Easier debugging
#
# Usage: ./scripts/run-e2e-local.sh [--keep] [playwright-args...]
#   --keep  Keep Strapi running after tests (for debugging)
#
# Examples:
#   ./scripts/run-e2e-local.sh                    # Run all E2E tests
#   ./scripts/run-e2e-local.sh --keep             # Keep Strapi for debugging
#   ./scripts/run-e2e-local.sh --headed           # Run with visible browser
#   ./scripts/run-e2e-local.sh -g "filter"        # Run tests matching pattern
#
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$PROJECT_DIR/docker/docker-compose.e2e.yaml"

# Ensure Bun is discoverable in non-interactive shells.
# Many setups install Bun at ~/.bun/bin without exporting PATH for scripts.
if ! command -v bun >/dev/null 2>&1 && [[ -x "$HOME/.bun/bin/bun" ]]; then
  export PATH="$HOME/.bun/bin:$PATH"
fi

# Ensure Node.js toolchain is discoverable in non-interactive shells.
# Prefer nvm default when available, then fall back to Volta shims.
if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  # shellcheck disable=SC1090
  source "$NVM_DIR/nvm.sh" >/dev/null 2>&1
  nvm use --silent default >/dev/null 2>&1 || true
fi

if ! command -v node >/dev/null 2>&1 && [[ -d "$HOME/.volta/bin" ]]; then
  export PATH="$HOME/.volta/bin:$PATH"
fi

# Parse --keep flag
KEEP_RUNNING=false
PLAYWRIGHT_ARGS=()
for arg in "$@"; do
  if [[ "$arg" == "--keep" ]]; then
    KEEP_RUNNING=true
  else
    PLAYWRIGHT_ARGS+=("$arg")
  fi
done

# Resolve Docker Compose command (`docker-compose` or `docker compose`)
if command -v docker-compose >/dev/null 2>&1; then
  DOCKER_COMPOSE=(docker-compose)
elif docker compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE=(docker compose)
else
  echo "❌ Docker Compose is required but was not found."
  echo "   Install Docker Desktop or Docker Compose, then try again."
  exit 1
fi

# E2E tests and the test harness currently require Bun.
if ! command -v bun >/dev/null 2>&1; then
  echo "❌ Bun is required to run local E2E tests, but it is not available on PATH."
  echo "   Install Bun: https://bun.sh/docs/installation"
  echo "   Then rerun: ./scripts/run-e2e-local.sh"
  exit 1
fi

# Playwright CLI is Node-based in this repository.
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js is required to run Playwright E2E tests."
  echo "   If you use Volta/NVM, make sure it is initialized for non-interactive shells."
  echo "   Then rerun: ./scripts/run-e2e-local.sh"
  exit 1
fi

dc() {
  "${DOCKER_COMPOSE[@]}" -f "$COMPOSE_FILE" "$@"
}

# Prefer the Playwright CLI that matches test file module resolution.
# Some workspace layouts have tests/node_modules with a different version.
PLAYWRIGHT_CLI="$PROJECT_DIR/node_modules/playwright/cli.js"
if [[ -f "$PROJECT_DIR/tests/node_modules/@playwright/test/cli.js" ]]; then
  PLAYWRIGHT_CLI="$PROJECT_DIR/tests/node_modules/@playwright/test/cli.js"
fi

cleanup() {
  if [[ "$KEEP_RUNNING" == "false" ]]; then
    echo ""
    echo "🧹 Stopping Strapi..."
    dc down --volumes --remove-orphans 2>/dev/null || true
  else
    echo ""
    echo "📦 Strapi still running at http://localhost:1337"
    echo "   Admin: http://localhost:1337/admin"
    echo "   To stop: ${DOCKER_COMPOSE[*]} -f docker/docker-compose.e2e.yaml down"
  fi
}

trap cleanup EXIT

cd "$PROJECT_DIR"

# Check if Strapi is already running
if curl -sf http://localhost:1337/_health > /dev/null 2>&1; then
  echo "✅ Strapi already running at http://localhost:1337"
else
  echo "🐳 Starting Strapi container..."
  dc up -d strapi

  echo "⏳ Waiting for Strapi to be ready..."
  for i in $(seq 1 60); do
    if curl -sf http://localhost:1337/_health > /dev/null 2>&1; then
      echo "✅ Strapi is ready!"
      break
    fi
    if [[ $i -eq 60 ]]; then
      echo "❌ Strapi failed to start"
      dc logs strapi
      exit 1
    fi
    sleep 2
  done
fi

# Run E2E tests locally
# STRAPI_HOST tells setup.ts to use external Strapi (the one we just started)
echo ""
echo "🎭 Running E2E tests..."
STRAPI_HOST=localhost E2E_FULL_FLOW=true bun tests/e2e/setup.ts
STRAPI_HOST=localhost E2E_FULL_FLOW=true node "$PLAYWRIGHT_CLI" test -c tests/playwright.config.ts "${PLAYWRIGHT_ARGS[@]}"

echo ""
echo "✅ All tests passed!"
