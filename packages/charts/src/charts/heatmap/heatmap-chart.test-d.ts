/**
 * RM-196 F2 (owner decision, 2026-09-27 — DEPRECATION.md §2, ADR 0042 A.6/"Watch for"):
 * `HeatmapChartProps` is a plain interface with no union member. Neither `xDataKey`/`x`
 * nor `yDataKey`/`y` is compile-time required — that would have been a breaking change in
 * a minor. This proves the interface stays a normal, extendable, spreadable object type,
 * and that every combination of old/new/neither name compiles. Nothing here runs: checked
 * by `tsc` (`pnpm --filter @elabs-ai/components-charts typecheck`); vitest never collects
 * a `*.test-d.ts`. No JSX — this file is `.ts`, not `.tsx` (matches every sibling
 * `*.test-d.ts`, and keeps it out of the JSX-only check-rule globs).
 */

import { createElement } from "react";

import { HeatmapChart, type HeatmapChartProps } from "./heatmap-chart";

const data = [{ day: "Mon", hour: "09", count: 4 }];

// ── a plain object type: an interface can still `extends` it — the empty
//    body is the point of the proof, not an oversight ─────────────────────
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface ExtendedHeatmapChartProps extends HeatmapChartProps {}
const extended: ExtendedHeatmapChartProps = { data, valueKey: "count", xDataKey: "hour" };
void extended;

// ── a wrapper can still spread `Omit<HeatmapChartProps, "data">` onto the
//    component — the exact shape a thin wrapper component uses. `createElement`
//    proves the same assignability as JSX's `<HeatmapChart data={d} {...p} />`
//    would, without needing a `.tsx` file. ─────────────────────────────────
function HeatmapChartWrapper(p: Omit<HeatmapChartProps, "data">) {
  return createElement(HeatmapChart, { data, ...p });
}
void HeatmapChartWrapper;

// ── new names only ──────────────────────────────────────────────────────────
const viaNew: HeatmapChartProps = { data, valueKey: "count", xDataKey: "hour", yDataKey: "day" };

// ── old, deprecated names only ──────────────────────────────────────────────
const viaOld: HeatmapChartProps = { data, valueKey: "count", x: "hour", y: "day" };

// ── both spellings of a pair together — never a conflict at the type level,
//    `useResolvedChartProps` decides precedence at runtime ─────────────────
const viaBoth: HeatmapChartProps = {
  data,
  valueKey: "count",
  xDataKey: "hour",
  x: "hour",
  yDataKey: "day",
  y: "day",
};

// ── mixing old x with new yDataKey (and vice versa) compiles — the two
//    pairs are independent optional members, not a linked union ───────────
const viaMixed1: HeatmapChartProps = { data, valueKey: "count", x: "hour", yDataKey: "day" };
const viaMixed2: HeatmapChartProps = { data, valueKey: "count", xDataKey: "hour", y: "day" };

// ── neither spelling of either pair: compiles too (owner decision, 2026-09-27)
//    — a dev-only warning is the runtime diagnostic now, never a type error,
//    and the real component never throws for this ──────────────────────────
const viaNeither: HeatmapChartProps = { data, valueKey: "count" };

// ── e5f37e50 compatibility: before RM-196, `HeatmapChartProps` had no
//    `xDataKey` at all — only a required `x: string`/`y: string`. That exact
//    caller object shape must still compile unchanged (DEPRECATION.md §2). ──
const viaPreRm196Shape: HeatmapChartProps = {
  data,
  valueKey: "count",
  x: "hour" as string,
  y: "day" as string,
};

void viaNew;
void viaOld;
void viaBoth;
void viaMixed1;
void viaMixed2;
void viaNeither;
void viaPreRm196Shape;
