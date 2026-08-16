#!/usr/bin/env node
/**
 * gen-templates.mjs — full-screen TEMPLATE generator (single source of truth = the stories).
 *
 * The 6 archetype templates (dashboard, settings, data-app, ai-assistant,
 * flow-workspace, marketing) live ONCE, as Storybook stories
 * (`packages/<pkg>/src/templates-<name>.stories.tsx`). Those stories ARE the
 * canonical full-screen compositions; this generator mechanically derives the
 * consumer-usable template source from each story so there is no hand-maintained
 * second copy to drift (the old `registry/templates/<name>/page.tsx` are dropped).
 *
 * The transform (verified against the historical registry pages):
 *   1. STRIP Storybook scaffolding — the `@storybook/react-vite` import, the
 *      `const meta = {…} satisfies Meta`, `export default meta`, `type Story = …`,
 *      and the `export const …: Story = { render: () => <X/> }` story exports.
 *   2. REWRITE same-package relative imports → the package alias. A story at
 *      `packages/<pkg>/src/…` importing `./foo` or `../foo` (i.e. another file in
 *      its OWN package) maps to `@elabs-ai/components-<pkg>`; cross-package imports are already
 *      `@elabs-ai/components-*` and are left untouched. (e.g. dashboard's
 *      `import { MetricGrid } from "./metric-grid/metric-grid"` → `@elabs-ai/components-charts`.)
 *   3. KEEP everything else — the `<Name>Template` component, its module-scope
 *      consts, the lucide-react imports, the `@elabs-ai/components-*` imports.
 *
 * Discovery is by GLOB (packages slash star slash src slash templates-<name>
 * .stories.tsx) so a NEW template story is picked up automatically.
 *
 *   pnpm gen:templates          # regenerate docs/playbooks/templates/**
 *
 * Output (rides into the agent kit for free — build-agent-kit copies docs/playbooks):
 *   docs/playbooks/templates/<name>.tsx   the generated consumer source
 *   docs/playbooks/templates/index.json   per-template metadata (name/title/…)
 *
 * Flags:
 *   --check   diff the regenerated set against the committed files; do NOT write.
 *             (used by `scripts/check-templates-fresh.mjs` / `pnpm templates:check`)
 *
 * Deterministic + dependency-free (sorted output, no clock). Locates the repo
 * root relative to this file, so it is cwd-independent.
 */
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = dirname(HERE); // scripts/ -> repo root
const OUT_DIR_REL = "docs/playbooks/templates";

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

/**
 * Find every templates-<name>.stories.tsx under packages/<pkg>/src. Returns
 * [{ pkgDir, pkgName, file, name }] where `name` is the archetype slug
 * (templates-<name>.stories.tsx -> <name>), sorted by name for determinism.
 */
