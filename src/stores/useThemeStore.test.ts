import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useThemeStore, initTheme } from "./useThemeStore";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  useThemeStore.setState({ theme: "dark" });
});

/**
 * Mock window.matchMedia. The polyfill in jsdom returns `matches: false` for
 * everything by default, which means tests covering "prefers light" never
 * exercise the matched branch.
 */
function stubMatchMedia(prefersLight: boolean): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("light") ? prefersLight : !prefersLight,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

describe("useThemeStore", () => {
  describe("toggleTheme", () => {
    it("toggles from dark to light", () => {
      useThemeStore.getState().toggleTheme();
      expect(useThemeStore.getState().theme).toBe("light");
    });

    it("toggles from light back to dark", () => {
      useThemeStore.getState().toggleTheme();
      useThemeStore.getState().toggleTheme();
      expect(useThemeStore.getState().theme).toBe("dark");
    });

    it("persists theme to localStorage", () => {
      useThemeStore.getState().toggleTheme();
      expect(localStorage.getItem("theme")).toBe("light");
    });

    it("sets data-theme attribute for light", () => {
      useThemeStore.getState().toggleTheme();
      expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    });

    it("removes data-theme attribute for dark", () => {
      useThemeStore.getState().toggleTheme();
      useThemeStore.getState().toggleTheme();
      expect(document.documentElement.getAttribute("data-theme")).toBeNull();
    });
  });

  describe("initTheme", () => {
    it("applies dark theme to DOM by default", () => {
      initTheme();
      expect(document.documentElement.getAttribute("data-theme")).toBeNull();
    });

    it("applies light theme to DOM when store is light", () => {
      useThemeStore.setState({ theme: "light" });
      initTheme();
      expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    });
  });

  describe("module-init theme resolution", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
      vi.resetModules();
    });

    it("initialises to light when localStorage has 'light'", async () => {
      localStorage.setItem("theme", "light");
      stubMatchMedia(false);
      vi.resetModules();
      const { useThemeStore: fresh } = await import("./useThemeStore");
      expect(fresh.getState().theme).toBe("light");
    });

    it("initialises to dark when localStorage has 'dark' even if system prefers light", async () => {
      localStorage.setItem("theme", "dark");
      stubMatchMedia(true);
      vi.resetModules();
      const { useThemeStore: fresh } = await import("./useThemeStore");
      expect(fresh.getState().theme).toBe("dark");
    });

    it("falls through to prefers-color-scheme: light when localStorage is empty", async () => {
      stubMatchMedia(true);
      vi.resetModules();
      const { useThemeStore: fresh } = await import("./useThemeStore");
      expect(fresh.getState().theme).toBe("light");
    });

    it("falls through to dark when system prefers dark and localStorage is empty", async () => {
      stubMatchMedia(false);
      vi.resetModules();
      const { useThemeStore: fresh } = await import("./useThemeStore");
      expect(fresh.getState().theme).toBe("dark");
    });

    it("ignores unrecognised localStorage values and uses system preference", async () => {
      localStorage.setItem("theme", "garbage");
      stubMatchMedia(true);
      vi.resetModules();
      const { useThemeStore: fresh } = await import("./useThemeStore");
      expect(fresh.getState().theme).toBe("light");
    });

    it("defaults to dark when matchMedia is unavailable", async () => {
      vi.stubGlobal("matchMedia", undefined);
      vi.resetModules();
      const { useThemeStore: fresh } = await import("./useThemeStore");
      expect(fresh.getState().theme).toBe("dark");
    });
  });
});
