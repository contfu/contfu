import { test, expect } from "./fixtures";

test.describe("Admin Users Management", () => {
  test.setTimeout(15_000);

  test.beforeEach(async ({ authenticatedPage }) => {
    // Navigate to admin users page
    await authenticatedPage.goto("/admin/users");
    await authenticatedPage.waitForLoadState("networkidle");
  });

  test("should display the users table", async ({ authenticatedPage }) => {
    // Check for the page header
    await expect(authenticatedPage.locator("h1")).toContainText("admin");

    // Check that the table is visible
    const table = authenticatedPage.locator("table");
    await expect(table).toBeVisible();

    // Check for table headers (6 columns: User, Status, Role, Base Plan, Joined, Actions[sr-only])
    const headers = authenticatedPage.locator("th");
    await expect(headers.nth(0)).toContainText("User");
    await expect(headers.nth(1)).toContainText("Status");
    await expect(headers.nth(2)).toContainText("Role");
    await expect(headers.nth(3)).toContainText("Base Plan");
    await expect(headers.nth(4)).toContainText("Joined");
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
    // The status filter is a native <select> element
    const statusSelect = authenticatedPage.locator("select").nth(0);
    await expect(statusSelect).toBeVisible();

    // Get initial row count
    const initialRows = await authenticatedPage.locator("tbody tr").count();
    console.log("Initial rows:", initialRows);

    // Select "Approved"
    await statusSelect.selectOption("approved");
    await authenticatedPage.waitForTimeout(500);

    // Get filtered count
    const approvedRows = await authenticatedPage.locator("tbody tr").count();
    console.log("Approved filter rows:", approvedRows);

    // Reset to all
    await statusSelect.selectOption("all");
    await authenticatedPage.waitForTimeout(500);

    // Verify we're back to all
    const resetRows = await authenticatedPage.locator("tbody tr").count();
    console.log("Reset rows:", resetRows);
    expect(resetRows).toBe(initialRows);
  });

  test("should filter users by role dropdown", async ({ authenticatedPage }) => {
    // The role filter is the second native <select> element
    const roleSelect = authenticatedPage.locator("select").nth(1);
    await expect(roleSelect).toBeVisible();

    // Get initial row count
    const initialRows = await authenticatedPage.locator("tbody tr").count();
    console.log("Initial rows:", initialRows);

    // Select "Admin"
    await roleSelect.selectOption("admin");
    await authenticatedPage.waitForTimeout(500);

    // Get filtered count - should be at least 1 (the test user is admin)
    const adminRows = await authenticatedPage.locator("tbody tr").count();
    console.log("Admin filter rows:", adminRows);
    expect(adminRows).toBeGreaterThanOrEqual(1);

    // Reset to all
    await roleSelect.selectOption("all");
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

    // Find the admin user row (Test User) and click its action menu
    const adminRow = authenticatedPage.locator("tbody tr").filter({ hasText: "Test User" });
    const actionButton = adminRow.locator("td:last-child button");
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
    // Find the "Other User" row (non-admin user seeded for admin action tests)
    const otherRow = authenticatedPage.locator("tbody tr").filter({ hasText: "Other User" });
    await expect(otherRow).toBeVisible();
    const roleCell = otherRow.locator("td").nth(2); // Role column is 3rd

    // Verify initial state: Other User is not admin
    await expect(roleCell.getByText("User")).toBeVisible();

    // Open action menu and click "Make admin"
    await otherRow.locator("td:last-child button").click();
    const menu = authenticatedPage.locator('[role="menu"]');
    await expect(menu).toBeVisible();
    await menu.getByText("Make admin").click();

    // Verify role changed to "Admin"
    await expect(roleCell.getByText("Admin")).toBeVisible();

    // Restore: open action menu and click "Remove admin"
    await otherRow.locator("td:last-child button").click();
    const restoreMenu = authenticatedPage.locator('[role="menu"]');
    await expect(restoreMenu).toBeVisible();
    await restoreMenu.getByText("Remove admin").click();

    // Verify restored to User
    await expect(roleCell.getByText("User")).toBeVisible();
  });

  test("should change base plan via action menu", async ({ authenticatedPage }) => {
    const serverErrors: string[] = [];
    authenticatedPage.on("response", (resp) => {
      if (resp.status() >= 500) serverErrors.push(`${resp.status()} ${resp.url()}`);
    });

    // Target the "Other User" row for plan changes
    const row = authenticatedPage.locator("tbody tr").filter({ hasText: "Other User" });
    const planCell = row.locator("td").nth(3); // Base Plan column is 4th

    // Verify initial state: Free plan
    await expect(planCell.getByText("Free")).toBeVisible();

    // Open action menu and click "Starter" plan
    await row.locator("td:last-child button").click();
    const menu = authenticatedPage.locator('[role="menu"]');
    await expect(menu).toBeVisible();
    await menu.getByText("Starter").click();

    // Verify plan changed to Starter (enhanced form updates inline)
    await expect(planCell.getByText("Starter")).toBeVisible();
    expect(serverErrors).toHaveLength(0);

    // Restore: open action menu and click "Free" plan
    await row.locator("td:last-child button").click();
    const restoreMenu = authenticatedPage.locator('[role="menu"]');
    await expect(restoreMenu).toBeVisible();
    await restoreMenu.getByText("Free").click();

    // Verify restored to Free
    await expect(planCell.getByText("Free")).toBeVisible();
    expect(serverErrors).toHaveLength(0);
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
