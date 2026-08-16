/**
 * build-surface-preview.test.mjs — self-test for the rung-2 surface preview
 * generator (VP-04 #57, issue-03), matching the self-tested-gate convention.
 *
 * The properties that make a preview usable are exactly the ones a person cannot
 * eyeball: that it opens with no network, that its colour comes only from the
 * inlined token stylesheet, and that the theme actually reaches the document. So
 * they are asserted, for every archetype × theme pair, not spot-checked.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildPreview,
  listArchetypes,
  listThemes,
  readComposition,
  roleFor,
  inlineStylesheet,
  THEMES_CSS,
  TOKENS_BEGIN,
  TOKENS_END,
  inlineTokensCss,
} from "./build-surface-preview.mjs";
import { ACTIVE_THEMES } from "./lib/active-themes.mjs";
import { ARCHETYPES } from "../packages/cli/lib/engine.mjs";

/** The document with the inlined token stylesheet removed. */
function outsideTokens(html) {
  const start = html.indexOf(TOKENS_BEGIN);
  const end = html.indexOf(TOKENS_END);
  assert.ok(start >= 0 && end > start, "the inlined stylesheet is fenced by its markers");
  return html.slice(0, start) + html.slice(end + TOKENS_END.length);
}

test("every archetype × theme pair builds a self-contained, themed preview", () => {
  const dir = mkdtempSync(join(tmpdir(), "brand-ui-preview-"));
  const themes = listThemes();
  // Anti-vacuity, not a count: the shipped theme set moves (ADR 0029 makes the
  // set a REGISTRY rather than a fixed list), so a
  // hard-coded count was red at HEAD and would go red again on every change. What
  // must hold is that `listThemes()` resolved SOMETHING — an empty list would
  // skip the whole matrix below and pass vacuously.
  assert.ok(themes.length > 0, "listThemes() resolved at least one shipped theme");
  assert.deepEqual([...themes].sort(), [...ACTIVE_THEMES].sort(), "matches the active theme set");
  try {
    for (const archetype of ARCHETYPES) {
      for (const theme of themes) {
        const out = join(dir, `${archetype}.${theme}.html`);
        const { file, regions } = buildPreview({ archetype, theme, out });
        assert.equal(file, out);
        assert.ok(statSync(file).size > 1000, `${archetype}/${theme}: a real document`);
        assert.ok(regions > 0, `${archetype}/${theme}: at least one composed region`);

        const html = readFileSync(file, "utf8");
        assert.ok(html.startsWith("<!doctype html>"), "a complete document");
        assert.ok(html.includes(`data-theme="${theme}"`), "the theme reaches the root element");

        // Self-contained: no asset is fetched from anywhere.
        assert.equal(
          /url\(\s*["']?https?:/i.test(html),
          false,
          `${archetype}/${theme}: no remote url() asset`,
        );
        assert.equal(
          /(?:src|href)\s*=\s*["']?https?:/i.test(html),
          false,
          `${archetype}/${theme}: no remote src/href`,
        );
        assert.equal(/@import/.test(outsideTokens(html)), false, "no @import outside the tokens");

        // Colour comes from the tokens and nowhere else.
        const stray = outsideTokens(html).match(/#[0-9a-fA-F]{6}\b/g);
        assert.equal(stray, null, `${archetype}/${theme}: no colour literal outside the tokens`);
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("output is deterministic, and each theme produces a different document", () => {
  const dir = mkdtempSync(join(tmpdir(), "brand-ui-preview-"));
  try {
    const read = (theme, n) => {
      const out = join(dir, `${theme}.${n}.html`);
      buildPreview({ archetype: "dashboard", theme, out });
      return readFileSync(out, "utf8");
    };
    assert.equal(read("light", 1), read("light", 2), "same inputs → same bytes");
    assert.notEqual(read("light", 1), read("dark", 1), "the theme changes the document");
    for (const theme of ACTIVE_THEMES.filter((t) => t !== "light")) {
      assert.notEqual(read("light", 3), read(theme, 1), "…for every theme");
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an unknown archetype fails loudly and lists the real ones", () => {
  const dir = mkdtempSync(join(tmpdir(), "brand-ui-preview-"));
  try {
    assert.throws(
      () =>
        buildPreview({
          archetype: "not-an-archetype",
          theme: "light",
          out: join(dir, "x.html"),
        }),
      /unknown archetype/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("every shipped archetype has a generated template on disk", () => {
  const available = listArchetypes();
  for (const a of ARCHETYPES) assert.ok(available.includes(a), `${a} has a template`);
});

test("inlineStylesheet flattens relative imports and drops what cannot resolve offline", () => {
  const css = inlineTokensCss();
  assert.ok(css.length > 10_000, "the token sheet is inlined");
  assert.equal(/@import/.test(css), false, "every @import is resolved or dropped");
  assert.equal(
    /@font-face\s*\{/.test(css),
    false,
    "font faces are dropped (their urls are relative)",
  );
  assert.ok(css.includes('[data-theme="light"]'), "the theme blocks survive");
  assert.ok(css.includes("--background:"), "the semantic tokens survive");
});

test("readComposition reads a template as a composition manifest, not as code", () => {
  const source = `/**
 * Demo template — a made-up composition.
 */
import { Card, CardHeader, Sidebar, SidebarMenuItem } from "@elabs-ai/components-ui";
import { MetricGrid } from "@elabs-ai/components-charts";

const nav = [
  { id: "a", label: "Overview" },
  { id: "b", label: "Detail" },
];

const metrics = [{ label: "Revenue" }, { label: "Users" }];

export function Demo() {
  return (
    <Sidebar>
      <SidebarMenuItem />
      <MetricGrid>
        <Card>
          <CardHeader />
        </Card>
      </MetricGrid>
    </Sidebar>
  );
}
`;
  const c = readComposition(source);
  assert.equal(c.title, "Demo template");
  assert.deepEqual(c.nav, ["Overview", "Detail"], "nav labels only — not the metric labels");
  assert.deepEqual(
    c.regions.map((r) => r.name),
    ["MetricGrid", "Card"],
    "sidebar chrome and sub-parts are not composed regions",
  );
  assert.equal(c.regions[0].pkg, "@elabs-ai/components-charts");
  assert.deepEqual(c.packages.sort(), ["@elabs-ai/components-charts", "@elabs-ai/components-ui"]);
});

test("roleFor sizes a region by what it is", () => {
  assert.equal(roleFor("Hero").role, "section");
  assert.equal(roleFor("MetricGrid").role, "chart", "a metric grid is a chart, not a data table");
  assert.equal(roleFor("DataTable").role, "data");
  assert.equal(roleFor("Conversation").role, "chat");
  assert.equal(roleFor("CanvasShell").role, "canvas");
  assert.equal(roleFor("SomethingElse").role, "block", "an unknown name still gets a block");
  for (const name of ["Hero", "DataTable", "Card", "Whatever"]) {
    const r = roleFor(name);
    assert.ok(r.span >= 1 && r.span <= 12, `${name}: a valid grid span`);
    assert.ok(r.height > 0, `${name}: a reserved height`);
  }
});
