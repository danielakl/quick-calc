import type { MathNode, SymbolNode } from "mathjs";

/** A user-defined function carrying its source expression and parameter names. */
export interface UserFunc {
  (...args: number[]): number;
  __expr: string;
  __params: string[];
}

export function isUserFunc(value: unknown): value is UserFunc {
  return (
    typeof value === "function" && "__expr" in value && "__params" in value
  );
}

/** mathjs FunctionAssignmentNode (e.g. `f(x) = x^2`). */
export interface FuncAssignNode extends MathNode {
  type: "FunctionAssignmentNode";
  name: string;
  params: string[];
}

export function isFuncAssignNode(node: MathNode): node is FuncAssignNode {
  return node.type === "FunctionAssignmentNode";
}

/** mathjs AssignmentNode (e.g. `x = 5` or `func = x^2`). */
export interface AssignNode extends MathNode {
  type: "AssignmentNode";
  object: SymbolNode;
  value: MathNode;
}

export function isAssignNode(node: MathNode): node is AssignNode {
  return node.type === "AssignmentNode";
}

/** mathjs symbolic result node (e.g. derivative output). */
export function isMathNode(value: unknown): value is MathNode {
  return (
    typeof value === "object" &&
    value !== null &&
    "isNode" in value &&
    (value as { isNode: unknown }).isNode === true
  );
}

/** mathjs BigNumber, Fraction, or Unit — numeric objects coercible via Number(). */
export function isCoercibleNumeric(
  value: unknown,
): value is { toNumber(): number } & object {
  return typeof value === "object" && value !== null && "toNumber" in value;
}
