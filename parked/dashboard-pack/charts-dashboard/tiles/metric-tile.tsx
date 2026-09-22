"use client";

import { Gauge } from "lucide-react";
import { MetricCard, type MetricCardSize } from "@elabs-ai/components-ui";

import type { ChartDensity } from "../../charts/chart-config-context";
import { Sparkline } from "../../sparkline/sparkline";
import type { DashboardTileKind, DashboardTileProps } from "../dashboard-sheet/tile-registry";

/** Content of a `metric` tile (RM-072's `MetricCard` tiers + `sparkline` slot). */
export interface MetricTileContent {
  label: string;
  value: number | string;
  delta?: string;
  deltaDirection?: "up" | "down" | "neutral";
  positiveIsGood?: boolean;
  series?: number[];
}

/** Density tier → `MetricCard` tier. `xs` collapses to `sm` (label + value only). */
function metricCardSize(density: ChartDensity): MetricCardSize {
  if (density === "xs") return "sm";
  if (density === "lg") return "lg";
  return "md";
}

function MetricTile({ tile, density }: DashboardTileProps<MetricTileContent>) {
  const { label, value, delta, deltaDirection, positiveIsGood, series } = tile.content;
  const size = metricCardSize(density);
  const showSparkline = density !== "xs" && Boolean(series && series.length > 1);

  return (
    <MetricCard
      // The tile already pads and frames; the card sits flush and centres on the tile's height.
      className="flex size-full flex-col justify-center border-none bg-transparent p-0 shadow-none [&_[data-slot=card-content]]:p-0"
      label={label}
      value={value}
      delta={delta}
      deltaDirection={deltaDirection}
      positiveIsGood={positiveIsGood}
      size={size}
      sparkline={showSparkline ? <Sparkline values={series ?? []} label={label} /> : undefined}
    />
  );
}

/** `metric` — a `MetricCard` KPI with an optional `sparkline` slot. */
export function createMetricTileKind(kind = "metric"): DashboardTileKind<MetricTileContent> {
  return {
    kind,
    label: "Metric", // i18n-exempt: asset-panel label
    icon: Gauge,
    description: "One number, its delta and a sparkline.", // i18n-exempt: asset-panel description
    component: MetricTile,
    defaultSize: { w: 4, h: 2 },
    minSize: { w: 3, h: 2 },
    capabilities: { expand: true },
    configForm: {
      formName: `${kind}-tile`,
      fields: [
        { type: "string", name: "label", label: "Label", required: true },
        { type: "number", name: "value", label: "Value", required: true },
        { type: "string", name: "delta", label: "Change" },
        {
          type: "enum",
          name: "deltaDirection",
          label: "Direction",
          options: ["up", "down", "neutral"],
          default: "neutral",
        },
        { type: "boolean", name: "positiveIsGood", label: "Up is good", default: true },
      ],
    },
    defaultContent: { label: "Metric", value: 0 },
  };
}

/** `createMetricTileKind()` — the `metric` kind. */
export const metricTileKind = createMetricTileKind();