export function discoverStories(root = REPO_ROOT) {
  const pkgsDir = join(root, "packages");
  const out = [];
  if (!existsSync(pkgsDir)) return out;
  for (const pkg of readdirSync(pkgsDir).sort()) {
    const srcDir = join(pkgsDir, pkg, "src");
    if (!existsSync(srcDir)) continue;
    const pkgJsonPath = join(pkgsDir, pkg, "package.json");
    let pkgName = `@elabs-ai/components-${pkg}`;
    if (existsSync(pkgJsonPath)) {
      try {
        pkgName = JSON.parse(readFileSync(pkgJsonPath, "utf8")).name || pkgName;
      } catch {
        /* keep the default */
      }
    }
    for (const f of readdirSync(srcDir).sort()) {
      const m = f.match(/^templates-(.+)\.stories\.tsx$/);
      if (!m) continue;
      out.push({
        pkgDir: join(pkgsDir, pkg),
        pkgName,
        file: join(srcDir, f),
        name: m[1],
        relFile: `packages/${pkg}/src/${f}`,
      });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Transform — structural (string/brace-aware), not brittle line-slicing
// ---------------------------------------------------------------------------

/** Index of the brace/paren/bracket that closes the one opened at `open` (string-aware). */
function matchDelim(src, open) {
  let depth = 0;
  let q = null;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === "\\") i++;
      else if (c === q) q = null;
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

/** The leading `/** … *\/` or `/* … *\/` block comment at the top of the file, as one line. */
function leadingBlockComment(src) {
  const m = src.match(/^\s*\/\*\*?([\s\S]*?)\*\//);
  if (!m) return "";
  return m[1]
    .split("\n")
    .map((l) => l.replace(/^\s*\*?\s?/, "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

/** Extract `meta.title` from `const meta = { title: "…", … } satisfies Meta`. */
function extractTitle(src) {
  const m = src.match(/const\s+meta\s*=\s*\{[\s\S]*?title\s*:\s*["'`]([^"'`]+)["'`]/);
  return m ? m[1] : null;
}

/**
 * The set of `@elabs-ai/components-*` packages a story imports (for the index `packages` list),
 * PLUS the story's own package alias when a same-package relative import was
 * rewritten to it. Sorted, de-duped.
 */
function collectBrandPackages(src, ownPkg, rewroteToOwn) {
  const set = new Set();
  for (const m of src.matchAll(/from\s+["'](@elabs-ai\/components-[a-z-]+)["']/g)) set.add(m[1]);
  if (rewroteToOwn) set.add(ownPkg);
  return [...set].sort();
}

/**
 * Rewrite a `from "<spec>"` clause: a same-package relative import (`./x`,
 * `../x`) maps to the package alias; everything else is untouched. Returns
 * { src, rewroteToOwn }.
 */
function rewriteRelativeImports(src, ownPkg) {
  let rewroteToOwn = false;
  const out = src.replace(/(\bfrom\s+["'])(\.\.?\/[^"']*)(["'])/g, (_all, a, _spec, c) => {
    rewroteToOwn = true;
    return `${a}${ownPkg}${c}`;
  });
  return { src: out, rewroteToOwn };
}

/**
 * Remove a top-level statement that BEGINS at a regex match and ENDS at the
 * matching closing brace of the FIRST `{` after the match's `marker`, swallowing
 * a trailing `satisfies …;` / `;`. Returns the source with the statement (and the
 * blank line it leaves) removed, or the unchanged source if no match.
 *
 * `endAfterBrace` true  → end at the close brace's statement terminator (for
 *   `const meta = {…} satisfies Meta;` / `export const X: Story = {…};`).
 */
function stripBracedStatement(src, headRe) {
  const m = headRe.exec(src);
  if (!m) return src;
  const start = m.index;
  const braceOpen = src.indexOf("{", m.index + m[0].length - 1);
  if (braceOpen < 0) return src;
  const braceClose = matchDelim(src, braceOpen);
  if (braceClose < 0) return src;
  // swallow optional `  satisfies Meta` and the terminating `;`
  let end = braceClose + 1;
  const tail = src.slice(end).match(/^\s*(?:satisfies\s+[A-Za-z0-9_<>, ]+)?\s*;?/);
  if (tail) end += tail[0].length;
  return src.slice(0, start) + src.slice(end);
}

/** Drop a whole physical line that matches `re` (e.g. `export default meta;`). */
function stripLine(src, re) {
  return src
    .split("\n")
    .filter((line) => !re.test(line))
    .join("\n");
}

/**
 * Apply the full story → consumer-template transform. Returns
 * { code, title, description, packages }.
 */
export function transformStory({ src, pkgName, name, relFile }) {
  const title = extractTitle(src);
  const description = leadingBlockComment(src) || `Full-screen ${name} template.`;

  let out = src;

  // 1a. Drop the Storybook type import line(s).
  out = stripLine(out, /import\s+type\s+\{[^}]*\}\s+from\s+["']@storybook\/[^"']+["'];?/);

  // 1b. Strip `const meta = {…} satisfies Meta;`
  out = stripBracedStatement(out, /(?:^|\n)\s*const\s+meta\s*=\s*/);

  // 1c. Strip `export default meta;`
  out = stripLine(out, /^\s*export\s+default\s+meta\s*;?\s*$/);

  // 1d. Strip `type Story = StoryObj<…>;` (a single-line type alias).
  out = stripLine(out, /^\s*type\s+Story\s*=\s*StoryObj<[^;]*>\s*;?\s*$/);

  // 1e. Strip every `export const <Name>[: Story] = { … };` story export.
  //     Loop until none remain (a story file can declare several).
  let guard = 0;
  while (/(?:^|\n)\s*export\s+const\s+[A-Za-z0-9_]+\s*(?::\s*Story\s*)?=\s*\{/.test(out)) {
    const before = out;
    out = stripBracedStatement(
      out,
      /(?:^|\n)\s*export\s+const\s+[A-Za-z0-9_]+\s*(?::\s*Story\s*)?=\s*/,
    );
    if (out === before || ++guard > 20) break;
  }

  // 2. Rewrite same-package relative imports → the package alias.
  const rewritten = rewriteRelativeImports(out, pkgName);
  out = rewritten.src;

  const packages = collectBrandPackages(out, pkgName, rewritten.rewroteToOwn);

  // Collapse 3+ blank lines (the strips leave gaps) and trim trailing whitespace.
  out = out
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/^\n+/, "")
    .trimEnd();

  const header =
    `/* GENERATED from ${relFile} by pnpm gen:templates — do not edit. */\n` +
    `/* Full-screen ${name} template (single source of truth: the Storybook story). */\n`;

  const code = header + "\n" + out + "\n";
  return { code, title, description, packages };
}

// ---------------------------------------------------------------------------
// Build — compute the generated set in memory (so --check can diff without writing)
// ---------------------------------------------------------------------------

/**
 * The generated artifacts live under `docs/playbooks/` — a Prettier-formatted
 * tree (`pnpm format:check`). So the generator must emit Prettier-STABLE output
 * or `templates:check` and `format:check` would fight forever. We run every
 * output through Prettier with the repo's own config (one authority, the same
 * contract `gen.mjs` uses), so `gen:templates` emits exactly what `format:check`
 * expects. Prettier is a devDependency present in the monorepo (where this runs).
 */
async function formatForFile(file, content) {
  const prettier = (await import("prettier")).default;
  const config = (await prettier.resolveConfig(file)) ?? {};
  return prettier.format(content, { ...config, filepath: file });
}

/**
 * Compute every generated artifact. Returns
 * { files: { "<rel path>": "<content>" }, index: <index object> }.
 */
export async function computeTemplates(root = REPO_ROOT) {
  const stories = discoverStories(root);
  const files = {};
  const index = [];
  for (const s of stories) {
    const src = readFileSync(s.file, "utf8");
    const { code, title, description, packages } = transformStory({
      src,
      pkgName: s.pkgName,
      name: s.name,
      relFile: s.relFile,
    });
    const fileRel = `${OUT_DIR_REL}/${s.name}.tsx`;
    files[fileRel] = await formatForFile(join(root, fileRel), code);
    index.push({
      name: s.name,
      title: title ?? s.name,
      description,
      packages,
      sourceStory: s.relFile,
      file: `templates/${s.name}.tsx`,
    });
  }
  index.sort((a, b) => a.name.localeCompare(b.name));
  const indexRel = `${OUT_DIR_REL}/index.json`;
  files[indexRel] = await formatForFile(
    join(root, indexRel),
    JSON.stringify(index, null, 2) + "\n",
  );
  return { files, index };
}

/** Write the computed set to disk; returns the list of written relative paths. */
export async function writeTemplates(root = REPO_ROOT) {
  const { files } = await computeTemplates(root);
  const outDir = join(root, OUT_DIR_REL);
  // Clean the generated dir so a removed story drops its file (idempotent).
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const written = [];
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
    written.push(rel);
  }
  return written.sort();
}

/**
 * Stale-check: returns the list of relative paths that differ between the
 * committed files and a fresh regeneration (plus any committed-but-orphaned
 * generated file). Empty = fresh.
 */
export async function staleTemplates(root = REPO_ROOT) {
  const { files } = await computeTemplates(root);
  const stale = [];
  const outDir = join(root, OUT_DIR_REL);
  // (a) committed differs from / is missing vs regenerated
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(root, rel);
    const current = existsSync(abs) ? readFileSync(abs, "utf8") : null;
    if (current !== content) stale.push(rel);
  }
  // (b) an on-disk generated file with no corresponding story (orphan)
  if (existsSync(outDir)) {
    for (const f of readdirSync(outDir)) {
      const rel = `${OUT_DIR_REL}/${f}`;
      if (!(rel in files)) stale.push(rel);
    }
  }
  return [...new Set(stale)].sort();
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  const check = process.argv.includes("--check");
  if (check) {
    const stale = await staleTemplates();
    if (stale.length) {
      console.error(
        "✖ generated templates are STALE:\n" +
          stale.map((f) => "  - " + f).join("\n") +
          "\n  Run `pnpm gen:templates` and commit the result.\n" +
          "  (Generated from the Storybook stories; never hand-edit docs/playbooks/templates/**.)",
      );
      process.exit(1);
    }
    console.log("✔ generated templates are fresh.");
  } else {
    const written = await writeTemplates();
    console.log(`Wrote ${written.length} template artifact(s):`);
    for (const f of written) console.log(`  ${f}`);
  }
}
