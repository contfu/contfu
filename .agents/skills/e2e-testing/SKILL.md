---
name: e2e-testing
description: Write and debug Playwright E2E tests for the Contfu service app. Use when creating new e2e tests, debugging test failures, or working with the e2e test infrastructure (global setup, PGlite, NATS, admin API).
---

# E2E Testing

Playwright E2E tests for the Contfu service app.

## Architecture

Two separate test suites exist:

### Full-flow E2E (CI)

- **Test dir:** `tests/e2e/` — files match `**/*.e2e.ts`
- **Config:** `tests/playwright.config.ts`
- **Global setup:** `tests/e2e/global-setup.ts` — spawns a shared service app on port 8011

### Service app E2E (local Docker)

- **Test dir:** `packages/service/app/tests/` — files match `**/*.e2e.ts`
- **Config:** `packages/service/app/playwright.config.ts`
- **Global setup:** `packages/service/app/tests/global-setup.ts` — seeds PGlite database
- **Fixtures:** `packages/service/app/tests/fixtures.ts` — `authenticatedPage` fixture handles login

Both suites share:

- **Database:** PGlite with filesystem storage (`/tmp/contfu-e2e-pglite`)
- **NATS:** JetStream (started by Playwright as a webServer)
- **Execution:** Single worker, serial mode — tests share the service app and database state

## Running Tests Locally (Docker)

**Always use the Docker runner for local E2E tests.** It starts NATS, builds the app, seeds the database, and runs Playwright — all inside an isolated container. No port conflicts, no host dependencies.

```bash
# Run all service app E2E tests
bun run test:e2e:local

# Run a specific test file
bun run test:e2e:local -- tests/e2e/sync-stream.e2e.ts

# Run tests matching a pattern
bun run test:e2e:local -- -g "should reject"

# Run with list reporter for cleaner output
bun run test:e2e:local -- --reporter=list
```

The Docker image is built automatically on first run. To rebuild after changing `Dockerfile.e2e`:

```bash
docker rmi contfu-e2e && bun run test:e2e:local
```

### Full-flow E2E (rarely needed locally)

```bash
bun run test:e2e           # full build + tests
bun run test:e2e:no-build  # skip rebuild (faster iteration)
```

## Writing New E2E Tests

Place new tests in `packages/service/app/tests/` (or `tests/e2e/` subdirectory). Use the `*.e2e.ts` suffix.

**Development workflow:**

1. Write or edit your test file
2. Run it in isolation: `bun run test:e2e:local -- tests/e2e/your-test.e2e.ts`
3. Iterate — source changes are picked up on next run (the app rebuilds inside the container)
4. When passing, run the full suite to check for interactions: `bun run test:e2e:local`

## Test User

- **Email:** `test@test.com` | **Password:** `test`
- **Role:** Admin | **Approved:** Yes
- Created by `packages/service/backend/src/infra/db/seed-dev.ts`
- **DO NOT register new users** — triggers Polar customer creation

The test user's numeric ID is NOT guaranteed to be 1. Use the session API to get it:

```ts
const resp = await page.request.get(`${SERVICE_URL}/api/auth/get-session`);
const session = await resp.json();
const userId = Number(session.user.id);
```

## Login Helper

```ts
async function login(page: Page): Promise<void> {
  await page.goto(`${SERVICE_URL}/login`);
  await page.waitForLoadState("networkidle");
  if (!page.url().includes("/login")) return;
  await page.getByLabel(/Email/i).fill("test@test.com");
  await page.getByLabel(/Password/i).fill("test");
  await page.getByRole("button", { name: /Sign in|Log in|Login|Authenticate/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 10000 });
}
```

## Admin API for State Setup

Use admin API endpoints to set up test state instead of clicking through the UI. The test user is an admin, so these work with the page's cookies.

```ts
// Set base plan
await page.request.post(`${SERVICE_URL}/api/admin/set-plan`, {
  data: { userId, basePlan: 1 }, // 0=Free, 1=Starter, 2=Pro, 3=Business
});
```

Admin auth is enforced centrally in `hooks.server.ts` for all `/api/admin/*` routes.

## Shadcn/bits-ui Portal Gotchas

**Never rely on Playwright locators to target buttons inside shadcn dropdown portals.** Bits-ui renders dropdown content as portals appended to `<body>`. Closed portals may remain in the DOM with `opacity: 0` but non-zero bounding boxes, causing:

- `:visible` pseudo-class matches closed portals
- `.last()` / `.first()` picks the wrong portal
- `aria-controls` points to unmounted content
- `force: true` clicks at (0,0) for zero-dimension elements
- `page.evaluate` + `btn.click()` bypasses SvelteKit form handling

**Preferred pattern:** Use admin API endpoints for state changes, then verify the UI via navigation:

```ts
// ✅ Correct — API for state, UI for verification
await page.request.post(`${SERVICE_URL}/api/admin/set-plan`, { data: { userId, basePlan: 2 } });
await page.goto(`${SERVICE_URL}/dashboard`);
await expect(page.getByText("0 / 10000")).toBeVisible();

// ❌ Fragile — clicking portal-rendered dropdown buttons
const dropdown = page.locator('[data-slot="dropdown-menu-content"]');
await dropdown.locator("button").filter({ hasText: "Pro" }).click();
```

## Quota Cache

The in-memory quota cache uses fire-and-forget NATS messages for cross-node sync. After changing quota limits (e.g., via `setBasePlan`), the cache must be evicted synchronously with `evictCachedQuota()` — otherwise the next `getQuota()` call may return stale data.

## CI Notes

- E2E runs in a container with `registry.sven-rogge.com/contfu/ci-runner:latest`
- `E2E_FULL_FLOW=true` enables e2e tests
- `PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright` (pre-installed in CI image)
- Build: `NODE_ENV=test bun run build` then `bun run test:e2e:no-build`
- `@electric-sql/pglite` must be in adapter externals (see svelte-core-bestpractices skill)
