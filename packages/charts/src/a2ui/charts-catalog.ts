"use client";

/**
 * The charts half of the A2UI catalog (D2): every `@elabs-ai/components-charts` type an
 * agent may name in a surface, bound to its component. The schema half
 * (`CHARTS_A2UI_CATALOG_SCHEMA`) is generated from `catalog.source.json` + the manifest.
 *
 * `ai` may not import `charts`, so an app merges the two halves itself:
 *
 * ```ts
 * import { A2UI_CATALOG_SCHEMA, UI_CATALOG_BINDINGS, createA2uiCatalog } from "@elabs-ai/components-ai";
 * import { CHARTS_A2UI_BINDINGS, CHARTS_A2UI_CATALOG_SCHEMA } from "@elabs-ai/components-charts";
 *
 * const catalog = createA2uiCatalog(
 *   { ...UI_CATALOG_BINDINGS, ...CHARTS_A2UI_BINDINGS },
 *   { ...A2UI_CATALOG_SCHEMA, ...CHARTS_A2UI_CATALOG_SCHEMA },
 * );
 * ```
 */
import { type ComponentType, createElement } from "react";

import { AutoChart } from "../auto-chart";
import { ChartCard } from "../chart-card";
import { BulletChart, Gauge } from "../charts";
import { MetricGrid } from "../metric-grid";
import { Sparkline, type SparklineProps } from "../sparkline";
import { mapRenamedSparklineProps } from "../sparkline/sparkline";

// Erased at the catalog boundary: props are validated against the generated schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see above
type AnyComponent = ComponentType<any>;

/**
 * Sparkline — RM-191. The catalogue still names Sparkline's accessible name `label` (ADR 0042
 * keeps a renamed prop in the catalogue until 7.0.0; RM-197 flags it `deprecated`), so a stored
 * surface may send it. The binding maps the old names itself, silently: an app never sees a
 * deprecation warning for a surface its agent wrote against the catalogue.
 */
function CatalogSparkline(props: SparklineProps) {
  return createElement(Sparkline, mapRenamedSparklineProps(props));
}

/** One binding per type in `CHARTS_A2UI_CATALOG_SCHEMA` (a test asserts the key sets match). */
export const CHARTS_A2UI_BINDINGS: Record<string, AnyComponent> = {
  AutoChart,
  BulletChart,
  ChartCard,
  Gauge,
  MetricGrid,
  Sparkline: CatalogSparkline,
};
