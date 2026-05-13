import { afterEach, describe, expect, it } from "vitest";
import { useFormatStore } from "@/stores/useFormatStore";
import { detectDefaultFormat, getNumberFormatByLocale, getNumberFormats } from "./numberFormats";

afterEach(() => {
  useFormatStore.getState().reset();
  localStorage.clear();
});

describe("getNumberFormats", () => {
  it("returns at least the four common Latin-digit formats", () => {
    const formats = getNumberFormats();
    const examples = formats.map((f) => f.positiveExample);
    expect(examples).toContain("1,234,567.89");
    expect(examples).toContain("1.234.567,89");
    expect(examples).toContain("1 234 567,89");
    expect(examples).toContain("1'234'567.89");
  });

  it("returns the Indian numbering format", () => {
    const examples = getNumberFormats().map((f) => f.positiveExample);
    expect(examples).toContain("12,34,567.89");
  });

  it("each format has matchingLocales with at least one entry", () => {
    for (const f of getNumberFormats()) {
      expect(f.matchingLocales.length).toBeGreaterThan(0);
    }
  });

  it("each format's separators are inferred consistently", () => {
    const enUS = getNumberFormats().find((f) => f.positiveExample === "1,234,567.89");
    expect(enUS).toBeDefined();
    expect(enUS!.decimal).toBe(".");
    expect(enUS!.group).toBe(",");
  });
});

describe("getNumberFormatByLocale", () => {
  it("finds the format that contains en-US", () => {
    const f = getNumberFormatByLocale("en-US");
    expect(f).not.toBeNull();
    expect(f!.positiveExample).toBe("1,234,567.89");
  });

  it("finds the format that contains de-DE", () => {
    const f = getNumberFormatByLocale("de-DE");
    expect(f).not.toBeNull();
    expect(f!.positiveExample).toBe("1.234.567,89");
  });

  it("finds the format that contains de-CH", () => {
    const f = getNumberFormatByLocale("de-CH");
    expect(f).not.toBeNull();
    expect(f!.positiveExample).toBe("1'234'567.89");
  });

  it("returns null for an unknown locale", () => {
    expect(getNumberFormatByLocale("xx-INVALID")).toBeNull();
  });
});

describe("detectDefaultFormat", () => {
  it("returns a format (jsdom navigator.languages defaults to en-US)", () => {
    const f = detectDefaultFormat();
    expect(f.positiveExample).toBe("1,234,567.89");
  });
});
