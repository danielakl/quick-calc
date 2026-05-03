import { create, all } from "mathjs";
import { describe, it, expect } from "vitest";
import { formatNumber, formatUnit, extractUnitMagnitude } from "./formatter";

const math = create(all, {});
const unit = (expr: string) => math.evaluate(expr) as import("mathjs").Unit;

describe("formatNumber", () => {
  describe("special values", () => {
    it("returns 'infinity' (lowercase) for Infinity", () => {
      expect(formatNumber(Infinity)).toBe("infinity");
    });

    it("returns '-infinity' (lowercase) for -Infinity", () => {
      expect(formatNumber(-Infinity)).toBe("-infinity");
    });

    it("returns 'NaN' for NaN", () => {
      expect(formatNumber(NaN)).toBe("NaN");
    });
  });

  describe("integers", () => {
    it("formats small integers", () => {
      expect(formatNumber(42)).toBe("42");
    });

    it("formats zero", () => {
      expect(formatNumber(0)).toBe("0");
    });

    it("formats negative integers", () => {
      expect(formatNumber(-100)).toBe("-100");
    });

    it("adds thousand separators", () => {
      expect(formatNumber(1000000)).toBe("1,000,000");
    });

    it("handles large integers below 1e15", () => {
      expect(formatNumber(999999999999999)).toBe("999,999,999,999,999");
    });
  });

  describe("exponential notation", () => {
    it("uses exponential for values >= 1e15", () => {
      const result = formatNumber(1e15);
      expect(result).toContain("e+");
    });

    it("uses exponential for very small values", () => {
      const result = formatNumber(1e-7);
      expect(result).toContain("e-");
    });

    it("does not use exponential for zero", () => {
      expect(formatNumber(0)).toBe("0");
    });
  });

  describe("decimal formatting", () => {
    it("formats simple decimals", () => {
      expect(formatNumber(3.14)).toBe("3.14");
    });

    it("limits precision to 10 significant digits", () => {
      const result = formatNumber(1 / 3);
      // Should not have excessive decimal places
      const decimalPart = result.split(".")[1] || "";
      expect(decimalPart.length).toBeLessThanOrEqual(10);
    });
  });
});

describe("formatUnit", () => {
  it("formats an integer magnitude with thousand separators", () => {
    expect(formatUnit(unit("1050 inch"))).toBe("1,050 inch");
  });

  it("formats a decimal magnitude", () => {
    expect(formatUnit(unit("0.5 minute"))).toBe("0.5 minute");
  });

  it("formats a negative magnitude", () => {
    expect(formatUnit(unit("-3 m"))).toBe("-3 m");
  });

  it("preserves compound unit strings", () => {
    expect(formatUnit(unit("4 m/s"))).toBe("4 m / s");
  });
});

describe("extractUnitMagnitude", () => {
  it("returns the displayed magnitude", () => {
    expect(extractUnitMagnitude(unit("10 minute"))).toBe(10);
  });

  it("does not convert to base SI", () => {
    // 10 minute expressed in minute should be 10, not 600 (seconds).
    expect(extractUnitMagnitude(unit("10 minute"))).not.toBe(600);
  });
});
