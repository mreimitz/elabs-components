import type { WaterfallCallout, WaterfallDatum } from "@elabs-ai/components-charts";

/**
 * Same fictional company, quarter and snapshot date as the shared Acme
 * Logistics Q3 dataset (`kpi-card-parts/data/acme-quarter.ts`), but this
 * block reasons about REVENUE, which that dataset does not carry — so it
 * defines its own bridge scenarios here rather than importing one. Every
 * step below is a typed FACT; the ending total and the net-change caption
 * are both COMPUTED from the steps via `.reduce()`, never retyped, so the
 * chart and the words can never silently drift apart
 * (`.claude/rules/charts.md` § Honesty).
 */

interface BridgeStep {
  label: string;
  delta: number;
}

export interface RevenueBridgeScenario {
  id: string;
  /** States the finding in words — never left for the reader to infer. */
  headline: string;
  startLabel: string;
  endLabel: string;
  startTotal: number;
  endTotal: number;
  data: WaterfallDatum[];
  callouts: WaterfallCallout[];
  methodNote: string;
}

function buildScenario(params: {
  id: string;
  headline: string;
  startLabel: string;
  endLabel: string;
  startTotal: number;
  steps: BridgeStep[];
  calloutLabel: string;
  calloutNote: string;
  methodNote: string;
}): RevenueBridgeScenario {
  const endTotal = params.startTotal + params.steps.reduce((sum, step) => sum + step.delta, 0);
  const data: WaterfallDatum[] = [
    { kind: "total", label: params.startLabel, value: params.startTotal },
    ...params.steps.map((step) => ({ label: step.label, value: step.delta })),
    { kind: "total", label: params.endLabel, value: endTotal },
  ];
  return {
    callouts: [{ label: params.calloutLabel, note: params.calloutNote }],
    data,
    endLabel: params.endLabel,
    endTotal,
    headline: params.headline,
    id: params.id,
    methodNote: params.methodNote,
    startLabel: params.startLabel,
    startTotal: params.startTotal,
  };
}

/** Price carried the quarter; a mix headwind and FX both worked against it. */
export const priceLedBridge: RevenueBridgeScenario = buildScenario({
  calloutLabel: "Price",
  calloutNote: "The main driver",
  endLabel: "Q3 revenue",
  headline: "Price, not volume, carried Q3",
  id: "price-led",
  methodNote: "Revenue bridge, Q2 → Q3 total revenue, by driver.",
  startLabel: "Q2 revenue",
  startTotal: 2_650_000,
  steps: [
    { delta: 210_000, label: "Price" },
    { delta: 35_000, label: "Volume" },
    { delta: -20_000, label: "Mix" },
    { delta: -30_000, label: "FX" },
    { delta: 10_000, label: "Other" },
  ],
});

/** Alternate quarter: a volume collapse overwhelms every other driver combined. */
export const volumeLossBridge: RevenueBridgeScenario = buildScenario({
  calloutLabel: "Volume",
  calloutNote: "The main driver",
  endLabel: "Q3 revenue",
  headline: "Volume loss overwhelmed price gains in Q3",
  id: "volume-loss",
  methodNote: "Revenue bridge, Q2 → Q3 total revenue, by driver.",
  startLabel: "Q2 revenue",
  startTotal: 2_650_000,
  steps: [
    { delta: 40_000, label: "Price" },
    { delta: -150_000, label: "Volume" },
    { delta: 15_000, label: "Mix" },
    { delta: -10_000, label: "FX" },
    { delta: 5_000, label: "Other" },
  ],
});

/**
 * A narrow-column reading of `scenario`: every driver EXCEPT the callout's
 * own step collapses into one "Rest of drivers" bar, so a 320px-or-narrower
 * column has only 4 bars to fit instead of 7. The rest bar's value is a SUM
 * of the collapsed steps, so the total still ties out exactly to the same
 * ending total as the full scenario — grouping never re-derives a number.
 */
export function collapseForCompact(scenario: RevenueBridgeScenario): RevenueBridgeScenario {
  const dominantLabel = scenario.callouts[0]?.label;
  const middle = scenario.data.slice(1, -1);
  const dominant = middle.find((step) => step.label === dominantLabel);
  const rest = middle.filter((step) => step.label !== dominantLabel);
  const restTotal = rest.reduce((sum, step) => sum + step.value, 0);
  const data: WaterfallDatum[] = [
    scenario.data[0] as WaterfallDatum,
    ...(dominant ? [dominant] : []),
    { label: "Rest of drivers", value: restTotal },
    scenario.data[scenario.data.length - 1] as WaterfallDatum,
  ];
  return { ...scenario, data };
}
