/**
 * @elabs-ai/components-cli — shared, deterministic renderers for the generated agent docs.
 *
 * One manifest, several derived surfaces (WP-03 / WP-10):
 *   - the component INVENTORY      (#87 — a browsable index)
 *   - llms.txt HUB + SPOKES        (#156 — the always-on agent hub doc)
 *   - the CONTEXT files            (#82 — ground truth into files agents read)
 *
 * These renderers are the single place the manifest → text shape lives, so every
 * surface stays consistent and DRY. EVERYTHING here MUST be deterministic:
 *   - never read the wall clock and never emit `generatedAt` — these renderers
 *     omit any timestamp, so the stale-gate diffs only real content changes,
 *   - iterate packages/components in a stable (sorted) order,
 *   - no environment-dependent output.
 *
 * The stale-gate for each surface is "regenerate, compare to disk, fail on diff"
 * — the same contract as `pnpm gen:check`.
 */
import { isConstantName } from "./search.mjs";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** The public docs deployment (Storybook static build) and the hosted MCP it serves. */
export const HOSTED_DOCS_URL = "https://elabs-ai.com";
export const HOSTED_MCP_URL = `${HOSTED_DOCS_URL}/mcp`;

/**
 * Where `npx shadcn@latest add <url>/<item>.json` resolves TODAY — the published GitHub
 * Pages registry (`registry/registry.json`'s own `homepage`, kept fresh by
 * `pnpm registry:publish`). `HOSTED_DOCS_URL` itself has no `/r` route until the site's own
 * routes exist (RM-105 — see `siteRoutes` on `renderLlmsHub`).
 */
export const REGISTRY_HOMEPAGE = "https://mreimitz.github.io/elabs-components/r";

/** Packages in stable, dependency-order-ish display order (tokens → ui → domain). */
const PKG_ORDER = [
  "@elabs-ai/components-tokens",
  "@elabs-ai/components-icons",
  "@elabs-ai/components-ui",
  "@elabs-ai/components-data",
  "@elabs-ai/components-ai",
  "@elabs-ai/components-flow",
  "@elabs-ai/components-maps",
  "@elabs-ai/components-charts",
  "@elabs-ai/components-marketing",
  "@elabs-ai/components-editor",
  "@elabs-ai/components-viewer",
  "@elabs-ai/components-terminal",
  // Layer 3 — the only package that composes other leaves (ADR 0034). Last in the
  // display order because it sits at the end of the one-way dependency line.
  "@elabs-ai/components-process",
];

/** One-line purpose per package — the routing map ("which package for what"). */
export const PKG_PURPOSE = {
  "@elabs-ai/components-tokens": "Semantic CSS-variable themes + ThemeProvider/useTheme.",
  "@elabs-ai/components-icons":
    "Brand/product-vocabulary icons + BrandLogo (generic glyphs use lucide-react).",
  "@elabs-ai/components-ui": "Foundation + app UI (Button, Card, Dialog, Tabs, AppShell, …).",
  "@elabs-ai/components-data":
    "TanStack DataTable, FilterBar, SearchInput, FacetFilter, ColumnPicker.",
  "@elabs-ai/components-ai":
    "ChatShell, Conversation, Message, PromptInput, Tool, Reasoning, citations.",
  "@elabs-ai/components-flow": "Branded React Flow canvas, nodes, edges, controls, inspector.",
  "@elabs-ai/components-maps":
    "MapLibre GL maps: MapCanvas, markers, popups, controls, routes, arcs, GeoJSON, clusters.",
  "@elabs-ai/components-charts":
    "MetricCard, MetricGrid, ChartCard, ChartFrame (expand/flip/download).",
  "@elabs-ai/components-marketing":
    "Hero, FeatureGrid, UseCaseCard, StatsBand, CTASection, LogoStrip.",
  "@elabs-ai/components-editor":
    "Token-themed Monaco editor: CodeEditor, DiffEditor, CodeWorkspace.",
  "@elabs-ai/components-viewer":
    "FileViewer — any file (image, text, JSON, CSV) via a pluggable adapter registry.",
  "@elabs-ai/components-terminal":
    "Terminal surfaces: shell/agent output and coding-agent CLI look-alikes.",
  "@elabs-ai/components-process":
    "Process mining and event-log analysis: process map, variants, cases, conformance — composes flow/charts/data.",
};

/**
 * Infra / tooling packages that are NOT in the manifest (the manifest is
 * product-only). These rows come ONLY from this static map — they are appended
 * to the manifest packages for `scope:"all"` (AGENTS.md's full package map).
 * name → { path, purpose }. Kept in the same display order they appear in docs.
 */
export const INFRA_PKGS = {
  "@elabs-ai/components-eslint-config": {
    path: "packages/eslint-config",
    purpose: "Shared ESLint flat config",
  },
  "@elabs-ai/components-typescript-config": {
    path: "packages/typescript-config",
    purpose: "Shared tsconfigs",
  },
  "@elabs-ai/components-docs": { path: "apps/docs", purpose: "Storybook" },
  // `-playground` (apps/playground) and `-e2e` (apps/e2e) were removed in 80a12fb
  // (2026-08-02); apps/docs is the only app left.
};

/** Stable package iteration: known order first, then any extras alphabetically. */
export function orderedPackages(manifest) {
  const names = Object.keys(manifest.packages || {});
  const known = PKG_ORDER.filter((n) => names.includes(n));
  const extra = names.filter((n) => !PKG_ORDER.includes(n)).sort((a, b) => a.localeCompare(b));
  return [...known, ...extra];
}

/** Render a component's cva variants inline: `variant=a|b|c · size=sm|md`. */
function variantSummary(variants) {
  if (!variants?.variants) return "";
  return Object.entries(variants.variants)
    .map(([group, values]) => {
      const def = variants.defaultVariants?.[group];
      const vals = values.map((v) => (v === def ? `${v}*` : v)).join("|");
      return `${group}=${vals}`;
    })
    .join(" · ");
}

