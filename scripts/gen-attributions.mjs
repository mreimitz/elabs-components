#!/usr/bin/env node
/**
 * Generate the attribution dataset, for both audiences.
 *
 * ONE dataset, TWO outputs:
 *   - `packages/ui/src/components/attribution-panel/attributions.generated.ts`
 *     — what `AttributionPanel` renders in-product.
 *   - `ATTRIBUTION.md` — the public, human-readable credits page linked from the
 *     README. Only the region between the `brand-ui:gen:attributions` markers is
 *     generated; the prose around it is hand-authored.
 * Generating both from one dataset is what stops the page and the product from
 * disagreeing about what this repo actually ships.
 *
 * WHY THIS IS GENERATED. A hand-kept credits list is wrong the day after it is
 * written: a dependency is added, a package is dropped, a font is swapped, and
 * nothing fails — the notice silently misstates what the product actually ships.
 * So the dataset is DERIVED from the repo on every run, and `--check` refuses a
 * stale committed copy (the manifest-gate pattern, per the "enforcement over
 * reminders" rule in .claude/rules/quality-gates.md).
 *
 * Three inputs, two of them derived:
 *   1. npm dependencies  — every non-`@elabs/*` runtime `dependencies`
 *      entry of every DISTRIBUTABLE package, with its licence/author/version read
 *      from the installed `node_modules` copy. Runtime deps only: a devDependency
 *      is not shipped to anyone, so crediting it would overstate what we ship.
 *   2. vendored fonts    — `packages/tokens/src/fonts/<face>/OFL.txt`, whose first
 *      `Copyright …` line IS the notice the licence asks us to carry.
 *   3. curated sources   — `scripts/attributions.sources.json`: the notices that
 *      cannot be derived because they are not npm packages (adapted source such as
 *      shadcn/ui or mapcn, and runtime DATA such as CARTO / OpenStreetMap).
 *
 * Usage:
 *   node scripts/gen-attributions.mjs            # write the generated module
 *   node scripts/gen-attributions.mjs --check    # fail if the committed copy is stale
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { format, resolveConfig } from "prettier";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const OUT_FILE = join(
  root,
  "packages/ui/src/components/attribution-panel/attributions.generated.ts",
);
const ATTRIBUTION_FILE = join(root, "ATTRIBUTION.md");
const SOURCES_FILE = join(here, "attributions.sources.json");
const FONTS_DIR = join(root, "packages/tokens/src/fonts");

/** Category render order — required legal notices first, bulk dependencies last. */
export const CATEGORY_ORDER = ["data", "source", "font", "dependency"];

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

/**
 * Every package that actually ships to a consumer. Mirrors the "on the train"
 * test used by `set-version.mjs`: it declares `publishConfig`, or it is not
 * `private`. A package nobody installs contributes no attribution.
 */
export function distributablePackages(packagesDir) {
  if (!existsSync(packagesDir)) return [];
  return readdirSync(packagesDir)
    .map((d) => join(packagesDir, d, "package.json"))
    .filter((p) => existsSync(p))
    .map((p) => ({ path: p, json: readJson(p) }))
    .filter(({ json }) => json.publishConfig || !json.private)
    .sort((a, b) => a.json.name.localeCompare(b.json.name));
}

/**
 * `author` is a string in some manifests and an object in others, and the string
 * form often carries `<email>` and `(https://homepage)`. Both are stripped: a
 * copyright line wants a name, and an embedded URL would also register the
 * author's homepage as a reachable origin in `pnpm origins:check` — turning the
 * network inventory into a list of maintainers' blogs.
 */
export function normalizeAuthor(author) {
  const clean = (s) =>
    s
      .replace(/\s*<[^>]*>/g, "")
      .replace(/\s*\((?:https?:)?\/\/[^)]*\)/g, "")
      .replace(/\s*\(www\.[^)]*\)/g, "")
      .trim() || null;
  if (!author) return null;
  if (typeof author === "string") return clean(author);
  return author.name ? clean(author.name) : null;
}

