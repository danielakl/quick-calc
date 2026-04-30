import { Temporal } from "temporal-polyfill";
import { describe, it, expect } from "vitest";
import { millisecondsBetween, nowInstant, todayLocalDate, todayUtcDate } from "./dateUtils";

describe("nowInstant", () => {
  it("returns a Temporal.Instant near the system clock", () => {
    const before = Date.now();
    const instant = nowInstant();
    const after = Date.now();
    expect(instant).toBeInstanceOf(Temporal.Instant);
    expect(instant.epochMilliseconds).toBeGreaterThanOrEqual(before);
    expect(instant.epochMilliseconds).toBeLessThanOrEqual(after);
  });
});

describe("todayUtcDate", () => {
  it("returns the UTC date for a given instant", () => {
    // 2024-06-15T12:00:00Z — middle of the day in UTC.
    const noonUtc = Temporal.Instant.from("2024-06-15T12:00:00Z");
    expect(todayUtcDate(noonUtc).toString()).toBe("2024-06-15");
  });

  it("uses UTC even when the local zone would yield a different date", () => {
    // 23:30 UTC is already the next day in zones east of UTC, but todayUtcDate
    // ignores local zone.
    const lateUtc = Temporal.Instant.from("2024-06-15T23:30:00Z");
    expect(todayUtcDate(lateUtc).toString()).toBe("2024-06-15");
  });

  it("rolls over at UTC midnight", () => {
    const justBefore = Temporal.Instant.from("2024-06-15T23:59:59.999Z");
    const justAfter = Temporal.Instant.from("2024-06-16T00:00:00Z");
    expect(todayUtcDate(justBefore).toString()).toBe("2024-06-15");
    expect(todayUtcDate(justAfter).toString()).toBe("2024-06-16");
  });

  it("defaults to the current instant when no argument is provided", () => {
    const expected = Temporal.Now.instant().toZonedDateTimeISO("UTC").toPlainDate().toString();
    expect(todayUtcDate().toString()).toBe(expected);
  });
});

describe("todayLocalDate", () => {
  it("returns the date in the system local zone for a given instant", () => {
    // Compute what the local date *should* be for a fixed instant, then
    // confirm the helper agrees. This makes the test independent of the
    // machine's TZ.
    const instant = Temporal.Instant.from("2024-06-15T12:00:00Z");
    const expected = instant.toZonedDateTimeISO(Temporal.Now.timeZoneId()).toPlainDate().toString();
    expect(todayLocalDate(instant).toString()).toBe(expected);
  });

  it("defaults to the current instant when no argument is provided", () => {
    const tz = Temporal.Now.timeZoneId();
    const expected = Temporal.Now.instant().toZonedDateTimeISO(tz).toPlainDate().toString();
    expect(todayLocalDate().toString()).toBe(expected);
  });
});

describe("millisecondsBetween", () => {
  it("returns positive ms when the second instant is later", () => {
    const a = Temporal.Instant.from("2024-01-01T00:00:00Z");
    const b = Temporal.Instant.from("2024-01-01T00:00:05Z");
    expect(millisecondsBetween(a, b)).toBe(5_000);
  });

  it("returns zero for identical instants", () => {
    const a = Temporal.Instant.from("2024-01-01T00:00:00Z");
    expect(millisecondsBetween(a, a)).toBe(0);
  });

  it("returns negative ms when the second instant is earlier", () => {
    const a = Temporal.Instant.from("2024-01-01T00:00:05Z");
    const b = Temporal.Instant.from("2024-01-01T00:00:00Z");
    expect(millisecondsBetween(a, b)).toBe(-5_000);
  });
});
