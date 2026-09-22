/**
 * expression.ts — the `visibleWhen` condition language (R31, analysis §9 risk 5).
 *
 * A hand-written recursive-descent parser: no `Function`, no `eval`, no property access
 * beyond the three roots below. Grammar:
 *
 *   or      := and ("||" and)*
 *   and     := unary ("&&" unary)*
 *   unary   := "!" unary | compare
 *   compare := primary (("==" | "!=" | "<" | "<=" | ">" | ">=") primary)?
 *   primary := number | string | true | false | null | "(" or ")"
 *            | "variables." name | "selection.count(" string? ")" | "mode"
 */

import type { DashboardSpecError } from "./spec";
import type { VariableValue } from "./spec";

/** What a condition reads at evaluation time. */
export interface ConditionContext {
  variables: Readonly<Record<string, VariableValue | null | undefined>>;
  selection: { count(field?: string): number };
  mode: "view" | "edit";
}

/** A compiled `visibleWhen` condition. */
export type Condition = (ctx: ConditionContext) => boolean;

/** Thrown by `compileCondition` for a condition it cannot parse; `code` is always `"expression"`. */
export class DashboardExpressionError extends Error implements DashboardSpecError {
  readonly code = "expression" as const;
  readonly path: string;
  constructor(message: string, path = "") {
    super(message);
    this.name = "DashboardExpressionError";
    this.path = path;
  }
}

type Value = VariableValue | null | undefined;
type Node = (ctx: ConditionContext) => Value;
type Token = { kind: "num" | "str" | "id" | "op"; text: string; pos: number };

const OPERATORS = ["&&", "||", "==", "!=", "<=", ">=", "<", ">", "!", "(", ")", "."];

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i] as string;
    if (/\s/.test(ch)) {
      i++;
    } else if (/[0-9]/.test(ch)) {
      const match = /^[0-9]+(\.[0-9]+)?/.exec(src.slice(i)) as RegExpExecArray;
      tokens.push({ kind: "num", text: match[0], pos: i });
      i += match[0].length;
    } else if (ch === "'" || ch === '"') {
      const end = src.indexOf(ch, i + 1);
      if (end < 0) throw new DashboardExpressionError(`Unterminated string at ${i}`);
      tokens.push({ kind: "str", text: src.slice(i + 1, end), pos: i });
      i = end + 1;
    } else if (/[A-Za-z_]/.test(ch)) {
      const match = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i)) as RegExpExecArray;
      tokens.push({ kind: "id", text: match[0], pos: i });
      i += match[0].length;
    } else {
      const op = OPERATORS.find((candidate) => src.startsWith(candidate, i));
      if (!op) throw new DashboardExpressionError(`Unexpected character “${ch}” at ${i}`);
      tokens.push({ kind: "op", text: op, pos: i });
      i += op.length;
    }
  }
  return tokens;
}

function compare(op: string, a: Value, b: Value): boolean {
  if (op === "==") return a === b;
  if (op === "!=") return a !== b;
  const comparable =
    (typeof a === "number" && typeof b === "number") ||
    (typeof a === "string" && typeof b === "string");
  if (!comparable) return false;
  const left = a as number | string;
  const right = b as number | string;
  if (op === "<") return left < right;
  if (op === "<=") return left <= right;
  if (op === ">") return left > right;
  return left >= right;
}

/**
 * Compile a `visibleWhen` source string into a predicate. Throws `DashboardExpressionError`
 * (`code: "expression"`) on anything outside the grammar.
 */
export function compileCondition(src: string): Condition {
  const tokens = tokenize(src);
  let at = 0;

  const peek = (): Token | undefined => tokens[at];
  const fail = (what: string): never => {
    const token = peek();
    throw new DashboardExpressionError(
      token ? `${what}, found “${token.text}” at ${token.pos}` : `${what}, found end of input`,
    );
  };
  const takeOp = (text: string): boolean => {
    const token = peek();
    if (token?.kind === "op" && token.text === text) {
      at++;
      return true;
    }
    return false;
  };
  const expectOp = (text: string): void => {
    if (!takeOp(text)) fail(`Expected “${text}”`);
  };
  const expectId = (): string => {
    const token = peek();
    if (token?.kind !== "id") return fail("Expected a name");
    at++;
    return token.text;
  };

  function parseOr(): Node {
    let left = parseAnd();
    while (takeOp("||")) {
      const l = left;
      const r = parseAnd();
      left = (ctx) => Boolean(l(ctx)) || Boolean(r(ctx));
    }
    return left;
  }

  function parseAnd(): Node {
    let left = parseUnary();
    while (takeOp("&&")) {
      const l = left;
      const r = parseUnary();
      left = (ctx) => Boolean(l(ctx)) && Boolean(r(ctx));
    }
    return left;
  }

  function parseUnary(): Node {
    if (takeOp("!")) {
      const inner = parseUnary();
      return (ctx) => !inner(ctx);
    }
    const left = parsePrimary();
    const token = peek();
    if (token?.kind === "op" && ["==", "!=", "<", "<=", ">", ">="].includes(token.text)) {
      at++;
      const right = parsePrimary();
      return (ctx) => compare(token.text, left(ctx), right(ctx));
    }
    return left;
  }

  function parsePrimary(): Node {
    const token = peek();
    if (!token) return fail("Expected a value");
    if (token.kind === "num") {
      at++;
      const value = Number(token.text);
      return () => value;
    }
    if (token.kind === "str") {
      at++;
      return () => token.text;
    }
    if (takeOp("(")) {
      const inner = parseOr();
      expectOp(")");
      return inner;
    }
    if (token.kind !== "id") return fail("Expected a value");
    at++;
    switch (token.text) {
      case "true":
        return () => true;
      case "false":
        return () => false;
      case "null":
        return () => null;
      case "mode":
        return (ctx) => ctx.mode;
      case "variables": {
        expectOp(".");
        const name = expectId();
        return (ctx) => ctx.variables[name];
      }
      case "selection": {
        expectOp(".");
        if (expectId() !== "count") {
          at--;
          fail("Expected “count”");
        }
        expectOp("(");
        let field: string | undefined;
        const arg = peek();
        if (arg?.kind === "str") {
          at++;
          field = arg.text;
        }
        expectOp(")");
        return (ctx) => ctx.selection.count(field);
      }
      default:
        at--;
        return fail("Unknown name");
    }
  }

  if (tokens.length === 0) throw new DashboardExpressionError("Empty condition");
  const root = parseOr();
  if (at < tokens.length) fail("Unexpected token");
  return (ctx) => Boolean(root(ctx));
}
