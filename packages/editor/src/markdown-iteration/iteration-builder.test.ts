/**
 * Unit tests for the iteration BUILDER model (A5): serialize ⇄ parse round-trip
 * (so the `⋯` re-edit is lossless) and the built-in `evaluateEmbedded` that turns
 * the embedded value lists into a populated result (so a guided-built block
 * renders without a consumer data engine).
 */
import { describe, expect, test } from "vitest";

import { specFromDirective } from "./directive";
import {
  builderValueFromParts,
  directivePartsFromValue,
  evaluateEmbedded,
  parseIterationDirective,
  serializeIterationDirective,
  splitList,
  staticMarkdownFromValue,
  transposeIterationValue,
  type IterationBuilderValue,
} from "./iteration-builder";

describe("serializeIterationDirective", () => {
  test("iterate: embeds the value list + bind name + layout in the attributes", () => {
    const md = serializeIterationDirective({
      kind: "iterate",
      as: "item",
      layout: "stacked",
      values: ["Alice", "Bob", "Charlie"],
      template: "{{item.name}}",
    });
    expect(md).toContain(":::iterate{");
    expect(md).toContain(`as="item"`);
    expect(md).toContain(`layout="stacked"`);
    expect(md).toContain(`values="Alice, Bob, Charlie"`);
    expect(md.trimEnd().endsWith(":::")).toBe(true);
  });

  test("pivot: embeds both axes as rows= and cols=", () => {
    const md = serializeIterationDirective({
      kind: "pivot",
      as: "item",
      layout: "matrix",
      values: ["Q1", "Q2"],
      cols: ["North", "South"],
      template: "{{row}} · {{col}}",
    });
    expect(md).toContain(":::pivot{");
    expect(md).toContain(`rows="Q1, Q2"`);
    expect(md).toContain(`cols="North, South"`);
  });
});

describe("round-trip (serialize → parse)", () => {
  test("iterate round-trips losslessly", () => {
    const value: IterationBuilderValue = {
      kind: "iterate",
      as: "person",
      layout: "grid",
      values: ["Alice", "Bob"],
      template: "Name: {{item.name}}",
    };
    expect(parseIterationDirective(serializeIterationDirective(value))).toEqual(value);
  });

  test("pivot round-trips losslessly (both value lists preserved)", () => {
    const value: IterationBuilderValue = {
      kind: "pivot",
      as: "item",
      layout: "matrix",
      values: ["Q1", "Q2", "Q3"],
      cols: ["North", "South"],
      template: "{{row}} / {{col}}",
    };
    expect(parseIterationDirective(serializeIterationDirective(value))).toEqual(value);
  });

  test("parse returns null for non-iteration markdown", () => {
    expect(parseIterationDirective("# just a heading")).toBeNull();
  });
});

describe("nested-directive fence escalation", () => {
  test("escalates the outer fence past a nested :::card so the inner close can't terminate it", () => {
    const md = serializeIterationDirective({
      kind: "iterate",
      as: "item",
      layout: "stacked",
      values: ["A"],
      template: `:::card{title="{{item.name}}"}\nbody\n:::\n\ntrailing`,
    });
    expect(md.startsWith("::::iterate{")).toBe(true);
    expect(md.trimEnd().endsWith("::::")).toBe(true);
  });

  test("keeps the canonical ::: fence when there is no nested container directive", () => {
    const md = serializeIterationDirective({
      kind: "iterate",
      as: "item",
      layout: "stacked",
      values: ["A"],
      template: "{{item.name}}",
    });
    expect(md.startsWith(":::iterate{")).toBe(true);
    expect(md.startsWith("::::")).toBe(false);
  });

  test("a nested :::card + trailing content round-trips losslessly (and survives a bento layout)", () => {
    const value: IterationBuilderValue = {
      kind: "iterate",
      as: "item",
      layout: "bento",
      values: ["A", "B"],
      template: `:::card{title="{{item.name}}"}\nbody\n:::\n\ntrailing`,
    };
    expect(parseIterationDirective(serializeIterationDirective(value))).toEqual(value);
  });
});

describe("builderValueFromParts defaults", () => {
  test("falls back to the default layout + template when attributes are sparse", () => {
    const v = builderValueFromParts("iterate", {}, "");
    expect(v.layout).toBe("stacked");
    expect(v.template).toBe("{{item.name}}");
    expect(v.values).toEqual([]);
  });
});