/**
 * Link a dependency to its npm page rather than to its own homepage.
 *
 * Not a cosmetic choice. `pnpm origins:check` inventories every `https://` origin
 * reachable from shipped source, and each one must be declared in
 * `scripts/remote-origins-allowlist.json` with a CSP directive and an escape
 * hatch — deliberately, so nobody adds a network origin silently. Emitting each
 * package's own homepage would inject ~60 arbitrary origins into that
 * security-review artifact in one commit, burying the entries that describe real
 * fetches. One origin for all of them keeps the inventory meaningful, and the npm
 * page is the better target anyway: it shows the licence, the repo and the
 * version actually installed.
 */
export function npmUrl(depName) {
  return `https://www.npmjs.com/package/${depName}`;
}

/**
 * Resolve a dependency's installed manifest. pnpm symlinks each package's own
 * `node_modules`, so the consuming package's copy is the truthful one (that is
 * the version IT resolves); the workspace root is the fallback.
 */
function resolveDepManifest(depName, consumerPkgPath) {
  const candidates = [
    join(dirname(consumerPkgPath), "node_modules", depName, "package.json"),
    join(root, "node_modules", depName, "package.json"),
  ];
  for (const c of candidates) if (existsSync(c)) return readJson(c);
  return null;
}

/** npm runtime dependencies of every distributable package, deduped by name. */
export function collectDependencies(packagesDir) {
  const byName = new Map();
  for (const { path, json } of distributablePackages(packagesDir)) {
    for (const dep of Object.keys(json.dependencies || {})) {
      if (dep.startsWith("@elabs/")) continue; // first-party, not an attribution
      const manifest = resolveDepManifest(dep, path);
      const existing = byName.get(dep);
      if (existing) {
        if (!existing.usedBy.includes(json.name)) existing.usedBy.push(json.name);
        continue;
      }
      byName.set(dep, {
        id: dep,
        category: "dependency",
        name: dep,
        version: manifest?.version ?? null,
        license: manifest?.license ?? "UNKNOWN",
        copyright: normalizeAuthor(manifest?.author),
        url: npmUrl(dep),
        usedBy: [json.name],
        required: false,
        note: null,
      });
    }
  }
  return [...byName.values()];
}

/**
 * Per-face facts an `OFL.txt` cannot supply, keyed by the vendored directory name.
 *
 * `name` — the face's own capitalisation. Deriving it from the directory would
 *   title-case each hyphen segment and ship "Ibm Plex Mono".
 * `url` — the upstream project, so every attribution carries a link a reader can
 *   follow (see `.claude/rules/attribution.md`). All four are on `github.com`,
 *   already an allowlisted origin.
 * `copyrightFallback` — the notice from the UPSTREAM licence, used only when the
 *   repackaged `OFL.txt` we ship carries no copyright header of its own (see
 *   `readOflCopyright`). Verbatim from the upstream LICENSE, never retyped from
 *   memory.
 */
export const FONT_UPSTREAM = {
  inter: {
    name: "Inter",
    url: "https://github.com/rsms/inter",
    copyrightFallback: null, // its OFL.txt carries the notice
  },
  "source-code-pro": {
    name: "Source Code Pro",
    url: "https://github.com/adobe-fonts/source-code-pro",
    copyrightFallback:
      "Copyright 2010-2020 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source'. All Rights Reserved.",
  },
  "source-sans-3": {
    name: "Source Sans 3",
    url: "https://github.com/adobe-fonts/source-sans",
    copyrightFallback:
      "Copyright 2010-2024 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source'. All Rights Reserved.",
  },
};

/** The line that ends an OFL file's header and begins the licence body. */
const OFL_BODY_START = /^this font software is licensed under the sil open font license/i;

/**
 * The copyright notice from an `OFL.txt` HEADER — the lines above the licence
 * body, which is where the OFL puts the actual notice.
 *
 * Scanning the whole file is what broke here: the OFL's own body contains the
 * boilerplate line `copyright statement(s).` (part of "…must include the above
 * copyright notice, this list of conditions and the following disclaimer in all
 * copies of one or more of the Font Software typefaces and any derivative works
 * … including any relevant copyright statement(s)."). Two of the four shipped
 * faces — Source Code Pro and Source Sans 3, repackaged from `@fontsource`, whose
 * header line reads only "Google Inc." — have no header notice at all, so the
 * whole-file scan matched that boilerplate and shipped `copyright: "copyright
 * statement(s)."` as the notice for both. The `required && !copyright` gate rung
 * passed it because the field was merely non-empty.
 *
 * Returns null when the header has no notice; the caller supplies the upstream
 * fallback, and the gate still refuses a required notice left with nothing.
 */
