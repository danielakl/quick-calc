import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Temporal } from "temporal-polyfill";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CurrencyCode } from "@/lib/currencies";
import { type Status } from "@/lib/exchangeRates";
import { nowInstant } from "@/lib/utils/dateUtils";
import { useCurrencyStore } from "@/stores/useCurrencyStore";
import CurrencyStatus from "./CurrencyStatus";

const SAMPLE_USD_RATES = new Map<CurrencyCode, number>([
  [CurrencyCode.EUR, 0.92],
  [CurrencyCode.NOK, 10.93],
  [CurrencyCode.GBP, 0.8],
]);

function seedStore(overrides: Partial<ReturnType<typeof useCurrencyStore.getState>> = {}) {
  useCurrencyStore.setState({
    status: "fresh",
    fetchedAt: nowInstant().subtract({ seconds: 60 }),
    date: Temporal.PlainDate.from("2026-04-25"),
    usdRates: SAMPLE_USD_RATES,
    base: CurrencyCode.USD,
    ...overrides,
  });
}

beforeEach(() => {
  cleanup();
  seedStore();
});

afterEach(() => {
  cleanup();
});

function setStatus(status: Status, fetchedAt: Temporal.Instant | null = null) {
  useCurrencyStore.setState({ status, fetchedAt });
}

describe("CurrencyStatus button", () => {
  it("uses muted color in fresh state (matches Help/Theme)", () => {
    setStatus("fresh");
    render(<CurrencyStatus now={nowInstant()} />);
    const button = screen.getByTestId("currency-button");
    expect(button.className).toContain("text-muted");
    expect(button).toHaveAttribute("aria-label", "Currency rates: Up to date.");
  });

  it("uses warning color in stale state", () => {
    setStatus("stale");
    render(<CurrencyStatus now={nowInstant()} />);
    expect(screen.getByTestId("currency-button").className).toContain("text-warning");
  });

  it("uses accent color and pulses in fetching state", () => {
    setStatus("fetching");
    render(<CurrencyStatus now={nowInstant()} />);
    const button = screen.getByTestId("currency-button");
    expect(button.className).toContain("text-accent");
    expect(button.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("includes relative time in the title", () => {
    const currentTime = nowInstant();
    setStatus("fresh", currentTime.subtract({ seconds: 5 }));
    render(<CurrencyStatus now={currentTime} />);
    expect(screen.getByTestId("currency-button")).toHaveAttribute("title", "Up to date · 5s ago");
  });
});

describe("CurrencyStatus modal", () => {
  it("does not render the modal until the button is clicked", () => {
    render(<CurrencyStatus now={nowInstant()} />);
    expect(screen.queryByTestId("currency-modal")).not.toBeInTheDocument();
  });

  it("opens the modal on button click and shows known rows", async () => {
    const user = userEvent.setup();
    render(<CurrencyStatus now={nowInstant()} />);
    await user.click(screen.getByTestId("currency-button"));
    expect(screen.getByTestId("currency-modal")).toBeInTheDocument();
    expect(screen.getByTestId("currency-row-USD")).toBeInTheDocument();
    expect(screen.getByTestId("currency-row-EUR")).toBeInTheDocument();
    expect(screen.getByTestId("currency-row-NOK")).toBeInTheDocument();
  });

  it("filters rows by code, symbol, and name", async () => {
    const user = userEvent.setup();
    render(<CurrencyStatus now={nowInstant()} />);
    await user.click(screen.getByTestId("currency-button"));
    await user.type(screen.getByTestId("currency-search"), "norwegian");
    expect(screen.queryByTestId("currency-row-USD")).not.toBeInTheDocument();
    expect(screen.getByTestId("currency-row-NOK")).toBeInTheDocument();
  });

  it("clicking a row sets it as the display base", async () => {
    const user = userEvent.setup();
    render(<CurrencyStatus now={nowInstant()} />);
    await user.click(screen.getByTestId("currency-button"));
    await user.click(screen.getByTestId("currency-row-EUR"));
    expect(useCurrencyStore.getState().base).toBe("EUR");
    expect(screen.getByTestId("currency-row-EUR").className).toContain("color-mix");
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    render(<CurrencyStatus now={nowInstant()} />);
    await user.click(screen.getByTestId("currency-button"));
    await user.keyboard("{Escape}");
    expect(screen.queryByTestId("currency-modal")).not.toBeInTheDocument();
  });

  it("closes when the close button is clicked", async () => {
    const user = userEvent.setup();
    render(<CurrencyStatus now={nowInstant()} />);
    await user.click(screen.getByTestId("currency-button"));
    await user.click(screen.getByTestId("currency-close"));
    expect(screen.queryByTestId("currency-modal")).not.toBeInTheDocument();
  });

  it("closes on overlay click but not on card click", async () => {
    const user = userEvent.setup();
    render(<CurrencyStatus now={nowInstant()} />);
    await user.click(screen.getByTestId("currency-button"));

    await user.click(screen.getByTestId("currency-modal"));
    expect(screen.getByTestId("currency-modal")).toBeInTheDocument();

    await user.click(screen.getByTestId("currency-overlay"));
    expect(screen.queryByTestId("currency-modal")).not.toBeInTheDocument();
  });

  it("renders 'Updated Xm ago' in the footer", async () => {
    const user = userEvent.setup();
    const currentTime = nowInstant();
    seedStore({ fetchedAt: currentTime.subtract({ minutes: 2 }) });
    render(<CurrencyStatus now={currentTime} />);
    await user.click(screen.getByTestId("currency-button"));
    expect(screen.getByTestId("currency-updated")).toHaveTextContent(/Updated 2m ago/);
  });
});
