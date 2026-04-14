import { create, all, isSymbolNode, type SymbolNode } from "mathjs";
import { formatNumber } from "./formatter";

const math = create(all, {});

export interface LineResult {
  value: number | null;
  display: string;
  error: string | null;
  isAssignment: boolean;
}

/** A user-defined function carrying its source expression and parameter names. */
interface UserFunc {
  (...args: number[]): number;
  __expr: string;
  __params: string[];
}

function isUserFunc(fn: unknown): fn is UserFunc {
  return typeof fn === "function" && "__expr" in fn && "__params" in fn;
}

// --- derivative / derive / derivate ------------------------------------------
// Save a reference before overriding so the wrapper can fall back to it.
const origDerivative = math.derivative;

/** Compute the derivative of a UserFunc, returning a new callable UserFunc. */
function deriveUserFunc(fn: UserFunc): UserFunc {
  const derivNode = origDerivative(fn.__expr, fn.__params[0]);
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

/** Unified handler: accepts a UserFunc (returns UserFunc) or falls through to
 *  the original mathjs derivative (returns MathNode). */
const deriveImpl = (...args: unknown[]): unknown => {
  if (args.length >= 1 && isUserFunc(args[0])) return deriveUserFunc(args[0]);
  return (origDerivative as (...a: unknown[]) => unknown)(...args);
};

math.import(
  { derivative: deriveImpl, derive: deriveImpl, derivate: deriveImpl },
  { override: true },
);

// -----------------------------------------------------------------------------

/** Matches `identifier =` at line start; captures the variable name. Supports Unicode identifiers via \p{L}/\p{N}. */
const ASSIGNMENT_RE = /^\s*([\p{L}_][\p{L}\p{N}_]*)\s*=/u;
/** Matches lines that are comments (// or #), including indented ones. */
const COMMENT_RE = /^\s*(\/\/|#)/;
/** Variables injected by the engine — excluded from the "default to 1" logic. */
const BUILTIN_VARS = new Set(["prev", "sum", "average"]);
const mathNamespace = math as unknown as Record<string, unknown>;

/**
 * Evaluates an array of calculator lines and returns a result for each.
 * Lines are evaluated in order with shared scope — variables assigned on
 * line N are available on line N+1.
 *
 * @param lines - Raw input strings, one per calculator line.
 * @returns Array of {@link LineResult} objects in the same order as input.
 */
export function evaluateLines(lines: string[]): LineResult[] {
  const scope: Record<string, unknown> = {};
  const results: LineResult[] = [];
  let prevValue: number | null = null;
  const numericValues: number[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || COMMENT_RE.test(trimmed)) {
      results.push({
        value: null,
        display: "",
        error: null,
        isAssignment: false,
      });
      continue;
    }

    // Inject engine-managed variables into scope before each line.
    // prev is only available after at least one numeric result.
    // sum and average are only available after at least one numeric result.
    if (prevValue !== null) {
      scope.prev = prevValue;
    }
    if (numericValues.length > 0) {
      scope.sum = numericValues.reduce((a, b) => a + b, 0);
      scope.average = (scope.sum as number) / numericValues.length;
    }

    const isAssignment = ASSIGNMENT_RE.test(trimmed);

    // Block assignment to built-in functions (e.g. sqrt = 5).
    // Checking for "function" type distinguishes functions (sqrt, sin…)
    // from constants (pi, e…), which are allowed to be shadowed.
    if (isAssignment) {
      const match = trimmed.match(ASSIGNMENT_RE);
      if (match && typeof mathNamespace[match[1]] === "function") {
        results.push({
          value: null,
          display: "",
          error: `Cannot assign to built-in function "${match[1]}"`,
          isAssignment: false,
        });
        continue;
      }
    }

    try {
      const node = math.parse(trimmed);

      // Detect function assignments like f(x) = x^2.
      // node.type is a string discriminant on all mathjs AST nodes.
      const isFuncAssignment = node.type === "FunctionAssignmentNode";

      // Block function assignment to built-in functions (e.g. sin(x) = x).
      if (isFuncAssignment) {
        const funcName = (node as unknown as { name: string }).name;
        if (typeof mathNamespace[funcName] === "function") {
          results.push({
            value: null,
            display: "",
            error: `Cannot assign to built-in function "${funcName}"`,
            isAssignment: false,
          });
          continue;
        }
      }

      // For function assignments, collect parameter names so they aren't
      // defaulted to 1 — they're formal params, not free variables.
      const funcParams = isFuncAssignment
        ? new Set((node as unknown as { params: string[] }).params)
        : null;

      // Simplified function declaration: `name = expr` where expr has free
      // variables. e.g. "func = x^2 + 5" creates a callable function with
      // parameter x. Intercepted before default-to-1 and evaluate.
      if (node.type === "AssignmentNode" && !isFuncAssignment) {
        const assignNode = node as unknown as {
          object: SymbolNode;
          value: {
            filter: typeof node.filter;
            toString(): string;
            compile(): { evaluate(s: Record<string, unknown>): unknown };
          };
        };
        const varName = assignNode.object.name;

        const freeVars: string[] = [];
        const seen = new Set<string>();
        for (const n of assignNode.value.filter(isSymbolNode)) {
          const name = (n as SymbolNode).name;
          if (
            !seen.has(name) &&
            !(name in scope) &&
            !(name in mathNamespace) &&
            !BUILTIN_VARS.has(name)
          ) {
            freeVars.push(name);
            seen.add(name);
          }
        }

        if (freeVars.length > 0) {
          const exprStr = assignNode.value.toString();
          const compiled = assignNode.value.compile();

          scope[varName] = Object.assign(
            (...args: number[]): number => {
              const fnScope: Record<string, unknown> = { ...scope };
              freeVars.forEach((p, i) => {
                fnScope[p] = args[i];
              });
              return compiled.evaluate(fnScope) as number;
            },
            { __expr: exprStr, __params: freeVars },
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
      // BUILTIN_VARS are excluded because they're injected conditionally above.
      for (const n of node.filter(isSymbolNode)) {
        const sym = n as SymbolNode;
        const name = sym.name;
        if (
          !(name in scope) &&
          !(name in mathNamespace) &&
          !BUILTIN_VARS.has(name) &&
          !funcParams?.has(name)
        ) {
          scope[name] = 1;
        }
      }

      const result = node.evaluate(scope);

      // Attach metadata to mathjs function assignments (f(x) = x^2) so
      // they can be passed to derive/derivate/derivative later.
      if (isFuncAssignment && typeof result === "function") {
        const funcNode = node as unknown as { params: string[] };
        (result as unknown as Record<string, unknown>).__expr =
          (result as unknown as Record<string, unknown>).expr || "";
        (result as unknown as Record<string, unknown>).__params = [
          ...funcNode.params,
        ];
      }

      if (typeof result === "number") {
        prevValue = result;
        numericValues.push(result);
        results.push({
          value: result,
          display: formatNumber(result),
          error: null,
          isAssignment,
        });
        // mathjs may return BigNumber, Fraction, or Unit objects — coerce to number.
      } else if (
        typeof result === "object" &&
        result !== null &&
        "toNumber" in result
      ) {
        const num = Number(result);
        prevValue = num;
        numericValues.push(num);
        results.push({
          value: num,
          display: formatNumber(num),
          error: null,
          isAssignment,
        });
        // Symbolic result (e.g. derivative("x^2", "x") → "2 * x").
        // Display the symbolic expression as-is; no numeric value.
      } else if (
        typeof result === "object" &&
        result !== null &&
        "isNode" in result &&
        result.isNode === true
      ) {
        results.push({
          value: null,
          display: String(result),
          error: null,
          isAssignment,
        });
        // User-defined function: f(x) = x^2, func = x^2, or derivate(f).
        // Display the function's expression body.
      } else if (isUserFunc(result)) {
        results.push({
          value: null,
          display: result.__expr,
          error: null,
          isAssignment: isAssignment || isFuncAssignment,
        });
        // Bare function name (e.g. "sqrt") — show how many arguments it needs.
      } else if (typeof result === "function") {
        const name = result.name || "Function";
        const sigs = result.signatures;
        let minArgs = 1;
        if (sigs && typeof sigs === "object") {
          minArgs = Math.min(
            ...Object.keys(sigs).map((k) =>
              k === "" ? 0 : k.split(",").length,
            ),
          );
        }
        results.push({
          value: null,
          display: "",
          error: `${name} requires ${minArgs} ${minArgs === 1 ? "argument" : "arguments"}`,
          isAssignment: false,
        });
        // Catch-all for booleans, strings, or other mathjs result types.
      } else {
        results.push({
          value: null,
          display: result != null ? String(result) : "",
          error: null,
          isAssignment,
        });
      }
    } catch {
      // Silently discard parse/evaluation errors (e.g. incomplete "1 +")
      // so the user can keep typing without disruptive error states.
      results.push({
        value: null,
        display: "",
        error: null,
        isAssignment: false,
      });
    }
  }

  return results;
}
