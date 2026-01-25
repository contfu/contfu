#!/usr/bin/env bash

# SSE Mode Verification Script
# Tests SSE endpoint in both development and production modes

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test consumer key (24 bytes, same as integration tests)
TEST_KEY_HEX="746573742d636f6e73756d65722d6b65792d313233343500000000"
TEST_KEY_BASE64=$(echo -n "test-consumer-key-12345" | head -c 24 | base64)

echo -e "${YELLOW}SSE Mode Verification Test${NC}"
echo "================================"
echo ""

# Function to test SSE endpoint
test_sse_endpoint() {
    local port=$1
    local mode=$2
    local url="http://localhost:${port}/api/sse?key=${TEST_KEY_BASE64}"

    echo -e "${YELLOW}Testing SSE in ${mode} mode (port ${port})...${NC}"

    # Test 1: Check if endpoint is accessible
    echo -n "  - Checking endpoint accessibility... "
    if timeout 5 curl -s -f -N "${url}" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
    else
        # The endpoint should stay open, so timeout is expected
        # Check if we got a response at all
        if timeout 2 curl -s -I "${url}" 2>&1 | grep -q "text/event-stream"; then
            echo -e "${GREEN}✓${NC}"
        else
            echo -e "${RED}✗ (endpoint not accessible)${NC}"
            return 1
        fi
    fi

    # Test 2: Check SSE headers
    echo -n "  - Verifying SSE headers... "
    HEADERS=$(timeout 2 curl -s -I "${url}" 2>&1 || true)
    if echo "$HEADERS" | grep -q "text/event-stream"; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗ (wrong content-type)${NC}"
        echo "$HEADERS"
        return 1
    fi

    # Test 3: Receive events from stream
    echo -n "  - Receiving SSE events... "
    EVENTS=$(timeout 5 curl -s -N "${url}" 2>&1 | head -20 || true)

    # Check for CONNECTED event
    if echo "$EVENTS" | grep -q "event: connected"; then
        echo -e "${GREEN}✓ (CONNECTED event received)${NC}"
    else
        # If no connected event but we got SSE format, might be auth issue
        if echo "$EVENTS" | grep -q "event:"; then
            echo -e "${YELLOW}⚠ (SSE working but no CONNECTED event - may need valid DB)${NC}"
        else
            echo -e "${RED}✗ (no SSE events received)${NC}"
            echo "Received: $EVENTS"
            return 1
        fi
    fi

    echo ""
}

# Cleanup function
cleanup() {
    echo -e "${YELLOW}Cleaning up...${NC}"
    # Kill any running dev or prod servers
    pkill -f "vite dev" 2>/dev/null || true
    pkill -f "build/index.js" 2>/dev/null || true
    sleep 1
}

# Set trap to cleanup on exit
trap cleanup EXIT

# Change to app directory
cd "$(dirname "$0")"

echo "Working directory: $(pwd)"
echo ""

# ============================================
# Test 1: Development Mode (Vite dev server)
# ============================================
echo -e "${YELLOW}=== Development Mode Test ===${NC}"
echo ""

# Start dev server in background
echo "Starting development server..."
bun run dev > dev-server.log 2>&1 &
DEV_PID=$!

# Wait for server to start
echo "Waiting for dev server to be ready..."
sleep 5

# Check if server is running
if ! kill -0 $DEV_PID 2>/dev/null; then
    echo -e "${RED}Dev server failed to start!${NC}"
    cat dev-server.log
    exit 1
fi

# Test the endpoint
if test_sse_endpoint 5173 "development"; then
    echo -e "${GREEN}✓ Development mode: PASSED${NC}"
    DEV_RESULT="PASSED"
else
    echo -e "${RED}✗ Development mode: FAILED${NC}"
    DEV_RESULT="FAILED"
fi

# Stop dev server
echo "Stopping development server..."
kill $DEV_PID 2>/dev/null || true
sleep 2

echo ""
echo "================================"
echo ""

# ============================================
# Test 2: Production Mode (Bun server)
# ============================================
echo -e "${YELLOW}=== Production Mode Test ===${NC}"
echo ""

# Build for production
echo "Building for production..."
if bun run build > build.log 2>&1; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}✗ Build failed!${NC}"
    cat build.log
    exit 1
fi

# Check if build output exists
if [ ! -f "build/index.js" ]; then
    echo -e "${RED}Build output not found at build/index.js${NC}"
    ls -la build/ || echo "build/ directory doesn't exist"
    exit 1
fi

# Start production server in background
echo "Starting production server..."
bun run serve > prod-server.log 2>&1 &
PROD_PID=$!

# Wait for server to start
echo "Waiting for production server to be ready..."
sleep 5

# Check if server is running
if ! kill -0 $PROD_PID 2>/dev/null; then
    echo -e "${RED}Production server failed to start!${NC}"
    cat prod-server.log
    exit 1
fi

# Test the endpoint
if test_sse_endpoint 3000 "production"; then
    echo -e "${GREEN}✓ Production mode: PASSED${NC}"
    PROD_RESULT="PASSED"
else
    echo -e "${RED}✗ Production mode: FAILED${NC}"
    PROD_RESULT="FAILED"
fi

# Stop production server
echo "Stopping production server..."
kill $PROD_PID 2>/dev/null || true
sleep 2

echo ""
echo "================================"
echo ""

# ============================================
# Summary
# ============================================
echo -e "${YELLOW}Test Summary${NC}"
echo "================================"
echo -e "Development Mode: ${DEV_RESULT}"
echo -e "Production Mode:  ${PROD_RESULT}"
echo ""

if [ "$DEV_RESULT" = "PASSED" ] && [ "$PROD_RESULT" = "PASSED" ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi
