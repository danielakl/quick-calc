import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ResultLine from "./ResultLine";
import { LineResult } from "@/lib/engine";

function makeResult(overrides: Partial<LineResult> = {}): LineResult {
  return {
    value: null,
    display: "",
    error: null,
    isAssignment: false,
    ...overrides,
  };
}

describe("ResultLine", () => {
  it("renders empty line as non-breaking space", () => {
    const { container } = render(<ResultLine result={makeResult()} />);
    expect(container.textContent).toBe("\u00a0");
  });

  it("displays the result value", () => {
    render(<ResultLine result={makeResult({ display: "42", value: 42 })} />);
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("applies accent class for non-assignment results", () => {
    const { container } = render(
      <ResultLine result={makeResult({ display: "100", value: 100 })} />,
    );
    const div = container.firstElementChild!;
    expect(div.className).toContain("text-accent");
    expect(div.className).not.toContain("text-accent-dim");
  });

  it("applies accent-dim class for assignment results", () => {
    const { container } = render(
      <ResultLine
        result={makeResult({
          display: "10",
          value: 10,
          isAssignment: true,
        })}
      />,
    );
    const div = container.firstElementChild!;
    expect(div.className).toContain("text-accent-dim");
  });
});
