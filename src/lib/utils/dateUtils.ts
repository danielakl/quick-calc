// Temporal-based date helpers. Centralized so callers don't reach for `Date`
// or sprinkle Temporal.Now usage across modules.

import { Temporal } from "temporal-polyfill";

/** The current moment as a Temporal.Instant. */
export function nowInstant(): Temporal.Instant {
  return Temporal.Now.instant();
}

/** Today's date in the user's local timezone. */
export function todayLocalDate(instant: Temporal.Instant = nowInstant()): Temporal.PlainDate {
  return instant.toZonedDateTimeISO(Temporal.Now.timeZoneId()).toPlainDate();
}

/** Today's date in UTC — matches the API's `date` field. */
export function todayUtcDate(instant: Temporal.Instant = nowInstant()): Temporal.PlainDate {
  return instant.toZonedDateTimeISO("UTC").toPlainDate();
}

/** Milliseconds between two instants (`later - earlier`). Negative when reversed. */
export function millisecondsBetween(earlier: Temporal.Instant, later: Temporal.Instant): number {
  return later.epochMilliseconds - earlier.epochMilliseconds;
}
