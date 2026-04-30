import { Temporal } from "temporal-polyfill";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { CurrencyCode } from "@/lib/currencies";
import { registerCurrencyUnits } from "@/lib/engine";
import {
  STALE_AFTER_MS,
  type Status,
  derivePerUnitFromUsd,
  detectLocaleCurrency,
  fetchWithBackoff,
} from "@/lib/exchangeRates";
import { millisecondsBetween, nowInstant, todayLocalDate } from "@/lib/utils/dateUtils";

interface CurrencyState {
  status: Status;
  fetchedAt: Temporal.Instant | null;
  /** API "date" field for the data currently in `usdRates`. Informational —
   *  staleness is computed from `fetchedAt` so date fallbacks (yesterday,
   *  @latest) don't immediately re-trigger a fetch. */
  date: Temporal.PlainDate | null;
  usdRates: Map<CurrencyCode, number> | null;
  base: CurrencyCode;
  /** Increments on every successful fetch or cache hydration. Subscribers
   *  (e.g. the calculator results) use this as a useMemo dependency to
   *  re-evaluate. */
  ratesVersion: number;
  setBase: (code: CurrencyCode) => void;
  refresh: () => Promise<void>;
}

interface SerializedMap {
  __type: "Map";
  entries: [CurrencyCode, number][];
}

interface SerializedInstant {
  __type: "Instant";
  iso: string;
}

interface SerializedPlainDate {
  __type: "PlainDate";
  iso: string;
}

function isTaggedShape<T extends string>(value: unknown, tag: T): value is { __type: T } {
  return (
    value !== null && typeof value === "object" && (value as { __type?: unknown }).__type === tag
  );
}

function isSerializedMap(value: unknown): value is SerializedMap {
  return isTaggedShape(value, "Map") && Array.isArray((value as { entries?: unknown }).entries);
}

function isSerializedInstant(value: unknown): value is SerializedInstant {
  return isTaggedShape(value, "Instant") && typeof (value as { iso?: unknown }).iso === "string";
}

function isSerializedPlainDate(value: unknown): value is SerializedPlainDate {
  return isTaggedShape(value, "PlainDate") && typeof (value as { iso?: unknown }).iso === "string";
}

let inFlight: AbortController | null = null;

function applyUnits(usdRates: Map<CurrencyCode, number> | null): void {
  if (!usdRates) {
    return;
  }
  registerCurrencyUnits(derivePerUnitFromUsd(usdRates));
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set) => ({
      status: "fetching",
      fetchedAt: null,
      date: null,
      usdRates: null,
      base: CurrencyCode.USD,
      ratesVersion: 0,

      setBase: (code) => set({ base: code }),

      refresh: async () => {
        inFlight?.abort();
        inFlight = new AbortController();
        const abortController = inFlight;
        set({ status: "fetching" });
        try {
          const result = await fetchWithBackoff(todayLocalDate(), abortController.signal);
          if (abortController.signal.aborted) {
            return;
          }
          applyUnits(result.usdRates);
          set((state) => ({
            status: "fresh",
            fetchedAt: nowInstant(),
            date: todayLocalDate(),
            usdRates: result.usdRates,
            ratesVersion: state.ratesVersion + 1,
          }));
        } catch (error) {
          if ((error as { name?: string })?.name === "AbortError") {
            return;
          }
          set({ status: "error" });
        } finally {
          if (inFlight === abortController) {
            inFlight = null;
          }
        }
      },
    }),
    {
      name: "currency-rates",
      version: 1,
      storage: createJSONStorage(() => localStorage, {
        // Pre-replace tags Temporal types before JSON.stringify can call their
        // toJSON() methods (which return ISO strings indistinguishable from any
        // other string). Without the tags we'd lose the type on rehydrate.
        replacer: (_key, value) => {
          if (value instanceof Map) {
            return {
              __type: "Map",
              entries: Array.from(value.entries()),
            } satisfies SerializedMap;
          }
          if (value instanceof Temporal.Instant) {
            return {
              __type: "Instant",
              iso: value.toString(),
            } satisfies SerializedInstant;
          }
          if (value instanceof Temporal.PlainDate) {
            return {
              __type: "PlainDate",
              iso: value.toString(),
            } satisfies SerializedPlainDate;
          }
          return value;
        },
        reviver: (_key, value) => {
          if (isSerializedMap(value)) {
            return new Map(value.entries);
          }
          if (isSerializedInstant(value)) {
            return Temporal.Instant.from(value.iso);
          }
          if (isSerializedPlainDate(value)) {
            return Temporal.PlainDate.from(value.iso);
          }
          return value;
        },
      }),
      partialize: (state) => ({
        fetchedAt: state.fetchedAt,
        date: state.date,
        usdRates: state.usdRates,
        base: state.base,
      }),
    },
  ),
);

function isFresh(fetchedAt: Temporal.Instant, now: Temporal.Instant): boolean {
  return millisecondsBetween(fetchedAt, now) < STALE_AFTER_MS;
}

/** Bootstrap the currency store. Call once on app mount.
 *  Persisted state has already been hydrated synchronously by `persist`. */
export function initCurrencyStore(): void {
  const state = useCurrencyStore.getState();
  const now = nowInstant();

  if (state.usdRates && state.fetchedAt) {
    applyUnits(state.usdRates);
    if (isFresh(state.fetchedAt, now)) {
      useCurrencyStore.setState((s) => ({
        status: "fresh",
        ratesVersion: s.ratesVersion + 1,
      }));
      return;
    }
    useCurrencyStore.setState((s) => ({
      status: "stale",
      ratesVersion: s.ratesVersion + 1,
    }));
    queueMicrotask(() => void state.refresh());
    return;
  }

  // First run: nothing persisted. Pick a locale-appropriate base and fetch.
  useCurrencyStore.setState({ base: detectLocaleCurrency() });
  queueMicrotask(() => void state.refresh());
}
