/**
 * @elabs-ai/components-cli — core logic (dependency-free).
 *
 * The deterministic backend the brand-ui skills lean on. Keeps the skills thin:
 * the skill teaches judgment + rules, this reads the actual code so the agent
 * never guesses what exists or what props a component takes.
 */
import { readFileSync, existsSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { join, dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { collectIntent } from "./intent.mjs";
import { collectStoryIds } from "./story-ids.mjs";
import { collectAgentOutput } from "./agent-output.mjs";
import { mergeResolvedProps } from "./docgen.mjs";
import { A2UI_VERB_DOCS } from "./a2ui.mjs";

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
export function collectBarrelExports(barrel, repoRoot) {
  const byName = new Map();
  for (const e of collectExports(barrel, repoRoot)) {
    const prev = byName.get(e.name);
    if (!prev || (prev.kind === "type" && e.kind === "value")) byName.set(e.name, e);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Shape a de-duped export list into the manifest's component/hook/type buckets.
 *
 * `types` and `otherExports` keep `{name, module}` objects — same shape as
 * `components`/`hooks` — so a reader can locate the export's source file. They
 * used to be flattened to bare name strings (`.map((e) => e.name)`), which is
 * exactly what made `flat()` unable to surface them (#86): with no `module` to
 * attribute a row to, there was nothing to push. This IS a manifest-shape
 * change; `pnpm gen` regenerates `brand-ui.manifest.json` to match.
 */
function bucketExports(all) {
  return {
    components: all.filter((e) => e.kind === "value" && /^[A-Z]/.test(e.name)),
    hooks: all.filter((e) => e.kind === "value" && /^use[A-Z]/.test(e.name)),
    types: all.filter((e) => e.kind === "type").map((e) => ({ name: e.name, module: e.module })),
    otherExports: all
      .filter((e) => e.kind === "value" && /^[a-z]/.test(e.name) && !/^use[A-Z]/.test(e.name))
      .map((e) => ({ name: e.name, module: e.module })),
  };
}

/**
 * Collect the exported identifiers of a TS module, resolving `export * from`
 * one or two levels deep. Returns [{ name, kind: "value"|"type", module }].
 */
export function collectExports(file, repoRoot, seen = new Set(), depth = 0) {
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
    // Strip comments BEFORE splitting on comma. A barrel is free to interleave
    // `//`/`/* */` comments between named exports (valid TS, and Prettier
    // doesn't reformat them away) — a comma inside one of those comments used
    // to survive into the split, corrupting the parse: a real named export
    // (e.g. a `type X,` line) got silently swallowed into the same field as
    // the comment text, while a comment fragment that happened to look like
    // an identifier (e.g. the word "exported" inside a sentence) leaked out
    // as a phantom export name — reproduced by `packages/data/src/data-table/index.ts`'s
    // round-1 `#69`/`#82` doc comment (round-2 fix, #82 follow-up). This is a
    // real crawler bug, not something the caller can be asked to work around
    // by comment placement: any future barrel comment containing a comma
    // would hit the same corruption.
    const namesSource = m[2].replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    const names = namesSource
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        // A PER-SPECIFIER `type` keyword (`export { A, type B, type C as D }`)
        // marks just that one name as a type export — independent of `isType`
        // above, which only fires for the OUTER `export type { ... }` form
        // (every name in the block). This used to be left in place and then
        // `.replace(/\s+/g, "")` joined it straight onto the name
        // ("type DataTableProps" → "typeDataTableProps"): a real bug, not
        // hypothetical — `brand-ui.manifest.json` already shipped
        // `"typeDataTableProps"`/`"typeColumnPickerProps"`/etc. as literal
        // `otherExports` strings for THIS SAME barrel, so every mixed-block
        // type export in the file was already undiscoverable under its real
        // name before the #69/#82 round-1 `DataTableColumnMeta` fix ever
        // touched it — that fix's own `type DataTableColumnMeta` specifier
        // would have hit the identical mis-parse even with the comment
        // (fixed above) out of the way. Strip the keyword and mark the
        // specifier as a type BEFORE resolving an `as` alias.
        const specifierIsType = /^type\s+/.test(s);
        const withoutTypeKeyword = specifierIsType ? s.replace(/^type\s+/, "") : s;
        const asMatch = withoutTypeKeyword.match(/\bas\s+([A-Za-z0-9_$]+)/);
        const name = (asMatch ? asMatch[1] : withoutTypeKeyword).replace(/\s+/g, "");
        return { name, kind: isType || specifierIsType ? "type" : "value" };
      })
      .filter(({ name }) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) && name !== "type");
    for (const { name, kind } of names) out.push({ name, kind, module: sourceRel });
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
 * .stories.tsx); `pnpm gen` derives both the consumer source under
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

/**
 * CLI subcommand verbs that are real, standalone tooling — not components — and
 * so were invisible to `search`/`context`/the MCP server (validator FAIL #1,
 * RM-088 follow-up 1). Each CLI verb GROUP (currently only `a2ui`) exports its
 * own `<GROUP>_VERB_DOCS` array as the single source
 * for its own docs; this just folds every group into one manifest arm so a new
 * verb group is auto-registered here the same way a new playbook is (loadPlaybooks
 * above) — add the group's docs array to `GROUPS` below, nothing else.
 */
function loadCliVerbs() {
  const GROUPS = [{ group: "a2ui", docs: A2UI_VERB_DOCS }];
  return GROUPS.flatMap(({ group, docs }) =>
    docs.map((d) => ({ group, verb: d.verb, usage: d.usage, does: d.does })),
  );
}

/**
 * Match a free-text query against the manifest's CLI verbs (group, verb, usage,
 * does). Modeled on `matchTemplates()` — a name/description substring or
 * whole-query hit, not a fuzzy intent match.
 * @returns {object[]}
 */
export function matchCliVerbs(manifest, query) {
  const q = String(query || "")
    .toLowerCase()
    .trim();
  if (!q) return [];
  const verbs = manifest?.cliVerbs || [];
  return verbs.filter((v) => `${v.group} ${v.verb} ${v.usage} ${v.does}`.toLowerCase().includes(q));
}

// ---- playbooks (WP-09 #66 / #84) -------------------------------------------
// The archetype composition recipes under `docs/playbooks/*.md`. They existed but
// were INVISIBLE to every agent-discovery surface (no manifest entry, no context
// section, no `search` hit) — so an agent asked to "build a dashboard" never found
// dashboard.md. The playbook's own YAML front matter is the source of truth; this
// reader folds it into the manifest so `search`, `context` and the MCP server all
// answer from one place. Adding docs/playbooks/<a>.md + front matter is the ONLY
// manual step; `pnpm gen:check` fails when the manifest wasn't regenerated.

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
/** A query token hits a haystack on WORD starts, not anywhere: "form" must not
 *  match con-FORM-ance, "log" must not match LOGin (`search "login form"` used to
 *  route to the process-explorer playbook that way). */
function tokenHitsWords(hay, token) {
  return hay.split(/[^a-z0-9]+/).some((w) => w.startsWith(token));
}

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
    else if (tokens.some((t) => tokenHitsWords(hay, t))) score = 1;
    return { p, score, i };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((s) => s.p);
}

/**
 * Match a free-text query against the manifest's whole-screen templates (name,
 * title, description). Modeled on `matchPlaybooks()` above, but a SEPARATE arm:
 * not every template has a `docs/playbooks/<name>.md` counterpart (`screen-states`,
 * `object-detail-hub` are patterns/anatomies, not scaffoldable whole-app
 * archetypes — see `ARCHETYPES` in engine.mjs), so `matchPlaybooks()` never sees
 * them and they were completely unreachable from `search` (#89). This is what
 * makes `brand-ui search screen-states` find the template by its own exact name
 * even with no playbook front matter to read.
 *
 * Ranked strongest-first — an exact name, then a whole-query phrase hit, then a
 * single-token hit against name+title+description; ties keep manifest order.
 * @returns {object[]}
 */
export function matchTemplates(manifest, query) {
  const q = String(query || "")
    .toLowerCase()
    .trim();
  if (!q) return [];
  const templates = manifest?.templates || [];
  const tokens = q.split(/[^a-z0-9-]+/).filter((t) => t.length >= 3 && !INTENT_STOPWORDS.has(t));
  const scored = templates.map((tmpl, i) => {
    const hay = [tmpl.name, tmpl.title, tmpl.description].join(" ").toLowerCase();
    let score = 0;
    if (tmpl.name.toLowerCase() === q) score = 3;
    else if (hay.includes(q)) score = 2;
    else if (tokens.some((t) => tokenHitsWords(hay, t))) score = 1;
    return { tmpl, score, i };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((s) => s.tmpl);
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
// deps, deterministic) and records the `extends` clause. Bases declared in the
// repo itself are then expanded by the textual resolver further down
// (`createTypeResolver`, RM-179); types from outside the repo (e.g.
// `ButtonHTMLAttributes`) are never expanded — that would need the TS compiler
// (the opt-in docgen pass) — so they stay recorded in `extends` for an agent to
// `brand-ui docs` / read the file for.

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
  const declRe = new RegExp(`export\\s+(interface|type)\\s+${name}Props\\b`, "g");
  const decls = [...src.matchAll(declRe)];
  if (!decls.length) return extractForwardRefPropTable(src, name);
  const first = extractOnePropTable(src, decls[0]);
  // Declaration merging: a file may declare `export interface XProps` twice
  // (line-chart.tsx adds `annotations` in a second block, RM-111). TypeScript
  // merges them; so must the table, or the merged members are invisible to
  // `docs` (2026-09-21 new-user test: `annotations` missing from LineChart).
  for (const decl of decls.slice(1)) {
    if (decl[1] !== "interface") continue;
    const more = extractOnePropTable(src, decl);
    if (!more) continue;
    if (!first) return more;
    const seen = new Set(first.props.map((p) => p.name));
    for (const p of more.props) if (!seen.has(p.name)) first.props.push(p);
    for (const e of more.extends) if (!first.extends.includes(e)) first.extends.push(e);
  }
  return first;
}

/**
 * No `NameProps` declaration at all — the props are the second generic of a
 * `forwardRef<El, Props>(function Name` (ToggleGroup, several Radix wrappers).
 * Record that generic as the inherited surface so `docs` says what to read
 * instead of nothing (2026-09-21 new-user test: `docs ToggleGroup` was a dead end).
 */
function extractForwardRefPropTable(src, name) {
  const matchAngle = (from) => {
    let depth = 0;
    for (let i = from; i < src.length; i++) {
      const c = src[i];
      if (c === "<" || c === "(" || c === "{" || c === "[") depth++;
      else if (c === ">" || c === ")" || c === "}" || c === "]") {
        // `=>` is an arrow, not a closer.
        if (c === ">" && src[i - 1] === "=") continue;
        if (--depth === 0) return i;
      }
    }
    return -1;
  };
  const splitOn = (text, sep) => {
    const out = [];
    let depth = 0;
    let last = 0;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === "<" || c === "(" || c === "{" || c === "[") depth++;
      // `=>` is an arrow, not a closer: counting it split an inline props literal at the
      // first comma after a callback member (`SidebarProvider`'s `onOpenChange`, RM-179).
      else if (c === ">" && text[i - 1] === "=") continue;
      else if (c === ">" || c === ")" || c === "}" || c === "]") depth--;
      else if (c === sep && depth === 0) {
        out.push(text.slice(last, i));
        last = i + 1;
      }
    }
    out.push(text.slice(last));
    return out.map((t) => t.trim()).filter(Boolean);
  };
  for (const hit of src.matchAll(/forwardRef\s*</g)) {
    const open = hit.index + hit[0].length - 1;
    const close = matchAngle(open);
    if (close < 0) continue;
    const after = src.slice(close + 1, close + 200);
    const before = src.slice(Math.max(0, hit.index - 120), hit.index).trimEnd();
    const named =
      new RegExp(`\\(\\s*function\\s+${name}\\s*\\(`).test(after) ||
      new RegExp(`\\b${name}\\s*=$`).test(before);
    if (!named) continue;
    const generics = splitOn(src.slice(open + 1, close), ",");
    const props = generics[1];
    if (!props) return null;
    return { extends: splitOn(props, "&"), props: [] };
  }
  return null;
}

function extractOnePropTable(src, decl) {
  if (decl[1] === "type") {
    // `export type XProps = Base & { … }` never carries the `interface`
    // syntax's `extends` keyword, so the object-literal-only parse below
    // silently dropped every intersection's base type(s) (#77). Parse the
    // alias's RHS on its own terms; on any parse hazard (no depth-0 `;`
    // found — e.g. truncated/malformed input), gracefully bail to the
    // pre-#77 object-literal-only parse rather than risk a wrong answer or a
    // throw (this runs during `pnpm gen`, invoked by the pre-commit
    // hook — it must stay total).
    const aliasResult = extractTypeAliasPropTable(src, decl);
    if (aliasResult) return aliasResult;
  }
  return extractPropTableFromBrace(src, decl);
}

/** The pre-#77 parse: first `{` after the declaration is the object-literal
 *  body; `extends A, B<...>` (interface-only syntax) between the name and
 *  that `{` is the base list. Used for the `interface` path (unchanged) and
 *  as the type-alias path's graceful-bail fallback. */
function extractPropTableFromBrace(src, decl) {
  // A generic declaration (`interface XProps<T extends Base = Default> extends …`) opens with
  // a type-parameter list whose own `extends`, `=` and `{` belong to the parameters, not to
  // the base list or the body: skip it first (RM-179 — the list used to leak into `extends`
  // as entries like `Record<string, unknown> = Record<string, unknown>`).
  const headerStart = skipTypeParams(src, decl.index + decl[0].length);
  const open = src.indexOf("{", headerStart);
  if (open < 0) return null;
  // `extends A, B<...>` between the name and the `{`.
  // Comments between the bases (`// Selection gestures — RM-143`) are not bases: without
  // this the comment text became an `extends` entry (`brand-ui docs DistributionChart`).
  const header = src
    .slice(headerStart, open)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ");
  const extendsM = header.match(/extends\s+([\s\S]+?)$/);
  const extendsList = extendsM
    ? splitTopLevel(extendsM[1].trim())
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const close = matchDelim(src, open);
  if (close < 0) return { extends: extendsList, props: [] };
  const body = src.slice(open + 1, close);
  return { extends: extendsList, props: parseObjectLiteralMembers(body) };
}

/** Parse an object-literal BODY (text between, not including, the outer
 *  braces) into prop records — the per-member regex + TSDoc extraction
 *  shared by every path that finds one. */
function parseObjectLiteralMembers(body) {
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
  return props;
}

/**
 * Parse `export type <name>Props = RHS;` — the intersection/base-only-alias
 * path (#77 Arm A + Arm B). Returns null on any parse hazard (no depth-0 `=`
 * or terminating `;` found), signalling the caller to fall back to
 * `extractPropTableFromBrace`.
 *
 * RHS handling:
 *   - a top-level `|` (union) is NOT an inheritance relation — return
 *     `{ extends: [], props: [] }` without attempting a body parse (a union
 *     member is never reported as a base);
 *   - otherwise split at top-level `&`; a member matching `^\s*\{` is the
 *     object-literal body (own props, parsed exactly as the `interface`
 *     path); every other member, trimmed, is a base type → `extends`, in
 *     source order (Arm A). A single non-`{` member with no `&` at all is a
 *     base-only alias (`type XProps = Base;`) → `{ extends: [Base], props: [] }`
 *     (Arm B). An identifier-led member additionally has its generic argument
 *     probed for a NESTED object literal (Arm C, PR #87 review finding) —
 *     `PropsWithChildren<{ initialInput?: string }>` still carries an
 *     own-declared `initialInput` prop that Arm A alone would silently drop.
 */
function extractTypeAliasPropTable(src, decl) {
  const nameEnd = decl.index + decl[0].length;
  const eqIdx = findAliasTopLevel(src, nameEnd, "=");
  if (eqIdx < 0) return null;
  const rhsStart = eqIdx + 1;
  const semiIdx = findAliasTopLevel(src, rhsStart, ";");
  if (semiIdx < 0) return null; // graceful bail — see extractPropTable's doc comment
  const rhs = src.slice(rhsStart, semiIdx);
  // A top-level union is not an inheritance relation.
  if (findAliasTopLevel(rhs, 0, "|") >= 0) return { extends: [], props: [] };
  const extendsList = [];
  let props = [];
  let offset = 0;
  for (const segment of splitAliasTopLevel(rhs, "&")) {
    const leadingWs = segment.match(/^\s*/)[0].length;
    if (segment.slice(leadingWs).startsWith("{")) {
      const open = rhsStart + offset + leadingWs;
      const close = matchDelim(src, open);
      if (close >= 0) props = props.concat(parseObjectLiteralMembers(src.slice(open + 1, close)));
    } else {
      const trimmed = segment.trim();
      if (trimmed) {
        extendsList.push(trimmed);
        // Arm C: a utility type WRAPPING an object literal as a generic
        // argument (`PropsWithChildren<{ initialInput?: string }>`,
        // `Partial<{ x: string }>`) still carries own props inside that
        // nested `{...}` — probe for one, scoped to identifier-led segments
        // only (`/^[A-Za-z_$]/`). This deliberately EXCLUDES a parenthesized
        // member like `Omit<X, Y> & (\n | { data: … }\n | { src: … }\n)`
        // (starts with `(`, not an identifier) — that shape is a
        // discriminated union, not a flat prop table, and flattening its
        // first arm would misrepresent the API (see the disclosed
        // `AudioPlayerElementProps` limitation, u6 validation report) rather
        // than merely lose information the way the pre-fix `props: []` did.
        if (/^[A-Za-z_$]/.test(trimmed)) {
          const nestedRel = findFirstBrace(segment, leadingWs);
          if (nestedRel >= 0) {
            const open = rhsStart + offset + nestedRel;
            const close = matchDelim(src, open);
            if (close >= 0) {
              const nested = parseObjectLiteralMembers(src.slice(open + 1, close));
              if (nested.length) props = props.concat(nested);
            }
          }
        }
      }
    }
    offset += segment.length + 1; // +1 for the consumed `&`
  }
  return { extends: extendsList, props };
}

/**
 * Index of the first UNQUOTED, non-comment `{` in `text` starting at `from`,
 * or -1 — string/comment-aware but deliberately NOT depth-gated (unlike
 * `findAliasTopLevel`), since the brace we're after is nested INSIDE a
 * generic's `<...>` (depth 1+ relative to the segment), not at depth 0.
 */
function findFirstBrace(text, from = 0) {
  let q = null;
  for (let i = from; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];
    if (q) {
      if (c === "\\") i++;
      else if (c === q) q = null;
      continue;
    }
    if (c === "/" && n === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && n === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      q = c;
      continue;
    }
    if (c === "{") return i;
  }
  return -1;
}

