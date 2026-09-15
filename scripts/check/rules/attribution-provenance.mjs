/**
 * attribution-provenance — shipped source may not name an upstream it borrowed from
 * unless that upstream is credited. Ported from scripts/check-attribution-provenance.mjs.
 *
 * Incident: 6 credits in `scripts/attributions.sources.json` while ~15 real borrowings
 * (Milkdown vendored, anyview's registry, blocks.so sidebars, …) existed only as source
 * comments. `gen-attributions.mjs --check` proves outputs match the dataset, never that the
 * dataset matches the repo. A comment is a pointer, not an attribution.
 *
 * Detection: strong phrases only (`adapted|vendored|borrowed|forked|copied|ported from`,
 * `port of`). A hit resolves when a credited alias (name, id, URL owner/repo) or a
 * first-party name appears as a whole word on the hit line or the next 2 lines.
 * Deliberately EXCLUDED as measured noise: `based on`, `inspired by`, `derived from`
 * (22 hits meaning "computed from", zero real credits — 65% noise). Cost: a borrowing
 * marked ONLY by "derived" passes. Scope: `packages/<pkg>/src/` + `registry/`, not tests.
 * Baseline keys are `file:line` of hits whose upstream could not be identified.
 */

export const PROVENANCE_RE =
  /\b(?:adapted|vendored|borrowed|forked|copied|ported)\s+from\b|\bport\s+of\b/i;
export const FIRST_PARTY_ALIASES = ["elabs", "brand-ui"];
export const CONTEXT_LINES = 2;

const SCANNED = [
  "packages/*/src/**/*.{ts,tsx,js,jsx,mjs,cjs,css,json,md}",
  "registry/**/*.{ts,tsx,js,jsx,mjs,cjs,css,json,md}",
];
const EXCLUDED = ["**/*.{test,spec}.{ts,tsx,js,jsx}", "**/__{tests,fixtures,mocks}__/**"];
const SOURCES = "scripts/attributions.sources.json";
const GENERATED = "packages/ui/src/components/attribution-panel/attributions.generated.ts";

/** Every token that identifies an upstream: its name, its id, its URL owner/repo. */
export function aliasesFor(entry) {
  const out = new Set();
  const add = (v) => {
    for (const part of String(v ?? "")
      .toLowerCase()
      .split(/[^a-z0-9.+-]+/))
      if (part.length >= 3) out.add(part); // "ui"/"ai" would resolve every hit vacuously
  };
  add(entry.name);
  add(entry.id);
  if (entry.url) {
    try {
      const u = new URL(entry.url);
      add(
        u.hostname
          .replace(/^www\./, "")
          .split(".")
          .slice(0, -1)
          .join(" "),
      );
      add(u.pathname.replace(/\.[a-z]+$/i, ""));
    } catch {
      /* a malformed URL is the attributions gate's problem */
    }
  }
  return out;
}

/** Whole-word match, so the font "Inter" does not resolve "interval". */
export function lineResolves(line, aliases) {
  const lower = String(line).toLowerCase();
  for (const alias of aliases) {
    const safe = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(?:^|[^a-z0-9])${safe}(?:[^a-z0-9]|$)`, "i").test(lower)) return true;
  }
  return false;
}

/** `[{ line, text }]` for each unattributed provenance claim in one file. */
export function findUnattributed(content, aliases) {
  const hits = [];
  const lines = String(content).split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!PROVENANCE_RE.test(lines[i])) continue;
    // A wrapped block comment puts the upstream on the next line ("Adapted from\n * blocks.so").
    if (lineResolves(lines.slice(i, i + CONTEXT_LINES + 1).join(" "), aliases)) continue;
    hits.push({ line: i + 1, text: lines[i].trim().slice(0, 120) });
  }
  return hits;
}

/** Curated sources + the generated dataset (harvested npm deps and fonts), textually. */
function creditedAliases(ctx) {
  const aliases = new Set(FIRST_PARTY_ALIASES);
  if (ctx.exists(SOURCES))
    for (const entry of ctx.json(SOURCES).sources ?? [])
      for (const a of aliasesFor(entry)) aliases.add(a);
  if (ctx.exists(GENERATED))
    for (const m of ctx.readFile(GENERATED).matchAll(/^\s*(?:id|name|url):\s*"([^"]+)"/gm))
      for (const a of aliasesFor({ name: m[1], id: m[1], url: null })) aliases.add(a);
  return aliases;
}

// ── fixtures ─────────────────────────────────────────────────────────────────
const CREDITS = JSON.stringify({
  sources: [
    { id: "blocks-so", name: "blocks.so", url: "https://github.com/ephraimduncan/blocks" },
    { id: "font:inter", name: "Inter" },
  ],
});
const tree = (files) => ({ files: { [SOURCES]: CREDITS, ...files } });
const src = (body, rel = "packages/ui/src/a.tsx") => tree({ [rel]: body });

export default {
  id: "attribution-provenance",
  scope: "packages",
  doc: "When shipped source says code was adapted/vendored/borrowed/forked/copied/ported from somewhere, credit that upstream in `scripts/attributions.sources.json` (then `pnpm gen`) in the same change.",
  baseline: "keys",
  run(ctx) {
    const aliases = creditedAliases(ctx);
    const out = [];
    for (const file of ctx.glob(SCANNED, { ignore: EXCLUDED }))
      for (const h of findUnattributed(ctx.readFile(file), aliases))
        out.push({
          file,
          line: h.line,
          key: `${file}:${h.line}`,
          msg: `uncredited borrowing: ${h.text}`,
        });
    return out;
  },
  fixtures: {
    pass: [
      src("// Adapted from blocks.so, re-tokenized.\n"),
      src("// Adapted from ephraimduncan's sidebar.\n"), // URL owner segment
      src("/** sidebar-04 — mail sidebar. Adapted from\n * blocks.so. */\n"), // wraps a line
      src('"description": "Ported from the brand-ui palette."', "registry/registry.json"),
      src("Adapted from Inter's metrics"),
      src("* Column definitions. Omitted → derived from Object.keys(data[0])."),
      src("Spacing based on the density factor. Layout inspired by dashboards."),
      src("// Adapted from acme/widget.\n", "packages/ui/src/a.test.tsx"),
      src("// Adapted from acme/widget.\n", "docs/ADR/0024-viewer-package.md"),
      src("// Adapted from acme/widget.\n", "packages/ui/package.json"),
      tree({
        [GENERATED]: '  {\n    id: "milkdown",\n    name: "Milkdown",\n  },\n',
        "packages/editor/src/m.tsx": "// Vendored from Milkdown.\n",
      }),
    ],
    fail: [
      src("// Adapted from acme/widget's layout.\n"),
      src(["// Adapted from", "//", "//", "//", "// blocks.so"].join("\n")), // outside window
      src("// Vendored from someone-elses/library.\n", "registry/blocks/x/x.tsx"),
      src("pick a nice time interval; port of acme's scheduler"),
      src("/* Copied from acme */", "packages/ui/src/a.css"),
    ],
  },
};
