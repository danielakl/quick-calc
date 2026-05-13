import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  detectDefaultFormat,
  getNumberFormatByLocale,
  type NumberFormat,
} from "@/lib/numberFormats";

/** How to render a currency unit. `symbol` falls back to `code` when the
 *  locale has no distinct symbol for the currency (i.e. `Intl`'s symbol is
 *  just the ISO code). */
export type CurrencyDisplay = "symbol" | "code";

export interface FormatSettings {
  /** Representative locale of the chosen {@link NumberFormat}. `null` means
   *  "auto from navigator.languages". */
  numberFormatId: string | null;
  currencyDisplay: CurrencyDisplay;
}

export interface FormatState extends FormatSettings {
  /** Bumps on every settings mutation. Subscribers add to useMemo deps so
   *  evaluate() re-runs when the user changes formatting. */
  formatVersion: number;
  setNumberFormatId: (id: string | null) => void;
  setCurrencyDisplay: (display: CurrencyDisplay) => void;
  reset: () => void;
}

const DEFAULTS: FormatSettings = {
  numberFormatId: null,
  currencyDisplay: "symbol",
};

/** Returns the format the user explicitly chose, or `null` when in auto
 *  mode (or when the persisted id no longer matches a known format). */
export function getExplicitNumberFormat(state?: FormatSettings): NumberFormat | null {
  const s = state ?? useFormatStore.getState();
  if (s.numberFormatId === null) {
    return null;
  }
  return getNumberFormatByLocale(s.numberFormatId);
}

/** Resolve the user's effective number format. Returns the explicitly
 *  chosen format if set, otherwise the format derived from
 *  `navigator.languages`. Use {@link getExplicitNumberFormat} when callers
 *  need to distinguish "user picked this" from "auto-detected". */
export function getEffectiveNumberFormat(state?: FormatSettings): NumberFormat {
  return getExplicitNumberFormat(state) ?? detectDefaultFormat();
}

export const useFormatStore = create<FormatState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      formatVersion: 0,

      setNumberFormatId: (numberFormatId) =>
        set((s) => ({ numberFormatId, formatVersion: s.formatVersion + 1 })),

      setCurrencyDisplay: (currencyDisplay) =>
        set((s) => ({ currencyDisplay, formatVersion: s.formatVersion + 1 })),

      reset: () => set((s) => ({ ...DEFAULTS, formatVersion: s.formatVersion + 1 })),
    }),
    {
      name: "format-settings",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        numberFormatId: state.numberFormatId,
        currencyDisplay: state.currencyDisplay,
      }),
      // Drop fields we no longer recognise (older releases stored
      // `locale` and `decimalSeparator`). Coerce `currencyDisplay` to the
      // current shape — anything that isn't `"code"` becomes `"symbol"`.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Record<string, unknown>;
        let numberFormatId: string | null = null;
        if (typeof p.numberFormatId === "string") {
          numberFormatId = p.numberFormatId;
        }
        const currencyDisplay: CurrencyDisplay = p.currencyDisplay === "code" ? "code" : "symbol";
        return { ...current, numberFormatId, currencyDisplay };
      },
    },
  ),
);

/** Bootstrap the format store. Call once on app mount. Persisted state has
 *  already been hydrated synchronously by `persist` — this is a no-op today,
 *  reserved for future migrations. */
export function initFormatStore(): void {
  useFormatStore.getState();
}
