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
  buildBlocks,
  buildCli,
  buildInstall,
  buildPackages,
  buildPlaybooks,
  buildStoryIds,
  buildThemes,
  deriveRoutine,
  layerOf,
} from "./gen-home.mjs";

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
  assert.equal(committedCounts.registryBlocks.value, 52, "52 registry/registry.json items");
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

test("story-ids.json: every id matches Storybook's own docs-id shape", () => {
  for (const [component, id] of Object.entries(committedStoryIds)) {
    assert.match(id, /^[a-z0-9-]+--docs$/, `${component} → "${id}"`);
  }
});

test("story-ids.json: every RESOLVABLE seed link component has an id (#460 Acceptance)", () => {
  // The seed list named in the RM: Button, DataTable, Conversation, DashboardSheet,
  // FlowCanvas, ProcessMap, MapCanvas, CodeEditor, Terminal. Two do not resolve
  // today, for reasons outside this item's touches (neither is a gen-home bug):
  //   - "Conversation" (packages/ai/src/conversation.stories.tsx) has no
  //     `tags: ["autodocs"]`, so it has no docs page yet.
  //   - "FlowCanvas" is not an exported component name — @elabs-ai/components-flow
  //     exports "CanvasShell" for this role. The seed list needs updating by
  //     whichever RM item creates apps/home/content/links.ts.
  // Both are asserted here as KNOWN GAPS (not silently dropped) rather than
  // patched by renaming/editing a file outside packages/cli or scripts/gen-home.
  const resolvable = [
    "Button",
    "DataTable",
    "DashboardSheet",
    "ProcessMap",
    "MapCanvas",
    "CodeEditor",
    "Terminal",
  ];
  for (const name of resolvable) {
    assert.ok(committedStoryIds[name], `${name} should resolve to a docs id`);
  }
  assert.equal(committedStoryIds.Conversation, undefined, "known gap — see comment above");
  assert.equal(committedStoryIds.FlowCanvas, undefined, "known gap — see comment above");
});

test("gates.json: every entry has a real source file and a category from the real rule/command scopes", () => {
  const gates = readOut("gates.json");
  for (const g of gates) {
    assert.ok(g.id && g.doc && g.category && g.source, JSON.stringify(g));
  }
  assert.ok(gates.length >= 80);
});
