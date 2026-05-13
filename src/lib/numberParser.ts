/**
 * Locale-aware number parsing for the calculator engine.
 *
 * Users in non-US locales type numbers as `1.234,56`, `1 234,56`, or `1'234.56`.
 * mathjs only understands US format (`.` decimal, `,` reserved for function-arg
 * separation). This module rewrites locale-formatted numeric literals to
 * canonical US form before `math.parse()` while keeping function-arg commas
 * intact.
 *
 * Active separators are picked with this priority chain:
 *   1. Per-evaluation heuristic — the first line containing an unambiguous
 *      comma-decimal token flips the entire evaluation to comma-decimal.
 *      (Heuristic prioritises decimal detection; thousand separators are
 *      taken from the user's chosen format.)
 *   2. The user's chosen {@link NumberFormat} from settings (or the format
 *      derived from `navigator.languages`).
 *   3. Hardcoded en-US (`.` decimal, `,` group).
 */

import type { NumberFormat } from "./numberFormats";

export type DecimalSeparator = "." | ",";
export type GroupSeparator = "." | "," | " " | "'" | "";

export interface ActiveSeparators {
  decimal: DecimalSeparator;
  group: GroupSeparator;
  source: "heuristic" | "format" | "fallback";
}

/** Scout regex for heuristic detection — matches any number-like token that
 *  contains at least one separator. Pure integers are uninteresting because
 *  they can't disambiguate `,` vs `.`. */
const SCOUT_RE = /(?<![\p{L}_0-9])\d+(?:[.,]\d+)+(?:e[+-]?\d+)?/gu;

/** Returns true when the token unambiguously uses `,` as the decimal:
 *   - both `.` and `,` present and `,` is rightmost (e.g. `1.234,56`), or
 *   - single `,` followed by digits whose count ≠ 3 (e.g. `1,5`, `1,12345`).
 *  `1,234` (single `,` + 3 digits) stays ambiguous. */
function isUnambiguousCommaDecimal(token: string): boolean {
  // Strip exponent — never contains separators of interest.
  const body = token.replace(/e[+-]?\d+$/i, "");
  const lastComma = body.lastIndexOf(",");
  if (lastComma < 0) {
    return false;
  }
  const lastDot = body.lastIndexOf(".");
  if (lastDot >= 0) {
    return lastComma > lastDot;
  }
  const trailing = body.length - lastComma - 1;
  return trailing !== 3;
}

/**
 * Scan lines top-to-bottom and return comma-decimal separators on the first
 * line that contains an unambiguous comma-decimal token. Once a line has
 * voted, stop — every subsequent line is parsed as comma-decimal too.
 * Returns `null` if no line votes, in which case the caller falls back to
 * the locale chain.
 */
export function detectFromLines(lines: readonly string[]): ActiveSeparators | null {
  for (const line of lines) {
    for (const match of line.matchAll(SCOUT_RE)) {
      if (isUnambiguousCommaDecimal(match[0])) {
        return { decimal: ",", group: ".", source: "heuristic" };
      }
    }
  }
  return null;
}

function asDecimalSeparator(s: string): DecimalSeparator | null {
  return s === "." || s === "," ? s : null;
}

function asGroupSeparator(s: string): GroupSeparator | null {
  if (s === "" || s === "." || s === "," || s === " " || s === "'") {
    return s;
  }
  return null;
}

/** Convert a {@link NumberFormat} to {@link ActiveSeparators}. Falls back
 *  to en-US separators when the format uses non-Latin characters (e.g.
 *  Persian `٫` decimal) that the parser/sentinel logic can't handle. */
function formatToSeparators(format: NumberFormat): ActiveSeparators {
  const decimal = asDecimalSeparator(format.decimal);
  const group = asGroupSeparator(format.group);
  if (decimal !== null && group !== null) {
    return { decimal, group, source: "format" };
  }
  return { decimal: ".", group: ",", source: "fallback" };
}

/**
 * Resolve the active separators for an evaluation. Priority:
 *   1. `explicitFormat` — user picked a format in settings; always wins.
 *   2. Heuristic — first line with an unambiguous comma-decimal token
 *      flips to comma-decimal mode.
 *   3. `defaultFormat` — derived from `navigator.languages`.
 *   4. Hardcoded en-US fallback.
 *
 * Pure — does not touch the store.
 */
export function pickSeparators(
  lines: readonly string[],
  opts: { explicitFormat: NumberFormat | null; defaultFormat: NumberFormat },
): ActiveSeparators {
  if (opts.explicitFormat) {
    return formatToSeparators(opts.explicitFormat);
  }
  const heuristic = detectFromLines(lines);
  if (heuristic) {
    return heuristic;
  }
  return formatToSeparators(opts.defaultFormat);
}

/** Escape a single character for use inside a regex character class. */
function escapeForCharClass(ch: string): string {
  if (ch === "") {
    return "";
  }
  return ch.replace(/[\\^\]\-]/g, "\\$&");
}

/**
 * Rewrite numeric literals in a single line to canonical form (`.` decimal,
 * no group separators). The regex demands `\d{3}` triplets after every group
 * separator so function-arg commas like `min(1, 2)` survive untouched.
 *
 * In comma-decimal mode, `min(1,5)` (no space) collapses to `min(1.5)` —
 * a single argument. Users who want two args must write `min(1, 5)`.
 */
export function normalizeLine(line: string, sep: ActiveSeparators): string {
  const decimalEsc = escapeForCharClass(sep.decimal);
  const groupEsc = escapeForCharClass(sep.group);

  // Build the tokenizer regex from active separators.
  const groupPart = groupEsc === "" ? "" : `(?:[${groupEsc}]\\d{3})*`;
  const decimalPart = `(?:[${decimalEsc}]\\d+)?`;
  const pattern = `(?<![\\p{L}_0-9])\\d+${groupPart}${decimalPart}(?:e[+-]?\\d+)?`;
  const re = new RegExp(pattern, "gu");

  return line.replace(re, (match) => {
    let result = match;
    if (sep.group !== "") {
      // Strip every occurrence of the group separator.
      result = result.split(sep.group).join("");
    }
    if (sep.decimal !== ".") {
      // Replace the decimal separator (always exactly one in a token).
      result = result.replace(sep.decimal, ".");
    }
    return result;
  });
}
