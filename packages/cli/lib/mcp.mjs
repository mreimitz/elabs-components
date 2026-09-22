/**
 * @elabs-ai/components-cli — persistent `brand-ui mcp` stdio server (WP-03 #81).
 *
 * An always-on Model Context Protocol server that exposes the SAME engine
 * (lib/core.mjs) the CLI uses, so an agent gets brand-ui ground truth in ANY
 * session/harness WITHOUT booting Storybook (the Storybook addon-mcp only exists
 * while `pnpm storybook` runs). It is a thin TRANSPORT over the engine — the
 * manifest is the single source of truth; this module only renders it as MCP tool
 * results.
 *
 * DEPENDENCY-FREE on purpose: MCP's stdio transport is newline-delimited JSON-RPC
 * 2.0, which is small enough to implement directly. That keeps `@elabs-ai/components-cli`
 * dependency-light (it runs in any consuming project via `npx @elabs-ai/components-cli mcp`) and
 * keeps the protocol handler a PURE function (`handleMessage`) we can unit-test
 * without spawning a process.
 *
 * Tools: `info`, `search`, `docs`, `tokens`, `audit` — the read surface of the CLI.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  resolveDocsHit,
  apiFallbackPath,
  loadManifest,
  flat,
  matchPlaybooks,
  matchTemplates,
  matchCliVerbs,
  resolveTasteProfile,
  tasteSearchDirs,
} from "./core.mjs";
import { renderDocsBrief, smallerCard } from "./docs-brief.mjs";
import { searchExports, renderComponentArm, renderTypeArm } from "./search.mjs";
import { scanText } from "./audit.mjs";
import { matchChartFor, renderChartForText } from "./chart-for.mjs";
import {
  A2UI_EXAMPLE,
  a2uiCatalog,
  a2uiSchema,
  renderCatalogText,
  renderValidationText,
  validateSurface,
} from "./a2ui.mjs";

export const PROTOCOL_VERSION = "2024-11-05";

/**
 * Protocol revisions this server can speak, newest first. The tool surface is the
 * same in each; negotiating lets a Streamable-HTTP client (2025-03-26+) connect to
 * the hosted server without a downgrade warning.
 */
export const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", PROTOCOL_VERSION];

/**
 * Tools that read the caller's own disk. A hosted server cannot see that disk, so
 * `hosted` mode leaves these out of `tools/list` and refuses them by name.
 */
export const LOCAL_ONLY_TOOLS = new Set(["audit"]);
export const SERVER_INFO = { name: "brand-ui", version: "5.3.1" };

/**
 * Where a REMOTE caller can actually open what this server names.
 *
 * `search` answered with repo-relative paths ("docs/playbooks/dashboard.md ·
 * template templates/dashboard.tsx") — right for a developer inside the
 * monorepo, dead for an agent talking to elabs-ai.com, which has no such tree
 * (2026-09-17 review §4.2.2). Hosted answers therefore carry raw-GitHub URLs,
 * pinned to the release this server serves so a link never drifts to `main`.
 *
 * The ref is the CLI's own release tag, not `v<version>`: Changesets tags each
 * package (`@elabs-ai/components-cli@4.2.0`) and release.yml checks out exactly
 * that tag to deploy the hosted server, while the repo-wide `v4.2.0` tag does
 * not exist (`v4.1.0` was the last one) and would 404. `version-sync` keeps
 * SERVER_INFO.version equal to the published version.
 */
export const DOCS_SITE_URL = "https://elabs-ai.com";
const RELEASE_TAG = `@elabs-ai/components-cli@${SERVER_INFO.version}`;
const RAW_BASE = `https://raw.githubusercontent.com/mreimitz/elabs-components/${RELEASE_TAG}`;

/**
 * Where `npx shadcn@latest add <url>/<item>.json` resolves — the website's own `/r` route,
 * which is `registry/registry.json`'s `homepage` and the only place the registry is served.
 * A literal, not a runtime read of that file: this module ships inside the published
 * `@elabs-ai/components-cli` package and must work with no monorepo checkout on disk
 * (`npx @elabs-ai/components-cli mcp`), exactly like `DOCS_SITE_URL` above.
 */
export const REGISTRY_HOMEPAGE = "https://elabs-ai.com/r";

/** Playbook `template` paths are relative to the playbook folder. */
const PLAYBOOK_DIR = "docs/playbooks";
const templateRepoPath = (file) =>
  String(file).startsWith("docs/") ? String(file) : `${PLAYBOOK_DIR}/${file}`;

