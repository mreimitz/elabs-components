import { CHARTS_A2UI_CATALOG_SCHEMA } from "@elabs-ai/components-charts";
import { describe, expect, it } from "vitest";

import { A2UI_CATALOG_SCHEMA, type A2uiCatalogSchema, validateA2uiSurface } from "./core";

/**
 * Proves the A2UI catalog's `AutoChart.spec` prop (an opaque `type: "object"`,
 * `packages/ai/src/a2ui/catalog.source.json`) validates `ChartSpec` objects that use the
 * wave-1 fields (`labels`, `annotations`, `nulls`, dumbbell `variant`, …) — an agent that
 * reads the catalog's description can rely on emitting them (`.claude/scratch/datawrapper-parity`).
 * `charts` is a devDependency of `ai` for exactly this kind of cross-catalog test (see
 * `agentic-workspace.stories.tsx`); `ai` never imports `charts` at runtime (D6).
 *
 * `ChartsA2uiCatalogSchema` (charts) and `A2uiCatalogSchema` (ai) are structurally close
 * but not identical (`default?: unknown` vs `default?: A2uiJson`) — the same gap the
 * `createA2uiCatalog` docblock's merge example papers over as a comment, never
 * type-checked. The runtime shapes agree; the cast documents the known type gap rather
 * than widening either schema's `default` field.
 */
const CATALOG = {
  ...A2UI_CATALOG_SCHEMA,
  ...CHARTS_A2UI_CATALOG_SCHEMA,
} as unknown as A2uiCatalogSchema;

describe("A2UI catalog accepts wave-1 ChartSpec fields", () => {
  it("validates line, pie and dumbbell specs using labels.series, annotations, nulls, labels.slices and variant: arrow", () => {
    const r = validateA2uiSurface(
      {
        a2ui: "1",
        root: {
          type: "Stack",
          children: [
            {
              type: "AutoChart",
              props: {
                spec: {
                  type: "line",
                  data: [
                    { month: "Jan", revenue: 100 },
                    { month: "Feb", revenue: null },
                    { month: "Mar", revenue: 140 },
                  ],
                  x: "month",
                  series: ["revenue"],
                  labels: { series: "end" },
                  annotations: [{ kind: "line", y: 120, label: "Target" }],
                  nulls: "connect",
                },
              },
            },
            {
              type: "AutoChart",
              props: {
                spec: {
                  type: "pie",
                  data: [
                    { channel: "Direct", share: 62 },
                    { channel: "Referral", share: 38 },
                  ],
                  x: "channel",
                  series: ["share"],
                  labels: { slices: { show: ["label", "percent"] } },
                },
              },
            },
            {
              type: "AutoChart",
              props: {
                spec: {
                  type: "dumbbell",
                  data: [{ region: "West", fy24: 10, fy25: 15 }],
                  x: "region",
                  series: ["fy24"],
                  y2: "fy25",
                  variant: "arrow",
                },
              },
            },
          ],
        },
      },
      CATALOG,
    );
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });
});
