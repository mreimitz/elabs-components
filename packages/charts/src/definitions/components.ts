/**
 * Binds each registered definition to the React component it describes (ADR 0042 §6,
 * RM-175). The one module under `definitions/` that imports renderers: the registry and
 * every definition stay pure, and a consumer that only reads definitions (a form, a JSON
 * schema, an agent's catalog) never loads a chart engine by importing them.
 *
 * The compiler checks each binding: every registered id has a component, no other id
 * does, and each component accepts the props its definition describes.
 *
 * Append-only: each entry sits under a `// <Name> — RM-NNN` comment naming the item that
 * added it.
 */

import type { JSXElementConstructor } from "react";

import type { PropsOf } from "@elabs-ai/components-ui/definition";

// LineChart — RM-175
import { LineChart } from "../charts/line-chart";
// AreaChart — RM-175
import { AreaChart } from "../charts/area-chart";
// ComposedChart — RM-175
import { ComposedChart } from "../charts/composed-chart";
// BarChart — RM-175
import { BarChart } from "../charts/bar-chart";
// ScatterChart — RM-175
import { ScatterChart } from "../charts/scatter-chart";
// CandlestickChart — RM-175
import { CandlestickChart } from "../charts/candlestick-chart";
// LiveLineChart — RM-175
import { LiveLineChart } from "../charts/live-line-chart";
// WaterfallChart — RM-175
import { WaterfallChart } from "../charts/waterfall-chart";
// XAxis — RM-175
import { XAxis } from "../charts/x-axis";
// YAxis — RM-175
import { YAxis } from "../charts/y-axis";
// BarValueAxis — RM-175
import { BarValueAxis } from "../charts/bar-value-axis";
// LiveXAxis — RM-175
import { LiveXAxis } from "../charts/live-x-axis";
// Grid — RM-175
import { Grid } from "../charts/grid";
// Bar — RM-175
import { Bar } from "../charts/bar";
// Line — RM-175
import { Line } from "../charts/line";
// Area — RM-175
import { Area } from "../charts/area";
// Scatter — RM-175
import { Scatter } from "../charts/scatter";
// ReferenceLine — RM-175
import { ReferenceLine } from "../charts/reference-line";
import type {
  CHART_DEFINITIONS,
  ChartDefinitionId,
  PART_DEFINITIONS,
  PartDefinitionId,
} from "./registry";

/** Each id's component, accepting the props its definition describes. */
type ComponentsFor<Defs, Id extends keyof Defs> = {
  readonly [K in Id]: JSXElementConstructor<PropsOf<Defs[K]>>;
};

/** The component each chart definition describes, keyed by the definition's id. */
export const CHART_COMPONENTS = {
  // LineChart — RM-175
  LineChart,
  // AreaChart — RM-175
  AreaChart,
  // ComposedChart — RM-175
  ComposedChart,
  // BarChart — RM-175
  BarChart,
  // ScatterChart — RM-175
  ScatterChart,
  // CandlestickChart — RM-175
  CandlestickChart,
  // LiveLineChart — RM-175
  LiveLineChart,
  // WaterfallChart — RM-175
  WaterfallChart,
} as const satisfies ComponentsFor<typeof CHART_DEFINITIONS, ChartDefinitionId>;

/** The component each part definition describes, keyed by the definition's id. */
export const PART_COMPONENTS = {
  // XAxis — RM-175
  XAxis,
  // YAxis — RM-175
  YAxis,
  // BarValueAxis — RM-175
  BarValueAxis,
  // LiveXAxis — RM-175
  LiveXAxis,
  // Grid — RM-175
  Grid,
  // Bar — RM-175
  Bar,
  // Line — RM-175
  Line,
  // Area — RM-175
  Area,
  // Scatter — RM-175
  Scatter,
  // ReferenceLine — RM-175
  ReferenceLine,
} as const satisfies ComponentsFor<typeof PART_DEFINITIONS, PartDefinitionId>;