export function readOflCopyright(oflText) {
  for (const raw of String(oflText).split("\n")) {
    const line = raw.trim();
    if (OFL_BODY_START.test(line)) break; // past the header — everything below is boilerplate
    if (/^copyright\b/i.test(line)) return line;
  }
  return null;
}

/**
 * Vendored font faces. The OFL asks that the copyright notice travel with the
 * font, so the notice is read from the shipped `OFL.txt` itself rather than
 * retyped — retyping is how a notice drifts from the file it describes.
 */
export function collectFonts(fontsDir) {
  if (!existsSync(fontsDir)) return [];
  return readdirSync(fontsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      const oflPath = join(fontsDir, e.name, "OFL.txt");
      if (!existsSync(oflPath)) return null;
      const upstream = FONT_UPSTREAM[e.name] ?? {};
      const copyright =
        readOflCopyright(readFileSync(oflPath, "utf8")) ?? upstream.copyrightFallback ?? null;
      return {
        id: `font:${e.name}`,
        category: "font",
        name:
          upstream.name ??
          e.name
            .split("-")
            .map((w) => w[0].toUpperCase() + w.slice(1))
            .join(" "),
        version: null,
        license: "OFL-1.1",
        copyright,
        url: upstream.url ?? null,
        usedBy: ["@elabs/components-tokens"],
        required: true, // the OFL requires the notice to ship with the font
        note: "Self-hosted webfont shipped in the tokens package.",
      };
    })
    .filter(Boolean);
}

/** The curated, non-derivable notices. */
export function collectCurated(sourcesFile) {
  return readJson(sourcesFile).sources.map((s) => ({
    version: null,
    note: null,
    ...s,
  }));
}

/** Deterministic order: category rank, then required-first, then name. */
export function sortEntries(entries) {
  return [...entries].sort((a, b) => {
    const rank = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    if (rank !== 0) return rank;
    if (a.required !== b.required) return a.required ? -1 : 1;
    return a.name.localeCompare(b.name, "en");
  });
}

export function buildDataset({ packagesDir, fontsDir, sourcesFile }) {
  return sortEntries([
    ...collectCurated(sourcesFile),
    ...collectFonts(fontsDir),
    ...collectDependencies(packagesDir),
  ]);
}

/**
 * Emit through Prettier using the repo's own config. A generator that writes
 * unformatted output puts `pnpm format:check` and `pnpm attributions:check` in
 * permanent conflict — one rewrites what the other demands — so the generator
 * owns the formatting rather than leaving a file nobody may touch by hand.
 */
async function renderFormatted(text, filepath) {
  const config = (await resolveConfig(filepath)) ?? {};
  return format(text, { ...config, filepath });
}

function render(entries) {
  const counts = CATEGORY_ORDER.map(
    (c) => `${c}: ${entries.filter((e) => e.category === c).length}`,
  ).join(", ");
  return `// GENERATED by scripts/gen-attributions.mjs — DO NOT EDIT BY HAND.
// Run \`pnpm gen:attributions\` after changing a dependency, a vendored font, or
// scripts/attributions.sources.json. \`pnpm attributions:check\` fails on a stale copy.
//
// ${entries.length} entries (${counts}).

import type { Attribution } from "./attribution-types";

export const ATTRIBUTIONS: readonly Attribution[] = ${JSON.stringify(entries, null, 2)} as const;
`;
}

// ── ATTRIBUTION.md — the same dataset, for humans ────────────────────────────

/**
 * Only the region between these markers is generated. The prose around it (what
 * the file is, how to add an entry) is hand-authored, following the same
 * convention `pnpm gen` uses in CLAUDE.md / AGENTS.md. A wholly-generated doc
 * would have nowhere to put the instructions a contributor needs.
 */
export const MD_START = "<!-- brand-ui:gen:attributions:start -->";
export const MD_END = "<!-- brand-ui:gen:attributions:end -->";

