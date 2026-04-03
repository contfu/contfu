import { expect, test, TEST_USER } from "./fixtures";

test.describe("CLI Login", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test("unauthenticated request redirects to login with next param", async ({ page }) => {
    await page.goto("/auth/cli?mode=code");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/\/login/);
    expect(page.url()).toContain("next=");
    expect(decodeURIComponent(page.url())).toContain("/auth/cli");
  });

  test("login with next param redirects back to original URL", async ({ page }) => {
    const cliUrl = "/auth/cli?mode=code";
    await page.goto(`/login?next=${encodeURIComponent(cliUrl)}`);
    await page.waitForLoadState("networkidle");

    await page.getByLabel("email").fill(TEST_USER.email);
    await page.getByLabel("password").fill(TEST_USER.password);

    await Promise.all([
      page.waitForURL(/\/auth\/cli/, { timeout: 15_000 }),
      page.getByRole("button", { name: "authenticate" }).click(),
    ]);

    await expect(page).toHaveURL(/\/auth\/cli/);
  });

  test("code-based login flow creates API key and shows success page", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/auth/cli?mode=code");

    await page.waitForURL(/\/auth\/cli\/success/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/auth\/cli\/success/);

    const url = new URL(page.url());
    const code = url.searchParams.get("code");
    expect(code).toBeTruthy();
    expect(code).toMatch(/^[A-F0-9]{8}$/);
  });

  test("code-based login rejects invalid callback", async ({ authenticatedPage: page }) => {
    const response = await page.request.get("/auth/cli?callback=https://evil.com&state=abc");
    expect(response.status()).toBe(400);
  });

  test("login without next param defaults to dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await page.getByLabel("email").fill(TEST_USER.email);
    await page.getByLabel("password").fill(TEST_USER.password);

    await Promise.all([
      page.waitForURL(/\/dashboard/, { timeout: 15_000 }),
      page.getByRole("button", { name: "authenticate" }).click(),
    ]);

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("open redirect is blocked — external next param falls back to dashboard", async ({
    page,
  }) => {
    await page.goto(`/login?next=https://evil.com`);
    await page.waitForLoadState("networkidle");

    await page.getByLabel("email").fill(TEST_USER.email);
    await page.getByLabel("password").fill(TEST_USER.password);

    await Promise.all([
      page.waitForURL(/\/dashboard/, { timeout: 15_000 }),
      page.getByRole("button", { name: "authenticate" }).click(),
    ]);

    await expect(page).toHaveURL(/\/dashboard/);
  });
});
