/**
 * manifest-extends.test.mjs — RM-179: the textual `extends` resolver and the definitions
 * snapshot join behind the manifest's prop tables.
 *
 * `extractPropTable` records a props type's bases (`extends A, B<T>`, `A & B`); the resolver
 * (`createTypeResolver` in lib/core.mjs) expands every base DECLARED IN THE REPO into the
 * props it contributes, each tagged with `from`, and `joinDefinitions` adds the definitions
 * snapshot's default, kind, group and `deprecated` to each prop. The fixture repos below are
 * tiny temp directories shaped like the monorepo (`packages/<pkg>/package.json` + `src/`), so
 * every case — `Omit`/`Pick`/`Partial`, generics, `.tsx` declarations, intersections,
 * multi-level `extends`, cross-file and cross-package imports — is pinned on its own; the
 * last tests run the real manifest and the real `brand-ui docs` command.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  createTypeResolver,
  deprecationText,
  extractPropTable,
  findRepoRoot,
  flat,
  generateManifest,
  joinDefinitions,
} from "../lib/core.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const bin = join(here, "..", "bin", "brand-ui.mjs");
const repoRoot = findRepoRoot(here);

/** Write `files` (path → text) under a fresh temp root; returns the root. */
function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "brand-ui-manifest-extends-"));
  for (const [rel, text] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, text);
  }
  return root;
}

/** Resolve `typeText` as written in `file` of a fixture; returns `{ name: from }`. */
function resolveIn(root, file, typeText) {
  const props = createTypeResolver(root).resolve(join(root, file), typeText);
  return Object.fromEntries(props.map((p) => [p.name, p.from ?? null]));
}

/** `extractPropTable` + `expand`, the way `collectProps` builds a manifest entry. */
function tableFor(root, file, name) {
  const table = extractPropTable(readFileSync(join(root, file), "utf8"), name);
  return createTypeResolver(root).expand(join(root, file), table);
}

