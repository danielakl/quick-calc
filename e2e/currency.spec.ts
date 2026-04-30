import { test, expect } from "@playwright/test";

const TODAY = new Date().toISOString().slice(0, 10);

const STUB_USD = { date: TODAY, usd: { eur: 0.92, nok: 10.93, gbp: 0.8 } };

async function stubCurrencyApi(page: import("@playwright/test").Page) {
  await page.route("**/cdn.jsdelivr.net/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/usd.json")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(STUB_USD),
      });
      return;
    }
    await route.abort();
  });
}

test.describe("Currency feature", () => {
  test("status button reaches fresh after stubbed fetch", async ({ page }) => {
    await stubCurrencyApi(page);
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/");

    const button = page.getByTestId("currency-button");
    await expect(button).toHaveAttribute("aria-label", /Up to date/, {
      timeout: 10_000,
    });
  });

  test("modal opens, shows rates, search filters", async ({ page }) => {
    await stubCurrencyApi(page);
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/");

    await page.getByTestId("currency-button").click({ timeout: 10_000 });
    await expect(page.getByTestId("currency-modal")).toBeVisible();

    await page.getByTestId("currency-search").fill("norwegian");
    await expect(page.getByTestId("currency-row-NOK")).toBeVisible();
    await expect(page.getByTestId("currency-row-USD")).toHaveCount(0);
  });

  test("evaluates `100 USD to EUR` in the calculator", async ({ page }) => {
    await stubCurrencyApi(page);
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/");

    await expect(page.getByTestId("currency-button")).toHaveAttribute("aria-label", /Up to date/, {
      timeout: 10_000,
    });

    await page.getByTestId("calc-input").fill("100 USD to EUR");
    const results = page.getByTestId("calc-results");
    // 1 USD = 0.92 EUR (stub) → 100 USD = 92 EUR (rendered with the € symbol)
    await expect(results.getByText(/^\s*92\s*€\s*$/)).toBeVisible();
  });

  test("evaluates `150 as usd` (number → unit literal)", async ({ page }) => {
    await stubCurrencyApi(page);
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/");

    await expect(page.getByTestId("currency-button")).toHaveAttribute("aria-label", /Up to date/, {
      timeout: 10_000,
    });

    await page.getByTestId("calc-input").fill("150 as usd");
    const results = page.getByTestId("calc-results");
    await expect(results.getByText(/^\s*150\s*\$\s*$/)).toBeVisible();
  });
});
