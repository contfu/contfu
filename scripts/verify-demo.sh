#!/bin/bash
#
# Verify Demo Environment
#
# This script verifies that all demo services are running and healthy.
# Run after `docker compose --profile demo up --build`
#

set -e

echo "=== Contfu Demo Environment Verification ==="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_service() {
    local name=$1
    local url=$2
    local expected_status=${3:-200}

    echo -n "Checking $name at $url... "

    if response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null); then
        if [ "$response" = "$expected_status" ]; then
            echo -e "${GREEN}OK (HTTP $response)${NC}"
            return 0
        else
            echo -e "${RED}FAILED (HTTP $response, expected $expected_status)${NC}"
            return 1
        fi
    else
        echo -e "${RED}FAILED (connection error)${NC}"
        return 1
    fi
}

check_docker_health() {
    local service=$1

    echo -n "Checking Docker health for $service... "

    if health=$(docker compose ps --format json "$service" 2>/dev/null | jq -r '.Health' 2>/dev/null); then
        if [ "$health" = "healthy" ]; then
            echo -e "${GREEN}healthy${NC}"
            return 0
        else
            echo -e "${YELLOW}$health${NC}"
            return 1
        fi
    else
        echo -e "${RED}not found${NC}"
        return 1
    fi
}

echo "1. Checking Docker container health..."
echo ""

check_docker_health "app" || true
check_docker_health "strapi" || true
check_docker_health "demo-app" || true

echo ""
echo "2. Checking service endpoints..."
echo ""

ERRORS=0

check_service "App Service" "http://localhost:3001" || ((ERRORS++))
check_service "Strapi API" "http://localhost:1337/_health" || ((ERRORS++))
check_service "Strapi Articles API" "http://localhost:1337/api/articles" || ((ERRORS++))
check_service "Demo App" "http://localhost:4001" || ((ERRORS++))
check_service "Demo App Health" "http://localhost:4001/health" || ((ERRORS++))

echo ""
echo "3. Verifying Strapi content..."
echo ""

if articles=$(curl -s "http://localhost:1337/api/articles" 2>/dev/null); then
    count=$(echo "$articles" | jq -r '.data | length' 2>/dev/null)
    if [ -n "$count" ] && [ "$count" -gt 0 ]; then
        echo -e "${GREEN}Strapi has $count seeded articles${NC}"
    else
        echo -e "${YELLOW}Warning: No articles found in Strapi${NC}"
    fi
else
    echo -e "${RED}Failed to fetch articles from Strapi${NC}"
    ((ERRORS++))
fi

echo ""
echo "=== Verification Complete ==="
echo ""

if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}$ERRORS error(s) found. Please check the services.${NC}"
    exit 1
else
    echo -e "${GREEN}All checks passed! Demo environment is ready.${NC}"
    echo ""
    echo "Service URLs:"
    echo "  - App Service: http://localhost:3001"
    echo "  - Strapi Admin: http://localhost:1337/admin"
    echo "  - Strapi API: http://localhost:1337/api"
    echo "  - Demo App: http://localhost:4001"
    exit 0
fi