/** A repo path as the caller can open it: a raw URL when hosted, the path locally. */
const openablePath = (ctx, repoPath) =>
  ctx.hosted ? `${RAW_BASE}/${String(repoPath).replace(/^\/+/, "")}` : String(repoPath);

/**
 * The live Storybook docs page for a component, from the manifest's storyId.
 *
 * The DEFAULT link, hosted or not, is `<origin>/?path=/docs/<id>` — the form a Storybook host
 * answers directly. `ctx.siteRoutes` opts a caller into the SITE's own `/storybook/` route
 * instead, which is what the website's own `/mcp` passes. Both resolve on the public
 * addresses: the website 308-redirects `/?path=…` into `/storybook/?path=…`, so links emitted
 * by either branch keep working. `siteOrigin` defaults to the production site and is
 * overridable per request (hosted only — `ctx.siteOrigin`, sourced from the `SITE_ORIGIN` env
 * var in the hosted HTTP handler) so a preview reports its own origin.
 *
 * Local (stdio) ignores both `siteOrigin` and `siteRoutes` — always the production `/?path=`
 * link, byte-identical to before RM-100.
 */
const storyUrl = (storyId, ctx) => {
  const origin = (ctx?.hosted && ctx.siteOrigin) || DOCS_SITE_URL;
  return ctx?.hosted && ctx.siteRoutes
    ? `${origin}/storybook/?path=/docs/${storyId}`
    : `${origin}/?path=/docs/${storyId}`;
};

/**
 * The routine from the Storybook "Getting Started" page. `info` is the first
 * call an agent makes, so it is the one place a fresh session can be handed the
 * whole route instead of discovering it one tool at a time (review §4.2.4).
 */
const ROUTINE = [
  "the routine:",
  "  1. info                       — this call: packages, themes, taste profile",
  "  2. search <what you build>    — playbook + template + components for the screen",
  "  3. docs <Component>           — real props, variants, anti-patterns, import line, story link",
  "  4. build                      — semantic tokens only; never hardcode a colour",
  "  5. audit <path>               — locally: `npx -y @elabs-ai/components-cli audit <path>`",
  "  new app: `npx -y @elabs-ai/components-cli create <dir> --template dashboard` (runnable Vite app, tokens + ThemeProvider wired)",
  '  agent-designed screen (generative UI): a2ui catalog → emit { a2ui: "1", root } → a2ui validate → <A2uiSurface> renders it',
];

