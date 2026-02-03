#!/bin/sh
set -e

# Start Strapi in background
npm run develop &
STRAPI_PID=$!

# Wait for Strapi to be ready
echo "Waiting for Strapi to start..."
until curl -sf http://localhost:1337/_health > /dev/null 2>&1; do
  sleep 1
done
echo "Strapi is up!"

# Check admin init status and create if needed
sleep 2
INIT_RESPONSE=$(curl -sf http://localhost:1337/admin/init 2>/dev/null || echo '{}')
echo "Admin init response: $INIT_RESPONSE"

HAS_ADMIN=$(echo "$INIT_RESPONSE" | grep -o '"hasAdmin":[^,}]*' | grep -o 'true\|false' || echo "unknown")
echo "Has admin: $HAS_ADMIN"

if [ "$HAS_ADMIN" = "false" ]; then
  echo "Creating admin user..."
  RESULT=$(curl -s -X POST http://localhost:1337/admin/register-admin \
    -H "Content-Type: application/json" \
    -d '{
      "email": "admin@example.com",
      "firstname": "Admin",
      "lastname": "User",
      "password": "Admin123!"
    }' 2>&1)
  echo "Admin creation result: $RESULT"
else
  echo "Admin user already exists or check failed (hasAdmin=$HAS_ADMIN)"
fi

# Wait for Strapi process
wait $STRAPI_PID
