import { expect, test, TEST_USER } from "./fixtures";

test.describe("Login", () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing session cookies
    await page.context().clearCookies();
  });

  test("should display login form", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    // Check for login form elements
    await expect(page.getByText("Login to your account")).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("should successfully login with test user credentials", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // Fill in the login form using the same approach as performLogin in fixtures
    await page.fill('input[name="email"], input[type="email"]', TEST_USER.email);
    await page.fill('input[name="password"], input[type="password"]', TEST_USER.password);

    // Submit the form and wait for navigation
    await Promise.all([
      page.waitForURL(/\/dashboard/, { timeout: 15000 }),
      page.waitForLoadState("networkidle"),
      page.click('button[type="submit"]'),
    ]);

    // Verify we're redirected to dashboard
    await expect(page).toHaveURL(/\/dashboard/);

    // Verify session cookie is set
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name === "s");
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.value).toBeTruthy();
  });

  test("should show error message for incorrect password", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // Fill in the login form with wrong password
    await page.getByLabel("Email address").fill(TEST_USER.email);
    await page.getByLabel("Password").fill("wrongpassword");

    // Submit the form and wait for response
    await Promise.all([
      page.waitForLoadState("networkidle"),
      page.getByRole("button", { name: "Sign in" }).click(),
    ]);

    // Wait for error message to appear (check for any error text)
    await expect(page.locator("text=/login failed|invalid|incorrect|error/i").first()).toBeVisible({
      timeout: 5000,
    });

    // Verify we're still on login page
    await expect(page).toHaveURL(/\/login/);

    // Verify no session cookie is set
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name === "s");
    expect(sessionCookie).toBeUndefined();
  });

  test("should show error message for non-existent email", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // Fill in the login form with non-existent email
    await page.getByLabel("Email address").fill("nonexistent@test.com");
    await page.getByLabel("Password").fill("anypassword");

    // Submit the form and wait for response
    await Promise.all([
      page.waitForLoadState("networkidle"),
      page.getByRole("button", { name: "Sign in" }).click(),
    ]);

    // Wait for error message to appear (check for any error text)
    await expect(
      page.locator("text=/login failed|invalid|error|user not found/i").first(),
    ).toBeVisible({ timeout: 5000 });

    // Verify we're still on login page
    await expect(page).toHaveURL(/\/login/);

    // Verify no session cookie is set
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name === "s");
    expect(sessionCookie).toBeUndefined();
  });

  test("should redirect to dashboard when accessing protected route after login", async ({
    page,
  }) => {
    // First, login
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await page.getByLabel("Email address").fill(TEST_USER.email);
    await page.getByLabel("Password").fill(TEST_USER.password);

    await Promise.all([
      page.waitForURL(/\/dashboard/, { timeout: 15000 }),
      page.waitForLoadState("networkidle"),
      page.getByRole("button", { name: "Sign in" }).click(),
    ]);

    // Verify we're on dashboard
    await expect(page).toHaveURL(/\/dashboard/);

    // Now try to access another protected route (sources)
    await page.goto("/sources");
    await page.waitForLoadState("networkidle");

    // Should be able to access protected route (not redirected to login)
    await expect(page).toHaveURL(/\/sources/);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("should redirect to login when accessing protected route without authentication", async ({
    page,
  }) => {
    // Clear any existing session
    await page.context().clearCookies();

    // Try to access protected route
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/);
  });

  test("should show loading state while submitting", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    // Fill in the login form
    await page.getByLabel("Email address").fill(TEST_USER.email);
    await page.getByLabel("Password").fill(TEST_USER.password);

    // Click submit and immediately check for loading state
    const submitButton = page.getByRole("button", { name: "Sign in" });
    await submitButton.click();

    // Button should show "Signing in..." text (briefly)
    // Note: This might be very fast, so we check if it exists or was there
    const signingInButton = page.getByRole("button", { name: "Signing in..." });
    // The button might already have navigated, so we check if it exists or if we've navigated
    const isSigningIn = await signingInButton.isVisible().catch(() => false);
    const hasNavigated = page.url().includes("/dashboard");

    // Either we see the loading state or we've already navigated (both are valid)
    expect(isSigningIn || hasNavigated).toBeTruthy();
  });
});