/** The tool catalogue advertised over `tools/list`. */
export const TOOLS = [
  {
    name: "info",
    description:
      "Project context: which @elabs-ai/components-* packages are present, the themes + default, the token count, the registry size, and the ACTIVE taste profile (register × density × motion × expressiveness). Call once at the start of a session.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "search",
    description:
      'Find components/hooks/registry items by name or package substring, archetype playbooks by free-text intent ("build a dashboard" → the dashboard playbook), and standalone CLI verbs (e.g. `a2ui catalog|schema|validate|example`). Use before writing UI — prefer an existing component, and start a whole screen from its playbook.',
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Name, concept, or whole-screen intent." },
        limit: {
          type: "integer",
          minimum: 1,
          description:
            "Components and types per page (default 40). Passing limit or offset pages the answer and ends each list with its nextOffset.",
        },
        offset: {
          type: "integer",
          minimum: 0,
          description:
            "Where the page starts (default 0); use the nextOffset a previous call returned.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "docs",
    description:
      "The real API for a component from the manifest: own-declared props (type/default/description), expanded cva variant values, per-component intent (purpose/relationships/anti-patterns), and resolved inherited props when enriched. Never guess props — call this.",
    inputSchema: {
      type: "object",
      properties: {
        component: { type: "string", description: "Exact component name, e.g. Button." },
        detail: {
          type: "string",
          enum: ["brief", "full"],
          description:
            '"full" is the default. On a large component, start with "brief" (DataTable: 14 KB → 6 KB): import line, purpose, anti-patterns, variants, own props with one-line descriptions. Where the brief card would not be smaller you get the full one.',
        },
      },
      required: ["component"],
      additionalProperties: false,
    },
  },
  {
    name: "tokens",
    description:
      "The theme/token summary: the available themes, the default theme, the base radius, and the semantic token count.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "audit",
    description:
      "Static token/style/anti-slop lint of a file or directory (raw colors, anti-patterns). Severities are judged against the active taste register (product = restrained default; brand softens the expressive tells). The rendered cross-theme + WCAG-contrast pass lives in the brand-ui-audit skill.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File or directory to audit." },
        register: {
          type: "string",
          enum: ["product", "brand"],
          description:
            "Override the active taste register. Omit to use the project's resolved profile.",
        },
      },
      required: ["path"],
      additionalProperties: false,
    },
  },
  {
    name: "chart_for",
    description:
      'Rank @elabs-ai/components-charts chart containers for a data shape ("weekday by hour ticket volume", "two time points per category", "OHLC"). Judges the shape FIRST, per the chart-selection rules — call this before picking a chart type by hand or hardcoding AutoChart\'s inference. Returns ranked candidates with the @dataShape text that matched and, when the container declared one, an avoidWhen note.',
    inputSchema: {
      type: "object",
      properties: {
        shape: {
          type: "string",
          description: 'Free text or shape keywords, e.g. "weekday by hour ticket volume".',
        },
      },
      required: ["shape"],
      additionalProperties: false,
    },
  },
  {
    name: "a2ui",
    description:
      'Generative UI (D2): an agent-designed screen as DATA, validated against the brand-ui catalog and rendered by <A2uiSurface> from @elabs-ai/components-ai. `catalog` lists the types you may emit (props, enums, events, children) or one type in full; `validate` checks a surface object and returns every problem with its path; `schema` returns the JSON Schema; `example` a starter surface. A surface is { "a2ui": "1", "root": node }; a node is a string or { type, props?, children?, on? }; interaction is on.<event> → { name, payload } which the host app receives in onAction.',
    inputSchema: {
      type: "object",
      properties: {
        verb: { type: "string", enum: ["catalog", "schema", "validate", "example"] },
        type: { type: "string", description: "catalog only: one catalog type, e.g. Button." },
        surface: { type: "object", description: "validate only: the surface to check." },
      },
      required: ["verb"],
      additionalProperties: false,
    },
  },
];

// ── JSON-RPC helpers ─────────────────────────────────────────────────────────

const result = (id, value) => ({ jsonrpc: "2.0", id, result: value });
const error = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });
const textContent = (text) => ({ content: [{ type: "text", text }] });

/**
 * The manifest for a request: an injected one (the hosted server bundles it)
 * wins, otherwise `loadManifest` reads the repo root's copy or, with no repo
 * root, the one packed alongside the CLI. Short-circuiting on a missing root
 * made `npx … mcp` answer "No manifest." in every app outside this monorepo.
 * @param {{ root?: string|null, manifest?: object|null }} ctx
 */
const manifestOf = (ctx) => ctx.manifest ?? loadManifest(ctx.root);

// ── tool implementations (reuse the engine; render compact text) ─────────────

function toolInfo(ctx) {
  const manifest = manifestOf(ctx);
  if (!manifest)
    return textContent(
      "No manifest — run inside the brand-ui monorepo or install @elabs-ai/components-cli.",
    );
  const pkgs = Object.keys(manifest.packages);
  const taste = activeTaste(ctx.root, manifest);
  const lines = [
    `packages (${pkgs.length}): ${pkgs.join(", ")}`,
    `themes (${(manifest.themes || []).length}): ${(manifest.themes || []).join(", ")}  · default: ${manifest.defaultTheme ?? "—"}`,
    `radius: ${manifest.radius ?? "—"} · tokens: ${manifest.tokenCount ?? 0} · registry items: ${(manifest.registry || []).length}`,
    `taste profile [${taste.source}]: register ${taste.register} · density ${taste.density} · motion ${taste.motion} · expressiveness ${taste.expressiveness} (the --decoration dial)`,
  ];
  if (ctx.hosted) {
    const origin = ctx.siteOrigin || DOCS_SITE_URL;
    // Same split as `storyUrl` above: a Storybook host serves neither `/storybook/` nor `/r`,
    // so only a caller that opts in (`ctx.siteRoutes` — the website's own route) reports them
    // relative to its own origin.
    const storybookEndpoint = ctx.siteRoutes ? `${origin}/storybook/` : origin;
    const registryEndpoint = ctx.siteRoutes ? `${origin}/r` : REGISTRY_HOMEPAGE;
    lines.push(
      "hosted server: the taste profile is the shipped default — it cannot read your project's brand-ui.config.json. Run `npx @elabs-ai/components-cli mcp` locally for your project's profile and the audit tool.",
      `endpoints: mcp ${origin}/mcp · llms ${origin}/llms.txt · storybook ${storybookEndpoint} · registry ${registryEndpoint}`,
    );
  }
  lines.push("", ...ROUTINE);
  return textContent(lines.join("\n"));
}

