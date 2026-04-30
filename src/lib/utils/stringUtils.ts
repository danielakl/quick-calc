// Small string helpers used in normalisation/sanitisation paths.

import { sanitize } from "./sanitizeString";

/** Whether the value represents an empty string. */
export function isEmpty(value: string | null | undefined): value is "" | null | undefined {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value !== "string") {
    return false;
  }

  const sanitized = sanitize(value, { collapseWhitespace: true, removeLineEndings: true });
  return sanitized === "";
}
