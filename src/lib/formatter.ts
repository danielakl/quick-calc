import { type ActiveSeparators } from "@/lib/numberParser";
import { sanitize } from "@/lib/utils/sanitizeString";
import { getEffectiveNumberFormat, useFormatStore } from "@/stores/useFormatStore";
import { CURRENCIES, CurrencyCode, parseCurrencyCode } from "./currencies";
import { isEmpty } from "./utils/stringUtils";
import type { Unit } from "mathjs";

const UNIT_MAGNITUDE_RE = /^(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)(.*)$/i;

/** Locale used to position the currency symbol. Walks the currency's
 *  `regions` list (single source of truth in `currencies.ts`), expanding
 *  the first region into a real locale via `Intl.Locale("und-XX").maximize()`
 *  (which adds CLDR's likely-subtags default language). `und-US` alone
 *  produces broken output in some Intl runtimes; the maximised form like
 *  `en-Latn-US` is universally correct. Falls back to en-US. */
function getCurrencyLocale(code: CurrencyCode): string {
  const currency = CURRENCIES.find((c) => c.code === code);
  const region = currency?.regions?.[0];
  if (region) {
    try {
      return new Intl.Locale(`und-${region}`).maximize().toString();
    } catch {
      // fall through
    }
  }
  return "en-US";
}

// ─── Active separators threading ─────────────────────────────────────────────
// `evaluate()` resolves separators once per call. While it iterates lines, the
// formatter must use those exact separators for output (so `1,5` → `4,5`, not
// `4.5`). We expose a setter that engine.ts wraps the per-line work in. When
// no override is set (e.g. UI previews), separators are derived from the
// store's current state.

let currentSeparators: ActiveSeparators | null = null;

/** Set the active separators for subsequent format calls. Call with `null`
 *  to clear. Engine.ts wraps `evaluate()` in matching set/clear calls. */
export function setActiveSeparators(sep: ActiveSeparators | null): void {
  currentSeparators = sep;
}

function getActiveSeparators(): ActiveSeparators {
  if (currentSeparators) {
    return currentSeparators;
  }
  // No active override (e.g. UI preview rendering outside an evaluate()
  // call). Use the user's effective format's separators directly.
  const format = getEffectiveNumberFormat();
  if (
    (format.decimal === "." || format.decimal === ",") &&
    (format.group === "" ||
      format.group === "." ||
      format.group === "," ||
      format.group === " " ||
      format.group === "'")
  ) {
    return { decimal: format.decimal, group: format.group, source: "format" };
  }
  return { decimal: ".", group: ",", source: "fallback" };
}

// ─── Separator post-processing ───────────────────────────────────────────────

interface SourceSeparators {
  decimal: string;
  group: string;
}

/** Recover the decimal and group separator characters from a sanitised
 *  formatted number. Different Intl styles emit different separators for
 *  the same locale — e.g. fr-FR uses NNBSP for grouping in currency style
 *  but regular space in decimal style. Inferring them from the actual
 *  output keeps us in lock-step with whatever Intl produced. */
function inferSeparators(sample: string): SourceSeparators | null {
  const digitRuns = [...sample.matchAll(/\d+/g)];
  if (digitRuns.length < 2) {
    return null;
  }
  const gaps: string[] = [];
  for (let i = 1; i < digitRuns.length; i++) {
    const prev = digitRuns[i - 1];
    const curr = digitRuns[i];
    gaps.push(sample.slice(prev.index! + prev[0].length, curr.index!));
  }
  return {
    decimal: gaps[gaps.length - 1],
    group: gaps.length > 1 ? gaps[0] : "",
  };
}

// U+0001 — non-printable, never appears in formatted output. Used as a
// placeholder during the two-step separator swap so original group chars
// don't collide with new decimal chars (or vice versa).
const SENTINEL = "";

/** Sanitise a locale-formatted number, then swap its source separators for
 *  the active separators. Source separators are inferred from a known
 *  fractional probe sample (`12345.67`) formatted with the same Intl
 *  options — using the actual `rawFormatted` would misclassify integer-only
 *  output (e.g. `"1,050 in"` has one separator that's a group, not a
 *  decimal). `sanitize()` folds NBSP/NNBSP to ASCII space and smart quotes
 *  to ASCII apostrophe so the swap operates on canonical characters.
 *
 *  When `active.source === "fallback"` (e.g. the user picked a non-Latin
 *  format whose separators don't fit `ActiveSeparators`), the swap is
 *  skipped — the locale's natural output (Persian/Burmese/etc.) flows
 *  through untouched. */
