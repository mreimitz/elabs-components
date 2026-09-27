/**
 * @elabs-ai/components-cli — generated "key props" cells for the two data-shape tables
 * in `skills/brand-ui/reference/chart-selection.md` (RM-199, ADR 0042 §10).
 *
 * The Shape / `ChartType` / Alternatives / Avoid-when prose in both tables stays
 * AUTHORED here (chart-selection judgment — which container beats which for a given
 * shape — isn't something the snapshot knows), but the "Container → key props" /
 * "Key props" cell is now GENERATED from each chart's own definition
 * (`definitions.generated.json`, ADR 0042 §7), so it can never again claim a prop the
 * container doesn't have. That was the bug (2026-09-25 review F03): Ring's `value`/
 * `max` (it takes `data`), Choropleth's `valueKey` (its `data` is a `FeatureCollection`
 * with none), Gauge's `min`/`max` (it has none), Parallel missing `entity`, Network's
 * `edges` (it is `links`), Gantt's `dependencies` (it has none) — six rows, each wrong
 * because a hand-kept prop list had drifted from the component it described.
 *
 * `keyPropsFor` is the one place that turns a snapshot entry into that list:
 *   1. the definition's own REQUIRED top-level props (`contract.requiredProps`, minus
 *      the universal `children`; a kind with no contract — the `Gauge` surface — falls
 *      back to its fields marked `required: true`);
 *   2. every TARGET (ADR 0042 §5, "what the chart can bind data to") whose `from`
 *      names a real prop: a container prop (`from.prop`) or a child part's
 *      (`from.part` + `from.prop`, rendered `<Part prop>`), in declared order, a
 *      name already listed skipped.
 * A target whose `from` is `{ field }` names a key INSIDE each `data` row instead (a
 * `RingData` item is `{ label, value, maxValue }`) — not a prop of the container
 * itself — so it is left out; the row's own `data` requirement already covers it.
 *
 * `extra` on a catalog row is free-text authored elaboration appended after the
 * generated list (a mode switch the shape needs — `variant="calendar"`, `offset=
 * "wiggle"` — or a clarifying aside). It is never a prop the generated half omits by
 * mistake: every real prop the row wants to show lives in `keyPropsFor`'s output.
 */
import { loadDefinitionsSnapshot } from "./core.mjs";

export const CHARTS_PKG = "@elabs-ai/components-charts";

/** The definition's own required top-level props, the universal `children` dropped. */
function requiredProps(def) {
  if (def.contract && Array.isArray(def.contract.requiredProps)) {
    return def.contract.requiredProps.filter((p) => p !== "children");
  }
  return Object.entries(def.fields ?? {})
    .filter(([, field]) => field.required)
    .map(([name]) => name);
}

/** One target's prop label — a container prop, a child part's, or `null` for a data-row field. */
function targetLabel(target) {
  const from = target?.from ?? {};
  if (from.part && from.prop) return `<${from.part} ${from.prop}>`;
  if (from.prop) return from.prop;
  return null; // { field }: a key inside each data row, not a prop of the container
}

/**
 * The definition's key props, backtick-quoted and comma-joined — see the module
 * docblock for the derivation. `null` when `id` has no snapshot entry (a stale
 * catalog row; the caller should treat this as a bug, not print it).
 * @param {object} snapshot  `loadDefinitionsSnapshot(root)`
 * @param {string} id        a chart/surface definition id, e.g. "RingChart"
 * @returns {string|null}
 */
export function keyPropsFor(snapshot, id) {
  const def = snapshot[CHARTS_PKG]?.[id];
  if (!def) return null;
  const labels = [...requiredProps(def)];
  for (const target of def.targets ?? []) {
    const label = targetLabel(target);
    if (label && !labels.includes(label)) labels.push(label);
  }
  return labels.map((label) => `\`${label}\``).join(", ");
}

/** `keyPropsFor`'s list, with an authored `extra` elaboration appended after an em dash. */
function keyPropsCell(snapshot, id, extra) {
  const generated = keyPropsFor(snapshot, id);
  if (generated == null) throw new Error(`chart-selection-docs: no definition for "${id}"`);
  return extra ? `${generated} — ${extra}` : generated;
}

/**
 * The "Inferred (via `AutoChart` / `ChartType`)" table, one row per `ChartType` —
 * two containers (`HeatmapChart`, `BarChart`) serve two rows each, so the table has
 * more rows than containers. Order matches the published table.
 */
