#!/usr/bin/env node
/**
 * gen-intent-json.mjs — the Storybook Intent block's data file.
 *
 *   node scripts/gen-intent-json.mjs           write apps/docs/.storybook/intent.generated.json
 *   node scripts/gen-intent-json.mjs --check   fail (exit 1) if it is stale
 *
 * WHY: the manifest holds purpose, relationships, state→token map and
 * anti-patterns for ~190 components — `brand-ui docs Button` returns all of it —
 * while the Storybook page for the same component showed an H1, a preview and a
 * props table, and 68 component pages had nothing at all between the H1 and the
 * first preview (2026-09-17 review §1.7). Two audiences, two sources, no meeting
 * point. This file is the meeting point.
 *
 * WHY NOT import the manifest: `brand-ui.manifest.json` is ~1.5 MB and would be
 * bundled into the preview bundle every visitor downloads. This projection keeps
 * only what the block renders, is keyed by `meta.title` (what a docs page knows
 * about itself without re-deriving Storybook's id slug in the browser), and is
 * capped by `MAX_BYTES` below.
 *
 * Deterministic: sorted keys, no timestamp, no environment reads.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { indexStoryDocsPages } from "../packages/cli/lib/story-ids.mjs";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(REPO_ROOT, "apps/docs/.storybook/intent.generated.json");

/**
 * Hard ceiling — this file ships inside the preview bundle.
 *
 * The 2026-09-17 review estimated "well under 100 KB"; measured, the 190 intent
 * records in the manifest are 159 KB of raw JSON on their own (51 KB gzipped),
 * so 100 KB was never reachable without dropping the anti-patterns that are the
 * block's whole point. 192 KB is the real limit: it holds today's 349 pages with
 * room to grow, and it is still an eighth of the manifest this file replaces.
 * Transfer cost is what matters, and gzipped that is ~50 KB.
 */
const MAX_BYTES = 192 * 1024;

/** Drop empty strings/arrays/objects so the file carries only real content. */
function compact(record) {
  const out = {};
  for (const [key, value] of Object.entries(record)) {
    if (value == null || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (!Array.isArray(value) && typeof value === "object" && Object.keys(value).length === 0)
      continue;
    out[key] = value;
  }
  return out;
}

/**
 * A template story's description is written for a CONTRIBUTOR — it ends in
 * provenance ("`pnpm gen` derives the consumer template source…") and in
 * verification instructions ("Verify across every theme with globals=…"). A
 * visitor wants the first half. Cut at the first contributor marker.
 */
function visitorFacing(description) {
  const markers = [
    "This story is the single source of truth",
    "Verify across",
    "Verify with globals",
    "Remember `import",
    "Compose-only from",
  ];
  let text = String(description || "");
  for (const marker of markers) {
    const at = text.indexOf(marker);
    if (at > 0) text = text.slice(0, at);
  }
  return text.trim();
}

export function buildIntentIndex(manifest, pages) {
  /** @type {Record<string, object>} */
  const byTitle = {};

  // Which package exports a component, and what that component's intent says.
  /** @type {Record<string, {pkg: string, intent: object|undefined}>} */
  const byComponent = {};
  for (const [pkg, info] of Object.entries(manifest.packages || {})) {
    // A component exported from a subpath imports from THAT path, not the root
    // barrel — DashboardSheet is `@elabs-ai/components-charts/dashboard`.
    const importPathOf = {};
    for (const [importPath, sub] of Object.entries(info.subpaths || {}))
      for (const c of sub.components || []) importPathOf[c.name] = importPath;
    for (const [name, storyId] of Object.entries(info.stories || {})) {
      byComponent[name] = {
        pkg: importPathOf[name] || pkg,
        storyId,
        intent: info.intent?.[name],
      };
    }
    // A component with authored intent but no story of its own still matters:
    // its record is reachable from a page that documents it under another title.
    for (const name of Object.keys(info.intent || {})) {
      if (!byComponent[name]) byComponent[name] = { pkg, storyId: "", intent: info.intent[name] };
    }
  }

  for (const page of pages) {
    const found = page.component ? byComponent[page.component] : undefined;
    const intent = found?.intent || {};
    const record = compact({
      name: page.component || "",
      package: found?.pkg || "",
      storyId: page.storyId,
      purpose: intent.purpose || "",
      category: intent.category || "",
      relationships: intent.relationships || {},
      antiPatterns: intent.antiPatterns || [],
      stateTokens: intent.stateTokens || {},
      // RM-040's chart-selection tags, rendered as "Best for" / "Avoid when"
      // instead of leaking `@dataShape`/`@avoidWhen` into the description (A7).
      dataShapes: intent.dataShapes || [],
      avoidWhen: intent.avoidWhen || "",
    });
    if (Object.keys(record).length > 1) byTitle[page.title] = record;
  }

  // The template pages document a COMPOSITION, not an export — their purpose
  // lives in `manifest.templates`, which is why those pages showed their
  // description below the first preview instead of above it.
  const pageByTitle = Object.fromEntries(pages.map((page) => [page.title, page]));
  for (const template of manifest.templates || []) {
    if (!template.title) continue;
    const existing = byTitle[template.title] || {};
    byTitle[template.title] = compact({
      ...existing,
      storyId: existing.storyId || pageByTitle[template.title]?.storyId || "",
      purpose: existing.purpose || visitorFacing(template.description),
      packages: template.packages || [],
      templateFile: template.file || "",
    });
  }

  return Object.fromEntries(Object.entries(byTitle).sort(([a], [b]) => (a < b ? -1 : 1)));
}

/**
 * One page per line: small enough for the preview bundle, still reviewable in a
 * diff. Fully indented JSON of the same data is 178 KB — most of it whitespace.
 */
export function render(manifest, pages) {
  const entries = Object.entries(buildIntentIndex(manifest, pages)).map(
    ([title, record]) => `  ${JSON.stringify(title)}: ${JSON.stringify(record)}`,
  );
  return `{\n${entries.join(",\n")}\n}\n`;
}

const manifest = JSON.parse(readFileSync(join(REPO_ROOT, "brand-ui.manifest.json"), "utf8"));
const { pages } = indexStoryDocsPages(REPO_ROOT);
const next = render(manifest, pages);

const bytes = Buffer.byteLength(next);
if (bytes > MAX_BYTES) {
  console.error(
    `gen-intent-json: ${Math.round(bytes / 1024)} KB exceeds the ${MAX_BYTES / 1024} KB ceiling — ` +
      "this file is bundled into the preview every visitor downloads. Trim the projection.",
  );
  process.exit(1);
}

const check = process.argv.includes("--check");
let current = "";
try {
  current = readFileSync(OUT, "utf8");
} catch {
  /* first run */
}

if (check) {
  if (current !== next) {
    console.error(
      "gen-intent-json: apps/docs/.storybook/intent.generated.json is STALE — run `pnpm gen`.",
    );
    process.exit(1);
  }
  console.log(`✔ intent.generated.json fresh (${Object.keys(JSON.parse(next)).length} pages)`);
} else {
  if (current !== next) writeFileSync(OUT, next);
  console.log(
    `✔ intent.generated.json — ${Object.keys(JSON.parse(next)).length} pages, ${Math.round(bytes / 1024)} KB`,
  );
}
