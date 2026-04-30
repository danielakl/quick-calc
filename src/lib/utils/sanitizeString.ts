export interface SanitizeStringOptions {
  /** Unicode normalization form. Defaults to "NFC". */
  form?: "NFC" | "NFD" | "NFKC" | "NFKD";
  /** Replace every line break with a single space. */
  removeLineEndings?: boolean;
  /** Collapse runs of whitespace into a single space. */
  collapseWhitespace?: boolean;
  /** Remove emoji and full emoji sequences (flags, keycaps, ZWJ joins, skin tones). */
  stripEmoji?: boolean;
  /** Maximum length in grapheme clusters. Strings longer than this are truncated. */
  maxLength?: number;
  /** String appended when truncation occurs. Counts toward maxLength. Defaults to "…". */
  truncationSuffix?: string;
}

// Lone (unpaired) UTF-16 surrogates — malformed input.
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

// Bidi overrides/isolates — Trojan Source attacks (CVE-2021-42574).
const BIDI_CONTROLS = /[\u202A-\u202E\u2066-\u2069]/g;

// Zero-width / invisible formatting. ZWJ (U+200D) is kept on purpose
// because it's required for compound emoji sequences.
const INVISIBLE = /[\u200B\u200C\u2060\uFEFF]/g;

// C0/C1 control chars except \t and \n.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

// Emoji and emoji sequences:
//  - Regional indicator pairs (flags)
//  - Keycap sequences (#️⃣, *️⃣, 0️⃣–9️⃣)
//  - Pictographs with optional VS16, ZWJ joins, and skin-tone modifiers
const EMOJI =
  /\p{Regional_Indicator}\p{Regional_Indicator}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}|\p{Emoji_Modifier})*/gu;

// Stray emoji glue chars left over after stripping (VS16, ZWJ).
const EMOJI_LEFTOVERS = /[\uFE0F\u200D]/g;

// Non-breaking and exotic space separators
// (NBSP, ogham, en/em/figure/etc., NNBSP, MMSP, ideographic).
const NBSP_LIKE = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;

// Curly / typographic quotes → ASCII.
const SMART_DOUBLE = /[\u201C-\u201F\u2033\u2036]/g; //  “ ” „ ‟ ″ ‶
const SMART_SINGLE = /[\u2018-\u201B\u2032\u2035]/g; //  ‘ ’ ‚ ‛ ′ ‵

// Whitespace-collapse patterns.
const ALL_WHITESPACE = /\s+/g;
const HORIZONTAL_WHITESPACE = /[^\S\n]+/g;
const MULTIPLE_NEW_LINE = /\n+/g;

// Lazily-initialized grapheme segmenter — constructing one is non-trivial
// and they're safe to reuse.
let graphemeSegmenter: Intl.Segmenter | undefined;
function getGraphemeSegmenter(): Intl.Segmenter {
  graphemeSegmenter ??= new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return graphemeSegmenter;
}

function graphemeLength(str: string): number {
  let n = 0;
  for (const _ of getGraphemeSegmenter().segment(str)) {
    n++;
  }
  return n;
}

function truncateGraphemes(str: string, max: number, suffix: string): string {
  const seg = getGraphemeSegmenter();
  const graphemes: string[] = [];
  for (const { segment } of seg.segment(str)) {
    graphemes.push(segment);

    // Early exit: once we've collected one more than max, we know we'll truncate.
    if (graphemes.length > max) {
      break;
    }
  }

  if (graphemes.length <= max) {
    return str;
  }

  const suffixLen = graphemeLength(suffix);
  // Suffix doesn't fit — return a hard cut without it.
  if (suffixLen >= max) {
    return graphemes.slice(0, max).join("");
  }

  // Re-walk to collect exactly (max - suffixLen) graphemes.
  const head: string[] = [];
  for (const { segment } of seg.segment(str)) {
    if (head.length === max - suffixLen) {
      break;
    }

    head.push(segment);
  }
  return head.join("") + suffix;
}

export function sanitize(
  input: string | null | undefined,
  options: SanitizeStringOptions = {},
): string | null | undefined {
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input !== "string") {
    return "";
  }

  // Set default options.
  options.collapseWhitespace ??= false;
  options.form ??= "NFC";
  options.maxLength ??= 1_000_000;
  options.removeLineEndings ??= false;
  options.stripEmoji ??= false;
  options.truncationSuffix ??= "…";

  let str = input;

  // Strip malformed UTF-16 first — normalize() can misbehave otherwise.
  str = str.replaceAll(LONE_SURROGATE, "");

  // Normalize line endings to \n. CRLF first so we don't double-replace.
  str = str.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  str = str.replaceAll("\u2028", "\n").replaceAll("\u2029", "\n");

  // Strip dangerous / invisible / control characters.
  str = str.replaceAll(BIDI_CONTROLS, "").replaceAll(INVISIBLE, "").replaceAll(CONTROL_CHARS, "");

  // Optional: strip emoji (and clean up any orphan VS16/ZWJ glue chars).
  if (options.stripEmoji) {
    str = str.replaceAll(EMOJI, "").replaceAll(EMOJI_LEFTOVERS, "");
  }

  // Fold non-breaking / exotic spaces to a regular space.
  str = str.replaceAll(NBSP_LIKE, " ");

  // Fold curly quotes to ASCII.
  str = str.replaceAll(SMART_DOUBLE, '"').replace(SMART_SINGLE, "'");

  // Unicode normalization (default NFC).
  str = str.normalize(options.form);

  // Optional: drop all line endings.
  if (options.removeLineEndings) {
    str = str.replaceAll(MULTIPLE_NEW_LINE, " ");
  }

  // Optional: collapse whitespace (preserves \n if not removed above).
  if (options.collapseWhitespace) {
    str = options.removeLineEndings
      ? str.replaceAll(ALL_WHITESPACE, " ")
      : str.replaceAll(HORIZONTAL_WHITESPACE, " ").replaceAll(MULTIPLE_NEW_LINE, "\n");
  }

  // Trim ends.
  str = str.trim();

  // Optional: grapheme-aware truncation. Done last so the suffix isn't
  // mangled by earlier transforms and so we measure the final output.
  if (options.maxLength > 0) {
    str = truncateGraphemes(str, options.maxLength, options.truncationSuffix);
  }

  return str;
}
