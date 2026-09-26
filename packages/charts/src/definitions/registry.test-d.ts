/**
 * Type tests for the definition registry (RM-175, full equality RM-176). Nothing here runs:
 * the file is checked by `tsc` (`pnpm --filter @elabs-ai/components-charts typecheck`, whose
 * `include` is all of `src`), and vitest never collects a `*.test-d.ts`. A failing
 * `expectTypeOf` or an `@ts-expect-error` that stops being an error fails that command.
 *
 * - every registry key is its definition's id;
 * - `ChartDefinitionId` and `ChartFamilyName` are the SAME set (RM-176: every family the test
 *   double knows now has a definition, so the one-way "every registered id is a known family"
 *   check RM-175 shipped with is tightened to full equality both ways);
 * - the `specTypes` every chart definition declares, unioned, is exactly `ChartType` — every
 *   spec type dispatches to some definition and no definition claims one that does not exist;
 * - every chart, part and surface definition accounts for each of its component's props;
 * - `components.ts` binds each id (chart, part or surface) to a component taking its
 *   definition's props, and only those ids.
 */

import { expectTypeOf } from "vitest";

import type { DefinitionIsComplete, PropsOf } from "@elabs-ai/components-ui/definition";

import type { ChartType } from "../auto-chart/chart-spec";
import type { AreaProps } from "../charts/area";
import type { BarChartProps } from "../charts/bar-chart";
import type { GaugeProps } from "../charts/gauge";
import type { LineChartProps } from "../charts/line-chart";
import type { WaterfallChartProps } from "../charts/waterfall-chart";
import type { XAxisProps } from "../charts/x-axis";
import type { ChartFamilyName } from "../test/doubles";
import type { CHART_COMPONENTS, PART_COMPONENTS, SURFACE_COMPONENTS } from "./components";
import type {
  CHART_DEFINITIONS,
  ChartDefinitionId,
  PART_DEFINITIONS,
  PartDefinitionId,
  SURFACE_DEFINITIONS,
  SurfaceDefinitionId,
} from "./registry";

type Charts = typeof CHART_DEFINITIONS;
type Parts = typeof PART_DEFINITIONS;
type Surfaces = typeof SURFACE_DEFINITIONS;

// Each key is its definition's id.
type KeyIdMismatch<Defs> = {
  [K in keyof Defs]: Defs[K] extends { readonly id: K } ? never : K;
}[keyof Defs];
expectTypeOf<KeyIdMismatch<Charts>>().toEqualTypeOf<never>();
expectTypeOf<KeyIdMismatch<Parts>>().toEqualTypeOf<never>();
expectTypeOf<KeyIdMismatch<Surfaces>>().toEqualTypeOf<never>();

// Every chart family the test double knows now has a definition, and vice versa (RM-176:
// full equality — RM-175 shipped only the "every registered id is a known family" half,
// since 18 families had no definition yet).
expectTypeOf<Exclude<ChartDefinitionId, ChartFamilyName>>().toEqualTypeOf<never>();
expectTypeOf<Exclude<ChartFamilyName, ChartDefinitionId>>().toEqualTypeOf<never>();

// Every `specTypes` entry, across every chart definition, is exactly `ChartType` — full
// equality both ways (RM-176: with 18 more families seeded, every `ChartType` a real
// `AutoChart` dispatch reaches is now claimed by some definition, and none claims a value
// outside the type).
type SpecTypes = Charts[ChartDefinitionId]["specTypes"][number];
expectTypeOf<Exclude<SpecTypes, ChartType>>().toEqualTypeOf<never>();
expectTypeOf<Exclude<ChartType, SpecTypes>>().toEqualTypeOf<never>();
expectTypeOf<Charts["BarChart"]["specTypes"]>().toEqualTypeOf<readonly ["bar", "diverging-bar"]>();

// The kinds.
expectTypeOf<Charts[ChartDefinitionId]["kind"]>().toEqualTypeOf<"chart">();
expectTypeOf<Parts[PartDefinitionId]["kind"]>().toEqualTypeOf<"part">();
expectTypeOf<Surfaces[SurfaceDefinitionId]["kind"]>().toEqualTypeOf<"surface">();

// A definition carries its component's props type.
expectTypeOf<PropsOf<Charts["LineChart"]>>().toEqualTypeOf<LineChartProps>();
expectTypeOf<PropsOf<Charts["BarChart"]>>().toEqualTypeOf<BarChartProps>();
expectTypeOf<PropsOf<Charts["WaterfallChart"]>>().toEqualTypeOf<WaterfallChartProps>();
expectTypeOf<PropsOf<Parts["XAxis"]>>().toEqualTypeOf<XAxisProps>();
expectTypeOf<PropsOf<Parts["Area"]>>().toEqualTypeOf<AreaProps>();
expectTypeOf<PropsOf<Surfaces["Gauge"]>>().toEqualTypeOf<GaugeProps>();

// Every prop is a field, a group member or code-only, on every definition.
type Incomplete<Defs> = {
  [K in keyof Defs]: DefinitionIsComplete<Defs[K]> extends true ? never : K;
}[keyof Defs];
expectTypeOf<Incomplete<Charts>>().toEqualTypeOf<never>();
expectTypeOf<Incomplete<Parts>>().toEqualTypeOf<never>();
expectTypeOf<Incomplete<Surfaces>>().toEqualTypeOf<never>();

// Every registered id, and only those, has a component.
expectTypeOf<keyof typeof CHART_COMPONENTS>().toEqualTypeOf<ChartDefinitionId>();
expectTypeOf<keyof typeof PART_COMPONENTS>().toEqualTypeOf<PartDefinitionId>();
expectTypeOf<keyof typeof SURFACE_COMPONENTS>().toEqualTypeOf<SurfaceDefinitionId>();