describe("directivePartsFromValue", () => {
  test("pivot writes rows/cols, not values", () => {
    const { attributes } = directivePartsFromValue({
      kind: "pivot",
      as: "item",
      layout: "matrix",
      values: ["a", "b"],
      cols: ["x"],
      template: "t",
    });
    expect(attributes.rows).toBe("a, b");
    expect(attributes.cols).toBe("x");
    expect(attributes.values).toBeUndefined();
  });
});

describe("evaluateEmbedded", () => {
  test("iterate: one cell per embedded value, with {{value}}/{{name}} in scope", () => {
    const spec = specFromDirective("iterate", { values: "Alice, Bob, Charlie", as: "item" }, "x");
    const data = evaluateEmbedded(spec);
    expect(data.cells).toHaveLength(3);
    expect(data.cells[0]?.context).toMatchObject({ value: "Alice", name: "Alice" });
  });

  test("pivot: rows × cols cells + ordered headers", () => {
    const spec = specFromDirective("pivot", { rows: "Q1, Q2", cols: "N, S, E" }, "x");
    const data = evaluateEmbedded(spec);
    expect(data.rowHeaders).toEqual(["Q1", "Q2"]);
    expect(data.colHeaders).toEqual(["N", "S", "E"]);
    expect(data.cells).toHaveLength(6);
    expect(data.cells[0]).toMatchObject({ row: "Q1", col: "N" });
  });

  test("empty lists → no cells (renders the empty state)", () => {
    expect(evaluateEmbedded(specFromDirective("iterate", {}, "x")).cells).toEqual([]);
    expect(evaluateEmbedded(specFromDirective("pivot", { rows: "Q1" }, "x")).cells).toEqual([]);
  });
});

describe("splitList", () => {
  test("trims, drops empties, tolerates trailing commas", () => {
    expect(splitList("a, b ,, c,")).toEqual(["a", "b", "c"]);
    expect(splitList(undefined)).toEqual([]);
  });
});

describe("transposeIterationValue", () => {
  test("pivot: swaps rows (values) and cols", () => {
    const value: IterationBuilderValue = {
      kind: "pivot",
      as: "item",
      layout: "matrix",
      values: ["Q1", "Q2"],
      cols: ["North", "South", "East"],
      template: "{{row}} · {{col}}",
    };
    const transposed = transposeIterationValue(value);
    expect(transposed.values).toEqual(["North", "South", "East"]);
    expect(transposed.cols).toEqual(["Q1", "Q2"]);
  });

  test("pivot: transpose∘transpose is the identity (lossless round-trip)", () => {
    const value: IterationBuilderValue = {
      kind: "pivot",
      as: "item",
      layout: "matrix",
      values: ["Q1", "Q2", "Q3"],
      cols: ["North", "South"],
      template: "{{row}} / {{col}}",
    };
    expect(transposeIterationValue(transposeIterationValue(value))).toEqual(value);
  });

  test("iterate: is a no-op (no second axis to swap)", () => {
    const value: IterationBuilderValue = {
      kind: "iterate",
      as: "item",
      layout: "stacked",
      values: ["Alice", "Bob"],
      template: "{{item.name}}",
    };
    expect(transposeIterationValue(value)).toEqual(value);
  });
});

describe("staticMarkdownFromValue", () => {
  test("matrix layout emits a GFM table with row + column headers", () => {
    const md = staticMarkdownFromValue({
      kind: "pivot",
      as: "item",
      layout: "matrix",
      values: ["Q1", "Q2"],
      cols: ["N", "S"],
      template: "{{row}}-{{col}}",
    });
    const lines = md.split("\n");
    expect(lines[0]).toBe("|  | N | S |");
    expect(lines[1]).toBe("| --- | --- | --- |");
    expect(lines[2]).toBe("| Q1 | Q1-N | Q1-S |");
    expect(lines[3]).toBe("| Q2 | Q2-N | Q2-S |");
  });

  test("stacked layout emits sequential blocks separated by a blank line", () => {
    const md = staticMarkdownFromValue({
      kind: "iterate",
      as: "item",
      layout: "stacked",
      values: ["Alice", "Bob"],
      template: "Name: {{item.name}}",
    });
    expect(md).toBe("Name: Alice\n\nName: Bob");
  });

  test("empty value list yields an empty string", () => {
    expect(
      staticMarkdownFromValue({
        kind: "iterate",
        as: "item",
        layout: "stacked",
        values: [],
        template: "{{item.name}}",
      }),
    ).toBe("");
  });
});