/** Escape a value for a Markdown table cell (a stray `|` would break the row). */
const cell = (v) => (v == null || v === "" ? "—" : String(v).replace(/\|/g, "\\|"));
const link = (e) => (e.url ? `[${cell(e.name)}](${e.url})` : cell(e.name));
// An entry with no `usedBy` is a real case, not a gap: governance we adopted
// (a rule taken from someone's guidelines) or data a registry block fetches —
// borrowed, credited, but reaching no published package.
const pkgs = (e) => (e.usedBy.length ? e.usedBy.map((p) => `\`${p}\``).join(", ") : "—");

const SECTIONS = [
  {
    category: "data",
    heading: "Runtime data",
    lead: "Data served to the user at runtime. These credits are **obliged by a licence or provider terms** — an app that displays these surfaces must display the notice.",
    columns: ["Project", "Licence", "Copyright", "Used in", "What it provides"],
    row: (e) => [link(e), cell(e.license), cell(e.copyright), pkgs(e), cell(e.note)],
  },
  {
    category: "source",
    heading: "Adapted & vendored source",
    lead: "Code and design we took from another project — vendored, adapted, ported or re-expressed. Adding to this list is required whenever we borrow again; see [`.claude/rules/attribution.md`](.claude/rules/attribution.md).",
    columns: ["Project", "Licence", "Copyright", "Used in", "What we took"],
    row: (e) => [link(e), cell(e.license), cell(e.copyright), pkgs(e), cell(e.note)],
  },
  {
    category: "font",
    heading: "Fonts",
    lead: "Self-hosted webfaces shipped in `@elabs/components-tokens`. The OFL asks that the notice travel with the font.",
    columns: ["Font", "Licence", "Copyright", "Upstream"],
    row: (e) => [cell(e.name), cell(e.license), cell(e.copyright), e.url ? `<${e.url}>` : "—"],
  },
  {
    category: "dependency",
    heading: "Open-source dependencies",
    lead: "Runtime dependencies of the published packages, harvested from the manifests — never hand-listed.",
    columns: ["Package", "Version", "Licence", "Author", "Used in"],
    row: (e) => [link(e), cell(e.version), cell(e.license), cell(e.copyright), pkgs(e)],
    collapse: true, // the bulk list; kept behind a <details> so the borrowed code stays the signal
  },
];

function table(columns, rows) {
  return [
    `| ${columns.join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");
}

export function renderMarkdown(entries) {
  const counts = SECTIONS.map(
    (s) => `${entries.filter((e) => e.category === s.category).length} ${s.category}`,
  ).join(" · ");

  const blocks = [
    `_${entries.length} entries — ${counts}. Generated by \`scripts/gen-attributions.mjs\`; do not edit between the markers._`,
  ];

  for (const section of SECTIONS) {
    const rows = entries.filter((e) => e.category === section.category);
    if (rows.length === 0) continue;
    const body = [section.lead, "", table(section.columns, rows.map(section.row))].join("\n");
    blocks.push(
      section.collapse
        ? [
            `## ${section.heading}`,
            "",
            `<details>`,
            `<summary>${rows.length} packages</summary>`,
            "",
            body,
            "",
            `</details>`,
          ].join("\n")
        : [`## ${section.heading}`, "", body].join("\n"),
    );
  }

  return blocks.join("\n\n");
}

/**
 * Splice the generated region into the existing ATTRIBUTION.md, preserving the
 * hand-authored prose around it. Throws when a marker is missing rather than
 * silently overwriting somebody's prose.
 */
export function spliceMarkdown(current, generated) {
  const start = current.indexOf(MD_START);
  const end = current.indexOf(MD_END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(
      `ATTRIBUTION.md is missing the generated region markers (${MD_START} … ${MD_END}). ` +
        `Restore them, or delete the file and re-run \`pnpm gen:attributions\` to scaffold it.`,
    );
  }
  return (
    current.slice(0, start + MD_START.length) + "\n\n" + generated + "\n\n" + current.slice(end)
  );
}

