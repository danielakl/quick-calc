import { create, all, isSymbolNode, type SymbolNode } from "mathjs";
import { formatNumber } from "./formatter";

const math = create(all, {});

export interface LineResult {
  value: number | null;
  display: string;
  error: string | null;
  isAssignment: boolean;
}

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

      // Default undefined variables to 1 so bare names (e.g. "Alice", "Bob")
      // can be used as presence counters — each name contributes 1 to sum.
      // BUILTIN_VARS are excluded because they're injected conditionally above.
      for (const n of node.filter(isSymbolNode)) {
        const sym = n as SymbolNode;
        const name = sym.name;
        if (
          !(name in scope) &&
          !(name in mathNamespace) &&
          !BUILTIN_VARS.has(name)
        ) {
          scope[name] = 1;
        }
      }

      const result = node.evaluate(scope);

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
