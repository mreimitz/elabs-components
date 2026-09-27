/**
 * The 6.0 tripwire (ADR 0042 §8 and §11, RM-190).
 *
 * Every alias row, and the four legacy deprecations ADR 0042 §8 lists, promise removal in
 * 6.0.0: `ChartSelection`, `ChartBrushLayout`, the `height` aliases (WaterfallChart, ChartFrame,
 * AutoChart) and Scatter `trend`. This test reads the charts package version. Below 6.0.0 it
 * passes whatever is still here. At 6.0.0 or above — a prerelease of 6.0.0 counts — it fails
 * while any alias row remains in the definition registry, or while any of the four is still
 * declared. RM-205 removes them; this is what makes a forgotten one fail the release.
 *
 * Scoped on purpose, and nothing else: it does not look at every `@deprecated` tag (TooltipBox
 * `left` / `top`, the DensityScatter range labels, Gantt `Status` and the rest keep their own
 * timelines). The scope is pinned by a test below.
 *
 * Detection reads source, because two of the four are types: an export is present while a
 * non-test file under `src/` declares or re-exports that name (the `./test` double's
 * `ChartBrushLayout` counts — it ships too); a prop is present while its props interface
 * declares it. An interface that cannot be found throws instead of passing, so a moved or
 * renamed interface can never make the tripwire pass silently.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { type NormalizedAliasRow, normalizeAliases } from "@elabs-ai/components-ui/definition";

import { CHART_DEFINITIONS, PART_DEFINITIONS, SURFACE_DEFINITIONS } from "./registry";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE_JSON = join(SRC, "..", "package.json");

/** The version the tripwire arms at. */
const TRIPWIRE = "6.0.0";

type LegacyDeprecation =
  | { readonly name: string; readonly kind: "export"; readonly symbol: string }
  | {
      readonly name: string;
      readonly kind: "prop";
      readonly file: string;
      readonly iface: string;
      readonly prop: string;
    };

/** ADR 0042 §8's listed legacy deprecations — and nothing else. */
const LEGACY: readonly LegacyDeprecation[] = [
  { name: "ChartSelection", kind: "export", symbol: "ChartSelection" },
  { name: "ChartBrushLayout", kind: "export", symbol: "ChartBrushLayout" },
  {
    name: "WaterfallChart height",
    kind: "prop",
    file: "charts/waterfall-chart.tsx",
    iface: "WaterfallChartProps",
    prop: "height",
  },
  {
    name: "ChartFrame height",
    kind: "prop",
    file: "chart-frame/chart-frame.tsx",
    iface: "ChartFrameProps",
    prop: "height",
  },
  {
    name: "AutoChart height",
    kind: "prop",
    file: "auto-chart/auto-chart.tsx",
    iface: "AutoChartProps",
    prop: "height",
  },
  {
    name: "Scatter trend",
    kind: "prop",
    file: "charts/scatter.tsx",
    iface: "ScatterProps",
    prop: "trend",
  },
];

// ── The rule ────────────────────────────────────────────────────────────────

/** `major.minor.patch` → a comparable tuple; a prerelease (`6.0.0-rc.1`) counts as its release. */
function versionTuple(version: string): [number, number, number] {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!match) throw new Error(`tripwire: "${version}" is not a semver version`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function atLeast(version: string, floor: string): boolean {
  const a = versionTuple(version);
  const b = versionTuple(floor);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return (a[i] as number) > (b[i] as number);
  return true;
}

interface AliasRowOf {
  readonly id: string;
  readonly row: NormalizedAliasRow;
}

interface TripwireInput {
  readonly version: string;
  readonly rows: readonly AliasRowOf[];
  /** Names of the listed legacy deprecations still present. */
  readonly legacy: readonly string[];
}

/** What 6.0.0 still has to remove — empty below 6.0.0, whatever remains. */
function tripwireFindings({ version, rows, legacy }: TripwireInput): string[] {
  if (!atLeast(version, TRIPWIRE)) return [];
  return [
    ...rows.map(
      ({ id, row }) =>
        `alias row ${id}.${row.from} → ${row.to} (removeIn ${row.removeIn}) is still registered`,
    ),
    ...legacy.map((name) => `legacy deprecation ${name} is still declared`),
  ];
}

// ── Reading the package ─────────────────────────────────────────────────────

function chartsVersion(): string {
  return (JSON.parse(readFileSync(PACKAGE_JSON, "utf8")) as { version: string }).version;
}

/** Every alias row of every registered definition. */
function registeredAliasRows(): AliasRowOf[] {
  const rows: AliasRowOf[] = [];
  for (const map of [CHART_DEFINITIONS, PART_DEFINITIONS, SURFACE_DEFINITIONS]) {
    for (const [id, def] of Object.entries(map)) {
      for (const row of normalizeAliases(def.aliases)) rows.push({ id, row });
    }
  }
  return rows;
}

/** Non-test source under `src/` (the shipped files, the `./test` double included). */
function shippedSources(): { file: string; text: string }[] {
  const out: { file: string; text: string }[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!/^(__fixtures__|__baselines__|node_modules)$/.test(entry.name)) walk(path);
      } else if (/\.tsx?$/.test(entry.name) && !/\.(test|stories|test-d)\.tsx?$/.test(entry.name)) {
        out.push({ file: relative(SRC, path), text: readFileSync(path, "utf8") });
      }
    }
  };
  walk(SRC);
  return out;
}

