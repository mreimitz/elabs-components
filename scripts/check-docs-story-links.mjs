#!/usr/bin/env node
/**
 * check-docs-story-links.mjs — the docs cross-link gate.
 *
 * `apps/docs/stories/Choosing-Between-Similar-Components.mdx` (and the story
 * descriptions that point back at it) navigate the reader between look-alike
 * components with Storybook links of the form
 *
 *     [Layout/ViewToolbar](?path=/docs/layout-viewtoolbar--docs)
 *     [AI/Tool](?path=/story/ai-tool--default)
 *
 * A story TITLE is the sole input to a story id, so renaming a title silently
 * breaks every link that named it — and a broken link in the one page whose job
 * is disambiguation is worse than no page. Storybook itself does not fail a
 * build over a dead `?path=` link, so this gate does.
 *
 * It asserts, for every `?path=` link in a docs MDX page or a story file:
 *
 *   1. the component half of the id (everything before the last `--`) is the
 *      sanitized title of a story file or MDX `<Meta>` that actually exists;
 *   2. a `--docs` link additionally resolves to a CSF file carrying
 *      `tags: ["autodocs"]` — without that tag Storybook renders no docs entry,
 *      so the link 404s even though the title is right. (An MDX `<Meta>` page is
 *      itself a docs entry and needs no tag.)
 *
 * DECLARED LIMIT — the STORY half of a `/story/<id>--<slug>` link is not
 * checked. Storybook derives a story's slug from its export name through
 * `storyNameFromExport` (`startCase(camelCase(name))`, plus a per-story `name`
 * override); re-implementing that here would make this gate a second, drifting
 * source of truth for a Storybook internal. The failure this gate exists to
 * catch is a renamed TITLE, which the component half catches for both link
 * shapes. A renamed story EXPORT inside a file whose title is unchanged is not
 * caught — say so rather than implying coverage.
 *
 * Dependency-free; locates the workspace relative to this file (cwd-independent).
 * Pass `--root <dir>` to point it at a fixture (the self-test does this).
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const DEFAULT_ROOT = dirname(dirname(fileURLToPath(import.meta.url))); // scripts/ → root

/**
 * Titles that are about to move in a story-title cleanup landing on a sibling
 * branch. A link may name the TARGET title while the file still carries the
 * CURRENT one, so the page can be written against the title it will have at
 * merge time without this gate going red in between.
 *
 * Each entry is checked, not waved through: the named file must exist and must
 * still carry one of the two titles. Once the retitle lands, the ordinary path
 * matches on its own and the entry is dead weight — delete it then.
 */
const PENDING_RETITLES = [
  {
    id: "layout-toolbar",
    file: "packages/ui/src/components/toolbar/toolbar.stories.tsx",
    from: "Foundation/Toolbar",
    to: "Layout/Toolbar",
  },
];

/**
 * `sanitize` from `@storybook/csf` — the function that turns a title into the
 * component half of a story id. Kept byte-compatible with upstream rather than
 * approximated: an id this gate computes differently from Storybook would make
 * every assertion below meaningless.
 */
export function sanitize(string) {
  return string
    .toLowerCase()
    .replace(/[ '’–—―′¿`~!@#$%^&*()_|+\-=?;:",.<>{}[\]\\/]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

/** Every file under `dir` (recursively) whose name passes `match`. */
function walk(dir, match, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, match, out);
    else if (entry.isFile() && match(entry.name)) out.push(full);
  }
  return out;
}

/**
 * Every story title in the repo, mapped to the file that declares it.
 *
 * HEURISTIC, stated plainly: a `title:` whose value contains a `/` is a story
 * title. Story files also carry `title:` inside sample DATA ("Book a demo",
 * "Recent invoices", a Flow node label) — none of those is a path, and a story
 * title in this repo always is. The cost of the heuristic is a permissive
 * lookup, never a missed rename.
 */
function collectTitles(root) {
  const titles = new Map(); // sanitized id → { title, file, autodocs }
  const storyFiles = [
    ...walk(join(root, "packages"), (n) => /\.stories\.(ts|tsx)$/.test(n)),
    ...walk(join(root, "apps"), (n) => /\.stories\.(ts|tsx)$/.test(n)),
  ];
  for (const file of storyFiles) {
    const src = readFileSync(file, "utf8");
    const autodocs = /autodocs/.test(src);
    for (const m of src.matchAll(/\btitle:\s*"([^"]*\/[^"]*)"/g)) {
      const id = sanitize(m[1]);
      if (!titles.has(id)) titles.set(id, { title: m[1], file, autodocs });
    }
  }
  for (const file of walk(join(root, "apps"), (n) => n.endsWith(".mdx"))) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/<Meta\b[^>]*\btitle=["']([^"']+)["']/g)) {
      const id = sanitize(m[1]);
      if (!titles.has(id)) titles.set(id, { title: m[1], file, autodocs: true });
    }
  }
  return titles;
}

