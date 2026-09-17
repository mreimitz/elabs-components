/**
 * `brand-ui dashboard-spec` (RM-086, #427) — agent tooling for `DashboardSpec` v1:
 *
 *   schema                              print the JSON Schema (draft 2020-12)
 *   validate <file>                     validate a spec; print `path  code  message`, exit 1 on errors
 *   kinds                               list the nine built-in tile kinds with sizes + capabilities
 *   layout <file> [--strategy=<s>]      fill missing tile layouts with `autoLayout`, print the spec
 *
 * The logic is NOT re-implemented here: it runs the esbuild bundle of the charts
 * dashboard core (`dashboard-spec.generated.mjs`, written by `pnpm gen`), so the CLI
 * and `@elabs-ai/components-charts/dashboard` can never disagree. Pure functions over
 * already-parsed input — `bin/brand-ui.mjs` owns reading files and exit codes.
 */
import {
  autoLayout,
  BUILT_IN_TILE_KIND_DEFAULTS,
  DASHBOARD_SPEC_SCHEMA,
  validateDashboardSpec,
} from "./dashboard-spec.generated.mjs";

/**
 * The verbs, one row each — the single source for the generated `dashboard-spec`
 * region of skills/brand-ui/SKILL.md (`pnpm gen`).
 */
export const DASHBOARD_SPEC_VERB_DOCS = [
  {
    verb: "schema",
    usage: "brand-ui dashboard-spec schema",
    does: "Prints the DashboardSpec v1 JSON Schema (draft 2020-12; also published as `@elabs-ai/components-charts/dashboard/schema.json`).",
  },
  {
    verb: "validate",
    usage: "brand-ui dashboard-spec validate <file> [--json]",
    does: "Runs `validateDashboardSpec`: one `path code message` line per problem (shape, duplicate ids, dangling refs, overlaps, conditions); exit 1 when invalid.",
  },
  {
    verb: "kinds",
    usage: "brand-ui dashboard-spec kinds [--json]",
    does: "Lists the nine built-in tile kinds with default and minimum sizes and capabilities.",
  },
  {
    verb: "layout",
    usage: "brand-ui dashboard-spec layout <file> [--strategy=by-kind|reading-order]",
    does: "Places every tile that has no `layout` with `autoLayout` (existing layouts kept) and prints the spec.",
  },
];

export const DASHBOARD_SPEC_VERBS = DASHBOARD_SPEC_VERB_DOCS.map((d) => d.verb);

/** The generated SKILL.md region: a verb table an agent reads before emitting a sheet. */
export function renderDashboardSpecSkillTable() {
  const rows = DASHBOARD_SPEC_VERB_DOCS.map(
    (d) => `| \`${d.usage.replaceAll("|", "\\|")}\` | ${d.does} |`,
  );
  return [
    "> **Generated** by `pnpm gen` from the CLI's dashboard-spec module — edit there, not here.",
    "",
    "| Command | What it does |",
    "| --- | --- |",
    ...rows,
    "",
  ].join("\n");
}

export const AUTO_LAYOUT_STRATEGIES = ["by-kind", "reading-order"];

export const DASHBOARD_SPEC_USAGE =
  "usage: brand-ui dashboard-spec <schema|validate <file>|kinds|layout <file> [--strategy=by-kind|reading-order]> [--json]\n" +
  "  Agent tooling for DashboardSpec v1 — see skills/brand-ui/reference/sheet-for.md";

/** The JSON Schema object (identical to `@elabs-ai/components-charts/dashboard/schema.json`). */
export function dashboardSpecSchema() {
  return DASHBOARD_SPEC_SCHEMA;
}

/** `validateDashboardSpec` over a parsed value: `{ ok: true } | { ok: false, errors }`. */
export function validateSpec(input) {
  const result = validateDashboardSpec(input);
  return result.ok ? { ok: true, errors: [] } : { ok: false, errors: result.errors };
}

/** One line per error, aligned: `tiles[1].id  duplicate-id  …`. */
export function renderValidationText(file, result) {
  if (result.ok) return `${file}: valid DashboardSpec v1`;
  const width = Math.max(...result.errors.map((e) => e.path.length));
  const codeWidth = Math.max(...result.errors.map((e) => e.code.length));
  const rows = result.errors.map(
    (e) => `  ${e.path.padEnd(width)}  ${e.code.padEnd(codeWidth)}  ${e.message}`,
  );
  const noun = result.errors.length === 1 ? "error" : "errors";
  return [`${file}: ${result.errors.length} ${noun}`, ...rows].join("\n");
}

/** The built-in tile kinds with their sizes and capabilities. */
export function builtInKinds() {
  return BUILT_IN_TILE_KIND_DEFAULTS;
}

export function renderKindsText(kinds) {
  const size = (s) => `${s.w}×${s.h}`;
  const width = Math.max(...kinds.map((k) => k.kind.length));
  const lines = kinds.map((k) => {
    const caps = Object.entries(k.capabilities)
      .filter(([, on]) => on)
      .map(([name]) => name)
      .join(", ");
    return `  ${k.kind.padEnd(width)}  default ${size(k.defaultSize).padEnd(5)}  min ${size(k.minSize).padEnd(5)}  ${caps || "—"}`;
  });
  return [
    `${kinds.length} built-in tile kinds (w×h in grid cells, 24-column reference):`,
    ...lines,
  ].join("\n");
}

/**
 * Run `autoLayout` over a spec's tiles with the built-in kind sizes and return the spec
 * with every tile placed. Tiles that already have a layout keep it. The grid is written
 * back only when the input had one (it may gain rows when `extendable`).
 */
export function layoutSpec(spec, { strategy = "by-kind" } = {}) {
  if (!AUTO_LAYOUT_STRATEGIES.includes(strategy)) {
    throw new Error(
      `unknown --strategy "${strategy}" (expected ${AUTO_LAYOUT_STRATEGIES.join(" or ")})`,
    );
  }
  if (!spec || typeof spec !== "object" || !Array.isArray(spec.tiles)) {
    throw new Error("the file is not a DashboardSpec object with a tiles array");
  }
  const { tiles, grid } = autoLayout(spec.tiles, spec.grid ?? {}, BUILT_IN_TILE_KIND_DEFAULTS, {
    strategy,
  });
  return spec.grid ? { ...spec, grid, tiles } : { ...spec, tiles };
}
