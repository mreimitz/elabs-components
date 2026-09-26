/**
 * RM-180: Line, Area, Composed, Bar, Scatter, Candlestick, Heatmap and
 * Distribution each restated a subset of the ADR 0040 navigator /
 * selection-gesture props on their OWN interface (the RM-146 blocks) only so
 * the manifest listed them. RM-179's `extends` resolver makes that
 * unnecessary, so the eight blocks were deleted.
 *
 * This proves every one of those restated props is still part of the
 * container's public props type — reachable through `extends` — with the
 * exact same type it had on the mixin. Nothing here runs: the file is
 * checked by `tsc` (`pnpm --filter @elabs-ai/components-charts typecheck`,
 * whose `include` is all of `src`), and vitest never collects a
 * `*.test-d.ts`. A key that no longer exists on the container's props type
 * fails that command with a compile error (`Property '…' does not exist`).
 */

import { expectTypeOf } from "vitest";

import type { AreaChartProps } from "./area-chart";
import type { BarChartProps } from "./bar-chart";
import type { CandlestickChartProps } from "./candlestick-chart";
import type { ComposedChartProps } from "./composed-chart";
import type { DistributionChartProps } from "./distribution/distribution-chart";
import type { HeatmapChartProps } from "./heatmap/heatmap-chart";
import type { LineChartProps } from "./line-chart";
import type { ChartCategoryNavigatorProps, ChartNavigatorProps } from "./navigator/types";
import type { ScatterChartProps } from "./scatter-chart";
import type { ChartSelectionGestureProps } from "./selection/types";

// ── scrollbar (ChartNavigatorProps) — Line, Area, Composed, Candlestick ─────

expectTypeOf<LineChartProps["scrollbar"]>().toEqualTypeOf<ChartNavigatorProps["scrollbar"]>();
expectTypeOf<AreaChartProps["scrollbar"]>().toEqualTypeOf<ChartNavigatorProps["scrollbar"]>();
expectTypeOf<ComposedChartProps["scrollbar"]>().toEqualTypeOf<ChartNavigatorProps["scrollbar"]>();
expectTypeOf<CandlestickChartProps["scrollbar"]>().toEqualTypeOf<
  ChartNavigatorProps["scrollbar"]
>();

// ── maxVisibleItems (ChartCategoryNavigatorProps) — Bar, Heatmap ───────────

expectTypeOf<BarChartProps["maxVisibleItems"]>().toEqualTypeOf<
  ChartCategoryNavigatorProps["maxVisibleItems"]
>();
expectTypeOf<HeatmapChartProps["maxVisibleItems"]>().toEqualTypeOf<
  ChartCategoryNavigatorProps["maxVisibleItems"]
>();

// ── selection gestures (ChartSelectionGestureProps) — every container that
// restated them (all 8 except Candlestick, which never had a gesture layer) ─

expectTypeOf<LineChartProps["selectionGestures"]>().toEqualTypeOf<
  ChartSelectionGestureProps["selectionGestures"]
>();
expectTypeOf<LineChartProps["onSelectionIntent"]>().toEqualTypeOf<
  ChartSelectionGestureProps["onSelectionIntent"]
>();
expectTypeOf<LineChartProps["selectionConfirm"]>().toEqualTypeOf<
  ChartSelectionGestureProps["selectionConfirm"]
>();

expectTypeOf<AreaChartProps["selectionGestures"]>().toEqualTypeOf<
  ChartSelectionGestureProps["selectionGestures"]
>();
expectTypeOf<AreaChartProps["onSelectionIntent"]>().toEqualTypeOf<
  ChartSelectionGestureProps["onSelectionIntent"]
>();
expectTypeOf<AreaChartProps["selectionConfirm"]>().toEqualTypeOf<
  ChartSelectionGestureProps["selectionConfirm"]
>();

expectTypeOf<ComposedChartProps["selectionGestures"]>().toEqualTypeOf<
  ChartSelectionGestureProps["selectionGestures"]
>();
expectTypeOf<ComposedChartProps["onSelectionIntent"]>().toEqualTypeOf<
  ChartSelectionGestureProps["onSelectionIntent"]
>();
expectTypeOf<ComposedChartProps["selectionConfirm"]>().toEqualTypeOf<
  ChartSelectionGestureProps["selectionConfirm"]
>();

expectTypeOf<BarChartProps["selectionGestures"]>().toEqualTypeOf<
  ChartSelectionGestureProps["selectionGestures"]
>();
expectTypeOf<BarChartProps["onSelectionIntent"]>().toEqualTypeOf<
  ChartSelectionGestureProps["onSelectionIntent"]
>();
expectTypeOf<BarChartProps["selectionConfirm"]>().toEqualTypeOf<
  ChartSelectionGestureProps["selectionConfirm"]
>();

expectTypeOf<ScatterChartProps["selectionGestures"]>().toEqualTypeOf<
  ChartSelectionGestureProps["selectionGestures"]
>();
expectTypeOf<ScatterChartProps["onSelectionIntent"]>().toEqualTypeOf<
  ChartSelectionGestureProps["onSelectionIntent"]
>();
expectTypeOf<ScatterChartProps["selectionConfirm"]>().toEqualTypeOf<
  ChartSelectionGestureProps["selectionConfirm"]
>();

expectTypeOf<HeatmapChartProps["selectionGestures"]>().toEqualTypeOf<
  ChartSelectionGestureProps["selectionGestures"]
>();
expectTypeOf<HeatmapChartProps["onSelectionIntent"]>().toEqualTypeOf<
  ChartSelectionGestureProps["onSelectionIntent"]
>();
expectTypeOf<HeatmapChartProps["selectionConfirm"]>().toEqualTypeOf<
  ChartSelectionGestureProps["selectionConfirm"]
>();

expectTypeOf<DistributionChartProps["selectionGestures"]>().toEqualTypeOf<
  ChartSelectionGestureProps["selectionGestures"]
>();
expectTypeOf<DistributionChartProps["onSelectionIntent"]>().toEqualTypeOf<
  ChartSelectionGestureProps["onSelectionIntent"]
>();
expectTypeOf<DistributionChartProps["selectionConfirm"]>().toEqualTypeOf<
  ChartSelectionGestureProps["selectionConfirm"]
>();
