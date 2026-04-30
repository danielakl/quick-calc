import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import Modal from "./Modal";

beforeEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

describe("Modal", () => {
  it("renders nothing when closed", () => {
    render(
      <Modal open={false} onClose={() => {}} overlayTestId="ov" cardTestId="card">
        <p>hidden</p>
      </Modal>,
    );
    expect(screen.queryByTestId("ov")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card")).not.toBeInTheDocument();
    expect(screen.queryByText("hidden")).not.toBeInTheDocument();
  });

  it("portals into document.body when open", () => {
    const { container } = render(
      <Modal open onClose={() => {}} overlayTestId="ov" cardTestId="card">
        <p>visible</p>
      </Modal>,
    );
    const overlay = screen.getByTestId("ov");
    // Portal target is body, not the test container.
    expect(container.contains(overlay)).toBe(false);
    expect(document.body.contains(overlay)).toBe(true);
    expect(screen.getByText("visible")).toBeInTheDocument();
  });

  it("forwards aria attributes and test ids", () => {
    render(
      <Modal open onClose={() => {}} overlayTestId="ov" cardTestId="card" ariaLabelledBy="title-id">
        <h2 id="title-id">Title</h2>
      </Modal>,
    );
    const card = screen.getByTestId("card");
    expect(card).toHaveAttribute("role", "dialog");
    expect(card).toHaveAttribute("aria-modal", "true");
    expect(card).toHaveAttribute("aria-labelledby", "title-id");
  });

  it("invokes onClose when overlay is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} overlayTestId="ov" cardTestId="card">
        <p>x</p>
      </Modal>,
    );
    await user.click(screen.getByTestId("ov"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not invoke onClose when the card itself is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} overlayTestId="ov" cardTestId="card">
        <p>x</p>
      </Modal>,
    );
    await user.click(screen.getByTestId("card"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("invokes onClose on Escape keypress", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} overlayTestId="ov" cardTestId="card">
        <p>x</p>
      </Modal>,
    );
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ignores non-Escape keys", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} overlayTestId="ov" cardTestId="card">
        <p>x</p>
      </Modal>,
    );
    await user.keyboard("{Enter}");
    await user.keyboard("a");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("locks body scroll while open and restores it on close", () => {
    document.body.style.overflow = "scroll";
    const { rerender } = render(
      <Modal open onClose={() => {}} overlayTestId="ov" cardTestId="card">
        <p>x</p>
      </Modal>,
    );
    expect(document.body.style.overflow).toBe("hidden");

    rerender(
      <Modal open={false} onClose={() => {}} overlayTestId="ov" cardTestId="card">
        <p>x</p>
      </Modal>,
    );
    expect(document.body.style.overflow).toBe("scroll");
  });

  it("restores body scroll on unmount", () => {
    document.body.style.overflow = "auto";
    const { unmount } = render(
      <Modal open onClose={() => {}} overlayTestId="ov" cardTestId="card">
        <p>x</p>
      </Modal>,
    );
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("auto");
  });

  it("uses default card classes when cardClassName is not provided", () => {
    render(
      <Modal open onClose={() => {}} overlayTestId="ov" cardTestId="card">
        <p>x</p>
      </Modal>,
    );
    const card = screen.getByTestId("card");
    expect(card.className).toContain("bg-surface");
    expect(card.className).toContain("rounded-lg");
  });

  it("replaces card classes when cardClassName is provided", () => {
    render(
      <Modal
        open
        onClose={() => {}}
        overlayTestId="ov"
        cardTestId="card"
        cardClassName="custom-card-class"
      >
        <p>x</p>
      </Modal>,
    );
    const card = screen.getByTestId("card");
    expect(card.className).toBe("custom-card-class");
  });
});
