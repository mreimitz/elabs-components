/**
 * RM-196 (ADR 0042 A.6 rows 32–33): `HeatmapChartXProp`/`HeatmapChartYProp` each require
 * exactly the OLD or the NEW name at the type level (a field-vocabulary "either required"
 * shape has no runtime-definition equivalent — see the docblock on both types in
 * `heatmap-chart.tsx`). This proves that XOR compiles and is enforced both ways: `xDataKey`
 * alone is enough, `x` alone is enough, and NEITHER is a compile error. Nothing here runs:
 * checked by `tsc` (`pnpm --filter @elabs-ai/components-charts typecheck`); vitest never
 * collects a `*.test-d.ts`.
 */

import type { HeatmapChartProps } from "./heatmap-chart";

const data = [{ day: "Mon", hour: "09", count: 4 }];

// ── xDataKey alone compiles ───────────────────────────────────────────────
const viaNew: HeatmapChartProps = { data, valueKey: "count", xDataKey: "hour", yDataKey: "day" };

// ── the deprecated x/y alone compiles too (the union's other branch) ──────
const viaOld: HeatmapChartProps = { data, valueKey: "count", x: "hour", y: "day" };

// ── mixing old x with new yDataKey (and vice versa) compiles — the two
//    pairs are independent unions ──────────────────────────────────────────
const viaMixed1: HeatmapChartProps = { data, valueKey: "count", x: "hour", yDataKey: "day" };
const viaMixed2: HeatmapChartProps = { data, valueKey: "count", xDataKey: "hour", y: "day" };

// ── neither x nor xDataKey: a compile error, not a silent `undefined` ─────
// @ts-expect-error — one of `x`/`xDataKey` is required
const missingX: HeatmapChartProps = { data, valueKey: "count", y: "day" };

// ── neither y nor yDataKey: a compile error ────────────────────────────────
// @ts-expect-error — one of `y`/`yDataKey` is required
const missingY: HeatmapChartProps = { data, valueKey: "count", x: "hour" };

// ── neither pair given at all: a compile error ─────────────────────────────
// @ts-expect-error — one of `x`/`xDataKey` AND one of `y`/`yDataKey` are required
const missingBoth: HeatmapChartProps = { data, valueKey: "count" };

void viaNew;
void viaOld;
void viaMixed1;
void viaMixed2;
void missingX;
void missingY;
void missingBoth;
