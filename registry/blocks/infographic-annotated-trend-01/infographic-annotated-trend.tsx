"use client";

/**
 * Infographic — "What happened, and when?".
 *
 * A weekly line with up to three events labelled on the data point they
 * explain, inside a `ChartFrame` that carries the editorial chrome: the
 * headline as the title, the method note as `notes`, a byline and the source
 * row (RM-117).
 *
 * The notes are DECLARATIVE (`annotations`, RM-111), not hand-drawn marks:
 * each event becomes a `text` annotation in DATA units with a `connector` to
 * its own point, so the engine — not this block — owns collision avoidance,
 * the plot bounds, the narrow-tier fallback (numbered markers plus a key
 * under the plot) and the restatement of every note in the figure's text
 * alternative. Placement stays a deliberate editorial choice:
 *
 * - a genuine series PEAK labels ABOVE (nothing above it to collide with) and
 *   a genuine TROUGH labels BELOW; any other event labels away from the
 *   nearer half, so an ordinary mid-height note never lands on the curve;
 * - an event within `NOTE_EDGE_ZONE` of either end of the window hangs its
 *   note FROM the point (anchor `sw`/`se`) instead of centring it on the
 *   point, so a long label near an edge reads inwards rather than overflowing.
 *
 * Copy-own it: `npx shadcn add infographic-annotated-trend-01`.
 */

import {
  type AnnotationAnchor,
  type ChartAnnotation,
  ChartFrame,
  Grid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "@elabs-ai/components-charts";
import { AS_OF_DATE, DATA_SOURCE } from "@/components/kpi-card-parts/data/acme-quarter";
import { formatAsOf, formatKpiValue } from "@/components/kpi-card-parts/format";
import { ordersTrend, type AnnotatedTrendSeries, type TrendPoint } from "./data/annotated-trend";

export interface InfographicAnnotatedTrendProps {
  /** Defaults to weekly shipped orders — the price change / depot outage / campaign story. */
  series?: AnnotatedTrendSeries;
  locale?: string;
  /** Renders `ChartFrame`'s layout-shaped skeleton instead of the real chart. Default false. */
  loading?: boolean;
  className?: string;
}

/** How far from either end of the window a note starts hanging from its point instead of centring on it. */
const NOTE_EDGE_ZONE = 0.15;
/** How far a note sits from its point, as a share of the series' own value range. */
const NOTE_OFFSET_RATIO = 0.16;
/** Widest note line, as a percentage of the plot width (`ChartTextAnnotation.width`). */
const NOTE_WIDTH = 26;
/** Air under / over the series, as a share of its own range, so the notes have somewhere to sit. */
const DOMAIN_PAD_BELOW = 0.4;
const DOMAIN_PAD_ABOVE = 0.25;

/**
 * `YAxis`'s tick formatter — routed through the same `formatKpiValue` every
 * other number in this card uses, rather than `YAxis`'s own
 * `valueFormat="percent"`: that format expects a 0–1 FRACTION
 * (`packages/charts/src/charts/value-format.ts`), but this series's
 * `"percent"` unit, like every KPI card's, is already a 0–100 point value —
 * passing it through `valueFormat="percent"` would misread 93.5 as 9,350%.
 */
function yAxisFormatValue(unit: AnnotatedTrendSeries["unit"], locale: string) {
  return (value: number) => formatKpiValue(value, unit, locale);
}

/** One `text` annotation per event, anchored to the point it explains. */
function trendAnnotations(series: AnnotatedTrendSeries): ChartAnnotation[] {
  const values = series.points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const first = series.points[0]?.date.getTime() ?? 0;
  const last = series.points[series.points.length - 1]?.date.getTime() ?? first;
  const window = last - first || 1;

  return series.events.map((event) => {
    const below =
      event.value === max ? false : event.value === min ? true : event.value >= (min + max) / 2;
    const position = (event.date.getTime() - first) / window;
    const side = position <= NOTE_EDGE_ZONE ? "w" : position >= 1 - NOTE_EDGE_ZONE ? "e" : "";
    return {
      anchor: `${below ? "n" : "s"}${side}` as AnnotationAnchor,
      color: "series:value",
      connector: { kind: "curve", to: { x: event.date, y: event.value } },
      kind: "text",
      text: event.label,
      width: NOTE_WIDTH,
      x: event.date,
      y: below ? event.value - span * NOTE_OFFSET_RATIO : event.value + span * NOTE_OFFSET_RATIO,
    } satisfies ChartAnnotation;
  });
}

/** The frame's flip-to-table and CSV rows: the week's own date, already worded. */
function trendRows(points: TrendPoint[], locale: string): Record<string, unknown>[] {
  const week = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  return points.map((point) => ({ value: point.value, week: week.format(point.date) }));
}

/**
 * "What happened, and when?" — a weekly line with up to three events
 * labelled directly on the data point they explain, never a legend. The
 * frame's title states the finding; the chart shows it; the note and the
 * source row close the read.
 */
export function InfographicAnnotatedTrend({
  series = ordersTrend,
  locale = "en-US",
  loading = false,
  className,
}: InfographicAnnotatedTrendProps) {
  const { label, unit, points, events, headline, methodNote } = series;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  // A LINE carries change, not magnitude, so its value axis is framed around
  // the series rather than pinned to zero (`charts-honesty` requires a
  // zero-based domain for LENGTH marks — bars — not for a trend line). Left
  // to the engine's own zero-including default, a 520–735 series reads as an
  // almost flat line in the top quarter of the plot, and the notes have no
  // room between the curve and the frame.
  const valueDomain: [number, number] = [
    min - span * DOMAIN_PAD_BELOW,
    max + span * DOMAIN_PAD_ABOVE,
  ];
  const range = `${label}, weekly, ${points.length} points, ranging from ${formatKpiValue(min, unit, locale)} to ${formatKpiValue(max, unit, locale)}`;
  // The chart's own description stops at the series; the annotation engine
  // appends every note to it in array order (`withAnnotationDescription`), so
  // listing the events here as well would read them out twice. Their readings
  // stay reachable: the frame's flip-to-table and CSV carry every week.
  const summary = `${range}. ${events.length} events are labelled on the chart, in reading order.`;
  const altText = `${range}. Labelled events: ${events
    .map((event) => `${event.label} (${formatKpiValue(event.value, unit, locale)})`)
    .join("; ")}.`;

  return (
    <ChartFrame
      altText={altText}
      byline={{ author: "Acme Logistics analytics", kind: "chart" }}
      className={className}
      columns={[
        { key: "week", header: "Week ending" },
        { key: "value", header: label },
      ]}
      data={trendRows(points, locale)}
      description={`${label}, weekly, over the last ${points.length} weeks.`}
      loading={loading}
      notes={methodNote}
      source={{ name: `${DATA_SOURCE}, as of ${formatAsOf(AS_OF_DATE, locale)}` }}
      title={headline}
    >
      <LineChart
        accessibleDescription={summary}
        accessibleLabel={`${label} — weekly trend with labelled events`}
        annotations={trendAnnotations(series)}
        data={points as unknown as Record<string, unknown>[]}
        xDataKey="date"
      >
        <Grid horizontal />
        <Line dataKey="value" name={label} stroke="var(--chart-1)" strokeWidth={2.5} />
        <YAxis domain={valueDomain} formatValue={yAxisFormatValue(unit, locale)} numTicks={4} />
        <XAxis periodTicks="week" />
      </LineChart>
    </ChartFrame>
  );
}
