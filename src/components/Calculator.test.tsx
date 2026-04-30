import { fireEvent, render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import { useCalcStore } from "@/stores/useCalcStore";
import Calculator from "./Calculator";

beforeEach(() => {
  cleanup();
  useCalcStore.setState({ text: "" });
  window.history.replaceState(null, "", "/");
});

describe("Calculator", () => {
  it("renders the header with theme toggle", () => {
    render(<Calculator />);
    expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
  });

  it("renders a textarea with placeholder", () => {
    render(<Calculator />);
    const textarea = screen.getByTestId("calc-input");
    expect(textarea).toHaveValue("");
    expect(textarea).toHaveAttribute("placeholder", "Type an expression...");
  });

  it("evaluates expressions as user types", async () => {
    const user = userEvent.setup();
    render(<Calculator />);
    const textarea = screen.getByTestId("calc-input");

    await user.type(textarea, "2 + 3");
    expect(screen.getAllByText("5").length).toBeGreaterThan(0);
  });

  it("shows results for store-driven multiline input", () => {
    useCalcStore.getState().setText("10\n20\nsum");
    render(<Calculator />);
    expect(screen.getAllByText("10").length).toBeGreaterThan(0);
    expect(screen.getAllByText("20").length).toBeGreaterThan(0);
    expect(screen.getAllByText("30").length).toBeGreaterThan(0);
  });

  it("textarea has an accessible label", () => {
    render(<Calculator />);
    const textarea = screen.getByTestId("calc-input");
    expect(textarea).toHaveAttribute("aria-label", "Calculator input");
  });

  it("re-renders when store text changes", async () => {
    render(<Calculator />);
    useCalcStore.getState().setText("7 * 8");
    await waitFor(() => {
      expect(screen.getAllByText("56").length).toBeGreaterThan(0);
    });
  });

  describe("scroll synchronisation", () => {
    it("propagates textarea scrollTop to the results panel", () => {
      useCalcStore.getState().setText("1\n2\n3\n4\n5");
      render(<Calculator />);
      const textarea = screen.getByTestId("calc-input") as HTMLTextAreaElement;
      const results = screen.getByTestId("calc-results") as HTMLDivElement;

      textarea.scrollTop = 42;
      fireEvent.scroll(textarea);

      expect(results.scrollTop).toBe(42);
    });

    it("propagates results-panel scrollTop back to the textarea", () => {
      useCalcStore.getState().setText("1\n2\n3\n4\n5");
      render(<Calculator />);
      const textarea = screen.getByTestId("calc-input") as HTMLTextAreaElement;
      const results = screen.getByTestId("calc-results") as HTMLDivElement;

      results.scrollTop = 17;
      fireEvent.scroll(results);

      expect(textarea.scrollTop).toBe(17);
    });
  });

  describe("preview mode", () => {
    it("starts in preview mode (results panel is narrow)", () => {
      useCalcStore.getState().setText("1 + 1");
      render(<Calculator />);
      const panel = screen.getByTestId("calc-results").parentElement!;
      expect(panel.className).toMatch(/w-\[30%\]/);
      expect(panel.className).not.toMatch(/w-4\/5/);
    });

    it("expands results panel when clicked in preview mode", async () => {
      const user = userEvent.setup();
      useCalcStore.getState().setText("1 + 1");
      render(<Calculator />);
      const panel = screen.getByTestId("calc-results").parentElement!;

      await user.click(panel);
      expect(panel.className).toMatch(/w-4\/5/);
      expect(panel.className).not.toMatch(/w-\[30%\]/);
    });

    it("returns to preview mode when the textarea is focused again", async () => {
      const user = userEvent.setup();
      useCalcStore.getState().setText("1 + 1");
      render(<Calculator />);
      const panel = screen.getByTestId("calc-results").parentElement!;
      const textarea = screen.getByTestId("calc-input") as HTMLTextAreaElement;

      await user.click(panel);
      expect(panel.className).toMatch(/w-4\/5/);

      textarea.blur();
      await user.click(textarea);
      expect(panel.className).toMatch(/w-\[30%\]/);
    });
  });
});
