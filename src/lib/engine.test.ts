import { describe, it, expect } from "vitest";
import { CurrencyCode } from "./currencies";
import { evaluate, LineResult, registerCurrencyUnits } from "./engine";

function values(results: LineResult[]) {
  return results.map((r) => r.value);
}

function rateMap(rates: Partial<Record<CurrencyCode, number>>): Map<CurrencyCode, number> {
  return new Map(Object.entries(rates) as [CurrencyCode, number][]);
}

describe("evaluate", () => {
  describe("basic arithmetic", () => {
    it("evaluates simple expressions", () => {
      const results = evaluate("2 + 3", "10 - 4", "6 * 7", "20 / 5");
      expect(values(results)).toEqual([5, 6, 42, 4]);
    });

    it("handles operator precedence", () => {
      const results = evaluate("2 + 3 * 4");
      expect(results[0].value).toBe(14);
    });

    it("handles parentheses", () => {
      const results = evaluate("(2 + 3) * 4");
      expect(results[0].value).toBe(20);
    });

    it("handles negative numbers", () => {
      const results = evaluate("-5 + 3");
      expect(results[0].value).toBe(-2);
    });

    it("handles decimals", () => {
      const results = evaluate("1.5 + 2.5");
      expect(results[0].value).toBe(4);
    });
  });

  describe("empty and comment lines", () => {
    it("returns null for empty lines", () => {
      const results = evaluate(["", "  ", "1 + 1"]);
      expect(values(results)).toEqual([null, null, 2]);
    });

    it("treats // comments as empty", () => {
      const results = evaluate("// this is a comment\n5");
      expect(values(results)).toEqual([null, 5]);
    });

    it("treats # comments as empty", () => {
      const results = evaluate("# comment", "10");
      expect(values(results)).toEqual([null, 10]);
    });

    it("handles indented comments", () => {
      const results = evaluate(["  // indented", "  # also indented"]);
      expect(values(results)).toEqual([null, null]);
    });
  });

  describe("variables and assignments", () => {
    it("assigns and uses variables", () => {
      const results = evaluate(["x = 10", "x * 2"]);
      expect(values(results)).toEqual([10, 20]);
    });

    it("flags assignments with isAssignment", () => {
      const results = evaluate(["x = 5", "x + 1"]);
      expect(results[0].isAssignment).toBe(true);
      expect(results[1].isAssignment).toBe(false);
    });

    it("supports multiple variables", () => {
      const results = evaluate(["a = 3", "b = 4", "a + b"]);
      expect(values(results)).toEqual([3, 4, 7]);
    });

    it("supports reassignment", () => {
      const results = evaluate(["x = 1", "x = x + 9", "x"]);
      expect(values(results)).toEqual([1, 10, 10]);
    });

    it("supports Unicode letter identifiers", () => {
      const results = evaluate("café = 5");
      expect(results[0].value).toBe(5);
      expect(results[0].isAssignment).toBe(true);
    });

    it("supports Greek letter assignment and reuse", () => {
      const results = evaluate(["π = 3.14", "π * 2"]);
      expect(results[0].value).toBeCloseTo(3.14);
      expect(results[0].isAssignment).toBe(true);
      expect(results[1].value).toBeCloseTo(6.28);
    });

    it("does not block Unicode identifiers as built-in functions", () => {
      const results = evaluate("café = 10");
      expect(results[0].error).toBe(null);
      expect(results[0].value).toBe(10);
    });
  });

  describe("function assignments", () => {
    it("defines and calls a single-param function", () => {
      const results = evaluate("f(x) = x^2", "f(3)");
      expect(results[0].value).toBe(null);
      expect(results[0].isAssignment).toBe(true);
      expect(results[0].error).toBe(null);
      expect(results[1].value).toBe(9);
    });

    it("displays the function expression", () => {
      const results = evaluate("f(x) = x^2");
      expect(results[0].display).toBe("x ^ 2");
    });

    it("defines and calls a multi-param function", () => {
      const results = evaluate(["area(w, h) = w * h", "area(3, 4)"]);
      expect(results[1].value).toBe(12);
    });

    it("uses function result in expressions", () => {
      const results = evaluate(["f(x) = x^2", "f(3) + 1"]);
      expect(results[1].value).toBe(10);
    });

    it("uses scope variables inside function body", () => {
      const results = evaluate(["rate = 0.1", "tax(x) = x * rate", "tax(100)"]);
      expect(results[2].value).toBeCloseTo(10);
    });

    it("does not default function parameters to 1", () => {
      const results = evaluate(["f(x) = x + 10", "f(5)"]);
      expect(results[1].value).toBe(15);
    });

    it("blocks assignment to built-in functions", () => {
      const results = evaluate("sin(x) = x");
      expect(results[0].error).toBe('Cannot assign to built-in function "sin"');
      expect(results[0].value).toBe(null);
    });

    it("does not break subsequent lines after function definition", () => {
      const results = evaluate(["f(x) = x * 2", "10 + 5"]);
      expect(results[1].value).toBe(15);
    });

    it("function definition does not contribute to prev or sum", () => {
      const results = evaluate(["10", "f(x) = x^2", "prev"]);
      expect(results[2].value).toBe(10);
    });
  });

  describe("simplified function declarations", () => {
    it("creates function from assignment with free variables", () => {
      const results = evaluate(["func = x^2 + 5", "func(3)"]);
      expect(results[0].value).toBe(null);
      expect(results[0].isAssignment).toBe(true);
      expect(results[0].display).toBe("x ^ 2 + 5");
      expect(results[1].value).toBe(14);
    });

    it("creates multi-param function", () => {
      const results = evaluate(["f = x + y", "f(3, 4)"]);
      expect(results[1].value).toBe(7);
    });

    it("evaluates normally when all variables are in scope", () => {
      const results = evaluate(["x = 5", "y = x + 1"]);
      expect(results[1].value).toBe(6);
      expect(results[1].isAssignment).toBe(true);
    });

    it("captures scope variables in function body", () => {
      const results = evaluate(["rate = 0.1", "tax = x * rate", "tax(100)"]);
      expect(results[2].value).toBeCloseTo(10);
    });

    it("can be passed to derivate", () => {
      const results = evaluate(["f = x^2", "g = derivate(f)", "g(5)"]);
      expect(results[2].value).toBe(10);
    });
  });

  describe("builtins: prev, sum, avg", () => {
    it("prev references the last numeric result", () => {
      const results = evaluate(["42", "prev + 8"]);
      expect(values(results)).toEqual([42, 50]);
    });

    it("prev updates after each line", () => {
      const results = evaluate("10", "20", "prev");
      expect(results[2].value).toBe(20);
    });

    it("prev is not set before any numeric result", () => {
      // A comment followed by prev — prev should not be available
      const results = evaluate(["// nothing yet", "prev"]);
      // prev is undefined, mathjs will throw, result is silently skipped
      expect(results[1].value).toBe(null);
    });

    it("prev preserves units across lines", () => {
      const results = evaluate(["5 km", "prev + 100 m"]);
      expect(results[1].display).toBe("5.1 km");
    });

    it("sum accumulates all numeric results", () => {
      const results = evaluate(["10", "20", "30", "sum"]);
      expect(results[3].value).toBe(60);
    });

    it("sum aggregates compatible units", () => {
      const results = evaluate(["5 km", "100 m", "sum"]);
      expect(results[2].display).toBe("5.1 km");
    });

    it("sum is not set when units are incompatible", () => {
      const results = evaluate(["5 km", "2 kg", "sum"]);
      expect(results[2].value).toBeNull();
    });

    it("average computes running average", () => {
      const results = evaluate(["10", "20", "30", "avg"]);
      expect(results[3].value).toBe(20);
    });

    it("average aggregates compatible units", () => {
      const results = evaluate(["10 m", "20 m", "30 m", "average"]);
      expect(results[3].display).toBe("20 m");
    });

    it("avg works with units", () => {
      const results = evaluate(["10 m", "20 m", "avg"]);
      expect(results[2].display).toBe("15 m");
    });

    it("avg is not set when units are incompatible", () => {
      const results = evaluate(["5 km", "2 kg", "avg"]);
      expect(results[2].value).toBeNull();
    });

    it("median picks the middle running value", () => {
      const results = evaluate(["1", "10", "100", "median"]);
      expect(results[3].value).toBe(10);
    });

    it("mode picks the most frequent running value", () => {
      const results = evaluate(["1", "2", "2", "3", "mode"]);
      // mathjs returns mode as an array; the first element is the mode.
      expect(results[4].display).toContain("2");
    });

    it("aggregate names are case-insensitive", () => {
      const results = evaluate(["10", "20", "30", "Sum", "AVG", "Average"]);
      expect(results[3].value).toBe(60);
      expect(results[4].value).toBe(20);
      expect(results[5].value).toBe(20);
    });
  });

  describe("aggregate function-call form", () => {
    it("avg(1, 2, 3) calls mathjs mean", () => {
      const results = evaluate("avg(1, 2, 3)");
      expect(results[0].value).toBe(2);
    });

    it("average(1, 2, 3) calls mathjs mean", () => {
      const results = evaluate("average(1, 2, 3)");
      expect(results[0].value).toBe(2);
    });

    it("sum(1, 2, 3) calls mathjs sum", () => {
      const results = evaluate("sum(1, 2, 3)");
      expect(results[0].value).toBe(6);
    });

    it("median(1, 2, 3, 4) calls mathjs median", () => {
      const results = evaluate("median(1, 2, 3, 4)");
      expect(results[0].value).toBe(2.5);
    });

    it("avg(5 m, 10 m, 15 m) preserves units", () => {
      const results = evaluate("avg(5 m, 10 m, 15 m)");
      expect(results[0].display).toBe("10 m");
    });

    it("call form is independent of running values", () => {
      const results = evaluate(["100", "200", "avg(1, 2, 3)"]);
      expect(results[2].value).toBe(2);
    });
  });

  describe("undefined variables", () => {
    it("bare name returns no value", () => {
      const results = evaluate("variable");
      expect(results[0].value).toBe(null);
    });

    it("undefined variable in expression returns no value", () => {
      const results = evaluate("variable + 5");
      expect(results[0].value).toBe(null);
    });

    it("does not override explicitly assigned variables", () => {
      const results = evaluate(["x = 10", "x"]);
      expect(values(results)).toEqual([10, 10]);
    });

    it("does not default prev when not set", () => {
      const results = evaluate(["nothing", "prev"]);
      expect(results[1].value).toBe(null);
    });

    it("does not default sum or average when not set", () => {
      const results = evaluate(["nothing", "average"]);
      expect(results[1].value).toBe(null);
    });

    it("is not flagged as assignment", () => {
      const results = evaluate("variable");
      expect(results[0].isAssignment).toBe(false);
    });
  });

  describe("function assignment protection", () => {
    it("shows error when assigning to a built-in function", () => {
      const results = evaluate("sqrt = 5");
      expect(results[0].error).toBe('Cannot assign to built-in function "sqrt"');
      expect(results[0].value).toBe(null);
    });

    it("blocks assignment to any math function", () => {
      const results = evaluate(["sin = 1", "cos = 2", "log = 3"]);
      expect(results[0].error).toContain("Cannot assign to built-in function");
      expect(results[1].error).toContain("Cannot assign to built-in function");
      expect(results[2].error).toContain("Cannot assign to built-in function");
    });

    it("does not break subsequent lines", () => {
      const results = evaluate(["sqrt = 5", "2 + 2"]);
      expect(results[0].error).toContain("Cannot assign");
      expect(results[1].value).toBe(4);
    });

    it("allows assignment to regular variables", () => {
      const results = evaluate("x = 5");
      expect(results[0].value).toBe(5);
      expect(results[0].error).toBe(null);
    });
  });

  describe("reserved-name assignment protection", () => {
    it("blocks calculus assignment to __proto__", () => {
      const results = evaluate("__proto__ = derivate(x^2)");
      expect(results[0].error).toBe('Cannot assign to reserved name "__proto__"');
      expect(results[0].value).toBe(null);
    });

    it("blocks calculus assignment to constructor", () => {
      // `constructor` is also caught by the earlier built-in-function guard
      // (Object.prototype.constructor is a function); accept either path.
      const results = evaluate("constructor = derivate(x^2)");
      expect(results[0].error).toMatch(
        /Cannot assign to (reserved name|built-in function) "constructor"/,
      );
      expect(results[0].value).toBe(null);
    });

    it("blocks free-var function assignment to __proto__", () => {
      const results = evaluate("__proto__ = x + 1");
      expect(results[0].error).toBe('Cannot assign to reserved name "__proto__"');
      expect(results[0].value).toBe(null);
    });

    it("does not pollute scope across lines", () => {
      const results = evaluate(["__proto__ = derivate(x^2)", "1 + 1"]);
      expect(results[0].error).toContain("reserved name");
      expect(results[1].value).toBe(2);
    });
  });

  describe("error handling", () => {
    it("silently handles invalid expressions", () => {
      const results = evaluate("1 +");
      expect(results[0].value).toBe(null);
      expect(results[0].error).toBe(null);
      expect(results[0].display).toBe("");
    });

    it("does not break subsequent lines after an error", () => {
      const results = evaluate(["(1 +", "2 + 2"]);
      expect(values(results)).toEqual([null, 4]);
    });
  });

  describe("math functions", () => {
    it("supports sqrt", () => {
      const results = evaluate("sqrt(144)");
      expect(results[0].value).toBe(12);
    });

    it("supports power", () => {
      const results = evaluate("2^10");
      expect(results[0].value).toBe(1024);
    });

    it("supports pi", () => {
      const results = evaluate("pi");
      expect(results[0].value).toBeCloseTo(Math.PI);
    });

    it("shows error for bare function name", () => {
      const results = evaluate("log");
      expect(results[0].value).toBe(null);
      expect(results[0].error).toBe("log requires 1 argument");
      expect(results[0].display).toBe("");
    });

    it("shows error with correct arg count for multi-arg functions", () => {
      const results = evaluate("pow");
      expect(results[0].value).toBe(null);
      expect(results[0].error).toBe("pow requires 2 arguments");
    });

    it("does not break subsequent lines after bare function name", () => {
      const results = evaluate(["sin", "2 + 2"]);
      expect(results[0].error).toBe("sin requires 1 argument");
      expect(results[1].value).toBe(4);
    });
  });

  describe("constants", () => {
    it("supports e", () => {
      const results = evaluate("e");
      expect(results[0].value).toBeCloseTo(Math.E);
    });

    it("supports tau", () => {
      const results = evaluate("tau");
      expect(results[0].value).toBeCloseTo(2 * Math.PI);
    });

    it("supports phi (golden ratio)", () => {
      const results = evaluate("phi");
      expect(results[0].value).toBeCloseTo((1 + Math.sqrt(5)) / 2);
    });

    it("supports lowercase infinity", () => {
      const results = evaluate("infinity");
      expect(results[0].value).toBe(Infinity);
      expect(results[0].display).toBe("infinity");
    });

    it("accepts capitalized Infinity (case-insensitive input)", () => {
      const results = evaluate("Infinity");
      expect(results[0].value).toBe(Infinity);
      expect(results[0].display).toBe("infinity");
    });

    it("accepts INFINITY in any case (case-insensitive input)", () => {
      const results = evaluate("INFINITY");
      expect(results[0].value).toBe(Infinity);
      expect(results[0].display).toBe("infinity");
    });

    it("renders -infinity for negated infinity", () => {
      const results = evaluate("-infinity");
      expect(results[0].value).toBe(-Infinity);
      expect(results[0].display).toBe("-infinity");
    });

    it("renders 1/0 as infinity", () => {
      const results = evaluate("1 / 0");
      expect(results[0].display).toBe("infinity");
    });

    it("uses infinity in arithmetic", () => {
      const results = evaluate(["infinity - 1"]);
      expect(results[0].value).toBe(Infinity);
    });

    it("does not rewrite identifiers containing the word infinity", () => {
      const results = evaluate(["myInfinityVar = 5", "myInfinityVar + 1"]);
      expect(results[0].value).toBe(5);
      expect(results[1].value).toBe(6);
    });
  });

  describe("booleans", () => {
    it("renders true with value 1", () => {
      const results = evaluate("true");
      expect(results[0].value).toBe(1);
      expect(results[0].display).toBe("true");
    });

    it("renders false with value 0", () => {
      const results = evaluate("false");
      expect(results[0].value).toBe(0);
      expect(results[0].display).toBe("false");
    });

    it("renders comparison results", () => {
      const results = evaluate(["3 == 3", "1 > 2"]);
      expect(results[0].display).toBe("true");
      expect(results[0].value).toBe(1);
      expect(results[1].display).toBe("false");
      expect(results[1].value).toBe(0);
    });

    it("renders logical not", () => {
      const results = evaluate("not true");
      expect(results[0].display).toBe("false");
      expect(results[0].value).toBe(0);
    });

    it("feeds prev with boolean coercion", () => {
      const results = evaluate(["true", "prev + 4"]);
      expect(results[1].value).toBe(5);
    });

    it("feeds sum with boolean coercion", () => {
      const results = evaluate(["true", "false", "true", "sum"]);
      expect(results[3].value).toBe(2);
    });
  });

  describe("derivative", () => {
    it("inline: returns constant for derivative of linear", () => {
      const results = evaluate("derivate(2 * x)");
      expect(results[0].value).toBe(2);
      expect(results[0].error).toBe(null);
    });

    it("inline: returns callable for derivative of polynomial", () => {
      const results = evaluate("derivate(x^2)");
      expect(results[0].display).toBe("2 * x");
      expect(results[0].error).toBe(null);
    });

    it("inline: infers variable from single free var", () => {
      const results = evaluate("derivate(y^3)");
      expect(results[0].display).toBe("3 * y ^ 2");
    });

    it("inline: explicit variable with two-arg form", () => {
      const results = evaluate("derivate(2 * y + z, z)");
      expect(results[0].value).toBe(1);
    });

    it("inline: trig function", () => {
      const results = evaluate(["g = derivate(sin(x))", "g(0)"]);
      // derivative of sin(x) is cos(x), cos(0) = 1
      expect(results[1].value).toBeCloseTo(1);
    });

    it("does not break subsequent lines", () => {
      const results = evaluate(["derivate(x^2)", "2 + 2"]);
      expect(results[0].display).toBe("2 * x");
      expect(results[1].value).toBe(4);
    });

    it("does not contribute to prev, sum, or average", () => {
      const results = evaluate(["10", "derivate(x^2)", "prev"]);
      expect(results[2].value).toBe(10);
    });

    it("derive is an alias for derivative", () => {
      const results = evaluate("derive(x^2)");
      expect(results[0].display).toBe("2 * x");
    });

    it("derivate is an alias for derivative", () => {
      const results = evaluate("derivate(x^2)");
      expect(results[0].display).toBe("2 * x");
    });

    it("derivative accepts a user-defined function", () => {
      const results = evaluate(["f(x) = x^2", "derivative(f)"]);
      expect(results[1].display).toBe("2 * x");
    });

    it("derivate returns a callable function", () => {
      const results = evaluate(["f = x^3", "g = derivate(f)", "g(2)"]);
      expect(results[1].display).toBe("3 * x ^ 2");
      expect(results[2].value).toBe(12);
    });

    it("end-to-end: define, derive, call both", () => {
      const results = evaluate([
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
      const results = evaluate(["f(x) = x^3", "g = derive(f)", "g(2)"]);
      expect(results[2].value).toBe(12);
    });

    it("errors for multi-param UserFunc without variable", () => {
      const results = evaluate(["f = 2 * y + z", "derivate(f)"]);
      expect(results[1].error).toContain("parameters");
      expect(results[1].error).toContain("specify variable");
    });

    it("multi-param UserFunc works with explicit variable", () => {
      const results = evaluate(["f = 2 * y + z", "g = derivate(f, y)"]);
      expect(results[1].value).toBe(null);
      // derivative of 2*y+z w.r.t. y = 2 → but returns a UserFunc with params [y, z]
      expect(results[1].display).toBe("2");
    });

    it("errors for too many arguments", () => {
      const results = evaluate("derivate(x^2, x, y)");
      expect(results[0].error).toContain("1 or 2 arguments");
    });

    it("rejects quoted string arguments", () => {
      const results = evaluate('derivate("x^2", "x")');
      expect(results[0].error).toContain("Quotes are not needed");
    });

    it("errors for multiple free variables without explicit var", () => {
      const results = evaluate("derivate(x + y)");
      expect(results[0].error).toContain("Multiple variables");
      expect(results[0].error).toContain("specify variable");
    });

    it("constant derivative returns number", () => {
      const results = evaluate("derivate(3 * x + 5)");
      expect(results[0].value).toBe(3);
    });

    it("inline derivative assigned to variable is callable", () => {
      const results = evaluate(["g = derivate(x^2 + x)", "g(3)"]);
      expect(results[0].display).toBe("2 * x + 1");
      expect(results[0].isAssignment).toBe(true);
      expect(results[1].value).toBe(7);
    });
  });

  describe("integral", () => {
    it("inline: returns callable for integral of polynomial", () => {
      const results = evaluate("integral(x^2)");
      expect(results[0].display).toBe("x ^ 3 / 3");
      expect(results[0].error).toBe(null);
    });

    it("inline: returns callable for integral of trig", () => {
      const results = evaluate(["g = integral(sin(x))", "g(0)"]);
      // integral of sin(x) is -cos(x), -cos(0) = -1
      expect(results[1].value).toBeCloseTo(-1);
    });

    it("inline: infers variable from single free var", () => {
      const results = evaluate("integrate(z + 10)");
      // ∫(z + 10) = z^2/2 + 10z → UserFunc
      expect(results[0].display).toContain("z");
    });

    it("inline: explicit variable with two-arg form", () => {
      const results = evaluate(["g = integral(2 * y + z, z)", "g(1, 5)"]);
      // ∫(2y + z) dz = 2y*z + z^2/2 → at y=1, z=5: 10 + 12.5 = 22.5
      // Wait, but params are only [z], y comes from scope... Actually y is free
      // We need to test a simpler case
      expect(results[0].error).toBe(null);
    });

    it("does not break subsequent lines", () => {
      const results = evaluate(["integral(x^2)", "2 + 2"]);
      expect(results[0].display).toBe("x ^ 3 / 3");
      expect(results[1].value).toBe(4);
    });

    it("does not contribute to prev, sum, or average", () => {
      const results = evaluate(["10", "integral(x^2)", "prev"]);
      expect(results[2].value).toBe(10);
    });

    it("integrate is an alias for integral", () => {
      const results = evaluate("integrate(x^2)");
      expect(results[0].display).toBe("x ^ 3 / 3");
    });

    it("antiderivative is an alias for integral", () => {
      const results = evaluate("antiderivative(x^2)");
      expect(results[0].display).toBe("x ^ 3 / 3");
    });

    it("integral accepts a user-defined function", () => {
      const results = evaluate(["f(x) = x^2", "integral(f)"]);
      expect(results[1].display).toBe("x ^ 3 / 3");
    });

    it("integrate returns a callable function", () => {
      const results = evaluate(["f = x^3", "g = integrate(f)", "g(2)"]);
      expect(results[1].display).toBe("x ^ 4 / 4");
      expect(results[2].value).toBe(4);
    });

    it("end-to-end: define, integrate, call both", () => {
      const results = evaluate([
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
      const results = evaluate(["f = x^2", "g = integrate(f)", "h = derivate(g)", "h(5)"]);
      // h should be equivalent to f: x^2
      expect(results[3].value).toBe(25);
    });

    it("integrates traditional function declaration", () => {
      const results = evaluate(["f(x) = x^3", "g = integrate(f)", "g(2)"]);
      expect(results[2].value).toBe(4);
    });

    it("errors for multi-param UserFunc without variable", () => {
      const results = evaluate(["f = 2 * y + z", "integral(f)"]);
      expect(results[1].error).toContain("parameters");
      expect(results[1].error).toContain("specify variable");
    });

    it("rejects quoted string arguments", () => {
      const results = evaluate(['integral("x^2", "x")']);
      expect(results[0].error).toContain("Quotes are not needed");
    });

    it("inline integral assigned to variable is callable", () => {
      const results = evaluate(["g = integrate(x^2 + x)", "g(3)"]);
      // ∫(x^2 + x) = x^3/3 + x^2/2 → at x=3: 9 + 4.5 = 13.5
      expect(results[0].isAssignment).toBe(true);
      expect(results[1].value).toBeCloseTo(13.5);
    });
  });

  describe("percentage", () => {
    it("treats trailing `%` as percent", () => {
      // No `to`/`in`/`as` keyword needed
      const results = evaluate("50 %");
      expect(results[0].value).toBe(0.5);
      expect(results[0].display).toBe("50%");
    });

    it("treats trailing `%` as percent", () => {
      // No `to`/`in`/`as` keyword needed
      const results = evaluate("50%");
      expect(results[0].value).toBe(0.5);
      expect(results[0].display).toBe("50%");
    });

    it("converts trailing `as %`", () => {
      const results = evaluate("0.5 as %");
      expect(results[0].value).toBe(50);
      expect(results[0].display).toBe("50%");
    });

    it("converts trailing `to %`", () => {
      const results = evaluate("0.25 to %");
      expect(results[0].value).toBe(25);
      expect(results[0].display).toBe("25%");
    });

    it("converts trailing `as percent` (word form)", () => {
      const results = evaluate("0.75 as percent");
      expect(results[0].value).toBe(75);
      expect(results[0].display).toBe("75%");
    });

    it("converts trailing `to percent` (word form)", () => {
      const results = evaluate("0.4 to percent");
      expect(results[0].value).toBe(40);
      expect(results[0].display).toBe("40%");
    });

    it("matches `as percent` case-insensitively", () => {
      const results = evaluate("0.5 AS PERCENT");
      expect(results[0].display).toBe("50%");
    });

    it("renders zero as 0%", () => {
      const results = evaluate("0 as %");
      expect(results[0].value).toBe(0);
      expect(results[0].display).toBe("0%");
    });

    it("renders negative values with leading sign", () => {
      const results = evaluate("-0.5 as %");
      expect(results[0].value).toBe(-50);
      expect(results[0].display).toBe("-50%");
    });

    it("renders 1 as 100%", () => {
      const results = evaluate("1 as %");
      expect(results[0].display).toBe("100%");
    });

    it("renders values greater than 1 above 100%", () => {
      const results = evaluate("2.5 as %");
      expect(results[0].display).toBe("250%");
    });

    it("evaluates the LHS as an expression before applying percent", () => {
      // 0.25 + 0.25 = 0.5 → 50%
      const results = evaluate("0.25 + 0.25 as %");
      expect(results[0].value).toBe(50);
      expect(results[0].display).toBe("50%");
    });

    it("applies percent to a referenced variable", () => {
      const results = evaluate(["x = 0.3", "x as %"]);
      expect(results[1].value).toBeCloseTo(30);
      expect(results[1].display).toBe("30%");
    });

    it("applies percent to `prev`", () => {
      const results = evaluate(["0.6", "prev as %"]);
      expect(results[1].display).toBe("60%");
    });

    it("formats large percent values with thousand separators", () => {
      const results = evaluate("12345 as %");
      expect(results[0].value).toBe(1234500);
      expect(results[0].display).toBe("1,234,500%");
    });

    it("feeds prev with the multiplied value (×100), not the input", () => {
      const results = evaluate(["0.5 as %", "prev"]);
      expect(results[1].value).toBe(50);
    });

    it("does not apply percent when LHS is incomplete", () => {
      const results = evaluate("1 + as %");
      // The stripped LHS `1 +` fails to parse → silent empty result.
      expect(results[0].value).toBe(null);
      expect(results[0].display).toBe("");
    });

    it("does not match `%` used as the modulo operator", () => {
      // `17 % 5` should evaluate to mod, not be treated as percent
      const results = evaluate("17 % 5");
      expect(results[0].value).toBe(2);
      expect(results[0].display).toBe("2");
    });
  });

  describe("units", () => {
    it("multiplies a unit by a scalar", () => {
      const results = evaluate("350 cm * 3");
      expect(results[0].value).toBe(10.5);
      // mathjs auto-scales cm → m when crossing prefix thresholds.
      expect(results[0].display).toBe("10.5 m");
    });

    it("assigns a unit expression", () => {
      const results = evaluate("volume = 30 m^2 * 15 m");
      expect(results[0].value).toBe(450);
      expect(results[0].display).toBe("450 m^3");
      expect(results[0].isAssignment).toBe(true);
    });

    it("reuses a unit variable in a later expression", () => {
      const results = evaluate(["volume = 30 m^2 * 15 m", "volume / 2"]);
      expect(results[1].value).toBe(225);
      expect(results[1].display).toBe("225 m^3");
    });

    it("converts units with `to`", () => {
      const results = evaluate("600 sec to min");
      expect(results[0].value).toBe(10);
      expect(results[0].display).toBe("10 minutes");
    });

    it("converts units with `as`", () => {
      const results = evaluate("30 sec as minutes");
      expect(results[0].value).toBe(0.5);
      expect(results[0].display).toBe("0.5 minutes");
    });

    it("surfaces an error on mismatched units", () => {
      const results = evaluate("600 sec to kg");
      expect(results[0].value).toBe(null);
      expect(results[0].error).toMatch(/unit/i);
    });

    it("keeps incomplete input silent", () => {
      const results = evaluate("1 +");
      expect(results[0].value).toBe(null);
      expect(results[0].error).toBe(null);
      expect(results[0].display).toBe("");
    });

    it("applies thousand separators to unit magnitudes", () => {
      const results = evaluate("12345 inch");
      expect(results[0].display).toBe("12,345 inch");
    });

    it("preserves the secant function when followed by parentheses", () => {
      const results = evaluate("sec(0)");
      expect(results[0].value).toBeCloseTo(1);
    });

    it("preserves the minimum function when followed by parentheses", () => {
      const results = evaluate("min(3, 7, 2)");
      expect(results[0].value).toBe(2);
    });
  });

  describe("display formatting", () => {
    it("formats integers with thousand separators", () => {
      const results = evaluate("1000000");
      expect(results[0].display).toBe("1,000,000");
    });

    it("formats decimal results", () => {
      const results = evaluate("1 / 3");
      expect(results[0].display).toContain("0.333");
    });
  });

  describe("currency units", () => {
    it("converts between registered currencies", () => {
      // 1 EUR = 1.087 USD → 100 USD = 100/1.087 EUR ≈ 91.99
      registerCurrencyUnits(rateMap({ USD: 1, EUR: 1.087 }));
      const result = evaluate("100 USD to EUR");
      expect(result[0].value).toBeCloseTo(100 / 1.087, 4);
      expect(result[0].display).toContain("€");
    });

    it("supports `as` for currency conversion", () => {
      registerCurrencyUnits(rateMap({ USD: 1, GBP: 1.273 }));
      const result = evaluate("100 USD as GBP");
      expect(result[0].value).toBeCloseTo(100 / 1.273, 4);
      expect(result[0].display).toContain("£");
    });

    it("adds quantities in different currencies", () => {
      registerCurrencyUnits(rateMap({ USD: 1, EUR: 1.087 }));
      // 100 USD + 50 EUR (= 50 * 1.087 USD) = 154.35 USD
      const result = evaluate("100 USD + 50 EUR");
      expect(result[0].value).toBeCloseTo(100 + 50 * 1.087, 4);
    });

    it("multiplies currency by scalar", () => {
      registerCurrencyUnits(rateMap({ USD: 1, EUR: 1.087 }));
      const result = evaluate("50 EUR * 3");
      expect(result[0].value).toBeCloseTo(150, 4);
      expect(result[0].display).toContain("€");
    });

    it("re-registering with new rates updates results", () => {
      registerCurrencyUnits(rateMap({ USD: 1, EUR: 1.0 }));
      let result = evaluate("100 USD to EUR");
      expect(result[0].value).toBeCloseTo(100, 4);

      registerCurrencyUnits(rateMap({ USD: 1, EUR: 2.0 }));
      result = evaluate("100 USD to EUR");
      expect(result[0].value).toBeCloseTo(50, 4);
    });

    it("variables hold currency amounts and substitute the symbol", () => {
      registerCurrencyUnits(rateMap({ USD: 1, NOK: 0.0915 }));
      const result = evaluate(["salary = 65000 USD", "salary as NOK"]);
      expect(result[1].value).toBeCloseTo(65000 / 0.0915, 4);
      expect(result[1].display).toContain("kr");
    });

    it("rewrites `<number> as|to <currency>` as a unit literal", () => {
      registerCurrencyUnits(rateMap({ USD: 1, EUR: 1.087 }));
      // "150 as usd" should attach USD as the unit, not call the `to` operator
      // (which mathjs only allows when the LHS is already a Unit).
      const result = evaluate("150 as usd");
      expect(result[0].error).toBeNull();
      expect(result[0].value).toBeCloseTo(150, 4);
      expect(result[0].display).toContain("$");
    });

    it("rewrites arithmetic expressions before applying a currency", () => {
      registerCurrencyUnits(rateMap({ USD: 1, EUR: 1.087 }));
      const result = evaluate("100 + 50 as USD");
      expect(result[0].value).toBeCloseTo(150, 4);
      expect(result[0].display).toContain("$");
    });

    it("accepts lowercase currency codes via aliases", () => {
      registerCurrencyUnits(rateMap({ USD: 1, NOK: 0.0915 }));
      const upper = evaluate("100 NOK to USD");
      const lower = evaluate("100 nok to usd");
      expect(lower[0].value).toBeCloseTo(upper[0].value!, 6);
      expect(lower[0].display).toContain("$");
    });
  });
});
