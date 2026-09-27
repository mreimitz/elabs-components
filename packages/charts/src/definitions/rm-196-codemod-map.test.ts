/**
 * RM-196 (ADR 0042 §A.6, "data keys, motion and bar geometry", rows 32–39): the
 * `chart-codemod-map.generated.json` a consumer's codemod reads is generated straight off
 * each definition's own `aliases` array (`packages/cli/scripts/gen-definitions.mjs`), so
 * codemod-map correctness is already `pnpm gen`'s job — regenerating it from a stale
 * definition would fail `pnpm gen:check`. What that pipeline does NOT catch is the ADR
 * TABLE itself drifting from the definitions: a row edited in one place and not the other.
 *
 * This file is the checked-in fixture choice (not a markdown-table parser): the repo has no
 * existing markdown-parsing test infrastructure, and a parser tied to the ADR's exact table
 * formatting is more fragile than a small, hand-authored array reviewed alongside the ADR
 * text in the same PR — the same discipline `defaults-golden.ts`/`contract-golden.ts`
 * already use for this rename wave (deliberately hand-maintained, forcing a rename item to
 * update them, never a drive-by).
 *
 * Two checks, deliberately NOT the same assertion:
 * 1. `it.each(ADR_A6_ROWS)` — every row this fixture lists is a real alias on its
 *    definition (catches the definition losing a row the ADR still documents).
 * 2. A full per-component alias-list snapshot against `CHART_DEFINITIONS`, exact
 *    equality, not a subset/superset check — catches the OTHER direction too: a
 *    definition alias this fixture doesn't know about at all (a fixture row silently
 *    deleted, or a ninth alias landing with no ADR update). A row disappearing from
 *    `ADR_A6_ROWS` without ALSO disappearing from `EXPECTED_ALIASES_BY_COMPONENT` is
 *    exactly the drift this second check exists to catch — the two are hand-maintained
 *    separately on purpose, not derived from one another, so deleting a row from one
 *    array does not silently shrink the other's expectation.
 */
import { describe, expect, it } from "vitest";
import { CHART_DEFINITIONS } from "./registry";

/** ADR 0042 §A.6 rows 32–39, transcribed from `docs/adr/0042-chart-definitions-and-prop-groups.md`. */
const ADR_A6_ROWS = [
  { row: 32, component: "HeatmapChart", from: "x", to: "xDataKey" },
  { row: 33, component: "HeatmapChart", from: "y", to: "yDataKey" },
  { row: 34, component: "DensityScatterChart", from: "xKey", to: "xDataKey" },
  { row: 35, component: "DensityScatterChart", from: "yKey", to: "yDataKey" },
  { row: 36, component: "RadarChart", from: "enterDurationMs", to: "animationDuration" },
  { row: 37, component: "RadarChart", from: "staggerScale", to: "enterStaggerScale" },
  { row: 38, component: "RadarChart", from: "motionReplayKey", to: "revealSignature" },
  { row: 39, component: "ComposedChart", from: "barGap", to: "groupGap" },
] as const;

type DefinedAlias = { from: string; to: string };

/**
 * The FULL `aliases` list (not just the A.6 rows) for each of the four definitions this
 * rename wave touches, in source order. Hand-maintained deliberately, same discipline as
 * `defaults-golden.ts`/`contract-golden.ts` — a definition gaining, losing or reordering an
 * alias (A.6-era or from an earlier rename item on the same component, e.g. RM-193's
 * `showValues` → `labels` on `HeatmapChart`, RM-191's `labels` → `messages` on
 * `DensityScatterChart`) must touch this array in the same PR, or this test reds.
 */
const EXPECTED_ALIASES_BY_COMPONENT: Record<string, DefinedAlias[]> = {
  HeatmapChart: [
    { from: "x", to: "xDataKey" },
    { from: "y", to: "yDataKey" },
    { from: "showLegend", to: "legend" },
    { from: "loading", to: "status" },
    { from: "emptyTitle", to: "empty.title" },
    { from: "emptyMessage", to: "empty.message" },
    { from: "emptyAction", to: "empty.action" },
    { from: "showValues", to: "labels" },
  ],
  DensityScatterChart: [
    { from: "labels", to: "messages" },
    { from: "xKey", to: "xDataKey" },
    { from: "yKey", to: "yDataKey" },
  ],
  RadarChart: [
    { from: "enterDurationMs", to: "animationDuration" },
    { from: "staggerScale", to: "enterStaggerScale" },
    { from: "motionReplayKey", to: "revealSignature" },
  ],
  ComposedChart: [{ from: "barGap", to: "groupGap" }],
};

function aliasesOf(component: string): DefinedAlias[] {
  const definition = CHART_DEFINITIONS[component as keyof typeof CHART_DEFINITIONS] as {
    aliases?: readonly DefinedAlias[];
  };
  expect(definition).toBeDefined();
  return (definition.aliases ?? []).map(({ from, to }) => ({ from, to }));
}

describe("ADR 0042 §A.6 (rows 32–39) matches CHART_DEFINITIONS' own aliases", () => {
  it.each(ADR_A6_ROWS)(
    "row $row: $component `$from` → `$to` is a real alias on the definition",
    ({ component, from, to }) => {
      expect(aliasesOf(component)).toContainEqual({ from, to });
    },
  );

  it.each(Object.entries(EXPECTED_ALIASES_BY_COMPONENT))(
    "%s's definition carries EXACTLY this alias list, in this order (no silent drift either way)",
    (component, expected) => {
      expect(aliasesOf(component)).toEqual(expected);
    },
  );
});
