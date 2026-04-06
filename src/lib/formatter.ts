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
