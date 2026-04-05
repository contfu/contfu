import { test, expect } from "./fixtures";

test.describe("Connections Management", () => {
  test.describe("Connections List Page", () => {
    test("should show connections table with seeded data", async ({ authenticatedPage: page }) => {
      await page.goto("/connections");
      await page.waitForLoadState("networkidle");

      // Seed data creates connections, so the table should be visible
      await expect(page.locator("table")).toBeVisible();

      // Should show connection names in the table
      const rows = await page.locator("tbody tr").count();
      expect(rows).toBeGreaterThan(0);
    });

    test("should show connection type and status columns", async ({ authenticatedPage: page }) => {
      await page.goto("/connections");
      await page.waitForLoadState("networkidle");

      // Table headers
      await expect(page.locator("th", { hasText: "name" })).toBeVisible();
      await expect(page.locator("th", { hasText: "type" })).toBeVisible();
      await expect(page.locator("th", { hasText: "status" })).toBeVisible();
    });
  });

  test.describe("Add Connection Page", () => {
    test("should show add connection form with tabs", async ({ authenticatedPage: page }) => {
      await page.goto("/connections/new");
      await page.waitForLoadState("networkidle");

      await expect(page.getByRole("tab", { name: "service" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "app" })).toBeVisible();

      // Provider dropdown
      await expect(page.locator("select")).toBeVisible();
    });

    test("should show OAuth flow for Notion provider", async ({ authenticatedPage: page }) => {
      await page.goto("/connections/new");
      await page.waitForLoadState("networkidle");

      // Notion is selected by default — shows connect button
      await expect(page.getByRole("button", { name: /connect notion/i })).toBeVisible();

      // Should NOT show name/token fields (OAuth flow)
      await expect(page.getByPlaceholder("My workspace")).not.toBeVisible();
    });

    test("should show API token form for Strapi provider", async ({ authenticatedPage: page }) => {
      await page.goto("/connections/new");
      await page.waitForLoadState("networkidle");

      // Switch from default Notion to Strapi
      await page.locator("select").selectOption("strapi");

      await expect(page.getByPlaceholder("My workspace")).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.getByRole("button", { name: /add connection/i })).toBeVisible();
    });

    test("should show API token form for Contentful provider", async ({
      authenticatedPage: page,
    }) => {
      await page.goto("/connections/new");
      await page.waitForLoadState("networkidle");

      await page.locator("select").selectOption("contentful");

      await expect(page.getByPlaceholder("My workspace")).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
    });

    test("should validate required fields", async ({ authenticatedPage: page }) => {
      await page.goto("/connections/new");
      await page.waitForLoadState("networkidle");

      // Switch to Strapi (non-OAuth form)
      await page.locator("select").selectOption("strapi");

      // Try to submit without filling fields — browser prevents submission
      await page.getByRole("button", { name: /add connection/i }).click();

      // Should still be on the same page (browser validation prevents navigation)
      await expect(page).toHaveURL(/\/connections\/new/);
    });

    test("should show app tab form", async ({ authenticatedPage: page }) => {
      await page.goto("/connections/new");
      await page.waitForLoadState("networkidle");

      // Switch to app tab
      await page.getByRole("tab", { name: "app" }).click();

      await expect(page.getByPlaceholder("My App")).toBeVisible();
      await expect(page.getByRole("button", { name: /create app/i })).toBeVisible();
    });

    test("should have back link to connections list", async ({ authenticatedPage: page }) => {
      await page.goto("/connections/new");
      await page.waitForLoadState("networkidle");

      await expect(page.getByText("< connections")).toBeVisible();
    });
  });

  test.describe("Edit Connection Page", () => {
    test("should show connection details via seeded data", async ({ authenticatedPage: page }) => {
      // Navigate to connections list and click the first connection
      await page.goto("/connections");
      await page.waitForLoadState("networkidle");

      const firstLink = page.locator("tbody tr:first-child td:first-child a");
      await expect(firstLink).toBeVisible();
      await firstLink.click();
      await page.waitForURL(/\/connections\/\d+/);
      await page.waitForLoadState("networkidle");

      // Should show connection detail page with danger zone and back link
      await expect(page.getByText("DANGER ZONE")).toBeVisible();
      await expect(page.getByText("< connections")).toBeVisible();
    });

    test("should show danger zone with delete button", async ({ authenticatedPage: page }) => {
      await page.goto("/connections");
      await page.waitForLoadState("networkidle");

      const firstLink = page.locator("tbody tr:first-child td:first-child a");
      await firstLink.click();
      await page.waitForURL(/\/connections\/\d+/);
      await page.waitForLoadState("networkidle");

      await expect(page.getByText("DANGER ZONE")).toBeVisible();
      await expect(page.getByRole("button", { name: /Delete Connection/i })).toBeVisible();
    });

    test("should show back link to connections", async ({ authenticatedPage: page }) => {
      await page.goto("/connections");
      await page.waitForLoadState("networkidle");

      const firstLink = page.locator("tbody tr:first-child td:first-child a");
      await firstLink.click();
      await page.waitForURL(/\/connections\/\d+/);
      await page.waitForLoadState("networkidle");

      await expect(page.getByText("< connections")).toBeVisible();
    });
  });

  test.describe("Dashboard Integration", () => {
    test("should show connections section on dashboard", async ({ authenticatedPage: page }) => {
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      // Dashboard shows "connections" stat
      await expect(page.getByText("connections").first()).toBeVisible();
    });

    test("should show connections table on dashboard", async ({ authenticatedPage: page }) => {
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      // Seed data creates connections, so the table should be visible
      await expect(page.locator("table").first()).toBeVisible();
    });
  });
});
