import { create, all } from "mathjs";
import { beforeEach, describe, it, expect } from "vitest";
import { useFormatStore } from "@/stores/useFormatStore";
import { extractUnitMagnitude, formatNumber, formatUnit, setActiveSeparators } from "./formatter";

const math = create(all, {});
const unit = (expr: string) => math.evaluate(expr) as import("mathjs").Unit;

beforeEach(() => {
  localStorage.clear();
  useFormatStore.getState().reset();
  setActiveSeparators(null);
});

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
      const decimalPart = result.split(".")[1] || "";
      expect(decimalPart.length).toBeLessThanOrEqual(10);
    });
  });
});

describe("formatUnit", () => {
  it("formats an integer magnitude with thousand separators", () => {
    // mathjs's toString gives "1050 inch" — preserved, only the magnitude
    // goes through formatNumber.
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
    expect(extractUnitMagnitude(unit("10 minute"))).not.toBe(600);
  });
});

describe("formatNumber — format matrix", () => {
  it("uses en-US separators by default (auto picks navigator default)", () => {
    expect(formatNumber(1234.5)).toBe("1,234.5");
  });

  it("formats with de-DE separators when format is set", () => {
    useFormatStore.getState().setNumberFormatId("de-DE");
    expect(formatNumber(1234.5)).toBe("1.234,5");
  });

  it("formats with fr-FR separators when format is set", () => {
    useFormatStore.getState().setNumberFormatId("fr-FR");
    // fr-FR uses NNBSP for grouping in the source; sanitise + swap normalises.
    expect(formatNumber(1234.5)).toBe("1 234,5");
  });

  it("active separators (heuristic) override format separators", () => {
    useFormatStore.getState().setNumberFormatId("en-US");
    setActiveSeparators({ decimal: ",", group: ".", source: "heuristic" });
    expect(formatNumber(1234.5)).toBe("1.234,5");
  });
});

describe("formatUnit — currency display modes", () => {
  const fakeCurrencyUnit = (literal: string) =>
    ({ toString: () => literal }) as unknown as import("mathjs").Unit;

  it("USD: en-US symbol placement → $1,234.56", () => {
    expect(formatUnit(fakeCurrencyUnit("1234.56 USD"))).toBe("$1,234.56");
  });

  it("GBP: en-GB symbol placement → £8.90", () => {
    expect(formatUnit(fakeCurrencyUnit("8.9 GBP"))).toBe("£8.90");
  });

  it("EUR: home-region symbol placement contains € and the magnitude", () => {
    const out = formatUnit(fakeCurrencyUnit("100 EUR"));
    expect(out.includes("€")).toBe(true);
    expect(out.includes("100")).toBe(true);
  });

  it("currency separators follow the active heuristic", () => {
    setActiveSeparators({ decimal: ",", group: ".", source: "heuristic" });
    expect(formatUnit(fakeCurrencyUnit("1234.56 USD"))).toBe("$1.234,56");
  });

  it("USD with currencyDisplay='code'", () => {
    useFormatStore.getState().setCurrencyDisplay("code");
    const out = formatUnit(fakeCurrencyUnit("100 USD"));
    expect(out.includes("USD")).toBe(true);
  });
});

describe("formatNumber × format matrix (exact strings)", () => {
  // Each row: [format-id, value, expected output]. Covers Latin-digit
  // formats + the Indian numbering format. No regex — every output is
  // pinned to an exact string so a regression in the swap is caught.
  const cases: { formatId: string; value: number; expected: string }[] = [
    // en-US-style: dot decimal, comma group.
    { formatId: "en-US", value: 1234567.89, expected: "1,234,567.89" },
    { formatId: "en-US", value: -1234567.89, expected: "-1,234,567.89" },
    { formatId: "en-US", value: 1000, expected: "1,000" },
    { formatId: "en-US", value: 0.5, expected: "0.5" },

    // de-DE-style: comma decimal, dot group.
    { formatId: "de-DE", value: 1234567.89, expected: "1.234.567,89" },
    { formatId: "de-DE", value: -1234567.89, expected: "-1.234.567,89" },
    { formatId: "de-DE", value: 1000, expected: "1.000" },
    { formatId: "de-DE", value: 0.5, expected: "0,5" },

    // fr-FR-style: comma decimal, NNBSP group → sanitised to space.
    { formatId: "fr-FR", value: 1234567.89, expected: "1 234 567,89" },
    { formatId: "fr-FR", value: 0.5, expected: "0,5" },

    // de-CH-style: dot decimal, apostrophe group.
    { formatId: "de-CH", value: 1234567.89, expected: "1'234'567.89" },
    { formatId: "de-CH", value: 1000, expected: "1'000" },

    // Indian numbering: en-IN groups as 12,34,567.
    { formatId: "en-IN", value: 1234567.89, expected: "12,34,567.89" },
    { formatId: "en-IN", value: 1000, expected: "1,000" },
  ];

  for (const { formatId, value, expected } of cases) {
    it(`format=${formatId} value=${value} → "${expected}"`, () => {
      useFormatStore.getState().setNumberFormatId(formatId);
      expect(formatNumber(value)).toBe(expected);
    });
  }
});

describe("formatUnit × currency matrix (exact strings)", () => {
  const fakeCurrencyUnit = (literal: string) =>
    ({ toString: () => literal }) as unknown as import("mathjs").Unit;

  // Currency rendering uses the currency's home locale for symbol position,
  // then the user's chosen format's separators are swapped in.
  const cases: { formatId: string; literal: string; expected: string }[] = [
    // Default en-US format — separators match home locale.
    { formatId: "en-US", literal: "1234.56 USD", expected: "$1,234.56" },
    { formatId: "en-US", literal: "8.9 GBP", expected: "£8.90" },

    // de-DE format swaps separators on USD: $1.234,56 (symbol position
    // from en-US, separators from de-DE).
    { formatId: "de-DE", literal: "1234.56 USD", expected: "$1.234,56" },
    { formatId: "de-DE", literal: "8.9 GBP", expected: "£8,90" },

    // de-CH format on USD: $1'234.56.
    { formatId: "de-CH", literal: "1234.56 USD", expected: "$1'234.56" },
  ];

  for (const { formatId, literal, expected } of cases) {
    it(`format=${formatId} ${literal} → "${expected}"`, () => {
      useFormatStore.getState().setNumberFormatId(formatId);
      expect(formatUnit(fakeCurrencyUnit(literal))).toBe(expected);
    });
  }
});