function applySeparators(
  rawFormatted: string,
  locale: Intl.LocalesArgument,
  options: Intl.NumberFormatOptions | undefined,
  active: ActiveSeparators,
): string {
  const formatted = sanitize(rawFormatted) ?? rawFormatted;
  if (active.source === "fallback") {
    return formatted;
  }
  const probe = sanitize(new Intl.NumberFormat(locale, options).format(12345.67)) ?? "";
  const src = inferSeparators(probe);
  if (!src) {
    return formatted;
  }
  if (src.decimal === active.decimal && src.group === active.group) {
    return formatted;
  }
  let result = formatted;
  if (!isEmpty(src.group)) {
    result = result.split(src.group).join(SENTINEL);
  }
  if (!isEmpty(src.decimal)) {
    result = result.split(src.decimal).join(active.decimal);
  }
  if (!isEmpty(src.group)) {
    result = result.split(SENTINEL).join(active.group);
  }
  return result;
}

// ─── Plain numbers ───────────────────────────────────────────────────────────

/** Locale used to render plain numbers — the first locale of the user's
 *  effective {@link NumberFormat}. */
function getNumberLocale(): string {
  return getEffectiveNumberFormat().matchingLocales[0];
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    if (value === Infinity) {
      return "infinity";
    }
    if (value === -Infinity) {
      return "-infinity";
    }
    return "NaN";
  }

  if (Math.abs(value) >= 1e15 || (Math.abs(value) < 1e-6 && value !== 0)) {
    return value.toExponential(6);
  }

  const sep = getActiveSeparators();
  const locale = getNumberLocale();

  // Integers: format directly so 999,999,999,999,999 stays exact
  // (toPrecision would round it to 1e15 and silently corrupt the display).
  const value2 = Number.isInteger(value) ? value : parseFloat(value.toPrecision(10));

  const formatted = new Intl.NumberFormat(locale).format(value2);
  return applySeparators(formatted, locale, undefined, sep);
}

// ─── Units & currency ────────────────────────────────────────────────────────

/** Extract the displayed magnitude from a mathjs Unit, respecting the unit
 *  in which it is currently expressed (not SI base units). */
export function extractUnitMagnitude(unit: Unit): number {
  const match = unit.toString().match(UNIT_MAGNITUDE_RE);
  return match ? Number(match[1]) : Number.NaN;
}

/** Format a mathjs Unit. Currencies use `style: "currency"` keyed to the
 *  currency's home locale (so USD → `$1,234.56`). Other units use mathjs's
 *  own `toString()` for the suffix and {@link formatNumber} for the
 *  magnitude — which keeps the user's active separators on the number and
 *  preserves the readable mathjs unit names (e.g. `1,050 inch` rather than
 *  Intl's abbreviated `1,050 in`). */
export function formatUnit(unit: Unit): string {
  const match = unit.toString().match(UNIT_MAGNITUDE_RE);
  if (!match) {
    return unit.toString();
  }
  const magnitude = Number(match[1]);
  const suffix = match[2]?.trim();
  const currencyCode = parseCurrencyCode(suffix);

  if (currencyCode !== undefined) {
    const currencyResult = formatCurrency(magnitude, currencyCode);
    if (!isEmpty(currencyResult)) {
      return currencyResult;
    }
  }

  return formatNumber(magnitude) + suffix;
}

function formatCurrency(magnitude: number, code: CurrencyCode): string | null {
  const sep = getActiveSeparators();
  const locale = getCurrencyLocale(code);
  const display = useFormatStore.getState().currencyDisplay;

  // Try the requested display first. When `symbol`, fall back to `code` if
  // Intl emits the bare ISO code as the "currency" part — that means the
  // locale has no distinct symbol for this currency.
  const attempts = display === "symbol" ? (["symbol", "code"] as const) : (["code"] as const);
  for (const attempt of attempts) {
    try {
      const options: Intl.NumberFormatOptions = {
        style: "currency",
        currency: code,
        currencyDisplay: attempt,
      };
      const fmt = new Intl.NumberFormat(locale, options);
      if (attempt === "symbol") {
        const parts = fmt.formatToParts(magnitude);
        const currencyPart = parts.find((p) => p.type === "currency")?.value;
        if (currencyPart === code) {
          continue; // No distinct symbol; try the code branch.
        }
      }
      return applySeparators(fmt.format(magnitude), locale, options, sep);
    } catch {
      // Try next.
    }
  }
  return null;
}
