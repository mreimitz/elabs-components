/**
 * validate-chart-spec.ts — checks an untrusted `ChartSpec` (an agent's JSON, a
 * saved dashboard tile) the way `@elabs-ai/components-ui/definition`'s
 * `validateProps` checks a component's props: it never throws, and every
 * problem becomes a `SpecIssue` (RM-198).
 *
 * WHICH FIELDS APPLY TO WHICH `type` is read off the chart definition registry
 * (`../definitions/registry`), never restated here: a `ChartType` maps to the
 * ONE `CHART_DEFINITIONS` entry whose own `specTypes` names it (already how
 * `chart_for`/the docs manifest resolve a spec type — RM-175/176), and the
 * family-specific rules below (does this type carry its rows in `hierarchy`,
 * does it need a second categorical column, which row keys an OHLC series
 * needs) read that entry's `contract`/`targets` rather than a second, hand-kept
 * table. A defect in one of those checks is therefore a defect in the
 * definition's own `contract`/`targets`, fixed once, not a drift between two
 * descriptions of the same chart.
 *
 * `assertChartSpecContract` (`../test/contract.ts`) wraps this module: it
 * throws on the first issue that is not a warning, for the test double's
 * "never silently swallow a bad spec" contract.
 *
 * Pure: no React, no `@visx`/`d3`, no chart engine — only types, the
 * `infer-chart-type` decision tree (itself pure) and the (pure, data-only)
 * definition registry.
 */

import type { SpecIssue, ValidationResult } from "@elabs-ai/components-ui/definition";

import type { ChartSpec, ChartType } from "./chart-spec";
import {
  CHART_SPEC_PALETTES,
  CHART_TYPES,
  explainChartType,
  isChartSpecPalette,
  isChartType,
  secondCategoricalField,
} from "./infer-chart-type";
import { CHART_DEFINITIONS } from "../definitions/registry";
import type { AnyChartDefinition } from "../definitions/define-chart";

// ── Field applicability, read off the registry (never a second hand-kept table) ─

const CHART_DEFINITION_LIST: readonly AnyChartDefinition[] = Object.values(CHART_DEFINITIONS);

/** The one `CHART_DEFINITIONS` entry whose `specTypes` names `type`, or `undefined`. */
function definitionForSpecType(type: ChartType): AnyChartDefinition | undefined {
  return CHART_DEFINITION_LIST.find((def) =>
    (def.specTypes as readonly ChartType[]).includes(type),
  );
}

/**
 * Spec types whose definition carries its rows in `hierarchy` rather than
 * `data` — `TreemapChart`'s `contract.dataKind === "hierarchy"` today; a
 * future hierarchy-shaped family joins this set with no edit here.
 */
const HIERARCHY_SPEC_TYPES: ReadonlySet<ChartType> = new Set(
  CHART_DEFINITION_LIST.filter((def) => def.contract.dataKind === "hierarchy").flatMap(
    (def) => def.specTypes,
  ),
);

/**
 * Spec types whose definition needs TWO required categorical (`role:
 * "dimension"`) columns — `HeatmapChart` (`x`, `y`) and `BumpChart` (`period`,
 * `entity`) today. `"calendar"` shares `HeatmapChart`'s target list but is
 * excluded: its own `contract.propNamedKeys` makes `y` required only
 * `onlyWhen: { prop: "variant", equals: "matrix" }` — a calendar spec's one
 * date column is a complete spec, matching `HeatmapChart`'s own "calendar"
 * variant rule instead of the shared target COUNT.
 */
const SECOND_DIMENSION_SPEC_TYPES: ReadonlySet<ChartType> = new Set(
  CHART_DEFINITION_LIST.filter(
    (def) => def.targets.filter((t) => t.role === "dimension" && t.min > 0).length >= 2,
  ).flatMap((def) => def.specTypes.filter((type) => type !== "calendar")),
);

/**
 * The row keys a `"candlestick"` spec's series must name — read off
 * `CandlestickChart`'s own `measure` targets (`open`/`high`/`low`/`close`)
 * instead of a hand-typed list, so a future renamed/added OHLC target changes
 * this automatically.
 */
const CANDLESTICK_MEASURE_FIELDS: readonly string[] = (
  definitionForSpecType("candlestick")?.targets ?? []
)
  .filter((t) => t.role === "measure" && "field" in t.from)
  .map((t) => (t.from as { field: string }).field);

// ── Issue builders ───────────────────────────────────────────────────────────

function issue(path: string, code: string, message: string, severity?: "warning"): SpecIssue {
  return severity ? { path, code, message, severity } : { path, code, message };
}

/**
 * Validates an untrusted `ChartSpec` (an agent's tool-call JSON, a saved
 * dashboard tile). Never throws. `ok` is true when no issue is an error — a
 * spec whose `version` this build does not recognise still validates, with a
 * `"warning"` issue, per the RM-198 compatibility rule ("an unknown version is
 * an issue, not a throw").
 *
 * Stops at the first ERROR-level issue (mirrors `AutoChart`'s own resolution
 * order: a later check already assumes the earlier one passed — e.g. reading
 * `data[n]` once `data` is confirmed to be an array), so `issues` never grows
 * to more than one error plus the version warning. This is deliberate: the
 * caller fixes one problem, re-validates, and only ever sees a spec's NEXT
 * defect, never a wall of derived ones.
 */
