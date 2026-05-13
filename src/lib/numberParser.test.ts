import { describe, expect, it } from "vitest";
import { getNumberFormatByLocale } from "./numberFormats";
import {
  type ActiveSeparators,
  detectFromLines,
  normalizeLine,
  pickSeparators,
} from "./numberParser";

const COMMA_DECIMAL: ActiveSeparators = { decimal: ",", group: ".", source: "format" };
const DOT_DECIMAL: ActiveSeparators = { decimal: ".", group: ",", source: "format" };
const SPACE_GROUP: ActiveSeparators = { decimal: ",", group: " ", source: "format" };
const APOSTROPHE_GROUP: ActiveSeparators = { decimal: ".", group: "'", source: "format" };

function fmt(locale: string) {
  const f = getNumberFormatByLocale(locale);
  if (!f) {
    throw new Error(`No format for ${locale}`);
  }
  return f;
}

describe("detectFromLines", () => {
  it("votes comma-decimal for `1,5`", () => {
    expect(detectFromLines(["1,5"])?.decimal).toBe(",");
  });

  it("votes comma-decimal for `1,12345`", () => {
    expect(detectFromLines(["1,12345"])?.decimal).toBe(",");
  });

  it("votes comma-decimal for `1.234,56` (both, comma rightmost)", () => {
    expect(detectFromLines(["1.234,56"])?.decimal).toBe(",");
  });

  it("does NOT vote for `1,234` (3 digits — ambiguous)", () => {
    expect(detectFromLines(["1,234"])).toBeNull();
  });

  it("does NOT vote for `1.234` (3 digits — ambiguous)", () => {
    expect(detectFromLines(["1.234"])).toBeNull();
  });

  it("returns null for plain integers", () => {
    expect(detectFromLines(["100", "200", "x = 5"])).toBeNull();
  });

  it("first comma-decimal line wins even if a later line has dot-decimal usage", () => {
    // `1,5` on line 1 is unambiguous comma-decimal — heuristic stops there.
    expect(detectFromLines(["1,5", "1,234.56"])?.decimal).toBe(",");
  });

  it("returns null for `1,234.56` alone (dot rightmost — not comma-decimal)", () => {
    expect(detectFromLines(["1,234.56"])).toBeNull();
  });

  it("flips to comma-decimal across multiple lines if any line has unambiguous comma-decimal", () => {
    expect(detectFromLines(["100", "x = 1,5", "200"])?.decimal).toBe(",");
  });

  it("ignores numbers inside identifiers", () => {
    expect(detectFromLines(["var1,5"])).toBeNull();
  });
});

describe("pickSeparators priority chain", () => {
  const enUS = fmt("en-US");
  const deDE = fmt("de-DE");

  it("explicit format wins over heuristic vote on input", () => {
    const sep = pickSeparators(["1,5"], { explicitFormat: enUS, defaultFormat: deDE });
    expect(sep).toEqual({ decimal: ".", group: ",", source: "format" });
  });

  it("explicit format wins over default format", () => {
    const sep = pickSeparators(["1.234"], { explicitFormat: deDE, defaultFormat: enUS });
    expect(sep).toEqual({ decimal: ",", group: ".", source: "format" });
  });

  it("auto: heuristic wins when an unambiguous comma-decimal token appears", () => {
    const sep = pickSeparators(["1,5 + 2,5"], { explicitFormat: null, defaultFormat: enUS });
    expect(sep.decimal).toBe(",");
    expect(sep.source).toBe("heuristic");
  });

  it("auto: falls through to default format when no heuristic vote", () => {
    const sep = pickSeparators(["100"], { explicitFormat: null, defaultFormat: deDE });
    expect(sep).toEqual({ decimal: ",", group: ".", source: "format" });
  });
});

describe("normalizeLine — comma-decimal mode", () => {
  it("`1,5` → `1.5`", () => {
    expect(normalizeLine("1,5", COMMA_DECIMAL)).toBe("1.5");
  });

  it("`1.234,56` → `1234.56`", () => {
    expect(normalizeLine("1.234,56", COMMA_DECIMAL)).toBe("1234.56");
  });

  it("`1.234.567,89` → `1234567.89`", () => {
    expect(normalizeLine("1.234.567,89", COMMA_DECIMAL)).toBe("1234567.89");
  });

  it("`1,5 + 2,5` → `1.5 + 2.5`", () => {
    expect(normalizeLine("1,5 + 2,5", COMMA_DECIMAL)).toBe("1.5 + 2.5");
  });

  it("preserves `min(1, 5)` (space-separated args)", () => {
    expect(normalizeLine("min(1, 5)", COMMA_DECIMAL)).toBe("min(1, 5)");
  });

  it("collapses `min(1,5)` to `min(1.5)` (single arg by spec)", () => {
    expect(normalizeLine("min(1,5)", COMMA_DECIMAL)).toBe("min(1.5)");
  });

  it("preserves identifiers `prev`, `sum`", () => {
    expect(normalizeLine("prev + sum", COMMA_DECIMAL)).toBe("prev + sum");
  });

  it("`1,5e-3` → `1.5e-3`", () => {
    expect(normalizeLine("1,5e-3", COMMA_DECIMAL)).toBe("1.5e-3");
  });

  it("does not touch number inside an identifier (`var1,5`)", () => {
    // `1` after `r` is blocked by lookbehind. `,5` cannot start a token (`,`
    // isn't a digit). `5` after `,` matches as a bare integer with no group
    // or decimal — replacement is a no-op. Output stays untouched.
    expect(normalizeLine("var1,5", COMMA_DECIMAL)).toBe("var1,5");
  });
});

describe("normalizeLine — dot-decimal mode", () => {
  it("`1,234.56` → `1234.56`", () => {
    expect(normalizeLine("1,234.56", DOT_DECIMAL)).toBe("1234.56");
  });

  it("`1,234,567.89` → `1234567.89`", () => {
    expect(normalizeLine("1,234,567.89", DOT_DECIMAL)).toBe("1234567.89");
  });

  it("`1.5 + 2.5` → `1.5 + 2.5` (already canonical)", () => {
    expect(normalizeLine("1.5 + 2.5", DOT_DECIMAL)).toBe("1.5 + 2.5");
  });

  it("preserves `min(1, 5)` (function args)", () => {
    expect(normalizeLine("min(1, 5)", DOT_DECIMAL)).toBe("min(1, 5)");
  });

  it("`1.5e3` → `1.5e3`", () => {
    expect(normalizeLine("1.5e3", DOT_DECIMAL)).toBe("1.5e3");
  });
});

describe("normalizeLine — exotic groups", () => {
  it("space-grouped (fr-FR): `1 234,56` → `1234.56`", () => {
    expect(normalizeLine("1 234,56", SPACE_GROUP)).toBe("1234.56");
  });

  it("apostrophe-grouped (de-CH): `1'234.56` → `1234.56`", () => {
    expect(normalizeLine("1'234.56", APOSTROPHE_GROUP)).toBe("1234.56");
  });
});
