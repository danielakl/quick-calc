import {
  create,
  all,
  isSymbolNode,
  type SymbolNode,
  type MathNode,
} from "mathjs";
import { formatNumber } from "./formatter";
import { createIntegral } from "./integral";
import {
  isUserFunc,
  isFuncAssignNode,
  isAssignNode,
  isMathNode,
  isCoercibleNumeric,
  type UserFunc,
} from "./typeGuards";

const math = create(all, {});
const mathIntegral = createIntegral(math);

// ─── Public types ────────────────────────────────────────────────────────────

export interface LineResult {
  value: number | null;
  display: string;
  error: string | null;
  isAssignment: boolean;
}

// ─── Derivative support ──────────────────────────────────────────────────────

/** Compute the derivative of a UserFunc, returning a new callable UserFunc. */
function deriveUserFunc(fn: UserFunc): UserFunc {
  const derivNode = math.derivative(fn.__expr, fn.__params[0]);
  const derivExpr = derivNode.toString();
  const compiled = derivNode.compile();
  const params = [...fn.__params];

  return Object.assign(
    (...args: number[]): number => {
      const s: Record<string, unknown> = {};
      params.forEach((p, i) => {
        s[p] = args[i];
      });
      return compiled.evaluate(s) as number;
    },
    { __expr: derivExpr, __params: params },
  );
}

/** Accepts a UserFunc (returns UserFunc) or falls through to the original
 *  mathjs derivative (returns MathNode). Registered as derivative/derive/derivate
 *  via scope injection — the mathjs instance itself is never modified. */
function derivativeHandler(...args: unknown[]): unknown {
  if (args.length >= 1 && isUserFunc(args[0])) return deriveUserFunc(args[0]);
  return (math.derivative as (...a: unknown[]) => unknown)(...args);
}

// ─── Integral support ───────────────────────────────────────────────────────

/** Compute the integral of a UserFunc, returning a new callable UserFunc. */
function integrateUserFunc(fn: UserFunc): UserFunc {
  const integNode = mathIntegral(fn.__expr, fn.__params[0]);
  const integExpr = integNode.toString();
  const compiled = integNode.compile();
  const params = [...fn.__params];

  return Object.assign(
    (...args: number[]): number => {
      const s: Record<string, unknown> = {};
      params.forEach((p, i) => {
        s[p] = args[i];
      });
      return compiled.evaluate(s) as number;
    },
    { __expr: integExpr, __params: params },
  );
}

/** Accepts a UserFunc (returns UserFunc) or falls through to the symbolic
 *  integral (returns MathNode). Registered as integral/integrate/antiderivative
 *  via scope injection. */
function integralHandler(...args: unknown[]): unknown {
  if (args.length >= 1 && isUserFunc(args[0]))
    return integrateUserFunc(args[0]);
  return mathIntegral(...(args as [string, string]));
}

/** Custom functions injected into every evaluation scope. */
const SCOPE_FUNCTIONS: Record<string, unknown> = {
  derivative: derivativeHandler,
  derive: derivativeHandler,
  derivate: derivativeHandler,
  integral: integralHandler,
  integrate: integralHandler,
  antiderivative: integralHandler,
};

// ─── Constants ───────────────────────────────────────────────────────────────

/** Matches `identifier =` at line start; captures the variable name.
 *  Supports Unicode identifiers via \\p{L}/\\p{N}. */
