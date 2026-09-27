/**
 * validate-chart-spec.ts — checks an untrusted `ChartSpec` (an agent's JSON, a
 * saved dashboard tile) the way `@elabs-ai/components-ui/definition`'s
 * `validateProps` checks a component's props: it never throws, and every
 * problem becomes a `SpecIssue`.
 *
 * MOST field applicability is read off the chart definition registry
 * (`../definitions/registry`), never restated as a second, hand-kept table: a
 * `ChartType` maps to the ONE `CHART_DEFINITIONS` entry whose own `specTypes`
 * names it (already how `chart_for`/the docs manifest resolve a spec type —
 * RM-175/176), and the family-specific rules below (does this type carry its
 * rows in `hierarchy`, does it need a second categorical column, which row
 * keys an OHLC series needs, which types share `histogram`'s own definition,
 * the minimum series count) read that entry's `contract`/`targets` rather
 * than a duplicate list. A defect in one of those checks is therefore a
 * defect in the definition's own `contract`/`targets`, fixed once, not a
 * drift between two descriptions of the same chart.
 *
 * Three checks stay literal, deliberately — none of the three has a correct
 * registry-derived equivalent:
 * - The `type === "candlestick"` gate itself: there is exactly one OHLC spec
 *   type (the FIELDS it needs, `CANDLESTICK_MEASURE_FIELDS`, ARE derived).
 * - `"calendar"`'s exclusion from `SECOND_DIMENSION_SPEC_TYPES`: its own `y`
 *   target is conditionally required, on a `propNamedKeys.onlyWhen` the
 *   registry does not expose as a queryable set — see that constant's own
 *   doc for the full reasoning.
 * - `paletteType !== "treemap"`: `spec.palette` reaches exactly one
 *   container, `TreemapChart`, through `AutoChart`'s own render switch — a
 *   fact about THAT prop-forwarding, not one `CHART_DEFINITIONS` records.
 *   Checked and rejected: "does the definition declare a `palette` field" —
 *   `DumbbellChart`, `BumpChart`, `DistributionChart` and others ALSO have
 *   their own, unrelated `palette` prop (their own colour ramp, nothing to do
 *   with `ChartSpec.palette`), so that signal is a false positive, not a
 *   narrower phrasing of the same rule.
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
const TWO_DIMENSION_DEFINITIONS: readonly AnyChartDefinition[] = CHART_DEFINITION_LIST.filter(
  (def) => def.targets.filter((t) => t.role === "dimension" && t.min > 0).length >= 2,
);

const SECOND_DIMENSION_SPEC_TYPES: ReadonlySet<ChartType> = new Set(
  TWO_DIMENSION_DEFINITIONS.flatMap((def) => def.specTypes.filter((type) => type !== "calendar")),
);

/**
 * Spec types `"y2"` is actually READ for — the same definitions
 * {@link SECOND_DIMENSION_SPEC_TYPES} derives from, but WITHOUT excluding
 * `"calendar"`: a calendar spec's `"matrix"` variant reads `y2` too, it is
 * simply never REQUIRED (see {@link SECOND_DIMENSION_SPEC_TYPES}'s own doc).
 * Used only by the F6 field-applicability warning below — never by the
 * REQUIRED-column check above, which stays keyed on the narrower set.
 */
