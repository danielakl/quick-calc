import {
  isConstantNode,
  isSymbolNode,
  isOperatorNode,
  isFunctionNode,
  isParenthesisNode,
  type MathNode,
  type MathJsInstance,
  type ConstantNode,
  type SymbolNode,
  type OperatorNode,
  type FunctionNode,
  type ParenthesisNode,
} from "mathjs";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Check whether a subtree is constant with respect to `varName`. */
function isConst(node: MathNode, varName: string): boolean {
  if (isConstantNode(node)) {
    return true;
  }
  if (isSymbolNode(node)) {
    return (node as SymbolNode).name !== varName;
  }
  if (isParenthesisNode(node)) {
    return isConst((node as ParenthesisNode).content, varName);
  }
  if (isOperatorNode(node) || isFunctionNode(node)) {
    return (node as OperatorNode | FunctionNode).args.every((a) => isConst(a, varName));
  }
  return false;
}

/** Evaluate a constant-only AST node to a numeric value. */
function constValue(node: MathNode): number | null {
  if (isConstantNode(node)) {
    return (node as ConstantNode).value as number;
  }
  if (isParenthesisNode(node)) {
    return constValue((node as ParenthesisNode).content);
  }
  if (isOperatorNode(node)) {
    const op = node as OperatorNode;
    if (op.fn === "unaryMinus" && op.args.length === 1) {
      const v = constValue(op.args[0]);
      return v !== null ? -v : null;
    }
    if (op.args.length === 2) {
      const l = constValue(op.args[0]);
      const r = constValue(op.args[1]);
      if (l === null || r === null) {
        return null;
      }
      if (op.fn === "add") {
        return l + r;
      }
      if (op.fn === "subtract") {
        return l - r;
      }
      if (op.fn === "multiply") {
        return l * r;
      }
      if (op.fn === "divide") {
        return r !== 0 ? l / r : null;
      }
      if (op.fn === "pow") {
        return Math.pow(l, r);
      }
    }
  }
  return null;
}

/**
 * Try to decompose a linear expression in `varName`: returns `{ a, b }` such
 * that `node = a * varName + b`, or `null` if the expression is not linear.
 */
function extractLinear(node: MathNode, varName: string): { a: number; b: number } | null {
  // Pure variable: 1 * x + 0
  if (isSymbolNode(node) && (node as SymbolNode).name === varName) {
    return { a: 1, b: 0 };
  }

  // Constant: 0 * x + c
  if (isConst(node, varName)) {
    return null;
  }

  if (isParenthesisNode(node)) {
    return extractLinear((node as ParenthesisNode).content, varName);
  }

  if (isOperatorNode(node)) {
    const op = node as OperatorNode;

    // a + b
    if (op.fn === "add" && op.args.length === 2) {
      const left = extractLinear(op.args[0], varName);
      const right = extractLinear(op.args[1], varName);
      // At least one side must involve the variable
      if (left && right) {
        return { a: left.a + right.a, b: left.b + right.b };
      }
      if (left && isConst(op.args[1], varName)) {
        const cv = constValue(op.args[1]);
        return cv !== null ? { a: left.a, b: left.b + cv } : null;
      }
      if (right && isConst(op.args[0], varName)) {
        const cv = constValue(op.args[0]);
        return cv !== null ? { a: right.a, b: right.b + cv } : null;
      }
      return null;
    }

    // a - b
    if (op.fn === "subtract" && op.args.length === 2) {
      const left = extractLinear(op.args[0], varName);
      const right = extractLinear(op.args[1], varName);
      if (left && right) {
        return { a: left.a - right.a, b: left.b - right.b };
      }
      if (left && isConst(op.args[1], varName)) {
        const cv = constValue(op.args[1]);
        return cv !== null ? { a: left.a, b: left.b - cv } : null;
      }
      if (right && isConst(op.args[0], varName)) {
        const cv = constValue(op.args[0]);
        return cv !== null ? { a: -right.a, b: cv - right.b } : null;
      }
      return null;
    }

    // c * expr or expr * c
    if (op.fn === "multiply" && op.args.length === 2) {
      if (isConst(op.args[0], varName)) {
        const cv = constValue(op.args[0]);
        const inner = extractLinear(op.args[1], varName);
        return cv !== null && inner ? { a: cv * inner.a, b: cv * inner.b } : null;
      }
      if (isConst(op.args[1], varName)) {
        const cv = constValue(op.args[1]);
        const inner = extractLinear(op.args[0], varName);
        return cv !== null && inner ? { a: cv * inner.a, b: cv * inner.b } : null;
      }
      return null;
    }

    // -expr
    if (op.fn === "unaryMinus" && op.args.length === 1) {
      const inner = extractLinear(op.args[0], varName);
      return inner ? { a: -inner.a, b: -inner.b } : null;
    }
  }

  return null;
}

