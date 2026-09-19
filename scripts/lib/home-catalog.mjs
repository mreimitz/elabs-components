/**
 * home-catalog.mjs — the website's catalogue (apps/home), generated from the two sources that
 * already describe the library: the manifest (purpose, relationships, anti-patterns, props,
 * variants — what `brand-ui docs <Name>` prints) and the story files (every example, with the
 * JSDoc sentence its author wrote above it).
 *
 * One record per Storybook DOCS page (`indexStoryDocsPages`): a component page, a chart page, a
 * registry block, a template. The site renders a detail page from each record and embeds the
 * page's stories as live previews, so an example on the site is never a second copy of a story.
 *
 * Two outputs, split by who reads them:
 *  - `catalog-index.json` — small: navigation + search (slug, name, section, group, purpose).
 *    Client components import it.
 *  - `catalog-pages.json` — large: everything a detail page renders. Server components only.
 *
 * Deterministic: sorted walks, no clock, no environment.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { indexStoryDocsPages, sanitizeStorySegment } from "../../packages/cli/lib/story-ids.mjs";

/** lodash `startCase`, close enough for export names: `CssCheck` → `Css Check`, `Sidebar04` → `Sidebar 04`. */
export function startCase(name) {
  const words = String(name).match(/[A-Z]+(?=[A-Z][a-z])|[A-Z]?[a-z]+|[A-Z]+|\d+/g) ?? [];
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/** Storybook's story id for an export: `toId(title, storyNameFromExport(key))`. */
export function storyIdFor(title, exportName) {
  return `${sanitizeStorySegment(title)}--${sanitizeStorySegment(startCase(exportName))}`;
}

/** The text of a JSDoc block: stars, tags and markdown emphasis removed, paragraphs joined. */
function cleanJsDoc(block) {
  return block
    .trim()
    .replace(/^\/\*\*/, "")
    .replace(/\*\/$/, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, ""))
    .filter((line) => !/^@\w+/.test(line.trim()))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Every story a file exports, in source order. A story tagged `!dev` or `!autodocs` is a test
 * fixture, not an example, and is left out. `name:` (a two-space-indented key of the story
 * object) wins over the export name, exactly as in Storybook's sidebar.
 */
export function storiesOf(src, title) {
  const re = /^export const ([A-Za-z0-9_$]+)\s*(?::[^=\n]+)?=/gm;
  const found = [];
  for (let m = re.exec(src); m; m = re.exec(src)) found.push({ name: m[1], at: m.index });
  const out = [];
  found.forEach((story, i) => {
    if (story.name === "meta" || /^[a-z]/.test(story.name)) return;
    const body = src.slice(story.at, found[i + 1]?.at ?? src.length);
    if (/\n\s{2}tags:\s*\[[^\]]*["']!(dev|autodocs)["']/.test(body)) return;
    const before = src.slice(0, story.at);
    const doc = before.match(/\/\*\*(?:(?!\*\/)[\s\S])*\*\/\s*$/)?.[0] ?? "";
    const helperName = body.match(/=\s*(?:\{\s*\.\.\.)?story\(\s*"((?:\\.|[^"\\])*)"/)?.[1];
    const ownName = body.match(/\n\s{2}name:\s*(["'`])((?:\\.|(?!\1).)*)\1/)?.[2];
    out.push({
      id: storyIdFor(title, story.name),
      name: ownName ?? helperName ?? startCase(story.name),
      description: doc ? cleanJsDoc(doc) : "",
    });
  });
  return out;
}

/** The JSDoc block at the top of a story file (its reason for existing), or "". */
function fileDoc(src) {
  const head = src.slice(0, src.search(/^import\s/m) > 0 ? src.search(/^import\s/m) : 0);
  const block = head.match(/\/\*\*[\s\S]*?\*\//)?.[0];
  return block ? cleanJsDoc(block) : "";
}

const slugOf = (title) => sanitizeStorySegment(title.split("/").at(-1));

/** Which part of the site a docs page belongs to, from its Storybook title. */
function sectionOf(title) {
  if (title.startsWith("Patterns/Blocks/")) return "blocks";
  if (title.startsWith("Patterns/Templates/")) return "templates";
  if (title.startsWith("Charts/")) return "charts";
  return "components";
}

export function buildCatalog(manifest, registry, { repoRoot }) {
  // Pages whose Storybook title changed since the last deploy: new story id → the id the
  // deployed Storybook still answers to (scripts/lib/home-story-retitles.json).
  const retitles = JSON.parse(
    readFileSync(join(repoRoot, "scripts/lib/home-story-retitles.json"), "utf8"),
  ).titles;
  const aliases = {};
  const { pages: docsPages } = indexStoryDocsPages(repoRoot);

  // name → { pkg, module } for every exported component, and per-package lookups.
  const owner = new Map();
  for (const [pkgName, pkg] of Object.entries(manifest.packages)) {
    const lists = [pkg.components ?? []];
    for (const [subpath, sub] of Object.entries(pkg.subpaths ?? {})) {
      for (const c of sub.components ?? [])
        if (!owner.has(c.name))
          owner.set(c.name, { pkg: pkgName, from: subpath, module: c.module });
    }
    for (const c of lists.flat())
      owner.set(c.name, { pkg: pkgName, from: pkgName, module: c.module });
  }
  const lookup = (kind, name) => {
    const own = owner.get(name);
    return own ? (manifest.packages[own.pkg]?.[kind]?.[name] ?? null) : null;
  };

  const registryByName = new Map((registry.items ?? []).map((item) => [item.name, item]));
  const used = new Set();
  const pages = {};
  const index = [];

  for (const page of docsPages) {
    const src = readFileSync(join(repoRoot, page.file), "utf8");
    const section = sectionOf(page.title);
    const pkgDir = page.file.startsWith("packages/") ? page.file.split("/")[1] : null;
    const own = page.component ? owner.get(page.component) : null;
    const pkgShort = pkgDir ?? own?.pkg.replace("@elabs-ai/components-", "") ?? "patterns";

    // A block's short name only reads inside its family ("Pace", "Forecast"), so its URL
    // carries the family too: /blocks/kpi-cards-pace.
    const titleParts = page.title.split("/");
    let slug =
      section === "blocks" && titleParts.length > 3
        ? sanitizeStorySegment(titleParts.slice(-2).join("-"))
        : slugOf(page.title);
    const key = `${section}/${section === "components" ? `${pkgShort}/` : ""}${slug}`;
    if (used.has(key)) slug = sanitizeStorySegment(page.title.split("/").slice(-2).join("-"));
    used.add(`${section}/${section === "components" ? `${pkgShort}/` : ""}${slug}`);

    const parts = page.title.split("/");
    const group =
      section === "blocks" || section === "templates"
        ? parts.length > 3
          ? parts[2]
          : section === "blocks"
            ? "Compositions"
            : "Templates"
        : parts[0];
    const intent = page.component ? lookup("intent", page.component) : null;

    // The component's own props plus those of the parts declared in the same folder
    // (Card → CardHeader, CardTitle, …), so a page documents the whole compound.
    const api = [];
    if (own) {
      // Parts: same-folder exports named after the component (Card → CardHeader) plus what the
      // intent record says it contains (BarChart → Bar, BarXAxis). Flat folders (every chart in
      // one directory) are why "same folder" alone is not the rule.
      const dir = own.module.slice(0, own.module.lastIndexOf("/"));
      const base = page.component.replace(/(Chart|Root|Provider)$/, "");
      const named = [...owner.entries()]
        .filter(
          ([name, o]) =>
            o.pkg === own.pkg &&
            o.module.startsWith(`${dir}/`) &&
            name !== page.component &&
            base.length > 2 &&
            name.startsWith(base),
        )
        .map(([name]) => name)
        .sort();
      const contained = (intent?.relationships?.contains ?? []).filter((name) => owner.has(name));
      const siblings = [page.component, ...new Set([...named, ...contained])].slice(0, 14);
      for (const name of siblings) {
        const props = lookup("props", name);
        const variants = lookup("variants", name);
        if (!props && !variants) continue;
        api.push({
          name,
          extends: props?.extends ?? [],
          props: props?.props ?? [],
          variants: variants?.variants ?? null,
          defaultVariants: variants?.defaultVariants ?? null,
        });
      }
    }

    const blockName = page.file.startsWith("apps/docs/stories/blocks/")
      ? page.file
          .split("/")
          .at(-1)
          .replace(/\.stories\.tsx$/, "")
      : null;
    const block = blockName ? (registryByName.get(blockName) ?? null) : null;
    const template =
      section === "templates"
        ? ((manifest.templates ?? []).find((t) => t.title === page.title) ?? null)
        : null;

    const stories = storiesOf(src, page.title);
    const oldTitle = retitles[page.title];
    if (oldTitle)
      for (const story of stories)
        aliases[story.id] = `${sanitizeStorySegment(oldTitle)}--${story.id.split("--")[1]}`;
    const name = parts.at(-1);
    const summary = intent?.purpose ?? block?.description ?? "";
    // The question a block answers, authored once as the docs page's subtitle.
    const question =
      src.match(/\bsubtitle:\s*(["'`])((?:\\.|(?!\1).)*)\1/)?.[2]?.replace(/\\(.)/g, "$1") ?? "";

    pages[`${section}/${section === "components" ? `${pkgShort}/` : ""}${slug}`] = {
      section,
      slug,
      name,
      title: page.title,
      group,
      package: pkgShort,
      component: page.component || null,
      importFrom: own?.from ?? null,
      docsId: page.storyId,
      file: page.file,
      summary,
      question,
      // A template's file comment is maintainer notes (how its source is derived), not a
      // description of the screen — the site leads with the use case instead.
      about: section === "templates" ? "" : fileDoc(src),
      intent,
      api,
      stories,
      block: block
        ? {
            name: block.name,
            title: block.title,
            description: block.description ?? "",
            categories: block.categories ?? [],
            dependencies: block.dependencies ?? [],
            registryDependencies: block.registryDependencies ?? [],
          }
        : null,
      template: template
        ? {
            name: template.name,
            // First sentence only: the rest is the same maintainer note.
            description: String(template.description ?? "").split(/(?<=\.)\s/)[0] ?? "",
            packages: template.packages,
          }
        : null,
    };
    index.push({
      section,
      slug,
      name,
      group,
      package: pkgShort,
      component: page.component || null,
      summary,
      question,
      // The registry item behind a block page — what the site renders natively when it has a copy.
      block: block?.name ?? null,
      stories: stories.length,
      first: stories[0]?.id ?? null,
    });
  }

  index.sort((a, b) =>
    a.section !== b.section
      ? a.section < b.section
        ? -1
        : 1
      : a.name.toLowerCase() < b.name.toLowerCase()
        ? -1
        : 1,
  );
  return { index, pages, aliases };
}
