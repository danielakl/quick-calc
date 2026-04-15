import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import HelpModal from "./HelpModal";

beforeEach(() => {
  cleanup();
});

describe("HelpModal", () => {
  it("renders the help button with accessible label", () => {
    render(<HelpModal />);
    const button = screen.getByTestId("help-open");
    expect(button).toHaveAttribute("aria-label", "Open help");
  });

  it("does not show the modal by default", () => {
    render(<HelpModal />);
    expect(screen.queryByTestId("help-modal")).not.toBeInTheDocument();
  });

  it("opens the modal when the help button is clicked", async () => {
    const user = userEvent.setup();
    render(<HelpModal />);

    await user.click(screen.getByTestId("help-open"));

    expect(screen.getByTestId("help-modal")).toBeInTheDocument();
    expect(screen.getByText("Help")).toBeInTheDocument();
  });

  it("closes the modal when the close button is clicked", async () => {
    const user = userEvent.setup();
    render(<HelpModal />);

    await user.click(screen.getByTestId("help-open"));
    expect(screen.getByTestId("help-modal")).toBeInTheDocument();

    await user.click(screen.getByTestId("help-close"));
    expect(screen.queryByTestId("help-modal")).not.toBeInTheDocument();
  });

  it("closes the modal when the overlay is clicked", async () => {
    const user = userEvent.setup();
    render(<HelpModal />);

    await user.click(screen.getByTestId("help-open"));
    expect(screen.getByTestId("help-modal")).toBeInTheDocument();

    await user.click(screen.getByTestId("help-overlay"));
    expect(screen.queryByTestId("help-modal")).not.toBeInTheDocument();
  });

  it("does not close the modal when the modal panel is clicked", async () => {
    const user = userEvent.setup();
    render(<HelpModal />);

    await user.click(screen.getByTestId("help-open"));
    await user.click(screen.getByTestId("help-modal"));

    expect(screen.getByTestId("help-modal")).toBeInTheDocument();
  });

  it("closes the modal on Escape key press", async () => {
    const user = userEvent.setup();
    render(<HelpModal />);

    await user.click(screen.getByTestId("help-open"));
    expect(screen.getByTestId("help-modal")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByTestId("help-modal")).not.toBeInTheDocument();
  });

  it("displays all help sections", async () => {
    const user = userEvent.setup();
    render(<HelpModal />);

    await user.click(screen.getByTestId("help-open"));

    expect(screen.getByText("Basic Math")).toBeInTheDocument();
    expect(screen.getByText("Comments")).toBeInTheDocument();
    expect(screen.getByText("Variables")).toBeInTheDocument();
    expect(screen.getByText("Constants")).toBeInTheDocument();
    expect(screen.getByText("Built-in References")).toBeInTheDocument();
    expect(screen.getByText("Name Counting")).toBeInTheDocument();
    expect(screen.getByText("Functions")).toBeInTheDocument();
    expect(screen.getByText("Custom Functions")).toBeInTheDocument();
    expect(screen.getByText("Derivatives")).toBeInTheDocument();
    expect(screen.getByText("Integrals")).toBeInTheDocument();
  });

  it("displays example expressions", async () => {
    const user = userEvent.setup();
    render(<HelpModal />);

    await user.click(screen.getByTestId("help-open"));

    expect(screen.getByText("5 + 3")).toBeInTheDocument();
    expect(screen.getByText("sqrt(144)")).toBeInTheDocument();
    expect(screen.getByText("prev")).toBeInTheDocument();
    expect(screen.getByText("price = 49.99")).toBeInTheDocument();
  });

  it("has accessible close button label", async () => {
    const user = userEvent.setup();
    render(<HelpModal />);

    await user.click(screen.getByTestId("help-open"));

    expect(screen.getByTestId("help-close")).toHaveAttribute(
      "aria-label",
      "Close help",
    );
  });
});
