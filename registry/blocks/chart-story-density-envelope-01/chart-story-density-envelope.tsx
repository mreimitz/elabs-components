"use client";

/**
 * Chart story — a flight-test envelope: every recorded position, not an average.
 *
 * 200,000 fixes along an approach, along-track distance against cross-track
 * deviation, coloured by the zone of the operational design domain each one
 * falls in. Where the core corridor is solid, the density is; zoom in and it
 * resolves into the individual fixes. The toolbar's Range and Lasso tools
 * select fixes; drag an axis for a one-axis range; the tiles below add up
 * whatever is selected.
 *
 * Copy-own it: `npx shadcn add chart-story-density-envelope-01`.
 */
import { useMemo, useState } from "react";
import {
  ChartFrame,
  DensityScatterChart,
  type DensityScatterSelection,
} from "@elabs-ai/components-charts";
import { FICTIONAL_SOURCE, STORY_BYLINE } from "@/components/chart-story-parts/story-kit";
import { SelectionSummary } from "@/components/density-parts/selection-summary";
import { APPROACH_ZONES, buildApproachTraffic } from "./data";

const metres = (v: number) =>
  Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)} km` : `${Math.round(v)} m`;
const knots = (v: number) => `${Math.round(v)} kt`;
const DOMAIN = { y0: -240, y1: 240 };

export function ChartStoryDensityEnvelope({ className }: { className?: string }) {
  const data = useMemo(() => buildApproachTraffic(), []);
  const [selection, setSelection] = useState<DensityScatterSelection>({});
  return (
    <div className={className}>
      <ChartFrame
        byline={STORY_BYLINE}
        description="Every recorded position of the campaign — along-track distance against cross-track deviation — coloured by the zone it falls in. Nothing is averaged: where the corridor looks solid, that is how many fixes there are. Zoom in and the band resolves into single fixes."
        features={["expand"]}
        notes="Use Range or Lasso in the toolbar to select fixes, or drag along an axis for a one-axis range; Shift-click a legend entry to keep only that zone. Esc clears. The tiles below total the selection."
        plotHeight={{ base: 420, narrow: 300 }}
        source={FICTIONAL_SOURCE}
        title="Lateral deviation stays inside the core corridor past the throat; the excursions are the arrivals joining from below"
        titleSize="headline"
      >
        <DensityScatterChart
          accessibleLabel="Lateral deviation of every recorded position against the operational design domain"
          data={data}
          domain={DOMAIN}
          formatValue={knots}
          formatX={metres}
          formatY={metres}
          legend
          onSelectionChange={setSelection}
          selection={selection}
          selectionField="alongTrack"
          selectionFieldY="crossTrack"
          selectionGestures={["range", "lasso"]}
          valueKey="speed"
          xLabel="Along-track distance"
          yLabel="Cross-track deviation"
          zones={APPROACH_ZONES}
        />
      </ChartFrame>
      <div className="mt-4">
        <SelectionSummary
          data={data}
          formatValue={knots}
          noun="fixes"
          selection={selection}
          valueKey="speed"
          valueLabel="ground speed"
          zones={APPROACH_ZONES}
        />
      </div>
    </div>
  );
}
