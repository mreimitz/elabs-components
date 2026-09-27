/**
 * @elabs-ai/components-cli — generated "key props" cells for the two data-shape tables
 * in `skills/brand-ui/reference/chart-selection.md` (RM-199, ADR 0042 §10).
 *
 * The Shape / `ChartType` / Alternatives / Avoid-when prose in both tables stays
 * AUTHORED here (chart-selection judgment — which container beats which for a given
 * shape — isn't something the snapshot knows), but the "Container → key props" /
 * "Key props" cell is now GENERATED from each chart's own definition
 * (`definitions.generated.json`, ADR 0042 §7), so it can never again claim a prop the
 * container doesn't have. Fixed here: Ring's `value`/
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
 *
 * The Shape / Avoid-when cells are ALSO generated — `dataShapeFor`/`avoidWhenFor` read
 * the same `@dataShape`/`@avoidWhen` prose `chart_for` uses, so a hand sentence can no
 * longer say "≤ 5 wedges" while the component's own docblock says "about 6 slices". A
 * container with more than one `@dataShape` tag (`BarChart`: bar vs diverging-bar;
 * `HeatmapChart`: matrix vs calendar) picks its row's Shape AND Avoid-when text by the
 * SAME `shapeIndex` (declaration order; verified by hand against the snapshot) — a
 * container's `@avoidWhen` tags are paired with its `@dataShape` tags one-for-one, so
 * the calendar/diverging-bar row states ITS OWN criterion instead of repeating its
 * sibling row's. A container with fewer `@avoidWhen` tags than `@dataShape` ones falls
 * back to its last declared `@avoidWhen`. Every row in both catalogs below has a real
 * `@dataShape`/`@avoidWhen` source; no row needed a hand override, so no override
 * field exists.
 *
 * A `{ field }` target — a key INSIDE each data row, not a container prop — used
 * to be dropped from `keyPropsFor`'s output entirely; it now prints as
 * `<dataProp>[].<field>` (`data[].label`, `data[].value`, …), the item's own
 * shape, generated instead of a hand-typed type name that could rename out from
 * under this doc. `dataProp` is `contract.dataProp` (defaults to `"data"`) — every
 * `{ field }` target in the package today binds against the default-named prop.
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

/**
 * One target's prop label — a container prop, a child part's (`<Part prop>`), or a
 * data-row field path (`data[].label`) for a `{ field }` target.
 * @param {string} dataProp  the container's array prop name (`contract.dataProp`, "data"
 *   when the definition doesn't say)
 */
