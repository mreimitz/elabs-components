import { CHARTS_A2UI_CATALOG_SCHEMA } from "@elabs-ai/components-charts";
import { describe, expect, it } from "vitest";

import { A2UI_CATALOG_SCHEMA, type A2uiCatalogSchema, validateA2uiSurface } from "./core";

/**
 * Proves the A2UI catalog's `AutoChart.spec` prop (an opaque `type: "object"`,
 * `packages/ai/src/a2ui/catalog.source.json`) validates `ChartSpec` objects that use the
 * wave-2 fields — frame chrome (`notes`/`source`), `tooltip`, `facet`, `type: "dual-axis"`
 * with `series[].axis`, and waterfall `groupBy`/`dataFormat` — the same precedent as
 * `wave1-chart-spec.test.ts` (`.claude/scratch/datawrapper-parity`). See that file's docblock
 * for why `charts` is a devDependency of `ai` here and why the cast is needed.
 */
const CATALOG = {
  ...A2UI_CATALOG_SCHEMA,
  ...CHARTS_A2UI_CATALOG_SCHEMA,
} as unknown as A2uiCatalogSchema;

describe("A2UI catalog accepts wave-2 ChartSpec fields", () => {
  it("validates frame chrome (notes/source), tooltip and facet.by on a line spec", () => {
    const r = validateA2uiSurface(
      {
        a2ui: "1",
        root: {
          type: "AutoChart",
          props: {
            spec: {
              type: "line",
              data: [
                { region: "West", month: "Jan", revenue: 100 },
                { region: "West", month: "Feb", revenue: 120 },
                { region: "East", month: "Jan", revenue: 80 },
                { region: "East", month: "Feb", revenue: 90 },
              ],
              x: "month",
              series: ["revenue"],
              notes: "Preliminary figures, subject to close.",
              source: { name: "Finance", href: "https://example.com/finance" },
              tooltip: { variant: "rows", focus: true },
              facet: { by: "region", scales: { y: "shared" } },
            },
          },
        },
      },
      CATALOG,
    );
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("validates a type: dual-axis spec using series[].axis and series[].mark", () => {
    const r = validateA2uiSurface(
      {
        a2ui: "1",
        root: {
          type: "AutoChart",
          props: {
            spec: {
              type: "dual-axis",
              data: [
                { month: "Jan", revenue: 100, margin: 0.2 },
                { month: "Feb", revenue: 120, margin: 0.25 },
              ],
              x: "month",
              series: [
                { key: "revenue", axis: "left", mark: "column" },
                { key: "margin", axis: "right", mark: "line" },
              ],
              axes: { y2: { align: "ticks", zero: "auto" } },
            },
          },
        },
      },
      CATALOG,
    );
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("validates a waterfall spec using groupBy (subtotals) and dataFormat", () => {
    const r = validateA2uiSurface(
      {
        a2ui: "1",
        root: {
          type: "AutoChart",
          props: {
            spec: {
              type: "waterfall",
              data: [
                { step: "Starting cash", value: 1000, group: "Q1" },
                { step: "Sales", value: 400, group: "Q1" },
                { step: "Costs", value: -150, group: "Q1" },
              ],
              x: "step",
              series: ["value"],
              groupBy: "group",
              dataFormat: "differences",
              zoomToDifferences: false,
            },
          },
        },
      },
      CATALOG,
    );
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });
});
