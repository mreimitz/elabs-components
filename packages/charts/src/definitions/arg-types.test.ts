/**
 * `argTypesFromDefinition` — the 8 WaterfallChart props a fixed `enum`/`union`/`responsive`
 * → `control` mapping would get wrong. `union`/`responsive` (`labels`, `margin`,
 * `plotHeight`, `valueFormat`) would fall to a blanket `control: false`, discarding the
 * object control Storybook's own type-based inference gives them; `enum` (`orientation`,
 * `connectors`, `dataFormat`, `sort`) would force `control: { type: "select" }`, overriding
 * Storybook's own radio inference for a small literal union. `arg-types.ts`'s `controlFor`
 * omits `control` for all three kinds instead, so that inference stands — this suite pins
 * the omission (not the inferred type itself, which is Storybook's call at render time,
 * exercised for real by the waterfall story test) — except `palette`, which gets an explicit
 * select regardless of kind (see `controlFor`'s docblock).
 */
import { describe, expect, it } from "vitest";

import { WATERFALL_CHART } from "./waterfall-chart.definition";
import { argTypesFromDefinition } from "./arg-types";

describe("argTypesFromDefinition — WaterfallChart control mapping", () => {
  const argTypes = argTypesFromDefinition(WATERFALL_CHART);

  it.each(["labels", "margin", "plotHeight", "valueFormat"])(
    "omits control for the union/responsive prop %s (was: control: false)",
    (key) => {
      expect(argTypes[key]).toBeDefined();
      expect(argTypes[key]).not.toHaveProperty("control");
    },
  );

  it.each(["orientation", "connectors", "dataFormat", "sort"])(
    "omits control for the enum prop %s (was: control: { type: select })",
    (key) => {
      expect(argTypes[key]).toBeDefined();
      expect(argTypes[key]).not.toHaveProperty("control");
    },
  );

  it("still lists an enum prop's values as options, even with control omitted", () => {
    expect(argTypes.orientation?.options).toEqual(["vertical", "horizontal"]);
    expect(argTypes.connectors?.options).toEqual([true, false, "thin", "thick"]);
    expect(argTypes.dataFormat?.options).toEqual(["differences", "runningTotals"]);
    expect(argTypes.sort?.options).toEqual(["data", "increasesFirst", "decreasesFirst"]);
  });

  it("keeps an explicit control for kinds outside the enum/union/responsive set (number/boolean/color)", () => {
    expect(argTypes.unit?.control).toEqual({
      type: "number",
      min: undefined,
      max: undefined,
      step: undefined,
    });
    expect(argTypes.grid?.control).toBe("boolean");
    expect(argTypes.positiveFill?.control).toBe("color");
  });

  it("keeps control: false for a deprecated field (height)", () => {
    expect(argTypes.height?.control).toBe(false);
  });

  it("gives palette an explicit select control, unlike every other enum prop", () => {
    expect(argTypes.palette?.control).toEqual({ type: "select" });
    expect(argTypes.palette?.options).toEqual([
      "categorical",
      "sequential",
      "diverging",
      "mono",
      "accent",
    ]);
  });
});
