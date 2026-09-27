/**
 * charts-deprecated-usage — no deprecated chart prop name in the repo's stories, docs, templates
 * or non-test source (ADR 0042 §8 and §11, RM-190).
 *
 * Why: a rename keeps the old name working until 6.0.0 and warns once in development. If the
 * repo's own code still passes the old name — WaterfallChart rendering `<Bar showValues>`,
 * AutoChart rendering a family, a story, a template a consumer copies — every consumer app gets a
 * deprecation warning for code it never wrote, and every reader copies the old name. ADR 0042 §8
 * has each rename item migrate its internal callers in the same PR; this rule holds that at zero
 * findings (baseline none).
 *
 * The old names are the alias rows of the committed definition snapshot
 * (`packages/cli/lib/definitions.generated.json`, charts package), read at run time and never
 * copied into a hand list, so each rename item (RM-191 … RM-196) is covered the moment its row
 * lands. A row belongs to one component, so the check is component-scoped: with a `HeatmapChart`
 * row for `showValues`, `<HeatmapChart showValues>` is flagged and `<Bar showValues>` is not, and
 * BulletChart's old `labels` never flags Pie's current `labels`.
 *
 * A use is the old name as a JSX attribute on that component's tag (`<Bar showValues />`,
 * `<YAxis orientation="left">`, `<Charts.Bar …>`), a key of an object literal spread onto the
 * tag, or a key of the props literal in `createElement(Bar, { showValues: true })`. Files are
 * read with the TypeScript parser, so a comment (the `@deprecated` TSDoc), a string (a Storybook
 * autodocs note) and the alias row itself (`{ from: "showValues", … }`, plain data) are never a
 * use. Markdown is read only inside fenced code blocks: a fence is code a reader copies, while
 * prose and inline code may name the old prop to explain the rename.
 *
 * Read: stories anywhere, `*.md` / `*.mdx` fences, templates (`docs/**` code,
 * `registry/blocks/**`, `skills/**`) and the non-test source of every package — the charts
 * package first (WaterfallChart → Bar, AutoChart → families, ChartMultiples), and every other
 * package that renders a chart (process, ui, …), because its warning reaches a consumer the same
 * way. Not read: app source outside stories (`apps/home`, `apps/docs` code — the repo's own
 * site, never installed by a consumer), tests (a per-alias test must pass the old name), the
 * `./test` double under `packages/charts/src/test/**` (it keeps both names until 6.0, ADR 0042
 * §8), and history — ADRs, reviews, plans, the roadmap, changelogs, changesets, the ledger and
 * `parked/**` record what the names were.
 *
 * Declared gaps: props spread from a variable (`<Bar {...props} />`), a renamed import
 * (`import { Bar as B }`) and live JSX in MDX outside a fence are not read.
 * Cost: nothing while the snapshot has no alias rows; after that only a file holding both a
 * renamed component's tag and one of its old names is parsed.
 */
import ts from "typescript";

export const SNAPSHOT = "packages/cli/lib/definitions.generated.json";
export const CHARTS_PKG = "@elabs-ai/components-charts";

/** The charts package's snapshot entries (`{ [id]: entry }`), or null when the file is missing. */
export function chartsSnapshot(ctx) {
  if (!ctx.exists(SNAPSHOT)) return null;
  return ctx.json(SNAPSHOT)[CHARTS_PKG] ?? {};
}

/** The one finding a snapshot-reading rule reports when the snapshot is gone. */
export const missingSnapshot = () => ({
  file: SNAPSHOT,
  line: 1,
  msg: "the definition snapshot is missing — run `pnpm gen`",
});

const SCAN = [
  "**/*.stories.{ts,tsx}",
  "**/*.{md,mdx}",
  "packages/*/src/**/*.{ts,tsx}",
  "{docs,registry/blocks,skills}/**/*.{ts,tsx}",
];
const IGNORE = [
  "**/{node_modules,dist,.next,storybook-static}/**",
  "**/*.{test,spec}.{ts,tsx}",
  "**/*.test-d.ts",
  "**/{__fixtures__,__baselines__,__tests__,e2e}/**",
  "packages/charts/src/test/**",
  "docs/{ADR,decisions,handoff,review,rules-history,superpowers}/**",
  "{roadmap,parked,.changeset}/**",
  "**/CHANGELOG.md",
  "LEDGER.md",
];

