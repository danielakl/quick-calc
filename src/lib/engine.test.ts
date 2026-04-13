import { describe, it, expect } from "vitest";
import { evaluateLines, LineResult } from "./engine";

function values(results: LineResult[]) {
  return results.map((r) => r.value);
}

describe("evaluateLines", () => {
  describe("basic arithmetic", () => {
    it("evaluates simple expressions", () => {
      const results = evaluateLines(["2 + 3", "10 - 4", "6 * 7", "20 / 5"]);
      expect(values(results)).toEqual([5, 6, 42, 4]);
    });

    it("handles operator precedence", () => {
      const results = evaluateLines(["2 + 3 * 4"]);
      expect(results[0].value).toBe(14);
    });

    it("handles parentheses", () => {
      const results = evaluateLines(["(2 + 3) * 4"]);
      expect(results[0].value).toBe(20);
    });

    it("handles negative numbers", () => {
      const results = evaluateLines(["-5 + 3"]);
      expect(results[0].value).toBe(-2);
    });

    it("handles decimals", () => {
      const results = evaluateLines(["1.5 + 2.5"]);
      expect(results[0].value).toBe(4);
    });
  });

  describe("empty and comment lines", () => {
    it("returns null for empty lines", () => {
      const results = evaluateLines(["", "  ", "1 + 1"]);
      expect(values(results)).toEqual([null, null, 2]);
    });

    it("treats // comments as empty", () => {
      const results = evaluateLines(["// this is a comment", "5"]);
      expect(values(results)).toEqual([null, 5]);
    });

    it("treats # comments as empty", () => {
      const results = evaluateLines(["# comment", "10"]);
      expect(values(results)).toEqual([null, 10]);
    });

    it("handles indented comments", () => {
      const results = evaluateLines(["  // indented", "  # also indented"]);
      expect(values(results)).toEqual([null, null]);
    });
  });

  describe("variables and assignments", () => {
    it("assigns and uses variables", () => {
      const results = evaluateLines(["x = 10", "x * 2"]);
      expect(values(results)).toEqual([10, 20]);
    });

    it("flags assignments with isAssignment", () => {
      const results = evaluateLines(["x = 5", "x + 1"]);
      expect(results[0].isAssignment).toBe(true);
      expect(results[1].isAssignment).toBe(false);
    });

    it("supports multiple variables", () => {
      const results = evaluateLines(["a = 3", "b = 4", "a + b"]);
      expect(values(results)).toEqual([3, 4, 7]);
    });

    it("supports reassignment", () => {
      const results = evaluateLines(["x = 1", "x = x + 9", "x"]);
      expect(values(results)).toEqual([1, 10, 10]);
    });
  });

  describe("builtins: prev, sum, average", () => {
    it("prev references the last numeric result", () => {
      const results = evaluateLines(["42", "prev + 8"]);
      expect(values(results)).toEqual([42, 50]);
    });

    it("prev updates after each line", () => {
      const results = evaluateLines(["10", "20", "prev"]);
      expect(results[2].value).toBe(20);
    });

    it("sum accumulates all numeric results", () => {
      const results = evaluateLines(["10", "20", "30", "sum"]);
      expect(results[3].value).toBe(60);
    });

    it("average computes running average", () => {
      const results = evaluateLines(["10", "20", "30", "average"]);
      expect(results[3].value).toBe(20);
    });

    it("prev is not set before any numeric result", () => {
      // A comment followed by prev — prev should not be available
      const results = evaluateLines(["// nothing yet", "prev"]);
      // prev is undefined, mathjs will throw, result is silently skipped
      expect(results[1].value).toBe(null);
    });
  });

  describe("undefined variables default to 1", () => {
    it("bare name evaluates to 1", () => {
      const results = evaluateLines(["Alice"]);
      expect(results[0].value).toBe(1);
    });

    it("multiple names each evaluate to 1", () => {
      const results = evaluateLines(["Alice", "Bob", "Charlie"]);
      expect(values(results)).toEqual([1, 1, 1]);
    });

    it("names followed by sum give guest count", () => {
      const results = evaluateLines(["Alice", "Bob", "Charlie", "sum"]);
      expect(results[3].value).toBe(3);
    });

    it("undefined variables in expressions default to 1", () => {
      const results = evaluateLines(["guests + 5"]);
      expect(results[0].value).toBe(6);
    });

    it("does not override explicitly assigned variables", () => {
      const results = evaluateLines(["x = 10", "x"]);
      expect(values(results)).toEqual([10, 10]);
    });

    it("does not override built-in constants", () => {
      const results = evaluateLines(["pi"]);
      expect(results[0].value).toBeCloseTo(Math.PI);
    });

    it("does not override built-in functions", () => {
      const results = evaluateLines(["sqrt(144)"]);
      expect(results[0].value).toBe(12);
    });

    it("does not default prev when not set", () => {
      const results = evaluateLines(["// nothing", "prev"]);
      expect(results[1].value).toBe(null);
    });

    it("does not default sum or average when not set", () => {
      // With no prior numeric results, sum/average should not exist
      const results = evaluateLines(["// nothing", "average"]);
      expect(results[1].value).toBe(null);
    });

    it("is not flagged as assignment", () => {
      const results = evaluateLines(["Alice"]);
      expect(results[0].isAssignment).toBe(false);
    });
  });

  describe("function assignment protection", () => {
    it("shows error when assigning to a built-in function", () => {
      const results = evaluateLines(["sqrt = 5"]);
      expect(results[0].error).toBe(
        'Cannot assign to built-in function "sqrt"',
      );
      expect(results[0].value).toBe(null);
    });

    it("blocks assignment to any math function", () => {
      const results = evaluateLines(["sin = 1", "cos = 2", "log = 3"]);
      expect(results[0].error).toContain("Cannot assign to built-in function");
      expect(results[1].error).toContain("Cannot assign to built-in function");
      expect(results[2].error).toContain("Cannot assign to built-in function");
    });

    it("does not break subsequent lines", () => {
      const results = evaluateLines(["sqrt = 5", "2 + 2"]);
      expect(results[0].error).toContain("Cannot assign");
      expect(results[1].value).toBe(4);
    });

    it("allows assignment to regular variables", () => {
      const results = evaluateLines(["x = 5"]);
      expect(results[0].value).toBe(5);
      expect(results[0].error).toBe(null);
    });
  });

  describe("error handling", () => {
    it("silently handles invalid expressions", () => {
      const results = evaluateLines(["1 +"]);
      expect(results[0].value).toBe(null);
      expect(results[0].error).toBe(null);
      expect(results[0].display).toBe("");
    });

    it("does not break subsequent lines after an error", () => {
      const results = evaluateLines(["(1 +", "2 + 2"]);
      expect(values(results)).toEqual([null, 4]);
    });
  });

  describe("math functions", () => {
    it("supports sqrt", () => {
      const results = evaluateLines(["sqrt(144)"]);
      expect(results[0].value).toBe(12);
    });

    it("supports power", () => {
      const results = evaluateLines(["2^10"]);
      expect(results[0].value).toBe(1024);
    });

    it("supports pi", () => {
      const results = evaluateLines(["pi"]);
      expect(results[0].value).toBeCloseTo(Math.PI);
    });

    it("shows error for bare function name", () => {
      const results = evaluateLines(["log"]);
      expect(results[0].value).toBe(null);
      expect(results[0].error).toBe("log requires 1 argument");
      expect(results[0].display).toBe("");
    });

    it("shows error with correct arg count for multi-arg functions", () => {
      const results = evaluateLines(["pow"]);
      expect(results[0].value).toBe(null);
      expect(results[0].error).toBe("pow requires 2 arguments");
    });

    it("does not break subsequent lines after bare function name", () => {
      const results = evaluateLines(["sin", "2 + 2"]);
      expect(results[0].error).toBe("sin requires 1 argument");
      expect(results[1].value).toBe(4);
    });
  });

  describe("display formatting", () => {
    it("formats integers with thousand separators", () => {
      const results = evaluateLines(["1000000"]);
      expect(results[0].display).toBe("1,000,000");
    });

    it("formats decimal results", () => {
      const results = evaluateLines(["1 / 3"]);
      expect(results[0].display).toContain("0.333");
    });
  });
});