const Y2_APPLICABLE_SPEC_TYPES: ReadonlySet<ChartType> = new Set(
  TWO_DIMENSION_DEFINITIONS.flatMap((def) => def.specTypes),
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

/**
 * Spec types sharing `"histogram"`'s own definition (`DistributionChart`) —
 * `histogram`/`box`/`strip` today. `spec.group` is only ever read for these.
 */
const DISTRIBUTION_SPEC_TYPES: ReadonlySet<ChartType> = new Set(
  definitionForSpecType("histogram")?.specTypes ?? [],
);

/**
 * The fewest series a `type` spec needs, read off its definition's own
 * `role: "measure"` targets (`sum(min)`) — never a second hand-kept number.
 * `TargetDescriptor` has no conditional ("only when some other field is set")
 * gate today, so there is nothing to honour beyond the plain sum; a type with
 * no matching definition (nothing in `CHART_DEFINITIONS` names it) needs 0.
 *
 * Exported for this module's own tests (the per-`ChartType` "fixture minus
 * one series" coverage in `validate-chart-spec.test.ts`, F4) — not part of
 * this package's public surface (`auto-chart/index.ts` re-exports only
 * `validateChartSpec` from this module).
 */
export function minSeriesFor(type: ChartType): number {
  const targets = definitionForSpecType(type)?.targets ?? [];
  return targets.filter((t) => t.role === "measure").reduce((sum, t) => sum + t.min, 0);
}

/**
 * Types where AutoChart renders a real, non-empty chart today even with
 * fewer series than `minSeriesFor` derives — so a spec that already renders
 * must not start failing (F4). Each entry names the reason AutoChart still
 * draws something: the render branch fills a missing measure from the one
 * series it does have, rather than refusing to draw. Exported alongside
 * `minSeriesFor`, for the same per-type test.
 */
export const UNDER_MIN_SERIES_IS_WARNING_ONLY: ReadonlySet<ChartType> = new Set([
  // `dumbbellKeys` falls back to the SAME key for both ends of a one-series
  // spec — a degenerate (start === end) dumbbell, but a real, drawn one.
  "dumbbell",
]);

// ── Issue builders ───────────────────────────────────────────────────────────

function issue(path: string, code: string, message: string, severity?: "warning"): SpecIssue {
  return severity ? { path, code, message, severity } : { path, code, message };
}

/** A real row: a non-null, non-array object — never a bare value like `1`/`"abc"`. */
function isPlainRow(row: unknown): row is Record<string, unknown> {
  return typeof row === "object" && row !== null && !Array.isArray(row);
}

/**
 * Validates an untrusted `ChartSpec` (an agent's tool-call JSON, a saved
 * dashboard tile). Never throws — even a garbage `data` array (bare values
 * instead of rows, a row whose getter throws) becomes an issue, never a
 * propagated exception; `ok` is true when no issue is an error. A spec whose
 * `version` this build does not recognise still validates, with a
 * `"warning"` issue ("an unknown version is an issue, not a throw").
 *
 * Stops at the first ERROR-level issue (mirrors `AutoChart`'s own resolution
 * order: a later check already assumes the earlier one passed — e.g. reading
 * `data[n]` once `data` is confirmed to be an array), so `issues` never grows
 * to more than one error plus the version warning. This is deliberate: the
 * caller fixes one problem, re-validates, and only ever sees a spec's NEXT
 * defect, never a wall of derived ones.
 */
export function validateChartSpec(spec: unknown): ValidationResult<ChartSpec> {
  try {
    return validateChartSpecInner(spec);
  } catch {
    // An unexpected throw — e.g. a row whose getter itself throws, reached
    // through a helper this module does not fully control (`explainChartType`,
    // `secondCategoricalField`) — is still just an issue, never a crash.
    return {
      ok: false,
      issues: [issue("", "invalid-spec", "the spec could not be validated (malformed input)")],
    };
  }
}

function validateChartSpecInner(spec: unknown): ValidationResult<ChartSpec> {
  const issues: SpecIssue[] = [];

  if (typeof spec !== "object" || spec === null) {
    issues.push(issue("", "not-an-object", `"spec" must be a ChartSpec object`));
    return { ok: false, issues };
  }
  // An array IS a `typeof "object"` — deliberately not excluded above (matches
  // base e5f37e50's own contract, F5): it falls through to the ordinary field
  // checks below, which report the first missing/wrong-typed field (typically
  // `"data"`) exactly as they would for `{}`, rather than a top-level
  // `"not-an-object"` this build never used to report for an array spec.
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
  // `seriesFromChildren` catches for the cartesian containers. The path is
  // index-qualified (`series[i]`, F5) so a caller — and `assertChartSpecContract`
  // — can point at the one bad entry, not the whole array.
  if (rows.length > 0) {
    for (const [i, key] of seriesKeys.entries()) {
      if (typeof key !== "string" || key.length === 0) {
        issues.push(
          issue(`series[${i}]`, "missing-series-key", `every series needs a string "key"`),
        );
        return { ok: false, issues };
      }
      if (!rows.some((row) => isPlainRow(row) && key in row)) {
        issues.push(
          issue(
            `series[${i}]`,
            "unknown-column",
            `series "${key}" names a column that no row has — the real chart would plot nothing`,
          ),
        );
        return { ok: false, issues };
      }
    }
    if (
      typeof s.x === "string" &&
      !hasHierarchy &&
      !rows.some((row) => isPlainRow(row) && s.x in row)
    ) {
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

  // F4: fewer series than the type needs draws nothing meaningful (or, for
  // `UNDER_MIN_SERIES_IS_WARNING_ONLY`, something real but degenerate) — a
  // structural check on `series`'s own length, independent of row content.
  // Candlestick is excluded: its OWN check above (named OHLC columns) is
  // strictly more specific and already ran.
  if (type !== undefined && type !== "candlestick") {
    const needed = minSeriesFor(type);
    if (needed > 0 && seriesKeys.length < needed) {
      const warningOnly = UNDER_MIN_SERIES_IS_WARNING_ONLY.has(type);
      issues.push(
        issue(
          "series",
          "too-few-series",
          `a "${type}" spec needs at least ${needed} series — got ${seriesKeys.length}`,
          warningOnly ? "warning" : undefined,
        ),
      );
      if (!warningOnly) return { ok: false, issues };
    }
  }

  if (
    type !== undefined &&
    DISTRIBUTION_SPEC_TYPES.has(type) &&
    s.group !== undefined &&
    rows.length > 0 &&
    !rows.some((row) => isPlainRow(row) && s.group !== undefined && s.group in row)
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

  // F6: field applicability — an optional field AutoChart's own render switch
  // never reads for this `type` is not a defect it refuses over (the field
  // is just silently ignored, same as an unknown prop), but is still worth a
  // WARNING: the spec likely meant a different field, or a different type.
  // Never a hard fail, and never returns early — more than one can coexist.
  // A starting, narrow table today (the two fields this module already
  // derives applicability for elsewhere, `DISTRIBUTION_SPEC_TYPES` and
  // `Y2_APPLICABLE_SPEC_TYPES`); broader `ChartSpec` field coverage, and the
  // generated-prose consumer described in this module's own header, are
  // future work.
  if (type !== undefined && s.group !== undefined && !DISTRIBUTION_SPEC_TYPES.has(type)) {
    issues.push(
      issue(
        "group",
        "not-applicable",
        `"group" is honoured by a histogram/box/strip spec only — a "${type}" ignores it`,
        "warning",
      ),
    );
  }
  if (type !== undefined && s.y2 !== undefined && !Y2_APPLICABLE_SPEC_TYPES.has(type)) {
    issues.push(
      issue(
        "y2",
        "not-applicable",
        `"y2" is honoured by a heatmap/calendar/bump spec only — a "${type}" ignores it`,
        "warning",
      ),
    );
  }

  return { ok: true, value: s, issues };
}