/** The hand-authored shell, written once when ATTRIBUTION.md does not exist yet. */
function scaffoldMarkdown() {
  return `# Attribution

brand-ui is built on other people's work. This file credits every project whose
code, design, data or type we use — what it is, who holds the copyright, under
which licence, and where it is used.

**The list below is generated.** It is derived from
[\`scripts/attributions.sources.json\`](scripts/attributions.sources.json) (things
that cannot be derived — source we adapted, data we serve) plus the repo's own
dependency manifests and the licence files shipped with each vendored font. Run
\`pnpm gen:attributions\` to regenerate it; \`pnpm attributions:check\` fails on a
stale copy. The same dataset drives the in-app \`AttributionPanel\`
(\`@elabs/components-ui\`), so the page and the product cannot disagree.

## Adding an attribution

If you vendor, adapt, port or copy anything from another project — or take a
design or technique from one — add it to
[\`scripts/attributions.sources.json\`](scripts/attributions.sources.json) with a
name, a licence, a copyright line and a canonical URL (the GitHub repo where one
exists), then run \`pnpm gen:attributions\` **in the same change**. A comment in a
source file saying "adapted from X" is a useful pointer, not an attribution.

Do **not** hand-add an npm dependency — those are harvested from the manifests
and a hand-written duplicate goes stale the moment the dependency moves.

The full rule, and what enforces it, is in
[\`.claude/rules/attribution.md\`](.claude/rules/attribution.md).

${MD_START}
${MD_END}
`;
}

// ────────────────────────────────── CLI ──────────────────────────────────────

const dataset = buildDataset({
  packagesDir: join(root, "packages"),
  fontsDir: FONTS_DIR,
  sourcesFile: SOURCES_FILE,
});

const tsOutput = await renderFormatted(render(dataset), OUT_FILE);

const mdCurrent = existsSync(ATTRIBUTION_FILE)
  ? readFileSync(ATTRIBUTION_FILE, "utf8")
  : scaffoldMarkdown();
const mdOutput = await renderFormatted(
  spliceMarkdown(mdCurrent, renderMarkdown(dataset)),
  ATTRIBUTION_FILE,
);

const rel = (p) => p.slice(root.length + 1);

if (process.argv.includes("--check")) {
  const stale = [
    [OUT_FILE, tsOutput],
    [ATTRIBUTION_FILE, mdOutput],
  ].filter(([file, want]) => (existsSync(file) ? readFileSync(file, "utf8") : "") !== want);

  if (stale.length) {
    console.error(
      `\n✖ attributions: ${stale.length} generated file(s) are STALE:\n` +
        stale.map(([file]) => `  - ${rel(file)}`).join("\n") +
        "\n\n  They do not match what the repo actually ships.\n" +
        "  Run `pnpm gen:attributions` and commit the result.\n",
    );
    process.exit(1);
  }

  const missingRequired = dataset.filter((e) => e.required && !e.copyright);
  if (missingRequired.length) {
    console.error(
      `\n✖ attributions: ${missingRequired.length} REQUIRED notice(s) carry no copyright line:\n` +
        missingRequired.map((e) => `  - ${e.name}`).join("\n") +
        "\n  A required notice with nothing to display is not a notice.\n",
    );
    process.exit(1);
  }

  // Every attribution must be identifiable and followable: a name, and a link
  // that resolves. GitHub is preferred where the upstream has a repo, but not
  // required — OpenStreetMap and CARTO have no repo, and dependencies carry
  // their npm page. See `.claude/rules/attribution.md`.
  const unlinked = dataset.filter((e) => !e.name?.trim() || !e.url?.trim());
  if (unlinked.length) {
    console.error(
      `\n✖ attributions: ${unlinked.length} entr(ies) have no name or no canonical URL:\n` +
        unlinked
          .map((e) => `  - ${e.id}: name=${e.name || "(none)"} url=${e.url || "(none)"}`)
          .join("\n") +
        "\n\n  A credit nobody can follow is not a credit. Add a canonical URL — the\n" +
        "  upstream GitHub repo where one exists — in scripts/attributions.sources.json\n" +
        "  (or, for a font, in FONT_UPSTREAM in this script).\n",
    );
    process.exit(1);
  }

  console.log(
    `✔ attributions: ${rel(OUT_FILE)} + ${rel(ATTRIBUTION_FILE)} fresh — ${dataset.length} entries, ` +
      `${dataset.filter((e) => e.required).length} of them required notices, all named and linked.`,
  );
} else if (!process.argv.includes("--print")) {
  writeFileSync(OUT_FILE, tsOutput);
  writeFileSync(ATTRIBUTION_FILE, mdOutput);
  console.log(
    `✔ attributions: wrote ${dataset.length} entries to ${rel(OUT_FILE)} and ${rel(ATTRIBUTION_FILE)}`,
  );
}
