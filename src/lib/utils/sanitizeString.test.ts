import { describe, it, expect } from "vitest";
import { sanitize } from "./sanitizeString";

describe("sanitize", () => {
  describe("nullish and non-string input", () => {
    it("returns null unchanged", () => {
      expect(sanitize(null)).toBeNull();
    });

    it("returns undefined unchanged", () => {
      expect(sanitize(undefined)).toBeUndefined();
    });

    it("returns empty string for non-string input", () => {
      // @ts-expect-error — exercising the runtime guard at sanitizeString.ts:110-112.
      expect(sanitize(42)).toBe("");
      // @ts-expect-error — same guard, different value.
      expect(sanitize({})).toBe("");
    });
  });

  describe("malformed UTF-16", () => {
    it("strips lone high surrogates", () => {
      // U+D800 unpaired.
      expect(sanitize("a\uD800b")).toBe("ab");
    });

    it("strips lone low surrogates", () => {
      // U+DC00 unpaired.
      expect(sanitize("a\uDC00b")).toBe("ab");
    });

    it("preserves valid surrogate pairs (e.g. emoji code points)", () => {
      // 😀 is U+1F600 → 😀.
      expect(sanitize("hi 😀")).toBe("hi 😀");
    });
  });

  describe("line endings", () => {
    it("normalises CRLF to LF", () => {
      expect(sanitize("a\r\nb")).toBe("a\nb");
    });

    it("normalises bare CR to LF", () => {
      expect(sanitize("a\rb")).toBe("a\nb");
    });

    it("normalises U+2028 (line separator) and U+2029 (paragraph separator) to LF", () => {
      expect(sanitize("a b c")).toBe("a\nb\nc");
    });
  });

  describe("dangerous and invisible characters", () => {
    it("strips bidi controls (Trojan Source)", () => {
      // U+202E right-to-left override.
      expect(sanitize("safe‮evil")).toBe("safeevil");
    });

    it("strips zero-width characters but keeps ZWJ for emoji compounds", () => {
      // U+200B zero-width space gets dropped; U+200D ZWJ is preserved.
      expect(sanitize("a​b‍c")).toBe("a b‍c".replace(" ", ""));
      // Sanity: ZWJ on its own is kept.
      const result = sanitize("x‍y");
      expect(result).toBe("x‍y");
    });

    it("strips C0 control characters but preserves \\t and \\n", () => {
      expect(sanitize("ab\tc\nd")).toBe("ab\tc\nd");
    });

    it("strips C1 control characters", () => {
      expect(sanitize("ab")).toBe("ab");
    });
  });

  describe("emoji stripping", () => {
    it("does not strip emoji by default", () => {
      expect(sanitize("hi 🎉")).toBe("hi 🎉");
    });

    it("strips a basic pictograph", () => {
      expect(sanitize("hi 🎉 there", { stripEmoji: true })).toBe("hi  there");
    });

    it("strips regional-indicator flag pairs", () => {
      // 🇺🇸 = U+1F1FA + U+1F1F8.
      expect(sanitize("flag 🇺🇸 here", { stripEmoji: true })).toBe("flag  here");
    });

    it("strips keycap sequences", () => {
      // 1️⃣ = "1" + U+FE0F + U+20E3.
      expect(sanitize("count 1️⃣ done", { stripEmoji: true })).toBe("count  done");
    });

    it("strips ZWJ-joined family emoji and cleans up orphan glue", () => {
      // 👨‍👩‍👧 = man + ZWJ + woman + ZWJ + girl.
      expect(sanitize("a 👨‍👩‍👧 b", { stripEmoji: true })).toBe("a  b");
    });

    it("strips skin-tone-modified emoji", () => {
      // 👍🏽 = thumbs up + medium skin tone modifier.
      expect(sanitize("ok 👍🏽 yes", { stripEmoji: true })).toBe("ok  yes");
    });
  });

  describe("whitespace folding", () => {
    it("folds NBSP-like spaces to ASCII space", () => {
      // NBSP, en space, em space, ideographic space.
      expect(sanitize("a b c d　e")).toBe("a b c d e");
    });

    it("folds smart double quotes to ASCII", () => {
      expect(sanitize("“hello”")).toBe('"hello"');
    });

    it("folds smart single quotes to ASCII", () => {
      expect(sanitize("it’s ‘great’")).toBe("it's 'great'");
    });
  });

  describe("Unicode normalisation", () => {
    it("normalises to NFC by default (composes e + combining acute)", () => {
      const decomposed = "é"; // 2 code units
      const result = sanitize(decomposed);
      expect(result).toBe("é");
      expect(result).toHaveLength(1);
    });

    it("decomposes when form is NFD", () => {
      const composed = "é"; // 1 code unit
      const result = sanitize(composed, { form: "NFD" });
      expect(result).toBe("é");
      expect(result).toHaveLength(2);
    });
  });

  describe("removeLineEndings", () => {
    it("replaces line breaks with a single space", () => {
      expect(sanitize("a\nb\nc", { removeLineEndings: true })).toBe("a b c");
    });

    it("collapses runs of newlines into one space", () => {
      expect(sanitize("a\n\n\nb", { removeLineEndings: true })).toBe("a b");
    });
  });

  describe("collapseWhitespace", () => {
    it("collapses horizontal whitespace and preserves newlines when removeLineEndings is false", () => {
      expect(sanitize("a   b\n\nc", { collapseWhitespace: true })).toBe("a b\nc");
    });

    it("collapses all whitespace including newlines when removeLineEndings is true", () => {
      expect(sanitize("a   b\n\nc", { collapseWhitespace: true, removeLineEndings: true })).toBe(
        "a b c",
      );
    });
  });

  describe("trimming", () => {
    it("trims leading and trailing whitespace", () => {
      expect(sanitize("   hello   ")).toBe("hello");
    });

    it("trims after NBSP folding", () => {
      expect(sanitize(" hi ")).toBe("hi");
    });
  });

  describe("grapheme-aware truncation", () => {
    it("does not truncate when input is shorter than maxLength", () => {
      expect(sanitize("hello", { maxLength: 10 })).toBe("hello");
    });

    it("truncates ASCII with default ellipsis suffix", () => {
      expect(sanitize("abcdefghij", { maxLength: 5 })).toBe("abcd…");
    });

    it("uses a custom truncationSuffix", () => {
      expect(sanitize("abcdefghij", { maxLength: 5, truncationSuffix: "..." })).toBe("ab...");
    });

    it("counts a multi-codepoint emoji as a single grapheme", () => {
      // 👨‍👩‍👧 = 5 code points but 1 grapheme. With maxLength 3 we keep it + 2 ASCII.
      const family = "👨‍👩‍👧";
      const result = sanitize(`${family}AB`, { maxLength: 3 });
      expect(result).toBe(`${family}AB`);
    });

    it("hard-cuts without suffix when suffix is too large for maxLength", () => {
      // suffix length 3 >= max 2 → branch at sanitizeString.ts:86-88.
      expect(sanitize("abcdef", { maxLength: 2, truncationSuffix: "..." })).toBe("ab");
    });

    it("does not apply truncation when maxLength is 0", () => {
      expect(sanitize("abcdef", { maxLength: 0 })).toBe("abcdef");
    });
  });

  describe("composition", () => {
    it("applies all transforms in the documented order", () => {
      // CRLF → LF, NBSP → space, smart quote → ASCII, NFC compose,
      // collapseWhitespace + removeLineEndings → all one line, trim, truncate.
      const input = "  “hello” \r\nworld  ";
      const result = sanitize(input, {
        collapseWhitespace: true,
        removeLineEndings: true,
      });
      expect(result).toBe('"hello" world');
    });
  });
});
