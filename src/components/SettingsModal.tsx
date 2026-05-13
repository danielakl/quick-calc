"use client";

import { useMemo, useState } from "react";
import { formatNumber, formatUnit } from "@/lib/formatter";
import { detectDefaultFormat, getNumberFormats } from "@/lib/numberFormats";
import { type CurrencyDisplay, useFormatStore } from "@/stores/useFormatStore";
import ButtonGroup from "./ButtonGroup";
import Modal from "./Modal";
import CloseIcon from "./icons/CloseIcon";
import GearIcon from "./icons/GearIcon";

const CURRENCY_DISPLAY_OPTIONS: readonly { value: CurrencyDisplay; label: string }[] = [
  { value: "symbol", label: "Symbol" },
  { value: "code", label: "Code" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-foreground">{title}</h3>
      <div className="space-y-2 text-sm text-muted">{children}</div>
    </div>
  );
}

/** Live preview of the chosen format. Subscribed to the store so it
 *  re-renders on every settings change. */
function Preview() {
  useFormatStore((s) => s.formatVersion);
  const samples: { input: number; label: string }[] = [
    { input: 1234567.89, label: "1234567.89" },
    { input: -1234567.89, label: "-1234567.89" },
    { input: 0.5, label: "0.5" },
    { input: 1000, label: "1000" },
  ];
  const fakeUSD = { toString: () => "1234.56 USD" } as unknown as import("mathjs").Unit;
  const fakeEUR = { toString: () => "1234.56 EUR" } as unknown as import("mathjs").Unit;

  return (
    <div className="rounded-md border border-border bg-surface-alt p-3 font-mono text-sm">
      {samples.map((s) => (
        <div key={s.label} className="flex justify-between">
          <span className="text-muted">{s.label}</span>
          <span className="text-foreground">{formatNumber(s.input)}</span>
        </div>
      ))}
      <div className="mt-2 border-t border-border pt-2">
        <div className="flex justify-between">
          <span className="text-muted">1234.56 USD</span>
          <span className="text-foreground">{formatUnit(fakeUSD)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">1234.56 EUR</span>
          <span className="text-foreground">{formatUnit(fakeEUR)}</span>
        </div>
      </div>
    </div>
  );
}

export default function SettingsModal() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const numberFormatId = useFormatStore((s) => s.numberFormatId);
  const currencyDisplay = useFormatStore((s) => s.currencyDisplay);
  const setNumberFormatId = useFormatStore((s) => s.setNumberFormatId);
  const setCurrencyDisplay = useFormatStore((s) => s.setCurrencyDisplay);
  const reset = useFormatStore((s) => s.reset);

  const formats = useMemo(() => getNumberFormats(), []);
  const autoFormat = useMemo(() => detectDefaultFormat(), []);

  return (
    <>
      <button
        data-testid="settings-button"
        onClick={() => setOpen(true)}
        aria-label="Open formatting settings"
        className="inline-flex cursor-pointer items-center justify-center rounded-md p-2 text-muted transition-colors duration-150 ease-in-out hover:bg-surface-alt hover:text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background active:scale-[0.98]"
      >
        <GearIcon />
      </button>

      <Modal
        open={open}
        onClose={close}
        overlayTestId="settings-overlay"
        cardTestId="settings-modal"
        cardClassName="mx-4 max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-lg"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-sans text-base font-semibold text-foreground">Formatting</h2>
          <button
            data-testid="settings-close"
            onClick={close}
            aria-label="Close formatting settings"
            className="cursor-pointer rounded-md p-2 text-muted transition-colors duration-150 ease-in-out hover:bg-surface-alt hover:text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background active:scale-[0.98]"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="space-y-5">
          <Section title="Number format">
            <p className="text-xs">
              Each option shows the same value (positive and negative) rendered in that style. The
              selection determines decimal and thousand separators for both input parsing and
              output. When using comma-decimal mode, separate function arguments with a space:{" "}
              <code className="font-mono text-foreground">min(1, 5)</code>.
            </p>
            <select
              data-testid="settings-number-format"
              value={numberFormatId ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setNumberFormatId(v === "" ? null : v);
              }}
              className="w-full rounded-md border border-border bg-surface-alt px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">
                Auto — {autoFormat.positiveExample} / {autoFormat.negativeExample}
              </option>
              {formats.map((f) => (
                <option key={f.matchingLocales[0]} value={f.matchingLocales[0]}>
                  {f.positiveExample} / {f.negativeExample}
                </option>
              ))}
            </select>
            <Preview />
          </Section>

          <Section title="Currency display">
            <ButtonGroup<CurrencyDisplay>
              ariaLabel="Currency display"
              testId="settings-currency-display"
              value={currencyDisplay}
              onChange={setCurrencyDisplay}
              options={CURRENCY_DISPLAY_OPTIONS}
            />
            <p className="text-xs">
              Symbol falls back to the ISO code when the currency has no distinct symbol.
            </p>
          </Section>

          <div className="flex justify-end pt-2">
            <button
              data-testid="settings-reset"
              onClick={reset}
              className="cursor-pointer rounded-md border border-border bg-surface-alt px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface hover:text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            >
              Reset to defaults
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
