/**
 * charts-group-drift — a chart prop named like a prop-group key comes from that group
 * (ADR 0042 §4 and §11, RM-190).
 *
 * Why: a prop group (`a11y`, `palette`, `frame-size`, `chart-state`, the navigators, …) is the
 * one definition of a shared concept. A family that declares its own field under a group's key —
 * its own `status`, its own `palette`, Pie's placement `align` next to the navigator's window
 * `align` — either copies the group and drifts from it, or reuses the group's name for something
 * else. New family props must not re-introduce what a group already owns. The ones that exist
 * today are a KEYS BASELINE THAT ONLY SHRINKS: a family applies the group, or a rename item
 * (RM-191 … RM-196) moves the prop off the name, and `pnpm check:update --rule
 * charts-group-drift` drops the key. A new key fails.
 *
 * Read from the committed definition snapshot (`packages/cli/lib/definitions.generated.json`,
 * charts package) — no source parsing. A GROUP KEY is any field key that some definition takes
 * from a group (its `group` is set) or overrides (its `overrides` names the group), so a family
 * that moves to an override never shrinks the key set. A finding is, on any definition:
 *   - a field under a group key with `group: null` and no `overrides`. The fix is to apply the
 *     group; an own field of the same name then overrides it (the snapshot derives `overrides`
 *     from exactly that, so it is never written by hand);
 *   - a `codeOnly` prop under a group key: a group describes that key as a field, so a code-only
 *     prop of the same name never came from it.
 * Key: `<package>::<Id>::<prop>`. The finding points at the family's definition file.
 *
 * NOT DRIFT — the one exception list, each entry a frozen, maintainer-approved decision:
 *   - `zoom` on ChoroplethChart, TreeChart and DensityScatterChart. ADR 0042 Appendix A.5
 *     renames Choropleth `zoomEnabled` and Tree `zoomable` to `zoom` (RM-195), matching
 *     DensityScatter. Only the navigator groups own `zoom` — a window over an ordered axis —
 *     and none of these charts can apply them: a map, a tree and a density plot zoom their own
 *     viewport. Same word, same user meaning, no shared group.
 *   - `labels` on ChoroplethChart and the Scatter part. ADR 0042 Appendix A.9 checked both
 *     against the `data-labels` group and left them alone: "place-name and point labels: data
 *     labels, already the `data-labels` meaning" — RM-193 is the item that made `labels` a
 *     group key at all (by applying `dataLabelsGroup` to Bar and others), which is what first
 *     surfaced these two as findings. The owner approved Appendix A, including this row, on
 *     2026-09-27 — that approval is the maintainer decision this entry records, the same way
 *     RM-190 recorded the `zoom` entries above.
 * Declared gap: a group's own code-only members (callbacks, nodes) are not in the snapshot's
 * group data, so a family callback named like one is not seen.
 */
import { CHARTS_PKG, chartsSnapshot, missingSnapshot } from "./charts-deprecated-usage.mjs";

/** `Id::prop` → why it is not drift (ADR 0042 A.5, A.9). Grows only by a maintainer decision. */
export const NOT_DRIFT = new Map([
  ["ChoroplethChart::zoom", "a map viewport zoom (ADR 0042 A.5), not the navigator window"],
  ["TreeChart::zoom", "a tree viewport zoom (ADR 0042 A.5), not the navigator window"],
  [
    "DensityScatterChart::zoom",
    "a plot viewport zoom, wheel + drag pan (ADR 0042 A.5 cites it), not the navigator window",
  ],
  [
    "ChoroplethChart::labels",
    "a place-name label mode, already checked against data-labels and left alone (ADR 0042 A.9, owner-approved 2026-09-27)",
  ],
  [
    "Scatter::labels",
    "a point label mode, already checked against data-labels and left alone (ADR 0042 A.9, owner-approved 2026-09-27)",
  ],
]);

const DEFINITIONS = "packages/charts/src/definitions";

/** `BarValueAxis` → `bar-value-axis`, `LiveXAxis` → `live-x-axis`. */
const kebab = (id) =>
  id
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();

/** `key → [group, …]` for every field some definition takes from, or overrides in, a group. */
export function groupKeys(entries) {
  const keys = new Map();
  for (const entry of Object.values(entries))
    for (const [key, field] of Object.entries(entry.fields ?? {})) {
      const group = field.group ?? field.overrides;
      if (!group) continue;
      const groups = keys.get(key) ?? new Set();
      groups.add(group);
      keys.set(key, groups);
    }
  return keys;
}

/** The drifting props of every entry → `[{ id, prop, groups, codeOnly }]`, sorted. */
export function groupDrift(entries) {
  const keys = groupKeys(entries);
  const drift = [];
  const drifts = (id, prop) => keys.has(prop) && !NOT_DRIFT.has(`${id}::${prop}`);
  for (const id of Object.keys(entries).sort()) {
    const entry = entries[id];
    for (const [prop, field] of Object.entries(entry.fields ?? {}))
      if (drifts(id, prop) && !field.group && !field.overrides)
        drift.push({ id, prop, groups: [...keys.get(prop)].sort(), codeOnly: false });
    for (const prop of entry.codeOnly ?? [])
      if (drifts(id, prop))
        drift.push({ id, prop, groups: [...keys.get(prop)].sort(), codeOnly: true });
  }
  return drift;
}

