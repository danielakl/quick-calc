// Exchange-rate fetching and derivation.
// Pure module — no React, no Zustand. Backed by fawazahmed0/exchange-api.
// Persistence is owned by `useCurrencyStore` via Zustand's `persist` middleware.

import { Temporal } from "temporal-polyfill";
import { CURRENCIES, CurrencyCode } from "./currencies";
import { isPlainObject } from "./typeGuards";
import { millisecondsBetween } from "./utils/dateUtils";
import { sanitize } from "./utils/sanitizeString";
import { isEmpty } from "./utils/stringUtils";

export type Status = "fresh" | "stale" | "fetching" | "error";

export const CURRENCY_API_BASE = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api";
export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export interface FetchResult {
  /** Raw `usd.json["usd"]` filtered to known currency codes. */
  usdRates: Map<CurrencyCode, number>;
}

/** HTTP status carried alongside a fetch error so callers can distinguish
 *  permanent (4xx) from transient (5xx, network) failures. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

function isAbortError(error: unknown): boolean {
  return (error as { name?: string })?.name === "AbortError";
}

/** Transient: network failure, timeout, or 5xx. Eligible for backoff retry. */
function isTransientError(error: unknown): boolean {
  if (error instanceof HttpError) {
    return error.status >= 500;
  }
  // Anything that isn't an HttpError is treated as transient (e.g. fetch
  // network failures, JSON parse errors that may resolve on a retry).
  return true;
}

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  // `redirect: "error"` rejects on 3xx — the CDN should serve the JSON directly.
  // Following an unverified redirect from a third-party API would let the host
  // bounce us to an arbitrary URL.
  const response = await fetch(url, { signal, redirect: "error" });
  if (!response.ok) {
    throw new HttpError(response.status, `${response.status} ${response.statusText} for ${url}`);
  }
  return response.json();
}

/** Build a CurrencyCode-typed Map from an unknown JSON value. Skips entries
 *  whose key isn't a supported CurrencyCode and whose value isn't a finite
 *  positive number. Returns `null` if the input isn't a plain object. */
export function toCurrencyMap(value: unknown): Map<CurrencyCode, number> | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const map = new Map<CurrencyCode, number>();
  for (const [key, rate] of Object.entries(value)) {
    const upper =
      sanitize(key, {
        collapseWhitespace: true,
        maxLength: 4,
        removeLineEndings: true,
        stripEmoji: true,
      })?.toUpperCase() ?? "";

    if (!(upper in CurrencyCode)) {
      continue;
    }

    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
      continue;
    }

    map.set(CurrencyCode[upper as keyof typeof CurrencyCode], rate);
  }
  return map;
}

/** Path segment for the API: a date as YYYY-MM-DD or the literal "latest". */
export type FetchTarget = Temporal.PlainDate | "latest";

function targetPathSegment(target: FetchTarget): string {
  return target === "latest" ? "latest" : target.toString();
}

/** Fetch the daily USD rate endpoint for a given date (or "latest").
 *  Validates the response shape rather than trusting the API. */
export async function fetchUsd(date: FetchTarget, signal?: AbortSignal): Promise<FetchResult> {
  const raw = await getJson(
    `${CURRENCY_API_BASE}@${targetPathSegment(date)}/v1/currencies/usd.json`,
    signal,
  );

  if (!isPlainObject(raw)) {
    throw new Error("Currency API response is not a JSON object");
  }

  const usdRates = toCurrencyMap(raw.usd);
  if (usdRates === null) {
    throw new Error("Currency API response missing or malformed `usd` field");
  }

  if (usdRates.size === 0) {
    throw new Error("Currency API response contained no supported currencies");
  }

  return { usdRates };
}

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;
const MAX_ATTEMPTS = 6;

/** Exponential backoff delay for `attempt` (0-indexed), clamped to MAX_DELAY_MS. */
export function backoffDelayMs(attempt: number): number {
  return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt);
}

const sleep = (milliseconds: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      try {
        signal.throwIfAborted();
      } catch (error) {
        reject(error);
      }
      return;
    }
    const timeoutHandle = setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeoutHandle);
        try {
          signal.throwIfAborted();
        } catch (error) {
          reject(error);
        }
      },
      { once: true },
    );
  });

/** Retry `fetchUsd` against a single target with exponential backoff.
 *  Backoff applies only to transient errors (5xx, network). Permanent
 *  errors (4xx) propagate immediately. */
async function fetchUsdWithBackoff(
  target: FetchTarget,
  signal?: AbortSignal,
): Promise<FetchResult> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    signal?.throwIfAborted();
    try {
      return await fetchUsd(target, signal);
    } catch (error) {
      lastError = error;
      if (isAbortError(error)) {
        throw error;
      }
      if (!isTransientError(error)) {
        throw error;
      }
      if (attempt < MAX_ATTEMPTS - 1) {
        await sleep(backoffDelayMs(attempt), signal);
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Currency fetch failed");
}

/** Fetch USD rates with date fallbacks: try `date` first, then the previous
 *  day if the API has no data yet (404), and finally `@latest`. Each target
 *  uses exponential backoff for transient failures. */
export async function fetchWithBackoff(
  date: Temporal.PlainDate,
  signal?: AbortSignal,
): Promise<FetchResult> {
  const targets: FetchTarget[] = [date, date.subtract({ days: 1 }), "latest"];

  let lastError: unknown;
  for (const target of targets) {
    try {
      return await fetchUsdWithBackoff(target, signal);
    } catch (error) {
      lastError = error;
      if (isAbortError(error)) {
        throw error;
      }
      // Permanent error (e.g. 404) on this target — try the next fallback.
      // Transient error after backoff exhaustion — also try the next fallback.
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Currency fetch failed");
}

/** USD-per-1-foreign map, uppercase keys. USD is anchored to 1.
 *  Codes outside the supported whitelist are dropped. */
export function derivePerUnitFromUsd(
  usdRates: Map<CurrencyCode, number>,
): Map<CurrencyCode, number> {
  const perUnit = new Map<CurrencyCode, number>([[CurrencyCode.USD, 1]]);
  for (const [code, rate] of usdRates) {
    if (!Number.isFinite(rate) || rate <= 0) {
      continue;
    }

    perUnit.set(code, 1 / rate);
  }

  return perUnit;
}

/** "How many `base` per 1 `code`." Returns null if either is missing. */
export function displayRate(
  perUnit: Map<CurrencyCode, number>,
  code: CurrencyCode,
  base: CurrencyCode,
): number | null {
  const codeRate = perUnit.get(code);
  const baseRate = perUnit.get(base);
  if (!codeRate || !baseRate) {
    return null;
  }

  return codeRate / baseRate;
}

/** Human-readable "X ago" string for a past instant. Returns "never" when null. */
export function formatRelative(timestamp: Temporal.Instant | null, now: Temporal.Instant): string {
  if (timestamp === null) {
    return "never";
  }

  const differenceMilliseconds = Math.max(0, millisecondsBetween(timestamp, now));

  const seconds = Math.floor(differenceMilliseconds / 1000);
  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function detectLocaleCurrency(): CurrencyCode {
  const languages: readonly string[] =
    typeof navigator === "undefined"
      ? ["en-US"]
      : navigator.languages?.length
        ? navigator.languages
        : [navigator.language ?? "en-US"];

  for (const language of languages) {
    const region = language.split("-")[1];
    if (isEmpty(region)) {
      continue;
    }

    const detectedCurrency = CURRENCIES.find((currency) => currency.regions?.includes(region));

    if (detectedCurrency === undefined) {
      continue;
    }

    return detectedCurrency.code;
  }

  return CurrencyCode.USD;
}
