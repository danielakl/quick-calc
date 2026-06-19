import { beforeEach, describe, expect, it } from "vitest";
import {
  getEffectiveNumberFormat,
  getExplicitNumberFormat,
  useFormatStore,
} from "./useFormatStore";

beforeEach(() => {
  localStorage.clear();
  useFormatStore.getState().reset();
  useFormatStore.setState({ formatVersion: 0 });
});

describe("useFormatStore — defaults", () => {
  it("starts with auto numberFormatId", () => {
    expect(useFormatStore.getState().numberFormatId).toBeNull();
  });

  it("starts with `symbol` currency display", () => {
    expect(useFormatStore.getState().currencyDisplay).toBe("symbol");
  });

  it("starts with formatVersion 0", () => {
    expect(useFormatStore.getState().formatVersion).toBe(0);
  });
});

describe("useFormatStore — mutators bump formatVersion", () => {
  it("setNumberFormatId", () => {
    useFormatStore.getState().setNumberFormatId("de-DE");
    expect(useFormatStore.getState().numberFormatId).toBe("de-DE");
    expect(useFormatStore.getState().formatVersion).toBe(1);
  });

  it("setCurrencyDisplay", () => {
    useFormatStore.getState().setCurrencyDisplay("code");
    expect(useFormatStore.getState().currencyDisplay).toBe("code");
    expect(useFormatStore.getState().formatVersion).toBe(1);
  });

  it("reset restores defaults and bumps formatVersion", () => {
    useFormatStore.getState().setNumberFormatId("fr-FR");
    useFormatStore.getState().setCurrencyDisplay("code");
    useFormatStore.getState().reset();
    expect(useFormatStore.getState().numberFormatId).toBeNull();
    expect(useFormatStore.getState().currencyDisplay).toBe("symbol");
    expect(useFormatStore.getState().formatVersion).toBe(3);
  });
});

describe("useFormatStore — persistence", () => {
  it("writes to localStorage on mutation", () => {
    useFormatStore.getState().setNumberFormatId("de-DE");
    const stored = localStorage.getItem("format-settings");
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!).state.numberFormatId).toBe("de-DE");
  });

  it("does not persist formatVersion", () => {
    useFormatStore.getState().setNumberFormatId("de-DE");
    const stored = JSON.parse(localStorage.getItem("format-settings")!);
    expect(stored.state.formatVersion).toBeUndefined();
  });
});

describe("getExplicitNumberFormat / getEffectiveNumberFormat", () => {
  it("getExplicitNumberFormat returns null in auto mode", () => {
    expect(getExplicitNumberFormat()).toBeNull();
  });

  it("getEffectiveNumberFormat returns a NumberFormat in auto mode (browser default)", () => {
    const f = getEffectiveNumberFormat();
    expect(typeof f.positiveExample).toBe("string");
    expect(f.positiveExample.length).toBeGreaterThan(0);
  });

  it("getExplicitNumberFormat returns the chosen format when set", () => {
    useFormatStore.getState().setNumberFormatId("de-DE");
    const f = getExplicitNumberFormat();
    expect(f?.matchingLocales).toContain("de-DE");
  });
});
