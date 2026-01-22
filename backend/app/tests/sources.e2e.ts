import { test, expect } from "./fixtures";

test.describe("Sources Management", () => {
  test.describe("Sources List Page", () => {
    test("should show empty state when no sources exist", async ({ authenticatedPage: page }) => {
      await page.goto("/sources");

      // Debug: take screenshot to see what's on the page
      await page.screenshot({ path: "test-results/sources-page.png" });

      // Should show empty state message
      await expect(page.getByText("No sources configured")).toBeVisible();
      await expect(page.getByText("Add your first content source")).toBeVisible();
    });

    test("should have link to add new source", async ({ authenticatedPage: page }) => {
      await page.goto("/sources");

      // Should have "Add Source" button
      const addButton = page.getByRole("link", { name: "Add Source" });
      await expect(addButton).toBeVisible();

      // Click should navigate to new source page
      await addButton.click();
      await expect(page).toHaveURL("/sources/new");
    });
  });

  test.describe("Add Source Page", () => {
    test("should show add source form", async ({ authenticatedPage: page }) => {
      await page.goto("/sources/new");

      // Should show form title
      await expect(page.getByText("Add New Source")).toBeVisible();

      // Should show form fields
      await expect(page.getByLabel("Name")).toBeVisible();
      // bits-ui Select uses aria-label for the trigger
      await expect(page.getByLabel("Source Type")).toBeVisible();
      await expect(page.getByLabel("API Token")).toBeVisible();
    });

    test("should show URL field only for Strapi", async ({ authenticatedPage: page }) => {
      await page.goto("/sources/new");

      // Strapi is selected by default, URL should be visible
      await expect(page.getByLabel("Strapi URL")).toBeVisible();

      // Switch to Notion using the select trigger with aria-label
      const selectTrigger = page.getByLabel("Source Type");
      await selectTrigger.click();
      // bits-ui items have data-slot="select-item" attribute
      await page.locator('[data-slot="select-item"]', { hasText: "Notion" }).click();

      // URL field should be hidden for Notion
      await expect(page.getByLabel("Strapi URL")).not.toBeVisible();

      // Switch back to Strapi
      await selectTrigger.click();
      await page.locator('[data-slot="select-item"]', { hasText: "Strapi" }).click();

      // URL field should be visible again
      await expect(page.getByLabel("Strapi URL")).toBeVisible();
    });

    test("should validate required fields", async ({ authenticatedPage: page }) => {
      await page.goto("/sources/new");

      // Try to submit empty form by clicking Create Source
      await page.getByRole("button", { name: "Create Source" }).click();

      // Browser should prevent submission due to required fields
      // The form should still be on the same page
      await expect(page).toHaveURL("/sources/new");
    });

    test("should create a new Strapi source", async ({ authenticatedPage: page }) => {
      await page.goto("/sources/new");

      // Fill in the form
      await page.getByLabel("Name").fill("Test Strapi Source");
      await page.getByLabel("Strapi URL").fill("https://strapi.example.com");
      await page.getByLabel("API Token").fill("test-token-12345");

      // Submit the form
      await page.getByRole("button", { name: "Create Source" }).click();

      // Should redirect to the source edit page
      await expect(page).toHaveURL(/\/sources\/\d+/);

      // Wait for the page to fully load
      await page.waitForLoadState("networkidle");

      // Should show the source name in the input field
      await expect(page.getByLabel("Name")).toHaveValue("Test Strapi Source");

      // Should show the Strapi badge (use exact match)
      await expect(page.getByText("Strapi", { exact: true })).toBeVisible();
    });

    test("should have back link to sources list", async ({ authenticatedPage: page }) => {
      await page.goto("/sources/new");

      const backLink = page.getByRole("link", { name: /Back to Sources/i });
      await expect(backLink).toBeVisible();

      await backLink.click();
      await expect(page).toHaveURL("/sources");
    });
  });

  test.describe("Edit Source Page", () => {
    // Helper to create a source before each test
    async function createTestSource(page: import("@playwright/test").Page) {
      await page.goto("/sources/new");
      await page.getByLabel("Name").fill("Edit Test Source");
      await page.getByLabel("Strapi URL").fill("https://strapi.example.com");
      await page.getByLabel("API Token").fill("test-token-edit");
      await page.getByRole("button", { name: "Create Source" }).click();
      await page.waitForURL(/\/sources\/\d+/);
      // Wait for the page to fully load
      await page.waitForLoadState("networkidle");
    }

    test("should show source details", async ({ authenticatedPage: page }) => {
      await createTestSource(page);

      // Should show the source name in the input field
      await expect(page.getByLabel("Name")).toHaveValue("Edit Test Source");

      // Should show Strapi badge (use exact match)
      await expect(page.getByText("Strapi", { exact: true })).toBeVisible();

      // Should show source information section
      await expect(page.getByText("Source Information")).toBeVisible();
      await expect(page.getByText("Collections:")).toBeVisible();
      await expect(page.getByText("Created:")).toBeVisible();
    });

    test("should update source name", async ({ authenticatedPage: page }) => {
      await createTestSource(page);

      // Update the name
      await page.getByLabel("Name").fill("Updated Source Name");
      await page.getByRole("button", { name: "Save Changes" }).click();

      // Wait for the form submission to complete
      await page.waitForLoadState("networkidle");

      // Verify the update worked by checking the "Last updated" field appears
      await expect(page.getByText("Last updated:")).toBeVisible();

      // And the name should still show the updated value
      await expect(page.getByLabel("Name")).toHaveValue("Updated Source Name");
    });

    test("should show danger zone with delete button", async ({ authenticatedPage: page }) => {
      await createTestSource(page);

      // Should show danger zone
      await expect(page.getByText("Danger Zone")).toBeVisible();
      await expect(page.getByRole("button", { name: "Delete Source" })).toBeVisible();
    });

    test("should delete source with confirmation", async ({ authenticatedPage: page }) => {
      await createTestSource(page);

      // Set up dialog handler to accept confirmation
      page.on("dialog", (dialog) => dialog.accept());

      // Click delete button
      await page.getByRole("button", { name: "Delete Source" }).click();

      // Should redirect to sources list
      await expect(page).toHaveURL("/sources");
    });

    test("should have delete button requiring confirmation", async ({
      authenticatedPage: page,
    }) => {
      await createTestSource(page);

      // The delete button should exist and be visible
      const deleteButton = page.getByRole("button", { name: "Delete Source" });
      await expect(deleteButton).toBeVisible();

      // It should be inside the danger zone section
      await expect(page.getByText("Danger Zone")).toBeVisible();
      await expect(
        page.getByText("Deleting this source will also delete all associated collections."),
      ).toBeVisible();
    });
  });

  test.describe("Dashboard Integration", () => {
    test("should show created source in sources list", async ({ authenticatedPage: page }) => {
      // First create a source with a unique name
      const sourceName = `Test Source ${Date.now()}`;
      await page.goto("/sources/new");
      await page.getByLabel("Name").fill(sourceName);
      await page.getByLabel("Strapi URL").fill("https://strapi.example.com");
      await page.getByLabel("API Token").fill("test-token-dashboard");
      await page.getByRole("button", { name: "Create Source" }).click();
      await page.waitForURL(/\/sources\/\d+/);
      await page.waitForLoadState("networkidle");

      // Navigate to sources list page to verify the source was created
      await page.goto("/sources");
      await page.waitForLoadState("networkidle");

      // Should show the source in the list (find the card with our source name)
      const sourceCard = page.locator('[data-slot="card"]', { hasText: sourceName });
      await expect(sourceCard).toBeVisible();
      // The card should contain the Strapi badge
      await expect(sourceCard.getByText("Strapi", { exact: true })).toBeVisible();
    });

    test("should show sources section on dashboard", async ({ authenticatedPage: page }) => {
      // authenticatedPage fixture already navigates to dashboard
      // Wait for the page to fully load
      await page.waitForLoadState("networkidle");

      // Check for sources section heading (it's an h2 not h1)
      await expect(page.getByRole("heading", { name: "Sources", level: 2 })).toBeVisible();
    });

    test("should have link to add source from dashboard", async ({ authenticatedPage: page }) => {
      // authenticatedPage fixture already navigates to dashboard
      await page.waitForLoadState("networkidle");

      // Should have "Add Source" button
      const addButton = page.getByRole("link", { name: "Add Source" });
      await expect(addButton).toBeVisible();

      await addButton.click();
      await expect(page).toHaveURL("/sources/new");
    });
  });

  test.describe("Source Types", () => {
    test("should create a Notion source without URL", async ({ authenticatedPage: page }) => {
      await page.goto("/sources/new");

      // Select Notion type using the select trigger with aria-label
      const selectTrigger = page.getByLabel("Source Type");
      await selectTrigger.click();
      await page.locator('[data-slot="select-item"]', { hasText: "Notion" }).click();

      // Fill in the form (no URL needed for Notion)
      await page.getByLabel("Name").fill("Test Notion Source");
      await page.getByLabel("API Token").fill("secret_notion_token");

      // Submit the form
      await page.getByRole("button", { name: "Create Source" }).click();

      // Should redirect to the source edit page
      await expect(page).toHaveURL(/\/sources\/\d+/);

      // Should show Notion badge (use exact match to avoid matching description text)
      await expect(page.getByText("Notion", { exact: true })).toBeVisible();
    });
  });
});
