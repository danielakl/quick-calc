import {
  create,
  all,
  isConstantNode,
  isSymbolNode,
  isUnit,
  type SymbolNode,
  type MathNode,
} from "mathjs";
import { CurrencyCode } from "./currencies";
import { formatNumber, formatUnit, extractUnitMagnitude } from "./formatter";
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
import { sanitize } from "./utils/sanitizeString";
import { isEmpty } from "./utils/stringUtils";

const math = create(all, {});
const mathIntegral = createIntegral(math);

// ─── Currency unit registration ──────────────────────────────────────────────
// Currencies are registered as mathjs units anchored to USD (baseName "currency")
// so the existing units pipeline (`to`/`as`, formatters) handles them with no
// special-casing. Re-registration uses `override: true` so rate updates take
// effect immediately.

let currencyBaseRegistered = false;

/**
 * Register or update mathjs currency units from a USD-per-1-unit map.
 * Each currency is registered with a lowercase alias (so `100 nok to usd`
 * works as well as `100 NOK to USD`). Codes that conflict with built-in
 * mathjs units are skipped silently.
 *
 * Uses mathjs's documented createUnit API
 * (https://mathjs.org/docs/datatypes/units.html#user-defined-units) directly.
 */
export function registerCurrencyUnits(usdPerUnit: Map<CurrencyCode, number>): void {
  if (!currencyBaseRegistered) {
    try {
      math.createUnit("USD", {
        baseName: "currency",
        prefixes: "none",
        aliases: ["usd"],
      });
      currencyBaseRegistered = true;
    } catch (e) {
      // USD already exists as a non-currency unit (extremely unlikely) — skip.
      console.warn(`Failed when registering currency units - ${e}`);
      return;
    }
  }

  for (const [code, usdAmount] of usdPerUnit) {
    if (code === CurrencyCode.USD) {
      continue;
    }

    if (!Number.isFinite(usdAmount) || usdAmount <= 0) {
      console.warn(`Skipping '${code}' registration. Invalid rate '$${usdAmount}'`);
      continue;
    }

    try {
      // mathjs ignores `aliases` when passed on the third (options) argument,
      // so the alias has to live in the definition object.
      math.createUnit(
        code,
        { definition: `${usdAmount} USD`, aliases: [code.toLowerCase()] },
        { override: true },
      );
    } catch (e) {
      // Conflicts with a built-in mathjs unit name — skip this code.
      console.warn(`Failed to register '${code}' - ${e}`);
    }
  }
}

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
const CALCULUS_FN_NAMES = new Set([...DERIVATIVE_FN_NAMES, ...INTEGRAL_FN_NAMES]);

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
/** Engine-injected variables referenced by name during free-var analysis. */
const BUILTIN_VARS = new Set(["prev", "sum", "average"]);
/** Identifier names rejected as assignment targets. The calculus and free-var
 *  function-assignment branches write directly to the scope object, bypassing
 *  mathjs's own scope-write guard — so we block these names ourselves to avoid
 *  polluting the local scope's prototype chain (e.g. `__proto__ = derivate(x^2)`
 *  setting scope's prototype to a UserFunc). */
const RESERVED_ASSIGNMENT_NAMES = new Set(["__proto__", "constructor", "prototype"]);
/** Trailing "to %" / "as %" / "to percent" / "as percent" conversion. */
const PERCENT_CONVERT_RE = /^(.+?)\s+(?:to|as)\s+(?:%|percent)\s*$/i;
/** Trailing "<expr> to|as <unitName>" — captures the LHS and target unit identifier.
 *  Used to detect the case where LHS is a plain number and the target is a unit
 *  literal (e.g. `150 as usd`), so we can rewrite it to `(LHS) unitName`. */
const UNIT_APPLY_RE = /^(.+?)\s+(?:to|as)\s+([\p{L}][\p{L}\p{N}_]*)\s*$/u;
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

const UnitCtor = math.Unit as unknown as {
  isValuelessUnit(name: string): boolean;
};

/** Check whether a name is a recognized mathjs unit (e.g. "cm", "m", "sec"). */
function isUnitName(name: string): boolean {
  return UnitCtor.isValuelessUnit(name);
}

/** Collect unique free variables from a node — symbols not in scope, not in
 *  the mathjs namespace, not engine builtins, and not mathjs unit names. */
