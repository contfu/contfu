# Testing Patterns

Load this when writing or debugging tests.

## Development Credentials

**For local development and testing:**

- **Email:** `test@test.com`
- **Password:** `test`

This user is created by `packages/service/app/src/lib/server/db/seed-dev.ts`.

**DO NOT register new users during e2e tests** - this triggers Polar customer creation.

## Database Testing

- **Use real database:** Tests use in-memory SQLite (`:memory:`), not mocks
- **Truncate before each test:** Import `truncateAllTables` from `test/setup.ts`, call in `beforeEach()`
- **Single source of truth:** Keep truncation logic in `test/setup.ts`
- **Respect FK order:** Create parent records before child records
- **Skip if mocked:** Use `describe.skipIf(isDbMocked)` for real db tests
- **Run from package directory:** When packages have `bunfig.toml` with preloads, run `bun test` from inside the package directory

## E2E Tests

Located in `/tests/e2e/`. Run with:

```bash
cd tests
E2E_FULL_FLOW=true bun test:e2e
```

### Best Practices

- **Write tests from user perspective** - Wait for UI changes, not network responses
- **Don't intercept responses** - With enhanced forms, use fetch not navigation
- **Use locators over response parsing**

```ts
// ✅ Correct - wait for UI
await button.click();
await page.locator("text=Success").waitFor({ state: "visible" });

// ❌ Wrong - intercept response
const response = await page.waitForResponse((r) => r.url().includes("/api"));
```

### Strapi E2E Patterns

- Tests use **admin UI automation** (Playwright) for realistic flows
- Use `strapiPage` fixture for admin, separate `page` for client
- Article CRUD goes through full UI (Content Manager → Create → Fill → Save → Publish)
- See `demos/strapi-demo/CLAUDE.md` for credentials

**Key fixtures:**

- `strapiPage` - Authenticated Strapi admin context
- `syncServiceProcess` - Background sync service
- `STRAPI_URL`, `SERVICE_URL`, `CONSUMER_URL` - Endpoints
