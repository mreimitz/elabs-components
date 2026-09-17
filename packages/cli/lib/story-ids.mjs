/**
 * story-ids.mjs — map each exported component to the Storybook DOCS page that
 * documents it (`core-button--docs`).
 *
 * Why the manifest carries this: the two audiences are served from two sources
 * that never meet. The MCP knows a component's purpose, relationships and
 * anti-patterns; Storybook knows what it looks like. Neither links to the other
 * (2026-09-17 review §4.2.3). A `storyId` per component closes the loop in both
 * directions — the MCP's `docs <Name>` can print the live story URL, and
 * Storybook's Intent block can be generated from the same record.
 *
 * Source of truth is the story file itself: `meta.title` + `meta.component`,
 * read with the same regex shape `scripts/gen-templates.mjs` uses. A page only
 * exists when the meta carries the `autodocs` tag, so untagged files are
 * skipped rather than pointing at a 404.
 *
 * Deterministic: files are walked in sorted order, one component resolves to at
 * most one page (a co-located story file wins over a distant one), and nothing
 * reads the clock or the environment.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

/** Directories that never hold a story file worth indexing. */
const SKIP_DIRS = new Set(["node_modules", "dist", "storybook-static", ".turbo", "coverage"]);

/** Roots scanned for `*.stories.tsx`, in a stable order. */
const STORY_ROOTS = ["packages", "apps/docs"];

/**
 * Storybook's own id slugifier, inlined.
 *
 * Copied from `storybook/internal/csf`'s `sanitize` (Storybook 10.4) so the
 * published CLI stays free of a Storybook dependency. `packages/cli/test/
 * story-ids.test.mjs` pins the behaviour against the ids the live site serves.
 */
export function sanitizeStorySegment(string) {
  return String(string)
    .toLowerCase()
    .replace(/[ ’–—―′¿'`~!@#$%^&*()_|+\-=?;:'",.<>{}[\]\\/]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

/** `"Core/Button"` → `"core-button--docs"`. */
export function docsIdFromTitle(title) {
  const slug = sanitizeStorySegment(title);
  return slug ? `${slug}--docs` : "";
}

function walkStories(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of [...entries].sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkStories(full, out);
    else if (entry.name.endsWith(".stories.tsx")) out.push(full);
  }
  return out;
}

/**
 * The `const meta = { … }` object literal, brace-matched.
 *
 * A fixed character window is not enough: eleven story files in this repo carry
 * an `argTypes` table before their `tags`, so a 800-character regex lookahead
 * silently dropped their docs page. Braces inside strings, template literals,
 * comments and regex-free JSX are skipped so the match ends on the real closer.
 */
function extractMetaBlock(src) {
  // The default export IS the meta — follow it by name (`export default
  // decisionMeta`) so a file that declares several metas yields the one
  // Storybook actually indexes, and an inline `export default { … }` works too.
  const exported = src.match(/export\s+default\s+([A-Za-z0-9_$]+)\s*;/)?.[1];
  const declaration = exported
    ? new RegExp(`const\\s+${exported}\\s*(?::[^=]*)?=\\s*\\{`)
    : /export\s+default\s*\{|const\s+meta\s*(?::[^=]*)?=\s*\{/;
  const start = src.search(declaration);
  if (start < 0) return "";
  const open = src.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      for (i++; i < src.length; i++) {
        if (src[i] === "\\") i++;
        else if (src[i] === quote) break;
      }
      continue;
    }
    if (ch === "/" && src[i + 1] === "/") {
      i = src.indexOf("\n", i);
      if (i < 0) break;
      continue;
    }
    if (ch === "/" && src[i + 1] === "*") {
      i = src.indexOf("*/", i);
      if (i < 0) break;
      i++;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return src.slice(open, i + 1);
  }
  return "";
}

/** `title: "Core/Button"` — the sidebar path the story id is derived from. */
function extractTitle(meta) {
  // Match the opening quote and allow the OTHER quote characters inside it —
  // "What's the headline? Hero + satellites" is a real title in this repo, and a
  // naive `["'`]+` class truncates it at the apostrophe.
  return meta.match(/(^|[\s,{])title\s*:\s*(["'`])((?:\\.|(?!\2).)*)\2/)?.[3] ?? "";
}

/** `component: Button` — the component this page documents. */
function extractComponent(meta) {
  return meta.match(/(^|[\s,{])component\s*:\s*([A-Za-z0-9_$]+)/)?.[2] ?? "";
}

/** A docs page only exists when the meta opts into autodocs. */
function hasAutodocs(meta) {
  return /(^|[\s,{])tags\s*:\s*\[[^\]]*["']autodocs["']/.test(meta);
}

/**
 * Index every autodocs story file under `repoRoot`.
 *
 * @returns {{ pages: {title:string,storyId:string,component:string,file:string}[],
 *             byComponent: Record<string,string> }}
 *   `pages` in sorted-title order; `byComponent` maps an exported component name
 *   to its docs id.
 */
/** One walk per repo root per process — the manifest asks once per package. */
const INDEX_CACHE = new Map();

export function indexStoryDocsPages(repoRoot) {
  const cached = INDEX_CACHE.get(repoRoot);
  if (cached) return cached;
  const index = buildStoryDocsIndex(repoRoot);
  INDEX_CACHE.set(repoRoot, index);
  return index;
}

function buildStoryDocsIndex(repoRoot) {
  const files = [];
  for (const root of STORY_ROOTS) walkStories(join(repoRoot, root), files);
  /** @type {{title:string,storyId:string,component:string,file:string}[]} */
  const pages = [];
  for (const file of files) {
    let src;
    try {
      src = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const meta = extractMetaBlock(src);
    if (!meta || !hasAutodocs(meta)) continue;
    const title = extractTitle(meta);
    const storyId = docsIdFromTitle(title);
    if (!storyId) continue;
    pages.push({
      title,
      storyId,
      component: extractComponent(meta),
      file: relative(repoRoot, file).split(sep).join("/"),
    });
  }
  pages.sort((a, b) => (a.storyId < b.storyId ? -1 : a.storyId > b.storyId ? 1 : 0));

  /** @type {Record<string,string>} */
  const byComponent = {};
  /** @type {Record<string,boolean>} */
  const wonByCoLocation = {};
  for (const page of pages) {
    if (!page.component) continue;
    // `button/button.stories.tsx` documents `Button`; a template story that also
    // renders it does not. Co-location wins; otherwise the first page in sorted
    // order keeps the component, which makes the result order-independent.
    const coLocated = dirname(page.file).endsWith(`/${kebab(page.component)}`);
    if (byComponent[page.component] && (wonByCoLocation[page.component] || !coLocated)) continue;
    byComponent[page.component] = page.storyId;
    wonByCoLocation[page.component] = coLocated;
  }
  return { pages, byComponent };
}

/** `"FlowWeightedEdge"` → `"flow-weighted-edge"` — the folder convention. */
function kebab(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

/**
 * The `stories` map for ONE package: `{ Button: "core-button--docs" }`, limited
 * to the components that package exports and sorted for a stable manifest.
 *
 * @param {string} repoRoot
 * @param {{name:string}[]} components
 */
export function collectStoryIds(repoRoot, components) {
  const { byComponent } = indexStoryDocsPages(repoRoot);
  /** @type {Record<string,string>} */
  const out = {};
  for (const { name } of [...components].sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (byComponent[name]) out[name] = byComponent[name];
  }
  return out;
}
