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
 *  - `catalog-nav.json` — smallest: what navigation, breadcrumbs and the picker need (section,
 *    slug, name, group, package, component). The client shell imports it.
 *  - `catalog-index.json` — small: the nav fields plus the purpose/question text search matches
 *    on. Server components import it; the client loads it on demand (the search dialog, the
 *    rail filter) so the home page's initial JS does not carry every summary.
 *  - `catalog-pages.json` — large: everything a detail page renders. Server components only.
 *
 * Deterministic: sorted walks, no clock, no environment.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { indexStoryDocsPages, sanitizeStorySegment } from "../../packages/cli/lib/story-ids.mjs";
import { visitorCopy, visitorLead } from "./visitor-copy.mjs";

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

/**
 * The story file's `parameters.docs.description.component` as plain text, whatever string
 * form it is written in — one literal, a `+` concatenation, a template literal — with the
 * markdown markers dropped.
 */
export function docsDescription(src) {
  const at = src.search(/description:\s*\{\s*component:/);
  if (at < 0) return "";
  const rest = src.slice(at + src.slice(at).indexOf("component:") + "component:".length);
  // The value runs until the first `,` or `}` outside a string literal.
  const literals = [];
  let i = 0;
  let quote = null;
  let buf = "";
  for (; i < rest.length; i++) {
    const ch = rest[i];
    if (quote) {
      if (ch === "\\") {
        const next = rest[i + 1];
        buf += next === "n" ? " " : next;
        i++;
      } else if (ch === quote) {
        literals.push(buf);
        buf = "";
        quote = null;
      } else buf += ch;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "," || ch === "}") break;
  }
  return (
    literals
      .join("")
      // The lead is the prose before any markdown section or code fence.
      .split(/\s(?:#{1,6}\s|```)/)[0]
      .replace(/\*\*/g, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * The JSDoc right above a component's export in its own module — `/** Keyboard key hint …
 * *\/ export const Kbd` — the description the component's author wrote. The lead of last
 * resort for a page whose component has no intent record and whose story file has no doc.
 */
function componentDoc(repoRoot, module, name) {
  if (!module || !name) return "";
  const file = join(repoRoot, module);
  if (!existsSync(file)) return "";
  const src = readFileSync(file, "utf8");
  const re = new RegExp(
    `(\\/\\*\\*(?:(?!\\*\\/)[\\s\\S])*?\\*\\/)\\s*export\\s+(?:const|function|class)\\s+${name}\\b`,
  );
  const block = src.match(re)?.[1];
  return block ? cleanJsDoc(block) : "";
}

const slugOf = (title) => sanitizeStorySegment(title.split("/").at(-1));

/**
 * Which part of the site a docs page belongs to, from its Storybook title.
 *
 * Explore holds what the components ADD UP to — templates (whole products), blocks (app
 * compositions) and visualizations (data-viz use cases: KPI cards, infographics, editorial
 * charts, command centers, dashboard recipes). Everything a package exports, the chart types
 * included, is a component (`scripts/lib/home-catalog-layout.json`).
 */
function sectionOf(title, layout) {
  if (title.startsWith("Patterns/Blocks/"))
    return layout.visualizationFamilies.includes(title.split("/")[2]) ? "visualizations" : "blocks";
  // A scenario is a full screen too; the site lists both as templates.
  if (title.startsWith("Patterns/Templates/") || title.startsWith("Patterns/Scenarios/"))
    return "templates";
  return "components";
}

export function buildCatalog(manifest, registry, { repoRoot }) {
  // Pages whose Storybook title changed since the last deploy: new story id → the id the
  // deployed Storybook still answers to (scripts/lib/home-story-retitles.json).
  const retitles = JSON.parse(
    readFileSync(join(repoRoot, "scripts/lib/home-story-retitles.json"), "utf8"),
  ).titles;
  const aliases = {};
  // Website-only family of a component whose Storybook group names another package.
  const componentGroups = JSON.parse(
    readFileSync(join(repoRoot, "scripts/lib/home-component-groups.json"), "utf8"),
  ).groups;
  const layout = JSON.parse(
    readFileSync(join(repoRoot, "scripts/lib/home-catalog-layout.json"), "utf8"),
  );
  // page name (or full title) → family, per package; every name must be claimed exactly once.
  const familyOf = {};
  const unclaimed = new Set();
  for (const [pkg, families] of Object.entries(layout.families)) {
    familyOf[pkg] = new Map();
    for (const [family, names] of Object.entries(families))
      for (const name of names) {
        if (familyOf[pkg].has(name))
          throw new Error(`home-catalog-layout.json: ${pkg} lists "${name}" in two families`);
        familyOf[pkg].set(name, family);
        unclaimed.add(`${pkg}/${name}`);
      }
  }
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
  const usedLegacy = new Set();
  const redirects = [];
  const pages = {};
  const index = [];

  for (const page of docsPages) {
    const src = readFileSync(join(repoRoot, page.file), "utf8");
    const pkgDir = page.file.startsWith("packages/") ? page.file.split("/")[1] : null;
    const own = page.component ? owner.get(page.component) : null;
    const move = layout.moves.find(
      (m) => page.title.startsWith(m.prefix) && !(m.onlyOutsidePackages && pkgDir),
    );
    const section = move?.section ?? sectionOf(page.title, layout);
    const pkgShort =
      move?.package ?? pkgDir ?? own?.pkg.replace("@elabs-ai/components-", "") ?? "patterns";

    const parts = page.title.split("/");
    const name = parts.at(-1);
    const inExplore = section === "blocks" || section === "visualizations";
    let group;
    if (move?.group) group = move.group;
    else if (section === "templates" || inExplore)
      group =
        parts[1] === "Scenarios"
          ? // Both scenarios the library ships are AI products (an agentic workspace, a chat).
            "AI Products"
          : parts.length > 3
            ? parts[2]
            : inExplore
              ? "Compositions"
              : "Templates";
    else if (familyOf[pkgShort]) {
      const byTitle = familyOf[pkgShort].has(page.title);
      group = familyOf[pkgShort].get(byTitle ? page.title : name);
      if (!group)
        throw new Error(
          `home-catalog-layout.json: families.${pkgShort} does not place "${page.title}"`,
        );
      unclaimed.delete(`${pkgShort}/${byTitle ? page.title : name}`);
    } else group = componentGroups[`${pkgShort}/${parts[0]}`] ?? parts[0];

    // A block's short name only reads inside its family ("Pace", "Forecast"), so its URL
    // carries the family too: /visualizations/kpi-cards-pace, /blocks/app-shells-flagship.
    let slug = inExplore
      ? sanitizeStorySegment(
          parts.length > 3 ? parts.slice(-2).join("-") : move?.group ? `${group}-${name}` : name,
        )
      : slugOf(page.title);
    const keyFor = (s) => `${section}/${section === "components" ? `${pkgShort}/` : ""}${s}`;
    if (used.has(keyFor(slug))) slug = sanitizeStorySegment(parts.slice(-2).join("-"));
    if (used.has(keyFor(slug)))
      throw new Error(`home-catalog: two pages resolve to ${keyFor(slug)}`);
    used.add(keyFor(slug));

    // Where this page lived before the 2026-09 reorganisation (four sections, `/charts` among
    // them, families inside `/blocks`). A moved page keeps answering at its old address through
    // a permanent redirect (`catalog-redirects.json` → next.config.ts).
    const legacySection = page.title.startsWith("Patterns/Blocks/")
      ? "blocks"
      : page.title.startsWith("Charts/")
        ? "charts"
        : sectionOf(page.title, layout) === "templates"
          ? "templates"
          : "components";
    const legacyPkg = pkgDir ?? own?.pkg.replace("@elabs-ai/components-", "") ?? "patterns";
    const legacyBase = `/${legacySection}${legacySection === "components" ? `/${legacyPkg}` : ""}`;
    let legacySlug =
      legacySection === "blocks" && parts.length > 3
        ? sanitizeStorySegment(parts.slice(-2).join("-"))
        : slugOf(page.title);
    if (usedLegacy.has(`${legacyBase}/${legacySlug}`))
      legacySlug = sanitizeStorySegment(parts.slice(-2).join("-"));
    usedLegacy.add(`${legacyBase}/${legacySlug}`);
    const href = `/${section}${section === "components" ? `/${pkgShort}` : ""}/${slug}`;
    if (`${legacyBase}/${legacySlug}` !== href)
      redirects.push({ source: `${legacyBase}/${legacySlug}`, destination: href });
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
    // A full-screen template that ships as a registry page names its item in the story's own
    // import: `@/components/<item>/…` with an item ending in `-page`.
    const pageItem = src.match(/from "@\/components\/([a-z0-9-]+-page)\//)?.[1] ?? null;
    // An archetype starter (`packages/<pkg>/src/templates-<name>.stories.tsx`) whose screen also
    // ships as the copy-own registry page `<name>-page` is that page.
    const starterItem = page.file.match(/\/templates-([a-z0-9-]+)\.stories\.tsx$/)?.[1];
    const block =
      registryByName.get(blockName ?? pageItem ?? (starterItem ? `${starterItem}-page` : "")) ??
      null;
    const template =
      section === "templates"
        ? ((manifest.templates ?? []).find((t) => t.title === page.title) ?? null)
        : null;

    const stories = storiesOf(src, page.title);
    const oldTitle = retitles[page.title];
    if (oldTitle)
      for (const story of stories)
        aliases[story.id] = `${sanitizeStorySegment(oldTitle)}--${story.id.split("--")[1]}`;
    // A full screen with no component intent and no registry item still says what it is in its
    // docs description; its first sentence is the card's summary.
    const docsLead = docsDescription(src);
    // Every lead is VISITOR copy (`visitor-copy.mjs`): maintainer prose — roadmap items,
    // ADRs, issues, fixtures, repo paths — never reaches the site's headers. Order: the
    // authored intent purpose, the registry description, the docs description, then the
    // component's own JSDoc.
    const summary =
      visitorCopy(intent?.purpose) ||
      visitorCopy(block?.description) ||
      visitorLead(docsLead) ||
      visitorLead(componentDoc(repoRoot, own?.module, page.component));
    // The question a block answers, authored once as the docs page's subtitle.
    const question =
      src
        .match(/\bdocs:\s*\{\s*subtitle:\s*(["'`])((?:\\.|(?!\1).)*)\1/)?.[2]
        ?.replace(/\\(.)/g, "$1") ?? "";

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
      about: section === "templates" ? "" : visitorCopy(fileDoc(src)),
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

  if (unclaimed.size > 0)
    throw new Error(
      `home-catalog-layout.json names pages the catalogue does not have: ${[...unclaimed].sort().join(", ")}`,
    );

  // `featured`: the 1-based place a page takes on its branch's top-level listing, 0 for none.
  // Authored per branch; a branch nobody curated leads with its most-exampled pages.
  const FALLBACK_FEATURED = 6;
  const branchOf = (e) => (e.section === "components" ? `components/${e.package}` : e.section);
  const byBranch = new Map();
  for (const entry of index) {
    const list = byBranch.get(branchOf(entry)) ?? [];
    list.push(entry);
    byBranch.set(branchOf(entry), list);
  }
  for (const [branch, slugs] of Object.entries(layout.featured)) {
    const missing = slugs.filter(
      (slug) => !(byBranch.get(branch) ?? []).some((e) => e.slug === slug),
    );
    if (missing.length > 0)
      throw new Error(
        `home-catalog-layout.json: featured.${branch} names no page: ${missing.join(", ")}`,
      );
  }
  for (const [branch, list] of byBranch) {
    const picked =
      layout.featured[branch] ??
      [...list]
        .sort((a, b) => b.stories - a.stories || (a.slug < b.slug ? -1 : 1))
        .slice(0, FALLBACK_FEATURED)
        .map((e) => e.slug);
    for (const entry of list) entry.featured = picked.indexOf(entry.slug) + 1;
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
  // The retired listing pages, then every moved detail page.
  redirects.sort((a, b) => (a.source < b.source ? -1 : 1));
  redirects.unshift(
    { source: "/charts", destination: "/components/charts" },
    { source: "/components/patterns", destination: "/components" },
  );
  const taken = new Set(
    index.map((e) => `/${e.section}${e.section === "components" ? `/${e.package}` : ""}/${e.slug}`),
  );
  const shadowed = redirects.filter((r) => taken.has(r.source));
  if (shadowed.length > 0)
    throw new Error(
      `home-catalog: a redirect would hide a live page: ${shadowed.map((r) => r.source).join(", ")}`,
    );
  // Reading order of a package's website families, as authored in the layout file.
  const familyOrder = Object.fromEntries(
    Object.entries(layout.families).map(([pkg, families]) => [pkg, Object.keys(families)]),
  );
  // The client shell ships only what it renders at first paint: the search text stays behind.
  const nav = index.map(({ section, slug, name, group, package: pkg, component }) => ({
    section,
    slug,
    name,
    group,
    package: pkg,
    component,
  }));
  return { index, nav, pages, aliases, redirects, familyOrder };
}
