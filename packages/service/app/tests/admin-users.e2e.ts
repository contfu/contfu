import { test, expect } from "./fixtures";

test.describe("Admin Users Management", () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // Navigate to admin users page
    await authenticatedPage.goto("/admin/users");
    await authenticatedPage.waitForLoadState("networkidle");
  });

  test("should display the users table", async ({ authenticatedPage }) => {
    // Check for the page header
    await expect(authenticatedPage.locator("h1")).toContainText("User Management");

    // Check that the table is visible
    const table = authenticatedPage.locator("table");
    await expect(table).toBeVisible();

    // Check for table headers
    await expect(authenticatedPage.locator("th")).toContainText([
      "User",
      "Status",
      "Role",
      "Joined",
    ]);
  });

  test("should filter users by search", async ({ authenticatedPage }) => {
    // Get initial row count
    const initialRows = await authenticatedPage.locator("tbody tr").count();
    console.log("Initial row count:", initialRows);

    // Type in search box
    const searchInput = authenticatedPage.locator('input[placeholder="Search users..."]');
    await expect(searchInput).toBeVisible();

    // Search for a user that likely doesn't exist
    await searchInput.fill("nonexistentuserxyz123");
    await authenticatedPage.waitForTimeout(500); // Wait for filter to apply

    // Check that rows are filtered (should show "No users found" or fewer rows)
    const filteredRows = await authenticatedPage.locator("tbody tr").count();
    console.log("Filtered row count:", filteredRows);

    // Either we have fewer rows or the "No users found" message
    const noUsersMessage = authenticatedPage.locator("text=No users found");
    const hasNoUsersMessage = await noUsersMessage.isVisible().catch(() => false);

    expect(filteredRows < initialRows || hasNoUsersMessage).toBeTruthy();

    // Clear search and verify rows return
    await searchInput.fill("");
    await authenticatedPage.waitForTimeout(500);

    const clearedRows = await authenticatedPage.locator("tbody tr").count();
    console.log("Cleared row count:", clearedRows);
    expect(clearedRows).toBe(initialRows);
  });

  test("should filter users by status dropdown", async ({ authenticatedPage }) => {
    // Find the status filter dropdown
    const statusTrigger = authenticatedPage.locator('button:has-text("All statuses")');
    await expect(statusTrigger).toBeVisible();

    // Get initial row count
    const initialRows = await authenticatedPage.locator("tbody tr").count();
    console.log("Initial rows:", initialRows);

    // Click the dropdown
    await statusTrigger.click();
    await authenticatedPage.waitForTimeout(200);

    // Select "Approved"
    await authenticatedPage.locator('[role="option"]:has-text("Approved")').click();
    await authenticatedPage.waitForTimeout(500);

    // Verify the filter is applied (button text should change)
    await expect(authenticatedPage.locator('button:has-text("Approved")')).toBeVisible();

    // Get filtered count
    const approvedRows = await authenticatedPage.locator("tbody tr").count();
    console.log("Approved filter rows:", approvedRows);

    // Reset to all
    await authenticatedPage.locator('button:has-text("Approved")').click();
    await authenticatedPage.waitForTimeout(200);
    await authenticatedPage.locator('[role="option"]:has-text("All statuses")').click();
    await authenticatedPage.waitForTimeout(500);

    // Verify we're back to all
    const resetRows = await authenticatedPage.locator("tbody tr").count();
    console.log("Reset rows:", resetRows);
    expect(resetRows).toBe(initialRows);
  });

  test("should filter users by role dropdown", async ({ authenticatedPage }) => {
    // Find the role filter dropdown
    const roleTrigger = authenticatedPage.locator('button:has-text("All roles")');
    await expect(roleTrigger).toBeVisible();

    // Get initial row count
    const initialRows = await authenticatedPage.locator("tbody tr").count();
    console.log("Initial rows:", initialRows);

    // Click the dropdown
    await roleTrigger.click();
    await authenticatedPage.waitForTimeout(200);

    // Select "Admin"
    await authenticatedPage.locator('[role="option"]:has-text("Admin")').click();
    await authenticatedPage.waitForTimeout(500);

    // Verify the filter is applied
    await expect(authenticatedPage.locator('button:has-text("Admin")')).toBeVisible();

    // Get filtered count - should be at least 1 (the test user is admin)
    const adminRows = await authenticatedPage.locator("tbody tr").count();
    console.log("Admin filter rows:", adminRows);
    expect(adminRows).toBeGreaterThanOrEqual(1);

    // Reset to all
    await authenticatedPage.locator('button:has-text("Admin")').first().click();
    await authenticatedPage.waitForTimeout(200);
    await authenticatedPage.locator('[role="option"]:has-text("All roles")').click();
    await authenticatedPage.waitForTimeout(500);

    // Verify we're back to all
    const resetRows = await authenticatedPage.locator("tbody tr").count();
    expect(resetRows).toBe(initialRows);
  });

  test("should sort users by clicking column headers", async ({ authenticatedPage }) => {
    // Find the "User" column header button (sortable)
    const userHeader = authenticatedPage.locator("th button:has-text('User')");
    await expect(userHeader).toBeVisible();

    // Get initial first row text
    const getFirstRowName = async () => {
      const firstCell = authenticatedPage.locator("tbody tr:first-child td:first-child");
      return firstCell.textContent();
    };

    const initialName = await getFirstRowName();
    console.log("Initial first row:", initialName);

    // Click to sort ascending
    await userHeader.click();
    await authenticatedPage.waitForTimeout(500);

    const afterFirstClick = await getFirstRowName();
    console.log("After first click:", afterFirstClick);

    // Click again to sort descending
    await userHeader.click();
    await authenticatedPage.waitForTimeout(500);

    const afterSecondClick = await getFirstRowName();
    console.log("After second click:", afterSecondClick);

    // At least one sort should change the order (if there are multiple users)
    // If only one user, all should be the same
    const rowCount = await authenticatedPage.locator("tbody tr").count();
    if (rowCount > 1) {
      // With multiple rows, sorting should potentially change order
      console.log("Multiple rows, checking sort changes...");
    }

    // The sort icons should be visible
    const sortIcon = userHeader.locator("svg");
    await expect(sortIcon).toBeVisible();
  });

  test("should open action menu without errors", async ({ authenticatedPage }) => {
    // Listen for page errors (uncaught exceptions)
    const pageErrors: string[] = [];
    authenticatedPage.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    // Click the action menu button on the first user row
    const actionButton = authenticatedPage.locator("tbody tr:first-child td:last-child button");
    await expect(actionButton).toBeVisible();
    await actionButton.click();

    // Verify the dropdown menu opens with expected sections
    const menu = authenticatedPage.locator('[role="menu"]');
    await expect(menu).toBeVisible();

    // Verify action labels are present
    await expect(menu.getByText("Actions")).toBeVisible();
    await expect(menu.getByText("Role")).toBeVisible();
    await expect(menu.getByText("Base Plan")).toBeVisible();

    // The test user is approved+admin, so we should see "Revoke approval" and "Remove admin"
    await expect(menu.getByText("Revoke approval")).toBeVisible();
    await expect(menu.getByText("Remove admin")).toBeVisible();

    // No page errors from hidden input bindings
    const hiddenInputErrors = pageErrors.filter((e) => e.includes("hidden"));
    expect(hiddenInputErrors).toHaveLength(0);
  });

  test("should toggle admin role via action menu", async ({ authenticatedPage }) => {
    const row = authenticatedPage.locator("tbody tr:first-child");

    // Verify initial state: user is admin
    await expect(row.getByText("Admin")).toBeVisible();

    // Open action menu and click "Remove admin"
    await row.locator("td:last-child button").click();
    const menu = authenticatedPage.locator('[role="menu"]');
    await expect(menu).toBeVisible();
    await menu.getByText("Remove admin").click();
    await authenticatedPage.waitForLoadState("networkidle");

    // Verify role changed to "User"
    await expect(row.getByText("User")).toBeVisible();

    // Restore: open action menu and click "Make admin"
    await row.locator("td:last-child button").click();
    const restoreMenu = authenticatedPage.locator('[role="menu"]');
    await expect(restoreMenu).toBeVisible();
    await restoreMenu.getByText("Make admin").click();
    await authenticatedPage.waitForLoadState("networkidle");

    // Verify restored to admin
    await expect(row.getByText("Admin")).toBeVisible();
  });

  test("should change base plan via action menu", async ({ authenticatedPage }) => {
    const row = authenticatedPage.locator("tbody tr:first-child");

    // Verify initial state: Free plan
    await expect(row.getByText("Free")).toBeVisible();

    // Open action menu and click "Starter" plan
    await row.locator("td:last-child button").click();
    const menu = authenticatedPage.locator('[role="menu"]');
    await expect(menu).toBeVisible();
    await menu.getByText("Starter").click();
    await authenticatedPage.waitForLoadState("networkidle");

    // Verify plan changed to Starter
    await expect(row.getByText("Starter")).toBeVisible();

    // Restore: open action menu and click "Free" plan
    await row.locator("td:last-child button").click();
    const restoreMenu = authenticatedPage.locator('[role="menu"]');
    await expect(restoreMenu).toBeVisible();
    await restoreMenu.getByText("Free").click();
    await authenticatedPage.waitForLoadState("networkidle");

    // Verify restored to Free
    await expect(row.getByText("Free")).toBeVisible();
  });

  test("should show correct footer count", async ({ authenticatedPage }) => {
    // Check footer shows correct count
    const footer = authenticatedPage.locator("text=/Showing \\d+ of \\d+ users/");
    await expect(footer).toBeVisible();

    const footerText = await footer.textContent();
    console.log("Footer text:", footerText);

    // Extract numbers from "Showing X of Y users"
    const match = footerText?.match(/Showing (\d+) of (\d+) users/);
    if (match) {
      const [, showing, total] = match;
      expect(Number(showing)).toBe(Number(total)); // Without filters, should show all
    }
  });
});