/**
 * Find the first depth-0 occurrence of a single-char separator in `text`
 * starting at `from` — generic/paren/brace/bracket-aware, string- and
 * comment-aware. Returns -1 if none found.
 *
 * Reuses the angle-bracket discipline already proven in `splitMembers` (a
 * SEPARATE `angle` counter, gated on `isIdent(prev)` + `next !== "="`) rather
 * than `splitTopLevel`'s single shared depth counter, which treats every `>`
 * as a closer and would mis-split on the `>` of an arrow-function type
 * (`(id: string) => void`) nested inside an object-literal intersection
 * member (#77's named implementation trap).
 */
function findAliasTopLevel(text, from, sep) {
  let depth = 0; // () [] {}
  let angle = 0; // <>
  let q = null;
  const isIdent = (ch) => ch !== undefined && /[A-Za-z0-9_$>)\]]/.test(ch);
  for (let i = from; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];
    const p = text[i - 1];
    if (q) {
      if (c === "\\") i++;
      else if (c === q) q = null;
      continue;
    }
    if (c === "/" && n === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && n === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      q = c;
      continue;
    }
    if (c === "(" || c === "{" || c === "[") depth++;
    else if (c === ")" || c === "}" || c === "]") depth = Math.max(0, depth - 1);
    else if (c === "<" && isIdent(p) && n !== "=" && n !== "<") angle++;
    else if (c === ">" && angle > 0 && p !== "=") angle--;
    else if (depth === 0 && angle === 0 && c === sep) return i;
  }
  return -1;
}

