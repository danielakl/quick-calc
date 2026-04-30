"use client";

import { useMemo, useRef, useState } from "react";
import { Temporal } from "temporal-polyfill";
import { CURRENCIES, CURRENCY_SYMBOLS, type CurrencyCode } from "@/lib/currencies";
import {
  type Status,
  derivePerUnitFromUsd,
  displayRate,
  formatRelative,
} from "@/lib/exchangeRates";
import { sanitize } from "@/lib/utils/sanitizeString";
import { isEmpty } from "@/lib/utils/stringUtils";
import { useCurrencyStore } from "@/stores/useCurrencyStore";
import Modal from "./Modal";
import CloseIcon from "./icons/CloseIcon";
import DollarIcon from "./icons/DollarIcon";

const STATUS_LABEL: Record<Status, string> = {
  fresh: "Up to date",
  stale: "Stale",
  fetching: "Updating…",
  error: "Failed",
};

const STATUS_COLOR: Record<Status, string> = {
  fresh: "text-muted",
  stale: "text-warning",
  fetching: "text-accent",
  error: "text-warning",
};

function formatRate(rate: number | null): string {
  if (rate == null) {
    return "";
  }
  if (rate >= 1000) {
    return rate.toFixed(0);
  }
  if (rate >= 1) {
    return rate.toFixed(4);
  }
  if (rate >= 0.001) {
    return rate.toFixed(5);
  }
  return rate.toExponential(2);
}

interface RateRow {
  code: CurrencyCode;
  name: string;
  symbol: string;
  rate: number | null;
}

interface Props {
  now: Temporal.Instant;
}

export default function CurrencyStatus({ now }: Props) {
  const [open, setOpen] = useState(false);
  const status = useCurrencyStore((state) => state.status);
  const fetchedAt = useCurrencyStore((state) => state.fetchedAt);
  const base = useCurrencyStore((state) => state.base);
  const setBase = useCurrencyStore((state) => state.setBase);
  const usdRates = useCurrencyStore((state) => state.usdRates);

  const [filter, setFilter] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const close = () => setOpen(false);

  const perUnit = useMemo(
    () => (usdRates ? derivePerUnitFromUsd(usdRates) : new Map<CurrencyCode, number>()),
    [usdRates],
  );

  const totalCount = CURRENCIES.length;

  const rows = useMemo<RateRow[]>(() => {
    const query = sanitize(filter, {
      collapseWhitespace: true,
      maxLength: 30,
      removeLineEndings: true,
      stripEmoji: true,
    })?.toLocaleUpperCase();

    const allRows: RateRow[] = CURRENCIES.map((currency) => ({
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol ?? "",
      rate: displayRate(perUnit, currency.code, base),
    }));

    if (isEmpty(query)) {
      return allRows;
    }

    return allRows.filter(
      (row) =>
        row.code.toLocaleUpperCase().includes(query) ||
        row.name.toLocaleUpperCase().includes(query) ||
        row.symbol?.toLocaleUpperCase().includes(query),
    );
  }, [filter, perUnit, base]);

  const statusLabel = STATUS_LABEL[status];
  const statusColor = STATUS_COLOR[status];
  const titleAttribute = `${statusLabel} · ${formatRelative(fetchedAt, now)}`;

  return (
    <>
      <button
        data-testid="currency-button"
        onClick={() => setOpen(true)}
        aria-label={`Currency rates: ${statusLabel}.`}
        title={titleAttribute}
        className={`inline-flex cursor-pointer items-center justify-center rounded-md p-2 transition-colors duration-150 ease-in-out hover:bg-surface-alt hover:text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background active:scale-[0.98] ${statusColor}`}
      >
        <span className={status === "fetching" ? "inline-flex animate-pulse" : "inline-flex"}>
          <DollarIcon />
        </span>
      </button>

      <Modal
        open={open}
        onClose={close}
        overlayTestId="currency-overlay"
        cardTestId="currency-modal"
        ariaLabelledBy="currency-modal-title"
        cardClassName="flex h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border p-5">
          <div className="min-w-0">
            <h2
              id="currency-modal-title"
              className="font-sans text-lg font-semibold text-foreground"
            >
              Currency rates
            </h2>
            <p className="mt-1 text-xs text-muted">
              {totalCount} currencies · base{" "}
              <span className="rounded-sm bg-accent/20 px-1.5 py-0.5 font-mono text-xs text-foreground">
                {base}
              </span>{" "}
              · click any row to change
            </p>
          </div>
          <button
            data-testid="currency-close"
            onClick={close}
            aria-label="Close currency rates"
            className="shrink-0 cursor-pointer rounded-md p-2 text-muted transition-colors duration-150 ease-in-out hover:bg-surface-alt hover:text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background active:scale-[0.98]"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-3">
          <input
            ref={inputRef}
            data-testid="currency-search"
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter by code, symbol, or name…"
            aria-label="Filter currencies"
            autoFocus
            className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 font-sans text-sm text-foreground placeholder:text-muted focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <span className="font-mono text-xs tabular-nums text-muted whitespace-nowrap">
            {rows.length} of {totalCount}
          </span>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-surface">
              <tr>
                <th className="border-b border-border px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted">
                  Code
                </th>
                <th className="border-b border-border px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted">
                  Name
                </th>
                <th className="border-b border-border px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted">
                  Symbol
                </th>
                <th className="border-b border-border px-3 py-2.5 text-right text-[10px] font-medium uppercase tracking-wider text-muted">
                  Rate
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isBase = row.code === base;
                const baseRowClasses = isBase
                  ? "bg-[color-mix(in_oklch,var(--color-accent)_28%,transparent)] hover:bg-[color-mix(in_oklch,var(--color-accent)_34%,transparent)] [&>td]:text-white [html[data-theme=light]_&>td]:text-foreground [&>td:first-child]:shadow-[inset_4px_0_0_var(--color-accent)]"
                  : "hover:bg-surface-alt focus-visible:bg-surface-alt";
                return (
                  <tr
                    key={row.code}
                    data-testid={`currency-row-${row.code}`}
                    onClick={() => setBase(row.code as CurrencyCode)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setBase(row.code as CurrencyCode);
                      }
                    }}
                    tabIndex={0}
                    aria-selected={isBase}
                    className={`cursor-pointer select-none border-b border-border outline-none transition-colors duration-100 ${baseRowClasses}`}
                  >
                    <td className="w-32.5 whitespace-nowrap px-3 py-2 font-mono font-medium tracking-wide text-foreground">
                      {row.code}
                    </td>
                    <td className="max-w-0 overflow-hidden text-ellipsis whitespace-nowrap px-3 py-2 text-muted">
                      {row.name}
                    </td>
                    <td className="w-17.5 whitespace-nowrap px-3 py-2 font-mono text-foreground">
                      {row.symbol}
                    </td>
                    <td className="w-27.5 whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums text-foreground">
                      {formatRate(row.rate)}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-10 text-center italic text-muted">
                    No currencies match &ldquo;{filter}&rdquo;.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="flex shrink-0 items-center border-t border-border px-5 py-2.5 text-xs text-muted">
          <span data-testid="currency-updated">Updated {formatRelative(fetchedAt, now)}</span>
          <span className="flex-1" aria-hidden="true" />
          <span>Powered by exchange-api</span>
        </footer>
      </Modal>
    </>
  );
}

export { CURRENCY_SYMBOLS };