/**
 * A flat, sorted list of a package's components with their derived attributes.
 * Used by every renderer so the inventory, llms.txt and context agree exactly.
 * @returns {{ name, kind, importPath, variants, intent }[]}
 */
export function packageRows(manifest, pkgName) {
  const info = manifest.packages[pkgName] || {};
  const rows = [];
  for (const c of info.components || [])
    rows.push({
      name: c.name,
      kind: "component",
      variants: info.variants?.[c.name] ? variantSummary(info.variants[c.name]) : "",
      intent: info.intent?.[c.name] || null,
    });
  for (const h of info.hooks || [])
    rows.push({ name: h.name, kind: "hook", variants: "", intent: null });
  rows.sort((a, b) => a.name.localeCompare(b.name));
  // Subpath-exported components/hooks (imported from `pkg/<subpath>`).
  const subRows = [];
  for (const [importPath, sub] of Object.entries(info.subpaths || {})) {
    for (const c of sub.components || [])
      subRows.push({ name: c.name, kind: "component", importPath, variants: "", intent: null });
    for (const h of sub.hooks || [])
      subRows.push({ name: h.name, kind: "hook", importPath, variants: "", intent: null });
  }
  subRows.sort((a, b) => (a.importPath + a.name).localeCompare(b.importPath + b.name));
  return [...rows, ...subRows];
}

/** Themes, with the default flagged — shared "six themes" line. */
export function themeLine(manifest) {
  const def = manifest.defaultTheme;
  return (manifest.themes || [])
    .map((t) => {
      const slug = t.replace(/\s*\(:root\)$/, "");
      return slug === def ? `${slug} (default)` : slug;
    })
    .join(", ");
}

