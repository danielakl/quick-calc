import { Temporal } from "temporal-polyfill";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CurrencyCode } from "./currencies";
import {
  backoffDelayMs,
  derivePerUnitFromUsd,
  detectLocaleCurrency,
  displayRate,
  fetchUsd,
  fetchWithBackoff,
  formatRelative,
  toCurrencyMap,
} from "./exchangeRates";

const TEST_DATE = Temporal.PlainDate.from("2026-04-25");

describe("toCurrencyMap", () => {
  it("uppercases keys and filters to known CurrencyCode values", () => {
    const map = toCurrencyMap({ eur: 0.92, gbp: 0.8, foobar: 1.5 });
    expect(map?.get(CurrencyCode.EUR)).toBe(0.92);
    expect(map?.get(CurrencyCode.GBP)).toBe(0.8);
    expect(map?.size).toBe(2);
  });

  it("rejects non-numeric and non-finite rate values", () => {
    const map = toCurrencyMap({
      eur: 0.92,
      gbp: "not a number",
      jpy: NaN,
      nok: -5,
      sek: 0,
    });
    expect(map?.size).toBe(1);
    expect(map?.get(CurrencyCode.EUR)).toBe(0.92);
  });

  it("returns null for non-object input", () => {
    expect(toCurrencyMap(null)).toBeNull();
    expect(toCurrencyMap("string")).toBeNull();
    expect(toCurrencyMap(42)).toBeNull();
    expect(toCurrencyMap([1, 2, 3])).toBeNull();
  });
});

describe("derivePerUnitFromUsd", () => {
  it("anchors USD at 1 and reciprocates other rates", () => {
    const out = derivePerUnitFromUsd(
      new Map([
        [CurrencyCode.EUR, 0.92],
        [CurrencyCode.GBP, 0.8],
      ]),
    );
    expect(out.get(CurrencyCode.USD)).toBe(1);
    expect(out.get(CurrencyCode.EUR)).toBeCloseTo(1 / 0.92, 8);
    expect(out.get(CurrencyCode.GBP)).toBeCloseTo(1 / 0.8, 8);
  });

  it("skips invalid rates", () => {
    const out = derivePerUnitFromUsd(
      new Map([
        [CurrencyCode.EUR, 0.92],
        [CurrencyCode.GBP, 0],
        [CurrencyCode.JPY, -1],
        [CurrencyCode.NOK, NaN],
      ]),
    );
    expect(out.get(CurrencyCode.GBP)).toBeUndefined();
    expect(out.get(CurrencyCode.JPY)).toBeUndefined();
    expect(out.get(CurrencyCode.NOK)).toBeUndefined();
  });
});

describe("displayRate", () => {
  it("returns code/base ratio", () => {
    const perUnit = new Map<CurrencyCode, number>([
      [CurrencyCode.USD, 1],
      [CurrencyCode.EUR, 1.087],
      [CurrencyCode.GBP, 1.273],
    ]);
    expect(displayRate(perUnit, CurrencyCode.EUR, CurrencyCode.USD)).toBeCloseTo(1.087, 8);
    expect(displayRate(perUnit, CurrencyCode.USD, CurrencyCode.EUR)).toBeCloseTo(1 / 1.087, 8);
  });

  it("returns null when either side is missing", () => {
    const perUnit = new Map<CurrencyCode, number>([[CurrencyCode.USD, 1]]);
    expect(displayRate(perUnit, CurrencyCode.USD, CurrencyCode.EUR)).toBeNull();
    expect(displayRate(perUnit, CurrencyCode.EUR, CurrencyCode.USD)).toBeNull();
  });
});

describe("formatRelative", () => {
  const now = Temporal.Instant.fromEpochMilliseconds(1_700_000_000_000);

  function past(deltaMs: number): Temporal.Instant {
    return Temporal.Instant.fromEpochMilliseconds(now.epochMilliseconds - deltaMs);
  }

  it("returns 'never' for null", () => {
    expect(formatRelative(null, now)).toBe("never");
  });

  it("formats seconds", () => {
    expect(formatRelative(past(5_000), now)).toBe("5s ago");
  });

  it("formats minutes", () => {
    expect(formatRelative(past(5 * 60_000), now)).toBe("5m ago");
  });

  it("formats hours", () => {
    expect(formatRelative(past(3 * 3_600_000), now)).toBe("3h ago");
  });

  it("formats days", () => {
    expect(formatRelative(past(2 * 86_400_000), now)).toBe("2d ago");
  });
});

