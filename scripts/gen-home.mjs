#!/usr/bin/env node
/**
 * gen-home.mjs — the elabs-ai.com website's content, DERIVED (RM-090, #460).
 *
 * The 2026-09-18 homepage-concept review found stale, hand-typed numbers on the
 * front page ("Twelve packages", "three themes", "Themes (2)"). The rule this
 * step exists to enforce (`.claude/rules/home.md` "Generated, not typed"): any
 * count, list of packages/themes/gates/verbs/blocks, or install command the site
 * shows comes from `apps/home/content/generated/*.json`, never typed by hand.
 * `apps/home/lib/content.ts` is the only door site code has onto this data.
 *
 * Writes nine files under `apps/home/content/generated/`:
 *   packages.json, counts.json, themes.json, gates.json, cli.json, blocks.json,
 *   playbooks.json, story-ids.json, install.json
 * …plus `agent-loop-recorded.json` (RM-099): the hosted MCP's answers to every call in the
 * hand-authored `apps/home/content/agent-loop.json`, the agent loop's offline fallback.
 * …plus `emit-ui-examples.json` (RM-101): the A2UI / DashboardSpec editors' example menus,
 * from the CLI's `a2ui example`, the dashboard golden `minimal.json` and `content/examples/`.
 * …plus one static asset outside that directory (RM-093): `apps/home/public/.well-known/
 * mcp.json`, MCP discovery metadata — served byte-for-byte, so it cannot go through
 * `apps/home/lib/content.ts` the way the nine files above do.
 *
 * Every builder below is a PURE function over already-loaded repo data (the
 * manifest, the registry, the check-rule registry, the theme families) so
 * `gen-home.test.mjs` can assert each one against a fixture AND against the
 * live repo. Deterministic: sorted keys, no timestamp, no environment reads.
 *
 * Usage:
 *   node scripts/gen-home.mjs           write every file
 *   node scripts/gen-home.mjs --check   fail (exit 1) if any file is stale
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { ALLOWED } from "./check/rules/dep-direction.mjs";
import { loadRules } from "./check/registry.mjs";
import { COMMANDS } from "./check/commands.mjs";
import {
  auditFamily,
  declarations,
  listFamilies,
  readRootDeclarations,
  readTokenNames,
  resolveColor,
  themeBlocks,
} from "./lib/community-themes.mjs";
import { indexStoryDocsPages } from "../packages/cli/lib/story-ids.mjs";
import { handleMessage, LOCAL_ONLY_TOOLS, SERVER_INFO, TOOLS } from "../packages/cli/lib/mcp.mjs";
import { HOSTED_MCP_URL } from "../packages/cli/lib/render-docs.mjs";
// RM-101
import { A2UI_EXAMPLE, validateSurface } from "../packages/cli/lib/a2ui.mjs";
import { validateSpec } from "../packages/cli/lib/dashboard-spec.mjs";

export const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
export const OUT_DIR = join(REPO_ROOT, "apps/home/content/generated");
// RM-093 — MCP discovery (2026-09-17 review §4.2 (6), §6 B4): a public well-known file, so an
// agent finds the hosted server without already knowing `llms.txt` exists. Lives under
// `apps/home/public/` (a static asset, not `content/generated/`) because it must be served
// byte-for-byte at `/.well-known/mcp.json`, not read through `apps/home/lib/content.ts`.
export const WELL_KNOWN_MCP_PATH = join(REPO_ROOT, "apps/home/public/.well-known/mcp.json");

const read = (rel) => readFileSync(join(REPO_ROOT, rel), "utf8");
const json = (rel) => JSON.parse(read(rel));

// ─────────────────────────── package.json blurbs (authored) ──────────────────
/**
 * `package.json` carries no `description` field for any `@elabs-ai/components-*`
 * package (checked 2026-09-18) and adding one is a `packages/<pkg>/package.json`
 * edit — outside this item's write set (RM-090 touches only `scripts/gen.mjs`,
 * `scripts/gen-home*.mjs`, `apps/home/content/generated/*`, `apps/home/lib/
 * content.ts`). So the one-line "what it gives you" is authored HERE — trimmed
 * from CLAUDE.md's already-reviewed `## Packages` bullet list, kept in sync by
 * hand until a follow-up item moves it into each package's own manifest, the
 * way `registry/registry.items.json` authors title/description for a block
 * while deriving everything else (files, dependencies) from source.
 */