/** Split `text` at every top-level (depth-0) occurrence of `sep` — same
 *  discipline as `findAliasTopLevel`, returning the segments (rejoining them
 *  with `sep` reconstructs `text` exactly). */
function splitAliasTopLevel(text, sep) {
  const out = [];
  let last = 0;
  let from = 0;
  for (;;) {
    const i = findAliasTopLevel(text, from, sep);
    if (i < 0) break;
    out.push(text.slice(last, i));
    last = i + 1;
    from = i + 1;
  }
  out.push(text.slice(last));
  return out;
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

// ---- inherited props: the textual `extends` resolver (RM-179, ADR 0042 §10) ----
// `extractPropTable` records a props type's bases (`extends A, B<T>`, `A & B`) without
// expanding them, so eight chart containers restated mixin props on their own interfaces
// (RM-146) only to be documented. The resolver below expands every base that is DECLARED IN
// THE REPO'S OWN SOURCE: an interface (merged declarations included) or a type alias, in a
// `.ts` or `.tsx` file — the same file, a relative import, or another workspace package's
// barrel/subpath — through `Omit` / `Pick` / `Partial` / `Required` / `Readonly` /
// `PropsWithChildren`, intersections, inline object literals, generic arguments (substituted
// into member types; a parameter's default when no argument is passed) and any number of
// `extends` levels. Like the rest of this file it is textual and dependency-free.
//
// What it does NOT expand stays listed in `extends` only: a base declared outside the repo
// (`HTMLAttributes<…>`, `ComponentProps<"div">`, React Flow's types), `ComponentProps<typeof X>`
// (a component value, not a type), `VariantProps<…>` (already expanded as `variants`), a union
// (`A | B` is not a flat prop table), and an `Omit`/`Pick` whose keys are not string literals.
// Each inherited prop carries `from`: the name of the type that declares it.

/** Utility types the resolver applies itself instead of looking up a declaration. */
const PROP_UTILITIES = new Set([
  "Omit",
  "Pick",
  "Partial",
  "Required",
  "Readonly",
  "PropsWithChildren",
]);

/** How deep a chain of bases may go before the resolver stops (a guard, not a real limit). */
const MAX_BASE_DEPTH = 16;

/** How many modules one re-export walk may visit before it gives up (a runaway guard). */
const MAX_REEXPORT_WALK = 4000;

/** Index of the `>` that closes the `<` at `open` (string-aware; `=>` is not a closer). */
function matchAngle(text, open) {
  let depth = 0;
  let q = null;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === "\\") i++;
      else if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") q = c;
    else if (c === "<" || c === "(" || c === "{" || c === "[") depth++;
    else if (c === ">" || c === ")" || c === "}" || c === "]") {
      if (c === ">" && text[i - 1] === "=") continue;
      if (--depth === 0) return c === ">" ? i : -1;
    }
  }
  return -1;
}

