# CLAUDE.md - Strapi Demo

This is a Strapi 5 demo instance used for E2E testing the Contfu Strapi adapter.

## Quick Start

```bash
# Start in development mode (from this directory)
bun run develop

# Or from project root
cd demos/strapi-demo && bun run develop
```

**Admin URL:** http://localhost:1337/admin
**API URL:** http://localhost:1337/api

## Test Credentials

For E2E tests and local development:

- **Email:** `admin@example.com`
- **Password:** `Admin123!`

These are pre-seeded via `data/seed-admin.js`.

## Content Types

### Article

The main content type used for testing sync:

- `title` (string, required)
- `slug` (string, unique)
- `description` (text)
- `content` (rich text / blocks)

**API Endpoints:**

- `GET /api/articles` - List all articles
- `GET /api/articles/:id` - Get single article
- `POST /api/articles` - Create article (requires auth)
- `PUT /api/articles/:id` - Update article
- `DELETE /api/articles/:id` - Delete article

## E2E Test Integration

The E2E tests in `/tests/e2e/strapi-full-flow.spec.ts` interact with this demo:

1. **Admin UI automation** - Tests use Playwright to create/edit articles via the Strapi admin panel
2. **API calls** - Direct REST API calls for verification and setup
3. **Webhook simulation** - Strapi sends webhooks to the sync service on content changes

### Key Test Patterns

**Creating articles via UI:**
The tests navigate through Strapi's admin UI to create content, simulating real user behavior. This is slower but more realistic than API-only tests.

**API token for programmatic access:**
Generate a full-access API token in Settings → API Tokens for test automation.

## Webhook Configuration

For real-time sync, configure webhooks in Strapi:

1. Go to Settings → Webhooks
2. Add webhook URL: `http://localhost:3000/webhooks/strapi`
3. Select events: Entry create, update, delete

**Note:** WebSocket live-updates from Strapi webhooks are not yet fully implemented. The E2E test for real-time updates is currently skipped.

## Database

Uses SQLite by default (`database/data.db`). Reset by deleting the file and restarting.

## Common Issues

### Port conflicts

Strapi defaults to port 1337. If occupied, set `PORT` env var or update `config/server.ts`.

### Admin user not found

Run `bun run develop` first - the seed script creates the admin user on first boot.

### API returns 403

Check that the Article content type has public permissions enabled:
Settings → Roles → Public → Article → Enable find/findOne