const PACKAGE_BLURBS = {
  "@elabs-ai/components-tokens": "Semantic CSS-variable themes + ThemeProvider/useTheme.",
  "@elabs-ai/components-ui": "Foundation + app UI (Button, Card, Dialog, Tabs, AppShell, …).",
  "@elabs-ai/components-icons":
    "Brand/product-vocabulary icons + BrandLogo; generic glyphs come from Lucide.",
  "@elabs-ai/components-data":
    "TanStack DataTable, FilterBar, SearchInput, FacetFilter, ColumnPicker.",
  "@elabs-ai/components-ai":
    "Chat: ChatShell, Conversation, Message, PromptInput, Tool, Reasoning, Sources, CodeBlock, Artifact.",
  "@elabs-ai/components-flow": "Branded React Flow canvas, nodes, edges, controls, inspector.",
  "@elabs-ai/components-maps":
    "Token-driven MapLibre GL maps: MapCanvas, MapMarker, MapPopup, MapControls, MapRoute, MapArc, MapGeoJSON, MapClusterLayer.",
  "@elabs-ai/components-charts":
    "MetricCard, MetricGrid, ChartCard, ChartFrame, AutoChart (spec-driven via a serializable ChartSpec).",
  "@elabs-ai/components-marketing":
    "Hero, FeatureGrid, UseCaseCard, StatsBand, CTASection, LogoStrip.",
  "@elabs-ai/components-editor":
    "Token-themed Monaco editor: CodeEditor, DiffEditor, CodeWorkspace (file tabs).",
  "@elabs-ai/components-viewer":
    "FileViewer: a file the app did not write, via a pluggable adapter registry.",
  "@elabs-ai/components-terminal":
    "Terminal surfaces (shell/agent output, coding-agent CLI look-alikes).",
  "@elabs-ai/components-process": "Process mining / event-log analysis.",
};

/** Heavy third-party engines worth flagging per package, keyed by peer specifier prefix. */
const ENGINE_LABELS = [
  ["monaco-editor", "Monaco"],
  ["maplibre-gl", "MapLibre"],
  ["@xyflow/react", "React Flow"],
  ["@milkdown/", "Milkdown"],
  ["@visx/", "visx"],
];

function enginesFor(peerDependencies = {}) {
  const peers = Object.keys(peerDependencies);
  const found = new Set();
  for (const peer of peers) {
    for (const [prefix, label] of ENGINE_LABELS) {
      if (peer === prefix || peer.startsWith(prefix)) found.add(label);
    }
  }
  return [...found].sort();
}

/** Layer 0 (foundation) … 3 (the one composite), from the dep-direction rule's own map. */
export function layerOf(name, allowed = ALLOWED) {
  if (!(name in allowed)) return null;
  if (allowed[name].length === 0) return 0;
  if (name === "@elabs-ai/components-ui") return 1;
  if (
    allowed[name].some((t) => t.endsWith("-flow") || t.endsWith("-charts") || t.endsWith("-data"))
  )
    return 3;
  return 2;
}

// ────────────────────────────────── packages.json ────────────────────────────

export function buildPackages(manifest) {
  return Object.entries(manifest.packages)
    .map(([name, info]) => {
      const shortName = name.replace("@elabs-ai/components-", "");
      const exportCount =
        info.components.length +
        Object.values(info.subpaths ?? {}).reduce((n, s) => n + (s.components?.length ?? 0), 0);
      return {
        name,
        shortName,
        description: PACKAGE_BLURBS[name] ?? "",
        path: info.path,
        layer: layerOf(name),
        exportCount,
        engines: enginesFor(info.peerDependencies),
      };
    })
    .sort((a, b) => a.shortName.localeCompare(b.shortName));
}

// ────────────────────────────────── themes.json ───────────────────────────────