/** Escape a cell for a Markdown table (pipes + newlines). */
function cell(s) {
  return String(s ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ");
}

// ---------------------------------------------------------------------------
// #87 — Component INVENTORY (a browsable Markdown index of the whole surface)
// ---------------------------------------------------------------------------
export function renderInventory(manifest) {
  const lines = [];
  lines.push("<!-- GENERATED FILE — do not edit by hand.");
  lines.push("     Source: brand-ui.manifest.json (via `pnpm gen`).");
  lines.push(
    "     Regenerate after any component/token change; `pnpm gen:check` fails on drift. -->",
  );
  lines.push("");
  lines.push("# brand-ui component inventory");
  lines.push("");
  lines.push(
    "The full component/hook surface, generated from the manifest. " +
      "`*` marks a cva default value. Subpath-exported items show their import path.",
  );
  lines.push("");
  lines.push(`**Themes (${(manifest.themes || []).length}):** ${themeLine(manifest)}`);
  lines.push(`**Radius:** \`${manifest.radius ?? "—"}\` · **Tokens:** ${manifest.tokenCount ?? 0}`);
  lines.push("");

  // Summary table of packages.
  lines.push("## Packages");
  lines.push("");
  lines.push("| Package | Path | Components | Hooks | Purpose |");
  lines.push("| --- | --- | --: | --: | --- |");
  for (const pkg of orderedPackages(manifest)) {
    const info = manifest.packages[pkg];
    const comps = (info.components || []).length;
    const hooks = (info.hooks || []).length;
    lines.push(
      `| \`${pkg}\` | ${cell(info.path)} | ${comps} | ${hooks} | ${cell(PKG_PURPOSE[pkg] || "")} |`,
    );
  }
  lines.push("");

  // Per-package component index.
  for (const pkg of orderedPackages(manifest)) {
    const rows = packageRows(manifest, pkg);
    if (!rows.length) continue;
    lines.push(`## ${pkg}`);
    lines.push("");
    if (PKG_PURPOSE[pkg]) lines.push(`> ${PKG_PURPOSE[pkg]}`);
    lines.push("");
    lines.push("| Name | Kind | Variants | Import | Notes |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const r of rows) {
      const imp = r.importPath ? `\`${r.importPath}\`` : `\`${pkg}\``;
      const note = r.intent?.purpose ? cell(r.intent.purpose) : "";
      lines.push(`| ${cell(r.name)} | ${r.kind} | ${cell(r.variants)} | ${imp} | ${note} |`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push(
    "_Generated by `@elabs-ai/components-cli`. The live, queryable surface is `brand-ui docs <Component>` " +
      "(real props) and, when the Storybook dev server is up, the `mcp__storybook__*` tools._",
  );
  lines.push("");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// #156 / #82 — llms.txt HUB + per-package SPOKES
// ---------------------------------------------------------------------------

/**
 * Honest counts for a package. The manifest's `components` bucket holds every
 * Capitalised value export — compound parts (`DialogContent`) and constants
 * (`CALENDAR_ROWS`) included — so its length said "ui: 390 components" where the
 * README says ~100. A COMPONENT here is a source module that exports at least
 * one renderable; EXPORTS is what you can import, constants excluded.
 */
export function componentCounts(info) {
  const renderable = (info.components || []).filter((c) => !isConstantName(c.name));
  return {
    components: new Set(renderable.map((c) => c.module || c.name)).size,
    exports: renderable.length,
  };
}

const kebabCase = (name) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();

/**
 * One name per component module, the modules {@link componentCounts} counts:
 * the export named like its file (`Card` for `card.tsx`), else the shortest.
 * A short list that still reaches every component; `brand-ui docs <Name>`
 * lists the module's parts (`CardHeader`, …).
 */
export function moduleComponentNames(info) {
  const byModule = new Map();
  for (const c of info.components || []) {
    if (isConstantName(c.name)) continue;
    const key = c.module || c.name;
    byModule.set(key, [...(byModule.get(key) || []), c.name]);
  }
  return [...byModule]
    .map(([module, names]) => {
      const file = module
        .split("/")
        .pop()
        .replace(/\.[jt]sx?$/, "");
      const shortest = [...names].sort((a, b) => a.length - b.length || a.localeCompare(b))[0];
      return names.find((n) => kebabCase(n) === file) ?? shortest;
    })
    .sort((a, b) => a.localeCompare(b));
}

/**
 * The `brand-ui-context.md` a created app ships: the routine, then one name per
 * component for the packages that app installs. Parts and props stay behind
 * `brand-ui docs <Name> --brief`, so this is a few KB where the full inventory
 * ({@link renderContextBlock}) of every package is about 28 KB and an agent
 * reads it before its first edit.
 * @param {object} manifest
 * @param {string[]} packages  the packages the app installs
 */
export function renderAppContext(manifest, packages) {
  const lines = [
    "# brand-ui in this app",
    "",
    "Generated when this app was created, for the packages it installs. Each name",
    "below is one component; `brand-ui docs <Name> --brief` shows its parts, props",
    "and import line. Never guess a prop.",
    "",
    "## The routine",
    "",
    "1. `brand-ui search <concept>`: find the component. It searches every package,",
    "   including ones this app does not install yet.",
    "2. `brand-ui docs <Name> --brief`: its parts and real props (drop `--brief` for all of them).",
    "3. Build with it: semantic tokens and type roles only, every state covered.",
    "4. `brand-ui audit src`: the token and type-role pass.",
    "",
    "Run them as `pnpm exec brand-ui <command>`, or `npx brand-ui <command>` with npm.",
    "In Claude Code the `mcp__brand-ui__search` and `mcp__brand-ui__docs` tools answer the same.",
    "",
  ];
  for (const pkg of orderedPackages(manifest).filter((p) => packages.includes(p))) {
    const info = manifest.packages[pkg] || {};
    const names = moduleComponentNames(info);
    const hooks = (info.hooks || []).map((h) => h.name).sort((a, b) => a.localeCompare(b));
    const subpaths = Object.keys(info.subpaths || {}).sort((a, b) => a.localeCompare(b));
    lines.push(`## ${pkg} (${names.length} components)`, "");
    if (PKG_PURPOSE[pkg]) lines.push(PKG_PURPOSE[pkg], "");
    if (names.length) lines.push(names.join(", "), "");
    if (hooks.length) lines.push(`Hooks: ${hooks.join(", ")}`, "");
    if (subpaths.length)
      lines.push(`Subpath imports: ${subpaths.map((s) => `\`${s}\``).join(", ")}`, "");
  }
  lines.push(
    "The names come from the release this app was created with. After an upgrade,",
    "`search` and `docs` answer for the installed version.",
    "",
  );
  return lines.join("\n");
}

/**
 * The README's "by the numbers" region. One definition of a component everywhere
 * it is counted for people: {@link componentCounts} — one per component module,
 * sub-parts (`CardHeader`) and constants not counted — the same number llms.txt
 * prints. Token and ADR counts come from their own sources so no number in the
 * README is typed by hand.
 * @param {object} manifest
 * @param {string} root  repo root (reads the token contract and docs/ADR)
 */
export function renderReadmeCounts(manifest, root) {
  const short = (name) => name.replace(/^@elabs-ai\/components-/, "");
  const perPkg = orderedPackages(manifest).map((name) => ({
    name,
    components: componentCounts(manifest.packages[name]).components,
  }));
  const total = perPkg.reduce((sum, p) => sum + p.components, 0);
  const contract = readFileSync(
    join(root, "packages/tokens/src/theme-token-names.generated.ts"),
    "utf8",
  );
  const tokens = new Set(contract.match(/"--[a-z0-9-]+"/g) || []).size;
  const adrs = readdirSync(join(root, "docs/ADR")).filter((f) => /^\d{4}-.+\.md$/.test(f)).length;
  return [
    "<!-- Generated by `pnpm gen` from brand-ui.manifest.json, the token contract and docs/ADR — edit those, not this. -->",
    "",
    `**By the numbers:** ${total} components across ${perPkg.length} packages — ` +
      perPkg.map((p) => `${short(p.name)} ${p.components}`).join(" · ") +
      ". A component counts once per component module; its sub-parts (`CardHeader`) and " +
      `exported constants are not counted separately. The theme token contract (\`THEME_TOKEN_NAMES\`) ` +
      `has ${tokens} tokens, and ${adrs} architecture decision records explain the _why_.`,
  ].join("\n");
}

/**
 * The root `llms.txt` hub — purpose, package routing map, themes, entry points.
 * @param {object} manifest
 * @param {{ siteOrigin?: string, siteRoutes?: boolean }} [opts]
 *   `siteOrigin`: where this instance's own URLs point (the hosted MCP, the docs site,
 *   `.well-known/mcp.json`, …). Defaults to the production site so the CLI's generated
 *   `llms.txt` and the site's own `/llms.txt` route agree byte-for-byte; a preview
 *   deployment can pass its own origin so it reports itself (RM-100, no live preview
 *   exists yet). `siteRoutes` (default false): opt the Docs-site and Registry links into
 *   the `/storybook/` + `/r` forms — only for a caller whose site actually serves them.
 *   `https://elabs-ai.com` is still the Storybook project until RM-105 moves the domain
 *   (no `/storybook/`, no `/r`), so the default stays the links that work there today.
 */
export function renderLlmsHub(manifest, { siteOrigin = HOSTED_DOCS_URL, siteRoutes = false } = {}) {
  const mcpUrl = `${siteOrigin}/mcp`;
  const storybookUrl = siteRoutes ? `${siteOrigin}/storybook/` : siteOrigin;
  const registryBase = siteRoutes ? `${siteOrigin}/r` : REGISTRY_HOMEPAGE;
  const lines = [];
  lines.push("# brand-ui");
  lines.push("");
  lines.push(
    "> Open-source, source-owned, token-driven React component system built for coding agents " +
      "and the people who work with them: dashboards, data grids, AI/chat clients, React Flow " +
      "canvases, maps, editors and the marketing page in front of them. Default look: modern " +
      "enterprise SaaS, themeable to any brand. Tailwind v4 (CSS-variable tokens) + Radix + React 19.",
  );
  lines.push("");
  lines.push(
    "This file is generated from `brand-ui.manifest.json` — the anti-hallucination ground " +
      "truth. Never hand-edit it. For the live, queryable API, connect the hosted brand-ui " +
      `MCP at \`${mcpUrl}\` (nothing to install) and call \`info\` · \`search <q>\` · ` +
      "`docs <Component>`; the same tools run locally over stdio with " +
      "`npx -y @elabs-ai/components-cli mcp`.",
  );
  lines.push("");
  lines.push("## Rules of the road");
  lines.push("");
  lines.push("- Semantic tokens only — no raw hex outside `packages/tokens/src/themes.css`.");
  lines.push("- `forwardRef` + spread `...props` + merge `className` via `cn()`.");
  lines.push("- Variants via `class-variance-authority`; Radix for overlays/interaction.");
  lines.push("- Visible focus ring on every interactive element; must read in every theme.");
  lines.push("- One-way dependency: `tokens → ui/icons → data/ai/flow/charts/marketing/editor`.");
  lines.push("");
  // These are the MODES every theme family implements — not the list of looks.
  // The old heading "Themes (2)" read as "this library has two themes".
  lines.push(`## Theme modes (${(manifest.themes || []).length})`);
  lines.push("");
  lines.push(themeLine(manifest));
  lines.push("");
  lines.push(
    "Theming is open: a theme is a stylesheet of semantic tokens, registered with " +
      "`ThemeProvider` — no fork. Downloadable brand theme families live in the repo's " +
      "`themes/` directory (each implements every mode above); `themes/README.md` lists them.",
  );
  lines.push("");
  lines.push("## Packages (which package for what)");
  lines.push("");
  for (const pkg of orderedPackages(manifest)) {
    const info = manifest.packages[pkg];
    const { components: comps, exports: parts } = componentCounts(info);
    const hooks = (info.hooks || []).length;
    lines.push(
      `- [${pkg}](./llms/${pkg.replace("@elabs-ai/components-", "")}.txt) — ${PKG_PURPOSE[pkg] || ""} ` +
        `(${comps} components · ${parts} exports with their parts, ${hooks} hooks)`,
    );
  }
  lines.push("");
  lines.push("## Entry points");
  lines.push("");
  lines.push(
    `- Hosted MCP (no install): \`claude mcp add --transport http brand-ui ${mcpUrl}\` ` +
      "— Streamable HTTP, tools `info` · `search <q>` · `docs <Component>` · `tokens` · `chart_for` · `a2ui`",
  );
  lines.push(
    "- CLI over stdio: `npx -y @elabs-ai/components-cli mcp`, or `pnpm add -D " +
      "@elabs-ai/components-cli` then `pnpm exec brand-ui info` · `… search <q>` · `… docs <Component>` " +
      "(the local CLI also has `audit`, which the hosted server cannot run)",
  );
  lines.push(
    "- Claude Code / Cowork plugin (skills, tracks the repo): `/plugin marketplace add " +
      "mreimitz/elabs-components` then `/plugin install brand-ui`",
  );
  lines.push(
    "- New app in one command: `npx -y @elabs-ai/components-cli create <dir> --template dashboard` " +
      "(data-app · ai-assistant · flow-workspace · settings · marketing) — a runnable Vite + React app " +
      "with tokens, Tailwind `@source` lines and `ThemeProvider` wired",
  );
  lines.push(
    "- Generative UI (an agent DESIGNS a screen): emit an A2UI surface — JSON of catalog types " +
      "(`npx -y @elabs-ai/components-cli a2ui catalog`, `… a2ui validate <file>`, or the MCP `a2ui` tool) — " +
      "and render it with `<A2uiSurface surface onAction />` from `@elabs-ai/components-ai`",
  );
  lines.push(`- Docs site: ${storybookUrl} (Storybook — every component, live, in every theme)`);
  lines.push(`- Discovery: ${siteOrigin}/.well-known/mcp.json`);
  lines.push("- Manifest: `brand-ui.manifest.json` (machine-readable ground truth)");
  lines.push(
    `- Registry (copy-own): \`npx shadcn@latest add ${registryBase}/<item>.json\` ` +
      "(or self-host — `pnpm registry:build`, or copy from `registry/blocks/<name>/`)",
  );
  lines.push("");
  return lines.join("\n");
}

/** A per-package `llms.txt` spoke — that package's slice only. */
export function renderLlmsSpoke(manifest, pkgName) {
  const rows = packageRows(manifest, pkgName);
  const lines = [];
  lines.push(`# ${pkgName}`);
  lines.push("");
  if (PKG_PURPOSE[pkgName]) lines.push(`> ${PKG_PURPOSE[pkgName]}`);
  lines.push("");
  lines.push(
    `Import from \`${pkgName}\`. Part of brand-ui — see the root \`llms.txt\` for routing.`,
  );
  lines.push("");
  const comps = rows.filter((r) => r.kind === "component" && !r.importPath);
  const hooks = rows.filter((r) => r.kind === "hook" && !r.importPath);
  const subs = rows.filter((r) => r.importPath);
  if (comps.length) {
    lines.push("## Components");
    lines.push("");
    for (const r of comps) {
      const bits = [r.name];
      if (r.variants) bits.push(`(${r.variants})`);
      if (r.intent?.purpose) bits.push(`— ${r.intent.purpose}`);
      lines.push(`- ${bits.join(" ")}`);
      if (r.intent?.antiPatterns?.length) {
        for (const ap of r.intent.antiPatterns) lines.push(`  - avoid: ${ap}`);
      }
    }
    lines.push("");
  }
  if (hooks.length) {
    lines.push("## Hooks");
    lines.push("");
    for (const r of hooks) lines.push(`- ${r.name}`);
    lines.push("");
  }
  if (subs.length) {
    lines.push("## Subpath exports");
    lines.push("");
    for (const r of subs) lines.push(`- ${r.name} (\`${r.importPath}\` · ${r.kind})`);
    lines.push("");
  }
  // The @elabs-ai/components-ai OUTPUT CONTRACT: the shape an agent must emit so these
  // components render it (from manifest.agentOutput). Full guidance lives in the
  // brand-ui skill + the Storybook "AI Output Contract for Agents" page.
  if (pkgName === "@elabs-ai/components-ai" && manifest.agentOutput?.paths) {
    const { conversation, jsxPreview, a2ui } = manifest.agentOutput.paths;
    lines.push("## Agent output contract (what shape to emit)");
    lines.push("");
    lines.push(
      `- Conversation → ${conversation.model} (${conversation.status}). ` +
        `Parts: ${conversation.parts.map((p) => p.kind).join(", ")}; ` +
        `rendered by ${conversation.consumedBy.join(", ")}. Your app owns useChat (D5).`,
    );
    lines.push(
      `- Ad-hoc JSX → ${jsxPreview.component} (${jsxPreview.status}); ` +
        `renders only tags present in the components allow-list.`,
    );
    lines.push(
      `- Agent-designed surface (UI as data) → ${a2ui.component} (${a2ui.status}); ` +
        "only catalog types render (`brand-ui a2ui catalog`); actions reach the host's onAction.",
    );
    const tool = conversation.parts.find((p) => p.kind === "tool");
    if (tool) {
      lines.push(
        `- Tool state → Status: ` +
          Object.entries(tool.stateToStatus)
            .map(([s, st]) => `${s}=${st}`)
            .join(", ") +
          ".",
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// #82 — CONTEXT block (concise catalogue + rules digest for files agents read)
// ---------------------------------------------------------------------------

/**
 * The body of the generated context block (no markers — the caller wraps it).
 * Deliberately CONCISE: a catalogue + pointers, NOT the full prop tables (those
 * stay queryable via `brand-ui docs` / the MCP) so agent context windows aren't
 * bloated. #82.
 */
export function renderContextBlock(manifest) {
  const lines = [];
  lines.push("# brand-ui — generated context (ground truth)");
  lines.push("");
  lines.push(
    "Generated from `brand-ui.manifest.json` by `brand-ui context`. Do not hand-edit " +
      "inside the markers. The live, queryable API is `brand-ui docs <Component>`.",
  );
  lines.push("");
  lines.push(`Themes (${(manifest.themes || []).length}): ${themeLine(manifest)}`);
  lines.push(
    `Radius: ${manifest.radius ?? "—"} · Tokens: ${manifest.tokenCount ?? 0} · Registry items: ${(manifest.registry || []).length}`,
  );
  lines.push("");
  lines.push(
    "Rules: semantic tokens only (no raw hex); forwardRef + cn() + spread props; Radix for",
  );
  lines.push(
    "overlays; compound composition; visible focus ring; works in every theme. Dependency",
  );
  lines.push("flows one way: tokens → ui/icons → data/ai/flow/charts/marketing/editor.");
  lines.push("");
  lines.push("## Packages & components");
  lines.push("");
  for (const pkg of orderedPackages(manifest)) {
    const rows = packageRows(manifest, pkg).filter((r) => !r.importPath);
    const names = rows.map((r) => r.name);
    if (!names.length) continue;
    lines.push(`### ${pkg} — ${PKG_PURPOSE[pkg] || ""}`);
    // Catalogue is names-only (concise); props/variants stay in `brand-ui docs`.
    lines.push(names.join(", "));
    lines.push("");
  }
  lines.push(renderPlaybookSection(manifest));
  lines.push("Use `brand-ui docs <Component>` for real props, expanded cva variants, and");
  lines.push("per-component intent (purpose / relationships / anti-patterns). Never guess props.");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// WP-09 #66/#84 — PLAYBOOKS (intent → archetype → template)
// ---------------------------------------------------------------------------
// The six archetype recipes existed but were invisible to every agent surface:
// zero mentions in the generated context, no `search` hit, no manifest entry. An
// agent asked to "build a dashboard" therefore never found docs/playbooks/
// dashboard.md. These renderers put the routing table where agents already read.

/**
 * The `## Playbooks (intent → archetype)` section of the generated context block.
 * One line per playbook so an agent can route a free-text intent to a recipe
 * without a second lookup. Empty string when the manifest carries no playbooks.
 */
export function renderPlaybookSection(manifest) {
  const playbooks = manifest.playbooks || [];
  if (!playbooks.length) return "";
  const lines = [];
  lines.push("## Playbooks (intent → archetype)");
  lines.push("");
  lines.push(
    "Building a WHOLE screen? Match the intent below, read the playbook, then start " +
      "from its template. `brand-ui search <intent>` matches these too.",
  );
  lines.push("");
  for (const p of playbooks) {
    const kw = p.keywords?.length ? ` · keywords: ${p.keywords.join(", ")}` : "";
    const tpl = p.template ? ` · template ${p.template}` : "";
    lines.push(`- **${p.archetype}** — ${p.intent}${kw} · ${p.file}${tpl}`);
  }
  lines.push("");
  return lines.join("\n");
}

/**
 * The generated archetype index for `docs/playbooks/README.md` (the human entry
 * point). Was a hand-maintained table — a 7th playbook silently missed it; now it
 * is generator-owned and `pnpm gen:check` gates it.
 */
export function renderPlaybookIndex(manifest) {
  const playbooks = manifest.playbooks || [];
  const lines = [];
  lines.push("| Archetype | Intent | Playbook | Template source |");
  lines.push("| --- | --- | --- | --- |");
  for (const p of playbooks) {
    const name = p.file.replace(/^docs\/playbooks\//, "");
    const tpl = p.template ? `\`${p.template}\`` : "—";
    lines.push(`| \`${p.archetype}\` | ${cell(p.intent)} | [\`${name}\`](./${name}) | ${tpl} |`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// #87 / #96 — GENERATED hand-doc regions (package table, decision summary,
// selection table) emitted into CLAUDE.md / AGENTS.md / PROJECT.md / Introduction.mdx
// inside `<!-- brand-ui:gen:<artifact>:start -->` markers (see context.mjs).
// Every renderer here is deterministic (stable order, no timestamps).
// ---------------------------------------------------------------------------

/** Slug a package path → short import label (kept verbatim from the manifest). */
function pkgPath(name, manifest) {
  const info = manifest.packages?.[name];
  return info?.path ?? INFRA_PKGS[name]?.path ?? "";
}

/**
 * The package table for a doc surface.
 *   scope:  "product" → the manifest's 10 packages (PROJECT.md / Introduction.mdx)
 *           "all"     → those 10 + the 5 static INFRA_PKGS rows (AGENTS.md)
 *   format: "table"   → a Markdown `| Package | Path | Purpose |` table
 *           "list"    → a bulleted list (`- **@elabs-ai/components-x** — purpose.`) for Introduction.mdx
 * The manifest stays product-only; infra rows come ONLY from the static INFRA_PKGS map.
 */
export function renderPackageTable(manifest, { scope = "product", format = "table" } = {}) {
  const names = orderedPackages(manifest);
  const rows = names.map((name) => ({
    name,
    path: pkgPath(name, manifest),
    purpose: PKG_PURPOSE[name] || "",
  }));
  if (scope === "all") {
    for (const [name, info] of Object.entries(INFRA_PKGS)) {
      rows.push({ name, path: info.path, purpose: info.purpose });
    }
  }
  const lines = [];
  if (format === "list") {
    for (const r of rows) lines.push(`- **${r.name}** — ${r.purpose}`);
    return lines.join("\n");
  }
  lines.push("| Package | Path | Purpose |");
  lines.push("| --- | --- | --- |");
  for (const r of rows) {
    lines.push(`| \`${r.name}\` | \`${r.path}\` | ${cell(r.purpose)} |`);
  }
  return lines.join("\n");
}

/**
 * The canonical D1–D7 decision summary, extracted VERBATIM from the
 * `<!-- DECISIONS:SUMMARY:START … -->` … `<!-- DECISIONS:SUMMARY:END -->` region
 * of `docs/DECISIONS.md` (the single source of truth — never reformat it here).
 * A short "edit decisions in docs/DECISIONS.md" note is prepended INSIDE the block.
 * @param {string} repoRoot
 */
export function renderDecisionSummary(repoRoot) {
  const note =
    "<!-- Generated from the DECISIONS:SUMMARY region of `docs/DECISIONS.md` — edit decisions there, not here. -->";
  return `${note}\n\n${decisionSummaryBody(repoRoot)}`;
}

/** The DECISIONS:SUMMARY region of `docs/DECISIONS.md`, links made root-relative. */
function decisionSummaryBody(repoRoot) {
  const src = readFileSync(join(repoRoot, "docs/DECISIONS.md"), "utf8");
  // Match from the END of the START comment line to the START of the END comment.
  const startRe = /<!--\s*DECISIONS:SUMMARY:START[\s\S]*?-->/;
  const endMarker = "<!-- DECISIONS:SUMMARY:END -->";
  const startMatch = src.match(startRe);
  const endIdx = src.indexOf(endMarker);
  if (!startMatch || endIdx === -1 || endIdx < startMatch.index + startMatch[0].length) {
    throw new Error(
      "renderDecisionSummary: could not find the DECISIONS:SUMMARY:START/END region in docs/DECISIONS.md",
    );
  }
  // docs/DECISIONS.md links rules as `../.claude/rules/…`; every target (CLAUDE.md, AGENTS.md)
  // lives at the repo root, so drop the leading `../` or the links resolve outside the repo.
  return src
    .slice(startMatch.index + startMatch[0].length, endIdx)
    .trim()
    .replaceAll("](../", "](");
}

/**
 * The D3 "which package for what" selection table, from PKG_PURPOSE.
 * Deterministic (orderedPackages). | Package | Use it for |.
 */
export function renderSelectionTable(manifest) {
  const lines = [];
  lines.push("| Package | Use it for |");
  lines.push("| --- | --- |");
  for (const pkg of orderedPackages(manifest)) {
    lines.push(`| \`${pkg}\` | ${cell(PKG_PURPOSE[pkg] || "")} |`);
  }
  return lines.join("\n");
}

/**
 * The SKILL-CATALOGUE region (#87 / WP-10): the factual "list of things" inside the
 * hand-written skills/brand-ui/SKILL.md router — themes (+ default), token and
 * registry counts, and each package's component count with its routing purpose.
 * The count is {@link componentCounts} (one per component module), the number the
 * README and llms.txt print, so the three agree. A list, not a table: Prettier pads
 * a table's cells to the widest row, and the router has a byte budget.
 * Deterministic (orderedPackages, no timestamps).
 */
export function renderSkillCatalogue(manifest) {
  const pkgs = orderedPackages(manifest);
  const counts = pkgs.map((pkg) => componentCounts(manifest.packages[pkg] || {}).components);
  const total = counts.reduce((a, b) => a + b, 0);
  const lines = [];
  lines.push(
    // Consumer-clean: shipped skills must not name repo-internal paths (the
    // plugin:consumer-clean gate bans the `packages/` substring), so point at
    // PKG_PURPOSE by name only.
    "<!-- Generated from the manifest by `pnpm gen`; package purposes are PKG_PURPOSE in the CLI. -->",
  );
  lines.push("");
  lines.push(
    `**Themes (${(manifest.themes || []).length}):** ${themeLine(manifest)} · ` +
      `**Tokens:** ${manifest.tokenCount ?? 0} · ` +
      `**Registry blocks:** ${(manifest.registry || []).length} · ` +
      `**Components:** ${total} in ${pkgs.length} packages`,
  );
  lines.push("");
  pkgs.forEach((pkg, i) => lines.push(`- \`${pkg}\` (${counts[i]}): ${PKG_PURPOSE[pkg] || ""}`));
  lines.push("");
  lines.push(
    "_One count per component; `brand-ui docs <Component>` lists its parts (`CardHeader`, …)._",
  );
  return lines.join("\n");
}

/**
 * The D1–D7 answers for the skill router, from the same DECISIONS:SUMMARY region
 * {@link renderDecisionSummary} copies into CLAUDE.md/AGENTS.md. The detail-rule
 * column is dropped: it links repo-internal rule files a plugin user does not have.
 * @param {string} repoRoot
 */
export function renderSkillDecisions(repoRoot) {
  const rows = decisionSummaryBody(repoRoot)
    .split("\n")
    .filter((l) => /^\|\s*\*\*D\d+\*\*/.test(l))
    .map((l) =>
      l
        .replace(/^\|\s*|\s*\|$/g, "")
        .split(/\s+\|\s+/)
        .map((c) => c.trim()),
    );
  if (!rows.length)
    throw new Error("renderSkillDecisions: no D-rows in the DECISIONS:SUMMARY region");
  return [
    "<!-- Generated from the decision summary by `pnpm gen`; edit the decisions there. -->",
    "",
    ...rows.map(([id, question, answer]) => {
      const d = id.replaceAll("*", "");
      return answer === undefined ? `- **${d}** ${question}` : `- **${d} · ${question}** ${answer}`;
    }),
  ].join("\n");
}

// ---------------------------------------------------------------------------
// AGENT-OUTPUT CONTRACT — "how an agent structures output so @elabs-ai/components-ai renders it"
// Rendered from `manifest.agentOutput` (source: packages/cli/lib/agent-output.mjs)
// into BOTH skills/brand-ui/SKILL.md AND the Storybook page, so they can't
// diverge. MUST be MDX-safe: NO HTML comments, and every `<…>`/`{…}` lives
// inside a fenced code block or inline backticks (bare ones break the MDX
// indexer). Deterministic + Prettier-stable, like renderSkillCatalogue.
// ---------------------------------------------------------------------------
export function renderAgentOutputGuidance(manifest) {
  const ao = manifest.agentOutput;
  const lines = [];
  // A plain-markdown banner (NOT an HTML comment — that breaks MDX). The marker
  // comments around this region carry the "do not edit" contract for tooling.
  lines.push(
    // Consumer-clean: no repo-internal `packages/` path in shipped skill prose.
    "> **Generated** by `pnpm gen` from the CLI's agent-output module — edit there, " +
      "not here. The `gen:check` gate fails on drift.",
  );
  lines.push("");
  if (!ao || !ao.paths) {
    lines.push("_No agent-output contract in the manifest — run `pnpm gen`._");
    return lines.join("\n");
  }
  const { conversation: conv, jsxPreview: jsx, a2ui } = ao.paths;

  lines.push(
    "`@elabs-ai/components-ai` is a **presentation layer**: it renders a data model — your app owns the " +
      "model calls (D5). There is **no system prompt to copy**; there are two shipped output " +
      "shapes and a wiring pattern. Pick the path, emit the shape, let the components render it.",
  );
  lines.push("");

  // ── Decision guide (D2) ────────────────────────────────────────────────
  lines.push("### Which path (D2)");
  lines.push("");
  lines.push("| The agent is producing… | Emit | Status |");
  lines.push("| --- | --- | --- |");
  lines.push(
    `| A conversation (text, tools, reasoning, sources) | ${cell(conv.model)} | shipped |`,
  );
  lines.push(`| Ad-hoc UI as a JSX string | \`${cell(jsx.component)}\` | shipped (escape hatch) |`);
  lines.push(
    `| An agent-designed surface (UI as data) | \`${cell(a2ui.component)}\` | shipped (the safe generative path) |`,
  );
  lines.push("");
  lines.push(
    "_Mental model: AI SDK = what the agent **said**; A2UI = a screen the agent **designed**. " +
      'A chat that shows messages is still "build-with" — don\'t reach for generative UI just ' +
      "because there's a chatbox._",
  );
  lines.push("");

  // ── Path A — UIMessage ──────────────────────────────────────────────────
  lines.push(`### Path A · ${conv.title}`);
  lines.push("");
  lines.push(conv.summary);
  lines.push("");
  lines.push(`- **Authority:** ${conv.modelAuthority}`);
  lines.push(`- **brand-ui owns:** ${conv.owns}`);
  lines.push(`- **Roles** (\`Message from\`): ${conv.roles.map((r) => `\`${r}\``).join(" · ")}`);
  lines.push(`- **Rendered by:** ${conv.consumedBy.map((c) => `\`${c}\``).join(", ")}`);
  lines.push("");
  lines.push("| Part `type` | Rendered by | Notes |");
  lines.push("| --- | --- | --- |");
  for (const p of conv.parts) {
    lines.push(
      `| \`${cell(p.kind)}\` | ${p.consumedBy.map((c) => `\`${c}\``).join(", ")} | ${cell(p.note)} |`,
    );
  }
  lines.push("");
  // Tool specifics (typePattern + the state→status projection) — in prose, not a
  // table cell (the pattern contains `|`/`<`, which would break a table row).
  const tool = conv.parts.find((p) => p.kind === "tool");
  if (tool) {
    lines.push(
      `A **tool part** is typed \`${tool.typePattern}\` and carries ` +
        `${tool.consumesFields.map((f) => `\`${f}\``).join(", ")}. Its \`state\` maps onto the ` +
        "closed `@elabs-ai/components-ui` `Status` enum:",
    );
    lines.push("");
    lines.push("| Tool `state` | → `Status` |");
    lines.push("| --- | --- |");
    for (const [state, status] of Object.entries(tool.stateToStatus)) {
      lines.push(`| \`${cell(state)}\` | \`${cell(status)}\` |`);
    }
    lines.push("");
    lines.push(`_${tool.note}_`);
    lines.push("");
  }
  lines.push("The data the agent emits (a `UIMessage[]` — the AI SDK owns this shape):");
  lines.push("");
  lines.push("```ts");
  lines.push(conv.example);
  lines.push("```");
  lines.push("");
  lines.push(
    "Map each turn's parts onto the components (**in your app** — `@elabs-ai/components-ai` never calls the model):",
  );
  lines.push("");
  lines.push("```tsx");
  lines.push("{messages.map((m) => (");
  lines.push("  <Message key={m.id} from={m.role}>");
  lines.push("    <MessageContent>");
  lines.push("      {m.parts.map((part, i) => {");
  lines.push('        if (part.type === "reasoning")');
  lines.push("          return (");
  lines.push("            <Reasoning key={i}>");
  lines.push("              <ReasoningContent>{part.text}</ReasoningContent>");
  lines.push("            </Reasoning>");
  lines.push("          );");
  lines.push('        if (part.type.startsWith("tool-"))');
  lines.push("          return (");
  lines.push("            <Tool key={i}>");
  lines.push("              <ToolHeader type={part.type} state={part.state} />");
  lines.push("              <ToolContent>");
  lines.push("                <ToolInput input={part.input} />");
  lines.push("                <ToolOutput output={part.output} errorText={part.errorText} />");
  lines.push("              </ToolContent>");
  lines.push("            </Tool>");
  lines.push("          );");
  lines.push(
    '        if (part.type === "text") return <MessageResponse key={i}>{part.text}</MessageResponse>;',
  );
  lines.push("        return null;");
  lines.push("      })}");
  lines.push("    </MessageContent>");
  lines.push("  </Message>");
  lines.push("))}");
  lines.push("```");
  lines.push("");
  lines.push(`> ${conv.wiring}`);
  lines.push("");

  // ── Path B — JSXPreview ───────────────────────────────────────────────────
  lines.push(`### Path B · ${jsx.title}`);
  lines.push("");
  lines.push(jsx.summary);
  lines.push("");
  lines.push("| Prop | Type |");
  lines.push("| --- | --- |");
  for (const [prop, type] of Object.entries(jsx.props)) {
    // Backtick the type — a value like `Record<string, Component>` has a bare
    // `<…>` that the MDX indexer would parse as a JSX tag (this region ships into
    // an .mdx page too). Inline code keeps it literal in both Markdown and MDX.
    lines.push(`| \`${cell(prop)}\` | \`${cell(type)}\` |`);
  }
  lines.push("");
  lines.push(`- **Safety:** ${jsx.safety}`);
  lines.push(`- **Streaming:** ${jsx.streaming}`);
  lines.push("");
  lines.push("```tsx");
  lines.push(jsx.example);
  lines.push("```");
  lines.push("");
  lines.push(`> ${jsx.wiring}`);
  lines.push("");

  // ── Path C — A2UI ─────────────────────────────────────────────────────────
  lines.push(`### Path C · ${a2ui.title}`);
  lines.push("");
  lines.push(a2ui.summary);
  lines.push("");
  lines.push(`- **Protocol:** \`${a2ui.protocol}\``);
  lines.push("");
  lines.push("| Prop | Type |");
  lines.push("| --- | --- |");
  for (const [prop, type] of Object.entries(a2ui.props)) {
    lines.push(`| \`${cell(prop)}\` | \`${cell(type)}\` |`);
  }
  lines.push("");
  lines.push(`- **Safety:** ${a2ui.safety}`);
  lines.push(`- **Streaming:** ${a2ui.streaming}`);
  lines.push("- **Tooling:**");
  for (const t of a2ui.tooling) lines.push(`  - ${t}`);
  lines.push("");
  lines.push("```tsx");
  lines.push(a2ui.example);
  lines.push("```");
  lines.push("");
  lines.push(`> ${a2ui.wiring}`);
  lines.push("");

  // ── Wire into YOUR runtime ──────────────────────────────────────────────
  lines.push("### Wire it into YOUR runtime");
  lines.push("");
  lines.push(
    "The app owns the model. `useChat()` (from `ai`, **in your app**) gives you " +
      "`messages: UIMessage[]`; render them with Path A. To drive a tool-calling model, " +
      "assemble your tool definitions / prompt fragments **in your app** from " +
      "`brand-ui.manifest.json` (`agentOutput` + per-component `intent`) — brand-ui ships " +
      "the machine-readable contract; your app composes the prompt. Any runtime that produces " +
      "`UIMessage`-shaped data (or a JSX string) works — brand-ui is transport-agnostic.",
  );
  lines.push("");

  // ── DON'T ───────────────────────────────────────────────────────────────
  lines.push("### Don't");
  lines.push("");
  for (const d of ao.donts) lines.push(`- ${d}`);
  lines.push("");
  lines.push(
    "_Verify every component name/prop with `brand-ui docs <Component>` or the Storybook MCP — never guess._",
  );
  return lines.join("\n");
}