const FENCE_LANGS = new Set(["", "tsx", "jsx", "ts", "js", "typescript", "javascript", "mdx"]);

/** `id → Map(from → row)` for every component with at least one alias row. */
export function aliasRowsByComponent(entries) {
  const out = new Map();
  for (const id of Object.keys(entries).sort()) {
    for (const row of entries[id]?.aliases ?? []) {
      if (!out.has(id)) out.set(id, new Map());
      out.get(id).set(row.from, row);
    }
  }
  return out;
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Cheap text pre-filter per component: its tag or `createElement` call, and one of its old names. */
function prefilters(rowsByComponent) {
  return [...rowsByComponent].map(([id, rows]) => ({
    id,
    tag: new RegExp(
      String.raw`<(?:[\w$]+\.)?${escape(id)}[\s/>]|createElement\(\s*(?:[\w$]+\.)?${escape(id)}\b`,
    ),
    name: new RegExp(String.raw`\b(?:${[...rows.keys()].map(escape).join("|")})\b`),
  }));
}

/** The components whose rows could match somewhere in `text` (empty = nothing to parse). */
function candidates(text, filters) {
  return filters.filter((f) => f.tag.test(text) && f.name.test(text)).map((f) => f.id);
}

/** Fenced code blocks of a Markdown/MDX file → `[{ code, line }]` (`line` = first code line). */
function fencedBlocks(text) {
  const blocks = [];
  const lines = text.split("\n");
  let open = null;
  for (let i = 0; i < lines.length; i++) {
    const fence = /^\s*(`{3,}|~{3,})\s*([\w-]*)/.exec(lines[i]);
    if (!open) {
      if (fence) open = { marker: fence[1], lang: fence[2].toLowerCase(), start: i + 1, body: [] };
      continue;
    }
    if (fence && fence[1][0] === open.marker[0] && fence[1].length >= open.marker.length) {
      if (FENCE_LANGS.has(open.lang))
        blocks.push({ code: open.body.join("\n"), line: open.start + 1 });
      open = null;
      continue;
    }
    open.body.push(lines[i]);
  }
  return blocks;
}

const nameOf = (node) =>
  !node
    ? null
    : ts.isIdentifier(node)
      ? node.text
      : ts.isPropertyAccessExpression(node)
        ? node.name.text
        : null;

const keyOf = (prop) =>
  (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) &&
  (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name))
    ? prop.name.text
    : null;

/** Every use of an old name in one parsed source → `[{ id, row, pos }]`. */
function usesIn(sf, rowsByComponent) {
  const uses = [];
  const fromObject = (id, rows, object) => {
    for (const prop of object.properties) {
      const row = rows.get(keyOf(prop));
      if (row) uses.push({ id, row, pos: prop.getStart(sf) });
    }
  };
  const visit = (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const id = nameOf(node.tagName);
      const rows = rowsByComponent.get(id);
      if (rows) {
        for (const attr of node.attributes.properties) {
          if (ts.isJsxAttribute(attr) && ts.isIdentifier(attr.name)) {
            const row = rows.get(attr.name.text);
            if (row) uses.push({ id, row, pos: attr.getStart(sf) });
          } else if (
            ts.isJsxSpreadAttribute(attr) &&
            ts.isObjectLiteralExpression(attr.expression)
          ) {
            fromObject(id, rows, attr.expression);
          }
        }
      }
    } else if (ts.isCallExpression(node) && nameOf(node.expression) === "createElement") {
      const id = nameOf(node.arguments[0]);
      const rows = rowsByComponent.get(id);
      const props = node.arguments[1];
      if (rows && props && ts.isObjectLiteralExpression(props)) fromObject(id, rows, props);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return uses;
}

/** Findings for one piece of code (a source file, or one fence starting at `firstLine`). */
function findingsIn(file, code, firstLine, rowsByComponent, kind) {
  const sf = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, false, kind);
  return usesIn(sf, rowsByComponent).map(({ id, row, pos }) => ({
    file,
    line: firstLine + sf.getLineAndCharacterOfPosition(pos).line,
    msg: `\`<${id} ${row.from}>\` uses a deprecated prop — write \`${row.to}\` (alias row${
      row.since ? ` since ${row.since}` : ""
    }, removed in ${row.removeIn})`,
  }));
}

