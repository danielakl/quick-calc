import { create, all } from "mathjs";
import { formatNumber } from "./formatter";

const math = create(all, {});

export interface LineResult {
  value: number | null;
  display: string;
  error: string | null;
  isAssignment: boolean;
}

const ASSIGNMENT_RE = /^\s*([a-zA-Z_]\w*)\s*=/;
const COMMENT_RE = /^\s*(\/\/|#)/;

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

    try {
      const node = math.parse(trimmed);
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
