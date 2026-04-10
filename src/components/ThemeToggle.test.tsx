import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ThemeToggle from "./ThemeToggle";
import { useThemeStore } from "@/stores/useThemeStore";

beforeEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  useThemeStore.setState({ theme: "dark" });
});

describe("ThemeToggle", () => {
  it("renders a button with accessible label", () => {
    render(<ThemeToggle />);
    const button = screen.getByTestId("theme-toggle");
    expect(button).toHaveAttribute("aria-label", "Switch to light theme");
  });

  it("updates aria-label after toggling to light", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByTestId("theme-toggle"));

    expect(screen.getByTestId("theme-toggle")).toHaveAttribute(
      "aria-label",
      "Switch to dark theme",
    );
  });

  it("toggles theme state on click", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    const button = screen.getByTestId("theme-toggle");

    await user.click(button);
    expect(useThemeStore.getState().theme).toBe("light");

    await user.click(button);
    expect(useThemeStore.getState().theme).toBe("dark");
  });
});
