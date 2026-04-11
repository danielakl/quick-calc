import { compressToEncodedURIComponent } from "lz-string";
import { describe, it, expect, beforeEach } from "vitest";
import { useCalcStore, initFromURL } from "./useCalcStore";

beforeEach(() => {
  useCalcStore.setState({ text: "", results: [] });
  // Reset URL
  window.history.replaceState(null, "", "/");
});

describe("useCalcStore", () => {
  describe("setText", () => {
    it("updates text and evaluates results", () => {
      useCalcStore.getState().setText("2 + 3");
      const state = useCalcStore.getState();
      expect(state.text).toBe("2 + 3");
      expect(state.results).toHaveLength(1);
      expect(state.results[0].value).toBe(5);
    });

    it("handles multiline input", () => {
      useCalcStore.getState().setText("10\n20\nsum");
      const state = useCalcStore.getState();
      expect(state.results).toHaveLength(3);
      expect(state.results[2].value).toBe(30);
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

      const state = useCalcStore.getState();
      expect(state.text).toBe(text);
      expect(state.results[0].value).toBe(84);
    });

    it("does nothing when no query param", () => {
      initFromURL();
      const state = useCalcStore.getState();
      expect(state.text).toBe("");
      expect(state.results).toHaveLength(0);
    });
  });
});
