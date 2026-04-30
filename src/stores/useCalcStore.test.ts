import { compressToEncodedURIComponent } from "lz-string";
import { describe, it, expect, beforeEach } from "vitest";
import { useCalcStore, initFromURL } from "./useCalcStore";

beforeEach(() => {
  useCalcStore.setState({ text: "" });
  // Reset URL
  window.history.replaceState(null, "", "/");
});

describe("useCalcStore", () => {
  describe("setText", () => {
    it("updates text", () => {
      useCalcStore.getState().setText("2 + 3");
      expect(useCalcStore.getState().text).toBe("2 + 3");
    });

    it("syncs text to URL query param", () => {
      useCalcStore.getState().setText("hello");
      const url = new URL(window.location.href);
      expect(url.searchParams.has("q")).toBe(true);
    });

    it("removes query param when text is empty", () => {
      useCalcStore.getState().setText("test");
      useCalcStore.getState().setText("");
      const url = new URL(window.location.href);
      expect(url.searchParams.has("q")).toBe(false);
    });
  });

  describe("initFromURL", () => {
    it("loads text from compressed URL param", () => {
      const text = "42 * 2";
      const compressed = compressToEncodedURIComponent(text);
      window.history.replaceState(null, "", `/?q=${compressed}`);

      initFromURL();

      expect(useCalcStore.getState().text).toBe(text);
    });

    it("does nothing when no query param", () => {
      initFromURL();
      expect(useCalcStore.getState().text).toBe("");
    });
  });
});
