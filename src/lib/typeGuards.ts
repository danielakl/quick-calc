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

/** mathjs FunctionNode (e.g. `sin(x)` or `derivate(f)`). */
export interface FnCallNode extends MathNode {
  type: "FunctionNode";
  fn: { name: string };
  args: MathNode[];
}

export function isFnCallNode(node: MathNode): node is FnCallNode {
  if (node.type !== "FunctionNode") return false;
  const fn = (node as unknown as Record<string, unknown>).fn;
  return (
    !!fn &&
    typeof fn === "object" &&
    typeof (fn as Record<string, unknown>).name === "string"
  );
}

/** mathjs BigNumber, Fraction, or Unit — numeric objects coercible via Number(). */
export function isCoercibleNumeric(
  value: unknown,
): value is { toNumber(): number } & object {
  return typeof value === "object" && value !== null && "toNumber" in value;
}