/** The family's definition file and the line naming `prop`, or the snapshot when not found. */
function locate(ctx, id, prop) {
  for (const file of [
    `${DEFINITIONS}/${kebab(id)}.definition.ts`,
    `${DEFINITIONS}/parts/${kebab(id)}.definition.ts`,
  ]) {
    if (!ctx.exists(file)) continue;
    const lines = ctx.readFile(file).split("\n");
    const named = new RegExp(String.raw`(^|[\s{[,])["']?${prop}\b["']?\s*[:,\]]`);
    const at = lines.findIndex((l) => !/^\s*(\*|\/\/|\/\*)/.test(l) && named.test(l));
    return { file, line: at + 1 || 1 };
  }
  return { file: "packages/cli/lib/definitions.generated.json", line: 1 };
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SNAPSHOT = "packages/cli/lib/definitions.generated.json";
const snap = (entries) => JSON.stringify({ [CHARTS_PKG]: entries });
const f = (group, extra = {}) => ({ kind: "string", group, ...extra });
const BAR = {
  id: "BarChart",
  groups: ["palette", "category-navigator"],
  fields: { palette: f("palette"), align: f("category-navigator") },
  codeOnly: ["children"],
};

export default {
  id: "charts-group-drift",
  scope: "components",
  doc: "A chart definition takes a prop named like a prop-group key (`palette`, `status`, `align`, `plotHeight`, …) from that group — apply the group; an own field of the same name then overrides it — never as a family field of its own; the keys that drift today only shrink, and the one exception list (`zoom` on Choropleth, Tree and DensityScatter, ADR 0042 A.5) grows only by a maintainer decision.",
  baseline: "keys",
  run(ctx) {
    const entries = chartsSnapshot(ctx);
    if (!entries) return [missingSnapshot()];
    return groupDrift(entries).map(({ id, prop, groups, codeOnly }) => ({
      ...locate(ctx, id, prop),
      key: `${CHARTS_PKG}::${id}::${prop}`,
      msg: `${id}.${prop} is ${codeOnly ? "a code-only prop" : "a family field"} named like the ${groups
        .map((g) => `"${g}"`)
        .join(
          " / ",
        )} group key — apply the group (an own field then overrides it), or rename the prop`,
    }));
  },
  fixtures: {
    pass: [
      {
        files: {
          [SNAPSHOT]: snap({
            BarChart: BAR,
            PieChart: {
              id: "PieChart",
              fields: {
                palette: f("palette"),
                plotHeight: f(null, { overrides: "frame-size" }),
                plotAlign: f(null),
              },
              codeOnly: ["children"],
            },
            LineChart: { id: "LineChart", fields: { plotHeight: f("frame-size") }, codeOnly: [] },
          }),
        },
      }, // group fields, a declared override and a family-own name
      {
        files: {
          [SNAPSHOT]: snap({
            BarChart: BAR,
            PieChart: { id: "PieChart", fields: { align: f(null) }, codeOnly: [] },
          }),
          "packages/charts/src/definitions/pie-chart.definition.ts":
            'export const PIE = defineChart({\n  fields: {\n    align: field.enum({ values: ["start", "center"] }),\n  },\n});',
        },
        baseline: ["@elabs-ai/components-charts::PieChart::align"],
      }, // today's drift is held by the baseline
      {
        files: {
          [SNAPSHOT]: snap({
            LineChart: { id: "LineChart", fields: { zoom: f("navigator") }, codeOnly: [] },
            ChoroplethChart: { id: "ChoroplethChart", fields: { zoom: f(null) }, codeOnly: [] },
            TreeChart: { id: "TreeChart", fields: { zoom: f(null) }, codeOnly: [] },
            DensityScatterChart: {
              id: "DensityScatterChart",
              fields: { zoom: f(null) },
              codeOnly: [],
            },
          }),
        },
      }, // ADR 0042 A.5: a map, tree or plot viewport `zoom` is on the exception list
    ],
    fail: [
      {
        files: {
          [SNAPSHOT]: snap({
            BarChart: BAR,
            PieChart: { id: "PieChart", fields: { align: f(null) }, codeOnly: [] },
          }),
        },
      }, // a family `align` beside the navigator group's `align`
      {
        files: {
          [SNAPSHOT]: snap({
            BarChart: BAR,
            LineChart: { id: "LineChart", fields: {}, codeOnly: ["palette"] },
          }),
        },
      }, // a code-only prop named like a group field
      {
        files: {
          [SNAPSHOT]: snap({
            BarChart: BAR,
            PieChart: { id: "PieChart", fields: { align: f(null) }, codeOnly: [] },
            TreeChart: { id: "TreeChart", fields: { align: f(null) }, codeOnly: [] },
          }),
        },
        baseline: ["@elabs-ai/components-charts::PieChart::align"],
      }, // a new drifting key beyond the baseline
      {
        files: {
          [SNAPSHOT]: snap({
            PieChart: {
              id: "PieChart",
              fields: { plotHeight: f(null, { overrides: "frame-size" }) },
              codeOnly: [],
            },
            TreemapChart: { id: "TreemapChart", fields: { plotHeight: f(null) }, codeOnly: [] },
          }),
        },
      }, // the only group-derived `plotHeight` is an override: the key still counts
      {
        files: {
          [SNAPSHOT]: snap({
            LineChart: { id: "LineChart", fields: { zoom: f("navigator") }, codeOnly: [] },
            SankeyChart: { id: "SankeyChart", fields: { zoom: f(null) }, codeOnly: [] },
          }),
        },
      }, // the `zoom` exception names three charts, not the key
      { files: {} }, // no snapshot
    ],
  },
};
