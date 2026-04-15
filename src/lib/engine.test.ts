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

    it("supports Unicode letter identifiers", () => {
      const results = evaluateLines(["café = 5"]);
      expect(results[0].value).toBe(5);
      expect(results[0].isAssignment).toBe(true);
    });

    it("supports Greek letter assignment and reuse", () => {
      const results = evaluateLines(["π = 3.14", "π * 2"]);
      expect(results[0].value).toBeCloseTo(3.14);
      expect(results[0].isAssignment).toBe(true);
      expect(results[1].value).toBeCloseTo(6.28);
    });

    it("does not block Unicode identifiers as built-in functions", () => {
      const results = evaluateLines(["café = 10"]);
      expect(results[0].error).toBe(null);
      expect(results[0].value).toBe(10);
    });
  });

  describe("function assignments", () => {
    it("defines and calls a single-param function", () => {
      const results = evaluateLines(["f(x) = x^2", "f(3)"]);
      expect(results[0].value).toBe(null);
      expect(results[0].isAssignment).toBe(true);
      expect(results[0].error).toBe(null);
      expect(results[1].value).toBe(9);
    });

    it("displays the function expression", () => {
      const results = evaluateLines(["f(x) = x^2"]);
      expect(results[0].display).toBe("x ^ 2");
    });

    it("defines and calls a multi-param function", () => {
      const results = evaluateLines(["area(w, h) = w * h", "area(3, 4)"]);
      expect(results[1].value).toBe(12);
    });

    it("uses function result in expressions", () => {
      const results = evaluateLines(["f(x) = x^2", "f(3) + 1"]);
      expect(results[1].value).toBe(10);
    });

    it("uses scope variables inside function body", () => {
      const results = evaluateLines([
        "rate = 0.1",
        "tax(x) = x * rate",
        "tax(100)",
      ]);
      expect(results[2].value).toBeCloseTo(10);
    });

    it("does not default function parameters to 1", () => {
      const results = evaluateLines(["f(x) = x + 10", "f(5)"]);
      expect(results[1].value).toBe(15);
    });

    it("blocks assignment to built-in functions", () => {
      const results = evaluateLines(["sin(x) = x"]);
      expect(results[0].error).toBe('Cannot assign to built-in function "sin"');
      expect(results[0].value).toBe(null);
    });

    it("does not break subsequent lines after function definition", () => {
      const results = evaluateLines(["f(x) = x * 2", "10 + 5"]);
      expect(results[1].value).toBe(15);
    });

    it("function definition does not contribute to prev or sum", () => {
      const results = evaluateLines(["10", "f(x) = x^2", "prev"]);
      expect(results[2].value).toBe(10);
    });
  });

  describe("simplified function declarations", () => {
    it("creates function from assignment with free variables", () => {
      const results = evaluateLines(["func = x^2 + 5", "func(3)"]);
      expect(results[0].value).toBe(null);
      expect(results[0].isAssignment).toBe(true);
      expect(results[0].display).toBe("x ^ 2 + 5");
      expect(results[1].value).toBe(14);
    });

    it("creates multi-param function", () => {
      const results = evaluateLines(["f = x + y", "f(3, 4)"]);
      expect(results[1].value).toBe(7);
    });

    it("evaluates normally when all variables are in scope", () => {
      const results = evaluateLines(["x = 5", "y = x + 1"]);
      expect(results[1].value).toBe(6);
      expect(results[1].isAssignment).toBe(true);
    });

    it("captures scope variables in function body", () => {
      const results = evaluateLines([
        "rate = 0.1",
        "tax = x * rate",
        "tax(100)",
      ]);
      expect(results[2].value).toBeCloseTo(10);
    });

    it("can be passed to derivate", () => {
      const results = evaluateLines(["f = x^2", "g = derivate(f)", "g(5)"]);
      expect(results[2].value).toBe(10);
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

  describe("derivative", () => {
    it("returns symbolic derivative of a polynomial", () => {
      const results = evaluateLines(['derivative("x^2", "x")']);
      expect(results[0].value).toBe(null);
      expect(results[0].display).toBe("2 * x");
      expect(results[0].error).toBe(null);
    });

    it("returns symbolic derivative of a trig function", () => {
      const results = evaluateLines(['derivative("sin(x)", "x")']);
      expect(results[0].display).toBe("cos(x)");
    });

    it("returns constant for linear expression", () => {
      const results = evaluateLines(['derivative("3 * x + 5", "x")']);
      expect(results[0].display).toBe("3");
    });

    it("does not break subsequent lines", () => {
      const results = evaluateLines(['derivative("x^2", "x")', "2 + 2"]);
      expect(results[0].display).toBe("2 * x");
      expect(results[1].value).toBe(4);
    });

    it("does not contribute to prev, sum, or average", () => {
      const results = evaluateLines(["10", 'derivative("x^2", "x")', "prev"]);
      expect(results[2].value).toBe(10);
    });

    it("derive is an alias for derivative", () => {
      const results = evaluateLines(['derive("x^2", "x")']);
      expect(results[0].display).toBe("2 * x");
    });

    it("derivate is an alias for derivative", () => {
      const results = evaluateLines(['derivate("x^2", "x")']);
      expect(results[0].display).toBe("2 * x");
    });

    it("derivative accepts a user-defined function", () => {
      const results = evaluateLines(["f(x) = x^2", "derivative(f)"]);
      expect(results[1].display).toBe("2 * x");
    });

    it("derivate returns a callable function", () => {
      const results = evaluateLines(["f = x^3", "g = derivate(f)", "g(2)"]);
      expect(results[1].display).toBe("3 * x ^ 2");
      expect(results[2].value).toBe(12);
    });

    it("end-to-end: define, derive, call both", () => {
      const results = evaluateLines([
        "func = x^2 + x - 1",
        "func2 = derivate(func)",
        "func(10)",
        "func2(10)",
      ]);
      expect(results[0].display).toBe("x ^ 2 + x - 1");
      expect(results[1].display).toBe("2 * x + 1");
      expect(results[2].value).toBe(109);
      expect(results[3].value).toBe(21);
    });

    it("derives traditional function declaration", () => {
      const results = evaluateLines(["f(x) = x^3", "g = derive(f)", "g(2)"]);
      expect(results[2].value).toBe(12);
    });
  });

  describe("integral", () => {
    it("returns symbolic integral of a polynomial", () => {
      const results = evaluateLines(['integral("x^2", "x")']);
      expect(results[0].value).toBe(null);
      expect(results[0].display).toBe("x ^ 3 / 3");
      expect(results[0].error).toBe(null);
    });

    it("returns symbolic integral of a trig function", () => {
      const results = evaluateLines(['integral("sin(x)", "x")']);
      expect(results[0].display).toBe("-cos(x)");
    });

    it("returns symbolic integral of a constant", () => {
      const results = evaluateLines(['integral("5", "x")']);
      expect(results[0].display).toBe("5 * x");
    });

    it("does not break subsequent lines", () => {
      const results = evaluateLines(['integral("x^2", "x")', "2 + 2"]);
      expect(results[0].display).toBe("x ^ 3 / 3");
      expect(results[1].value).toBe(4);
    });

    it("does not contribute to prev, sum, or average", () => {
      const results = evaluateLines(["10", 'integral("x^2", "x")', "prev"]);
      expect(results[2].value).toBe(10);
    });

    it("integrate is an alias for integral", () => {
      const results = evaluateLines(['integrate("x^2", "x")']);
      expect(results[0].display).toBe("x ^ 3 / 3");
    });

    it("antiderivative is an alias for integral", () => {
      const results = evaluateLines(['antiderivative("x^2", "x")']);
      expect(results[0].display).toBe("x ^ 3 / 3");
    });

    it("integral accepts a user-defined function", () => {
      const results = evaluateLines(["f(x) = x^2", "integral(f)"]);
      expect(results[1].display).toBe("x ^ 3 / 3");
    });

    it("integrate returns a callable function", () => {
      const results = evaluateLines(["f = x^3", "g = integrate(f)", "g(2)"]);
      expect(results[1].display).toBe("x ^ 4 / 4");
      expect(results[2].value).toBe(4);
    });

    it("end-to-end: define, integrate, call both", () => {
      const results = evaluateLines([
        "func = x^2 + x",
        "func2 = integrate(func)",
        "func(3)",
        "func2(3)",
      ]);
      expect(results[0].display).toBe("x ^ 2 + x");
      expect(results[2].value).toBe(12);
      // ∫(x^2 + x) = x^3/3 + x^2/2 → at x=3: 9 + 4.5 = 13.5
      expect(results[3].value).toBeCloseTo(13.5);
    });

    it("roundtrip: derivate(integrate(f)) recovers original", () => {
      const results = evaluateLines([
        "f = x^2",
        "g = integrate(f)",
        "h = derivate(g)",
        "h(5)",
      ]);
      // h should be equivalent to f: x^2
      expect(results[3].value).toBe(25);
    });

    it("integrates traditional function declaration", () => {
      const results = evaluateLines(["f(x) = x^3", "g = integrate(f)", "g(2)"]);
      expect(results[2].value).toBe(4);
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
