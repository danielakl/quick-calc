import type { Unit } from "mathjs";

const UNIT_MAGNITUDE_RE = /^(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)(.*)$/i;

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    if (value === Infinity) return "Infinity";
    if (value === -Infinity) return "-Infinity";
    return "NaN";
  }

  if (Number.isInteger(value) && Math.abs(value) < 1e15) {
    return value.toLocaleString("en-US");
  }

  if (Math.abs(value) >= 1e15 || (Math.abs(value) < 1e-6 && value !== 0)) {
    return value.toExponential(6);
  }

  const formatted = parseFloat(value.toPrecision(10));
  return formatted.toLocaleString("en-US", { maximumFractionDigits: 10 });
}

/** Extract the displayed magnitude from a mathjs Unit, respecting the unit
 *  in which it is currently expressed (not SI base units). */
export function extractUnitMagnitude(unit: Unit): number {
  const match = unit.toString().match(UNIT_MAGNITUDE_RE);
  return match ? Number(match[1]) : Number.NaN;
}

/** Format a mathjs Unit using {@link formatNumber} for the magnitude so
 *  thousands separators and precision match plain-number formatting. */
export function formatUnit(unit: Unit): string {
  const match = unit.toString().match(UNIT_MAGNITUDE_RE);
  if (!match) return unit.toString();
  return formatNumber(Number(match[1])) + match[2];
}