export function validateChartSpec(spec: unknown): ValidationResult<ChartSpec> {
  const issues: SpecIssue[] = [];

  if (typeof spec !== "object" || spec === null || Array.isArray(spec)) {
    issues.push(issue("", "not-an-object", `"spec" must be a ChartSpec object`));
    return { ok: false, issues };
  }
  const s = spec as ChartSpec;

  if (s.version !== undefined && s.version !== 1) {
    issues.push(
      issue(
        "version",
        "unsupported-version",
        `ChartSpec version ${JSON.stringify(s.version)} is not one this build recognises (known: 1) — rendering continues, reading the spec as version 1`,
        "warning",
      ),
    );
  }

  // A type the union does not have renders the unsupported fallback — never a chart.
  if (s.type !== undefined && !isChartType(s.type)) {
    issues.push(
      issue(
        "type",
        "invalid-type",
        `"type" must be one of ${CHART_TYPES.join(" | ")} (an unlisted type renders ChartFallback)`,
      ),
    );
    return { ok: false, issues };
  }

  const hasHierarchy = Boolean(s.hierarchy);

  if (!hasHierarchy && !Array.isArray(s.data)) {
    issues.push(issue("data", "wrong-type", `"data" must be an array of rows`));
    return { ok: false, issues };
  }
  if (!hasHierarchy && !Array.isArray(s.series)) {
    issues.push(issue("series", "wrong-type", `"series" must be an array`));
    return { ok: false, issues };
  }
  if (!hasHierarchy && typeof s.x !== "string") {
    issues.push(issue("x", "wrong-type", `"x" must name a column in every row`));
    return { ok: false, issues };
  }

  const rows = Array.isArray(s.data) ? s.data : [];
  const seriesKeys = (Array.isArray(s.series) ? s.series : []).map((entry) =>
    typeof entry === "string" ? entry : entry?.key,
  );

  // A declared series naming a column the rows do not have is the same defect
  // `seriesFromChildren` catches for the cartesian containers.
  if (rows.length > 0) {
    for (const key of seriesKeys) {
      if (typeof key !== "string" || key.length === 0) {
        issues.push(issue("series", "missing-series-key", `every series needs a string "key"`));
        return { ok: false, issues };
      }
      if (!rows.some((row) => row && key in row)) {
        issues.push(
          issue(
            "series",
            "unknown-column",
            `series "${key}" names a column that no row has — the real chart would plot nothing`,
          ),
        );
        return { ok: false, issues };
      }
    }
    if (typeof s.x === "string" && !hasHierarchy && !rows.some((row) => row && s.x in row)) {
      issues.push(issue("x", "unknown-column", `"x" names a column that no row has`));
      return { ok: false, issues };
    }
  }

  // Family-specific rungs, resolved the way `AutoChart` resolves them.
  const type = s.type ?? (rows.length > 0 ? explainChartType(s).type : undefined);

  // The real component silently renders mono for an invented palette, and
  // ignores any palette on a non-treemap — both hide a mistake in the spec.
  if (s.palette !== undefined) {
    if (!isChartSpecPalette(s.palette)) {
      issues.push(
        issue(
          "palette",
          "invalid-value",
          `"palette" must be one of ${CHART_SPEC_PALETTES.join(" | ")} (anything else renders mono)`,
        ),
      );
      return { ok: false, issues };
    }
    const paletteType = s.type ?? (hasHierarchy ? "treemap" : type);
    if (paletteType !== undefined && paletteType !== "treemap") {
      issues.push(
        issue(
          "palette",
          "not-applicable",
          `"palette" is honoured by a "treemap" spec only — a "${paletteType}" ignores it`,
        ),
      );
      return { ok: false, issues };
    }
  }

  if (type !== undefined && HIERARCHY_SPEC_TYPES.has(type) && !hasHierarchy) {
    issues.push(
      issue(
        "hierarchy",
        "missing-hierarchy",
        `a "${type}" spec carries its nodes in "hierarchy", not in "data"`,
      ),
    );
    return { ok: false, issues };
  }

  if (type !== undefined && SECOND_DIMENSION_SPEC_TYPES.has(type) && rows.length > 0) {
    if (!secondCategoricalField(s)) {
      issues.push(
        issue(
          "y2",
          "missing-column",
          `a "${type}" needs a SECOND categorical column (the heatmap row / the ranked entity) — ` +
            `name it with "y2", or leave exactly one unused label column in the rows`,
        ),
      );
      return { ok: false, issues };
    }
  }

  if (type === "candlestick" && rows.length > 0) {
    for (const column of CANDLESTICK_MEASURE_FIELDS) {
      const key = seriesKeys.find((k) => typeof k === "string" && k.toLowerCase() === column);
      if (!key) {
        issues.push(
          issue(
            "series",
            "missing-column",
            `a "candlestick" needs ${CANDLESTICK_MEASURE_FIELDS.join("/")} series — "${column}" is missing`,
          ),
        );
        return { ok: false, issues };
      }
    }
  }

  if (
    (type === "histogram" || type === "box" || type === "strip") &&
    s.group !== undefined &&
    rows.length > 0 &&
    !rows.some((row) => row && s.group !== undefined && s.group in row)
  ) {
    issues.push(
      issue(
        "group",
        "unknown-column",
        `"group" names a column that no row has — the distribution would collapse to one group`,
      ),
    );
    return { ok: false, issues };
  }

  return { ok: true, value: s, issues };
}