/** Every `?path=/docs|story/<id>` link in the docs pages and the story files. */
function collectLinks(root) {
  const files = [
    ...walk(join(root, "apps"), (n) => n.endsWith(".mdx")),
    ...walk(join(root, "packages"), (n) => /\.stories\.(ts|tsx)$/.test(n)),
    ...walk(join(root, "apps"), (n) => /\.stories\.(ts|tsx)$/.test(n)),
  ];
  const links = [];
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    const lines = src.split("\n");
    lines.forEach((line, i) => {
      for (const m of line.matchAll(/\?path=\/(docs|story)\/([a-z0-9-]+)/g)) {
        const kind = m[1];
        const full = m[2];
        // Ids are `<sanitized title>--<sanitized story name>`; the title half
        // never contains `--`, so the LAST separator is the real one.
        const cut = full.lastIndexOf("--");
        if (cut <= 0) continue; // `<storyId>` placeholders in prose, not a link
        links.push({
          file,
          line: i + 1,
          kind,
          id: full.slice(0, cut),
          suffix: full.slice(cut + 2),
        });
      }
    });
  }
  return links;
}

export function checkDocsStoryLinks(root = DEFAULT_ROOT) {
  const titles = collectTitles(root);
  const links = collectLinks(root);
  const errors = [];

  const pendingById = new Map(PENDING_RETITLES.map((p) => [p.id, p]));
  // A pending entry is only meaningful for an id something actually links to;
  // an unreferenced one is dead weight, not a failure.
  const referenced = new Set(links.map((l) => l.id));
  for (const pending of PENDING_RETITLES) {
    if (!referenced.has(pending.id) || titles.has(pending.id)) continue;
    const abs = join(root, pending.file);
    if (!existsSync(abs) || !statSync(abs).isFile()) {
      errors.push(
        `${pending.file}: pending-retitle entry "${pending.id}" names a file that does not exist. ` +
          `Update PENDING_RETITLES in scripts/check-docs-story-links.mjs.`,
      );
      continue;
    }
    const src = readFileSync(abs, "utf8");
    if (!src.includes(`"${pending.from}"`) && !src.includes(`"${pending.to}"`)) {
      errors.push(
        `${pending.file}: pending-retitle entry "${pending.id}" expects the title to be ` +
          `"${pending.from}" or "${pending.to}", and it is neither. Update PENDING_RETITLES.`,
      );
    }
  }

  for (const link of links) {
    const rel = relative(root, link.file);
    const known = titles.get(link.id);
    if (!known) {
      if (pendingById.has(link.id)) continue; // covered by the pending check above
      errors.push(
        `${rel}:${link.line}: ?path=/${link.kind}/${link.id}--${link.suffix} — no story or docs ` +
          `entry has the title that produces "${link.id}".`,
      );
      continue;
    }
    if (link.kind === "docs" && link.suffix === "docs" && !known.autodocs) {
      errors.push(
        `${rel}:${link.line}: ?path=/docs/${link.id}--docs — "${known.title}" ` +
          `(${relative(root, known.file)}) has no \`tags: ["autodocs"]\`, so it renders no docs ` +
          `entry. Link a story (?path=/story/${link.id}--<story>) or add the tag.`,
      );
    }
  }

  return { errors, linkCount: links.length, titleCount: titles.size };
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === join(process.argv[1]);

if (invokedDirectly) {
  const rootFlag = process.argv.indexOf("--root");
  const root = rootFlag !== -1 ? process.argv[rootFlag + 1] : DEFAULT_ROOT;
  const { errors, linkCount, titleCount } = checkDocsStoryLinks(root);
  if (errors.length > 0) {
    console.error(`\n✖ docs-story-links gate FAILED — ${errors.length} broken link(s):\n`);
    for (const e of errors) console.error(`  ${e}`);
    console.error(
      "\nStory ids come from story TITLES. Fix the link, or restore the title it named.\n",
    );
    process.exit(1);
  }
  console.log(
    `✔ docs-story-links: ${linkCount} Storybook link(s) resolve against ${titleCount} title(s).`,
  );
}
