import { Temporal } from "temporal-polyfill";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CurrencyCode } from "@/lib/currencies";
import { todayLocalDate } from "@/lib/utils/dateUtils";

const STORAGE_KEY = "currency-rates";

interface PersistedFixture {
  date: Temporal.PlainDate;
  fetchedAt: Temporal.Instant;
  usdRates: [CurrencyCode, number][];
  base?: CurrencyCode;
}

function persistedShape(fixture: PersistedFixture): string {
  return JSON.stringify({
    state: {
      date: { __type: "PlainDate", iso: fixture.date.toString() },
      fetchedAt: { __type: "Instant", iso: fixture.fetchedAt.toString() },
      usdRates: { __type: "Map", entries: fixture.usdRates },
      base: fixture.base ?? CurrencyCode.USD,
    },
    version: 1,
  });
}

function freshCachedToday() {
  return persistedShape({
    date: todayLocalDate(),
    fetchedAt: Temporal.Now.instant().subtract({ seconds: 5 }),
    usdRates: [
      [CurrencyCode.EUR, 0.92],
      [CurrencyCode.NOK, 10.93],
    ],
  });
}

function staleCachedYesterday() {
  return persistedShape({
    date: Temporal.PlainDate.from("2020-01-01"),
    fetchedAt: Temporal.Now.instant().subtract({ hours: 48 }),
    usdRates: [[CurrencyCode.EUR, 0.92]],
  });
}

describe("useCurrencyStore", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    Object.defineProperty(navigator, "language", {
      configurable: true,
      get: () => "en-US",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes as fresh when cache is for today", async () => {
    localStorage.setItem(STORAGE_KEY, freshCachedToday());
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const { useCurrencyStore, initCurrencyStore } = await import("./useCurrencyStore");
    initCurrencyStore();
    const state = useCurrencyStore.getState();
    expect(state.status).toBe("fresh");
    expect(state.usdRates?.get(CurrencyCode.EUR)).toBe(0.92);
    expect(state.usdRates?.get(CurrencyCode.NOK)).toBe(10.93);
    expect(state.base).toBe(CurrencyCode.USD);
    expect(state.ratesVersion).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("initializes as stale when cache is older than 24h, then refreshes", async () => {
    localStorage.setItem(STORAGE_KEY, staleCachedYesterday());
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          date: todayLocalDate().toString(),
          usd: { eur: 0.95 },
        }),
        { status: 200 },
      ),
    );

    const { useCurrencyStore, initCurrencyStore } = await import("./useCurrencyStore");
    initCurrencyStore();
    expect(useCurrencyStore.getState().status).toBe("stale");

    await vi.waitFor(
      () => {
        expect(useCurrencyStore.getState().status).toBe("fresh");
      },
      { timeout: 4000 },
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(useCurrencyStore.getState().date?.toString()).toBe(todayLocalDate().toString());
  });

  it("setBase updates display base without triggering fetch", async () => {
    localStorage.setItem(STORAGE_KEY, freshCachedToday());
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { useCurrencyStore, initCurrencyStore } = await import("./useCurrencyStore");
    initCurrencyStore();
    useCurrencyStore.getState().setBase(CurrencyCode.EUR);
    expect(useCurrencyStore.getState().base).toBe(CurrencyCode.EUR);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("bumps ratesVersion on each cache hydration / refresh", async () => {
    localStorage.setItem(STORAGE_KEY, freshCachedToday());
    const { useCurrencyStore, initCurrencyStore } = await import("./useCurrencyStore");
    initCurrencyStore();
    const versionAfterInit = useCurrencyStore.getState().ratesVersion;
    expect(versionAfterInit).toBeGreaterThan(0);
  });
});
