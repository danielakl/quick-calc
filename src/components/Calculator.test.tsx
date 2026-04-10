import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Calculator from "./Calculator";
import { useCalcStore } from "@/stores/useCalcStore";

beforeEach(() => {
  cleanup();
  useCalcStore.setState({ text: "", results: [] });
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

  it("re-renders when store text changes", async () => {
    render(<Calculator />);
    useCalcStore.getState().setText("7 * 8");
    await waitFor(() => {
      expect(screen.getAllByText("56").length).toBeGreaterThan(0);
    });
  });
});