/**
 * The ACTIVE taste profile — shipped defaults ⊕ the nearest `brand-ui.config.json`,
 * searched from the audited TARGET first, then the cwd, then the repo root
 * (nearest wins). Passing the target is what lets `audit { path: "/some/app" }`
 * judge that app against ITS profile rather than the host repo's.
 */
function activeTaste(root, manifest, target = null) {
  return resolveTasteProfile({ manifest, dirs: tasteSearchDirs({ target, root }) });
}

function toolSearch(ctx, q, { limit, offset } = {}) {
  const query = String(q || "").toLowerCase();
  if (!query) return { ...textContent("usage: search { query }"), isError: true };
  // Paging (RM-129): only a call that passes limit or offset is paged, so the
  // default answer stays exactly what it was.
  const paged = limit !== undefined || offset !== undefined;
  const cap = limit ?? 40;
  const from = offset ?? 0;
  if (!Number.isInteger(cap) || cap < 1 || !Number.isInteger(from) || from < 0)
    return {
      ...textContent("usage: search { query, limit?: integer ≥ 1, offset?: integer ≥ 0 }"),
      isError: true,
    };
  const again = limit === undefined ? "" : `, limit: ${cap}`;
  const page = paged
    ? { offset: from, next: (n) => `nextOffset: ${n} (search { query, offset: ${n}${again} })` }
    : {};
  const manifest = manifestOf(ctx);
  if (!manifest) return { ...textContent("No manifest."), isError: true };
  // Same ranked search as the CLI's cmdSearch() (lib/search.mjs); components/hooks
  // and types/exports stay independently-truncated buckets (#86/#89).
  const result = searchExports(manifest, String(q || ""));
  const rows = result.rows;
  const typeRows = result.typeRows;
  const reg = (manifest.registry || []).filter((r) =>
    `${r.name} ${r.title} ${r.description}`.toLowerCase().includes(query),
  );
  const books = matchPlaybooks(manifest, query);
  // Whole-screen templates (#89) — wired here too so mcp__brand-ui__search,
  // the persistent/recommended MCP path, can reach screen-states/object-detail-hub
  // exactly like the CLI's `brand-ui search` can.
  const templates = matchTemplates(manifest, query);
  // CLI verbs (`a2ui`, …) — same arm as the CLI's cmdSearch()
  // (RM-088 follow-up 1, validator FAIL #1: `search a2ui` must surface the
  // `a2ui` verbs over MCP too, not just the CLI).
  const verbs = matchCliVerbs(manifest, query);
  // A remote caller has no repo to open `docs <Name>` against first — give it
  // the live story straight from search when the hit is a component with one
  // (review §4.4/wave-3). Local/stdio is unchanged: `docs` is the story-link call.
  const lines = renderComponentArm(query, result, cap, {
    storyLink: ctx.hosted ? (r) => (r.storyId ? storyUrl(r.storyId, ctx) : null) : undefined,
    ...page,
  });
  lines.push(...renderTypeArm(query, typeRows, cap, page));
  if (reg.length) {
    lines.push("", `Registry items matching "${query}":`);
    for (const r of reg) lines.push(`  ${r.name}  [${r.type}] — ${r.title}`);
  }
  // Playbooks (WP-09 #66/#84) — a whole-screen intent routes to its recipe.
  if (books.length) {
    lines.push("", `Playbooks matching "${query}" (start a WHOLE screen here):`);
    for (const p of books) {
      lines.push(`  ${p.archetype}  — ${p.intent}`);
      lines.push(`    ${openablePath(ctx, p.file)}`);
      if (p.template) lines.push(`    template ${openablePath(ctx, templateRepoPath(p.template))}`);
    }
  }
  if (templates.length) {
    lines.push("", `Templates matching "${query}":`);
    for (const t of templates) {
      lines.push(`  ${t.name}  (template)`);
      lines.push(`    ${openablePath(ctx, templateRepoPath(t.file))}`);
    }
  }
  if (verbs.length) {
    lines.push("", `CLI commands matching "${query}":`);
    for (const v of verbs) {
      lines.push(`  ${v.usage}`);
      lines.push(`    ${v.does}`);
    }
  }
  return textContent(lines.join("\n"));
}

