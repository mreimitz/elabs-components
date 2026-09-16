import type { WaterfallCallout, WaterfallDatum } from "@elabs-ai/components-charts";

/**
 * Same fictional company, quarter and snapshot date as the shared Acme
 * Logistics Q3 dataset (`kpi-card-parts/data/acme-quarter.ts`), but this
 * block reasons about REVENUE, which that dataset does not carry — so it
 * defines its own bridge scenarios here rather than importing one. Every
 * step below is a typed FACT; the net change and its bar are both COMPUTED
 * from the steps via `.reduce()`, never retyped, so the chart and the words
 * can never silently drift apart (`.claude/rules/charts.md` § Honesty).
 *
 * The chart itself is a zero-based waterfall of the DELTAS ONLY (Price,
 * Volume, Mix, FX, Other, ending in a "Net change" total bar) — never the
 * Q2/Q3 revenue totals themselves: at those totals' own scale (millions),
 * a driver's few-hundred-thousand delta would be a sliver a couple of
 * pixels tall, and truncating the total bars to make the deltas legible
 * again is dishonest (`.claude/rules/charts.md` § Honesty — bars are
 * zero-based). The Q2 → Q3 endpoints are instead stated as text, above the
 * chart, in `endpointsCaption`.
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
  netChange: number;
  /** Delta-only, zero-based waterfall data — see the module doc above. */
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
  const netChange = params.steps.reduce((sum, step) => sum + step.delta, 0);
  const endTotal = params.startTotal + netChange;
  const data: WaterfallDatum[] = [
    ...params.steps.map((step) => ({ label: step.label, value: step.delta })),
    // "Net" not "Net change": `planCategoryAxis` (`.claude/rules/charts.md` §
    // Category axis) picks ONE mode for every bar from the WIDEST kept label —
    // "Net change" alone was wide enough to force all six bars into the 45°
    // tilted mode the brief explicitly rules out. The full phrase is already
    // in `endpointsCaption`'s prose above the chart.
    { kind: "total", label: "Net", value: netChange },
  ];
  return {
    callouts: [{ label: params.calloutLabel, note: params.calloutNote }],
    data,
    endLabel: params.endLabel,
    endTotal,
    headline: params.headline,
    id: params.id,
    methodNote: params.methodNote,
    netChange,
    startLabel: params.startLabel,
    startTotal: params.startTotal,
  };
}

/** Price carried the quarter; a mix headwind and FX both worked against it. */
export const priceLedBridge: RevenueBridgeScenario = buildScenario({
  calloutLabel: "Price",
  calloutNote: "The main driver",
  endLabel: "Q3",
  headline: "Price, not volume, carried Q3",
  id: "price-led",
  methodNote: "By driver, Q2 → Q3 total revenue.",
  startLabel: "Q2",
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
  endLabel: "Q3",
  headline: "Volume loss overwhelmed price gains in Q3",
  id: "volume-loss",
  methodNote: "By driver, Q2 → Q3 total revenue.",
  startLabel: "Q2",
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
 * own step collapses into one "Rest" bar, so a 320px-or-narrower column has
 * only 3 bars to fit instead of 6. The rest bar's value is a SUM of the
 * collapsed steps, so the net change still ties out exactly to the same
 * value as the full scenario — grouping never re-derives a number.
 */
export function collapseForCompact(scenario: RevenueBridgeScenario): RevenueBridgeScenario {
  const dominantLabel = scenario.callouts[0]?.label;
  const steps = scenario.data.slice(0, -1);
  const dominant = steps.find((step) => step.label === dominantLabel);
  const rest = steps.filter((step) => step.label !== dominantLabel);
  const restTotal = rest.reduce((sum, step) => sum + step.value, 0);
  const data: WaterfallDatum[] = [
    ...(dominant ? [dominant] : []),
    { label: "Rest", value: restTotal },
    scenario.data[scenario.data.length - 1] as WaterfallDatum,
  ];
  return { ...scenario, data };
}
