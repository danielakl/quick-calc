/**
 * Browser-language probing.
 *
 * Centralised so both the formatting catalog (`numberFormats.ts`) and the
 * currency store (`exchangeRates.ts`) read `navigator.languages` the same
 * way.
 */

/** Browser languages, normalised. SSR-safe: returns `["en-US"]` when
 *  `navigator` is undefined. */
export function getBrowserLanguages(): readonly string[] {
  if (typeof navigator === "undefined") {
    return ["en-US"];
  }
  if (navigator.languages?.length) {
    return navigator.languages;
  }
  return [navigator.language ?? "en-US"];
}
