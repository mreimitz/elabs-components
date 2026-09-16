import { describe, expect, it } from "vitest";

import { compileCondition, type ConditionContext } from "./expression";

const ctx = (
  variables: ConditionContext["variables"],
  counts: Record<string, number>,
  mode: ConditionContext["mode"] = "view",
): ConditionContext => ({
  variables,
  mode,
  selection: {
    count: (field?: string) =>
      field === undefined
        ? Object.values(counts).reduce((sum, n) => sum + n, 0)
        : (counts[field] ?? 0),
  },
});

describe("compileCondition", () => {
  const detail = compileCondition("variables.showDetail && selection.count('Region') > 0");

  it("evaluates the visibleWhen example on three contexts", () => {
    expect(detail(ctx({ showDetail: true }, { Region: 2 }))).toBe(true);
    expect(detail(ctx({ showDetail: false }, { Region: 2 }))).toBe(false);
    expect(detail(ctx({ showDetail: true }, { Product: 3 }))).toBe(false);
  });

  it("supports every operator, literals, parentheses and mode", () => {
    const c = ctx({ n: 5, s: "b", flag: false }, { A: 1, B: 2 }, "edit");
    const cases: Array<[string, boolean]> = [
      ["!variables.flag", true],
      ["variables.n >= 5 && variables.n <= 5", true],
      ["variables.n < 5 || variables.n > 5", false],
      ["variables.s == 'b' && variables.s != \"c\"", true],
      ["selection.count() == 3", true],
      ["mode == 'edit' && (false || true)", true],
      ["variables.missing == null", false],
      ["variables.n < 'x'", false],
      ["!(variables.n == 5)", false],
    ];
    for (const [src, expected] of cases) expect(compileCondition(src)(c), src).toBe(expected);
  });

  it.each([
    "(function(){})()",
    "variables",
    "window.alert(1)",
    "selection.size('A')",
    "variables.n >",
    "(true",
    "'open",
    "true true",
    "",
  ])("rejects %j with code expression", (src) => {
    expect(() => compileCondition(src)).toThrowError(
      expect.objectContaining({ code: "expression" }),
    );
  });
});
