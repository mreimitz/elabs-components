#!/usr/bin/env node
/**
 * Generate the attribution dataset `AttributionPanel` renders (#attribution).
 *
 * WHY THIS IS GENERATED. A hand-kept credits list is wrong the day after it is
 * written: a dependency is added, a package is dropped, a font is swapped, and
 * nothing fails — the notice silently misstates what the product actually ships.
 * So the dataset is DERIVED from the repo on every run, and `--check` refuses a
 * stale committed copy (the manifest-gate pattern, per the "enforcement over
 * reminders" rule in .claude/rules/quality-gates.md).
 *
 * Three inputs, two of them derived:
 *   1. npm dependencies  — every non-`@qlik-coe-emea/*` runtime `dependencies`
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
      if (dep.startsWith("@qlik-coe-emea/")) continue; // first-party, not an attribution
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
      const copyright =
        readFileSync(oflPath, "utf8")
          .split("\n")
          .find((l) => /^copyright/i.test(l.trim()))
          ?.trim() ?? null;
      return {
        id: `font:${e.name}`,
        category: "font",
        name: e.name
          .split("-")
          .map((w) => w[0].toUpperCase() + w.slice(1))
          .join(" "),
        version: null,
        license: "OFL-1.1",
        copyright,
        url: null,
        usedBy: ["@qlik-coe-emea/qlabs-components-tokens"],
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
async function renderFormatted(entries) {
  const config = (await resolveConfig(OUT_FILE)) ?? {};
  return format(render(entries), { ...config, filepath: OUT_FILE });
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

const dataset = buildDataset({
  packagesDir: join(root, "packages"),
  fontsDir: FONTS_DIR,
  sourcesFile: SOURCES_FILE,
});
const output = await renderFormatted(dataset);

if (process.argv.includes("--check")) {
  const current = existsSync(OUT_FILE) ? readFileSync(OUT_FILE, "utf8") : "";
  if (current !== output) {
    console.error(
      "\n✖ attributions: the generated dataset is STALE.\n" +
        "  packages/ui/src/components/attribution-panel/attributions.generated.ts does not\n" +
        "  match what the repo actually ships. Run `pnpm gen:attributions` and commit it.\n",
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
  console.log(
    `✔ attributions: dataset is fresh — ${dataset.length} entries, ` +
      `${dataset.filter((e) => e.required).length} of them required notices.`,
  );
} else if (!process.argv.includes("--print")) {
  writeFileSync(OUT_FILE, output);
  console.log(
    `✔ attributions: wrote ${dataset.length} entries to ${OUT_FILE.slice(root.length + 1)}`,
  );
}
