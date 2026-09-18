/**
 * The assistant tab's transcript (RM-095, concept §4.2 "a copilot that shows its work"): a
 * user asks why churn rose in EMEA, the assistant reasons, calls `query_kpis`, cites two
 * sources and returns an `AutoChart` spec as an artifact. Every number below is READ from
 * `kpis.ts`, never retyped, so the transcript can never disagree with the KPI strip it sits
 * beside on the same page.
 *
 * Types only, per D6 / ADR 0008 — `ai` never ships a runtime import from this package.
 */
import type { UIMessage } from "ai";
import type { ChartSpec } from "@elabs-ai/components-charts";
import { CHURN_BY_REGION, CHURN_SERIES, headlineDelta, headlineValue } from "./kpis";
import { FISCAL_QUARTER } from "./company";

const pct = (n: number): string => `${n.toFixed(1)}%`;

const overallStart = CHURN_SERIES.points[0]!.value;
const overallEnd = headlineValue(CHURN_SERIES);
const overallDelta = headlineDelta(CHURN_SERIES);

const emeaSeries = CHURN_BY_REGION.EMEA;
const emeaEnd = headlineValue(emeaSeries);
const emeaDelta = headlineDelta(emeaSeries);

/** The chart artifact — the SAME overall churn series `kpis.ts` and the KPI strip read. */
const churnChartSpec: ChartSpec = {
  type: "line",
  x: "week",
  series: [{ key: "value", label: "Logo churn" }],
  data: CHURN_SERIES.points.map((p) => ({ week: p.week, value: p.value })),
  valueFormat: "percent",
  title: `Logo churn — ${FISCAL_QUARTER}`,
  description: `Company-wide logo churn, ${pct(overallStart)} to ${pct(overallEnd)} across the quarter.`,
};

export const CONVERSATION_ID = "conv-churn-emea-q3";

export const CONVERSATION: UIMessage[] = [
  {
    id: "msg-user-1",
    role: "user",
    parts: [{ type: "text", text: "Why did churn rise in EMEA this quarter?" }],
  },
  {
    id: "msg-assistant-1",
    role: "assistant",
    parts: [
      {
        type: "reasoning",
        state: "done",
        text: "The user is asking about a regional churn trend, not the company-wide number. I'll pull the churn KPI series, then break it out by region to see whether EMEA is actually the outlier before I answer.",
      },
      {
        type: "tool-query_kpis",
        toolCallId: "call-query-kpis-1",
        state: "output-available",
        input: { metric: "churn", breakdown: "region", quarter: FISCAL_QUARTER },
        output: {
          overall: CHURN_SERIES.points,
          byRegion: Object.fromEntries(
            Object.entries(CHURN_BY_REGION).map(([region, series]) => [region, series.points]),
          ),
        },
      },
      {
        type: "source-url",
        sourceId: "src-billing-cloud-eu-incident",
        url: "https://status.ashgrove.example/incidents/eu-billing-latency-2026-08",
        title: "Billing Cloud EU — elevated latency, 2026-08-12",
      },
      {
        type: "source-url",
        sourceId: "src-renewals-studio-emea-note",
        url: "https://intranet.ashgrove.example/renewals/emea-q3-notes",
        title: "Renewals Studio — EMEA Q3 account notes",
      },
      {
        type: "data-chart",
        id: "artifact-churn-emea",
        data: churnChartSpec,
      },
      {
        type: "text",
        text: `Company-wide logo churn rose from ${pct(overallStart)} to ${pct(overallEnd)} this quarter (+${pct(overallDelta)}), and EMEA is the largest driver: EMEA alone reached ${pct(emeaEnd)} (+${pct(emeaDelta)}), against a much flatter trend everywhere else. The EU billing-latency incident in August and a cluster of EMEA renewal notes line up with the timing — worth a closer look before the Q4 renewal push.`,
      },
    ],
  },
];
