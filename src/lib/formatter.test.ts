import { describe, it, expect } from "vitest";
import { formatNumber } from "./formatter";

describe("formatNumber", () => {
  describe("special values", () => {
    it("returns 'Infinity' for Infinity", () => {
      expect(formatNumber(Infinity)).toBe("Infinity");
    });

    it("returns '-Infinity' for -Infinity", () => {
      expect(formatNumber(-Infinity)).toBe("-Infinity");
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
