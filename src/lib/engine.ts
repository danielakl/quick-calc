import {
  create,
  all,
  isConstantNode,
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
  isFnCallNode,
  isMathNode,
  isCoercibleNumeric,
  type UserFunc,
  type FnCallNode,
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

// ─── Calculus support ────────────────────────────────────────────────────────
//
// Derivative and integral calls are intercepted at the AST level so that
// expressions like `derivate(x^2)` are handled symbolically — without this,
// mathjs would evaluate `x^2` first (x defaults to 1) and pass `1` to the
// handler.

const DERIVATIVE_FN_NAMES = new Set(["derivative", "derive", "derivate"]);
const INTEGRAL_FN_NAMES = new Set(["integral", "integrate", "antiderivative"]);
const CALCULUS_FN_NAMES = new Set([
  ...DERIVATIVE_FN_NAMES,
  ...INTEGRAL_FN_NAMES,
]);

function isCalculusFnCall(node: MathNode): node is FnCallNode {
  return isFnCallNode(node) && CALCULUS_FN_NAMES.has(node.fn.name);
}

/** Compute the derivative of a UserFunc, returning a new callable UserFunc. */
function deriveUserFunc(fn: UserFunc, varName?: string): UserFunc {
  const derivNode = math.derivative(fn.__expr, varName ?? fn.__params[0]);
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

/** Compute the integral of a UserFunc, returning a new callable UserFunc. */
function integrateUserFunc(fn: UserFunc, varName?: string): UserFunc {
  const integNode = mathIntegral(fn.__expr, varName ?? fn.__params[0]);
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

/** Names reserved in scope so the "default to 1" logic skips them.
 *  Real logic is in processCalculusCall (AST-level interception). */
const SCOPE_FUNCTIONS: Record<string, unknown> = Object.fromEntries(
  [...CALCULUS_FN_NAMES].map((name) => [name, true]),
);

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
  // Symbolic result (e.g. derivative node).
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

// ─── Calculus call processing ───────────────────────────────────────────────

/** Convert a symbolic calculus result to a number (if constant) or UserFunc. */
function convertCalculusResult(
  resultNode: MathNode,
  varName: string,
  scope: Record<string, unknown>,
): number | UserFunc {
  // Collect free variables in the result (exclude mathjs builtins/constants).
  const freeVars: string[] = [];
  const seen = new Set<string>();
  for (const n of resultNode.filter(isSymbolNode)) {
    const name = (n as SymbolNode).name;
    if (
      !seen.has(name) &&
      !(name in mathNamespace) &&
      !BUILTIN_VARS.has(name)
    ) {
      freeVars.push(name);
      seen.add(name);
    }
  }

  if (freeVars.length === 0) {
    // Constant result — evaluate to a number.
    return resultNode.compile().evaluate(scope) as number;
  }

  // Result has free variables — create a callable UserFunc.
  const expr = resultNode.toString();
  const compiled = resultNode.compile();
  const params = [varName];
  return Object.assign(
    (...args: number[]): number => {
      const s: Record<string, unknown> = { ...scope };
      params.forEach((p, i) => {
        s[p] = args[i];
      });
      return compiled.evaluate(s) as number;
    },
    { __expr: expr, __params: params },
  );
}

/**
 * Process a calculus function call from the parsed AST (before evaluation).
 * Handles both UserFunc arguments and inline expressions.
 * Throws descriptive errors for invalid usage.
 */
function processCalculusCall(
  node: FnCallNode,
  scope: Record<string, unknown>,
): unknown {
  const fnName = node.fn.name;
  const args = node.args;
  const isDerivativeFn = DERIVATIVE_FN_NAMES.has(fnName);

  if (args.length === 0 || args.length > 2) {
    throw new Error(`${fnName} requires 1 or 2 arguments`);
  }

  const firstArg = args[0];

  // Reject quoted string arguments with a helpful message.
  if (
    isConstantNode(firstArg) &&
    typeof (firstArg as { value: unknown }).value === "string"
  ) {
    throw new Error(`Quotes are not needed: use ${fnName}(expression) instead`);
  }

  // Get explicit variable from second argument (if provided).
  let explicitVar: string | null = null;
  if (args.length === 2) {
    if (!isSymbolNode(args[1])) {
      throw new Error(`Second argument to ${fnName} must be a variable name`);
    }
    explicitVar = (args[1] as SymbolNode).name;
  }

  // ── Case 1: First arg references a UserFunc in scope ──
  if (isSymbolNode(firstArg)) {
    const symName = (firstArg as SymbolNode).name;
    const scopeValue = scope[symName];
    if (isUserFunc(scopeValue)) {
      if (explicitVar) {
        return isDerivativeFn
          ? deriveUserFunc(scopeValue, explicitVar)
          : integrateUserFunc(scopeValue, explicitVar);
      }
      if (scopeValue.__params.length !== 1) {
        throw new Error(
          `${symName} has parameters (${scopeValue.__params.join(", ")}), specify variable: ${fnName}(${symName}, variable)`,
        );
      }
      return isDerivativeFn
        ? deriveUserFunc(scopeValue)
        : integrateUserFunc(scopeValue);
    }
  }

  // ── Case 2: Inline expression ──
  const exprNode = firstArg;

  if (explicitVar) {
    const resultNode = isDerivativeFn
      ? math.derivative(exprNode, explicitVar)
      : (mathIntegral(exprNode, explicitVar) as MathNode);
    return convertCalculusResult(resultNode, explicitVar, scope);
  }

  // Infer variable from free variables in the expression.
  const freeVars = collectFreeVars(exprNode, scope);
  if (freeVars.length === 0) {
    throw new Error(
      `No variables in expression, specify variable: ${fnName}(expression, variable)`,
    );
  }
  if (freeVars.length > 1) {
    throw new Error(
      `Multiple variables (${freeVars.join(", ")}), specify variable: ${fnName}(expression, variable)`,
    );
  }

  const varName = freeVars[0];
  const resultNode = isDerivativeFn
    ? math.derivative(exprNode, varName)
    : (mathIntegral(exprNode, varName) as MathNode);
  return convertCalculusResult(resultNode, varName, scope);
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

      // ── Calculus function calls ──
      // Intercepted at the AST level so inline expressions (e.g. derivate(x^2))
      // are handled symbolically instead of being evaluated first.
      if (
        isCalculusFnCall(node) ||
        (isAssignNode(node) && isCalculusFnCall(node.value))
      ) {
        try {
          let result: unknown;
          let calcIsAssignment = false;
          if (isAssignNode(node) && isCalculusFnCall(node.value)) {
            result = processCalculusCall(node.value, scope);
            scope[node.object.name] = result;
            calcIsAssignment = true;
          } else {
            result = processCalculusCall(node as FnCallNode, scope);
          }
          const lineResult = mapResult(
            result,
            calcIsAssignment || isAssignment,
            false,
          );
          if (lineResult.value !== null) {
            prevValue = lineResult.value;
            numericValues.push(lineResult.value);
          }
          results.push(lineResult);
        } catch (e) {
          results.push(errorResult(e instanceof Error ? e.message : String(e)));
        }
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
