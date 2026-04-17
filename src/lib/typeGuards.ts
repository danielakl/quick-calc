import type { MathNode, SymbolNode } from "mathjs";

/**
 * A user-defined function carrying its source expression and parameter names.
 * Uses a callable interface (call signature + properties):
 * @see https://www.typescriptlang.org/docs/handbook/2/functions.html#call-signatures
 *
 * `__expr`   — the symbolic source expression (e.g. `"x ^ 2 + 1"`)
 * `__params` — ordered parameter names (e.g. `["x"]`)
 *
 * The `__` prefix marks these as engine-internal metadata to avoid
 * collisions with built-in function properties (`name`, `length`, etc.).
 */
export interface UserFunc {
  /** Callable: accepts numeric arguments and returns a numeric result. */
  (...args: number[]): number;
  __expr: string;
  __params: string[];
}

/**
 * Type guard — narrows `value` to {@link UserFunc} if it is a function
 * with `__expr` and `__params` metadata.
 * @see https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates
 */
export function isUserFunc(value: unknown): value is UserFunc {
  return (
    typeof value === "function" && "__expr" in value && "__params" in value
  );
}

/**
 * mathjs FunctionAssignmentNode.
 * @example f(x) = x^2
 */
export interface FuncAssignNode extends MathNode {
  type: "FunctionAssignmentNode";
  name: string;
  params: string[];
}

/** Type guard — narrows `node` to {@link FuncAssignNode}. */
export function isFuncAssignNode(node: MathNode): node is FuncAssignNode {
  return node.type === "FunctionAssignmentNode";
}

/**
 * mathjs AssignmentNode.
 * @example x = 5
 * @example func = x^2
 */
export interface AssignNode extends MathNode {
  type: "AssignmentNode";
  object: SymbolNode;
  value: MathNode;
}

/** Type guard — narrows `node` to {@link AssignNode}. */
export function isAssignNode(node: MathNode): node is AssignNode {
  return node.type === "AssignmentNode";
}

/** Type guard — narrows `value` to {@link MathNode} (any mathjs AST node). */
export function isMathNode(value: unknown): value is MathNode {
  return (
    typeof value === "object" &&
    value !== null &&
    "isNode" in value &&
    (value as { isNode: unknown }).isNode === true
  );
}

/**
 * mathjs FunctionNode.
 * @example sin(x)
 * @example derivate(f)
 */
export interface FnCallNode extends MathNode {
  type: "FunctionNode";
  fn: { name: string };
  args: MathNode[];
}

/** Type guard — narrows `node` to {@link FnCallNode}. */
export function isFnCallNode(node: MathNode): node is FnCallNode {
  if (node.type !== "FunctionNode") return false;
  const fn = (node as unknown as Record<string, unknown>).fn;
  return (
    !!fn &&
    typeof fn === "object" &&
    typeof (fn as Record<string, unknown>).name === "string"
  );
}

/** Type guard — narrows `value` to a mathjs BigNumber, Fraction, or Unit (numeric objects coercible via `toNumber()`). */
export function isCoercibleNumeric(
  value: unknown,
): value is { toNumber(): number } & object {
  return typeof value === "object" && value !== null && "toNumber" in value;
}
