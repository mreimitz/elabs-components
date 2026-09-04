/**
 * infer-chart-type.ts — the data-shape decision tree behind AutoChart (RM-038).
 *
 * Called only when `spec.type` is omitted; an explicit type ALWAYS wins.
 *
 * `explainChartType` is the real function: it returns the chosen type together
 * with the rule that fired and a one-sentence reason, so an agent or a debug
 * panel can show *why* a picture was chosen instead of only *what* was drawn.
 * `inferChartType` is the same walk with the prose thrown away.
 *
 * ── The order, and why it is the design decision ────────────────────────────
 *
 * The rules below overlap on real data — several fixtures satisfy two or three
 * of them at once — so the ORDER is what actually decides the answer. Each rule
 * states which sibling it outranks and why; `auto-chart.test.tsx` carries a
 * fixture for every one of those pairs, chosen so that deleting the rule
 * changes exactly those rows.
 *
 *  1. candlestick   — open/high/low/close on a temporal x.
 *  2. treemap       — `spec.hierarchy` is present.
 *  3. bump          — long (period, entity, rank) rows, DECLARED as a ranking.
 *  4. calendar      — a year-plus of dated rows of one measure.
 *  5. stream        — temporal x, `stacked`, >= 2 series.
 *  6. heatmap       — two categorical keys x one measure.
 *  7. dumbbell      — categorical x, two measures that read as before/after.
 *  8. distribution  — record-level rows of one measure (histogram/box/strip).
 *  9. waterfall     — categorical x, one measure, DECLARED as steps.
 * 10. diverging-bar — categorical x, one measure, at least one negative value.
 * 11. unit          — categorical x, <= 6 shares summing to ~100, editorial.
 * 12. pie           — categorical x, <= 8 non-negative rows (pre-RM-038 rule).
 * 13. line          — temporal x (pre-RM-038 rule).
 * 14. scatter       — numeric x + one numeric series (pre-RM-038 rule).
 * 15. bar           — the default (pre-RM-038 rule).
 *
 * TWO ORDERINGS DIVERGE FROM THE ROADMAP PROPOSAL, deliberately:
 *
 * - **waterfall runs BEFORE diverging-bar** (the proposal had it after). A
 *   bridge chart's rows are deltas, so "at least one value is negative" is true
 *   of essentially every waterfall; running the diverging rule first would make
 *   the waterfall rule unreachable for exactly the shape it exists for. The
 *   waterfall signal is a DECLARATION about meaning (`kind: "steps"`, or a
 *   total/net/gross checkpoint row); the diverging signal is a structural
 *   accident of the numbers, so the declaration wins.
 *
 * - **bump runs BEFORE heatmap** (the proposal had it last). "Long rows with
 *   period + entity + value" and "two categorical keys + one numeric" are the
 *   SAME shape — ordering alone cannot separate them, so one of the two has to
 *   carry an extra signal. Heatmap keeps the unsignalled shape (a matrix of
 *   values is the more general reading); bump requires `kind: "ranking"` or a
 *   rank-named measure, and therefore has to run first, or its own signal would
 *   never be reached.
 *
 * Nothing here ever infers `network`, `parallel`, `tree` or `sankey` — see the
 * `ChartType` docblock in `./chart-spec` for why those stay explicit-only.
 */

import type { ChartSpec, ChartType } from "./chart-spec";

// ---------------------------------------------------------------------------
// The runtime companion of the `ChartType` union
// ---------------------------------------------------------------------------

/**
 * Every member of {@link ChartType}, as a value.
 *
 * `satisfies` stops a member being added here that the union does not have;
 * `chartTypeUnionMembers` in `auto-chart.test.tsx` parses the union out of
 * `chart-spec.ts` and asserts set equality, which catches the other direction
 * (a union member missing from this list).
 */
export const CHART_TYPES = [
  "line",
  "area",
  "bar",
  "pie",
  "scatter",
  "radar",
  "funnel",
  "candlestick",
  "heatmap",
  "calendar",
  "waterfall",
  "dumbbell",
  "unit",
  "treemap",
  "histogram",
  "box",
  "strip",
  "bump",
  "stream",
  "diverging-bar",
] as const satisfies readonly ChartType[];

