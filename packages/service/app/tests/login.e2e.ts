import { expect, test, TEST_USER } from "./fixtures";

test.describe("Login", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test("should display login form", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Sign in")).toBeVisible();
    await expect(page.getByLabel("email")).toBeVisible();
    await expect(page.getByLabel("password")).toBeVisible();
    await expect(page.getByRole("button", { name: "authenticate" })).toBeVisible();
  });

  test("should successfully login with test user credentials", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await page.getByLabel("email").fill(TEST_USER.email);
    await page.getByLabel("password").fill(TEST_USER.password);

    await Promise.all([
      page.waitForURL(/\/dashboard/, { timeout: 15_000 }),
      page.getByRole("button", { name: "authenticate" }).click(),
    ]);

    await expect(page).toHaveURL(/\/dashboard/);

    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name === "s");
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.value).toBeTruthy();
  });

  test("should show error message for incorrect password", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await page.getByLabel("email").fill(TEST_USER.email);
    await page.getByLabel("password").fill("wrongpassword");

    await page.getByRole("button", { name: "authenticate" }).click();

    await expect(page.getByText(/ERR:/)).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/login/);

    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name === "s");
    expect(sessionCookie).toBeUndefined();
  });

  test("should show error message for non-existent email", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await page.getByLabel("email").fill("nonexistent@test.com");
    await page.getByLabel("password").fill("anypassword");

    await page.getByRole("button", { name: "authenticate" }).click();

    await expect(page.getByText(/ERR:/)).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/login/);

    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name === "s");
    expect(sessionCookie).toBeUndefined();
  });

  test("should redirect to dashboard when accessing protected route after login", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await page.getByLabel("email").fill(TEST_USER.email);
    await page.getByLabel("password").fill(TEST_USER.password);

    await Promise.all([
      page.waitForURL(/\/dashboard/, { timeout: 15_000 }),
      page.getByRole("button", { name: "authenticate" }).click(),
    ]);

    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/sources");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/\/sources/);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("should redirect to login when accessing protected route without authentication", async ({
    page,
  }) => {
    await page.context().clearCookies();

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/\/login/);
  });

  test("should show loading state while submitting", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await page.getByLabel("email").fill(TEST_USER.email);
    await page.getByLabel("password").fill(TEST_USER.password);

    await page.getByRole("button", { name: "authenticate" }).click();

    // Button should briefly show "authenticating..." or we've already navigated
    const isAuthenticating = await page
      .getByRole("button", { name: "authenticating..." })
      .isVisible()
      .catch(() => false);
    const hasNavigated = page.url().includes("/dashboard");

    expect(isAuthenticating || hasNavigated).toBeTruthy();
  });
});