/** Compact docs rendering from the manifest entry (the same data `brand-ui docs` prints). */
function renderDocsEntry(hit, ctx) {
  const lines = [`# ${hit.name}  (${hit.pkg})`];
  // The API without the usage was the gap: no import line, no link to the live
  // story (review §4.2.3). Both are printed for every caller — the loop only
  // closes if Storybook's Intent block and this output name each other.
  if (hit.kind === "component" || hit.kind === "hook")
    lines.push(`import: import { ${hit.name} } from "${hit.importPath || hit.pkg}";`);
  else if (hit.importPath) lines.push(`import from: ${hit.importPath}`);
  if (hit.storyId) lines.push(`story: ${storyUrl(hit.storyId, ctx)}`);
  // A one-line usage snippet, ONLY when the manifest already carries one for
  // this component (never fabricated — review §4.4/wave-3 "do not invent").
  // No current manifest source populates `usage` yet; this is the read side
  // of that future field.
  if (hit.usage) lines.push(`usage: ${hit.usage}`);
  if (ctx?.root) lines.push(`source: ${hit.module}`);
  if (hit.alsoExportedFrom?.length)
    lines.push(
      `also exported from: ${hit.alsoExportedFrom.join(", ")}  (same component — docs { component: "<pkg>/${hit.name}" } reads that one)`,
    );
  const intent = hit.intent;
  if (intent) {
    if (intent.purpose)
      lines.push(`purpose: ${intent.purpose}${intent.category ? `  [${intent.category}]` : ""}`);
    const rel = intent.relationships || {};
    for (const [label, key] of [
      ["used inside", "usedInside"],
      ["contains", "contains"],
      ["pairs with", "pairsWith"],
      ["avoid next to", "avoidNextTo"],
    ])
      if (rel[key]?.length) lines.push(`  ${label}: ${rel[key].join(", ")}`);
    if (intent.antiPatterns?.length) {
      lines.push("anti-patterns (avoid):");
      for (const ap of intent.antiPatterns) lines.push(`  x ${ap}`);
    }
  }
  if (hit.props) {
    if (hit.props.extends?.length) lines.push(`extends: ${hit.props.extends.join(", ")}`);
    if (hit.props.props?.length) {
      lines.push("props (own-declared):");
      for (const p of hit.props.props) {
        const req = p.optional ? "?" : "";
        const def = p.defaultValue !== undefined ? `  = ${p.defaultValue}` : "";
        const desc = p.description ? `  — ${p.description}` : "";
        lines.push(`  ${p.name}${req}: ${p.type}${def}${desc}`);
      }
    }
    const resolved = hit.props.resolved;
    if (resolved && Object.keys(resolved).length) {
      lines.push("props (inherited, resolved):");
      for (const name of Object.keys(resolved).sort((a, b) => a.localeCompare(b))) {
        const r = resolved[name];
        const req = r.optional === false ? "" : "?";
        const type = r.type ? `: ${r.type}` : "";
        const def = r.defaultValue !== undefined ? `  = ${r.defaultValue}` : "";
        const desc = r.description ? `  — ${r.description}` : "";
        lines.push(`  ${name}${req}${type}${def}${desc}`);
      }
    }
  }
  if (hit.variants?.variants) {
    lines.push("variants (expanded from cva — the real values):");
    for (const [group, values] of Object.entries(hit.variants.variants)) {
      const def = hit.variants.defaultVariants?.[group];
      lines.push(
        `  ${group}: ${values.map((v) => (v === def ? `${v} (default)` : v)).join(" | ")}`,
      );
    }
  }
  return lines.join("\n");
}

function toolDocs(ctx, component, detail = "full") {
  const name = String(component || "");
  if (!name) return { ...textContent("usage: docs { component }"), isError: true };
  const manifest = manifestOf(ctx);
  if (!manifest) return { ...textContent("No manifest."), isError: true };
  const { hit, alternatives } = resolveDocsHit(flat(manifest), name);
  if (!hit) return textContent(`${name} not found. Try the search tool with "${name}".`);
  if (alternatives.length) hit.alsoExportedFrom = alternatives;
  const full = renderDocsEntry(hit, ctx);
  if (detail === "brief")
    return textContent(
      smallerCard(
        renderDocsBrief(hit, { storyUrl: (id) => storyUrl(id, ctx), repoRoot: ctx?.root ?? null }),
        full,
      ),
    );
  return textContent(full);
}

