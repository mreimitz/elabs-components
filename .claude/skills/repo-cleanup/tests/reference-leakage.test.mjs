import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PRODUCTS,
  classifyContext,
  classifyZone,
  severityFor,
  specifierSpans,
} from "../scripts/reference-leakage.mjs";

/** Every case below is a bug this analyzer actually had, kept so it stays fixed. */

const hit = (id, line) => {
  const p = PRODUCTS.find((x) => x.id === id);
  p.re.lastIndex = 0;
  const m = [...line.matchAll(p.re)];
  return m.length ? (m[0].index ?? 0) : -1;
};
const matches = (id, line) => hit(id, line) !== -1;

// --------------------------------------------------------------------------
// zones
// --------------------------------------------------------------------------

test("zone order: a README inside the planning record stays internal", () => {
  // The generic README rule used to claim this one and rank it as shipped.
  assert.equal(classifyZone("roadmap/README.md"), "internal");
  assert.equal(classifyZone("docs/review/datawrapper/README.md"), "internal");
  assert.equal(classifyZone("README.md"), "shipped");
});

test("everything under packages/ ships, not only src/", () => {
  // The first cut matched `packages/*/src/` and missed the CLI and the schemas.
  assert.equal(classifyZone("packages/charts/src/a.tsx"), "shipped");
  assert.equal(classifyZone("packages/cli/lib/engine.mjs"), "shipped");
  assert.equal(classifyZone("packages/charts/schemas/x.schema.json"), "shipped");
});

test("the plugin's own skills ship; the repo's .claude directory does not", () => {
  assert.equal(classifyZone("skills/brand-ui-enterprise/reference/principles.md"), "shipped");
  assert.equal(classifyZone(".claude/rules/charts.md"), "internal");
});

test("a changeset is shipped — it becomes the published changelog", () => {
  assert.equal(classifyZone(".changeset/rm-112-line-area-richness.md"), "shipped");
});

test("attribution and theme surfaces are the two allowed homes", () => {
  for (const p of [
    "themes/qlik/theme.ts",
    "packages/tokens/src/themes.css",
    "scripts/attributions.sources.json",
    "apps/home/app/attributions/page.tsx",
    "apps/docs/.storybook/community-themes.generated.css",
  ]) {
    assert.equal(classifyZone(p), "allowed", p);
  }
});

test("the tooling that spells the names out is exempt from itself", () => {
  assert.equal(
    classifyZone(".claude/skills/repo-cleanup/scripts/reference-leakage.mjs"),
    "self-exempt",
  );
  assert.equal(classifyZone("scripts/check/rules/reference-leakage.mjs"), "self-exempt");
});

test("severity follows the zone, and review tier never outranks informational", () => {
  assert.equal(severityFor("shipped", "deny"), "high");
  assert.equal(severityFor("published-doc", "deny"), "medium");
  assert.equal(severityFor("internal", "deny"), "low");
  assert.equal(severityFor("shipped", "review"), "informational");
});

// --------------------------------------------------------------------------
// the list
// --------------------------------------------------------------------------

test("names measured as pure false positives are NOT on the list", () => {
  // 444 hits on `Linear` in this repo, every one of them the linear scale.
  for (const id of ["linear", "sigma", "observable", "heap", "graphite", "vercel", "radix"]) {
    assert.equal(
      PRODUCTS.some((p) => p.id === id),
      false,
      `${id} must stay off the list`,
    );
  }
});

test("bootstrap matches the framework, not the verb", () => {
  assert.equal(matches("bootstrap", "a `message` bootstrap that runs it inside a worker"), false);
  assert.equal(matches("bootstrap", "Ported the Bootstrap grid"), true);
});

test("a deny-listed name matches in prose", () => {
  assert.equal(matches("datawrapper", "Datawrapper's own guidance is to avoid it"), true);
  assert.equal(matches("qlik", "Reach Qlik Sense parity"), true);
  assert.equal(matches("power-bi", "Power BI uses a free canvas"), true);
});

// --------------------------------------------------------------------------
// context classification — position, not line
// --------------------------------------------------------------------------

test("a specifier span is recognised, and a cited path is not the same thing", () => {
  const spans = specifierSpans('import x from "@mui/material"; see `docs/review/a-datawrapper.md`');
  assert.equal(
    spans.some((s) => s.kind === "package-specifier"),
    true,
  );
  assert.equal(
    spans.some((s) => s.kind === "path-citation"),
    true,
  );
});

test("a path citation elsewhere on the line does NOT demote a real leak", () => {
  // The regression: line-level matching read this whole sentence as a package
  // specifier and dropped the genuine parity claim to informational.
  const line =
    "`ChartTooltip` gains three presets (Datawrapper tooltip parity, `docs/review/gap.md` §3.5)";
  const ctx = classifyContext(line, ".changeset/x.md", hit("datawrapper", line));
  assert.notEqual(ctx, "package-specifier");
  assert.equal(ctx, "planning-reference");
});

test("a name inside a package specifier IS load-bearing", () => {
  const line = 'const MAP = [["@chakra-ui/react", "chakra"], ["@mantine/core", "mantine"]];';
  assert.equal(
    classifyContext(line, "packages/cli/lib/engine.mjs", hit("chakra", line)),
    "package-specifier",
  );
  assert.equal(
    classifyContext(line, "packages/cli/lib/engine.mjs", hit("mantine", line)),
    "package-specifier",
  );
});

test("a competitor's own version migration is never exempted as load-bearing", () => {
  // `migration` alone used to be enough, which exempted the exact sentence the
  // rule exists to catch. What matters is that it stays actionable — whether it
  // also earns a label is cosmetic.
  const line = "Borrow: a serializable spec (Grafana's v1 → v2 migration is the cautionary tale)";
  const ctx = classifyContext(line, "docs/review/x.md", hit("grafana", line));
  assert.notEqual(ctx, "migration-source");
  assert.notEqual(ctx, "package-specifier");
});

test("a file named for migration is a migration source", () => {
  const line = "convert Chakra components";
  assert.equal(
    classifyContext(line, "packages/cli/lib/migrate.mjs", hit("chakra", line)),
    "migration-source",
  );
});

test("demo data and interop claims get their own labels", () => {
  const demo = '    source: "Shopify",';
  assert.equal(
    classifyContext(demo, "registry/blocks/x/data.ts", hit("shopify", demo)),
    "demo-data",
  );
  const interop = "React, React Flow, Radix and Recharts all depend on it";
  assert.equal(classifyContext(interop, "docs/CSP.md", hit("recharts", interop)), "interop-claim");
});

test("an ordinary leak is left unclassified rather than explained away", () => {
  const line = "Footer links, always drawn in Datawrapper order.";
  assert.equal(classifyContext(line, ".changeset/x.md", hit("datawrapper", line)), "unclassified");
});