/** Every deprecated use in the given files (exported for a quick local audit). */
export function deprecatedUsages(ctx, entries, files) {
  const rowsByComponent = aliasRowsByComponent(entries);
  if (rowsByComponent.size === 0) return [];
  const filters = prefilters(rowsByComponent);
  const findings = [];
  for (const file of files) {
    const text = ctx.readFile(file);
    if (candidates(text, filters).length === 0) continue;
    if (/\.mdx?$/.test(file)) {
      for (const block of fencedBlocks(text)) {
        if (candidates(block.code, filters).length === 0) continue;
        findings.push(
          ...findingsIn(file, block.code, block.line, rowsByComponent, ts.ScriptKind.TSX),
        );
      }
    } else {
      const kind = file.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.TSX;
      findings.push(...findingsIn(file, text, 1, rowsByComponent, kind));
    }
  }
  return findings;
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** A snapshot holding the given alias rows (`{ id: [row, …] }`) — the shape gen writes. */
const snapshotWith = (rowsById) =>
  JSON.stringify({
    [CHARTS_PKG]: Object.fromEntries(
      Object.entries(rowsById).map(([id, rows]) => [
        id,
        { id, kind: "chart", fields: {}, codeOnly: [], aliases: rows },
      ]),
    ),
  });
const row = (from, to, transform = "identity", precedence = "new-wins") => ({
  from,
  to,
  transform,
  precedence,
  since: "5.6.0",
  removeIn: "6.0.0",
});
/** The seeded row every fixture below reads: HeatmapChart `showValues` → `labels` (A.3 row 14). */
const SEEDED = snapshotWith({
  HeatmapChart: [row("showValues", "labels", "boolean-to-labels")],
  Bar: [row("showValues", "labels")],
  YAxis: [row("orientation", "position")],
});
const HEATMAP_STORY = "packages/charts/src/charts/heatmap/heatmap-chart.stories.tsx";

export default {
  id: "charts-deprecated-usage",
  scope: "repo",
  doc: "No deprecated chart prop name (an alias row of the definition snapshot, e.g. `<HeatmapChart showValues>` once it is renamed) in stories, Markdown code fences, templates, registry blocks or non-test package source — write the new name, so consumers never see a deprecation warning for code they did not write; tests, the `./test` double and history docs are exempt.",
  baseline: "none",
  run(ctx) {
    const entries = chartsSnapshot(ctx);
    if (!entries) return [missingSnapshot()];
    if (aliasRowsByComponent(entries).size === 0) return [];
    return deprecatedUsages(ctx, entries, ctx.glob(SCAN, { ignore: IGNORE }));
  },
  fixtures: {
    pass: [
      {
        files: {
          [SNAPSHOT]: snapshotWith({}),
          [HEATMAP_STORY]: "export const S = () => <HeatmapChart data={d} showValues />;",
        },
      }, // no alias rows yet (today): nothing is deprecated, nothing is read
      {
        files: {
          [SNAPSHOT]: SEEDED,
          [HEATMAP_STORY]:
            'export const S = () => (\n  <>\n    <HeatmapChart data={d} labels />\n    <PieChart data={d} showValues />\n    <BarChart orientation="horizontal" data={d}>\n      <YAxis position="left" />\n    </BarChart>\n  </>\n);',
        },
      }, // the new names; the same old name on a component without that row is not a use
      {
        files: {
          [SNAPSHOT]: SEEDED,
          "packages/charts/src/definitions/heatmap-chart.definition.ts":
            'export const HEATMAP = defineChart({\n  aliases: [{ from: "showValues", to: "labels", transform: "boolean-to-labels", precedence: "new-wins", since: "5.6.0", removeIn: "6.0.0" }],\n});',
          "packages/charts/src/charts/heatmap/heatmap-chart.tsx":
            'export interface HeatmapChartProps {\n  /**\n   * @deprecated Use `labels`. `<HeatmapChart showValues />` still works until 6.0.0.\n   */\n  showValues?: boolean;\n}\n// was: <HeatmapChart showValues />\nexport const NOTE = "<HeatmapChart showValues /> is deprecated";',
          "packages/charts/src/charts/heatmap/heatmap-chart.test.tsx":
            'it("aliases showValues", () => { render(<HeatmapChart data={d} showValues />); });',
          "packages/charts/src/test/doubles.tsx":
            "export const read = (p) => p.labels ?? p.showValues; // both names until 6.0",
        },
      }, // the alias row, the @deprecated declaration, a string, a comment, the per-alias test, the double
      {
        files: {
          [SNAPSHOT]: SEEDED,
          "docs/ADR/0042-chart-definitions.md": "```tsx\n<HeatmapChart showValues />\n```",
          "roadmap/chart-definitions/RM-193.md": "```tsx\n<Bar showValues />\n```",
          "CHANGELOG.md": "```tsx\n<Bar showValues />\n```",
          "docs/CONSUMING.md":
            "Heatmap's `showValues` is now `labels`: `<HeatmapChart showValues>` still works.\n\n```tsx\n<HeatmapChart labels />\n```",
          "apps/home/components/blocks/heat-01/heat.tsx":
            "export const B = () => <HeatmapChart data={rows} showValues />;",
        },
      }, // history is exempt; prose and inline code may name the old prop; fences use the new one; app source is the repo's own site
    ],
    fail: [
      {
        files: {
          [SNAPSHOT]: SEEDED,
          [HEATMAP_STORY]: "export const S = () => <HeatmapChart data={d} showValues />;",
        },
      }, // a story
      {
        files: {
          [SNAPSHOT]: SEEDED,
          "apps/docs/stories/blocks/heat.stories.tsx":
            "export const S = () => <HeatmapChart data={d} showValues />;",
        },
      }, // a story outside the packages
      {
        files: {
          [SNAPSHOT]: SEEDED,
          "packages/charts/src/charts/waterfall-chart.tsx":
            'export const Plot = () => <Bar dataKey="value" showValues={labelsOn} />;',
        },
      }, // an internal caller in non-test chart source
      {
        files: {
          [SNAPSHOT]: SEEDED,
          "packages/charts/src/auto-chart/auto-chart.tsx":
            'export const Axis = () => <YAxis formatValue={f} {...axisProps.y} orientation="right" />;',
        },
      }, // a part's row: `orientation` on YAxis (not on BarChart)
      {
        files: {
          [SNAPSHOT]: SEEDED,
          "packages/charts/src/auto-chart/render.ts":
            "export const el = () => createElement(HeatmapChart, { data, showValues: true });",
        },
      }, // createElement props
      {
        files: {
          [SNAPSHOT]: SEEDED,
          "skills/brand-ui/SKILL.md":
            "Plot a matrix:\n\n```tsx\n<HeatmapChart data={rows} showValues />\n```",
        },
      }, // a docs fence
      {
        files: {
          [SNAPSHOT]: SEEDED,
          "docs/playbooks/templates/dashboard.tsx":
            "export const T = () => <Charts.HeatmapChart data={rows} {...{ showValues: true }} />;",
        },
      }, // a template, a namespaced tag and a literal spread
      {
        files: {
          [SNAPSHOT]: SEEDED,
          "packages/process/src/variants/variant-heatmap.tsx":
            "export const V = () => <HeatmapChart data={rows} showValues />;",
        },
      }, // another package rendering a chart
      { files: { [HEATMAP_STORY]: "export const S = () => <HeatmapChart />;" } }, // no snapshot
    ],
  },
};
