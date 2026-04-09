import { test, expect } from "@playwright/test";

test.describe("Calculator E2E", () => {
  test("loads the app and shows header", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toHaveText("Quick Calc");
    await expect(
      page.locator('textarea[placeholder="Type an expression..."]'),
    ).toBeVisible();
  });

  test("evaluates expressions and shows results", async ({ page }) => {
    await page.goto("/");
    const textarea = page.locator("textarea");
    const results = page.locator(".w-\\[40\\%\\]");

    await textarea.fill("2 + 3\n10 * 4\nsqrt(144)");

    await expect(results.getByText("5")).toBeVisible();
    await expect(results.getByText("40")).toBeVisible();
    await expect(results.getByText("12")).toBeVisible();
  });

  test("supports variables and builtins", async ({ page }) => {
    await page.goto("/");
    const textarea = page.locator("textarea");
    const results = page.locator(".w-\\[40\\%\\]");

    await textarea.fill("price = 100\ntax = 0.2\nprice * tax\nsum");

    await expect(results.getByText("100", { exact: true })).toBeVisible();
    await expect(results.getByText("0.2", { exact: true })).toBeVisible();
    await expect(results.getByText("20", { exact: true })).toBeVisible();
    await expect(results.getByText("120.2", { exact: true })).toBeVisible();
  });

  test("shares state via URL", async ({ page }) => {
    await page.goto("/");
    const textarea = page.locator("textarea");
    const results = page.locator(".w-\\[40\\%\\]");

    await textarea.fill("42 + 8");
    await expect(results.getByText("50")).toBeVisible();

    const url = page.url();
    expect(url).toContain("q=");

    // Navigate to the same URL to verify state loads from URL
    await page.goto(url);
    await expect(page.locator("textarea")).toHaveValue("42 + 8");
    await expect(results.getByText("50")).toBeVisible();
  });
});
