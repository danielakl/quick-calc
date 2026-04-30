import { create, all } from "mathjs";
import { describe, it, expect } from "vitest";
import { createIntegral } from "./integral";

const math = create(all, {});
const integral = createIntegral(math);

/** Evaluate the integral result at a given value of x. */
function evalAt(expr: string, variable: string, value: number): number {
  const result = integral(expr, variable);
  return result.compile().evaluate({ [variable]: value }) as number;
}

describe("createIntegral", () => {
  describe("power rule", () => {
    it("integrates a constant", () => {
      expect(integral("5", "x").toString()).toBe("5 * x");
    });

    it("integrates x (bare variable)", () => {
      const result = integral("x", "x").toString();
      expect(result).toBe("x ^ 2 / 2");
    });

    it("integrates x^2", () => {
      expect(integral("x^2", "x").toString()).toBe("x ^ 3 / 3");
    });

    it("integrates x^3", () => {
      expect(integral("x^3", "x").toString()).toBe("x ^ 4 / 4");
    });

    it("integrates x^(-1) as log(x)", () => {
      const result = integral("x^(-1)", "x").toString();
      expect(result).toBe("log(x)");
    });

    it("integrates x^0.5", () => {
      const result = evalAt("x^0.5", "x", 4);
      // ∫x^0.5 = x^1.5 / 1.5 = (2/3)*x^1.5 → at x=4: (2/3)*8 ≈ 5.333
      expect(result).toBeCloseTo(5.333, 2);
    });
  });

  describe("constant multiple", () => {
    it("integrates 3 * x^2", () => {
      expect(integral("3 * x^2", "x").toString()).toBe("x ^ 3");
    });

    it("integrates x^2 * 5", () => {
      const result = evalAt("x^2 * 5", "x", 3);
      // ∫5x^2 = 5 * x^3/3 → at x=3: 5*9 = 45
      expect(result).toBeCloseTo(45);
    });

    it("integrates expression divided by constant", () => {
      const result = evalAt("x^2 / 2", "x", 6);
      // ∫x^2/2 = x^3/6 → at x=6: 36
      expect(result).toBeCloseTo(36);
    });
  });

  describe("sum and difference", () => {
    it("integrates x^2 + x", () => {
      const result = evalAt("x^2 + x", "x", 3);
      // ∫(x^2 + x) = x^3/3 + x^2/2 → at x=3: 9 + 4.5 = 13.5
      expect(result).toBeCloseTo(13.5);
    });

    it("integrates x^2 - x", () => {
      const result = evalAt("x^2 - x", "x", 3);
      // ∫(x^2 - x) = x^3/3 - x^2/2 → at x=3: 9 - 4.5 = 4.5
      expect(result).toBeCloseTo(4.5);
    });

    it("integrates polynomial with constant", () => {
      const result = evalAt("x^2 + 3*x + 2", "x", 1);
      // ∫(x^2 + 3x + 2) = x^3/3 + 3x^2/2 + 2x → at x=1: 1/3 + 1.5 + 2 ≈ 3.833
      expect(result).toBeCloseTo(3.833, 2);
    });
  });

  describe("unary minus", () => {
    it("integrates -x", () => {
      const result = evalAt("-x", "x", 4);
      // ∫-x = -x^2/2 → at x=4: -8
      expect(result).toBeCloseTo(-8);
    });

    it("integrates -sin(x)", () => {
      const result = integral("-sin(x)", "x").toString();
      expect(result).toBe("cos(x)");
    });
  });

  describe("trigonometric functions", () => {
    it("integrates sin(x)", () => {
      expect(integral("sin(x)", "x").toString()).toBe("-cos(x)");
    });

    it("integrates cos(x)", () => {
      expect(integral("cos(x)", "x").toString()).toBe("sin(x)");
    });

    it("integrates tan(x) numerically", () => {
      // ∫tan(x) = -log(cos(x)) → at x=0: -log(1) = 0
      expect(evalAt("tan(x)", "x", 0)).toBeCloseTo(0);
    });

    it("integrates sec(x) numerically", () => {
      // ∫sec(x) = log(sec(x) + tan(x)) → at x=0: log(1+0) = 0
      expect(evalAt("sec(x)", "x", 0)).toBeCloseTo(0);
    });

    it("integrates csc(x) numerically", () => {
      // ∫csc(x) = -log(csc(x) + cot(x)) → at x=pi/2: -log(1+0) = 0
      expect(evalAt("csc(x)", "x", Math.PI / 2)).toBeCloseTo(0);
    });

    it("integrates cot(x) numerically", () => {
      // ∫cot(x) = log(sin(x)) → at x=pi/2: log(1) = 0
      expect(evalAt("cot(x)", "x", Math.PI / 2)).toBeCloseTo(0);
    });
  });

  describe("exponential and logarithmic", () => {
    it("integrates exp(x)", () => {
      expect(integral("exp(x)", "x").toString()).toBe("exp(x)");
    });

    it("integrates log(x) numerically", () => {
      // ∫log(x) = x*log(x) - x → at x=1: 0 - 1 = -1
      expect(evalAt("log(x)", "x", 1)).toBeCloseTo(-1);
    });

    it("integrates log(x) at e", () => {
      // at x=e: e*1 - e = 0
      expect(evalAt("log(x)", "x", Math.E)).toBeCloseTo(0, 5);
    });
  });

  describe("linear substitution", () => {
    it("integrates sin(2*x)", () => {
      // ∫sin(2x) = -cos(2x)/2 → at x=0: -1/2
      expect(evalAt("sin(2 * x)", "x", 0)).toBeCloseTo(-0.5);
    });

    it("integrates cos(3*x + 1) numerically", () => {
      // ∫cos(3x+1) = sin(3x+1)/3 → at x=0: sin(1)/3
      expect(evalAt("cos(3 * x + 1)", "x", 0)).toBeCloseTo(Math.sin(1) / 3);
    });

    it("integrates (2*x + 1)^3", () => {
      // ∫(2x+1)^3 = (2x+1)^4 / (2*4) → at x=0: 1/8
      expect(evalAt("(2 * x + 1)^3", "x", 0)).toBeCloseTo(0.125);
    });

    it("integrates exp(2*x)", () => {
      // ∫exp(2x) = exp(2x)/2 → at x=0: 1/2
      expect(evalAt("exp(2 * x)", "x", 0)).toBeCloseTo(0.5);
    });
  });

  describe("reciprocal / division", () => {
    it("integrates 1/x as log(x)", () => {
      const result = integral("1 / x", "x").toString();
      expect(result).toBe("log(x)");
    });

    it("integrates 5/x", () => {
      const result = integral("5 / x", "x").toString();
      expect(result).toBe("5 * log(x)");
    });
  });

  describe("constant base exponentials", () => {
    it("integrates 2^x", () => {
      // ∫2^x = 2^x / log(2) → at x=0: 1/log(2)
      expect(evalAt("2^x", "x", 0)).toBeCloseTo(1 / Math.log(2));
    });

    it("integrates 3^(2*x)", () => {
      // ∫3^(2x) = 3^(2x) / (2 * log(3)) → at x=0: 1/(2*log(3))
      expect(evalAt("3^(2 * x)", "x", 0)).toBeCloseTo(1 / (2 * Math.log(3)));
    });
  });

  describe("string and MathNode input", () => {
    it("accepts a string expression", () => {
      const result = integral("x^2", "x");
      expect(result.toString()).toBe("x ^ 3 / 3");
    });

    it("accepts a MathNode", () => {
      const node = math.parse("x^2");
      const result = integral(node, "x");
      expect(result.toString()).toBe("x ^ 3 / 3");
    });
  });

  describe("error cases", () => {
    it("throws for non-elementary integrals", () => {
      expect(() => integral("x * sin(x)", "x")).toThrow(/Cannot compute integral/);
    });

    it("throws for x^x", () => {
      expect(() => integral("x^x", "x")).toThrow(/Cannot compute integral/);
    });

    it("throws for unsupported function", () => {
      expect(() => integral("gamma(x)", "x")).toThrow(/Cannot compute integral/);
    });

    it("throws when both factors of a product depend on the variable", () => {
      // Hits the multiplication "both depend on variable" branch.
      expect(() => integral("x * x", "x")).toThrow(/Cannot compute integral/);
    });

    it("throws for variable exponent on variable base", () => {
      // x^(x+1): both base and exponent are variable.
      expect(() => integral("x^(x + 1)", "x")).toThrow(/Cannot compute integral/);
    });

    it("throws for f(x) / g(x) with non-linear divisor", () => {
      // 1 / (x^2) — divisor depends on x but is not linear.
      expect(() => integral("1 / (x^2 + 1)", "x")).toThrow(/Cannot compute integral/);
    });

    it("throws for trig of a non-linear argument", () => {
      // sin(x^2) — argument is not linear.
      expect(() => integral("sin(x^2)", "x")).toThrow(/Cannot compute integral/);
    });

    it("throws for constant base raised to a non-linear exponent", () => {
      // 2^(x^2) — exponent is not linear in x.
      expect(() => integral("2^(x^2)", "x")).toThrow(/Cannot compute integral/);
    });
  });

  describe("extractLinear edge branches", () => {
    it("integrates c - x (variable on the right of subtract)", () => {
      // ∫(5 - x) = 5x - x^2/2 → at x=2: 10 - 2 = 8
      expect(evalAt("5 - x", "x", 2)).toBeCloseTo(8);
    });

    it("integrates -(2*x + 1) (unary minus around linear)", () => {
      // ∫-(2x+1) = -(x^2 + x) → at x=3: -(9 + 3) = -12
      expect(evalAt("-(2 * x + 1)", "x", 3)).toBeCloseTo(-12);
    });

    it("integrates x * 5 (variable on the left of multiply)", () => {
      // ∫x*5 = 5*x^2/2 → at x=2: 10
      expect(evalAt("x * 5", "x", 2)).toBeCloseTo(10);
    });

    it("integrates (3 + x) — variable on the right of add", () => {
      // ∫(3 + x) = 3x + x^2/2 → at x=4: 12 + 8 = 20
      expect(evalAt("3 + x", "x", 4)).toBeCloseTo(20);
    });
  });

  describe("c / linear and (ax+b)^(-1)", () => {
    it("integrates 1 / (2*x + 1) as log(2x+1) / 2", () => {
      // ∫1/(2x+1) = log(2x+1)/2 → at x=0: log(1)/2 = 0
      expect(evalAt("1 / (2 * x + 1)", "x", 0)).toBeCloseTo(0);
      // at x=(e-1)/2: log(e)/2 = 0.5
      expect(evalAt("1 / (2 * x + 1)", "x", (Math.E - 1) / 2)).toBeCloseTo(0.5);
    });

    it("integrates 6 / (3*x + 1) as 2 * log(3x+1)", () => {
      // ∫6/(3x+1) = (6/3)*log(3x+1) = 2*log(3x+1) → at x=0: 0
      expect(evalAt("6 / (3 * x + 1)", "x", 0)).toBeCloseTo(0);
    });

    it("integrates (2*x + 1)^(-1) as log(2x+1)/2", () => {
      // ∫(2x+1)^(-1) = log(2x+1)/2 → at x=0: 0
      expect(evalAt("(2 * x + 1)^(-1)", "x", 0)).toBeCloseTo(0);
    });
  });

  describe("symbolic exponent on bare variable", () => {
    it("integrates x^a for symbolic a using the symbolic power rule", () => {
      // The "non-numeric constant exponent" branch at integral.ts:308-310:
      // ∫x^a = x^(a+1) / (a+1). At x=1, the result evaluates to 1/(a+1) for any a.
      const node = integral("x^a", "x");
      expect(node.compile().evaluate({ x: 1, a: 4 })).toBeCloseTo(1 / 5);
      expect(node.compile().evaluate({ x: 2, a: 3 })).toBeCloseTo(2 ** 4 / 4);
    });
  });

  describe("simplification", () => {
    it("simplifies 3 * x^2 to x^3", () => {
      expect(integral("3 * x^2", "x").toString()).toBe("x ^ 3");
    });

    it("simplifies -sin(x) integral to cos(x)", () => {
      expect(integral("-sin(x)", "x").toString()).toBe("cos(x)");
    });
  });
});
