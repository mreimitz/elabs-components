/**
 * gen-home.test.mjs — self-test for the website content generator (RM-090, #460).
 * Run: `node --test scripts/gen-home.test.mjs` (in CI via `pnpm check:test`).
 *
 * Unit fixtures are INLINE (pure helpers: layer, engines, archetype, routine,
 * a golden-file build over a tiny fixture manifest/registry); the tail asserts
 * against the REAL repo, which is what actually fails when a package, theme,
 * block or gate is added without running `pnpm gen` — the whole point of this
 * item (2026-09-18 review: stale hand-typed counts on the front page).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  REPO_ROOT,
  OUT_DIR,
  bestArchetype,
  buildAgentLoopRecorded,
  buildBlocks,
  buildCli,
  buildCreateThemeSkill,
  buildInstall,
  buildPackages,
  buildPlaybooks,
  buildStoryIds,
  buildThemes,
  deriveRoutine,
  layerOf,
  parseSkillFrontmatter,
} from "./gen-home.mjs";
import { HOME_MCP_OPTIONS } from "../apps/home/lib/mcp-site-options.mjs";

const readOut = (name) => JSON.parse(readFileSync(join(OUT_DIR, name), "utf8"));

// ── layerOf ─────────────────────────────────────────────────────────────────

test("layerOf: tokens/icons are layer 0, ui is layer 1, a leaf is layer 2, process is layer 3", () => {
  const allowed = {
    "@elabs-ai/components-tokens": [],
    "@elabs-ai/components-icons": [],
    "@elabs-ai/components-ui": ["@elabs-ai/components-tokens", "@elabs-ai/components-icons"],
    "@elabs-ai/components-data": [
      "@elabs-ai/components-tokens",
      "@elabs-ai/components-icons",
      "@elabs-ai/components-ui",
    ],
    "@elabs-ai/components-process": [
      "@elabs-ai/components-tokens",
      "@elabs-ai/components-ui",
      "@elabs-ai/components-flow",
    ],
  };
  assert.equal(layerOf("@elabs-ai/components-tokens", allowed), 0);
  assert.equal(layerOf("@elabs-ai/components-icons", allowed), 0);
  assert.equal(layerOf("@elabs-ai/components-ui", allowed), 1);
  assert.equal(layerOf("@elabs-ai/components-data", allowed), 2);
  assert.equal(layerOf("@elabs-ai/components-process", allowed), 3);
});

test("layerOf: an unregistered package name is null, never guessed", () => {
  assert.equal(layerOf("@elabs-ai/components-nope", {}), null);
});

// ── bestArchetype ───────────────────────────────────────────────────────────

const PLAYBOOKS = [
  { archetype: "dashboard", packages: ["@elabs-ai/components-ui", "@elabs-ai/components-charts"] },
  { archetype: "data-app", packages: ["@elabs-ai/components-ui", "@elabs-ai/components-data"] },
];

test("bestArchetype: picks the playbook with the most shared @elabs-ai packages", () => {
  assert.equal(
    bestArchetype(
      ["@elabs-ai/components-ui", "@elabs-ai/components-data", "lucide-react"],
      PLAYBOOKS,
    ),
    "data-app",
  );
});

test("bestArchetype: a tie breaks alphabetically, for a stable result", () => {
  assert.equal(bestArchetype(["@elabs-ai/components-ui"], PLAYBOOKS), "dashboard");
});

test("bestArchetype: no shared @elabs-ai package is null, never invented", () => {
  assert.equal(bestArchetype(["lucide-react", "@visx/curve"], PLAYBOOKS), null);
});

// ── golden-file: a tiny fixture manifest + registry ─────────────────────────

const FIXTURE_MANIFEST = {
  packages: {
    "@elabs-ai/components-tokens": { path: "packages/tokens", components: [] },
    "@elabs-ai/components-ui": {
      path: "packages/ui",
      peerDependencies: { "@elabs-ai/components-tokens": "workspace:*" },
      components: [{ name: "Button" }, { name: "Card" }],
    },
  },
  playbooks: [
    {
      archetype: "data-app",
      intent: "Tool-first table surface",
      keywords: ["table"],
      packages: ["@elabs-ai/components-ui"],
      file: "docs/playbooks/data-app.md",
      template: "templates/data-app.tsx",
    },
  ],
};

const FIXTURE_REGISTRY = {
  homepage: "https://example.test/r",
  items: [
    {
      name: "data-table",
      title: "Data table",
      dependencies: ["@elabs-ai/components-ui"],
      categories: [],
    },
  ],
};

test("golden: buildPackages over a fixture manifest — deterministic shape, sorted by shortName", () => {
  assert.deepEqual(buildPackages(FIXTURE_MANIFEST), [
    {
      name: "@elabs-ai/components-tokens",
      shortName: "tokens",
      description: "Semantic CSS-variable themes + ThemeProvider/useTheme.",
      path: "packages/tokens",
      layer: 0,
      exportCount: 0,
      engines: [],
    },
    {
      name: "@elabs-ai/components-ui",
      shortName: "ui",
      description: "Foundation + app UI (Button, Card, Dialog, Tabs, AppShell, …).",
      path: "packages/ui",
      layer: 1,
      exportCount: 2,
      engines: [],
    },
  ]);
});

test("golden: buildBlocks over a fixture registry resolves the archetype from playbook overlap", () => {
  assert.deepEqual(buildBlocks(FIXTURE_REGISTRY, FIXTURE_MANIFEST), [
    {
      name: "data-table",
      title: "Data table",
      categories: [],
      dependencies: ["@elabs-ai/components-ui"],
      archetype: "data-app",
    },
  ]);
});

test("golden: buildPlaybooks sorts keywords/packages and the list itself", () => {
  assert.deepEqual(buildPlaybooks(FIXTURE_MANIFEST), [
    {
      archetype: "data-app",
      intent: "Tool-first table surface",
      keywords: ["table"],
      packages: ["@elabs-ai/components-ui"],
      file: "docs/playbooks/data-app.md",
      template: "templates/data-app.tsx",
    },
  ]);
});

test("golden: buildInstall composes one pnpm add per archetype from playbooks.packages", () => {
  const cli = buildCli({ ...FIXTURE_MANIFEST, cliVerbs: [] });
  const install = buildInstall(FIXTURE_MANIFEST, FIXTURE_REGISTRY, cli);
  assert.deepEqual(install.perArchetype, [
    { archetype: "data-app", command: "pnpm add @elabs-ai/components-ui" },
  ]);
  assert.equal(install.registryHomepage, "https://example.test/r");
});

// ── deriveRoutine ────────────────────────────────────────────────────────────

test("deriveRoutine: reduces the MCP info tool's numbered routine to a verb chain", () => {
  const manifest = JSON.parse(readFileSync(join(REPO_ROOT, "brand-ui.manifest.json"), "utf8"));
  assert.equal(deriveRoutine(manifest), "info → search → docs → build → audit");
});

// ── the real repo: the assertions that actually catch drift ────────────────

const manifest = JSON.parse(readFileSync(join(REPO_ROOT, "brand-ui.manifest.json"), "utf8"));
const registry = JSON.parse(readFileSync(join(REPO_ROOT, "registry/registry.json"), "utf8"));

const committedPackages = readOut("packages.json");
const committedCounts = readOut("counts.json");
const committedThemes = readOut("themes.json");
const committedBlocks = readOut("blocks.json");
const committedPlaybooks = readOut("playbooks.json");
const committedStoryIds = readOut("story-ids.json");
const committedCli = readOut("cli.json");

test("FRESH: every committed apps/home/content/generated/*.json equals what the source derives", () => {
  assert.deepEqual(buildPackages(manifest), committedPackages, "packages.json is stale");
  assert.deepEqual(buildBlocks(registry, manifest), committedBlocks, "blocks.json is stale");
  assert.deepEqual(buildPlaybooks(manifest), committedPlaybooks, "playbooks.json is stale");
  assert.deepEqual(buildThemes(), committedThemes, "themes.json is stale");
  assert.deepEqual(buildStoryIds(), committedStoryIds, "story-ids.json is stale");
});

test("counts.json agrees with the OTHER generated files' own lengths (Acceptance)", () => {
  assert.equal(committedCounts.packages.value, committedPackages.length);
  assert.equal(committedCounts.registryBlocks.value, committedBlocks.length);
  assert.equal(committedCounts.playbooks.value, committedPlaybooks.length);
  assert.equal(
    committedCounts.componentExports.value,
    committedPackages.reduce((n, p) => n + p.exportCount, 0),
  );
  assert.equal(
    committedCounts.themeFamilies.value,
    committedThemes.filter((f) => !f.isDefault).length,
  );
  assert.equal(committedCounts.hostedMcpTools.value, committedCli.hostedMcpTools.length);
});

test("live-repo counts (Acceptance, #460) — asserted, not typed, so a new package moves this", () => {
  assert.equal(committedCounts.packages.value, 13, "13 @elabs-ai/components-* packages");
  assert.equal(
    committedCounts.themeFamilies.value,
    8,
    "8 downloadable theme families under themes/ (+ the default family)",
  );
  assert.equal(committedCounts.registryBlocks.value, 166, "166 registry/registry.json items");
  assert.equal(committedCounts.playbooks.value, 7, "7 manifest playbooks");
  assert.equal(committedCounts.templates.value, 10, "10 manifest templates");
  assert.equal(committedCounts.skills.value, 11, "11 skills/ folders");
  // NOT pinned to the RM's "5 hosted tools": the a2ui tool landed the same day
  // (commit 3951d511) as this review, so the hosted set is 6 as of writing —
  // exactly the kind of drift this generator exists to track live rather than
  // freeze. Assert it is derived and non-empty, not a specific stale number.
  assert.ok(committedCounts.hostedMcpTools.value >= 5);
  assert.deepEqual(
    [...committedCli.hostedMcpTools].sort(),
    committedCli.hostedMcpTools,
    "hostedMcpTools is sorted",
  );
});

// ── themes.json: chart1 alongside primary (RM-103 W5-B, #586) ─────────────
// `background` alone is deliberately near-white/near-black in every family, so the swatch
// card needs a second, more saturated colour to tell the nine families apart at a glance.

test("themes.json: every mode resolves chart1, not just primary/background (#586)", () => {
  for (const family of committedThemes) {
    for (const mode of family.modes) {
      assert.match(
        mode.chart1 ?? "",
        /^oklch\(/,
        `${family.slug} ${mode.mode} chart1 should resolve to a literal oklch()`,
      );
    }
  }
});

test("themes.json: chart1 is the family's OWN --chart-1, not always a copy of primary (#586)", () => {
  const claude = committedThemes.find((f) => f.slug === "claude");
  const claudeLight = claude.modes.find((m) => m.mode === "light");
  assert.notEqual(
    claudeLight.chart1,
    claudeLight.primary,
    "claude-light defines its own --chart-1, distinct from --primary",
  );

  const dflt = committedThemes.find((f) => f.slug === "default");
  for (const mode of dflt.modes) {
    assert.equal(
      mode.chart1,
      mode.primary,
      "the default theme's --chart-1: var(--primary) precedent still resolves equal",
    );
  }
});

test("story-ids.json: every id matches Storybook's own docs-id shape", () => {
  for (const [component, id] of Object.entries(committedStoryIds)) {
    assert.match(id, /^[a-z0-9-]+--docs$/, `${component} → "${id}"`);
  }
});

test("story-ids.json: every seed link component has an id (#460 Acceptance)", () => {
  // The seed list named in the RM, with the orchestrator's two rulings applied
  // (RM-089-decisions.md): "FlowCanvas" (not a real export) is seeded as
  // "CanvasShell" (the real @elabs-ai/components-flow export for that role), and
  // packages/ai/src/conversation.stories.tsx now carries `tags: ["autodocs"]` so
  // "Conversation" gets a docs page.
  const seeds = [
    "Button",
    "DataTable",
    "Conversation",
    "DashboardSheet",
    "CanvasShell",
    "ProcessMap",
    "MapCanvas",
    "CodeEditor",
    "Terminal",
  ];
  for (const name of seeds) {
    assert.ok(committedStoryIds[name], `${name} should resolve to a docs id`);
  }
});

test("gates.json: every entry has a real source file and a category from the real rule/command scopes", () => {
  const gates = readOut("gates.json");
  for (const g of gates) {
    assert.ok(g.id && g.doc && g.category && g.source, JSON.stringify(g));
  }
  assert.ok(gates.length >= 80);
});

// ── agent-loop-recorded.json vs the live /mcp route (RM-100 wave-3 ruling 8, W3-M1) ────────────

test("buildAgentLoopRecorded uses the SAME options object apps/home/app/mcp/route.ts passes to createMcpHttpHandler", () => {
  // apps/home/app/mcp/route.ts is a Next route (JSON import, "use node" runtime) this plain
  // node:test file cannot import directly, so this reads its source text and asserts it wires
  // the ONE shared HOME_MCP_OPTIONS object in — if the route ever grows a second, hand-typed
  // `{ hosted, siteRoutes }` literal instead, this fails and names the file to fix, rather than
  // letting the recorded fallback silently disagree with what the live route answers.
  const routeSrc = readFileSync(join(REPO_ROOT, "apps/home/app/mcp/route.ts"), "utf8");
  assert.match(
    routeSrc,
    /import\s*\{\s*HOME_MCP_OPTIONS\s*\}\s*from\s*["']\.\.\/\.\.\/lib\/mcp-site-options\.mjs["']/,
    "apps/home/app/mcp/route.ts must import HOME_MCP_OPTIONS from apps/home/lib/mcp-site-options.mjs",
  );
  assert.match(
    routeSrc,
    /createMcpHttpHandler\(\{\s*manifest\s*,\s*\.\.\.HOME_MCP_OPTIONS\s*\}\)/,
    "apps/home/app/mcp/route.ts must spread ...HOME_MCP_OPTIONS into createMcpHttpHandler, not a hand-typed options literal",
  );
  assert.deepEqual(
    HOME_MCP_OPTIONS,
    { hosted: true, siteRoutes: true },
    "HOME_MCP_OPTIONS must keep siteRoutes: true — the site's /storybook/ and /r routes are real (wave-3 ruling 18)",
  );
});

test("agent-loop-recorded.json: every recorded answer uses this site's /storybook/ links, never the DEFAULT emitters' bare /?path= form", () => {
  const recorded = buildAgentLoopRecorded(manifest);
  const text = JSON.stringify(recorded);
  const storybookLinks = text.match(/elabs-ai\.com\/storybook\//g) ?? [];
  const bareStoryLinks = text.match(/elabs-ai\.com\/\?path=/g) ?? [];
  assert.ok(
    storybookLinks.length > 0,
    "expected at least one https://elabs-ai.com/storybook/ link once siteRoutes: true is threaded through",
  );
  assert.equal(
    bareStoryLinks.length,
    0,
    "the recorded fallback must not contain the default https://elabs-ai.com/?path= form — that means it was built without siteRoutes: true",
  );
  assert.deepEqual(
    recorded,
    readOut("agent-loop-recorded.json"),
    "apps/home/content/generated/agent-loop-recorded.json is stale — run `pnpm gen`",
  );
});

// ── create-theme.json (RM-103, wave-4 ruling 23: no invented "create-theme" CLI verb) ─────────

test("parseSkillFrontmatter: reads name/description/argument-hint, strips quotes", () => {
  const text = [
    "---",
    "name: brand-ui-create-theme",
    'argument-hint: "<theme name> [links, file paths, brief]"',
    'description: some text ending in "/create-theme".',
    "---",
    "# body",
  ].join("\n");
  assert.deepEqual(parseSkillFrontmatter(text), {
    name: "brand-ui-create-theme",
    "argument-hint": "<theme name> [links, file paths, brief]",
    description: 'some text ending in "/create-theme".',
  });
});

test("parseSkillFrontmatter: no frontmatter block is an empty object, never a throw", () => {
  assert.deepEqual(parseSkillFrontmatter("# just a heading\n"), {});
});

test("buildCreateThemeSkill: derives the plugin skill's own slash form from SKILL.md, never the in-repo maintainer shortcut", () => {
  const derived = buildCreateThemeSkill();
  assert.equal(derived.skill, "brand-ui-create-theme");
  // A site visitor installs the plugin and invokes its skill by name — the same way the docs
  // give `/brand-ui-start`/`/brand-ui-new-app` — never `/create-theme`, the maintainer-only
  // shortcut that exists solely inside this repo (`.claude/commands/create-theme.md`).
  assert.equal(derived.slashCommand, "/brand-ui-create-theme");
  assert.notEqual(derived.slashCommand, "/create-theme");
  assert.ok(
    derived.argumentHint.length > 0,
    "argumentHint should come from the skill's own frontmatter",
  );
  assert.equal(derived.invocation, `${derived.slashCommand} ${derived.argumentHint}`);

  const skillMd = readFileSync(join(REPO_ROOT, "skills/brand-ui-create-theme/SKILL.md"), "utf8");
  const fm = parseSkillFrontmatter(skillMd);
  assert.equal(fm.name, derived.skill, "derived skill name must match SKILL.md's own frontmatter");
  assert.equal(
    fm["argument-hint"],
    derived.argumentHint,
    "derived argument hint must match SKILL.md's own frontmatter",
  );
});

test("buildCreateThemeSkill: there is still no create-theme CLI verb to derive this from instead", () => {
  const manifest = JSON.parse(readFileSync(join(REPO_ROOT, "brand-ui.manifest.json"), "utf8"));
  const cli = buildCli(manifest);
  const verbs = Object.values(cli.verbGroups)
    .flat()
    .map((v) => v.verb);
  assert.ok(
    !verbs.includes("create-theme"),
    "a real create-theme CLI verb appeared — buildCreateThemeSkill should derive from cli.json instead of the skill",
  );
});

test("FRESH: apps/home/content/generated/create-theme.json equals what the skill's SKILL.md derives", () => {
  assert.deepEqual(
    buildCreateThemeSkill(),
    readOut("create-theme.json"),
    "apps/home/content/generated/create-theme.json is stale — run `pnpm gen`",
  );
});

test("catalog-index.json: a ui component Storybook files under AI/ sits in a ui family on the website", () => {
  // Storybook groups by concern (`AI/ChangeReview` ships in `ui`); the website lists per package,
  // where that would read as a one-item "AI" family inside Ui (scripts/lib/home-component-groups.json).
  const index = JSON.parse(
    readFileSync(join(REPO_ROOT, "apps/home/content/generated/catalog-index.json"), "utf8"),
  );
  const entries = Array.isArray(index) ? index : (index.items ?? index.pages ?? []);
  const review = entries.find((entry) => entry.name === "ChangeReview");
  assert.equal(review?.package, "ui");
  assert.equal(review?.group, "Data");
  assert.equal(
    entries.some((entry) => entry.package === "ui" && entry.group === "AI"),
    false,
  );
});

// ── The 2026-09 catalogue reorganisation (scripts/lib/home-catalog-layout.json) ────────────────
const readGenerated = (name) =>
  JSON.parse(readFileSync(join(REPO_ROOT, "apps/home/content/generated", name), "utf8"));

test("catalog-index.json: chart types are components; Explore holds use cases only", () => {
  const index = readGenerated("catalog-index.json");
  assert.deepEqual([...new Set(index.map((e) => e.section))].sort(), [
    "blocks",
    "components",
    "templates",
    "visualizations",
  ]);
  const bar = index.find((e) => e.component === "BarChart");
  assert.equal(bar?.section, "components");
  assert.equal(bar?.package, "charts");
  assert.equal(bar?.group, "Comparison");
  // The data-viz families left Blocks for Visualizations, and nothing is listed twice.
  const vizFamilies = ["KPI Cards", "Stat Cards", "Infographics", "Editorial Charts"];
  for (const family of vizFamilies) {
    assert.ok(
      index.some((e) => e.section === "visualizations" && e.group === family),
      family,
    );
    assert.equal(
      index.some((e) => e.section === "blocks" && e.group === family),
      false,
      `${family} is still listed under blocks`,
    );
  }
  // The `patterns` pseudo-package is dissolved: a component page always names a real package.
  assert.equal(
    index.some((e) => e.section === "components" && e.package === "patterns"),
    false,
  );
});

test("catalog-index.json: every branch leads with a bounded set of highlights", () => {
  const index = readGenerated("catalog-index.json");
  const branches = new Map();
  for (const e of index) {
    const key = e.section === "components" ? `components/${e.package}` : e.section;
    branches.set(key, [...(branches.get(key) ?? []), e]);
  }
  for (const [branch, entries] of branches) {
    const ranks = entries.map((e) => e.featured).filter((rank) => rank > 0);
    assert.ok(ranks.length > 0, `${branch} has no highlights`);
    // A front page draws its highlights as live thumbnails: a dozen at most.
    assert.ok(ranks.length <= 12, `${branch} features ${ranks.length} pages`);
    assert.equal(new Set(ranks).size, ranks.length, `${branch} repeats a featured rank`);
  }
});

test("catalog-redirects.json: every moved page redirects to a live page, and hides none", () => {
  const index = readGenerated("catalog-index.json");
  const redirects = readGenerated("catalog-redirects.json");
  const live = new Set(
    index.map((e) => `/${e.section}${e.section === "components" ? `/${e.package}` : ""}/${e.slug}`),
  );
  assert.ok(redirects.length > 100);
  assert.equal(new Set(redirects.map((r) => r.source)).size, redirects.length);
  for (const { source, destination } of redirects) {
    assert.equal(live.has(source), false, `${source} is a live page`);
    if (destination !== "/components" && destination !== "/components/charts")
      assert.ok(live.has(destination), `${source} → ${destination} goes nowhere`);
  }
  const bySource = Object.fromEntries(redirects.map((r) => [r.source, r.destination]));
  assert.equal(bySource["/charts/barchart"], "/components/charts/barchart");
  assert.equal(bySource["/blocks/kpi-cards-pace"], "/visualizations/kpi-cards-pace");
});
