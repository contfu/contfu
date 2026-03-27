import { expect, test } from "./fixtures";

test.describe("Registration", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test("should redirect to success page after email sign-up", async ({ page }) => {
    await page.goto("/register");
    await page.waitForLoadState("networkidle");

    const unique = Date.now();
    await page.fill('input[id="name"]', "Test User");
    await page.fill('input[id="email"]', `register-${unique}@test.com`);
    await page.fill('input[id="password"]', "testpassword123");

    await Promise.all([
      page.waitForURL(/\/register\/success/, { timeout: 15000 }),
      page.click('button[type="submit"]'),
    ]);

    await expect(page).toHaveURL(/\/register\/success/);
    await expect(page.getByText("account created")).toBeVisible();
    await expect(page.getByText("verification email")).toBeVisible();
    await expect(page.getByText("close this tab")).toBeVisible();
  });
});
