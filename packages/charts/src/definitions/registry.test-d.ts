/**
 * Type tests for the definition registry (RM-175). Nothing here runs: the file is checked by
 * `tsc` (`pnpm --filter @elabs-ai/components-charts typecheck`, whose `include` is all of
 * `src`), and vitest never collects a `*.test-d.ts`. A failing `expectTypeOf` or an
 * `@ts-expect-error` that stops being an error fails that command.
 *
 * - every registry key is its definition's id;
 * - every chart id is a family the test double validates, and every `specTypes` entry a
 *   `ChartType`;
 * - every chart and part definition accounts for each of its component's props;
 * - `components.ts` binds each id to a component taking its definition's props.
 */

import { expectTypeOf } from "vitest";

import type { DefinitionIsComplete, PropsOf } from "@elabs-ai/components-ui/definition";

import type { ChartType } from "../auto-chart/chart-spec";
import type { AreaProps } from "../charts/area";
import type { BarChartProps } from "../charts/bar-chart";
import type { LineChartProps } from "../charts/line-chart";
import type { WaterfallChartProps } from "../charts/waterfall-chart";
import type { XAxisProps } from "../charts/x-axis";
import type { ChartFamilyName } from "../test/doubles";
import type { CHART_COMPONENTS, PART_COMPONENTS } from "./components";
import type {
  CHART_DEFINITIONS,
  ChartDefinitionId,
  PART_DEFINITIONS,
  PartDefinitionId,
} from "./registry";

type Charts = typeof CHART_DEFINITIONS;
type Parts = typeof PART_DEFINITIONS;

// Each key is its definition's id.
type KeyIdMismatch<Defs> = {
  [K in keyof Defs]: Defs[K] extends { readonly id: K } ? never : K;
}[keyof Defs];
expectTypeOf<KeyIdMismatch<Charts>>().toEqualTypeOf<never>();
expectTypeOf<KeyIdMismatch<Parts>>().toEqualTypeOf<never>();

// Every chart is a family the test double knows; every spec type is a `ChartType`.
expectTypeOf<Exclude<ChartDefinitionId, ChartFamilyName>>().toEqualTypeOf<never>();
type SpecTypes = Charts[ChartDefinitionId]["specTypes"][number];
expectTypeOf<Exclude<SpecTypes, ChartType>>().toEqualTypeOf<never>();
expectTypeOf<Charts["BarChart"]["specTypes"]>().toEqualTypeOf<readonly ["bar", "diverging-bar"]>();

// The kinds.
expectTypeOf<Charts[ChartDefinitionId]["kind"]>().toEqualTypeOf<"chart">();
expectTypeOf<Parts[PartDefinitionId]["kind"]>().toEqualTypeOf<"part">();

// A definition carries its component's props type.
expectTypeOf<PropsOf<Charts["LineChart"]>>().toEqualTypeOf<LineChartProps>();
expectTypeOf<PropsOf<Charts["BarChart"]>>().toEqualTypeOf<BarChartProps>();
expectTypeOf<PropsOf<Charts["WaterfallChart"]>>().toEqualTypeOf<WaterfallChartProps>();
expectTypeOf<PropsOf<Parts["XAxis"]>>().toEqualTypeOf<XAxisProps>();
expectTypeOf<PropsOf<Parts["Area"]>>().toEqualTypeOf<AreaProps>();

// Every prop is a field, a group member or code-only, on every definition.
type Incomplete<Defs> = {
  [K in keyof Defs]: DefinitionIsComplete<Defs[K]> extends true ? never : K;
}[keyof Defs];
expectTypeOf<Incomplete<Charts>>().toEqualTypeOf<never>();
expectTypeOf<Incomplete<Parts>>().toEqualTypeOf<never>();

// Every registered id, and only those, has a component.
expectTypeOf<keyof typeof CHART_COMPONENTS>().toEqualTypeOf<ChartDefinitionId>();
expectTypeOf<keyof typeof PART_COMPONENTS>().toEqualTypeOf<PartDefinitionId>();
