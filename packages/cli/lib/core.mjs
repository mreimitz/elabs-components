/**
 * @elabs-ai/components-cli — core logic (dependency-free).
 *
 * The deterministic backend the brand-ui skills lean on. Keeps the skills thin:
 * the skill teaches judgment + rules, this reads the actual code so the agent
 * never guesses what exists or what props a component takes.
 */
import { readFileSync, existsSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { collectIntent } from "./intent.mjs";
import { collectAgentOutput } from "./agent-output.mjs";
import { mergeResolvedProps } from "./docgen.mjs";

const CONFIG_PKGS = new Set([
  "@elabs-ai/components-eslint-config",
  "@elabs-ai/components-typescript-config",
  "@elabs-ai/components-cli",
]);

/** Walk up from `start` until we find the monorepo root (pnpm-workspace.yaml). */
export function findRepoRoot(start = process.cwd()) {
  let dir = resolve(start);
  for (let i = 0; i < 12; i++) {
    if (existsSync(join(dir, "pnpm-workspace.yaml")) && existsSync(join(dir, "packages"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function read(file) {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

/** Resolve a relative import (no extension) to an on-disk source file. */
function resolveModule(fromDir, rel) {
  const base = resolve(fromDir, rel);
  const candidates = [base + ".tsx", base + ".ts", join(base, "index.tsx"), join(base, "index.ts")];
  return candidates.find((c) => existsSync(c)) || null;
}

/**
 * Read a package's `exports` map and return the subpath barrels to crawl —
 * i.e. every key OTHER than the `.` root barrel (already crawled) that points at
 * a `.ts`/`.tsx` source. Each entry is { subpath: "./markdown", file: "<abs>" }
 * so callers can tag exports with the subpath consumers actually import from
 * (e.g. `@elabs-ai/components-editor/markdown/frontmatter#parseFrontmatter`). Non-source
 * targets (`./styles.css`) are skipped — they carry no TS exports.
 *
 * `./test` (and any subpath ENDING in `/test`, e.g. a future `@elabs-ai/components-ai/test`)
 * is deliberately EXCLUDED from the crawl — architect decision recorded in issue
 * #364's design record. `brand-ui.manifest.json` is the agent-facing BUILD-WITH
 * catalogue (`.claude/rules/storybook-mcp.md`: "brand-ui MCP to know what exists
 * and how to use it"); listing a second `LineChart` under a `/test` import path
 * would cause exactly the hallucination the manifest exists to prevent — an
 * agent importing a jsdom test double into product code. A `/test` subpath is
 * discoverable instead via its package's `.claude/rules/*.md` "Test double"
 * section, its README, and the "Testing … in jsdom" Storybook doc page.
 */
function readSubpathBarrels(pkgDir, exportsMap) {
  if (!exportsMap || typeof exportsMap !== "object") return [];
  const out = [];
  for (const [subpath, target] of Object.entries(exportsMap)) {
    if (subpath === ".") continue; // root barrel — crawled separately
    if (subpath === "./test" || subpath.endsWith("/test")) continue; // see the doc comment above
    // A subpath value is either a string or a conditions object ({ types, default, ... }).
    const candidates =
      typeof target === "string"
        ? [target]
        : Object.values(target).filter((v) => typeof v === "string");
    const src = candidates.find((c) => /\.tsx?$/.test(c));
    if (!src) continue; // e.g. "./styles.css" — no TS exports to harvest
    const file = resolve(pkgDir, src);
    if (existsSync(file)) out.push({ subpath, file });
  }
  return out;
}

/** Collect + de-dupe (prefer value kind) a barrel's exports, sorted by name. */
function collectBarrelExports(barrel, repoRoot) {
  const byName = new Map();
  for (const e of collectExports(barrel, repoRoot)) {
    const prev = byName.get(e.name);
    if (!prev || (prev.kind === "type" && e.kind === "value")) byName.set(e.name, e);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Shape a de-duped export list into the manifest's component/hook/type buckets. */
function bucketExports(all) {
  return {
    components: all.filter((e) => e.kind === "value" && /^[A-Z]/.test(e.name)),
    hooks: all.filter((e) => e.kind === "value" && /^use[A-Z]/.test(e.name)),
    types: all.filter((e) => e.kind === "type").map((e) => e.name),
    otherExports: all
      .filter((e) => e.kind === "value" && /^[a-z]/.test(e.name) && !/^use[A-Z]/.test(e.name))
      .map((e) => e.name),
  };
}

/**
 * Collect the exported identifiers of a TS module, resolving `export * from`
 * one or two levels deep. Returns [{ name, kind: "value"|"type", module }].
 */
function collectExports(file, repoRoot, seen = new Set(), depth = 0) {
  if (!file || seen.has(file) || depth > 3) return [];
  seen.add(file);
  const src = read(file);
  if (!src) return [];
  const out = [];
  const modRel = file.replace(repoRoot + "/", "");
  const dir = dirname(file);

  // export * from "./x"
  for (const m of src.matchAll(/export\s+\*\s+from\s+['"]([^'"]+)['"]/g)) {
    const target = resolveModule(dir, m[1]);
    out.push(...collectExports(target, repoRoot, seen, depth + 1));
  }
  // export { A, B as C } from "./x"  AND  export { A, B }
  for (const m of src.matchAll(
    /export\s+(type\s+)?\{([\s\S]*?)\}\s*(?:from\s*['"]([^'"]+)['"])?/g,
  )) {
    const isType = Boolean(m[1]);
    // When re-exported `from "./x"`, attribute the declaration to that target
    // file (so `docs Button` finds ButtonProps in button.tsx, not the barrel).
    let sourceRel = modRel;
    if (m[3]) {
      const target = resolveModule(dir, m[3]);
      if (target) sourceRel = target.replace(repoRoot + "/", "");
    }
    const names = m[2]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const asMatch = s.match(/\bas\s+([A-Za-z0-9_$]+)/);
        return (asMatch ? asMatch[1] : s).replace(/\s+/g, "");
      })
      .filter((n) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(n) && n !== "type");
    for (const name of names)
      out.push({ name, kind: isType ? "type" : "value", module: sourceRel });
  }
  // export const/function/class X
  for (const m of src.matchAll(
    /export\s+(?:declare\s+)?(?:const|function|class|let|var)\s+([A-Za-z0-9_$]+)/g,
  )) {
    out.push({ name: m[1], kind: "value", module: modRel });
  }
  // export type/interface X
  for (const m of src.matchAll(/export\s+(?:type|interface)\s+([A-Za-z0-9_$]+)/g)) {
    out.push({ name: m[1], kind: "type", module: modRel });
  }
  return out;
}

/** Parse the theme stylesheet SET for theme names, token names, and the palette. */
function parseTokens(repoRoot) {
  const engineFile = join(repoRoot, "packages/tokens/src/themes.css");
  const engine = read(engineFile);
  if (!engine) return { themes: [], tokens: [], radius: null };
  // ADR 0029 moved each reference theme's block OUT of the engine stylesheet
  // into its own opt-in file (`src/themes/<name>.css`); themes.css keeps
  // `:root`, the Tailwind bridge and the dials. A reader that still opens only
  // themes.css does not fail — it silently reports FEWER themes, which is how
  // the manifest came to list `dark` alone (and that one only because a
  // `@custom-variant` line happens to mention the attribute).
  const themesDir = join(repoRoot, "packages/tokens/src/themes");
  const themeFiles = existsSync(themesDir)
    ? readdirSync(themesDir)
        .filter((f) => f.endsWith(".css"))
        .sort()
        .map((f) => join(themesDir, f))
    : [];
  let css = [engine, ...themeFiles.map((f) => read(f) ?? "")].join("\n");
  // Strip CSS comments so example snippets ([data-theme="acme"], "...") in the
  // file header don't leak into the theme list.
  css = css.replace(/\/\*[\s\S]*?\*\//g, "");
  // The user-selectable themes are the `[data-theme="…"]` BLOCKS — the trailing
  // `{` is load-bearing. The bare attribute also appears inside
  // `@custom-variant dark (&:where([data-theme="dark"], …))`, a Tailwind variant
  // declaration and not a theme; counting it made a missing theme block look
  // like a present one.
  // `:root` holds a neutral light BASE/fallback (not a selectable theme), so it
  // is NOT listed.
  const themes = [];
  for (const m of css.matchAll(/\[data-theme="([^"]+)"\]\s*\{/g)) {
    const name = m[1];
    if (name === "..." || themes.includes(name)) continue;
    themes.push(name);
  }
  // tokens from the :root block (first { ... })
  const rootBlock = css.slice(css.indexOf(":root"), css.indexOf("}", css.indexOf(":root")));
  const tokens = [...rootBlock.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]);
  const radiusMatch = rootBlock.match(/--radius\s*:\s*([^;]+);/);
  return {
    themes,
    tokens: [...new Set(tokens)],
    radius: radiusMatch ? radiusMatch[1].trim() : null,
  };
}

function parseDefaultTheme(repoRoot) {
  const t = read(join(repoRoot, "packages/tokens/src/theme-types.ts"));
  const m = t && t.match(/DEFAULT_THEME[^=]*=\s*['"]([^'"]+)['"]/);
  return m ? m[1] : null;
}

// ---- taste profile (#72 / #108) --------------------------------------------
// The four taste axes — register × density × motion × expressiveness — as data
// the tooling can READ, not prose it has to be told. The vocabulary + the
// restrained defaults are parsed straight out of `theme-types.ts` (the single
// source of truth in @…-tokens), so the manifest can never drift from the types.
// `expressiveness` IS the decoration dial (0–10); there is deliberately no
// fourth CSS variable — see docs/ADR/0020-taste-profile.md.

/** The fallback profile when theme-types.ts / the manifest can't be read. */
export const FALLBACK_TASTE_PROFILE = {
  register: "product",
  density: "comfortable",
  motion: "system",
  expressiveness: 0,
};

/** `NAME = ["a", "b"] as const` → ["a","b"] (or null). */
function parseStringTuple(src, name) {
  const m = src.match(new RegExp(`${name}\\s*=\\s*\\[([^\\]]*)\\]`));
  if (!m) return null;
  const values = [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]);
  return values.length ? values : null;
}

/** `NAME: Type = "value"` → "value" (or null). */
function parseStringConst(src, name) {
  const m = src.match(new RegExp(`${name}\\s*(?::[^=]+)?=\\s*['"]([^'"]+)['"]`));
  return m ? m[1] : null;
}

/** `NAME: Type = 0` → 0 (or null). */
function parseNumberConst(src, name) {
  const m = src.match(new RegExp(`${name}\\s*(?::[^=]+)?=\\s*(-?\\d+)`));
  return m ? Number(m[1]) : null;
}

/**
 * The taste vocabulary + restrained defaults, parsed from `theme-types.ts`.
 * Shape: `{ axes: { register:[], density:[], motion:[], expressiveness:{…} },
 * defaults: { register, density, motion, expressiveness }, expressivenessDial }`.
 */
export function parseTaste(repoRoot) {
  const src = read(join(repoRoot, "packages/tokens/src/theme-types.ts")) ?? "";
  const registers = parseStringTuple(src, "TASTE_REGISTERS") ?? ["product", "brand"];
  const densities = parseStringTuple(src, "DENSITIES") ?? ["compact", "comfortable", "spacious"];
  const motions = parseStringTuple(src, "MOTION_PREFERENCES") ?? ["system", "reduced", "full"];
  return {
    axes: {
      register: registers,
      density: densities,
      motion: motions,
      // The expressiveness axis IS the decoration dial — same values, one knob.
      expressiveness: { min: 0, max: 10, dial: "--decoration" },
    },
    defaults: {
      register: parseStringConst(src, "DEFAULT_TASTE_REGISTER") ?? FALLBACK_TASTE_PROFILE.register,
      density: parseStringConst(src, "DEFAULT_DENSITY") ?? FALLBACK_TASTE_PROFILE.density,
      motion: parseStringConst(src, "DEFAULT_MOTION_PREFERENCE") ?? FALLBACK_TASTE_PROFILE.motion,
      expressiveness:
        parseNumberConst(src, "DEFAULT_DECORATION_LEVEL") ?? FALLBACK_TASTE_PROFILE.expressiveness,
    },
    // Recorded so a reader never mints a second knob for "expressiveness".
    expressivenessDial: "--decoration",
  };
}

/** Read an optional consumer-root `brand-ui.config.json`; `{}` when absent/broken. */
function readTasteConfig(dir) {
  if (!dir) return {};
  const raw = read(join(dir, "brand-ui.config.json"));
  if (!raw) return {};
  try {
    const json = JSON.parse(raw);
    const taste = json && typeof json === "object" ? json.taste : null;
    return taste && typeof taste === "object" && !Array.isArray(taste) ? taste : {};
  } catch {
    return {}; // a malformed config must never break `info` — fall back to defaults
  }
}

/** The nearest ancestor of `target` (inclusive) carrying a `brand-ui.config.json`. */
function nearestTasteConfigDir(target) {
  if (!target) return null;
  const abs = resolve(target);
  let dir = existsSync(abs) && statSync(abs).isDirectory() ? abs : dirname(abs);
  for (let i = 0; i < 24; i++) {
    if (existsSync(join(dir, "brand-ui.config.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * The dirs `resolveTasteProfile` should consult, in ASCENDING precedence order
 * (later wins, matching the loop below).
 *
 * The precedence is **nearest-to-the-subject wins**: the config that sits with the
 * code being judged beats the shell's cwd, which beats the monorepo root. Without
 * the target leg, `brand-ui audit /some/app` run from the monorepo silently judged
 * the app against the MONOREPO's profile — i.e. it ignored the very
 * `brand-ui.config.json` the new-app scaffold writes next to the generated app.
 *
 * @param {{ target?: string|null, cwd?: string, root?: string|null }} opts
 * @returns {string[]}
 */
export function tasteSearchDirs({ target = null, cwd = process.cwd(), root = null } = {}) {
  const dirs = [];
  // Last write wins, so re-position a repeat rather than dropping it.
  const push = (d) => {
    if (!d) return;
    const i = dirs.indexOf(d);
    if (i !== -1) dirs.splice(i, 1);
    dirs.push(d);
  };
  push(root);
  push(cwd);
  push(nearestTasteConfigDir(target));
  return dirs;
}

/**
 * Resolve the ACTIVE taste profile: the shipped defaults, overridden by a
 * project's optional `brand-ui.config.json` `taste` key. Unknown keys and
 * out-of-vocabulary values are IGNORED (never a hard error) — a typo degrades to
 * the restrained default and is reported in `sources`, so the audit still runs.
 *
 * `dirs` is ascending-precedence (later wins) — build it with `tasteSearchDirs`
 * so the config nearest the audited code wins over the cwd/repo root.
 *
 * @param {{ manifest?: object|null, taste?: object|null, dirs?: string[] }} opts
 * @returns {{ register, density, motion, expressiveness, source: "config"|"default", invalid: string[] }}
 */
export function resolveTasteProfile({ manifest = null, taste = null, dirs = [] } = {}) {
  const spec = taste ?? manifest?.taste ?? null;
  const axes = spec?.axes ?? {
    register: ["product", "brand"],
    density: ["compact", "comfortable", "spacious"],
    motion: ["system", "reduced", "full"],
  };
  const profile = { ...FALLBACK_TASTE_PROFILE, ...(spec?.defaults ?? {}) };
  const invalid = [];
  let source = "default";
  for (const dir of dirs.filter(Boolean)) {
    const cfg = readTasteConfig(dir);
    for (const [key, value] of Object.entries(cfg)) {
      if (key === "expressiveness") {
        if (Number.isInteger(value) && value >= 0 && value <= 10) {
          profile.expressiveness = value;
          source = "config";
        } else invalid.push(`expressiveness=${JSON.stringify(value)}`);
        continue;
      }
      const vocab = axes[key];
      if (!Array.isArray(vocab)) continue; // unknown key — ignore, additively
      if (vocab.includes(value)) {
        profile[key] = value;
        source = "config";
      } else invalid.push(`${key}=${JSON.stringify(value)}`);
    }
  }
  return { ...profile, source, invalid };
}

function loadRegistry(repoRoot) {
  const raw = read(join(repoRoot, "registry/registry.json"));
  if (!raw) return [];
  try {
    const json = JSON.parse(raw);
    const items = json.items || json.registry || [];
    return items.map((i) => ({
      name: i.name,
      type: i.type,
      title: i.title || "",
      description: i.description || "",
    }));
  } catch {
    return [];
  }
}

/**
 * The full-screen archetype templates (dashboard, settings, …). The single
 * source of truth is the Storybook stories (packages/<pkg>/src/templates-<name>
 * .stories.tsx); `pnpm gen:templates` derives both the consumer source under
 * `docs/playbooks/templates/<name>.tsx` AND the `index.json` read here, so the
 * manifest (shipped in the plugin AND the agent kit) is the single discovery
 * surface for templates. Absent index → empty array (graceful; gen ran before
 * manifest in the release/agent-docs pipelines).
 */
function loadTemplates(repoRoot) {
  const raw = read(join(repoRoot, "docs/playbooks/templates/index.json"));
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((t) => ({
      name: t.name,
      title: t.title || "",
      description: t.description || "",
      packages: Array.isArray(t.packages) ? t.packages : [],
      sourceStory: t.sourceStory || "",
      file: t.file || "",
    }));
  } catch {
    return [];
  }
}

// ---- playbooks (WP-09 #66 / #84) -------------------------------------------
// The archetype composition recipes under `docs/playbooks/*.md`. They existed but
// were INVISIBLE to every agent-discovery surface (no manifest entry, no context
// section, no `search` hit) — so an agent asked to "build a dashboard" never found
// dashboard.md. The playbook's own YAML front matter is the source of truth; this
// reader folds it into the manifest so `search`, `context` and the MCP server all
// answer from one place. Adding docs/playbooks/<a>.md + front matter is the ONLY
// manual step; `pnpm playbooks:check` fails when the manifest wasn't regenerated.

/**
 * Parse a leading `--- … ---` YAML front-matter block. Deliberately a dependency-free
 * SUBSET reader (the repo's gates are dependency-light): scalars, flow sequences
 * (`[a, b]`, possibly wrapped across lines by Prettier) and block sequences
 * (`- a`). Quotes are stripped; anything else is returned verbatim as a scalar.
 *
 * @param {string} text  the full file contents
 * @returns {{ data: Record<string, string|string[]>, body: string }}
 */
export function parseFrontMatter(text) {
  const src = text.replace(/^﻿/, "");
  if (!src.startsWith("---")) return { data: {}, body: src };
  const end = src.indexOf("\n---", 3);
  if (end === -1) return { data: {}, body: src };
  const block = src.slice(src.indexOf("\n") + 1, end);
  const body = src.slice(src.indexOf("\n", end + 1) + 1);
  const unquote = (s) =>
    s
      .trim()
      .replace(/^["']|["']$/g, "")
      .trim();
  const splitFlow = (inner) => splitTopLevel(inner).map(unquote).filter(Boolean);

  const lines = block.split("\n");
  const data = {};
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    if (/^\s/.test(line)) continue; // continuation — consumed by its key below
    const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let rest = m[2].trim();
    // Flow sequence, possibly spread over following indented lines.
    const startsFlow = rest.startsWith("[");
    if (rest === "" || startsFlow) {
      let buf = rest;
      let j = i;
      while (
        j + 1 < lines.length &&
        /^\s+\S/.test(lines[j + 1]) &&
        (startsFlow ? !buf.includes("]") : true)
      ) {
        j++;
        buf += (buf ? " " : "") + lines[j].trim();
        if (!startsFlow && !buf.trim().startsWith("-") && !buf.trim().startsWith("[")) break;
      }
      const consumed = buf.trim();
      if (consumed.startsWith("[")) {
        data[key] = splitFlow(consumed.slice(1, consumed.lastIndexOf("]")));
        i = j;
        continue;
      }
      if (consumed.startsWith("-")) {
        data[key] = consumed
          .split(/\s+-\s+|^-\s+/)
          .map(unquote)
          .filter(Boolean);
        i = j;
        continue;
      }
      if (rest === "") continue; // key with nothing usable under it
    }
    data[key] = unquote(rest);
  }
  return { data, body };
}

/** Coerce a front-matter value to a string array (a lone scalar becomes one entry). */
function toList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

/**
 * Read every archetype playbook under `docs/playbooks/*.md` (skipping README.md and
 * the generated `templates/` dir) into the manifest's `playbooks` block. Sorted by
 * archetype so the manifest stays byte-stable. Absent dir → `[]` (graceful, mirrors
 * `loadTemplates`).
 *
 * @returns {{archetype:string,intent:string,keywords:string[],packages:string[],file:string,template:string|null}[]}
 */
export function loadPlaybooks(repoRoot) {
  const dir = join(repoRoot, "docs/playbooks");
  if (!existsSync(dir)) return [];
  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const out = [];
  for (const entry of entries) {
    if (!entry.endsWith(".md") || entry === "README.md") continue;
    const slug = entry.replace(/\.md$/, "");
    const text = read(join(dir, entry));
    if (text == null) continue;
    const { data } = parseFrontMatter(text);
    const templateRel = `templates/${slug}.tsx`;
    out.push({
      // The FILE NAME is the identity; front matter must agree (the gate checks it).
      archetype: typeof data.archetype === "string" && data.archetype ? data.archetype : slug,
      intent: typeof data.intent === "string" ? data.intent : "",
      keywords: toList(data.keywords),
      packages: toList(data.packages),
      file: `docs/playbooks/${entry}`,
      template: existsSync(join(dir, templateRel)) ? templateRel : null,
    });
  }
  return out.sort((a, b) => a.archetype.localeCompare(b.archetype));
}

/**
 * Words that carry no routing signal in a free-text intent ("build me a dashboard
 * app"). Dropped before matching so they can't match every playbook at once.
 */
const INTENT_STOPWORDS = new Set([
  "and",
  "app",
  "apps",
  "brand",
  "build",
  "components",
  "create",
  "for",
  "make",
  "need",
  "new",
  "our",
  "page",
  "screen",
  "some",
  "that",
  "the",
  "this",
  "using",
  "want",
  "with",
]);

/**
 * Match a free-text INTENT against the manifest's playbooks (archetype, intent
 * sentence and keywords). This is what turns "build a dashboard" into
 * `docs/playbooks/dashboard.md` — the gap #66/#84 recorded, where `search
 * dashboard` returned an icon and a registry block but no playbook.
 *
 * Ranked strongest-first — an exact archetype, then a whole-query phrase hit
 * ("admin console"), then a single-token hit; ties keep manifest order.
 * @returns {object[]}
 */
export function matchPlaybooks(manifest, query) {
  const q = String(query || "")
    .toLowerCase()
    .trim();
  if (!q) return [];
  const books = manifest?.playbooks || [];
  const tokens = q.split(/[^a-z0-9-]+/).filter((t) => t.length >= 3 && !INTENT_STOPWORDS.has(t));
  const scored = books.map((p, i) => {
    const hay = [p.archetype, p.intent, ...(p.keywords || [])].join(" ").toLowerCase();
    let score = 0;
    if (p.archetype.toLowerCase() === q) score = 3;
    else if (hay.includes(q)) score = 2;
    else if (tokens.some((t) => hay.includes(t))) score = 1;
    return { p, score, i };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((s) => s.p);
}

// ---- cva variant expansion (WP-03 #79) -------------------------------------
// Without this an agent reading the manifest sees `VariantProps<typeof
// buttonVariants>` instead of the real values. We parse each
// `export const <x>Variants = cva(...)` straight from source — deterministic and
// dependency-free — into { variant: ["default","secondary",…], size: [...] } plus
// the default for each group.

/** Strip // and /* *\/ comments while preserving string literals — so a comment
 *  containing quotes or braces (e.g. `// "reduced != none"`) can't corrupt the
 *  brace/string scanner below. */
function stripComments(s) {
  let out = "";
  let q = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const n = s[i + 1];
    if (q) {
      out += c;
      if (c === "\\") out += s[++i] ?? "";
      else if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      q = c;
      out += c;
    } else if (c === "/" && n === "/") {
      while (i < s.length && s[i] !== "\n") i++;
      out += "\n";
    } else if (c === "/" && n === "*") {
      i += 2;
      while (i < s.length && !(s[i] === "*" && s[i + 1] === "/")) i++;
      i++;
    } else {
      out += c;
    }
  }
  return out;
}

/** Index of the (){}[] that closes the one opened at `open` (string- AND
 *  comment-aware). Comments are skipped (not stripped — `src` is returned
 *  untouched, so callers that need the original text, e.g. `extractPropTable`
 *  reading TSDoc, still get it) so a prose apostrophe inside a `//`/`/* *\/`
 *  comment (e.g. a JSDoc line reading "isn't") can't be mistaken for a string
 *  delimiter and corrupt brace-depth tracking for the rest of the source. */
function matchDelim(src, open) {
  let depth = 0;
  let q = null;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    const n = src[i + 1];
    if (q) {
      if (c === "\\") i++;
      else if (c === q) q = null;
      continue;
    }
    if (c === "/" && n === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && n === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") q = c;
    else if (c === "(" || c === "{" || c === "[") depth++;
    else if (c === ")" || c === "}" || c === "]") {
      if (--depth === 0) return i;
    }
  }
  return -1;
}

/** Split an object BODY (text between, not including, the outer braces) into
 *  [key, valueText] pairs at brace-depth 0 (string- and nesting-aware). */
function topLevelEntries(body) {
  const out = [];
  let depth = 0;
  let q = null;
  let key = null;
  let keyStart = 0;
  let valStart = 0;
  const flush = (end) => {
    if (key != null) out.push([key, body.slice(valStart, end).trim()]);
    key = null;
  };
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (q) {
      if (c === "\\") i++;
      else if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") q = c;
    else if (c === "(" || c === "{" || c === "[") depth++;
    else if (c === ")" || c === "}" || c === "]") depth--;
    else if (depth === 0 && c === ":" && key == null) {
      key = body
        .slice(keyStart, i)
        .trim()
        .replace(/^["']|["']$/g, "");
      valStart = i + 1;
    } else if (depth === 0 && c === ",") {
      flush(i);
      keyStart = i + 1;
    }
  }
  flush(body.length);
  return out.filter(([k]) => k && /^[\w-]+$/.test(k));
}

/** Body of `name: { ... }` within `text` (no outer braces), or null. */
function objectAfterKey(text, name) {
  const m = new RegExp(`(?:^|[,{\\s])${name}\\s*:\\s*\\{`).exec(text);
  if (!m) return null;
  const open = text.indexOf("{", m.index + m[0].length - 1);
  const end = matchDelim(text, open);
  return end < 0 ? null : text.slice(open + 1, end);
}

/** Parse every `export const <base>Variants = cva(...)` in `src`. */
export function extractVariants(rawSrc) {
  const src = stripComments(rawSrc);
  const out = {};
  const re = /export\s+const\s+([A-Za-z0-9_]+)Variants\s*=\s*cva\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    const base = m[1];
    const open = src.indexOf("(", m.index + m[0].length - 1);
    const end = matchDelim(src, open);
    if (end < 0) continue;
    const arg = src.slice(open + 1, end);
    const variantsBody = objectAfterKey(arg, "variants");
    if (!variantsBody) continue;
    const groups = {};
    for (const [g, val] of topLevelEntries(variantsBody)) {
      if (!val.startsWith("{")) continue;
      const values = topLevelEntries(val.slice(1, -1)).map(([k]) => k);
      if (values.length) groups[g] = values;
    }
    if (!Object.keys(groups).length) continue;
    const defaults = {};
    const defBody = objectAfterKey(arg, "defaultVariants");
    if (defBody)
      for (const [k, v] of topLevelEntries(defBody)) defaults[k] = v.replace(/^["']|["']$/g, "");
    out[base] = { variants: groups, defaultVariants: defaults, source: `${base}Variants` };
  }
  return out;
}

// ---- prop-table extraction (WP-03 #79, the deterministic half) -------------
// The cva-variant half is `extractVariants` above (the real `variant`/`size`
// values). This adds the component's OWN-DECLARED props — name, optional?, type
// text, and the preceding TSDoc — parsed structurally (string/brace-aware, no
// deps, deterministic). It deliberately does NOT *resolve* inherited types
// (e.g. expand `ButtonHTMLAttributes`) — that needs the TS compiler and is the
// explicitly-deferred half; instead we record the `extends` clause so an agent
// knows the inherited surface and can `brand-ui docs` / read the file for it.

/**
 * Pull the leading TSDoc/`//` description immediately above offset `start`.
 *
 * The block-comment pattern must be anchored to the LAST comment, not merely
 * lazy. `/\/\*\*([\s\S]*?)\*\/\s*$/` looks non-greedy, but the engine still
 * starts at the LEFTMOST `/**` and lets the lazy group grow until `*\/\s*$`
 * matches — i.e. it spans from the FIRST doc comment in the scanned prefix to
 * the LAST `*\/`, swallowing every prop declared in between. That is how
 * `brand-ui docs Gantt` reported `rowHeight?: number — Task data.` (the doc of
 * `tasks`, three declarations earlier) as ground truth (#60). Forbidding `*\/`
 * inside the captured body makes the match start at the comment that actually
 * abuts the member.
 */
function leadingDoc(src, start) {
  const before = src.slice(0, start);
  // A block comment ending right before the member. The capture group
  // excludes `*/` itself (`(?:(?!\*\/)[\s\S])*` instead of a bare `[\s\S]*?`)
  // so a NON-greedy-but-unbounded match can't skip PAST an intervening
  // member's own `/** ... */` back to an EARLIER, unrelated doc block (e.g.
  // two adjacent documented props each with a multi-line TSDoc — without the
  // exclusion, the regex would match from the FIRST `/**` in `before` through
  // to the LAST `*/`, splicing both props' descriptions — plus the bare
  // declaration line between them — into one).
  const block = before.match(/\/\*\*((?:(?!\*\/)[\s\S])*)\*\/\s*$/);
  if (block) {
    return block[1]
      .split("\n")
      .map((l) => l.replace(/^\s*\*?\s?/, "").trim())
      .filter(Boolean)
      .join(" ")
      .trim();
  }
  const line = before.match(/\/\/\s*(.*)\s*$/);
  if (!line) return "";
  const text = line[1].trim();
  // A box-drawing section rule (`// ── Virtualization ───────`) groups members;
  // it is not a description of the next one. Emitting it would attribute a
  // heading to a prop, which is the same mis-attribution this function exists
  // to avoid.
  return /^[─—–=-]{2,}/.test(text) ? "" : text;
}

/**
 * Parse `export interface|type <name>Props ... { BODY }` from `src` into a
 * structured prop table. Returns null when no such declaration exists.
 * @returns {{ extends: string[], props: { name, optional, type, description }[] } | null}
 */
export function extractPropTable(src, name) {
  // NB: keep comments — we read the TSDoc above each member for descriptions.
  const decl = new RegExp(`export\\s+(interface|type)\\s+${name}Props\\b`).exec(src);
  if (!decl) return null;
  const open = src.indexOf("{", decl.index);
  if (open < 0) return null;
  // `extends A, B<...>` between the name and the `{`.
  const header = src.slice(decl.index, open);
  const extendsM = header.match(/extends\s+([\s\S]+?)$/);
  const extendsList = extendsM
    ? splitTopLevel(extendsM[1].trim())
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const close = matchDelim(src, open);
  if (close < 0) return { extends: extendsList, props: [] };
  const body = src.slice(open + 1, close);
  const props = [];
  // Split body into member statements at depth-0 `;` or newline.
  for (const member of splitMembers(body)) {
    const { text, start } = member;
    // name (optional `?`) then `:` then type — skip index signatures / methods.
    const m = text.match(
      /^\s*(?:readonly\s+)?["']?([A-Za-z_$][\w$]*)["']?\s*(\?)?\s*:\s*([\s\S]+?)\s*$/,
    );
    if (!m) continue;
    const description = leadingDoc(body, start);
    props.push({
      name: m[1],
      optional: Boolean(m[2]),
      type: m[3]
        .replace(/[;,]\s*$/, "")
        .replace(/\s+/g, " ")
        .trim(),
      ...(description ? { description } : {}),
    });
  }
  return { extends: extendsList, props };
}

/** Split `A, B<C, D>, E` at top-level commas (generic/brace/paren-aware). */
function splitTopLevel(s) {
  const out = [];
  let depth = 0;
  let q = null;
  let last = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === "\\") i++;
      else if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") q = c;
    else if (c === "<" || c === "(" || c === "{" || c === "[") depth++;
    else if (c === ">" || c === ")" || c === "}" || c === "]") depth--;
    else if (c === "," && depth === 0) {
      out.push(s.slice(last, i));
      last = i + 1;
    }
  }
  out.push(s.slice(last));
  return out;
}

/** Split an interface BODY into member statements at depth-0 `;`/newline.
 *  Comment-aware for the same reason as `matchDelim`: a prose apostrophe in a
 *  member's leading TSDoc (e.g. "isn't") must not be read as a string quote,
 *  or the scan misses every real `;`/newline split for the rest of the body. */
function splitMembers(body) {
  const out = [];
  let depth = 0; // () [] {}
  let angle = 0; // <> — tracked separately; `=>` must not close it
  let q = null;
  let start = 0;
  const push = (end) => {
    const text = body.slice(start, end);
    if (text.trim()) out.push({ text, start });
    start = end + 1;
  };
  const isIdent = (ch) => ch !== undefined && /[A-Za-z0-9_$>)\]]/.test(ch);
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    const n = body[i + 1];
    if (q) {
      if (c === "\\") i++;
      else if (c === q) q = null;
      continue;
    }
    if (c === "/" && n === "/") {
      while (i < body.length && body[i] !== "\n") i++;
      push(i);
      continue;
    }
    if (c === "/" && n === "*") {
      i += 2;
      while (i < body.length && !(body[i] === "*" && body[i + 1] === "/")) i++;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") q = c;
    else if (c === "/" && n === "/") {
      // Skip to (but not past) the newline, so the newline still splits.
      while (i + 1 < body.length && body[i + 1] !== "\n") i++;
    } else if (c === "/" && n === "*") {
      i += 2;
      while (i < body.length && !(body[i] === "*" && body[i + 1] === "/")) i++;
      i++; // land on the closing `/`
    } else if (c === "(" || c === "{" || c === "[") depth++;
    else if (c === ")" || c === "}" || c === "]") depth = Math.max(0, depth - 1);
    else if (c === "<" && isIdent(body[i - 1]) && n !== "=" && n !== "<") angle++;
    else if (c === ">" && angle > 0 && body[i - 1] !== "=") angle--;
    else if (depth === 0 && angle === 0 && (c === ";" || c === "\n")) push(i);
  }
  push(body.length);
  return out;
}

/** Map a package's component source files → { ComponentName: propTable }. */
function collectProps(repoRoot, components) {
  const byComponent = {};
  for (const c of components) {
    if (!c.module) continue;
    const src = read(join(repoRoot, c.module));
    if (!src) continue;
    const table = extractPropTable(src, c.name);
    // Only record when we found own-declared props or a meaningful extends clause
    // — a thin/absent interface adds nothing and would bloat the manifest.
    if (table && (table.props.length || table.extends.length)) byComponent[c.name] = table;
  }
  return byComponent;
}

/** Map a package's component source files → { ComponentName: variantData }. */
function collectVariants(repoRoot, components) {
  const byComponent = {};
  const names = components.map((c) => c.name);
  const seen = new Set();
  for (const c of components) {
    if (!c.module || seen.has(c.module)) continue;
    seen.add(c.module);
    const src = read(join(repoRoot, c.module));
    if (!src || !src.includes("cva(")) continue;
    for (const [base, data] of Object.entries(extractVariants(src))) {
      const match = names.find((n) => n.toLowerCase() === base.toLowerCase());
      byComponent[match || base[0].toUpperCase() + base.slice(1)] = data;
    }
  }
  return byComponent;
}

/**
 * Build the full component manifest.
 *
 * @param {string} repoRoot
 * @param {{ resolved?: Record<string, Record<string, Record<string, object>>> }} [opts]
 *   `opts.resolved` is the OPTIONAL docgen output from `resolveAllProps()` —
 *   a map of pkgName → ComponentName → propName → resolved fields (inherited
 *   types / defaults / TSDoc). When provided it is merged ADDITIVELY into the
 *   dependency-free prop tables; when absent (the default — and always so when
 *   `react-docgen-typescript` isn't installed) the manifest is BYTE-IDENTICAL to
 *   the dependency-free output. This is what keeps `generateManifest` synchronous
 *   and fail-safe: the docgen step happens out-of-band (the async `manifest`
 *   command awaits `resolveAllProps`, then passes the result here). #79 / ADR 0013.
 */
export function generateManifest(repoRoot, opts = {}) {
  const resolvedByPkg = opts && typeof opts.resolved === "object" ? opts.resolved : null;
  const pkgsDir = join(repoRoot, "packages");
  const packages = {};
  for (const entry of readdirSync(pkgsDir)) {
    const pkgDir = join(pkgsDir, entry);
    const pkgJsonPath = join(pkgDir, "package.json");
    if (!existsSync(pkgJsonPath)) continue;
    let name, exportsMap, peerDependencies;
    try {
      const pkgJson = JSON.parse(read(pkgJsonPath));
      name = pkgJson.name;
      exportsMap = pkgJson.exports;
      // The package's OWN declared peers — the ranges a consuming app must
      // install itself (`@xyflow/react`, `monaco-editor`, `maplibre-gl`, the `ai`
      // SDK). Recorded here so the scaffold's install handoff can DERIVE them
      // (with the declared range, not a `*` wildcard) even in consumer mode,
      // where only the bundled manifest is reachable. #263 AC3.
      peerDependencies = pkgJson.peerDependencies;
    } catch {
      continue;
    }
    if (!name || !name.startsWith("@elabs-ai/components-") || CONFIG_PKGS.has(name)) continue;
    // Root `.` barrel — the primary import surface.
    const barrel = resolveModule(join(pkgDir, "src"), "./index");
    const all = collectBarrelExports(barrel, repoRoot);
    // Subpath barrels (`./markdown`, `./markdown/frontmatter`, …) are invisible
    // from the root barrel — crawl each one from the package's `exports` map and
    // tag it with the subpath consumers actually import from.
    const subpaths = {};
    for (const { subpath, file } of readSubpathBarrels(pkgDir, exportsMap)) {
      const subAll = collectBarrelExports(file, repoRoot);
      if (!subAll.length) continue; // side-effect modules (e.g. ./monaco-environment) carry no exports
      // e.g. "@elabs-ai/components-editor/markdown/frontmatter"
      const importPath = `${name}/${subpath.replace(/^\.\//, "")}`;
      subpaths[importPath] = bucketExports(subAll);
    }
    const bucketed = bucketExports(all);
    const variants = collectVariants(repoRoot, bucketed.components);
    // Resolved prop tables — own-declared props (name/optional/type/TSDoc) +
    // the `extends` clause (the inherited surface). Deterministic, dependency-free;
    // the cva half is `variants` above. #79.
    const props = collectProps(repoRoot, bucketed.components);
    // ADDITIVE docgen enrichment (#79 / ADR 0013): when the caller supplied a
    // resolved map for this package (from `resolveAllProps`, which needs the
    // `react-docgen-typescript` devDep), merge inherited types / defaults /
    // TSDoc INTO the dependency-free tables. Guarded so a malformed entry can't
    // throw mid-manifest; when `resolved` is absent this loop is a no-op and the
    // manifest is byte-identical to the dependency-free output (the floor).
    const resolvedPkg = resolvedByPkg && resolvedByPkg[name];
    if (resolvedPkg) {
      for (const [comp, resolvedMap] of Object.entries(resolvedPkg)) {
        if (!resolvedMap || typeof resolvedMap !== "object") continue;
        try {
          // Enrich an existing dependency-free table, or seed one from the
          // resolved data (extends-less) when the regex extractor found nothing.
          if (!props[comp]) props[comp] = { extends: [], props: [] };
          mergeResolvedProps(props[comp], resolvedMap);
          // Drop a seeded-but-empty table so an absent-everything component
          // doesn't bloat the manifest (matches collectProps' own filter).
          if (
            !props[comp].extends?.length &&
            !props[comp].props?.length &&
            !(props[comp].resolved && Object.keys(props[comp].resolved).length)
          )
            delete props[comp];
        } catch {
          /* one component's merge failing must never abort the manifest */
        }
      }
    }
    // Per-component intent metadata (purpose / relationships / state→token /
    // anti-patterns) — authored sidecar (lib/intent.mjs), folded in for the
    // components this package actually exports. Absent → omitted (graceful). #80.
    const intent = collectIntent(bucketed.components);
    packages[name] = {
      path: `packages/${entry}`,
      ...(peerDependencies && Object.keys(peerDependencies).length ? { peerDependencies } : {}),
      ...bucketed,
      ...(Object.keys(variants).length ? { variants } : {}),
      ...(Object.keys(props).length ? { props } : {}),
      ...(Object.keys(intent).length ? { intent } : {}),
      ...(Object.keys(subpaths).length ? { subpaths } : {}),
    };
  }
  const { themes, tokens, radius } = parseTokens(repoRoot);
  return {
    generatedAt: new Date().toISOString(),
    name: "brand-ui",
    themes,
    defaultTheme: parseDefaultTheme(repoRoot),
    radius,
    tokenCount: tokens.length,
    tokens,
    // The taste vocabulary + restrained defaults (#108) — so the audit skill can
    // READ the active profile (`brand-ui info`) instead of asking a human to pick
    // a register. Parsed from theme-types.ts, so it cannot drift from the types.
    taste: parseTaste(repoRoot),
    registry: loadRegistry(repoRoot),
    templates: loadTemplates(repoRoot),
    // The archetype playbooks (WP-09 #66/#84) — intent → archetype → template, read
    // from each playbook's own front matter so a new docs/playbooks/<a>.md is
    // auto-registered here (and therefore in `search`, `context` and the MCP server).
    playbooks: loadPlaybooks(repoRoot),
    // The agent-output contract (how an agent structures output for the @elabs-ai/components-ai
    // GenUI components to render it). Path-keyed, cross-package; authored sidecar
    // (lib/agent-output.mjs), gate-verified against source (`agent-output:check`).
    agentOutput: collectAgentOutput(),
    packages,
  };
}

/**
 * Load the manifest, in priority order:
 *   1. the monorepo root's committed `brand-ui.manifest.json` (dev / CI);
 *   2. the manifest bundled INSIDE the installed `@elabs-ai/components-cli` package — consumer
 *      mode has no repoRoot, so the copy shipped next to this file (see the
 *      package `files` field + the `prepack` copy) is the only ground truth;
 *   3. generate it on the fly from source (only possible inside the monorepo).
 */
export function loadManifest(repoRoot) {
  const written = repoRoot && read(join(repoRoot, "brand-ui.manifest.json"));
  if (written) {
    try {
      return JSON.parse(written);
    } catch {
      /* fall through */
    }
  }
  // Consumer mode: read the manifest packed alongside the CLI
  // (`packages/cli/brand-ui.manifest.json`; absent in a dev checkout, where
  // step 1 or 3 already answered).
  const bundled = read(
    join(dirname(fileURLToPath(import.meta.url)), "..", "brand-ui.manifest.json"),
  );
  if (bundled) {
    try {
      return JSON.parse(bundled);
    } catch {
      /* fall through */
    }
  }
  // Last resort: derive it from source. `repoRoot` is a *candidate* (a pnpm
  // workspace with a `packages/` dir — a consumer's own monorepo matches too), so
  // a directory that isn't brand-ui must come back as `null`, not throw: every
  // caller treats an absent manifest as "unknown", none expects an exception.
  if (!repoRoot) return null;
  try {
    return generateManifest(repoRoot);
  } catch {
    return null;
  }
}

export function writeManifest(repoRoot, manifest) {
  const file = join(repoRoot, "brand-ui.manifest.json");
  // Idempotent `generatedAt`: if the regenerated manifest differs from the file
  // on disk ONLY by its timestamp, keep the existing timestamp so the CI
  // stale-gate (`pnpm manifest && git diff --exit-code`) and the pre-commit
  // regeneration never flap on an unchanged repo. The manifest is the only
  // generated artifact excluded from Prettier (.prettierignore) so this raw
  // serialization is also its committed format — no formatter churn. (WP-10 #85.)
  if (existsSync(file)) {
    try {
      const prev = JSON.parse(readFileSync(file, "utf8"));
      const norm = (m) => JSON.stringify({ ...m, generatedAt: 0 });
      if (norm(prev) === norm(manifest)) manifest = { ...manifest, generatedAt: prev.generatedAt };
    } catch {
      /* unreadable/corrupt prior manifest — write fresh */
    }
  }
  writeFileSync(file, JSON.stringify(manifest, null, 2) + "\n");
}

/** Consumer-mode context: which @elabs-ai/components-* packages a project depends on. */
export function consumerContext(cwd = process.cwd()) {
  const pkg = read(join(cwd, "package.json"));
  if (!pkg) return null;
  let json;
  try {
    json = JSON.parse(pkg);
  } catch {
    return null;
  }
  const deps = { ...(json.dependencies || {}), ...(json.devDependencies || {}) };
  const brand = Object.keys(deps).filter((d) => d.startsWith("@elabs-ai/components-"));
  if (brand.length === 0) return null;
  return { installed: brand, name: json.name };
}

export function flat(manifest) {
  const rows = [];
  for (const [pkg, info] of Object.entries(manifest.packages || {})) {
    for (const c of info.components)
      rows.push({
        name: c.name,
        kind: "component",
        pkg,
        module: c.module,
        ...(info.variants?.[c.name] ? { variants: info.variants[c.name] } : {}),
        ...(info.props?.[c.name] ? { props: info.props[c.name] } : {}),
        ...(info.intent?.[c.name] ? { intent: info.intent[c.name] } : {}),
      });
    for (const h of info.hooks) rows.push({ name: h.name, kind: "hook", pkg, module: h.module });
    // Subpath exports import from `pkg/<subpath>`, not the root barrel — surface
    // them too so `search`/`docs` find them (importPath records the real import).
    for (const [importPath, sub] of Object.entries(info.subpaths || {})) {
      for (const c of sub.components)
        rows.push({ name: c.name, kind: "component", pkg, importPath, module: c.module });
      for (const h of sub.hooks)
        rows.push({ name: h.name, kind: "hook", pkg, importPath, module: h.module });
    }
  }
  return rows;
}
