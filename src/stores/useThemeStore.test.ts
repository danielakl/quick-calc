import { describe, it, expect, beforeEach } from "vitest";
import { useThemeStore, initTheme } from "./useThemeStore";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  useThemeStore.setState({ theme: "dark" });
});

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
});
