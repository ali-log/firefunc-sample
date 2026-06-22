import { expect, test } from "@playwright/test";

test.describe("FireFunc Tracker web SPA", () => {
  test("board renders with all four columns and count badges", async ({ page }) => {
    await page.goto("/");

    // App shell mounts.
    await expect(page.getByTestId("app")).toBeVisible();
    await expect(page.getByText("FireFunc Tracker")).toBeVisible();

    // Board renders once tasks load (mock data is used with no backend).
    const board = page.getByTestId("board");
    await expect(board).toBeVisible();

    for (const state of ["todo", "in_progress", "blocked", "done"]) {
      await expect(page.getByTestId(`column-${state}`)).toBeVisible();
      await expect(page.getByTestId(`count-${state}`)).toBeVisible();
    }

    // At least one task card is present.
    await expect(page.locator('[data-testid^="card-"]').first()).toBeVisible();
  });

  test("filter bar narrows the board", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("board")).toBeVisible();

    const blockedCount = page.getByTestId("count-blocked");
    await expect(blockedCount).toHaveText("1");

    // Filtering by state:done via the DSL input should empty the blocked column.
    await page.getByTestId("filter-state").selectOption("done");
    await expect(page.getByTestId("count-blocked")).toHaveText("0");
    await expect(page.getByTestId("count-done")).not.toHaveText("0");
  });

  test("reports view shows a chart and theme toggle works", async ({ page }) => {
    await page.goto("/");

    await page.getByTestId("nav-reports").click();
    await expect(page.getByTestId("report-dashboard")).toBeVisible();
    await expect(page.getByTestId("bar-chart").first()).toBeVisible();

    // Theme toggle flips the pressed state.
    const toggle = page.getByTestId("theme-toggle");
    const before = await toggle.getAttribute("aria-pressed");
    await toggle.click();
    await expect(toggle).not.toHaveAttribute("aria-pressed", before ?? "");
  });
});
