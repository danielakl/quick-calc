"use client";

import { useCurrencyStore } from "@/stores/useCurrencyStore";

/**
 * Subscribe to currency-rate updates. Returns the rate version, which
 * increments on every successful fetch and on `setFetchSource`. Use this as
 * a dependency in `useMemo`/`useEffect` for code that depends on the
 * mathjs-registered currency units (the engine reads them at evaluation time).
 */
export function useCurrencyRates(): number {
  return useCurrencyStore((state) => state.ratesVersion);
}