/** Does any of `sources` declare (or re-export as) `symbol`? */
function exportsSymbol(sources: readonly { text: string }[], symbol: string): boolean {
  const declared = new RegExp(
    String.raw`^export\s+(?:declare\s+)?(?:default\s+)?(?:async\s+)?(?:function\*?|const|let|var|class|interface|type|enum)\s+${symbol}\b`,
    "m",
  );
  const renamed = new RegExp(String.raw`\bexport\s+(?:type\s+)?\{[^}]*\bas\s+${symbol}\b[^}]*\}`);
  return sources.some(({ text }) => declared.test(text) || renamed.test(text));
}

/** Does interface `iface` in `text` declare `prop`? Throws when the interface is not there. */
function declaresProp(text: string, file: string, iface: string, prop: string): boolean {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX);
  const declarations = sf.statements.filter(
    (s): s is ts.InterfaceDeclaration => ts.isInterfaceDeclaration(s) && s.name.text === iface,
  );
  if (declarations.length === 0)
    throw new Error(`tripwire: ${file} no longer declares ${iface} — update LEGACY`);
  return declarations.some((d) =>
    d.members.some(
      (m) => ts.isPropertySignature(m) && ts.isIdentifier(m.name) && m.name.text === prop,
    ),
  );
}

/** Names of the listed legacy deprecations still present in the package. */
function presentLegacy(): string[] {
  const sources = shippedSources();
  return LEGACY.filter((item) =>
    item.kind === "export"
      ? exportsSymbol(sources, item.symbol)
      : declaresProp(readFileSync(join(SRC, item.file), "utf8"), item.file, item.iface, item.prop),
  ).map((item) => item.name);
}

// ── Tests ───────────────────────────────────────────────────────────────────

const SEEDED_ROW: AliasRowOf = {
  id: "HeatmapChart",
  row: {
    from: "showValues",
    to: "labels",
    transform: "boolean-to-labels",
    precedence: "new-wins",
    since: "5.6.0",
    removeIn: "6.0.0",
  },
};

describe("the 6.0 tripwire", () => {
  it("holds for the package as it is", () => {
    const findings = tripwireFindings({
      version: chartsVersion(),
      rows: registeredAliasRows(),
      legacy: presentLegacy(),
    });
    expect(findings).toEqual([]);
  });

  it("passes on 5.x while alias rows and every listed deprecation remain", () => {
    const legacy = LEGACY.map((item) => item.name);
    for (const version of ["5.5.0", "5.99.9"])
      expect(tripwireFindings({ version, rows: [SEEDED_ROW], legacy })).toEqual([]);
  });

  it("fails on a seeded 6.0.0 with a remaining alias row", () => {
    expect(tripwireFindings({ version: "6.0.0", rows: [SEEDED_ROW], legacy: [] })).toEqual([
      "alias row HeatmapChart.showValues → labels (removeIn 6.0.0) is still registered",
    ]);
  });

  it("fails at or above 6.0.0 — a prerelease counts — while a listed deprecation remains", () => {
    for (const version of ["6.0.0-rc.1", "6.0.0", "6.2.0"])
      expect(tripwireFindings({ version, rows: [], legacy: ["ChartBrushLayout"] })).toEqual([
        "legacy deprecation ChartBrushLayout is still declared",
      ]);
  });

  it("passes on 6.0.0 once every row and listed deprecation is gone", () => {
    expect(tripwireFindings({ version: "6.0.0", rows: [], legacy: [] })).toEqual([]);
  });

  it("is scoped to the alias rows plus the four listed legacy deprecations", () => {
    expect(LEGACY.map((item) => item.name)).toEqual([
      "ChartSelection",
      "ChartBrushLayout",
      "WaterfallChart height",
      "ChartFrame height",
      "AutoChart height",
      "Scatter trend",
    ]);
  });

  it("detects a declared or re-exported symbol, not a longer name", () => {
    expect(exportsSymbol([{ text: "export interface ChartSelection {}" }], "ChartSelection")).toBe(
      true,
    );
    expect(
      exportsSymbol(
        [{ text: "export const ChartBrushLayout = memo(function ChartBrushLayout() {});" }],
        "ChartBrushLayout",
      ),
    ).toBe(true);
    expect(
      exportsSymbol(
        [{ text: "export { Legacy as ChartSelection } from './x';" }],
        "ChartSelection",
      ),
    ).toBe(true);
    expect(
      exportsSymbol(
        [
          {
            text: "export function ChartSelectionMark() {}\nimport { ChartSelection } from './x';",
          },
        ],
        "ChartSelection",
      ),
    ).toBe(false);
  });

  it("detects a prop on its interface, and throws when the interface is gone", () => {
    const src =
      "export interface ScatterProps extends Base {\n  /** @deprecated */\n  trend?: boolean;\n}";
    expect(declaresProp(src, "scatter.tsx", "ScatterProps", "trend")).toBe(true);
    expect(declaresProp(src, "scatter.tsx", "ScatterProps", "analytics")).toBe(false);
    expect(() => declaresProp("export {};", "scatter.tsx", "ScatterProps", "trend")).toThrow(
      /no longer declares ScatterProps/,
    );
  });
});
