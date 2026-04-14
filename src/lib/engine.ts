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

    // Inject special variables
    if (prevValue !== null) {
      scope.prev = prevValue;
    }
    if (numericValues.length > 0) {
      scope.sum = numericValues.reduce((a, b) => a + b, 0);
      scope.average = (scope.sum as number) / numericValues.length;
    }

    const isAssignment = ASSIGNMENT_RE.test(trimmed);

    // Block assignment to built-in functions (e.g. sqrt = 5)
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

      // Default undefined variables to 1
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
      } else {
        results.push({
          value: null,
          display: result != null ? String(result) : "",
          error: null,
          isAssignment,
        });
      }
    } catch {
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
