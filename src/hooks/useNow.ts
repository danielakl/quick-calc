"use client";

import { useEffect, useState } from "react";
import { Temporal } from "temporal-polyfill";
import { nowInstant } from "@/lib/utils/dateUtils";

/**
 * A ticking Temporal.Instant, refreshed on the given interval. Useful for
 * rendering relative-time strings ("5m ago") without each consumer wiring up
 * its own setInterval.
 */
export function useNow(intervalMilliseconds = 60_000): Temporal.Instant {
  const [now, setNow] = useState<Temporal.Instant>(() => nowInstant());
  useEffect(() => {
    const handle = setInterval(() => setNow(nowInstant()), intervalMilliseconds);
    return () => clearInterval(handle);
  }, [intervalMilliseconds]);
  return now;
}
