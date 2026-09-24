"use client";

/**
 * Chart story — fill latency for every order of the day, against the SLA bands.
 * 250,000 fills, order size against the time it took to fill. The retail cloud
 * sits well inside the SLA; block trades get slower with size; the band at
 * 48 ms is one venue. Select the block-trade tail with Range and the tiles
 * report its SLA share and mean slippage.
 *
 * Copy-own it: `npx shadcn add chart-story-density-fills-01`.
 */
import { useMemo, useState } from "react";
import {
  ChartFrame,
  DensityScatterChart,
  type DensityScatterSelection,
} from "@elabs-ai/components-charts";
import { FICTIONAL_SOURCE, STORY_BYLINE } from "@/components/chart-story-parts/story-kit";
import { SelectionSummary } from "@/components/density-parts/selection-summary";
import { buildFillLatency, LATENCY_ZONES } from "./data";

const ms = (v: number) => `${v < 10 ? v.toFixed(1) : Math.round(v)} ms`;
const bp = (v: number) => `${v.toFixed(1)} bp`;
const usd = (log10: number) => {
  const v = 10 ** log10;
  return v >= 1e6
    ? `$${(v / 1e6).toFixed(1)}M`
    : v >= 1e3
      ? `$${Math.round(v / 1e3)}k`
      : `$${Math.round(v)}`;
};

export function ChartStoryDensityFills({ className }: { className?: string }) {
  const data = useMemo(() => buildFillLatency(), []);
  const [selection, setSelection] = useState<DensityScatterSelection>({});
  return (
    <div className={className}>
      <ChartFrame
        byline={STORY_BYLINE}
        description="Every fill of the day: order size against the time it took to fill, with the service-level bands drawn on the latency axis. The retail cloud sits well inside the SLA; block trades get slower the bigger they are; the band at 48 ms is a single venue, whatever the size."
        features={["expand"]}
        notes="Range in the toolbar: drag a box over the block-trade tail (right of $150k) — the tiles below give its SLA share and mean slippage. Drag along the latency axis for the 48 ms band alone. Esc clears."
        plotHeight={{ base: 420, narrow: 300 }}
        source={FICTIONAL_SOURCE}
        title="Fill latency is a size problem above $150k — and a venue problem at 48 ms regardless of size"
        titleSize="headline"
      >
        <DensityScatterChart
          accessibleLabel="Order fills by size and latency against the SLA bands"
          data={data}
          formatValue={bp}
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
          xLabel="Order size"
          yLabel="Fill latency"
          zones={LATENCY_ZONES}
        />
      </ChartFrame>
      <div className="mt-4">
        <SelectionSummary
          data={data}
          formatValue={bp}
          noun="fills"
          selection={selection}
          valueKey="slippage"
          valueLabel="slippage"
          zones={LATENCY_ZONES}
        />
      </div>
    </div>
  );
}