/** `from` itself, or — when a `<…>` type-parameter list starts there — the index after it. */
function skipTypeParams(src, from) {
  let i = from;
  while (i < src.length && /\s/.test(src[i])) i++;
  if (src[i] !== "<") return from;
  const close = matchAngle(src, i);
  return close < 0 ? from : close + 1;
}

/** `src` with every comment blanked to spaces (newlines kept), so offsets still index `src`. */
function maskComments(src) {
  let out = "";
  let q = null;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const n = src[i + 1];
    if (q) {
      out += c;
      if (c === "\\" && i + 1 < src.length) out += src[++i];
      else if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      q = c;
      out += c;
    } else if (c === "/" && n === "/") {
      while (i < src.length && src[i] !== "\n") {
        out += " ";
        i++;
      }
      if (i < src.length) out += "\n";
    } else if (c === "/" && n === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end < 0 ? src.length : end + 2;
      for (; i < stop; i++) out += src[i] === "\n" ? "\n" : " ";
      i--;
    } else {
      out += c;
    }
  }
  return out;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Every `interface NAME` / `type NAME` declaration in (comment-masked) `masked`. */
function typeDeclarations(masked, name) {
  const re = new RegExp(
    `(?:^|[\\n;{}])[ \\t]*(?:export[ \\t]+)?(?:declare[ \\t]+)?(interface|type)[ \\t]+${escapeRe(name)}(?![\\w$])(?=\\s*(?:<|=|\\{|extends\\b))`,
    "g",
  );
  const out = [];
  for (const m of masked.matchAll(re)) out.push({ kind: m[1], nameEnd: m.index + m[0].length });
  return out;
}

/** `<A, B extends X = Y>` (the text between the angle brackets) → `[{ name, default? }]`. */
function parseTypeParams(text) {
  const out = [];
  for (const raw of splitAliasTopLevel(text, ",")) {
    const param = raw.trim();
    const name = /^(?:const\s+|in\s+|out\s+)*([A-Za-z_$][\w$]*)/.exec(param)?.[1];
    if (!name) continue;
    const eq = topLevelAssign(param);
    out.push(eq < 0 ? { name } : { name, default: param.slice(eq + 1).trim() });
  }
  return out;
}

/** Index of the depth-0 `=` of a type parameter's default (never the `=` of `=>`). */
function topLevelAssign(text) {
  let depth = 0;
  let q = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === "\\") i++;
      else if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") q = c;
    else if (c === "<" || c === "(" || c === "{" || c === "[") depth++;
    else if (c === ")" || c === "}" || c === "]") depth--;
    else if (c === ">" && text[i - 1] !== "=") depth--;
    else if (c === "=" && depth === 0 && text[i + 1] !== ">" && !/[=!<>]/.test(text[i - 1]))
      return i;
  }
  return -1;
}

/** Wrap a substituted type argument in parentheses when bare text would re-associate. */
function wrapTypeArg(text) {
  const t = text.trim();
  const loose =
    findAliasTopLevel(t, 0, "|") >= 0 || findAliasTopLevel(t, 0, "&") >= 0 || /=>/.test(t);
  return loose && !(t.startsWith("(") && matchDelim(t, 0) === t.length - 1) ? `(${t})` : t;
}

/** Replace each type parameter in `text` by its argument (`subst`: name → type text). */
function substituteTypeParams(text, subst) {
  const names = Object.keys(subst);
  if (!names.length || typeof text !== "string") return text;
  const re = new RegExp(`(?<![\\w$.])(?:${names.map(escapeRe).join("|")})(?![\\w$])`, "g");
  return text.replace(re, (name) => subst[name]);
}

/** Bind a declaration's type parameters to the arguments of one reference to it. */
function bindTypeArgs(params, args) {
  const subst = {};
  params.forEach((param, i) => {
    const arg = args[i] ?? (param.default ? substituteTypeParams(param.default, subst) : null);
    if (arg != null) subst[param.name] = wrapTypeArg(arg);
  });
  return subst;
}

