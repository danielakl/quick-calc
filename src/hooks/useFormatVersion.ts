"use client";

import { useFormatStore } from "@/stores/useFormatStore";

/** Subscribe to the formatting-store version counter. Returns a number that
 *  bumps on every settings mutation — include in `useMemo` deps so engine
 *  results re-render when locale, separators, or display options change. */
export function useFormatVersion(): number {
  return useFormatStore((s) => s.formatVersion);
}