const INFERRED_ROWS = [
  {
    shape: "One or more measures over time, continuous",
    chartType: "`line`",
    id: "LineChart",
    alternatives: "`area` (below), `scatter` if sparse",
    avoidWhen: "> ~8 series (illegible); use `stream`/`ComposedChart` instead",
  },
  {
    shape: "A breakdown of a TOTAL over time (≥ 2 series that add up)",
    chartType: "`area` / `stream`",
    id: "AreaChart",
    extra: '`offset="wiggle"` for `stream`, `stacked` otherwise',
    alternatives: "`line` (trend only), `bar` (few points)",
    avoidWhen: "One series, or series that don't add up — use `line`; < ~4 points — use `bar`",
  },
  {
    shape: "Categorical comparison, one or more measures",
    chartType: "`bar`",
    id: "BarChart",
    extra: "`orientation`, `stacked`",
    alternatives: "`diverging-bar` (signed), `unit` (parts)",
    avoidWhen: "A time axis with many points — use `line`/`area`",
  },
  {
    shape: "Parts of a whole, ≤ 5 wedges after `groupSmall`",
    chartType: "`pie`",
    id: "PieChart",
    extra: "`donut` via `innerRadius`, `groupSmall`, `half`",
    alternatives: "`unit` waffle (more legible at scale), `bar`",
    avoidWhen: "More than 5 wedges and no `groupSmall` — inference falls through to `bar`",
  },
  {
    shape: "Two continuous measures, correlation / distribution",
    chartType: "`scatter`",
    id: "ScatterChart",
    alternatives: "`bump` (if one axis is rank over time)",
    avoidWhen: "One axis is categorical — use `bar`/`dumbbell`",
  },
  {
    shape: "Multiple measures per entity, compared as a shape",
    chartType: "`radar`",
    id: "RadarChart",
    alternatives: "small-multiple `bar`",
    avoidWhen: "> ~8 spokes (radar can't scale) or absolute magnitude matters more than shape",
  },
  {
    shape: "A sequential process with drop-off between stages",
    chartType: "`funnel`",
    id: "FunnelChart",
    extra: "`orientation`",
    alternatives: "`bar` (stage totals, no flow read)",
    avoidWhen: "Stages aren't sequential / no drop-off story",
  },
  {
    shape: "OHLC financial series over time",
    chartType: "`candlestick`",
    id: "CandlestickChart",
    alternatives: "`line` (close only)",
    avoidWhen: "Data isn't OHLC-shaped",
  },
  {
    shape: "Two categorical axes (e.g. **weekday × hour**), one value per cell",
    chartType: "`heatmap`",
    id: "HeatmapChart",
    extra: '`variant="matrix"`, `mode="cell"\\|"dot"`',
    alternatives: "`unit` rows (per-category tally)",
    avoidWhen: "> ~10 columns of continuous data, or exact values matter more than pattern",
  },
  {
    shape: "One measure per calendar day over ≥ a few months",
    chartType: "`calendar`",
    id: "HeatmapChart",
    extra: '`variant="calendar"` (`mode` defaults to `"dot"`)',
    alternatives: "`heatmap` matrix (if not date-shaped)",
    avoidWhen: "< ~2 months of days (too sparse to read as a calendar)",
  },
  {
    shape: "A running total with signed steps to/from it",
    chartType: "`waterfall`",
    id: "WaterfallChart",
    extra: '`kind: "step"\\|"total"`',
    alternatives: "`diverging-bar` (no running total)",
    avoidWhen: "No meaningful running total — use `diverging-bar`",
  },
  {
    shape: "Before/after or range per category",
    chartType: "`dumbbell`",
    id: "DumbbellChart",
    alternatives: "`bar` (single value), `waterfall`",
    avoidWhen: "More than 2 points per category — use small-multiple `line`",
  },
  {
    shape: "Parts of a whole as discrete UNIT counts (not a percentage)",
    chartType: "`unit`",
    id: "UnitChart",
    extra: '`layout="waffle"`, marks = `Math.round` units of 100',
    alternatives: "`pie`, `bar`",
    avoidWhen: "Exact per-unit counts don't matter — `pie`/`bar` read faster",
  },
  {
    shape: "A nested hierarchy sized by a measure",
    chartType: "`treemap`",
    id: "TreemapChart",
    extra: "a HIERARCHY (`TreemapNode`), not flat rows",
    alternatives: "`NetworkChart` (relations, not size)",
    avoidWhen: "The hierarchy has < 2 levels — flat `bar` is clearer",
  },
  {
    shape: "Distribution of one measure, optionally grouped",
    chartType: "`histogram` / `box` / `strip`",
    id: "DistributionChart",
    alternatives: "each other (see `kind`)",
    avoidWhen: "A single summary number would do — use a `MetricCard`",
  },
  {
    shape: "Rank of entities over ordered periods",
    chartType: "`bump`",
    id: "BumpChart",
    extra: "or `rankKey`",
    alternatives: "`line` (if magnitude, not rank, is the point)",
    avoidWhen: "Only 2 periods — use `dumbbell`",
  },
  {
    shape: "A single signed measure around a meaningful zero",
    chartType: "`diverging-bar`",
    id: "BarChart",
    extra: "`Bar labels zeroLine`",
    alternatives: "`waterfall` (if it accumulates)",
    avoidWhen: "The zero baseline isn't meaningful — use `bar`",
  },
];

