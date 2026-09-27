import { describe, expect, it } from "vitest";

import { CHARTS_A2UI_CATALOG_SCHEMA } from "./catalog.generated";
import { CHARTS_A2UI_BINDINGS } from "./charts-catalog";

describe("charts A2UI catalog", () => {
  it("binds exactly the generated schema's types, all from this package", () => {
    expect(Object.keys(CHARTS_A2UI_BINDINGS).sort()).toEqual(
      Object.keys(CHARTS_A2UI_CATALOG_SCHEMA).sort(),
    );
    for (const [type, entry] of Object.entries(CHARTS_A2UI_CATALOG_SCHEMA)) {
      expect(entry.source, type).toBe("@elabs-ai/components-charts");
      expect(entry.builtin, type).toBeUndefined();
    }
  });

  it("AutoChart takes a required spec object and reports datapoint clicks and selection intents", () => {
    expect(CHARTS_A2UI_CATALOG_SCHEMA.AutoChart!.props.spec).toMatchObject({
      type: "object",
      required: true,
    });
    expect(CHARTS_A2UI_CATALOG_SCHEMA.AutoChart!.events).toEqual({
      datapointClick: "onDatapointClick",
      // Selection chrome — RM-145
      selectionIntent: "onSelectionIntent",
    });
    expect(CHARTS_A2UI_CATALOG_SCHEMA.ChartCard!.children).toBe(true);
  });

  it("describes ChartSpec.analytics: the kinds and the value union (RM-138 / RM-139)", () => {
    const spec = CHARTS_A2UI_CATALOG_SCHEMA.AutoChart!.props.spec as { description?: string };
    const text = spec.description ?? "";
    expect(text).toContain("analytics?:");
    for (const kind of ["line", "band", "trend", "window", "forecast", "errorBars"]) {
      expect(text).toContain(kind);
    }
    for (const value of ["mean", "median", "{ percentile }", "{ stddev", "{ ci }", "{ poly"]) {
      expect(text).toContain(value);
    }
  });

  it("an agent's spec with analytics passes the AutoChart spec contract", async () => {
    const { assertAnalyticsSpecContract } = await import("../test/doubles");
    expect(() =>
      assertAnalyticsSpecContract([
        { kind: "line", value: "mean" },
        { kind: "band", spread: { percentiles: [25, 75] } },
        { kind: "trend", model: { poly: 3 } },
        { kind: "forecast", horizon: 6, season: 12 },
      ]),
    ).not.toThrow();
    expect(() => assertAnalyticsSpecContract([{ kind: "line", value: "average" }])).toThrow();
  });

  // Selection chrome — RM-145
  it("describes ChartSpec.selection so an agent can ask for range and lasso selection", () => {
    const spec = CHARTS_A2UI_CATALOG_SCHEMA.AutoChart!.props.spec as { description?: string };
    const text = spec.description ?? "";
    expect(text).toContain("selection?: { gestures: (range|rect|lasso|radial)[]");
    expect(text).toContain("confirm?: immediate|explicit");
    expect(text).toContain("a bar chart with range and lasso selection");
  });

  it("an agent's spec with selection passes the AutoChart selection contract", async () => {
    const { assertSelectionSpecContract } = await import("../test/contract");
    const handler = () => {};
    expect(() =>
      assertSelectionSpecContract({ gestures: ["range", "lasso"], confirm: "explicit" }, handler),
    ).not.toThrow();
    expect(() => assertSelectionSpecContract({ gestures: ["brush"] }, undefined)).toThrow();
    expect(() => assertSelectionSpecContract(undefined, handler)).toThrow(/can never fire/);
  });

  // RM-197: Responsive `plotHeight` carries a real schema (never `any`), `height` stays in
  // the catalog as a deprecated alias naming its replacement, `spec` covers choropleth, and
  // Sparkline's renamed `label` does the same — sourced from the manifest / JSDoc, not a
  // hand list (ADR 0042 §8).
  it("AutoChart.plotHeight is a real Responsive<ChartPlotHeight> schema, not `any`", () => {
    const plotHeight = CHARTS_A2UI_CATALOG_SCHEMA.AutoChart!.props.plotHeight!;
    expect(plotHeight.type).not.toBe("any");
    expect(plotHeight.oneOf).toBeDefined();
    expect(plotHeight.oneOf!.length).toBeGreaterThanOrEqual(2);
    // One alternative is the plain `ChartPlotHeight` (number | { aspect }); the other is the
    // per-breakpoint `{ base, medium?, narrow? }` object — never the same shape twice.
    const shapes = plotHeight.oneOf!.map((s) => s.type);
    expect(shapes).toContain("object");
  });

  it("AutoChart.height stays in the catalog, flagged deprecated, naming `plotHeight`", () => {
    const height = CHARTS_A2UI_CATALOG_SCHEMA.AutoChart!.props.height!;
    expect(height.deprecated).toBe(true);
    expect(height.description).toMatch(/plotHeight/);
    expect(height.description).not.toMatch(/@deprecated/); // the raw JSDoc tag never leaks
  });

  it("AutoChart.spec's type union covers choropleth", () => {
    const spec = CHARTS_A2UI_CATALOG_SCHEMA.AutoChart!.props.spec as { description?: string };
    expect(spec.description ?? "").toContain("choropleth");
  });

  it("Sparkline.label stays in the catalog, flagged deprecated, naming `accessibleLabel`", () => {
    const label = CHARTS_A2UI_CATALOG_SCHEMA.Sparkline!.props.label!;
    expect(label.deprecated).toBe(true);
    expect(label.description).toMatch(/accessibleLabel/);
  });
});