function toolTokens(ctx) {
  const manifest = manifestOf(ctx);
  if (!manifest) return { ...textContent("No manifest."), isError: true };
  const lines = [
    `themes (${(manifest.themes || []).length}): ${(manifest.themes || []).join(", ")}`,
    `default theme: ${manifest.defaultTheme ?? "—"}`,
    `base radius: ${manifest.radius ?? "—"}`,
    `semantic token count: ${manifest.tokenCount ?? 0}`,
    "Use semantic token utilities only (bg-background, text-muted-foreground, …); never raw hex outside themes.css.",
  ];
  return textContent(lines.join("\n"));
}

/** Walk a directory for auditable source files (mirrors the CLI's audit walk). */
function walkFiles(dir, acc) {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e === ".git" || e === "dist" || e === "storybook-static") continue;
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) walkFiles(p, acc);
    else if (/\.(tsx|jsx|css|html)$/.test(e)) acc.push(p);
  }
  return acc;
}

function toolAudit(ctx, targetPath, registerOverride) {
  const target = String(targetPath || "");
  if (!target) return { ...textContent("usage: audit { path }"), isError: true };
  const abs = resolve(target);
  if (!existsSync(abs)) return { ...textContent(`not found: ${target}`), isError: true };
  const files = statSync(abs).isDirectory() ? walkFiles(abs, []) : [abs];
  const taste = activeTaste(ctx.root, manifestOf(ctx), abs);
  const register =
    registerOverride === "brand" || registerOverride === "product"
      ? registerOverride
      : taste.register;
  const findings = [];
  for (const f of files) {
    const isCss = f.endsWith(".css");
    const isThemeFile = /themes\.css$/.test(f);
    const text = readFileSync(f, "utf8");
    for (const hit of scanText(text, { isCss, isThemeFile, register }))
      findings.push({ file: f, ...hit });
  }
  const header = `judged against register: ${register}`;
  if (!findings.length)
    return textContent(`audit: ${files.length} file(s) clean — no violations. (${header})`);
  // Content slop is its own bucket, never folded into "advisory": in GENERATED
  // output it blocks "done" (mirrors `brand-ui audit --strict`).
  const contentSlop = findings.filter((f) => f.category === "content-slop").length;
  const blocking = findings.filter((f) => !f.advisory && f.category !== "content-slop").length;
  const advisory = findings.length - contentSlop - blocking;
  const lines = [
    `audit: ${findings.length} finding(s) across ${files.length} file(s) — ` +
      `${blocking} blocking style, ${contentSlop} content-slop (blocking in generated output), ` +
      `${advisory} advisory. (${header})`,
  ];
  for (const f of findings.slice(0, 100))
    lines.push(
      `  ${f.file}:${f.line ?? "?"}  ${f.rule}${f.category === "content-slop" ? " (content slop)" : f.advisory ? " (advisory)" : ""}: ${f.msg}`,
    );
  if (findings.length > 100) lines.push(`  …and ${findings.length - 100} more.`);
  return textContent(lines.join("\n"));
}

function toolChartFor(ctx, shape) {
  const query = String(shape || "");
  if (!query) return { ...textContent("usage: chart_for { shape }"), isError: true };
  const manifest = manifestOf(ctx);
  if (!manifest) return { ...textContent("No manifest."), isError: true };
  const candidates = matchChartFor(manifest, query);
  return textContent(renderChartForText(query, candidates));
}

function toolA2ui(verb, type, surface) {
  switch (verb) {
    case "catalog": {
      if (type && !a2uiCatalog(type))
        return { ...textContent(renderCatalogText(a2uiCatalog(), type)), isError: true };
      return textContent(renderCatalogText(a2uiCatalog(), type));
    }
    case "schema":
      return textContent(JSON.stringify(a2uiSchema(), null, 2));
    case "example":
      return textContent(JSON.stringify(A2UI_EXAMPLE, null, 2));
    case "validate": {
      if (!surface || typeof surface !== "object")
        return {
          ...textContent("usage: a2ui { verb: 'validate', surface: { … } }"),
          isError: true,
        };
      const result = validateSurface(surface);
      return { ...textContent(renderValidationText("surface", result)), isError: !result.ok };
    }
    default:
      return {
        ...textContent("usage: a2ui { verb: catalog|schema|validate|example }"),
        isError: true,
      };
  }
}