/** `{primary, background}` resolved to their literal oklch() value, or null. */
function swatchesFor(cssPath, root) {
  const blocks = themeBlocks(readFileSync(cssPath, "utf8"));
  const decls = declarations(blocks[0]?.body ?? "");
  return {
    primary: resolveColor("--primary", decls, root),
    background: resolveColor("--background", decls, root),
  };
}

export function buildThemes({ repoRoot = REPO_ROOT } = {}) {
  const root = readRootDeclarations(join(repoRoot, "packages/tokens/src/themes.css"));
  const families = [];

  // The two reference themes (`BUILT_IN_THEME_DEFINITIONS`, family: "default") ship from
  // packages/tokens directly, not from themes/ — same shape, different source files.
  const builtIns = [
    { mode: "light", value: "light", label: "Light", css: "packages/tokens/src/themes/light.css" },
    { mode: "dark", value: "dark", label: "Dark", css: "packages/tokens/src/themes/dark.css" },
  ];
  families.push({
    slug: "default",
    displayName: "Default",
    isDefault: true,
    hasTypeface: false,
    modes: builtIns.map(({ mode, value, label, css }) => ({
      mode,
      value,
      label,
      ...swatchesFor(join(repoRoot, css), root),
    })),
  });

  const tokenNames = readTokenNames();
  for (const slug of listFamilies(join(repoRoot, "themes"))) {
    const family = auditFamily(slug, { dir: join(repoRoot, "themes"), tokenNames, root });
    if (family.errors.length > 0) {
      throw new Error(`gen-home: theme family "${slug}" fails its own audit: ${family.errors[0]}`);
    }
    families.push({
      slug,
      displayName: family.variants[0]?.definition?.familyLabel ?? slug,
      isDefault: false,
      hasTypeface: Boolean(family.fonts),
      modes: family.variants
        .map((v) => ({
          mode: v.scheme,
          value: v.name,
          label: v.definition?.label ?? v.name,
          ...swatchesFor(v.file, root),
        }))
        .sort((a, b) => a.mode.localeCompare(b.mode)),
    });
  }

  return families.sort((a, b) =>
    a.isDefault ? -1 : b.isDefault ? 1 : a.slug.localeCompare(b.slug),
  );
}

// ────────────────────────────────── gates.json ────────────────────────────────

export async function buildGates({ repoRoot = REPO_ROOT } = {}) {
  const loaded = await loadRules(join(repoRoot, "scripts/check/rules"));
  const rules = loaded.map(({ rule, source }) => ({
    id: rule.id,
    doc: rule.doc,
    category: rule.scope,
    source: `scripts/check/${source}`,
  }));
  const commands = COMMANDS.map((c) => ({
    id: c.id,
    doc: c.doc,
    category: "external",
    source: "scripts/check/commands.mjs",
  }));
  return [...rules, ...commands].sort((a, b) => a.id.localeCompare(b.id));
}

// ─────────────────────────────────── cli.json ─────────────────────────────────

/** The numbered routine lines the MCP `info` tool prints, reduced to `a → b → c`. */
export function deriveRoutine(manifest) {
  const res = handleMessage(
    { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "info", arguments: {} } },
    { manifest, hosted: false },
  );
  const text = res?.result?.content?.[0]?.text ?? "";
  const verbs = [...text.matchAll(/^\s*\d+\.\s+(\S+)/gm)].map((m) => m[1]);
  return verbs.join(" → ");
}

export function buildCli(manifest) {
  const grouped = {};
  for (const v of manifest.cliVerbs) {
    (grouped[v.group] ??= []).push({ verb: v.verb, usage: v.usage, does: v.does });
  }
  for (const group of Object.values(grouped)) group.sort((a, b) => a.verb.localeCompare(b.verb));

  const hostedTools = TOOLS.filter((t) => !LOCAL_ONLY_TOOLS.has(t.name))
    .map((t) => t.name)
    .sort();
  const localOnlyTools = [...LOCAL_ONLY_TOOLS].sort();

  return {
    verbGroups: grouped,
    hostedMcpTools: hostedTools,
    localOnlyTools,
    routine: deriveRoutine(manifest),
    hostedMcpUrl: HOSTED_MCP_URL,
    hostedMcpCommand: `claude mcp add --transport http brand-ui ${HOSTED_MCP_URL}`,
    localMcpCommand: "npx -y @elabs-ai/components-cli mcp",
    cliInstallCommand: "pnpm add -D @elabs-ai/components-cli",
  };
}