// ─── Integral factory ───────────────────────────────────────────────────────

/**
 * Creates an integral function bound to a mathjs instance.
 * Returns `(expr: string | MathNode, variable: string) => MathNode`.
 *
 * Supported: power rule, trig, exponential, logarithmic, sum/difference,
 * constant multiple, linear u-substitution. Throws for unsupported integrals.
 */
export function createIntegral(
  math: MathJsInstance,
): (expr: string | MathNode, variable: string) => MathNode {
  const { ConstantNode, SymbolNode, OperatorNode, FunctionNode } = math;

  function cn(value: number): MathNode {
    return new ConstantNode(value);
  }
  function sym(name: string): MathNode {
    return new SymbolNode(name);
  }
  function add(a: MathNode, b: MathNode): MathNode {
    return new OperatorNode("+", "add", [a, b]);
  }
  function sub(a: MathNode, b: MathNode): MathNode {
    return new OperatorNode("-", "subtract", [a, b]);
  }
  function mul(a: MathNode, b: MathNode): MathNode {
    return new OperatorNode("*", "multiply", [a, b]);
  }
  function div(a: MathNode, b: MathNode): MathNode {
    return new OperatorNode("/", "divide", [a, b]);
  }
  function pow(base: MathNode, exp: MathNode): MathNode {
    return new OperatorNode("^", "pow", [base, exp]);
  }
  function neg(a: MathNode): MathNode {
    return new OperatorNode("-", "unaryMinus", [a]);
  }
  function fn(name: string, args: MathNode[]): MathNode {
    return new FunctionNode(new SymbolNode(name), args);
  }

  /**
   * Core recursive integration. Walks the AST and applies rules.
   * Throws if the expression cannot be integrated symbolically.
   */
  function integrate(node: MathNode, v: string): MathNode {
    // ── Constant ──
    if (isConst(node, v)) {
      return mul(node.clone(), sym(v));
    }

    // ── Bare variable: x → x^2 / 2 ──
    if (isSymbolNode(node) && (node as SymbolNode).name === v) {
      return div(pow(sym(v), cn(2)), cn(2));
    }

    // ── Parenthesis: strip and recurse ──
    if (isParenthesisNode(node)) {
      return integrate((node as ParenthesisNode).content, v);
    }

    // ── Operators ──
    if (isOperatorNode(node)) {
      const op = node as OperatorNode;

      // Sum / difference: ∫(f ± g) = ∫f ± ∫g
      if ((op.fn === "add" || op.fn === "subtract") && op.args.length === 2) {
        const left = integrate(op.args[0], v);
        const right = integrate(op.args[1], v);
        return op.fn === "add" ? add(left, right) : sub(left, right);
      }

      // Unary minus: ∫(-f) = -∫f
      if (op.fn === "unaryMinus" && op.args.length === 1) {
        return neg(integrate(op.args[0], v));
      }

      // Multiplication: constant multiple or both constant
      if (op.fn === "multiply" && op.args.length === 2) {
        if (isConst(op.args[0], v)) {
          return mul(op.args[0].clone(), integrate(op.args[1], v));
        }
        if (isConst(op.args[1], v)) {
          return mul(op.args[1].clone(), integrate(op.args[0], v));
        }
        // Both depend on variable — not supported
        throw new Error(`Cannot compute integral of "${node.toString()}" with respect to "${v}"`);
      }

      // Division: constant divisor, or c / f(x) patterns
      if (op.fn === "divide" && op.args.length === 2) {
        // f(x) / c → (1/c) * ∫f(x)
        if (isConst(op.args[1], v)) {
          return div(integrate(op.args[0], v), op.args[1].clone());
        }
        // c / x → c * log(x)
        if (
          isConst(op.args[0], v) &&
          isSymbolNode(op.args[1]) &&
          (op.args[1] as SymbolNode).name === v
        ) {
          return mul(op.args[0].clone(), fn("log", [sym(v)]));
        }
        // 1 / f(x) where f(x) is linear → (1/a) * log(ax+b)
        if (isConst(op.args[0], v)) {
          const lin = extractLinear(op.args[1], v);
          if (lin && lin.a !== 0) {
            return mul(div(op.args[0].clone(), cn(lin.a)), fn("log", [op.args[1].clone()]));
          }
        }
        throw new Error(`Cannot compute integral of "${node.toString()}" with respect to "${v}"`);
      }

      // Power: x^n or f(x)^n patterns
      if (op.fn === "pow" && op.args.length === 2) {
        const base = op.args[0];
        const exponent = op.args[1];

        // c^x → c^x / log(c) (constant base, variable exponent)
        if (isConst(base, v) && !isConst(exponent, v)) {
          // Check if exponent is simply x
          if (isSymbolNode(exponent) && (exponent as SymbolNode).name === v) {
            return div(pow(base.clone(), sym(v)), fn("log", [base.clone()]));
          }
          // Linear exponent: c^(ax+b) → c^(ax+b) / (a * log(c))
          const lin = extractLinear(exponent, v);
          if (lin && lin.a !== 0) {
            return div(
              pow(base.clone(), exponent.clone()),
              mul(cn(lin.a), fn("log", [base.clone()])),
            );
          }
          throw new Error(`Cannot compute integral of "${node.toString()}" with respect to "${v}"`);
        }

        // x^n (variable base, constant exponent)
        if (!isConst(base, v) && isConst(exponent, v)) {
          const n = constValue(exponent);

          // x^n where n ≠ -1 → x^(n+1)/(n+1)
          // x^(-1) → log(x)
          if (isSymbolNode(base) && (base as SymbolNode).name === v) {
            if (n === -1) {
              return fn("log", [sym(v)]);
            }
            if (n !== null) {
              return div(pow(sym(v), cn(n + 1)), cn(n + 1));
            }
            // Non-numeric constant exponent: try symbolic
            return div(pow(sym(v), add(exponent.clone(), cn(1))), add(exponent.clone(), cn(1)));
          }

          // (ax+b)^n → (ax+b)^(n+1) / (a*(n+1))
          const lin = extractLinear(base, v);
          if (lin && lin.a !== 0) {
            if (n === -1) {
              return div(fn("log", [base.clone()]), cn(lin.a));
            }
            if (n !== null) {
              return div(pow(base.clone(), cn(n + 1)), cn(lin.a * (n + 1)));
            }
          }

          throw new Error(`Cannot compute integral of "${node.toString()}" with respect to "${v}"`);
        }

        // Both constant — handled by isConst check above
        // Both variable — not supported
        throw new Error(`Cannot compute integral of "${node.toString()}" with respect to "${v}"`);
      }
    }

    // ── Function nodes: trig, exp, log ──
    if (isFunctionNode(node)) {
      const fNode = node as FunctionNode;
      const name = fNode.fn && "name" in fNode.fn ? (fNode.fn as SymbolNode).name : "";
      const arg = fNode.args[0];

      // Linear substitution factor: if arg = ax+b, divide result by a
      const lin = extractLinear(arg, v);
      const chainDiv = lin && lin.a !== 1 ? lin.a : null;

      // Only proceed if arg is the variable or a linear expression in it
      if (!lin || lin.a === 0) {
        throw new Error(`Cannot compute integral of "${node.toString()}" with respect to "${v}"`);
      }

      let result: MathNode;
      switch (name) {
        case "sin":
          // ∫sin(u) = -cos(u)
          result = neg(fn("cos", [arg.clone()]));
          break;
        case "cos":
          // ∫cos(u) = sin(u)
          result = fn("sin", [arg.clone()]);
          break;
        case "tan":
          // ∫tan(u) = -log(cos(u))
          result = neg(fn("log", [fn("cos", [arg.clone()])]));
          break;
        case "sec":
          // ∫sec(u) = log(sec(u) + tan(u))
          result = fn("log", [add(fn("sec", [arg.clone()]), fn("tan", [arg.clone()]))]);
          break;
        case "csc":
          // ∫csc(u) = -log(csc(u) + cot(u))
          result = neg(fn("log", [add(fn("csc", [arg.clone()]), fn("cot", [arg.clone()]))]));
          break;
        case "cot":
          // ∫cot(u) = log(sin(u))
          result = fn("log", [fn("sin", [arg.clone()])]);
          break;
        case "exp":
          // ∫e^u = e^u
          result = fn("exp", [arg.clone()]);
          break;
        case "log":
          // ∫log(u) = u * log(u) - u
          result = sub(mul(arg.clone(), fn("log", [arg.clone()])), arg.clone());
          break;
        default:
          throw new Error(`Cannot compute integral of "${node.toString()}" with respect to "${v}"`);
      }

      // Apply linear substitution: divide by chain coefficient
      if (chainDiv !== null) {
        result = div(result, cn(chainDiv));
      }
      return result;
    }

    throw new Error(`Cannot compute integral of "${node.toString()}" with respect to "${v}"`);
  }

  // ── Public API ──

  return function computeIntegral(expr: string | MathNode, variable: string): MathNode {
    const node = typeof expr === "string" ? math.parse(expr) : expr;
    const result = integrate(node, variable);
    return math.simplify(result) as MathNode;
  };
}
