"use client";

/**
 * Density scatter — three real-life uses of a plot with 10⁵+ individual points.
 *
 * The chart draws EVERY point (no averaging once a size limit is reached) and
 * lets the density carry the colour, so a solid shape at full zoom resolves
 * into individual dots as you zoom in. Zones on the axes classify each point;
 * an x range, a y range, a lasso and a zone pick intersect into one selection.
 *
 * - `approach` — flight test: 200k recorded positions against the operational
 *   design domain (a core corridor and an expanded envelope that narrows).
 * - `wafer` — semiconductor: 150k probed dies coloured by test bin, the wafer
 *   map that shows a scratch and a hot spot the yield number hides.
 * - `fills` — trading: 250k order fills, size against latency, with SLA bands
 *   on the latency axis and slippage as the tooltip's mean.
 *
 * Copy-own it: `npx shadcn add density-scatter-01`.
 */
import { useMemo, useState } from "react";
import {
  ChartFrame,
  DensityScatterChart,
  type DensityScatterSelection,
} from "@elabs-ai/components-charts";
import { FICTIONAL_SOURCE, STORY_BYLINE } from "@/components/chart-story-parts/story-kit";
import {
  APPROACH_ZONES,
  buildApproachTraffic,
  buildFillLatency,
  buildWaferProbe,
  LATENCY_ZONES,
} from "./data";

export type DensityScatterUseCase = "approach" | "wafer" | "fills";

export interface DensityScatterBlockProps {
  useCase?: DensityScatterUseCase;
  /** Point count for the figure (each use case has its own default). */
  points?: number;
  className?: string;
}

const nf = new Intl.NumberFormat("en");
const metres = (v: number) =>
  Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`;
const ms = (v: number) => `${v < 10 ? v.toFixed(1) : Math.round(v)} ms`;
const usd = (log10: number) => {
  const v = 10 ** log10;
  return v >= 1e6
    ? `$${(v / 1e6).toFixed(1)}M`
    : v >= 1e3
      ? `$${Math.round(v / 1e3)}k`
      : `$${Math.round(v)}`;
};

function SelectionNote({
  selection,
  total,
}: {
  selection: DensityScatterSelection;
  total: number;
}) {
  const parts: string[] = [];
  if (selection.x) parts.push("an x range");
  if (selection.y) parts.push("a y range");
  if (selection.lasso) parts.push("a lasso");
  if (selection.zones?.length)
    parts.push(`${selection.zones.length} zone${selection.zones.length > 1 ? "s" : ""}`);
  return (
    <span className="text-meta text-muted-foreground">
      {parts.length
        ? `Selection: ${parts.join(" ∩ ")} — the intersection of every constraint, over ${nf.format(total)} points.`
        : `Drag the bottom axis for an x range, the left axis for a y range; Shift-click a legend entry to select its zone. ${nf.format(total)} points drawn, none averaged.`}
    </span>
  );
}

export function DensityScatterBlock({
  useCase = "approach",
  points,
  className,
}: DensityScatterBlockProps) {
  const [selection, setSelection] = useState<DensityScatterSelection>({});

  const approach = useMemo(
    () => (useCase === "approach" ? buildApproachTraffic(points ?? 200_000) : null),
    [useCase, points],
  );
  const wafer = useMemo(
    () => (useCase === "wafer" ? buildWaferProbe(points ?? 150_000) : null),
    [useCase, points],
  );
  const fills = useMemo(
    () => (useCase === "fills" ? buildFillLatency(points ?? 250_000) : null),
    [useCase, points],
  );

  if (approach) {
    return (
      <ChartFrame
        byline={STORY_BYLINE}
        className={className}
        description="Every recorded position of the test campaign — along-track distance against cross-track deviation — coloured by the zone it falls in. Where the core is solid, the density is; zoom in and it resolves into the individual fixes."
        features={["expand"]}
        notes={<SelectionNote selection={selection} total={approach.x.length} />}
        plotHeight={{ base: 420, narrow: 300 }}
        source={FICTIONAL_SOURCE}
        title="Lateral deviation stays inside the core corridor past the throat; the excursions are the arrivals joining from below"
        titleSize="headline"
      >
        <DensityScatterChart
          accessibleLabel="Lateral deviation of every recorded position against the operational design domain"
          data={approach}
          domain={{ y0: -240, y1: 240 }}
          formatValue={(v) => `${Math.round(v)} kt`}
          formatX={metres}
          formatY={metres}
          legend
          onSelectionChange={setSelection}
          selection={selection}
          selectionField="alongTrack"
          selectionFieldY="crossTrack"
          selectionGestures={["range", "lasso"]}
          valueKey="speed"
          xLabel="Along-track distance (m)"
          yLabel="Cross-track deviation (m)"
          zones={APPROACH_ZONES}
        />
      </ChartFrame>
    );
  }

  if (wafer) {
    return (
      <ChartFrame
        byline={STORY_BYLINE}
        className={className}
        description="One probed die per point on a 300 mm wafer, coloured by its test bin. The pass rate is a single number; the map shows WHERE the fails are — a scratch running diagonally and a hot spot lower-left — which the number cannot."
        features={["expand"]}
        notes={<SelectionNote selection={selection} total={wafer.x.length} />}
        plotHeight={{ base: 480, narrow: 320 }}
        source={FICTIONAL_SOURCE}
        title="The yield loss is not random: a scratch and a hot spot account for most fails"
        titleSize="headline"
      >
        <DensityScatterChart
          accessibleLabel="Wafer map of probed dies coloured by test bin"
          colorBy={{ kind: "category", key: "bin" }}
          data={wafer}
          formatValue={(v) => `${Math.round(v)} mV`}
          legend
          onSelectionChange={setSelection}
          selection={selection}
          selectionField="dieX"
          selectionFieldY="dieY"
          selectionGestures={["range", "lasso"]}
          valueKey="vth"
          xLabel="Die x (mm)"
          yLabel="Die y (mm)"
        />
      </ChartFrame>
    );
  }

  return (
    <ChartFrame
      byline={STORY_BYLINE}
      className={className}
      description="Every fill of the day: order size against the time it took to fill, with service-level bands on the latency axis. The retail cloud sits well inside the SLA; block trades get slower with size; the band at 48 ms is one venue."
      features={["expand"]}
      notes={<SelectionNote selection={selection} total={fills?.x.length ?? 0} />}
      plotHeight={{ base: 420, narrow: 300 }}
      source={FICTIONAL_SOURCE}
      title="Fill latency is a size problem above $150k — and a venue problem at 48 ms regardless of size"
      titleSize="headline"
    >
      <DensityScatterChart
        accessibleLabel="Order fills by size and latency against the SLA bands"
        data={fills!}
        formatValue={(v) => `${v.toFixed(1)} bp slippage`}
        formatX={usd}
        formatY={ms}
        legend
        onSelectionChange={setSelection}
        outside={{ label: "Breach (> 45 ms)" }}
        selection={selection}
        selectionField="orderSize"
        selectionFieldY="latency"
        selectionGestures={["range", "lasso"]}
        valueKey="slippage"
        xLabel="Order size (log scale)"
        yLabel="Fill latency (ms)"
        zones={LATENCY_ZONES}
      />
    </ChartFrame>
  );
}