function targetLabel(target, dataProp) {
  const from = target?.from ?? {};
  if (from.part && from.prop) return `<${from.part} ${from.prop}>`;
  if (from.prop) return from.prop;
  if (from.field) return `${dataProp}[].${from.field}`;
  return null;
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
  const dataProp = def.contract?.dataProp ?? "data";
  const labels = [...requiredProps(def)];
  for (const target of def.targets ?? []) {
    const label = targetLabel(target, dataProp);
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

/** Sentence-cases the first letter — `@dataShape`/`@avoidWhen` JSDoc prose is lowercase. */
function capitalize(s) {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * The Shape column text for one table row — the container's own `@dataShape` prose,
 * sentence-cased. `index` picks which tag when a container declares more than one
 * (declaration order; see the module docblock). Throws when the container has no tag at
 * that index — a stale catalog row, not something to print silently wrong.
 */
export function dataShapeFor(snapshot, id, index = 0) {
  const shapes = snapshot[CHARTS_PKG]?.[id]?.prose?.dataShapes;
  if (!shapes?.[index])
    throw new Error(`chart-selection-docs: no @dataShape[${index}] for "${id}"`);
  return capitalize(shapes[index]);
}

/**
 * The Avoid-when column text — the container's own `@avoidWhen` prose, sentence-cased.
 * `index` picks which tag (declaration order), the SAME index `dataShapeFor` used for the
 * row's Shape cell, so a container with two `@dataShape`/`@avoidWhen` pairs (`BarChart`,
 * `HeatmapChart`) shows each row its OWN criterion. A container with fewer `@avoidWhen`
 * tags than `@dataShape` ones falls back to its last declared `@avoidWhen` rather than
 * throwing — a missing PAIR is a smaller gap than a missing tag entirely.
 */
export function avoidWhenFor(snapshot, id, index = 0) {
  const tags = snapshot[CHARTS_PKG]?.[id]?.prose?.avoidWhens;
  const text = tags?.[index] ?? tags?.at(-1);
  if (!text) throw new Error(`chart-selection-docs: no @avoidWhen for "${id}"`);
  return capitalize(text);
}

/**
 * The "Inferred (via `AutoChart` / `ChartType`)" table, one row per `ChartType` —
 * two containers (`HeatmapChart`, `BarChart`) serve two rows each, so the table has
 * more rows than containers. Order matches the published table.
 */
const INFERRED_ROWS = [
  {
    chartType: "`line`",
    id: "LineChart",
    alternatives: "`area` (below), `scatter` if sparse",
  },
  {
    chartType: "`area` / `stream`",
    id: "AreaChart",
    extra: '`offset="wiggle"` for `stream`, `stacked` otherwise',
    alternatives: "`line` (trend only), `bar` (few points)",
  },
  {
    chartType: "`bar`",
    id: "BarChart",
    extra: "`orientation`, `stacked`",
    alternatives: "`diverging-bar` (signed), `unit` (parts)",
  },
  {
    chartType: "`pie`",
    id: "PieChart",
    extra: "`donut` via `innerRadius`, `groupSmall`, `half`",
    alternatives: "`unit` waffle (more legible at scale), `bar`",
  },
  {
    chartType: "`scatter`",
    id: "ScatterChart",
    alternatives: "`bump` (if one axis is rank over time)",
  },
  {
    chartType: "`radar`",
    id: "RadarChart",
    alternatives: "small-multiple `bar`",
  },
  {
    chartType: "`funnel`",
    id: "FunnelChart",
    extra: "`orientation`",
    alternatives: "`bar` (stage totals, no flow read)",
  },
  {
    chartType: "`candlestick`",
    id: "CandlestickChart",
    alternatives: "`line` (close only)",
  },
  {
    chartType: "`heatmap`",
    id: "HeatmapChart",
    extra: '`variant="matrix"`, `mode="cell"|"dot"`',
    alternatives: "`unit` rows (per-category tally)",
  },
  {
    chartType: "`calendar`",
    id: "HeatmapChart",
    // The 2nd `@dataShape`/`@avoidWhen` pair (declaration order) — the calendar-variant
    // use case, with its own avoid-when criterion instead of the matrix row's.
    shapeIndex: 1,
    extra: '`variant="calendar"` (`mode` defaults to `"dot"`)',
    alternatives: "`heatmap` matrix (if not date-shaped)",
  },
  {
    chartType: "`waterfall`",
    id: "WaterfallChart",
    extra: '`kind: "step"|"total"`',
    alternatives: "`diverging-bar` (no running total)",
  },
  {
    chartType: "`dumbbell`",
    id: "DumbbellChart",
    alternatives: "`bar` (single value), `waterfall`",
  },
  {
    chartType: "`unit`",
    id: "UnitChart",
    extra: '`layout="waffle"`, marks = `Math.round` units of 100',
    alternatives: "`pie`, `bar`",
  },
  {
    chartType: "`treemap`",
    id: "TreemapChart",
    extra: "a HIERARCHY (`TreemapNode`), not flat rows",
    alternatives: "`NetworkChart` (relations, not size)",
  },
  {
    chartType: "`histogram` / `box` / `strip`",
    id: "DistributionChart",
    alternatives: "each other (see `kind`)",
  },
  {
    chartType: "`bump`",
    id: "BumpChart",
    extra: "or `rankKey`",
    alternatives: "`line` (if magnitude, not rank, is the point)",
  },
  {
    chartType: "`diverging-bar`",
    id: "BarChart",
    // The 2nd `@dataShape`/`@avoidWhen` pair (declaration order) — the diverging-bar use
    // case, with its own avoid-when criterion instead of the plain-bar row's.
    shapeIndex: 1,
    extra: "`Bar labels zeroLine`",
    alternatives: "`waterfall` (if it accumulates)",
  },
];

/**
 * The "Manual-select" table — containers `ChartSpec`/`AutoChart` never infer. Order
 * matches the published table.
 */
const MANUAL_ROWS = [
  {
    id: "RingChart",
  },
  {
    id: "ComposedChart",
  },
  {
    id: "LiveLineChart",
    extra: "appended over time, retains a rolling window",
  },
  {
    id: "ChoroplethChart",
    extra: "a GeoJSON `FeatureCollection`",
  },
  {
    id: "Gauge",
    extra: "`thresholds` for the bands",
  },
  {
    id: "SankeyChart",
    extra: "shaped `{ nodes, links }`, weighted links between named nodes",
  },
  {
    id: "ParallelCoordinatesChart",
  },
  {
    id: "TreeChart",
    extra:
      "a HIERARCHY (`TreeNode`), not flat rows; branches open/close by default " +
      "(`defaultExpandedDepth`, `expandedIds`, `collapsible={false}` for static); " +
      "`orientation`; `renderNode` cards",
  },
  {
    id: "NetworkChart",
  },
  {
    id: "Gantt",
    // Not a required prop or a target (no field to generate this from). `defaultViewMode`
    // sets the initial tick granularity uncontrolled — the prop this row means to show;
    // `viewMode` (a separate, `codeOnly` controlled counterpart) still exists too, it just
    // isn't the one a reader reaching for a default wants. `dependencies` was never a Gantt
    // prop — it's a field inside each task, not a top-level one.
    extra: "`defaultViewMode`",
  },
];

/** `| a | b | …|` markdown table, header + separator + one line per row. A literal `|` inside
 *  a cell is escaped here — once, in the renderer — so a catalog row never has to hand-escape
 *  its own text to avoid silently breaking the table into the wrong number of columns. */
export function renderTable(headers, rows) {
  const escapeCell = (cell) => String(cell).replace(/\|/g, "\\|");
  const line = (cells) => `| ${cells.map(escapeCell).join(" | ")} |`;
  return [line(headers), line(headers.map(() => "---")), ...rows.map(line)].join("\n");
}

/** The "Inferred (via `AutoChart` / `ChartType`)" table body (RM-199). */
export function renderInferredTable(root) {
  const snapshot = loadDefinitionsSnapshot(root);
  const rows = INFERRED_ROWS.map((r) => [
    dataShapeFor(snapshot, r.id, r.shapeIndex ?? 0),
    r.chartType,
    `\`${r.id}\` (${keyPropsCell(snapshot, r.id, r.extra)})`,
    r.alternatives,
    avoidWhenFor(snapshot, r.id, r.shapeIndex ?? 0),
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
    dataShapeFor(snapshot, r.id, r.shapeIndex ?? 0),
    `\`${r.id}\``,
    keyPropsCell(snapshot, r.id, r.extra),
    avoidWhenFor(snapshot, r.id, r.shapeIndex ?? 0),
  ]);
  return renderTable(["Shape", "Container", "Key props", "Avoid when"], rows);
}

/** Chart-kind definitions in the snapshot — the count `components.md`'s selection row shows. */
export function chartContainerCount(root) {
  const snapshot = loadDefinitionsSnapshot(root);
  return Object.values(snapshot[CHARTS_PKG] ?? {}).filter((def) => def.kind === "chart").length;
}

/** Surface-kind definitions (`Gauge`, `Sparkline`, `ChartCard`, `MetricGrid`) — chart-adjacent,
 *  not picked by data shape, so they stay out of the two data-shape tables. */
export function chartSurfaceCount(root) {
  const snapshot = loadDefinitionsSnapshot(root);
  return Object.values(snapshot[CHARTS_PKG] ?? {}).filter((def) => def.kind === "surface").length;
}

/** Distinct `kind: "chart"` ids appearing in either data-shape table — a different scope than
 *  the registry's total chart count (`chartContainerCount`): `Gauge` (`kind: "surface"`) has
 *  a row too but isn't counted here (see `renderChartCountSummary`), and two containers with
 *  `@dataShape` tags, `BulletChart` and `DensityScatterChart`, don't have a table row yet
 *  (RM Outcome tracks adding them). */
export function tableCoverageCount(root) {
  const snapshot = loadDefinitionsSnapshot(root);
  return new Set(
    [...INFERRED_ROWS, ...MANUAL_ROWS]
      .filter((r) => snapshot[CHARTS_PKG]?.[r.id]?.kind === "chart")
      .map((r) => r.id),
  ).size;
}

/**
 * The `components.md` chart-count callout (RM-199) — generated so a hand-kept count can't
 * drift from the registry's real one. It sits as its own line right
 * after the "Component selection" table — not inside its "KPIs / charts" row —
 * because the marker comments Prettier's markdown formatter reflows always get
 * blank-line-separated from surrounding content, which would otherwise split one
 * GFM table into two.
 */
export function renderChartCountRow(root) {
  const count = chartContainerCount(root);
  return (
    `**Chart count:** \`@elabs-ai/components-charts\` ships ${count} chart types today ` +
    "— see [chart-selection.md](chart-selection.md) for the full data-shape breakdown."
  );
}

/**
 * `chart-selection.md`'s own opening count sentence — generated so it can't disagree with
 * `components.md`'s registry-derived count the way hand-typed prose once did. Two DIFFERENT
 * scopes, both named explicitly so neither reads as a correction of the other: the REGISTRY
 * total (every `kind: "chart"` definition, `chartContainerCount`) plus its `kind: "surface"`
 * chart-adjacent siblings, and separately the TABLE coverage below (`tableCoverageCount` —
 * fewer, because two registry containers don't have a row yet). `Gauge` is the one surface
 * that DOES get a table row and IS ranked by `chart_for` like a chart — it just isn't counted
 * in `tableCoverageCount`'s `kind: "chart"` total, so it's called out on its own rather than
 * folded into either "picked directly" or the chart-container count.
 */
export function renderChartCountSummary(root) {
  const chartCount = chartContainerCount(root);
  const surfaceCount = chartSurfaceCount(root);
  const tableCount = tableCoverageCount(root);
  return (
    `\`@elabs-ai/components-charts\` ships ${chartCount} chart containers (registry count) ` +
    `plus ${surfaceCount} chart-adjacent surfaces (\`Gauge\`, \`Sparkline\`, \`ChartCard\`, ` +
    "`MetricGrid`). `Gauge` still gets a row in the manual-select table below and `chart_for` " +
    "ranks it by shape, like a chart; `Sparkline`, `ChartCard` and `MetricGrid` have no " +
    `data-shape row and are picked directly, not by data shape. ${tableCount} of the ` +
    `${chartCount} chart containers have a row in the two tables below; the rest are a ` +
    "tracked follow-up (see this file's own reference notes)."
  );
}

/**
 * The "Data-shape table" section intro — the `AutoChart`-inferred / manual-select split,
 * sized from the SAME two row catalogs the tables below render from, so it can't drift
 * from them the way independent hand-typed "Fifteen" / "ten" prose could.
 */
export function renderTableSplitSummary() {
  const inferredCount = new Set(INFERRED_ROWS.map((r) => r.id)).size;
  const manualCount = MANUAL_ROWS.length;
  return (
    `${inferredCount} of the containers below are reachable through \`AutoChart\`'s shape ` +
    "inference — give `AutoChart` a `ChartSpec` and it picks one of these `ChartType` values " +
    `for you, in a fixed priority order. The other ${manualCount} (marked **manual-select** ` +
    "below) read shapes a flat `{ x, series[] }` spec cannot express without ambiguity — a " +
    "node/link pair, a per-row dimension list, a nested hierarchy — so `AutoChart` never " +
    "guesses at them; you reach for the container directly."
  );
}
