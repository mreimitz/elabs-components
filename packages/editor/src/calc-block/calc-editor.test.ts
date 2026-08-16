/**
 * Unit tests for the engine-neutral calc authoring helpers (#220).
 *
 * These are the load-bearing pure functions both editor surfaces share — fence
 * detection, the column/position math, and hook resolution. Monaco + Milkdown can't
 * render in jsdom, so the live decoration passes are covered by `test-storybook`;
 * here we lock the math + the degrade-gracefully behavior.
 */
import { describe, expect, it } from "vitest";

import {
  calcDecorationSpecs,
  calcInlaySpecs,
  calcLineLayout,
  calcTokenClassName,
  findCalcFences,
  identifierPrefix,
  resolveHighlight,
  resolveInlays,
  resolveResults,
} from "./calc-editor";
import type { CalcEditorHooks, CalcSheet, CalcToken } from "./types";

const doc = [
  "# Notes", // 1
  "", // 2
  "```calc", // 3
  "items = 3", // 4
  "price = 4.50", // 5
  "total = items * price", // 6
  "```", // 7
  "", // 8
  "prose", // 9
].join("\n");

describe("findCalcFences", () => {
  it("locates a ```calc fence with 1-based body line numbers", () => {
    const fences = findCalcFences(doc);
    expect(fences).toHaveLength(1);
    expect(fences[0]).toMatchObject({
      openLine: 3,
      closeLine: 7,
      bodyStartLine: 4,
      bodyEndLine: 6,
    });
    expect(fences[0]?.source).toBe("items = 3\nprice = 4.50\ntotal = items * price");
  });

  it("ignores non-calc fences", () => {
    expect(findCalcFences("```ts\nconst a = 1;\n```")).toHaveLength(0);
    expect(findCalcFences("```\nplain\n```")).toHaveLength(0);
  });

  it("treats an unterminated trailing fence as running to EOF (mid-typing)", () => {
    const fences = findCalcFences("```calc\na = 1\nb = 2");
    expect(fences).toHaveLength(1);
    expect(fences[0]?.bodyStartLine).toBe(2);
    expect(fences[0]?.bodyEndLine).toBe(3);
    expect(fences[0]?.source).toBe("a = 1\nb = 2");
  });

  it("tolerates ~~~ fences and trailing whitespace on the info line", () => {
    const fences = findCalcFences("~~~calc \nx = 1\n~~~");
    expect(fences).toHaveLength(1);
    expect(fences[0]?.source).toBe("x = 1");
  });

  it("finds multiple fences", () => {
    expect(findCalcFences("```calc\na=1\n```\ntext\n```calc\nb=2\n```")).toHaveLength(2);
  });
});

describe("calcLineLayout", () => {
  it("returns per-line text + char offset (newlines counted)", () => {
    expect(calcLineLayout("ab\nc\n")).toEqual([
      { text: "ab", offset: 0 },
      { text: "c", offset: 3 },
      { text: "", offset: 5 },
    ]);
  });
});

const tok = (start: number, end: number, kind: CalcToken["kind"], resolved = true): CalcToken => ({
  start,
  end,
  kind,
  resolved,
});

describe("resolveHighlight", () => {
  it("prefers the per-line tokenize hook", () => {
    const hooks: CalcEditorHooks = {
      tokenize: (line) => (line ? [tok(0, line.length, "number")] : []),
    };
    const result = resolveHighlight(hooks, "12\n");
    expect(result[0]).toEqual([tok(0, 2, "number")]);
    expect(result[1]).toEqual([]);
  });

  it("falls back to evaluate's per-line tokens when tokenize is absent", () => {
    const sheet: CalcSheet = {
      results: [
        { line: 1, tokens: [tok(0, 1, "var-def")] },
        { line: 2, tokens: [tok(0, 2, "number")] },
      ],
    };
    const result = resolveHighlight({ evaluate: () => sheet }, "a\n12");
    expect(result[0]).toEqual([tok(0, 1, "var-def")]);
    expect(result[1]).toEqual([tok(0, 2, "number")]);
  });

  it("returns empty arrays when neither hook is supplied", () => {
    expect(resolveHighlight({}, "a\nb")).toEqual([[], []]);
  });

  it("degrades to [] when a hook throws (never blanks the editor)", () => {
    const hooks: CalcEditorHooks = {
      tokenize: () => {
        throw new Error("boom");
      },
    };
    expect(resolveHighlight(hooks, "x")).toEqual([[]]);
  });
});