/** `Name` / `Name<A, B>` / `NS.Name<…>` → `{ name, args }`; anything else → null. */
function parseTypeRef(text) {
  const t = stripComments(text).trim();
  const m = /^([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*/.exec(t);
  if (!m) return null;
  const rest = t.slice(m[0].length);
  if (!rest) return { name: m[1], args: [] };
  if (rest[0] !== "<" || matchAngle(rest, 0) !== rest.length - 1) return null;
  return {
    name: m[1],
    args: splitAliasTopLevel(rest.slice(1, -1), ",")
      .map((a) => a.trim())
      .filter(Boolean),
  };
}

/**
 * The textual `extends` resolver for one repo (RM-179). `resolve(file, typeText)` returns the
 * props a base contributes, each tagged with `from`; `expand(file, table)` appends a prop
 * table's inherited props after its own. Files, declarations and package entries are cached
 * for the resolver's lifetime (one manifest generation).
 */
export function createTypeResolver(repoRoot) {
  const files = new Map();
  const lookups = new Map();
  let packageDirs = null;

  const fileInfo = (abs) => {
    if (!abs) return null;
    if (!files.has(abs)) {
      const src = read(abs);
      files.set(abs, src == null ? null : { src, masked: maskComments(src) });
    }
    return files.get(abs);
  };

  /** A workspace package's source entry for `@elabs-ai/components-x[/sub]`, or null. */
  const resolvePackage = (spec) => {
    if (!packageDirs) {
      packageDirs = new Map();
      let entries = [];
      try {
        entries = readdirSync(join(repoRoot, "packages"));
      } catch {
        /* no packages dir: nothing resolves */
      }
      for (const entry of entries.sort()) {
        const dir = join(repoRoot, "packages", entry);
        try {
          const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
          if (pkg.name) packageDirs.set(pkg.name, { dir, exports: pkg.exports });
        } catch {
          /* not a package */
        }
      }
    }
    const parts = spec.split("/");
    const pkg = packageDirs.get(parts.slice(0, 2).join("/"));
    if (!pkg) return null;
    const sub = parts.slice(2).join("/");
    const target = pkg.exports?.[sub ? `./${sub}` : "."];
    const candidates =
      typeof target === "string"
        ? [target]
        : target && typeof target === "object"
          ? Object.values(target).filter((v) => typeof v === "string")
          : [];
    const source = candidates.find((c) => /\.tsx?$/.test(c));
    if (source) return resolve(pkg.dir, source);
    return resolveModule(join(pkg.dir, "src"), sub ? `./${sub}` : "./index");
  };

  const resolveSpecifier = (fromFile, spec) => {
    if (spec.startsWith(".")) return resolveModule(dirname(fromFile), spec);
    if (spec.startsWith("@elabs-ai/components-")) return resolvePackage(spec);
    return null; // a third-party module: its types are not the repo's to expand
  };

  /** `import { A, type B as C } from "x"` → the binding `name` refers to, or null. */
  const importBinding = (masked, name) => {
    const re =
      /\bimport\s+(?:type\s+)?(?:[A-Za-z_$][\w$]*\s*,\s*)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;
    for (const m of masked.matchAll(re)) {
      for (const raw of m[1].split(",")) {
        const s = raw.trim().replace(/^type\s+/, "");
        const as = /^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/.exec(s);
        if ((as ? as[2] : s) === name) return { spec: m[2], orig: as ? as[1] : s };
      }
    }
    return null;
  };

  /** The declaration of the type `name` EXPORTED by `abs`, following re-exports. */
  const exportedDeclaration = (abs, name, seen = new Set()) => {
    // `seen` guards cycles; the bound only stops a runaway walk (a package barrel such
    // as ui's `index.ts` fans out to well over a hundred `export *` modules).
    const key = `${abs}#${name}`;
    if (!abs || seen.has(key) || seen.size > MAX_REEXPORT_WALK) return null;
    seen.add(key);
    const info = fileInfo(abs);
    if (!info) return null;
    const decls = typeDeclarations(info.masked, name);
    if (decls.length) return { file: abs, info, name, decls };
    for (const m of info.masked.matchAll(
      /\bexport\s+(?:type\s+)?\{([^}]*)\}(?:\s*from\s*["']([^"']+)["'])?/g,
    )) {
      for (const raw of m[1].split(",")) {
        const s = raw.trim().replace(/^type\s+/, "");
        const as = /^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/.exec(s);
        if ((as ? as[2] : s) !== name) continue;
        const orig = as ? as[1] : s;
        // `export { X } from "./x"` — or `export { X }` of something this file imported.
        const via = m[2] ? { spec: m[2], orig } : importBinding(info.masked, orig);
        if (!via) continue;
        const found = exportedDeclaration(resolveSpecifier(abs, via.spec), via.orig, seen);
        if (found) return found;
      }
    }
    for (const m of info.masked.matchAll(/\bexport\s*\*\s*from\s*["']([^"']+)["']/g)) {
      const found = exportedDeclaration(resolveSpecifier(abs, m[1]), name, seen);
      if (found) return found;
    }
    return null;
  };

  /** The declaration the type name `name` refers to inside `abs`, or null (external/unknown). */
  const lookup = (abs, name) => {
    const key = `${abs}#${name}`;
    if (lookups.has(key)) return lookups.get(key);
    let found = null;
    const info = fileInfo(abs);
    if (info) {
      const decls = typeDeclarations(info.masked, name);
      if (decls.length) found = { file: abs, info, name, decls };
      else {
        const via = importBinding(info.masked, name);
        if (via) found = exportedDeclaration(resolveSpecifier(abs, via.spec), via.orig);
      }
    }
    lookups.set(key, found);
    return found;
  };

  /** A type alias: its parameters and right-hand side (original text, comments kept). */
  const aliasOf = (decl, at) => {
    const { src, masked } = decl.info;
    const start = skipTypeParams(masked, at.nameEnd);
    const params =
      start === at.nameEnd
        ? []
        : parseTypeParams(masked.slice(masked.indexOf("<", at.nameEnd) + 1, start - 1));
    const eq = masked.indexOf("=", start);
    if (eq < 0 || masked.slice(start, eq).trim()) return null;
    const semi = findAliasTopLevel(masked, eq + 1, ";");
    if (semi < 0) return null;
    return { params, rhs: src.slice(eq + 1, semi) };
  };

  /** One interface declaration: parameters, base list and body (original text). */
  const interfaceOf = (decl, at) => {
    const { src, masked } = decl.info;
    const start = skipTypeParams(masked, at.nameEnd);
    const params =
      start === at.nameEnd
        ? []
        : parseTypeParams(masked.slice(masked.indexOf("<", at.nameEnd) + 1, start - 1));
    // The body brace: the first `{` outside any `<…>`/`(…)` of the base list.
    let open = -1;
    for (let i = start, depth = 0; i < masked.length; i++) {
      const c = masked[i];
      if (c === "{" && depth === 0) {
        open = i;
        break;
      }
      if (c === "<" || c === "(" || c === "[" || c === "{") depth++;
      else if ((c === ">" && masked[i - 1] !== "=") || c === ")" || c === "]" || c === "}") depth--;
    }
    if (open < 0) return null;
    const header = masked.slice(start, open).trim();
    const bases = header.startsWith("extends")
      ? splitAliasTopLevel(header.slice("extends".length), ",")
          .map((b) => b.trim())
          .filter(Boolean)
      : [];
    const close = matchDelim(src, open);
    if (close < 0) return null;
    return { params, bases, body: src.slice(open + 1, close) };
  };

  /** A string-literal key set (`"a" | "b"`, an alias of one, `keyof X`), or null if unknowable. */
  const literalKeys = (abs, text, stack) => {
    const keys = new Set();
    const t = stripComments(text).trim().replace(/^\|/, "");
    for (const raw of splitAliasTopLevel(t, "|")) {
      const part = raw.trim();
      const lit = /^(["'])(.*)\1$/.exec(part);
      if (lit) keys.add(lit[2]);
      else if (part === "never") continue;
      else if (/^keyof\s/.test(part)) {
        const props = resolveType(abs, part.slice(5), {}, stack, undefined);
        if (!props.length) return null;
        for (const p of props) keys.add(p.name);
      } else if (/^[A-Za-z_$][\w$]*$/.test(part) && stack.length < MAX_BASE_DEPTH) {
        const decl = lookup(abs, part);
        const alias = decl?.decls[0].kind === "type" ? aliasOf(decl, decl.decls[0]) : null;
        const inner = alias ? literalKeys(decl.file, alias.rhs, [...stack, part]) : null;
        if (!inner) return null;
        for (const k of inner) keys.add(k);
      } else return null;
    }
    return keys;
  };

  /** Props of a declared interface or type alias, referenced with `args`. */
  const declarationProps = (decl, args, stack) => {
    const key = `${decl.file}#${decl.name}`;
    if (stack.includes(key) || stack.length >= MAX_BASE_DEPTH) return [];
    const next = [...stack, key];
    const first = decl.decls[0];
    if (first.kind === "type") {
      const alias = aliasOf(decl, first);
      if (!alias) return [];
      return resolveType(decl.file, alias.rhs, bindTypeArgs(alias.params, args), next, decl.name);
    }
    // An interface — every declaration of it in the file merges (TypeScript does the same).
    const parts = decl.decls
      .filter((d) => d.kind === "interface")
      .map((d) => interfaceOf(decl, d))
      .filter(Boolean);
    const params = parts.find((p) => p.params.length)?.params ?? [];
    const subst = bindTypeArgs(params, args);
    const out = [];
    for (const part of parts)
      for (const p of parseObjectLiteralMembers(part.body))
        out.push({ ...p, type: substituteTypeParams(p.type, subst), from: decl.name });
    for (const part of parts)
      for (const base of part.bases) out.push(...resolveType(decl.file, base, subst, next));
    return dedupeProps(out);
  };

  /**
   * The props a type expression contributes, resolved in the scope of `abs`. `subst` maps the
   * enclosing declaration's type parameters to their arguments; `literalFrom` names the alias
   * an inline object literal belongs to (none at the component itself: those are own props).
   */
  const resolveType = (abs, text, subst, stack, literalFrom) => {
    const t = String(text ?? "").trim();
    if (!t || stack.length >= MAX_BASE_DEPTH) return [];
    const bare = stripComments(t).trim();
    // A union is not a flat prop table: never expanded (not even its first arm).
    if (bare.startsWith("|") || findAliasTopLevel(t, 0, "|") >= 0) return [];
    if (t.startsWith("(") && matchDelim(t, 0) === t.length - 1)
      return resolveType(abs, t.slice(1, -1), subst, stack, literalFrom);
    const members = splitAliasTopLevel(t, "&");
    if (members.length > 1)
      return dedupeProps(members.flatMap((m) => resolveType(abs, m, subst, stack, literalFrom)));
    if (t.startsWith("{")) {
      const close = matchDelim(t, 0);
      if (close < 0) return [];
      return parseObjectLiteralMembers(t.slice(1, close)).map((p) => ({
        ...p,
        type: substituteTypeParams(p.type, subst),
        ...(literalFrom ? { from: literalFrom } : {}),
      }));
    }
    const ref = parseTypeRef(t);
    // Qualified names (`React.X`, `MapLibreGL.Y`) live in a namespace import: external.
    if (!ref || ref.name.includes(".") || ref.name in subst) return [];
    const args = ref.args.map((a) => substituteTypeParams(a, subst));
    if (PROP_UTILITIES.has(ref.name)) {
      const base = args[0] ? resolveType(abs, ref.args[0], subst, stack, literalFrom) : [];
      switch (ref.name) {
        case "Omit":
        case "Pick": {
          const keys = args[1] == null ? null : literalKeys(abs, args[1], stack);
          if (!keys) return [];
          return base.filter((p) => keys.has(p.name) === (ref.name === "Pick"));
        }
        case "Partial":
          return base.map((p) => ({ ...p, optional: true }));
        case "Required":
          return base.map((p) => ({ ...p, optional: false }));
        default:
          return base; // Readonly, PropsWithChildren (its `children` is React's)
      }
    }
    const decl = lookup(abs, ref.name);
    return decl ? declarationProps(decl, args, stack) : [];
  };

  /** First declaration of a name wins: an interface's own member overrides its bases'. */
  const dedupeProps = (props) => {
    const seen = new Set();
    return props.filter((p) => !seen.has(p.name) && seen.add(p.name));
  };

  return {
    resolve: (abs, text) => resolveType(abs, text, {}, [], undefined),
    /** `table` with its inherited props appended after its own (own wins on a name clash). */
    expand(abs, table) {
      if (!table?.extends?.length) return table;
      const seen = new Set(table.props.map((p) => p.name));
      const inherited = [];
      for (const base of table.extends) {
        for (const p of resolveType(abs, base, {}, [], undefined)) {
          if (seen.has(p.name)) continue;
          seen.add(p.name);
          inherited.push(p);
        }
      }
      return inherited.length ? { ...table, props: [...table.props, ...inherited] } : table;
    },
  };
}

// ---- the definitions snapshot join (RM-179, ADR 0042 §7/§10) ----------------------------

/** The committed definitions snapshot (`gen-definitions.mjs`, RM-178), or `{}`. */
export const DEFINITIONS_SNAPSHOT_PATH = "packages/cli/lib/definitions.generated.json";

export function loadDefinitionsSnapshot(repoRoot) {
  const text = repoRoot && read(join(repoRoot, DEFINITIONS_SNAPSHOT_PATH));
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** A snapshot default as the manifest's `defaultValue` text (JSON), or undefined. */
function snapshotDefaultText(value) {
  if (value === undefined) return undefined;
  // A theme-token default (`{ defaultFrom: "context" }`) has no literal value to print.
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    value.defaultFrom === "context" &&
    Object.keys(value).length === 1
  )
    return undefined;
  return JSON.stringify(value);
}

/**
 * Join a package's definitions (one snapshot entry per component id) into its prop tables, in
 * place: per prop, the definition's `defaultValue` (the kind default, else the group default;
 * a `codeOnly` prop's kind default too), its field `kind`, its prop `group` and `deprecated`
 * (`{ since, replacement?, removeIn }`). A prop the definition does not describe is left as
 * it is, and the join never adds a prop the source does not declare.
 */
export function joinDefinitions(propTables, definitions) {
  if (!definitions || typeof definitions !== "object") return propTables;
  for (const [component, table] of Object.entries(propTables)) {
    const def = definitions[component];
    if (!def || !Array.isArray(table?.props)) continue;
    for (const prop of table.props) {
      const field = def.fields?.[prop.name];
      const fallback = field ? undefined : def.codeOnlyDefaults?.[prop.name];
      const defaultText = snapshotDefaultText(field ? field.default : fallback);
      if (defaultText !== undefined && prop.defaultValue === undefined)
        prop.defaultValue = defaultText;
      if (!field) continue;
      if (field.kind) prop.kind = field.kind;
      if (field.group) prop.group = field.group;
      if (field.deprecated) prop.deprecated = field.deprecated;
    }
  }
  return propTables;
}

/** A prop's `deprecated` record as the one bracketed note `docs` prints on its line. */
export function deprecationText(deprecated) {
  if (!deprecated || typeof deprecated !== "object") return "";
  const parts = [`deprecated${deprecated.since ? ` since ${deprecated.since}` : ""}`];
  if (deprecated.replacement) parts.push(`use ${deprecated.replacement}`);
  if (deprecated.removeIn) parts.push(`removed in ${deprecated.removeIn}`);
  return `[${parts.join("; ")}]`;
}

/** Map a package's component source files → { ComponentName: propTable }. */
function collectProps(repoRoot, components, resolver = createTypeResolver(repoRoot)) {
  const byComponent = {};
  for (const c of components) {
    if (!c.module) continue;
    // `module` is where the manifest FOUND the export. For a multi-file
    // component that is a directory barrel (`charts/heatmap/index.ts`,
    // `metric-card/index.ts`) and the props interface lives in the file the
    // barrel re-exports from — so read the declaring file first, then the
    // barrel's siblings (2026-09-21 new-user test: `docs HeatmapChart` printed
    // no props and `docs ChartAnnotations` was a dead end for exactly this).
    const candidates = [
      ...new Set([
        declaringModule(repoRoot, c.module, c.name),
        ...declarationCandidates(repoRoot, c.module),
      ]),
    ].filter(Boolean);
    for (const file of candidates) {
      const src = read(join(repoRoot, file));
      if (!src) continue;
      const table = extractPropTable(src, c.name);
      // Only record when we found own-declared props or a meaningful extends
      // clause — a thin/absent interface adds nothing and would bloat the manifest.
      if (table && (table.props.length || table.extends.length)) {
        // Inherited props (RM-179): every base declared in the repo is expanded and its
        // props appended after the own ones, each tagged with the type that declares it.
        byComponent[c.name] = resolver.expand(join(repoRoot, file), table);
        break;
      }
    }
  }
  return byComponent;
}

/**
 * Follow `export { …, Name, … } from "./x"` / `export * from "./x"` from `module`
 * until the file that DECLARES `name` (an `export interface NameProps`, an
 * `export const/function Name`, or a `const Name = forwardRef`). Returns the
 * repo-relative path, or `module` itself when it declares the name or the chain
 * cannot be followed (depth-limited; a missing file stops the walk).
 */
export function declaringModule(repoRoot, module, name, depth = 0) {
  if (depth > 6) return module;
  const src = read(join(repoRoot, module));
  if (!src) return module;
  const declares = new RegExp(
    // A DECLARATION, not a barrel's `type XProps,` re-export line: an interface
    // is followed by `extends`/`<`/`{`, a type alias by `=` (after optional
    // generics), a value by `=`, `(` or `<`.
    `(?:^|\\n)\\s*(?:export\\s+)?(?:interface\\s+${name}Props\\s*(?:extends\\b|<|\\{)|type\\s+${name}Props\\s*(?:<[^=]*)?=|(?:const|let)\\s+${name}\\s*(?::[^=]*)?=|(?:function|class)\\s+${name}\\s*[(<{])`,
  );
  if (declares.test(src)) return module;
  const fromDir = dirname(join(repoRoot, module));
  const next = [];
  // Named re-exports that mention `name` (or `Name as Name`), then star re-exports.
  for (const m of src.matchAll(/export\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) {
    const names = m[1].split(",").map((n) => n.trim().replace(/^type\s+/, ""));
    if (names.some((n) => n === name || new RegExp(`\\bas\\s+${name}$`).test(n))) next.push(m[2]);
  }
  for (const m of src.matchAll(/export\s*\*\s*from\s*["']([^"']+)["']/g)) next.push(m[1]);
  for (const rel of next) {
    if (!rel.startsWith(".")) continue;
    const file = resolveModule(fromDir, rel);
    if (!file) continue;
    const relPath = file
      .slice(repoRoot.length + 1)
      .split(sep)
      .join("/");
    const found = declaringModule(repoRoot, relPath, name, depth + 1);
    if (declares.test(read(join(repoRoot, found)) || "")) return found;
  }
  return module;
}

/**
 * A component's `@dataShape`/`@avoidWhen` JSDoc tags — the chart-selection
 * metadata (RM-040), SOURCE-DERIVED like `extractPropTable`/`extractVariants`,
 * never hand-authored (that is what `lib/intent.mjs`'s `INTENT` map is for).
 *
 * `@dataShape <text>` may repeat (a container closes more than one data shape —
 * a heatmap is both "two categorical axes with one value per cell" AND, in its
 * `variant="calendar"` reading, "one measure per calendar day"); each occurrence
 * becomes one entry of `dataShapes`, in source order, and a tag may WRAP over
 * continuation lines. `@avoidWhen <text>` is singular — the one sentence that
 * steers a reader to a sibling container instead.
 *
 * ANCHORED TO ONE DECLARATION, not scanned over the whole file. A file commonly
 * exports a container AND its tuning constants (`bump-chart.tsx` exports
 * `BumpChart` and `END_LABEL_MIN_GAP`; `heatmap/index.ts` re-exports
 * `HeatmapChart` alongside `CALENDAR_ROWS` and `DEFAULT_HEATMAP_STEPS`), and a
 * whole-file scan would hand every one of those siblings the container's data
 * shapes — they would then surface as candidates from `brand-ui chart-for`,
 * which is exactly the black-box ranking that command is built to avoid. So the
 * tags are read from the docblock immediately preceding `name`'s own
 * declaration and nowhere else.
 *
 * `pnpm gen:check` is what makes this "keep them honest": delete a tag from
 * the source and the manifest entry loses it on the next `pnpm gen` — there
 * is nowhere else the value could come from.
 *
 * @param {string} src   the file's text
 * @param {string} name  the exported symbol whose docblock to read
 * @returns {{ dataShapes?: string[], avoidWhen?: string } | null}
 */
export function extractChartDataShapes(src, name) {
  const block = docblockFor(src, name);
  if (!block) return null;
  const dataShapes = jsdocTagValues(block, "dataShape");
  const [avoidWhen] = jsdocTagValues(block, "avoidWhen");
  if (!dataShapes.length && !avoidWhen) return null;
  return {
    ...(dataShapes.length ? { dataShapes } : {}),
    ...(avoidWhen ? { avoidWhen } : {}),
  };
}

/**
 * The `/** … *\/` block immediately preceding `name`'s declaration, or null.
 * Only whitespace may sit between the block and the declaration — a comment
 * separated by other code is somebody else's docblock.
 */
function docblockFor(src, name) {
  if (!src || !name) return null;
  const decl = new RegExp(
    `^export\\s+(?:default\\s+)?(?:async\\s+)?(?:function|const|let|class)\\s+${name}\\b`,
    "m",
  ).exec(src);
  if (!decl) return null;
  const before = src.slice(0, decl.index);
  const close = before.lastIndexOf("*/");
  if (close === -1) return null;
  if (before.slice(close + 2).trim() !== "") return null; // not adjacent
  const open = before.lastIndexOf("/**", close);
  if (open === -1) return null;
  return before.slice(open, close + 2);
}

/**
 * Every value of a repeatable JSDoc tag in one docblock, continuation lines
 * folded in. A tag's value runs until the next `@tag` or the end of the block,
 * so a shape sentence may wrap across as many lines as it needs to read well.
 */
function jsdocTagValues(block, tag) {
  const lines = block
    .split("\n")
    // strip the block's own `/**`, `*/` and each line's leading ` * `
    .map((l) => l.replace(/^\s*\/?\*+\/?/, "").trim())
    .filter((l) => l !== "");
  const out = [];
  let current = null;
  for (const line of lines) {
    const opened = new RegExp(`^@${tag}\\b\\s*(.*)$`).exec(line);
    if (opened) {
      if (current !== null) out.push(current);
      current = opened[1].trim();
      continue;
    }
    if (current === null) continue;
    if (line.startsWith("@")) {
      out.push(current);
      current = null;
      continue;
    }
    current = `${current} ${line}`.trim();
  }
  if (current !== null) out.push(current);
  return out.filter(Boolean);
}

/**
 * Map a package's component source files → { ComponentName: { dataShapes, avoidWhen } }.
 *
 * A component's `module` is where the manifest FOUND the export, which for a
 * multi-file container is its directory barrel (`charts/heatmap/index.ts`) —
 * the declaration, and therefore the docblock, lives in a sibling. So when the
 * name is not declared in `module` itself and `module` is a barrel, its
 * directory's own files are searched for the declaration.
 */
function collectChartDataShapes(repoRoot, components) {
  const byComponent = {};
  for (const c of components) {
    if (!c.module) continue;
    for (const file of declarationCandidates(repoRoot, c.module)) {
      const shapes = extractChartDataShapes(read(join(repoRoot, file)), c.name);
      if (shapes) {
        byComponent[c.name] = shapes;
        break;
      }
    }
  }
  return byComponent;
}

/** `module` first, then — when it is a barrel — the source files beside it. */
function declarationCandidates(repoRoot, module) {
  const files = [module];
  if (!/(^|\/)index\.tsx?$/.test(module)) return files;
  const dir = dirname(module);
  let entries = [];
  try {
    entries = readdirSync(join(repoRoot, dir));
  } catch {
    return files;
  }
  for (const entry of entries.sort()) {
    if (!/\.tsx?$/.test(entry)) continue;
    if (/\.(test|stories)\.tsx?$/.test(entry)) continue;
    const path = `${dir}/${entry}`;
    if (path !== module) files.push(path);
  }
  return files;
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
  // One resolver (and its file cache) for the whole manifest: a base shared by many
  // components (`ChartSelectionProps`, `ChartNavigatorProps`) is parsed once.
  const resolver = createTypeResolver(repoRoot);
  const definitionsSnapshot = loadDefinitionsSnapshot(repoRoot);
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
    // Resolved prop tables — own-declared props (name/optional/type/TSDoc), the
    // `extends` clause, and the props inherited from every base declared in the repo
    // (RM-179, tagged `from`). Deterministic, dependency-free; the cva half is
    // `variants` above. #79.
    const props = collectProps(repoRoot, bucketed.components, resolver);
    // The definitions snapshot join (RM-179, ADR 0042 §10): defaults, field kind, prop group
    // and `deprecated` for every component this package defines (charts today).
    joinDefinitions(props, definitionsSnapshot[name]);
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
    // Subpath exports (`@elabs-ai/components-editor/markdown`) are the package's
    // components too — their intent lands in the same map.
    const intent = collectIntent([
      ...bucketed.components,
      ...Object.values(subpaths).flatMap((sub) => sub.components || []),
    ]);
    // Chart-selection metadata (RM-040) — SOURCE-DERIVED from each container's
    // own `@dataShape`/`@avoidWhen` JSDoc tags (never hand-authored), merged
    // additively into the SAME `intent` entry so `brand-ui docs <Chart>` and
    // `chart-for` read one record per component. Seeds an intent entry when the
    // component has tags but no authored INTENT row (mirrors how docgen seeds
    // `props[comp]` in the block above) — a chart container's dataShapes must
    // never be silently dropped for lack of an unrelated authored `purpose`.
    for (const [comp, shapes] of Object.entries(
      collectChartDataShapes(repoRoot, bucketed.components),
    )) {
      intent[comp] = { ...(intent[comp] || {}), ...shapes };
    }
    // The Storybook DOCS page that documents each exported component
    // (`{ Button: "core-button--docs" }`), read from the story files' own
    // `meta.title`. This is the link between the two surfaces that never met:
    // `brand-ui docs <Name>` can print the live story URL, and Storybook's
    // Intent block is generated from the same record (2026-09-17 review §4.2.3).
    const stories = collectStoryIds(repoRoot, [
      ...bucketed.components,
      // Subpath components (`@elabs-ai/components-ui/form`) have docs pages too,
      // so they get a storyId as well.
      ...Object.values(subpaths).flatMap((sub) => sub.components || []),
    ]);
    packages[name] = {
      path: `packages/${entry}`,
      ...(peerDependencies && Object.keys(peerDependencies).length ? { peerDependencies } : {}),
      ...bucketed,
      ...(Object.keys(variants).length ? { variants } : {}),
      ...(Object.keys(props).length ? { props } : {}),
      ...(Object.keys(intent).length ? { intent } : {}),
      ...(Object.keys(stories).length ? { stories } : {}),
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
    // Standalone CLI verbs (e.g. `a2ui catalog|schema|validate|example`,
    // RM-086 #427) — real tooling with no component/registry/playbook shape of
    // its own, so it needs its own manifest arm to be reachable from `search`.
    cliVerbs: loadCliVerbs(),
    // The agent-output contract (how an agent structures output for the @elabs-ai/components-ai
    // GenUI components to render it). Path-keyed, cross-package; authored sidecar
    // (lib/agent-output.mjs), gate-verified against source (the `agent-output-contract` rule in `pnpm check`).
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
  // stale-gate (`pnpm gen:check`) and the pre-commit
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

/**
 * Normalize one `types`/`otherExports` bucket entry. `bucketExports()` has
 * shipped `{name, module}` objects since commit 05b6040 (#86); before that it
 * flattened both buckets to bare name strings. `loadManifest()` reads a
 * checkout-local `brand-ui.manifest.json` off disk verbatim, with no version
 * tag and no migration step, and prioritizes it over the bundled/generated
 * manifest — so a checkout (or a consumer's own monorepo) whose committed
 * manifest predates #86 still hands `flat()` the old string shape. Accepting
 * both here is what keeps every reader built on `flat()` (`bin/brand-ui.mjs`
 * search/docs, `lib/mcp.mjs` search/docs, `lib/engine.mjs` map) from crashing
 * on `row.name.toLowerCase()` against a `name: undefined` row (PR #97 finding 5).
 */
function normalizeExportEntry(entry) {
  return typeof entry === "string" ? { name: entry, module: undefined } : entry;
}

/**
 * Dependency order of the distributable packages — the OWNER of a re-exported
 * name is always upstream (`MetricCard` is owned by ui and re-exported by charts
 * and editor, ADR 0012). `resolveDocsHit` uses it as the tie-break.
 */
export const PACKAGE_ORDER = [
  "tokens",
  "ui",
  "icons",
  "data",
  "charts",
  "ai",
  "flow",
  "maps",
  "marketing",
  "editor",
  "viewer",
  "terminal",
  "process",
];

const pkgRank = (pkg) => {
  const i = PACKAGE_ORDER.indexOf(String(pkg || "").replace(/^@elabs-ai\/components-/, ""));
  return i < 0 ? PACKAGE_ORDER.length : i;
};

/**
 * Pick the `flat(manifest)` row `docs <query>` means (2026-09-21 new-user test:
 * `docs MetricCard` answered with the charts RE-EXPORT, which records no props,
 * and `docs Text` with editor's prose `Text` instead of ui's typography — the
 * manifest's package order is alphabetical, so `ai`/`charts`/`editor` won every
 * tie). The rule, in order:
 *
 *   1. `query` may name the package: `ui/Text`, `components-ui/Text`,
 *      `@elabs-ai/components-ui/Text` — that package's row, or none.
 *   2. Among same-name rows, a row that RECORDS an API (props, variants or
 *      intent) beats one that does not — the owner has the data.
 *   3. Then dependency order (`PACKAGE_ORDER`): the owner is upstream.
 *   4. Then a root import beats a subpath import.
 *
 * Returns `{ hit, alternatives }` — `alternatives` are the other packages that
 * export the same name (for the "also exported from" line), or `hit: null`.
 */
export function resolveDocsHit(rows, query) {
  const raw = String(query || "").trim();
  const m = /^(?:(@elabs-ai\/components-|components-)?([a-z]+)\/)?([^/]+)$/.exec(raw);
  const wantPkg = m?.[2] ? `@elabs-ai/components-${m[2]}` : null;
  const name = (m?.[3] ?? raw).toLowerCase();
  const same = rows.filter((r) => r.name.toLowerCase() === name);
  if (!same.length) return { hit: null, alternatives: [] };
  const hasApi = (r) =>
    r.props?.props?.length || r.props?.extends?.length || r.variants || r.intent ? 1 : 0;
  const ranked = [...same].sort(
    (a, b) =>
      hasApi(b) - hasApi(a) ||
      pkgRank(a.pkg) - pkgRank(b.pkg) ||
      (a.importPath ? 1 : 0) - (b.importPath ? 1 : 0),
  );
  const hit = wantPkg ? (ranked.find((r) => r.pkg === wantPkg) ?? null) : ranked[0];
  const alternatives = hit
    ? [...new Set(ranked.filter((r) => r !== hit && r.pkg !== hit.pkg).map((r) => r.pkg))]
    : [];
  return { hit, alternatives };
}

/**
 * The path a reader can actually open when a card has no recorded API. Inside
 * the monorepo that is the source module; in a consumer project that module does
 * not exist — the installed package's `dist/index.d.ts` does (2026-09-21 new-user
 * test: five first-screen components printed `read packages/…/x.tsx`, a dead end
 * outside this repo).
 */
export function apiFallbackPath(hit, repoRoot) {
  if (repoRoot) return hit.module;
  const sub = hit.importPath ? hit.importPath.slice(hit.pkg.length + 1) : "";
  return `node_modules/${hit.pkg}/dist/${sub ? `${sub}/` : ""}index.d.ts (search for "${hit.name}Props")`;
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
        ...(info.stories?.[c.name] ? { storyId: info.stories[c.name] } : {}),
      });
    for (const h of info.hooks) rows.push({ name: h.name, kind: "hook", pkg, module: h.module });
    // Type-only exports (interfaces/types, e.g. `DataTableColumnMeta`) and plain
    // value exports that are neither components nor hooks (`otherExports`, e.g.
    // `createSelectionColumn`) — #86. Both buckets carry `{name, module}` (see
    // `bucketExports()`) in a current manifest, or bare name strings in one
    // written by the previous release — `normalizeExportEntry()` accepts both.
    for (const t of info.types) {
      const { name, module } = normalizeExportEntry(t);
      rows.push({ name, kind: "type", pkg, module });
    }
    for (const o of info.otherExports) {
      const { name, module } = normalizeExportEntry(o);
      rows.push({ name, kind: "export", pkg, module });
    }
    // Subpath exports import from `pkg/<subpath>`, not the root barrel — surface
    // them too so `search`/`docs` find them (importPath records the real import).
    for (const [importPath, sub] of Object.entries(info.subpaths || {})) {
      for (const c of sub.components)
        rows.push({
          name: c.name,
          kind: "component",
          pkg,
          importPath,
          module: c.module,
          ...(info.stories?.[c.name] ? { storyId: info.stories[c.name] } : {}),
        });
      for (const h of sub.hooks)
        rows.push({ name: h.name, kind: "hook", pkg, importPath, module: h.module });
      for (const t of sub.types) {
        const { name, module } = normalizeExportEntry(t);
        rows.push({ name, kind: "type", pkg, importPath, module });
      }
      for (const o of sub.otherExports) {
        const { name, module } = normalizeExportEntry(o);
        rows.push({ name, kind: "export", pkg, importPath, module });
      }
    }
  }
  return rows;
}