function callTool(ctx, name, argsObj = {}) {
  if (ctx.hosted && LOCAL_ONLY_TOOLS.has(name))
    return {
      ...textContent(
        `${name} reads files on your machine, which the hosted server cannot see. Run \`npx @elabs-ai/components-cli mcp\` locally to use it.`,
      ),
      isError: true,
    };
  switch (name) {
    case "info":
      return toolInfo(ctx);
    case "search":
      return toolSearch(ctx, argsObj.query, { limit: argsObj.limit, offset: argsObj.offset });
    case "docs":
      return toolDocs(ctx, argsObj.component, argsObj.detail);
    case "tokens":
      return toolTokens(ctx);
    case "audit":
      return toolAudit(ctx, argsObj.path, argsObj.register);
    case "chart_for":
      return toolChartFor(ctx, argsObj.shape);
    case "a2ui":
      return toolA2ui(argsObj.verb, argsObj.type, argsObj.surface);
    default:
      return null; // unknown tool → caller emits an MCP error
  }
}

/**
 * The PURE protocol handler: one JSON-RPC request in, one response out (or `null`
 * for notifications, which get no reply). Spawning a process is unnecessary to
 * exercise this — the stdio loop (`runMcpServer`) is a thin wrapper that only does
 * line framing + I/O. `root` is the repo root (the engine's data source);
 * `manifest` injects the manifest instead of reading it from `root`; `hosted`
 * drops the tools that need the caller's disk (LOCAL_ONLY_TOOLS). `siteOrigin`
 * is where a HOSTED caller's URLs (story links, `info`'s endpoints) point;
 * `siteRoutes` opts those URLs into the `/storybook/` + `/r` forms for a caller
 * whose site actually serves them (RM-105 — false today, no live site does yet).
 * Both are unused when `hosted` is false, so the stdio server's output is unchanged.
 * @param {{ root?: string|null, manifest?: object|null, hosted?: boolean, siteOrigin?: string|null, siteRoutes?: boolean }} [opts]
 * @returns {object|null}
 */
export function handleMessage(
  msg,
  { root = null, manifest = null, hosted = false, siteOrigin = null, siteRoutes = false } = {},
) {
  if (!msg || typeof msg !== "object") return error(null, -32600, "Invalid Request");
  const { id, method, params } = msg;
  const ctx = { root, manifest, hosted, siteOrigin, siteRoutes };
  const isNotification = id === undefined || id === null;

  switch (method) {
    case "initialize":
      return result(id, {
        protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(params?.protocolVersion)
          ? params.protocolVersion
          : PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
    case "notifications/initialized":
    case "initialized":
      return null; // notification — no response
    case "ping":
      return result(id, {});
    case "tools/list":
      return result(id, {
        tools: hosted ? TOOLS.filter((t) => !LOCAL_ONLY_TOOLS.has(t.name)) : TOOLS,
      });
    case "tools/call": {
      const name = params?.name;
      const out = callTool(ctx, name, params?.arguments || {});
      if (out === null) return error(id, -32602, `Unknown tool: ${name}`);
      return result(id, out);
    }
    default:
      if (isNotification) return null; // ignore unknown notifications
      return error(id, -32601, `Method not found: ${method}`);
  }
}

/**
 * The stdio transport loop: read newline-delimited JSON-RPC from stdin, dispatch
 * via `handleMessage`, write newline-delimited JSON-RPC responses to stdout.
 * Used by `brand-ui mcp`. Resolves when stdin closes.
 * @param {{ root?: string, input?: NodeJS.ReadableStream, output?: NodeJS.WritableStream }} [opts]
 */
export function runMcpServer({ root, input = process.stdin, output = process.stdout } = {}) {
  return new Promise((resolveDone) => {
    let buffer = "";
    const send = (obj) => obj && output.write(`${JSON.stringify(obj)}\n`);
    input.setEncoding?.("utf8");
    input.on("data", (chunk) => {
      buffer += chunk;
      let nl;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          send(error(null, -32700, "Parse error"));
          continue;
        }
        send(handleMessage(msg, { root }));
      }
    });
    input.on("end", () => resolveDone());
    input.on("close", () => resolveDone());
  });
}