const ASSIGNMENT_RE = /^\s*([\p{L}_][\p{L}\p{N}_]*)\s*=/u;
/** Matches lines that are comments (// or #), including indented ones. */
const COMMENT_RE = /^\s*(\/\/|#)/;
/** Variables injected by the engine — excluded from the "default to 1" logic. */
const BUILTIN_VARS = new Set(["prev", "sum", "average"]);
const mathNamespace = math as unknown as Record<string, unknown>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function emptyResult(): LineResult {
  return { value: null, display: "", error: null, isAssignment: false };
}

function errorResult(error: string): LineResult {
  return { value: null, display: "", error, isAssignment: false };
}

/** Check whether a name belongs to a built-in mathjs function (not a constant). */
function isBuiltinFunction(name: string): boolean {
  return typeof mathNamespace[name] === "function";
}

/** Collect unique free variables from a node — symbols not in scope, not in
 *  the mathjs namespace, and not engine builtins. */
function collectFreeVars(
  node: MathNode,
  scope: Record<string, unknown>,
  exclude?: Set<string>,
): string[] {
  const freeVars: string[] = [];
  const seen = new Set<string>();
  for (const n of node.filter(isSymbolNode)) {
    const name = (n as SymbolNode).name;
    if (
      !seen.has(name) &&
      !(name in scope) &&
      !(name in mathNamespace) &&
      !BUILTIN_VARS.has(name) &&
      !exclude?.has(name)
    ) {
      freeVars.push(name);
      seen.add(name);
    }
  }
  return freeVars;
}

/** Create a UserFunc from a compiled expression, parameter list, and
 *  the surrounding evaluation scope (captured by reference for later calls). */
function createUserFunc(
  exprStr: string,
  params: string[],
  compiled: ReturnType<MathNode["compile"]>,
  scope: Record<string, unknown>,
): UserFunc {
  return Object.assign(
    (...args: number[]): number => {
      const fnScope: Record<string, unknown> = { ...scope };
      params.forEach((p, i) => {
        fnScope[p] = args[i];
      });
      return compiled.evaluate(fnScope) as number;
    },
    { __expr: exprStr, __params: params },
  );
}

/** Map an evaluation result to a LineResult. */
function mapResult(
  result: unknown,
  isAssignment: boolean,
  isFuncAssign: boolean,
): LineResult {
  // Plain number — most common path.
  if (typeof result === "number") {
    return {
      value: result,
      display: formatNumber(result),
      error: null,
      isAssignment,
    };
  }
  // mathjs BigNumber, Fraction, or Unit — coerce to plain number.
  if (isCoercibleNumeric(result)) {
    const num = Number(result);
    return {
      value: num,
      display: formatNumber(num),
      error: null,
      isAssignment,
    };
  }
  // Symbolic result (e.g. derivative("x^2", "x") → "2 * x").
  if (isMathNode(result)) {
    return {
      value: null,
      display: String(result),
      error: null,
      isAssignment,
    };
  }
  // User-defined function: f(x) = x^2, func = x^2, or derivate(f).
  if (isUserFunc(result)) {
    return {
      value: null,
      display: result.__expr,
      error: null,
      isAssignment: isAssignment || isFuncAssign,
    };
  }
  // Bare built-in function name (e.g. "sqrt") — show required arg count.
  if (typeof result === "function") {
    const name = (result as { name?: string }).name || "Function";
    const sigs = (result as { signatures?: Record<string, unknown> })
      .signatures;
    let minArgs = 1;
    if (sigs && typeof sigs === "object") {
      minArgs = Math.min(
        ...Object.keys(sigs).map((k) => (k === "" ? 0 : k.split(",").length)),
      );
    }
    return errorResult(
      `${name} requires ${minArgs} ${minArgs === 1 ? "argument" : "arguments"}`,
    );
  }
  // Catch-all for booleans, strings, or other mathjs result types.
  return {
    value: null,
    display: result != null ? String(result) : "",
    error: null,
    isAssignment,
  };
}

// ─── Main evaluation ─────────────────────────────────────────────────────────

/**
 * Evaluates an array of calculator lines and returns a result for each.
 * Lines are evaluated in order with shared scope — variables assigned on
 * line N are available on line N+1.
 *
 * @param lines - Raw input strings, one per calculator line.
 * @returns Array of {@link LineResult} objects in the same order as input.
 */
export function evaluateLines(lines: string[]): LineResult[] {
  const scope: Record<string, unknown> = { ...SCOPE_FUNCTIONS };
  const results: LineResult[] = [];
  let prevValue: number | null = null;
  const numericValues: number[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments.
    if (!trimmed || COMMENT_RE.test(trimmed)) {
      results.push(emptyResult());
      continue;
    }

    // Inject engine-managed variables.
    // prev is only available after at least one numeric result.
    // sum and average are only available after at least one numeric result.
    if (prevValue !== null) scope.prev = prevValue;
    if (numericValues.length > 0) {
      scope.sum = numericValues.reduce((a, b) => a + b, 0);
      scope.average = (scope.sum as number) / numericValues.length;
    }

    // Guard variable assignment to built-in functions (e.g. sqrt = 5).
    // Checking for "function" distinguishes functions (sqrt, sin…) from
    // constants (pi, e…), which are allowed to be shadowed.
    const isAssignment = ASSIGNMENT_RE.test(trimmed);
    if (isAssignment) {
      const match = trimmed.match(ASSIGNMENT_RE);
      if (match && isBuiltinFunction(match[1])) {
        results.push(
          errorResult(`Cannot assign to built-in function "${match[1]}"`),
        );
        continue;
      }
    }

    try {
      const node = math.parse(trimmed);

      // Guard function assignment to built-in functions (e.g. sin(x) = x).
      if (isFuncAssignNode(node) && isBuiltinFunction(node.name)) {
        results.push(
          errorResult(`Cannot assign to built-in function "${node.name}"`),
        );
        continue;
      }

      // Simplified function declaration: `name = expr` where expr has free
      // variables. e.g. "func = x^2 + 5" creates a callable function with
      // parameter x. Intercepted before default-to-1 and evaluate.
      if (isAssignNode(node)) {
        const freeVars = collectFreeVars(node.value, scope);
        if (freeVars.length > 0) {
          const exprStr = node.value.toString();
          scope[node.object.name] = createUserFunc(
            exprStr,
            freeVars,
            node.value.compile(),
            scope,
          );
          results.push({
            value: null,
            display: exprStr,
            error: null,
            isAssignment: true,
          });
          continue;
        }
      }

      // Default undefined variables to 1 so bare names (e.g. "Alice", "Bob")
      // can be used as presence counters — each name contributes 1 to sum.
      const excludeParams = isFuncAssignNode(node)
        ? new Set(node.params)
        : undefined;
      for (const name of collectFreeVars(node, scope, excludeParams)) {
        scope[name] = 1;
      }

      const result = node.evaluate(scope);

      // Attach UserFunc metadata to mathjs function assignments so they
      // can be passed to derive/derivate/derivative later.
      if (isFuncAssignNode(node) && typeof result === "function") {
        const fn = result as unknown as Record<string, unknown>;
        fn.__expr = fn.expr ?? "";
        fn.__params = [...node.params];
      }

      const lineResult = mapResult(
        result,
        isAssignment,
        isFuncAssignNode(node),
      );

      // Track numeric values for prev/sum/average.
      if (lineResult.value !== null) {
        prevValue = lineResult.value;
        numericValues.push(lineResult.value);
      }

      results.push(lineResult);
    } catch {
      // Silently discard parse/evaluation errors (e.g. incomplete "1 +")
      // so the user can keep typing without disruptive error states.
      results.push(emptyResult());
    }
  }

  return results;
}
