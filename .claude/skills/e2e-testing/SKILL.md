---
name: e2e-testing
description: Write and debug Playwright E2E tests for the Contfu service app. Use when creating new e2e tests, debugging test failures, or working with the e2e test infrastructure (global setup, PGlite, NATS, admin API).
---

# E2E Testing

Playwright E2E tests for the Contfu service app.

## Architecture

- **Test dir:** `tests/e2e/` — files match `**/*.e2e.ts`
- **Config:** `tests/playwright.config.ts`
- **Global setup:** `tests/e2e/global-setup.ts` — spawns a shared service app on port 8011
- **Database:** PGlite with filesystem storage (`PGLITE_DATA_DIR=/tmp/contfu-e2e-*`)
- **NATS:** JetStream started inline (CI) or external (local)
- **Execution:** Single worker, serial mode — tests share the service app and database state

## Running Tests

```bash
bun run test:e2e           # full build + tests
bun run test:e2e:no-build  # skip rebuild (faster iteration)
bun run test:e2e:headed    # see the browser
bun run test:e2e:ui        # interactive Playwright UI
```

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
await dropdown.locator('button').filter({ hasText: "Pro" }).click();
```

## Quota Cache

The in-memory quota cache uses fire-and-forget NATS messages for cross-node sync. After changing quota limits (e.g., via `setBasePlan`), the cache must be evicted synchronously with `evictCachedQuota()` — otherwise the next `getQuota()` call may return stale data.

## CI Notes

- E2E runs in a container with `registry.sven-rogge.com/contfu/ci-runner:latest`
- `E2E_FULL_FLOW=true` enables e2e tests
- `PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright` (pre-installed in CI image)
- Build: `NODE_ENV=test bun run build` then `bun run test:e2e:no-build`
- `@electric-sql/pglite` must be in adapter externals (see svelte-core-bestpractices skill)