/**
 * The "Manual-select" table — containers `ChartSpec`/`AutoChart` never infer. Order
 * matches the published table.
 */
const MANUAL_ROWS = [
  {
    shape: "Donut-only ring focused on ONE proportion (not a full pie breakdown)",
    id: "RingChart",
    avoidWhen: "Multiple categories matter — use `pie`/`unit`",
  },
  {
    shape: "Mixed marks on one shared axis (bars + a line target, etc.)",
    id: "ComposedChart",
    avoidWhen: "A single mark type would do — use the plain container",
  },
  {
    shape: "A metric updating in real time, streaming in",
    id: "LiveLineChart",
    extra: "appended over time, retains a rolling window",
    avoidWhen: "The series is static/historical — use `LineChart`",
  },
  {
    shape: "A measure by geographic region",
    id: "ChoroplethChart",
    extra: "a GeoJSON `FeatureCollection`",
    avoidWhen: "No real geography — use `bar`",
  },
  {
    shape: "A single value against a target/threshold band",
    id: "Gauge",
    extra: "`thresholds` for the bands",
    avoidWhen: "Trend over time matters more than the instant — use `line`",
  },
  {
    shape: "A flow between named nodes (source → target, weighted)",
    id: "SankeyChart",
    extra: "shaped `{ nodes, links }`, weighted links between named nodes",
    avoidWhen: "The nodes have no real flow between them — use `NetworkChart`",
  },
  {
    shape: "Many numeric dimensions compared across entities at once",
    id: "ParallelCoordinatesChart",
    avoidWhen: "> ~2 entities need per-entity detail — use small-multiple `radar`",
  },
  {
    shape:
      "A hierarchy read as a branching tree (org chart, KPI driver tree), not sized rectangles",
    id: "TreeChart",
    extra:
      "branches open/close by default (`defaultExpandedDepth`, `expandedIds`, " +
      "`collapsible={false}` for static); `orientation`; `renderNode` cards",
    avoidWhen: "Size, not structure, is the point — use `treemap`",
  },
  {
    shape: "Arbitrary node/edge relationships, no hierarchy",
    id: "NetworkChart",
    avoidWhen: "The relationship IS a hierarchy — use `TreeChart`/`treemap`",
  },
  {
    shape: "Tasks/phases across a timeline",
    id: "Gantt",
    avoidWhen: "Not really scheduled work — use `dumbbell` (a single before/after)",
  },
];

/** `| a | b | …|` markdown table, header + separator + one line per row. */
function renderTable(headers, rows) {
  const line = (cells) => `| ${cells.join(" | ")} |`;
  return [line(headers), line(headers.map(() => "---")), ...rows.map(line)].join("\n");
}

/** The "Inferred (via `AutoChart` / `ChartType`)" table body (RM-199). */
export function renderInferredTable(root) {
  const snapshot = loadDefinitionsSnapshot(root);
  const rows = INFERRED_ROWS.map((r) => [
    r.shape,
    r.chartType,
    `\`${r.id}\` (${keyPropsCell(snapshot, r.id, r.extra)})`,
    r.alternatives,
    r.avoidWhen,
  ]);
  return renderTable(
    ["Shape", "`ChartType`", "Container → key props", "Alternatives", "Avoid when"],
    rows,
  );
}

/** The "Manual-select" table body (RM-199). */
export function renderManualSelectTable(root) {
  const snapshot = loadDefinitionsSnapshot(root);
  const rows = MANUAL_ROWS.map((r) => [
    r.shape,
    `\`${r.id}\``,
    keyPropsCell(snapshot, r.id, r.extra),
    r.avoidWhen,
  ]);
  return renderTable(["Shape", "Container", "Key props", "Avoid when"], rows);
}

/** Chart-kind definitions in the snapshot — the count `components.md`'s selection row shows. */
export function chartContainerCount(root) {
  const snapshot = loadDefinitionsSnapshot(root);
  return Object.values(snapshot[CHARTS_PKG] ?? {}).filter((def) => def.kind === "chart").length;
}

/**
 * The `components.md` chart-count callout (RM-199, F03: the hand-kept count had
 * drifted to 13 against the registry's real count). It sits as its own line right
 * after the "Component selection" table — not inside its "KPIs / charts" row —
 * because the marker comments Prettier's markdown formatter reflows always get
 * blank-line-separated from surrounding content, which would otherwise split one
 * GFM table into two.
 */
export function renderChartCountRow(root) {
  const count = chartContainerCount(root);
  return (
    `**Chart count:** \`@elabs-ai/components-charts\` ships ${count} chart types today ` +
    "— see the Charts section below."
  );
}