function collectFreeVars(
  node: MathNode,
  scope: Record<string, unknown>,
  exclude?: Set<string>,
): string[] {
  const freeVars: string[] = [];
  const seen = new Set<string>();
  const symbolNodes: SymbolNode[] = node.filter(isSymbolNode).map((n) => n as SymbolNode);
  for (const n of symbolNodes) {
    const name = n.name;
    if (
      !seen.has(name) &&
      !(name in scope) &&
      !(name in mathNamespace) &&
      !BUILTIN_VARS.has(name) &&
      !isUnitName(name) &&
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
function mapResult(result: unknown, isAssignment: boolean, isFuncAssign: boolean): LineResult {
  // Plain number — most common path.
  if (typeof result === "number") {
    return {
      value: result,
      display: formatNumber(result),
      error: null,
      isAssignment,
    };
  }
  // mathjs Unit — preserve the unit in the display string.
  if (isUnit(result)) {
    return {
      value: extractUnitMagnitude(result),
      display: formatUnit(result),
      error: null,
      isAssignment,
    };
  }
  // mathjs BigNumber or Fraction — coerce to plain number.
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
    const sigs = (result as { signatures?: Record<string, unknown> }).signatures;
    let minArgs = 1;
    if (sigs && typeof sigs === "object") {
      minArgs = Math.min(...Object.keys(sigs).map((k) => (k === "" ? 0 : k.split(",").length)));
    }
    return errorResult(`${name} requires ${minArgs} ${minArgs === 1 ? "argument" : "arguments"}`);
  }
  // Booleans render as their literal form. The numeric coercion (`true → 1`,
  // `false → 0`) lets comparison results feed `prev` / `sum` / `average`.
  if (typeof result === "boolean") {
    return {
      value: result ? 1 : 0,
      display: result ? "true" : "false",
      error: null,
      isAssignment,
    };
  }
  // Catch-all for strings, complex numbers, arrays, or other mathjs result
  // types. These render as `String(result)` but do not contribute to numeric
  // running totals.
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
    if (!seen.has(name) && !(name in mathNamespace) && !BUILTIN_VARS.has(name)) {
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
function processCalculusCall(node: FnCallNode, scope: Record<string, unknown>): unknown {
  const fnName = node.fn.name;
  const args = node.args;
  const isDerivativeFn = DERIVATIVE_FN_NAMES.has(fnName);

  if (args.length === 0 || args.length > 2) {
    throw new Error(`${fnName} requires 1 or 2 arguments`);
  }

  const firstArg = args[0];

  // Reject quoted string arguments with a helpful message.
  if (isConstantNode(firstArg) && typeof (firstArg as { value: unknown }).value === "string") {
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
      return isDerivativeFn ? deriveUserFunc(scopeValue) : integrateUserFunc(scopeValue);
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
 * Evaluates calculator text and returns a result for each line.
 * Lines are evaluated in order with shared scope — variables assigned on
 * line N are available on line N+1.
 *
 * @param text - Raw text input, can be a list of strings or a string with new lines characters.
 * @returns Array of {@link LineResult} objects in the same order as input lines.
 */
export function evaluate(...text: [string[]] | string[]): LineResult[] {
  const textArray: string[] =
    text.length === 1 && Array.isArray(text[0]) ? text[0] : (text as string[]);
  const sanitized: string[] = textArray.map((t) => sanitize(t) ?? "");
  const lines: string[] = sanitized
    .map((s) => s.split("\n"))
    .flatMap((s) => s)
    .map((l) => l.trim());

  const scope: Record<string, unknown> = { ...SCOPE_FUNCTIONS };
  const results: LineResult[] = [];
  let prevValue: number | null = null;
  const numericValues: number[] = [];

  for (const line of lines) {
    // Skip empty lines and comments.
    if (isEmpty(line) || COMMENT_RE.test(line)) {
      results.push(emptyResult());
      continue;
    }

    // Preprocess: capture trailing percent conversion, translate `as` into
    // mathjs's `to` conversion keyword, and rewrite `sec`/`min` (which mathjs
    // parses as the secant/minimum functions) to their full unit names when
    // not followed by `(`. This lets users write "600 sec to min" naturally.
    const pctMatch = line.match(PERCENT_CONVERT_RE);
    const isPercentConvert = !!pctMatch;
    let processed = (pctMatch ? pctMatch[1] : line)
      .replace(/\s+as\s+/g, " to ")
      .replace(/\bsec\b(?!\s*\()/g, "seconds")
      .replace(/\bmin\b(?!\s*\()/g, "minutes")
      .replace(/\binfinity\b/gi, "Infinity");

    // mathjs's `to` operator requires a Unit on the LHS — `150 to usd` errors
    // because 150 is a plain number. If the LHS evaluates to a number and the
    // RHS is a known unit, rewrite as a unit literal: `(150) usd`. Probing the
    // LHS via math.evaluate is safe because the regex excludes assignments
    // (those are handled separately upstream) and arithmetic evaluation has no
    // side effects.
    const unitApplyMatch = processed.match(UNIT_APPLY_RE);
    if (unitApplyMatch && isUnitName(unitApplyMatch[2])) {
      // Inject prev/sum/average so probing expressions that reference them works.
      const probeScope: Record<string, unknown> = { ...scope };
      if (prevValue !== null) {
        probeScope.prev = prevValue;
      }
      if (numericValues.length > 0) {
        probeScope.sum = numericValues.reduce((total, value) => total + value, 0);
        probeScope.average = (probeScope.sum as number) / numericValues.length;
      }
      try {
        const lhsValue = math.evaluate(unitApplyMatch[1], probeScope);
        if (typeof lhsValue === "number") {
          processed = `(${unitApplyMatch[1]}) ${unitApplyMatch[2]}`;
        }
      } catch {
        // LHS doesn't evaluate cleanly — leave the original processed string;
        // mathjs will surface its own error if the conversion is invalid.
      }
    }

    // Inject engine-managed variables.
    // prev is only available after at least one numeric result.
    // sum and average are only available after at least one numeric result.
    if (prevValue !== null) {
      scope.prev = prevValue;
    }
    if (numericValues.length > 0) {
      scope.sum = numericValues.reduce((a, b) => a + b, 0);
      scope.average = (scope.sum as number) / numericValues.length;
    }

    // Guard variable assignment to built-in functions (e.g. sqrt = 5).
    // Checking for "function" distinguishes functions (sqrt, sin…) from
    // constants (pi, e…), which are allowed to be shadowed.
    const isAssignment = ASSIGNMENT_RE.test(line);
    if (isAssignment) {
      const match = line.match(ASSIGNMENT_RE);
      if (match && isBuiltinFunction(match[1])) {
        results.push(errorResult(`Cannot assign to built-in function "${match[1]}"`));
        continue;
      }
    }

    const applyPercent = (r: LineResult): LineResult => {
      if (!isPercentConvert || r.value === null) {
        return r;
      }
      const pct = r.value * 100;
      return { ...r, value: pct, display: `${formatNumber(pct)}%` };
    };

    try {
      const node = math.parse(processed);

      // Guard function assignment to built-in functions (e.g. sin(x) = x).
      if (isFuncAssignNode(node) && isBuiltinFunction(node.name)) {
        results.push(errorResult(`Cannot assign to built-in function "${node.name}"`));
        continue;
      }

      // ── Calculus function calls ──
      // Intercepted at the AST level so inline expressions (e.g. derivate(x^2))
      // are handled symbolically instead of being evaluated first.
      if (isCalculusFnCall(node) || (isAssignNode(node) && isCalculusFnCall(node.value))) {
        try {
          let result: unknown;
          let calcIsAssignment = false;
          if (isAssignNode(node) && isCalculusFnCall(node.value)) {
            if (RESERVED_ASSIGNMENT_NAMES.has(node.object.name)) {
              results.push(errorResult(`Cannot assign to reserved name "${node.object.name}"`));
              continue;
            }
            result = processCalculusCall(node.value, scope);
            scope[node.object.name] = result;
            calcIsAssignment = true;
          } else {
            result = processCalculusCall(node as FnCallNode, scope);
          }
          const lineResult = applyPercent(
            mapResult(result, calcIsAssignment || isAssignment, false),
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
      // parameter x.
      if (isAssignNode(node)) {
        const freeVars = collectFreeVars(node.value, scope);
        if (freeVars.length > 0) {
          if (RESERVED_ASSIGNMENT_NAMES.has(node.object.name)) {
            results.push(errorResult(`Cannot assign to reserved name "${node.object.name}"`));
            continue;
          }
          const exprStr = node.value.toString();
          scope[node.object.name] = createUserFunc(exprStr, freeVars, node.value.compile(), scope);
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

      const lineResult = applyPercent(mapResult(result, isAssignment, isFuncAssignNode(node)));

      // Track numeric values for prev/sum/average.
      if (lineResult.value !== null) {
        prevValue = lineResult.value;
        numericValues.push(lineResult.value);
      }

      results.push(lineResult);
    } catch (e) {
      // Surface unit-related errors (mismatches, conversions). Parse errors
      // from incomplete input and undefined-symbol errors stay silent so the
      // user can keep typing without disruptive error states.
      const msg = e instanceof Error ? e.message : String(e);
      if (/unit/i.test(msg)) {
        results.push(errorResult(msg));
      } else {
        results.push(emptyResult());
      }
    }
  }

  return results;
}
