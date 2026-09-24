"use client";

/**
 * Chart story — a wafer map: the yield number says how many dies fail, the map
 * says WHERE. 150,000 probed dies coloured by test bin; a scratch runs
 * diagonally, a hot spot sits lower-left. Lasso either and the tiles report the
 * fail share and the mean threshold voltage of just those dies.
 *
 * Copy-own it: `npx shadcn add chart-story-density-wafer-01`.
 */
import { useMemo, useState } from "react";
import {
  ChartFrame,
  DensityScatterChart,
  type DensityScatterSelection,
} from "@elabs-ai/components-charts";
import { FICTIONAL_SOURCE, STORY_BYLINE } from "@/components/chart-story-parts/story-kit";
import { SelectionSummary } from "@/components/density-parts/selection-summary";
import { buildWaferProbe } from "./data";

const mm = (v: number) => `${Math.round(v)} mm`;
const mV = (v: number) => `${Math.round(v)} mV`;
const COLOR_BY = { kind: "category", key: "bin" } as const;

export function ChartStoryDensityWafer({ className }: { className?: string }) {
  const data = useMemo(() => buildWaferProbe(), []);
  const [selection, setSelection] = useState<DensityScatterSelection>({});
  return (
    <div className={className}>
      <ChartFrame
        byline={STORY_BYLINE}
        description="One probed die per point, coloured by its test bin. The pass rate is one number; this shows where the fails are — a scratch running diagonally across the upper half and a hot spot lower-left — which the number cannot."
        features={["expand"]}
        notes="Lasso the scratch or the hot spot: the tiles below give the fail share and the mean threshold voltage of just those dies. Click a legend entry to hide a bin. Esc clears."
        plotHeight={{ base: 480, narrow: 320 }}
        source={FICTIONAL_SOURCE}
        title="The yield loss is not random: a scratch and a hot spot account for most of the fails"
        titleSize="headline"
      >
        <DensityScatterChart
          accessibleLabel="Wafer map of probed dies coloured by test bin"
          colorBy={COLOR_BY}
          data={data}
          formatValue={mV}
          formatX={mm}
          formatY={mm}
          legend
          onSelectionChange={setSelection}
          selection={selection}
          selectionField="dieX"
          selectionFieldY="dieY"
          selectionGestures={["range", "lasso"]}
          valueKey="vth"
          xLabel="Die x"
          yLabel="Die y"
        />
      </ChartFrame>
      <div className="mt-4">
        <SelectionSummary
          category={{ key: "bin", value: "Fail", label: "failing" }}
          data={data}
          formatValue={mV}
          noun="dies"
          selection={selection}
          valueKey="vth"
          valueLabel="threshold voltage"
        />
      </div>
    </div>
  );
}
