import { test, expect } from "../fixtures";
import { COLLECTION_NAME, COLLECTION2_NAME } from "./mapping-editor.seed";

test.describe("Mapping Editor", () => {
  test.setTimeout(15_000);

  /** Navigate to a collection by its camelCase name. */
  async function goToCollection(page: import("@playwright/test").Page, name: string) {
    await page.goto("/collections");
    const link = page.getByRole("link", { name });
    await expect(link).toBeVisible({ timeout: 3000 });
    await link.click();
    await page.waitForLoadState("networkidle");
  }

  /** Get the nth accordion item (0-indexed). */
  function nthItem(page: import("@playwright/test").Page, n: number) {
    return page.locator('[data-slot="accordion-item"]').nth(n);
  }

  /** Expand the nth accordion property. */
  async function expandNth(page: import("@playwright/test").Page, n: number) {
    await nthItem(page, n).locator('[data-slot="accordion-trigger"]').click();
    await page.waitForTimeout(150);
  }

  /** Wait for inflow rows to appear in the MappingEditor. */
  async function waitForInflowRows(page: import("@playwright/test").Page) {
    await expect(page.getByText("Source A").first()).toBeVisible({ timeout: 5000 });
  }

  test("should populate source field selects after page reload", async ({
    authenticatedPage: page,
  }) => {
    // Navigate to the collection, then reload to simulate a fresh page load
    // with existing inflowes (the exact scenario reported as broken).
    await goToCollection(page, COLLECTION_NAME);
    await waitForInflowRows(page);

    // Hard reload
    await page.reload();
    await page.waitForLoadState("networkidle");
    await waitForInflowRows(page);

    // Expand "title"
    await expandNth(page, 0);
    const item = nthItem(page, 0);

    const sourceASection = item.locator("div.rounded-md").filter({ hasText: "Source A" });
    const sourceASelect = sourceASection.locator("select").first();
    await expect(sourceASelect).toHaveValue("title", { timeout: 5000 });

    const sourceBSection = item.locator("div.rounded-md").filter({ hasText: "Source B" });
    const sourceBSelect = sourceBSection.locator("select").first();
    await expect(sourceBSelect).toHaveValue("title", { timeout: 5000 });
  });

  test("should persist target type after save and reload", async ({ authenticatedPage: page }) => {
    await goToCollection(page, COLLECTION_NAME);
    await waitForInflowRows(page);

    await expandNth(page, 1);
    const item = nthItem(page, 1);

    await item.locator("select").first().selectOption({ label: "text" });

    const saveButton = page.getByRole("button", { name: "Save" });
    await expect(saveButton).toBeVisible({ timeout: 2000 });
    await saveButton.click();

    await expect(saveButton).not.toBeVisible({ timeout: 5000 });

    await page.reload();
    await page.waitForLoadState("networkidle");

    await waitForInflowRows(page);
    await expect(page.locator('[data-slot="accordion-trigger"]')).toHaveCount(4, { timeout: 3000 });

    await expandNth(page, 1);
    await expect(nthItem(page, 1).locator("select").first()).toHaveValue(String(2), {
      timeout: 3000,
    });
  });

  test("should remove nullable marker when default value is set", async ({
    authenticatedPage: page,
  }) => {
    await goToCollection(page, COLLECTION_NAME);
    await waitForInflowRows(page);

    // "count" has no mapping from Source B, so it should show as nullable (?)
    // The type badge in the accordion trigger should contain "?"
    const countTrigger = nthItem(page, 1).locator('[data-slot="accordion-trigger"]');
    await expect(countTrigger.getByText("?")).toBeVisible({ timeout: 2000 });

    // Expand "count" to set a default on Source B's unmapped row
    await expandNth(page, 1);
    const item = nthItem(page, 1);

    // Find the Source B section and its Default input
    const sourceBSection = item.locator("div.rounded-md").filter({ hasText: "Source B" });
    const defaultInput = sourceBSection.getByPlaceholder("Default value");
    await expect(defaultInput).toBeVisible({ timeout: 2000 });
    await defaultInput.fill("0");
    // Trigger input event by pressing Tab
    await defaultInput.press("Tab");

    // The "?" should now disappear from the badge (property is no longer nullable)
    await expect(countTrigger.getByText("?")).not.toBeVisible({ timeout: 2000 });
  });

  test("should save mappings after adding a second inflow and clear warnings", async ({
    authenticatedPage: page,
  }) => {
    // Use collection2 which has 1 inflow (Source A) and an unlinked Source C
    await goToCollection(page, COLLECTION2_NAME);
    await waitForInflowRows(page);

    // Should have 4 properties from Source A's schema
    await expect(page.locator('[data-slot="accordion-trigger"]')).toHaveCount(4, { timeout: 3000 });

    // Add second inflow via the AddInflowDialog
    await page.getByRole("button", { name: "Add Inflow" }).click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const sourceCItem = dialog.getByText("Source C");
    await expect(sourceCItem).toBeVisible({ timeout: 5000 });
    await sourceCItem.click();

    // Dialog should close, pending inflow should appear with "unsaved" badge
    await expect(dialog).not.toBeVisible({ timeout: 2000 });
    await expect(page.getByText("unsaved").first()).toBeVisible({ timeout: 2000 });

    // Wait for Source C to appear in the mapping editor
    await expect(page.getByText("Source C").first()).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1000); // let reactivity settle

    // Source C has partial overlap — some properties should show warnings
    const warningIcons = page.locator('[data-slot="accordion-trigger"] svg.lucide-triangle-alert');
    await expect(warningIcons.first()).toBeVisible({ timeout: 5000 });
    const initialWarnings = await warningIcons.count();
    expect(initialWarnings).toBeGreaterThan(0);

    // Save
    const saveButton = page.getByRole("button", { name: "Save" });
    await expect(saveButton).toBeVisible({ timeout: 2000 });
    await saveButton.click();

    // Save should succeed — button disappears, no error toast
    await expect(saveButton).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Failed to save")).not.toBeVisible();

    // After save, warnings should be cleared
    await expect(warningIcons).toHaveCount(0, { timeout: 3000 });

    // Verify: reload and check both inflowes are present
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Both Source A and Source C should appear
    await expect(page.getByText("Source A").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Source C").first()).toBeVisible({ timeout: 5000 });
  });

  // Destructive test — must run last as it deletes inflowes from collection2
  test("should hide properties and Add property button when all inflowes are removed", async ({
    authenticatedPage: page,
  }) => {
    await goToCollection(page, COLLECTION2_NAME);
    await waitForInflowRows(page);

    // Properties and Add property button should be visible with inflowes present
    await expect(page.locator('[data-slot="accordion-trigger"]')).not.toHaveCount(0, {
      timeout: 3000,
    });
    await expect(page.getByText("Add property").first()).toBeVisible();

    // Delete all inflowes via their trash icons (inside inflow row forms)
    // Collection2 now has Source A + Source C (from previous test)
    // Each inflow row is: div.flex > div + form > button[type=submit]
    const inflowForms = page.locator("div.flex.items-center.justify-between > form");
    let formCount = await inflowForms.count();
    while (formCount > 0) {
      await inflowForms.first().locator('button[type="submit"]').click();
      // Wait for removal to complete
      await expect(inflowForms).toHaveCount(formCount - 1, { timeout: 5000 });
      formCount = await inflowForms.count();
    }

    // After all inflowes removed: properties gone, Add property hidden, empty message shown
    await expect(page.locator('[data-slot="accordion-trigger"]')).toHaveCount(0, { timeout: 5000 });
    await expect(page.getByText("Add property")).not.toBeVisible({ timeout: 2000 });
    await expect(page.getByText("No inflows configured yet")).toBeVisible({ timeout: 2000 });
  });
});