const withFixture = (files, fn) => {
  const root = fixture(files);
  try {
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

test("Omit / Pick / Partial apply to a local base", () => {
  withFixture(
    {
      "src/a.ts": [
        "export interface Base {",
        "  /** A. */",
        "  a: string;",
        "  b?: number;",
        "  c: boolean;",
        "}",
        'type Keys = "b" | "c";',
        "",
      ].join("\n"),
    },
    (root) => {
      assert.deepEqual(resolveIn(root, "src/a.ts", 'Omit<Base, "a">'), { b: "Base", c: "Base" });
      assert.deepEqual(resolveIn(root, "src/a.ts", "Omit<Base, Keys>"), { a: "Base" });
      assert.deepEqual(resolveIn(root, "src/a.ts", 'Pick<Base, "a" | "c">'), {
        a: "Base",
        c: "Base",
      });
      const partial = createTypeResolver(root).resolve(join(root, "src/a.ts"), "Partial<Base>");
      assert.ok(
        partial.every((p) => p.optional),
        "Partial makes every inherited prop optional",
      );
      assert.equal(partial.find((p) => p.name === "a").description, "A.", "TSDoc carried over");
      // Keys that are not string literals are unknowable textually: expand nothing rather
      // than a wrong set.
      assert.deepEqual(resolveIn(root, "src/a.ts", "Omit<Base, (typeof K)[number]>"), {});
    },
  );
});

test("generics: arguments are substituted into member types; a missing one takes its default", () => {
  withFixture(
    {
      "src/g.ts": [
        "export interface Box<T = string, U extends object = Record<string, unknown>> {",
        "  value: T;",
        "  items?: T[];",
        "  meta?: U;",
        "  render?: (value: T) => void;",
        "}",
        "",
      ].join("\n"),
    },
    (root) => {
      const r = createTypeResolver(root);
      const withArg = r.resolve(join(root, "src/g.ts"), "Box<number>");
      const type = (list, n) => list.find((p) => p.name === n).type;
      assert.equal(type(withArg, "value"), "number");
      assert.equal(type(withArg, "items"), "number[]");
      assert.equal(type(withArg, "meta"), "Record<string, unknown>", "default of U");
      assert.equal(type(withArg, "render"), "(value: number) => void");
      const bare = r.resolve(join(root, "src/g.ts"), "Box");
      assert.equal(type(bare, "value"), "string", "default of T");
      const union = r.resolve(join(root, "src/g.ts"), "Box<A | B>");
      assert.equal(type(union, "items"), "(A | B)[]", "a union argument keeps its grouping");
    },
  );
});

test("a generic props interface's parameter list no longer leaks into `extends`", () => {
  const src = [
    "export interface DataTableProps<TData extends RowData = RowData, TValue = unknown>",
    '  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {',
    "  data: TData[];",
    "}",
    "",
  ].join("\n");
  const table = extractPropTable(src, "DataTable");
  assert.deepEqual(table.extends, ['Omit<HTMLAttributes<HTMLDivElement>, "children">']);
  assert.deepEqual(
    table.props.map((p) => p.name),
    ["data"],
  );
});

test(".tsx declarations resolve, across a relative import", () => {
  withFixture(
    {
      "src/base.tsx": [
        'import type { ReactNode } from "react";',
        "export interface PanelBaseProps {",
        "  title: ReactNode;",
        "}",
        "export const PanelBase = (p: PanelBaseProps) => <div>{p.title}</div>;",
        "",
      ].join("\n"),
      "src/panel.tsx": [
        'import type { PanelBaseProps } from "./base";',
        "export interface PanelProps extends PanelBaseProps {",
        "  dense?: boolean;",
        "}",
        "",
      ].join("\n"),
    },
    (root) => {
      const table = tableFor(root, "src/panel.tsx", "Panel");
      assert.deepEqual(
        table.props.map((p) => [p.name, p.from ?? null]),
        [
          ["dense", null],
          ["title", "PanelBaseProps"],
        ],
        "own props first, inherited appended with `from`",
      );
    },
  );
});

test("intersections: a type-alias base, an inline literal and `&` members all expand", () => {
  withFixture(
    {
      "src/i.ts": [
        "interface A { a: string }",
        "interface B { b: number }",
        "export type Mixed = A & B & { c?: boolean };",
        "export type ChipProps = Mixed & { own: string };",
        "",
      ].join("\n"),
    },
    (root) => {
      assert.deepEqual(resolveIn(root, "src/i.ts", "Mixed"), { a: "A", b: "B", c: "Mixed" });
      const table = tableFor(root, "src/i.ts", "Chip");
      assert.deepEqual(
        table.props.map((p) => [p.name, p.from ?? null]),
        [
          ["own", null],
          ["a", "A"],
          ["b", "B"],
          ["c", "Mixed"],
        ],
      );
    },
  );
});

test("multi-level extends: every level contributes; the nearest declaration wins", () => {
  withFixture(
    {
      "src/m.ts": [
        "interface Root { root: string; shared: string }",
        "interface Mid extends Root { mid: number; shared: number }",
        "interface Leaf extends Mid { leaf: boolean }",
        "export interface CardProps extends Leaf { shared: boolean }",
        "",
      ].join("\n"),
    },
    (root) => {
      const table = tableFor(root, "src/m.ts", "Card");
      const byName = Object.fromEntries(table.props.map((p) => [p.name, p]));
      assert.deepEqual(Object.keys(byName).sort(), ["leaf", "mid", "root", "shared"]);
      assert.equal(byName.shared.type, "boolean", "own member wins over every base");
      assert.equal(byName.shared.from, undefined);
      assert.equal(byName.leaf.from, "Leaf");
      assert.equal(byName.mid.from, "Mid");
      assert.equal(byName.root.from, "Root");
      // Without the own member, Mid's `shared` (nearer) beats Root's.
      const mid = createTypeResolver(root).resolve(join(root, "src/m.ts"), "Leaf");
      assert.equal(mid.find((p) => p.name === "shared").type, "number");
    },
  );
});

test("cross-package: a workspace package's barrel, `export *` and `export type { … } from`", () => {
  withFixture(
    {
      "packages/core/package.json": JSON.stringify({
        name: "@elabs-ai/components-core",
        exports: { ".": "./src/index.ts" },
      }),
      "packages/core/src/index.ts": 'export * from "./mixins";\n',
      "packages/core/src/mixins/index.ts":
        'export type { A11yProps as ChartA11yProps } from "./a11y";\n',
      "packages/core/src/mixins/a11y.ts": [
        "export interface A11yProps {",
        "  /** Accessible name. */",
        "  accessibleLabel?: string;",
        "}",
        "",
      ].join("\n"),
      "packages/charts/package.json": JSON.stringify({ name: "@elabs-ai/components-charts" }),
      "packages/charts/src/gauge.tsx": [
        'import { type ChartA11yProps } from "@elabs-ai/components-core";',
        "export interface GaugeProps extends ChartA11yProps {",
        "  value: number;",
        "}",
        "",
      ].join("\n"),
    },
    (root) => {
      const table = tableFor(root, "packages/charts/src/gauge.tsx", "Gauge");
      const label = table.props.find((p) => p.name === "accessibleLabel");
      assert.ok(label, "the re-exported, renamed interface resolves");
      assert.equal(label.from, "A11yProps", "`from` names the declaring type");
      assert.equal(label.description, "Accessible name.");
    },
  );
});

test("never expanded: unions, external types, qualified names, component-value props", () => {
  withFixture(
    {
      "src/u.ts": [
        'import type { HTMLAttributes } from "react";',
        "interface A { a: string }",
        "interface B { b: string }",
        "export type Either = A | B;",
        "",
      ].join("\n"),
    },
    (root) => {
      assert.deepEqual(resolveIn(root, "src/u.ts", "Either"), {}, "a union is not a flat table");
      assert.deepEqual(resolveIn(root, "src/u.ts", "HTMLAttributes<HTMLDivElement>"), {});
      assert.deepEqual(resolveIn(root, "src/u.ts", "React.HTMLAttributes<HTMLDivElement>"), {});
      assert.deepEqual(resolveIn(root, "src/u.ts", "ComponentProps<typeof Button>"), {});
      assert.deepEqual(resolveIn(root, "src/u.ts", "Missing"), {});
    },
  );
});

test("a cycle between bases terminates; merged interface declarations all count", () => {
  withFixture(
    {
      "src/c.ts": [
        "interface Ping extends Pong { ping: string }",
        "interface Pong extends Ping { pong: string }",
        "interface Merged { first: string }",
        "interface Merged { second: string }",
        "",
      ].join("\n"),
    },
    (root) => {
      assert.deepEqual(resolveIn(root, "src/c.ts", "Ping"), { ping: "Ping", pong: "Pong" });
      assert.deepEqual(resolveIn(root, "src/c.ts", "Merged"), {
        first: "Merged",
        second: "Merged",
      });
    },
  );
});

test("a comment mentioning a type is not its declaration", () => {
  withFixture(
    {
      "src/k.ts": [
        "// interface Ghost { fake: string }",
        "/* type Ghost = { alsoFake: string } */",
        "export interface Ghost { real: string }",
        "",
      ].join("\n"),
    },
    (root) => {
      assert.deepEqual(resolveIn(root, "src/k.ts", "Ghost"), { real: "Ghost" });
    },
  );
});

test("forwardRef props: an inline literal with a callback member is one `extends` entry", () => {
  const src = [
    "export const SidebarProvider = React.forwardRef<",
    "  HTMLDivElement,",
    '  React.ComponentProps<"div"> & {',
    "    defaultOpen?: boolean;",
    "    onOpenChange?: (open: boolean) => void;",
    // A comma after the callback's `=>` — where the old split cut the literal in two.
    "    /** Controlled state, paired with `onOpenChange`. */",
    "    open?: boolean;",
    "  }",
    ">(function SidebarProvider(props, ref) { return null; });",
    "",
  ].join("\n");
  const table = extractPropTable(src, "SidebarProvider");
  assert.equal(table.extends.length, 2, JSON.stringify(table.extends));
  assert.match(table.extends[1], /open\?: boolean;\s*\}$/);
  const root = fixture({ "src/s.tsx": src });
  try {
    const expanded = createTypeResolver(root).expand(join(root, "src/s.tsx"), table);
    assert.deepEqual(
      expanded.props.map((p) => [p.name, p.from ?? null]),
      [
        ["defaultOpen", null],
        ["onOpenChange", null],
        ["open", null],
      ],
      "inline members are the component's own (no `from`)",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("joinDefinitions adds default, kind, group and deprecated from the snapshot", () => {
  const tables = {
    Chart: {
      extends: [],
      props: [
        { name: "size", optional: true, type: "number" },
        { name: "tone", optional: true, type: "string", defaultValue: '"from-source"' },
        { name: "old", optional: true, type: "number" },
        { name: "theme", optional: true, type: "string" },
        { name: "render", optional: true, type: "() => void" },
        { name: "untouched", optional: true, type: "string" },
      ],
    },
  };
  joinDefinitions(tables, {
    Chart: {
      fields: {
        size: { kind: "number", group: "layout", default: 12 },
        tone: { kind: "enum", group: null, default: "neutral" },
        old: {
          kind: "number",
          group: null,
          deprecated: { since: "5.0.0", replacement: "size", removeIn: "6.0.0" },
        },
        theme: { kind: "string", group: null, default: { defaultFrom: "context" } },
      },
      codeOnly: ["render"],
      codeOnlyDefaults: { render: null },
    },
    Missing: { fields: { x: { kind: "string" } } },
  });
  const p = Object.fromEntries(tables.Chart.props.map((x) => [x.name, x]));
  assert.equal(p.size.defaultValue, "12");
  assert.equal(p.size.kind, "number");
  assert.equal(p.size.group, "layout");
  assert.equal(p.tone.defaultValue, '"from-source"', "a source default is never overwritten");
  assert.equal(p.tone.group, undefined, "a null group is not recorded");
  assert.deepEqual(p.old.deprecated, { since: "5.0.0", replacement: "size", removeIn: "6.0.0" });
  assert.equal(p.theme.defaultValue, undefined, "a theme-context default has no literal");
  assert.equal(p.render.defaultValue, "null", "a codeOnly default");
  assert.deepEqual(p.untouched, { name: "untouched", optional: true, type: "string" });
  assert.equal(tables.Missing, undefined, "the join never adds a component or a prop");
  assert.equal(
    deprecationText(p.old.deprecated),
    "[deprecated since 5.0.0; use size; removed in 6.0.0]",
  );
});

test("real manifest: LineChart inherits its mixin props; defaults and deprecations are joined", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo — manifest generation unavailable");
  const rows = flat(generateManifest(repoRoot));
  const row = (name) => rows.find((r) => r.name === name);
  const line = row("LineChart");
  const prop = (r, n) => r.props.props.find((p) => p.name === n);
  // The members RM-146 never restated (review F10) — now documented through the resolver.
  for (const [name, from] of [
    ["window", "ChartNavigatorProps"],
    ["zoom", "ChartNavigatorProps"],
    ["minSpan", "ChartNavigatorProps"],
    ["selectionField", "ChartSelectionGestureProps"],
    ["selectionToolbar", "ChartSelectionGestureProps"],
    ["hoverCategory", "ChartHoverLinkProps"],
  ])
    assert.equal(prop(line, name)?.from, from, `LineChart.${name} inherited from ${from}`);
  assert.equal(prop(line, "animationDuration").defaultValue, "1100");
  assert.equal(prop(line, "animationDuration").kind, "number");
  assert.equal(prop(line, "window").group, "navigator");
  assert.deepEqual(prop(row("WaterfallChart"), "height").deprecated, {
    removeIn: "6.0.0",
    replacement: "plotHeight",
    since: "5.0.0",
  });
});

test("`brand-ui docs LineChart` prints defaults and the inherited props with their source", () => {
  const res = spawnSync(process.execPath, [bin, "docs", "LineChart"], {
    encoding: "utf8",
    cwd: repoRoot ?? here,
  });
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /^props \(own-declared\):$/m);
  assert.match(res.stdout, /^ {2}animationDuration\?: number {2}= 1100 {2}— /m);
  assert.match(res.stdout, /^props \(inherited\):$/m);
  assert.match(res.stdout, /^ {2}zoom\?: boolean {2}\(from ChartNavigatorProps\) {2}— /m);
});

test("`brand-ui docs WaterfallChart` marks the deprecated prop", () => {
  const res = spawnSync(process.execPath, [bin, "docs", "WaterfallChart"], {
    encoding: "utf8",
    cwd: repoRoot ?? here,
  });
  assert.equal(res.status, 0, res.stderr);
  assert.match(
    res.stdout,
    /^ {2}height\?: number {2}\[deprecated since 5\.0\.0; use plotHeight; removed in 6\.0\.0\]/m,
  );
});