/** True when `value` is a member of {@link CHART_TYPES}. */
export function isChartType(value: unknown): value is ChartType {
  return typeof value === "string" && (CHART_TYPES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Field-level helpers
// ---------------------------------------------------------------------------

/** Returns true when every non-null x value parses as a valid Date. */
export function isTemporalField(data: Record<string, unknown>[], key: string): boolean {
  if (data.length === 0) {
    return false;
  }
  const values = data.map((row) => row[key]).filter((v) => v !== null && v !== undefined);
  if (values.length === 0) {
    return false;
  }
  return values.every((v) => {
    if (v instanceof Date) {
      return !Number.isNaN(v.getTime());
    }
    if (typeof v === "string") {
      // Accept ISO-8601 date strings (YYYY-MM-DD, YYYY-MM-DDTHH:mm:ss…)
      if (!/^\d{4}-\d{2}-\d{2}/.test(v)) {
        return false;
      }
      const d = new Date(v);
      return !Number.isNaN(d.getTime());
    }
    return false;
  });
}

/** Returns true when every non-null value for the given key is a finite number. */
export function isNumericField(data: Record<string, unknown>[], key: string): boolean {
  if (data.length === 0) {
    return false;
  }
  const values = data.map((row) => row[key]).filter((v) => v !== null && v !== undefined);
  if (values.length === 0) {
    return false;
  }
  return values.every((v) => typeof v === "number" && Number.isFinite(v));
}

/**
 * Returns true when the column reads as a discrete LABEL — every non-null value
 * is a string, and none of them parses as a date (a date column is temporal,
 * which is a different axis with a different set of rules).
 */
export function isCategoricalField(data: Record<string, unknown>[], key: string): boolean {
  if (data.length === 0) {
    return false;
  }
  const values = data.map((row) => row[key]).filter((v) => v !== null && v !== undefined);
  if (values.length === 0) {
    return false;
  }
  if (!values.every((v) => typeof v === "string")) {
    return false;
  }
  return !isTemporalField(data, key);
}

/** Distinct non-null values of a column, as strings. */
function distinctCount(data: Record<string, unknown>[], key: string): number {
  const seen = new Set<string>();
  for (const row of data) {
    const v = row[key];
    if (v === null || v === undefined) continue;
    seen.add(String(v));
  }
  return seen.size;
}

/** Every field name that appears on any row (scanned over the first 100 rows). */
function rowFieldNames(data: Record<string, unknown>[]): string[] {
  const names = new Set<string>();
  for (const row of data.slice(0, 100)) {
    for (const k of Object.keys(row)) names.add(k);
  }
  return [...names];
}

/**
 * The second CATEGORICAL column — the heatmap's row key, the bump chart's
 * entity. An explicit `spec.y2` wins; otherwise it is discovered, and only when
 * exactly ONE candidate qualifies (a column that is categorical everywhere and
 * carries at least two distinct values, so a constant `region: "EU"`
 * annotation column is never mistaken for an axis).
 */
function secondCategoricalKey(spec: ChartSpec, seriesKeys: string[]): string | null {
  const { data, x, y2 } = spec;
  if (y2 && y2 !== x && isCategoricalField(data, y2) && distinctCount(data, y2) >= 2) {
    return y2;
  }
  if (y2) {
    // An explicit `y2` that is not a categorical column is a dumbbell's second
    // MEASURE, not a second axis — don't fall back to guessing.
    return null;
  }
  const taken = new Set([x, ...seriesKeys]);
  const candidates = rowFieldNames(data).filter(
    (k) => !taken.has(k) && isCategoricalField(data, k) && distinctCount(data, k) >= 2,
  );
  return candidates.length === 1 ? (candidates[0] as string) : null;
}

/** Field names that read as an OHLC quartet, case-insensitively. */
function hasOHLCFields(data: Record<string, unknown>[], seriesKeys: string[]): boolean {
  const quartet = ["open", "high", "low", "close"];
  const declared = new Set(seriesKeys.map((k) => k.toLowerCase()));
  if (!quartet.every((k) => declared.has(k))) {
    return false;
  }
  // The declared names must also be real numeric columns — a series LIST that
  // merely mentions "open" is not OHLC data.
  return seriesKeys
    .filter((k) => quartet.includes(k.toLowerCase()))
    .every((k) => isNumericField(data, k));
}

/** Ordered before/after word pairs — index 0 is the "before" member. */
const BEFORE_AFTER_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["before", "after"],
  ["start", "end"],
  ["old", "new"],
  ["previous", "current"],
  ["prev", "current"],
  ["then", "now"],
  ["baseline", "target"],
  ["first", "last"],
  ["from", "to"],
];

/**
 * Do these two measure names read as a before/after pair — either a known word
 * pair, or two consecutive years (`"2024"` / `"2025"`)?
 *
 * Returns the pair in reading order (before first), or `null`.
 */
export function readsAsBeforeAfterPair(a: string, b: string): [string, string] | null {
  const na = a.toLowerCase().trim();
  const nb = b.toLowerCase().trim();
  for (const [before, after] of BEFORE_AFTER_PAIRS) {
    if (na === before && nb === after) return [a, b];
    if (nb === before && na === after) return [b, a];
  }
  const ya = /^(?:fy\s*)?(\d{4})$/.exec(na)?.[1];
  const yb = /^(?:fy\s*)?(\d{4})$/.exec(nb)?.[1];
  if (ya && yb) {
    const ia = Number(ya);
    const ib = Number(yb);
    if (ib - ia === 1) return [a, b];
    if (ia - ib === 1) return [b, a];
  }
  return null;
}

/**
 * The second categorical column of a spec — the heatmap's row key, the bump
 * chart's entity — resolved exactly as the inference rules resolve it.
 *
 * Exported because `AutoChart` needs the SAME answer the rule that chose the
 * chart type reached: a renderer that re-derived the row key on its own could
 * draw a different matrix from the one the inference explained.
 */
export function secondCategoricalField(spec: ChartSpec): string | null {
  const seriesKeys = spec.series.map((s) => (typeof s === "string" ? s : s.key));
  return secondCategoricalKey(spec, seriesKeys);
}

/** A row label that marks a waterfall checkpoint rather than a delta. */
const TOTAL_LABEL_RE = /\b(total|net|gross|subtotal)\b/i;

/**
 * Does this row label read as a waterfall CHECKPOINT (a gross/net/subtotal row
 * drawn from zero) rather than a delta? Exported for the same reason as
 * {@link secondCategoricalField}: the renderer must classify rows the way the
 * rule that chose `waterfall` classified them.
 */
export function readsAsTotalRow(label: string): boolean {
  return TOTAL_LABEL_RE.test(label);
}

/** A measure name that IS a rank rather than a magnitude. */
const RANK_NAME_RE = /^(rank|position|place)$/i;

/** At or below this many rows per group, a strip can still draw every record. */
export const STRIP_MAX_ROWS_PER_GROUP = 200;

/** From this many dated rows up, a calendar reads better than a line. */
export const CALENDAR_MIN_ROWS = 300;

// ---------------------------------------------------------------------------
// The explanation
// ---------------------------------------------------------------------------

/** What {@link explainChartType} returns. */
export interface ChartTypeExplanation {
  /** The chosen chart type. */
  type: ChartType;
  /** Which ordered rule fired — a stable id, safe to assert on. */
  rule: string;
  /** One sentence, for a debug panel or an agent's own reasoning trace. */
  reason: string;
}

function pick(type: ChartType, rule: string, reason: string): ChartTypeExplanation {
  return { type, rule, reason };
}

/**
 * Infers the best chart type for a `ChartSpec`, and says why.
 *
 * Called only when `spec.type` is absent — an explicit type always wins.
 * Never throws: a spec with no rows, or whose series name columns the rows do
 * not have, falls through to the `bar` default rather than failing.
 */
export function explainChartType(spec: ChartSpec): ChartTypeExplanation {
  const { data, x, xType, series, stacked, group, hierarchy, kind, emphasis } = spec;

  const seriesKeys = series.map((s) => (typeof s === "string" ? s : s.key));
  const seriesNames = series.map((s) => (typeof s === "string" ? s : (s.label ?? s.key)));
  const numericKeys = seriesKeys.filter((k) => isNumericField(data, k));
  const soleNumericKey = numericKeys.length === 1 ? (numericKeys[0] as string) : null;
  const singleSeries = seriesKeys.length === 1 && soleNumericKey !== null;

  const temporalX = xType === "time" || (xType !== "category" && isTemporalField(data, x));
  const numericX = xType === "number" || (xType == null && isNumericField(data, x));
  const categoricalX = !temporalX && !numericX;

  // ── 1. OHLC quartet on a temporal x → candlestick ──────────────────────────
  //    Outranks `line` (rule 13), which the same data also satisfies: a
  //    candlestick is the strictly more specific reading of open/high/low/close.
  //    A temporal x is REQUIRED — `CandlestickChart` plots Dates, so OHLC
  //    columns against a categorical x fall through rather than crash.
  if (temporalX && hasOHLCFields(data, seriesKeys)) {
    return pick(
      "candlestick",
      "ohlc",
      "chose candlestick: open/high/low/close columns on a date axis",
    );
  }

  // ── 2. A hierarchy → treemap ───────────────────────────────────────────────
  //    Structural and unconditional: nothing else in the tree can read nested
  //    nodes, and `data`/`series` are unused by this branch.
  if (hierarchy) {
    return pick("treemap", "hierarchy", "chose treemap: the spec carries a nested hierarchy");
  }

  // ── 3. Declared ranking over long (period, entity, rank) rows → bump ───────
  //    Runs BEFORE heatmap (rule 6) because the two read the SAME shape; see
  //    the module docblock. The declaration is what separates them, so this
  //    rule never fires on an unsignalled matrix.
  if (categoricalX && singleSeries) {
    const entity = secondCategoricalKey(spec, seriesKeys);
    const declaredRanking = kind === "ranking";
    const rankNamed = seriesKeys.concat(seriesNames).some((n) => RANK_NAME_RE.test(n.trim()));
    if (entity && (declaredRanking || rankNamed)) {
      return pick(
        "bump",
        "ranking",
        `chose bump: long rows of (${x}, ${entity}, ${soleNumericKey}) declared as a ranking`,
      );
    }
  }

  // ── 4. A year-plus of dated rows → calendar ────────────────────────────────
  //    Outranks `line` (rule 13). The roadmap folded this into the heatmap rule
  //    ("two categorical keys … if x parses as dates"), but a calendar
  //    heatmap's data is (date, value) — one key, and a date is not categorical
  //    at all — so under that reading the branch could never be reached by the
  //    shape it exists for. It is its own rule on the temporal branch instead.
  if (temporalX && singleSeries && data.length >= CALENDAR_MIN_ROWS) {
    return pick(
      "calendar",
      "calendar",
      `chose calendar: ${data.length} dated rows of one measure — more days than a line can resolve`,
    );
  }

  // ── 5. Stacked temporal bands → stream ─────────────────────────────────────
  //    Outranks `line` (rule 13) on the same temporal x; the `stacked` flag and
  //    a second series are what make a streamgraph legible at all.
  if (temporalX && stacked && seriesKeys.length >= 2) {
    return pick(
      "stream",
      "stream",
      `chose stream: ${seriesKeys.length} stacked series over time read as bands, not lines`,
    );
  }

  // ── 6. Two categorical keys x one measure → heatmap ────────────────────────
  //    Outranks `pie` (rule 12) and `bar` (rule 15), which a small matrix also
  //    satisfies: a second categorical axis is a stronger signal than a row
  //    count. Loses to `bump` (rule 3) only when the spec declares a ranking.
  if (categoricalX && singleSeries) {
    const yKey = secondCategoricalKey(spec, seriesKeys);
    if (yKey) {
      return pick(
        "heatmap",
        "matrix",
        `chose heatmap: two categorical keys (${x} x ${yKey}) and one numeric value`,
      );
    }
  }

  // ── 7. Two measures that read as before/after → dumbbell ───────────────────
  //    Outranks `bar` (rule 15), which every two-series categorical spec
  //    satisfies. Only the NAMED pair (or an explicit `y2`) fires it, so an
  //    ordinary two-region comparison still draws as grouped bars.
  if (categoricalX) {
    const explicitPair =
      spec.y2 && numericKeys.length === 1 && isNumericField(data, spec.y2)
        ? ([numericKeys[0] as string, spec.y2] as [string, string])
        : null;
    const namedPair =
      !explicitPair && numericKeys.length === 2
        ? readsAsBeforeAfterPair(seriesNames[0] as string, seriesNames[1] as string)
        : null;
    const pair = explicitPair ?? namedPair;
    if (pair) {
      return pick(
        "dumbbell",
        "before-after",
        `chose dumbbell: ${pair[0]} → ${pair[1]} is one measure at two moments, not two series`,
      );
    }
  }

  // ── 8. Record-level rows of one measure → histogram / box / strip ──────────
  //    Outranks `scatter` (rule 14): a spec whose x IS the measured column
  //    satisfies both, and plotting a value against itself draws a diagonal
  //    line. Outranks the categorical rules below whenever `group` is set — a
  //    distribution ignores x entirely.
  if (soleNumericKey) {
    const grouped = group && rowFieldNames(data).includes(group) ? group : null;
    if (grouped) {
      const groups = Math.max(1, distinctCount(data, grouped));
      const perGroup = data.length / groups;
      if (perGroup <= STRIP_MAX_ROWS_PER_GROUP) {
        return pick(
          "strip",
          "distribution-strip",
          `chose strip: ${data.length} records over ${groups} ${grouped} groups — few enough to draw every one`,
        );
      }
      return pick(
        "box",
        "distribution-box",
        `chose box: ${data.length} records over ${groups} ${grouped} groups — too many to draw individually`,
      );
    }
    const xIsTheMeasure = x === soleNumericKey;
    const xMissing = !rowFieldNames(data).includes(x);
    if (kind === "records" || xIsTheMeasure || xMissing) {
      return pick(
        "histogram",
        "distribution-histogram",
        `chose histogram: ${soleNumericKey} is a column of raw observations with no category to plot it against`,
      );
    }
  }

  // ── 9. Declared steps → waterfall ──────────────────────────────────────────
  //    Outranks `diverging-bar` (rule 10) — see the module docblock: a bridge's
  //    deltas are almost always partly negative, so running the structural rule
  //    first would leave this one unreachable.
  if (categoricalX && singleSeries) {
    const declaredSteps = kind === "steps";
    const hasCheckpoint = data.some((row) => TOTAL_LABEL_RE.test(String(row[x] ?? "")));
    if (declaredSteps || hasCheckpoint) {
      return pick(
        "waterfall",
        "steps",
        declaredSteps
          ? "chose waterfall: the rows are declared as a running sequence of steps"
          : "chose waterfall: a total/net/gross checkpoint row makes these deltas, not categories",
      );
    }
  }

  // ── 10. A signed single measure → diverging-bar ────────────────────────────
  //     Outranks `pie` (rule 12) — which cannot draw a negative share at all —
  //     and `bar` (rule 15), whose grouped read hides the zero crossing.
  if (categoricalX && singleSeries) {
    const hasNegative = data.some((row) => {
      const v = row[soleNumericKey];
      return typeof v === "number" && v < 0;
    });
    if (hasNegative) {
      return pick(
        "diverging-bar",
        "signed",
        `chose diverging-bar: ${soleNumericKey} crosses zero, so the baseline is the story`,
      );
    }
  }

  // ── 11 + 12. Small non-negative shares → unit (editorial) or pie ───────────
  if (categoricalX && singleSeries) {
    const values = data.map((row) => {
      const v = row[soleNumericKey];
      return typeof v === "number" ? v : Number.NaN;
    });
    const allNonNegative = values.every((v) => Number.isFinite(v) && v >= 0);
    if (allNonNegative) {
      const sum = values.reduce((acc, v) => acc + v, 0);
      // 11 — a countable waffle, but only when the caller asked for the
      //      editorial register. Outranks `pie` (rule 12) on exactly that flag,
      //      so the pre-RM-038 behaviour is unchanged for every other spec.
      if (data.length <= 6 && sum >= 95 && sum <= 105 && emphasis === "editorial") {
        return pick(
          "unit",
          "waffle",
          `chose unit: ${data.length} shares summing to ${Math.round(sum)} — countable marks beat a pie in an editorial register`,
        );
      }
      // 12 — the pre-RM-038 pie rule, unchanged.
      if (data.length <= 8) {
        return pick(
          "pie",
          "parts-of-whole",
          `chose pie: ${data.length} non-negative parts of one whole`,
        );
      }
    }
  }

  // ── 13. Temporal x → line (pre-RM-038 rule) ────────────────────────────────
  if (temporalX) {
    return pick("line", "temporal", "chose line: the x axis is a date, so the reading is a trend");
  }

  // ── 14. Numeric x + one numeric series → scatter (pre-RM-038 rule) ─────────
  if (numericX && singleSeries) {
    return pick(
      "scatter",
      "numeric-xy",
      `chose scatter: both axes are numeric, so the reading is ${soleNumericKey} against ${x}`,
    );
  }

  // ── 15. Default → bar ──────────────────────────────────────────────────────
  return pick(
    "bar",
    "default",
    `chose bar: ${seriesKeys.length} measure${seriesKeys.length === 1 ? "" : "s"} across discrete categories`,
  );
}

/**
 * Infers the best chart type for a given `ChartSpec`.
 * Called only when `spec.type` is absent — explicit type always wins.
 *
 * Use {@link explainChartType} when the REASON matters (a debug panel, an agent
 * explaining its own choice); this is the same walk without the prose.
 */
export function inferChartType(spec: ChartSpec): ChartType {
  return explainChartType(spec).type;
}