// ─────────────────────────────────── blocks.json ──────────────────────────────

/**
 * The docs/playbooks archetype a registry block "belongs to": the playbook whose
 * `packages` list overlaps the block's `@elabs-ai/*` dependencies the most (ties
 * broken alphabetically by archetype, for a stable result). A heuristic, not an
 * authored fact — the registry carries no archetype field to derive this from
 * directly, and hand-typing one per block is exactly the drift this generator
 * exists to avoid. `null` when a block shares no package with any playbook.
 */
export function bestArchetype(dependencies, playbooks) {
  const deps = new Set(dependencies.filter((d) => d.startsWith("@elabs-ai/")));
  let best = null;
  let bestScore = 0;
  for (const p of [...playbooks].sort((a, b) => a.archetype.localeCompare(b.archetype))) {
    const score = p.packages.filter((pkg) => deps.has(pkg)).length;
    if (score > bestScore) {
      best = p.archetype;
      bestScore = score;
    }
  }
  return best;
}

export function buildBlocks(registry, manifest) {
  return registry.items
    .map((item) => ({
      name: item.name,
      title: item.title,
      categories: item.categories ?? [],
      dependencies: item.dependencies ?? [],
      archetype: bestArchetype(item.dependencies ?? [], manifest.playbooks),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ─────────────────────────────────── playbooks.json ───────────────────────────

export function buildPlaybooks(manifest) {
  return [...manifest.playbooks]
    .map((p) => ({
      archetype: p.archetype,
      intent: p.intent,
      keywords: [...p.keywords].sort(),
      packages: [...p.packages].sort(),
      file: p.file,
      template: p.template,
    }))
    .sort((a, b) => a.archetype.localeCompare(b.archetype));
}

// ─────────────────────────────────── story-ids.json ───────────────────────────

export function buildStoryIds({ repoRoot = REPO_ROOT } = {}) {
  const { byComponent } = indexStoryDocsPages(repoRoot);
  return Object.fromEntries(Object.entries(byComponent).sort(([a], [b]) => a.localeCompare(b)));
}

// ─────────────────────────────────── install.json ─────────────────────────────

export function buildInstall(manifest, registry, cli) {
  const archetypes = [...manifest.playbooks]
    .map((p) => ({
      archetype: p.archetype,
      command: `pnpm add ${[...p.packages].sort().join(" ")}`,
    }))
    .sort((a, b) => a.archetype.localeCompare(b.archetype));

  const marketplace = json(".claude-plugin/marketplace.json");
  const pluginName = marketplace.plugins[0]?.name ?? marketplace.name;

  return {
    cli: cli.cliInstallCommand,
    hostedMcp: { command: cli.hostedMcpCommand, url: cli.hostedMcpUrl },
    localMcp: { command: cli.localMcpCommand },
    plugin: {
      marketplaceAdd: "/plugin marketplace add <path-to-this-repo>",
      install: `/plugin install ${pluginName}`,
    },
    registryHomepage: registry.homepage ?? null,
    perArchetype: archetypes,
  };
}

// ───────────────────────────── .well-known/mcp.json ────────────────────────────

/**
 * `apps/home/public/.well-known/mcp.json` — discovery metadata for the hosted MCP server
 * (2026-09-17 review §4.2 (6)). `tools` is every tool a REMOTE caller can actually reach
 * (`cli.hostedMcpTools`, i.e. `TOOLS` minus `LOCAL_ONLY_TOOLS` — `audit` needs the caller's own
 * files and stays local-only), never a hand-typed list.
 */
export function buildWellKnownMcp(cli) {
  return {
    name: SERVER_INFO.name,
    version: SERVER_INFO.version,
    url: cli.hostedMcpUrl,
    transport: "streamable-http",
    tools: cli.hostedMcpTools,
  };
}

// ────────────────────────────────────── main ──────────────────────────────────

// ─────────────────────── agent-loop-recorded.json (RM-099) ────────────────────
/**
 * The "Ask your agent" loop's offline fallback (RM-099, wave-3 ruling 12): for every call in
 * the hand-authored prompt map `apps/home/content/agent-loop.json`, the answer a local
 * `brand-ui mcp` gives — produced in-process through the SAME `handleMessage` the hosted
 * `/mcp` route wraps, with `hosted: true` so the tool set matches the site's. Regenerated
 * with the manifest, so the recorded responses never drift from what the live server says.
 * Output: `{ [promptId]: [{ tool, args, result }] }`, calls in map order.
 */
export function buildAgentLoopRecorded(manifest, map = json("apps/home/content/agent-loop.json")) {
  return Object.fromEntries(
    map.prompts.map((prompt) => [
      prompt.id,
      prompt.calls.map(({ tool, args }, index) => {
        const res = handleMessage(
          {
            jsonrpc: "2.0",
            id: index + 1,
            method: "tools/call",
            params: { name: tool, arguments: args },
          },
          { manifest, hosted: true },
        );
        if (!res || res.error) {
          throw new Error(
            `agent-loop.json: ${prompt.id} → ${tool} failed: ${res?.error?.message ?? "no response"}`,
          );
        }
        return { tool, args, result: res.result };
      }),
    ]),
  );
}

// ─────────────────────── emit-ui-examples.json (RM-101) ───────────────────────
/**
 * The "Let the agent emit the UI" editors' example menus (RM-101), so a catalog or spec change
 * reaches the site through `gen:check` instead of drifting. A2UI: the CLI's own
 * `brand-ui a2ui example` output, then every hand-authored `apps/home/content/examples/
 * a2ui-*.json`. DashboardSpec: the dashboard track's golden `minimal.json`, then every
 * `apps/home/content/examples/dashboard-spec-*.json`. Each is checked with the CLI's
 * validator (`a2ui validate` / `dashboard-spec validate`); an invalid one fails the gen.
 * Output: `{ a2ui: [{ id, source, value }], dashboardSpec: [{ id, source, value }] }`.
 */
export const DASHBOARD_GOLDEN_MINIMAL =
  "packages/charts/src/dashboard/core/__fixtures__/minimal.json";
export const SITE_EXAMPLES_DIR = "apps/home/content/examples";

export function buildEmitUiExamples({ repoRoot = REPO_ROOT } = {}) {
  const siteFiles = (prefix) =>
    existsSync(join(repoRoot, SITE_EXAMPLES_DIR))
      ? readdirSync(join(repoRoot, SITE_EXAMPLES_DIR))
          .filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
          .sort()
          .map((name) => `${SITE_EXAMPLES_DIR}/${name}`)
      : [];
  const load = (path) => JSON.parse(readFileSync(join(repoRoot, path), "utf8"));
  const checked = (entry, validate) => {
    const result = validate(entry.value);
    if (!result.ok) {
      const first = result.errors[0];
      throw new Error(`${entry.source}: invalid — ${first.path} ${first.code} ${first.message}`);
    }
    return entry;
  };
  const idOf = (path, prefix) =>
    path.slice(path.lastIndexOf("/") + 1 + prefix.length, -".json".length);
  return {
    a2ui: [
      { id: "cli-example", source: "brand-ui a2ui example", value: A2UI_EXAMPLE },
      ...siteFiles("a2ui-").map((path) => ({
        id: idOf(path, "a2ui-"),
        source: path,
        value: load(path),
      })),
    ].map((entry) => checked(entry, validateSurface)),
    dashboardSpec: [
      { id: "minimal", source: DASHBOARD_GOLDEN_MINIMAL, value: load(DASHBOARD_GOLDEN_MINIMAL) },
      ...siteFiles("dashboard-spec-").map((path) => ({
        id: idOf(path, "dashboard-spec-"),
        source: path,
        value: load(path),
      })),
    ].map((entry) => checked(entry, validateSpec)),
  };
}

async function buildAll() {
  const manifest = json("brand-ui.manifest.json");
  const registry = json("registry/registry.json");
  const cli = buildCli(manifest);
  return {
    "packages.json": buildPackages(manifest),
    "counts.json": [
      ["packages", Object.keys(manifest.packages).length, "brand-ui.manifest.json#packages"],
      [
        "componentExports",
        buildPackages(manifest).reduce((n, p) => n + p.exportCount, 0),
        "brand-ui.manifest.json#packages[].components",
      ],
      ["registryBlocks", registry.items.length, "registry/registry.json#items"],
      ["templates", manifest.templates.length, "brand-ui.manifest.json#templates"],
      ["playbooks", manifest.playbooks.length, "brand-ui.manifest.json#playbooks"],
      ["themeFamilies", buildThemes().filter((f) => !f.isDefault).length, "themes/*/theme.ts"],
      ["tokens", manifest.tokenCount, "brand-ui.manifest.json#tokenCount"],
      [
        "skills",
        readdirSync(join(REPO_ROOT, "skills"), { withFileTypes: true }).filter((e) =>
          e.isDirectory(),
        ).length,
        "skills/*/",
      ],
      ["hostedMcpTools", cli.hostedMcpTools.length, "packages/cli/lib/mcp.mjs#TOOLS"],
      [
        "gates",
        (await buildGates()).length,
        "scripts/check/rules/*.mjs + scripts/check/commands.mjs",
      ],
    ].reduce((acc, [key, value, source]) => ({ ...acc, [key]: { value, source } }), {}),
    "themes.json": buildThemes(),
    "gates.json": await buildGates(),
    "cli.json": cli,
    "blocks.json": buildBlocks(registry, manifest),
    "playbooks.json": buildPlaybooks(manifest),
    "story-ids.json": buildStoryIds(),
    "install.json": buildInstall(manifest, registry, cli),
    // RM-099
    "agent-loop-recorded.json": buildAgentLoopRecorded(manifest),
    // RM-101
    "emit-ui-examples.json": buildEmitUiExamples(),
  };
}

/** Write `data` as pretty JSON to `outPath` when it differs from what's on disk; `--check`
 * never writes. Returns `true` when `outPath` was (or would be) stale. Shared by the
 * `content/generated/*.json` loop and the `.well-known/mcp.json` write below it. */
async function writeJsonIfStale(outPath, data, { check, prettier }) {
  const next = JSON.stringify(data, null, 2) + "\n";
  const existing = existsSync(outPath) ? readFileSync(outPath, "utf8") : "";
  const same =
    existing !== "" &&
    JSON.stringify(JSON.parse(existing || "null")) === JSON.stringify(JSON.parse(next));
  if (same) return false;
  if (!check) {
    mkdirSync(dirname(outPath), { recursive: true });
    const options = (await prettier.resolveConfig(outPath)) ?? {};
    writeFileSync(outPath, await prettier.format(next, { ...options, filepath: outPath }));
  }
  return true;
}

async function main() {
  const check = process.argv.includes("--check");
  const files = await buildAll();

  const prettier = await import("prettier");
  const stale = [];
  for (const [name, data] of Object.entries(files)) {
    if (await writeJsonIfStale(join(OUT_DIR, name), data, { check, prettier })) stale.push(name);
  }
  const wellKnownStale = await writeJsonIfStale(
    WELL_KNOWN_MCP_PATH,
    buildWellKnownMcp(files["cli.json"]),
    { check, prettier },
  );
  if (wellKnownStale) stale.push("public/.well-known/mcp.json");

  if (check) {
    if (stale.length > 0) {
      console.error(
        `✖ apps/home/content/generated/*.json is STALE: ${stale.join(", ")}\n` +
          "  Run `pnpm gen --only home` and commit the result.",
      );
      process.exit(1);
    }
    console.log(
      `✔ apps/home/content/generated/*.json is fresh (${Object.keys(files).length + 1} files).`,
    );
    return;
  }
  console.log(
    stale.length
      ? `✔ apps/home/content/generated/*.json written — updated: ${stale.join(", ")}.`
      : `✔ apps/home/content/generated/*.json written — nothing changed.`,
  );
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  await main();
}