describe("detectLocaleCurrency", () => {
  const original = navigator.language;

  afterEach(() => {
    Object.defineProperty(navigator, "language", {
      configurable: true,
      get: () => original,
    });
  });

  function setLang(lang: string) {
    Object.defineProperty(navigator, "language", {
      configurable: true,
      get: () => lang,
    });
    Object.defineProperty(navigator, "languages", {
      configurable: true,
      get: () => [lang],
    });
  }

  it("maps en-US → USD", () => {
    setLang("en-US");
    expect(detectLocaleCurrency()).toBe(CurrencyCode.USD);
  });

  it("maps de-DE → EUR", () => {
    setLang("de-DE");
    expect(detectLocaleCurrency()).toBe(CurrencyCode.EUR);
  });

  it("maps nb-NO → NOK", () => {
    setLang("nb-NO");
    expect(detectLocaleCurrency()).toBe(CurrencyCode.NOK);
  });

  it("falls back to USD for unknown regions", () => {
    setLang("zz-ZZ");
    expect(detectLocaleCurrency()).toBe(CurrencyCode.USD);
  });

  it("falls back to USD when no region is provided", () => {
    setLang("xx");
    expect(detectLocaleCurrency()).toBe(CurrencyCode.USD);
  });
});

describe("backoffDelayMs", () => {
  it("doubles per attempt", () => {
    expect(backoffDelayMs(0)).toBe(1000);
    expect(backoffDelayMs(1)).toBe(2000);
    expect(backoffDelayMs(2)).toBe(4000);
    expect(backoffDelayMs(3)).toBe(8000);
    expect(backoffDelayMs(4)).toBe(16_000);
  });

  it("clamps at 30s", () => {
    expect(backoffDelayMs(5)).toBe(30_000);
    expect(backoffDelayMs(20)).toBe(30_000);
  });
});

describe("fetchUsd validation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockJson(body: unknown) {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(body), { status: 200 }),
    );
  }

  it("rejects non-object responses", async () => {
    mockJson(["array", "instead", "of", "object"]);
    await expect(fetchUsd(TEST_DATE)).rejects.toThrow(/JSON object/);
  });

  it("rejects responses missing the `usd` field", async () => {
    mockJson({ date: "2026-04-25" });
    await expect(fetchUsd(TEST_DATE)).rejects.toThrow(/missing or malformed/);
  });

  it("rejects responses with no supported currencies", async () => {
    mockJson({ date: "2026-04-25", usd: { unknowncoin: 1 } });
    await expect(fetchUsd(TEST_DATE)).rejects.toThrow(/no supported currencies/);
  });

  it("returns a filtered Map for valid responses", async () => {
    mockJson({ date: "2026-04-25", usd: { eur: 0.92, garbage: "x" } });
    const result = await fetchUsd(TEST_DATE);
    expect(result.usdRates.get(CurrencyCode.EUR)).toBe(0.92);
    expect(result.usdRates.size).toBe(1);
  });

  it("does not follow redirects", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ usd: { eur: 0.92 } }), { status: 200 }));
    await fetchUsd(TEST_DATE);
    const init = fetchSpy.mock.calls[0][1];
    expect(init?.redirect).toBe("error");
  });

  it("targets the YYYY-MM-DD path for plain dates", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ usd: { eur: 0.92 } }), { status: 200 }));
    await fetchUsd(TEST_DATE);
    expect(fetchSpy.mock.calls[0][0]).toContain("@2026-04-25/");
  });

  it('targets the "@latest" path for "latest"', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ usd: { eur: 0.92 } }), { status: 200 }));
    await fetchUsd("latest");
    expect(fetchSpy.mock.calls[0][0]).toContain("@latest/");
  });
});

describe("fetchWithBackoff", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("aborts immediately when the signal is already aborted", async () => {
    const ac = new AbortController();
    ac.abort();
    const fetchMock = vi.spyOn(globalThis, "fetch");
    await expect(fetchWithBackoff(TEST_DATE, ac.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("aborts mid-flight when the signal aborts during a backoff sleep", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    const ac = new AbortController();
    const promise = fetchWithBackoff(TEST_DATE, ac.signal);
    // Abort before the first 1000ms backoff sleep finishes.
    setTimeout(() => ac.abort(), 10);
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });

  it("falls back to the previous date when today returns 404", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("@2026-04-25/")) {
        return new Response("Not Found", { status: 404 });
      }
      if (url.includes("@2026-04-24/")) {
        return new Response(JSON.stringify({ usd: { eur: 0.92 } }), {
          status: 200,
        });
      }
      return new Response("error", { status: 500 });
    });
    const result = await fetchWithBackoff(TEST_DATE);
    expect(result.usdRates.get(CurrencyCode.EUR)).toBe(0.92);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('falls back to "@latest" when both dated targets 404', async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("@latest/")) {
        return new Response(JSON.stringify({ usd: { eur: 0.91 } }), {
          status: 200,
        });
      }
      return new Response("Not Found", { status: 404 });
    });
    const result = await fetchWithBackoff(TEST_DATE);
    expect(result.usdRates.get(CurrencyCode.EUR)).toBe(0.91);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("does not retry permanent (4xx) errors with backoff", async () => {
    // Two 404s for the dated targets, then 200 on @latest.
    // Each 404 must be a single call — no exponential backoff retries.
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("@latest/")) {
        return new Response(JSON.stringify({ usd: { eur: 0.91 } }), {
          status: 200,
        });
      }
      return new Response("Not Found", { status: 404 });
    });
    await fetchWithBackoff(TEST_DATE);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });
});