describe("resolveResults / resolveInlays", () => {
  const hooks: CalcEditorHooks = {
    evaluate: () => ({
      results: [
        { line: 1, tokens: [], value: { kind: "number", raw: 3, display: "3" } },
        { line: 2, tokens: [], error: { message: "bad" } },
        { line: 3, tokens: [] }, // no value/error → no inlay
      ],
    }),
  };

  it("maps results by 1-based line", () => {
    const map = resolveResults(hooks, "a\nb\nc");
    expect(map.get(1)?.value?.display).toBe("3");
    expect(map.get(2)?.error?.message).toBe("bad");
  });

  it("builds inlays for value + error lines only, sorted by line", () => {
    expect(resolveInlays(hooks, "a\nb\nc")).toEqual([
      { lineNumber: 1, text: "= 3", isError: false },
      { lineNumber: 2, text: "error: bad", isError: true },
    ]);
  });

  it("returns no results when evaluate throws", () => {
    expect(
      resolveResults(
        {
          evaluate: () => {
            throw new Error("x");
          },
        },
        "a",
      ).size,
    ).toBe(0);
  });
});

describe("calcTokenClassName", () => {
  it("emits the compound base + kind class, adding unresolved for warnings", () => {
    expect(calcTokenClassName("number", true)).toBe("brand-calc-tok brand-calc-tok--number");
    expect(calcTokenClassName("var-def", false)).toBe(
      "brand-calc-tok brand-calc-tok--var-def brand-calc-tok--unresolved",
    );
  });
});

describe("identifierPrefix", () => {
  it("returns the identifier immediately before the column", () => {
    expect(identifierPrefix("total = ite", 11)).toBe("ite");
    expect(identifierPrefix("3 + ", 4)).toBe("");
    expect(identifierPrefix("foo.bar", 7)).toBe("bar");
  });
});

describe("calcDecorationSpecs (Monaco column math)", () => {
  const hooks: CalcEditorHooks = {
    tokenize: (line) => (line.startsWith("total") ? [tok(0, 5, "var-def")] : [tok(0, 2, "number")]),
  };

  it("maps 0-based token columns to 1-based Monaco columns at the right model line", () => {
    const specs = calcDecorationSpecs(hooks, 4, ["12", "total = 1"]);
    expect(specs).toEqual([
      {
        lineNumber: 4,
        startColumn: 1,
        endColumn: 3,
        className: "brand-calc-tok brand-calc-tok--number",
      },
      {
        lineNumber: 5,
        startColumn: 1,
        endColumn: 6,
        className: "brand-calc-tok brand-calc-tok--var-def",
      },
    ]);
  });

  it("clamps token columns to the line length and drops empty spans", () => {
    const over: CalcEditorHooks = { tokenize: () => [tok(0, 99, "number"), tok(2, 2, "operator")] };
    const specs = calcDecorationSpecs(over, 1, ["abc"]);
    expect(specs).toEqual([
      {
        lineNumber: 1,
        startColumn: 1,
        endColumn: 4,
        className: "brand-calc-tok brand-calc-tok--number",
      },
    ]);
  });
});

describe("calcInlaySpecs (Monaco inlay placement)", () => {
  it("positions each inlay at the end-of-line column of its model line", () => {
    const hooks: CalcEditorHooks = {
      evaluate: () => ({
        results: [{ line: 2, tokens: [], value: { kind: "number", raw: 7, display: "7" } }],
      }),
    };
    const specs = calcInlaySpecs(hooks, 4, ["a = 1", "b = 2 + 5"]);
    expect(specs).toEqual([{ lineNumber: 5, column: 10, text: "= 7", isError: false }]);
  });
});
