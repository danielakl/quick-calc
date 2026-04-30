import { describe, it, expect } from "vitest";
import { isEmpty } from "./stringUtils";

describe("isEmpty", () => {
  it("returns true for null", () => {
    expect(isEmpty(null)).toBe(true);
  });

  it("returns true for undefined", () => {
    expect(isEmpty(undefined)).toBe(true);
  });

  it("returns true for the empty string", () => {
    expect(isEmpty("")).toBe(true);
  });

  it("returns true for whitespace-only strings", () => {
    expect(isEmpty("   ")).toBe(true);
    expect(isEmpty("\t\t")).toBe(true);
  });

  it("returns true for line-ending-only strings", () => {
    expect(isEmpty("\n\n\n")).toBe(true);
  });

  it("returns true for strings containing only invisible characters", () => {
    // Zero-width space, bidi control — sanitize strips these.
    expect(isEmpty("​‮")).toBe(true);
  });

  it("returns false for non-empty strings", () => {
    expect(isEmpty("hello")).toBe(false);
  });

  it("returns false for strings with leading/trailing whitespace and content", () => {
    expect(isEmpty("  x  ")).toBe(false);
  });

  it("returns false for non-string values", () => {
    // The runtime branch at stringUtils.ts:11-13 — mostly defensive,
    // since the type signature already restricts to string | null | undefined.
    // @ts-expect-error — exercising the runtime guard.
    expect(isEmpty(0)).toBe(false);
    // @ts-expect-error — same guard.
    expect(isEmpty(false)).toBe(false);
  });
});
