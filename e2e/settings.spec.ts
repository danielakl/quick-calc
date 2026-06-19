import { test, expect } from "@playwright/test";

test.describe("Formatting settings", () => {
  test.beforeEach(async ({ page }) => {
    // Clear persisted settings so each test starts from defaults.
    await page.addInitScript(() => {
      localStorage.removeItem("format-settings");
    });
  });

  test("explicit de-DE-style format parses `1.234,56 * 2` as 2.469,12", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("settings-button").click();
    await expect(page.getByTestId("settings-modal")).toBeVisible();

    // Pick by visible label (the format's positive/negative example).
    // matchingLocales[0] varies by Intl runtime version, so selecting by
    // the rendered example is more stable.
    await page
      .getByTestId("settings-number-format")
      .selectOption({ label: "1.234.567,89 / -1.234.567,89" });
    await page.getByTestId("settings-close").click();
    await expect(page.getByTestId("settings-modal")).not.toBeVisible();

    await page.getByTestId("calc-input").fill("1.234,56 * 2");
    const results = page.getByTestId("calc-results");
    await expect(results.getByText("2.469,12")).toBeVisible();
  });

  test("auto: heuristic flips to comma-decimal on unambiguous input", async ({ page }) => {
    await page.goto("/");
    const textarea = page.getByTestId("calc-input");
    const results = page.getByTestId("calc-results");

    await textarea.fill("1,5 + 2,5");
    await expect(results.getByText("4", { exact: true })).toBeVisible();
  });

  test("currency display button group toggles between symbol and code", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("settings-button").click();

    const symbolBtn = page.getByTestId("settings-currency-display-symbol");
    const codeBtn = page.getByTestId("settings-currency-display-code");

    await expect(symbolBtn).toHaveAttribute("aria-pressed", "true");
    await expect(codeBtn).toHaveAttribute("aria-pressed", "false");

    await codeBtn.click();
    await expect(codeBtn).toHaveAttribute("aria-pressed", "true");
    await expect(symbolBtn).toHaveAttribute("aria-pressed", "false");
  });

  test("reset restores defaults", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("settings-button").click();
    await page
      .getByTestId("settings-number-format")
      .selectOption({ label: "1.234.567,89 / -1.234.567,89" });
    await page.getByTestId("settings-currency-display-code").click();
    await page.getByTestId("settings-reset").click();
    await expect(page.getByTestId("settings-number-format")).toHaveValue("");
    await expect(page.getByTestId("settings-currency-display-symbol")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
