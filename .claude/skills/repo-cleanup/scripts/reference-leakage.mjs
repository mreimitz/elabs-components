#!/usr/bin/env node
/**
 * reference-leakage.mjs — third-party product names outside their two allowed homes.
 *
 * While a feature is planned, competitor and reference products get named
 * constantly: "Datawrapper parity", "Qlik Sense does X", "Grafana's grid". That
 * is honest working talk. It becomes a problem the moment it survives into
 * something a user, a customer or a downstream agent reads, because then the
 * library is describing itself in another vendor's vocabulary and implying a
 * relationship that does not exist.
 *
 * House rule (this repo): a third-party product name is allowed in exactly two
 * places — an ATTRIBUTION surface (where crediting upstream is the point) and a
 * THEME surface (where the brand IS the artefact). Everywhere else it is a leak.
 *
 * Three things this script is deliberate about:
 *
 *   1. CURATED LIST, NOT A HEURISTIC. "Capitalised word that looks like a brand"
 *      was tried and is unusable: in this repo it reports `linear` (the scale),
 *      `Sigma`, `Observable` (the pattern) and `Stripe` (the fill) — 444 hits on
 *      `Linear` alone, every one of them false. A name earns its place on the
 *      list by being a product someone could mistake for an affiliation.
 *   2. ZONE DECIDES SEVERITY, NOT THE NAME. `Qlik` is correct inside
 *      `themes/qlik/` and a leak inside a changeset. The same string, opposite
 *      verdicts. Any tool that ranks by name alone gets this backwards.
 *   3. DENSE FILES ARE NOT LINE EDITS. A competitor survey is not a document
 *      with leaks in it; it is a document made of them. Those are reported as
 *      "retire or relocate the file", never as N line fixes, because rewriting
 *      them one line at a time destroys the research and still leaves the shape.
 *
 * What it does NOT do: decide. It never edits, and `review`-tier names carry a
 * known false-positive rate and are capped at informational for that reason.
 *
 * Usage: node reference-leakage.mjs [--root <dir>]
 * Zero dependencies. Node >= 22.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { findRepoRoot, loadConfig } from "./config.mjs";

// --------------------------------------------------------------------------
// the list
// --------------------------------------------------------------------------

/**
 * `deny` — naming it outside an allowed zone is a leak, full stop.
 * `review` — a real product whose name also has an innocent everyday use, or
 *   which may be a legitimate interop claim ("this SVG opens in Figma"). These
 *   are REPORTED but never ranked above informational, because batch-fixing
 *   them breaks true statements.
 *
 * Case-sensitive where the lowercase form is an ordinary English word.
 */
export const PRODUCTS = [
  // --- charting / BI tools surveyed while planning charts, dashboard, maps --
  { id: "datawrapper", re: /\bDatawrapper\b/gi, tier: "deny", kind: "dataviz" },
  { id: "flourish", re: /\bFlourish\b/g, tier: "deny", kind: "dataviz" },
  { id: "highcharts", re: /\bHighcharts\b/gi, tier: "deny", kind: "dataviz" },
  { id: "tableau", re: /\bTableau\b/g, tier: "deny", kind: "dataviz" },
  { id: "power-bi", re: /\bPower\s?BI\b/gi, tier: "deny", kind: "dataviz" },
  { id: "looker", re: /\bLooker(?:\s+Studio)?\b/g, tier: "deny", kind: "dataviz" },
  { id: "plotly", re: /\bPlotly\b/gi, tier: "deny", kind: "dataviz" },
  { id: "amcharts", re: /\bamCharts\b/gi, tier: "deny", kind: "dataviz" },
  { id: "nivo", re: /\bNivo\b/g, tier: "deny", kind: "dataviz" },
  { id: "chartjs", re: /\bChart\.js\b/gi, tier: "deny", kind: "dataviz" },
  { id: "recharts", re: /\bRecharts\b/gi, tier: "deny", kind: "dataviz" },
  { id: "victory", re: /\bVictory\b/g, tier: "deny", kind: "dataviz" },
  { id: "vega", re: /\bVega(?:-Lite)?\b/g, tier: "deny", kind: "dataviz" },
  { id: "superset", re: /\b(?:Apache\s+)?Superset\b/g, tier: "deny", kind: "bi" },
  { id: "metabase", re: /\bMetabase\b/gi, tier: "deny", kind: "bi" },
  { id: "grafana", re: /\bGrafana\b/gi, tier: "deny", kind: "bi" },
  { id: "domo", re: /\bDomo\b/g, tier: "deny", kind: "bi" },
  { id: "sisense", re: /\bSisense\b/gi, tier: "deny", kind: "bi" },
  { id: "qlik", re: /\bQlik(?:\s+Sense)?\b/gi, tier: "deny", kind: "bi" },
  { id: "echarts", re: /\b(?:Apache\s+)?ECharts\b/gi, tier: "deny", kind: "dataviz" },
  { id: "infogram", re: /\bInfogram\b/gi, tier: "deny", kind: "dataviz" },
  { id: "rawgraphs", re: /\bRAWGraphs\b/gi, tier: "deny", kind: "dataviz" },
  { id: "observable-plot", re: /\bObservable\s+Plot\b/gi, tier: "deny", kind: "dataviz" },
  { id: "redash", re: /\bRedash\b/gi, tier: "deny", kind: "bi" },
  { id: "kibana", re: /\bKibana\b/gi, tier: "deny", kind: "bi" },
  { id: "mode-analytics", re: /\bMode\s+Analytics\b/gi, tier: "deny", kind: "bi" },
  { id: "klipfolio", re: /\bKlipfolio\b/gi, tier: "deny", kind: "bi" },

  // --- component systems surveyed while planning ui / marketing / home ------
  { id: "heroui", re: /\bHeroUI\b/gi, tier: "deny", kind: "component-system" },
  { id: "nextui", re: /\bNextUI\b/gi, tier: "deny", kind: "component-system" },
  { id: "chakra", re: /\bChakra(?:\s+UI)?\b/gi, tier: "deny", kind: "component-system" },
  { id: "mantine", re: /\bMantine\b/gi, tier: "deny", kind: "component-system" },
  { id: "ant-design", re: /\bAnt\s+Design\b/gi, tier: "deny", kind: "component-system" },
  { id: "mui", re: /\b(?:MUI|Material\s+UI)\b/g, tier: "deny", kind: "component-system" },
  { id: "bootstrap", re: /\bBootstrap\b/g, tier: "deny", kind: "component-system" },
  { id: "bulma", re: /\bBulma\b/g, tier: "deny", kind: "component-system" },
  { id: "flowbite", re: /\bFlowbite\b/gi, tier: "deny", kind: "component-system" },
  { id: "preline", re: /\bPreline\b/gi, tier: "deny", kind: "component-system" },
  { id: "tremor", re: /\bTremor\b/g, tier: "deny", kind: "component-system" },
  { id: "untitled-ui", re: /\bUntitled\s+UI\b/gi, tier: "deny", kind: "component-system" },

  // --- real companies used as demo data, theme sources or interop claims ----
  // Known false-positive rate. Capped at informational. Read, never batch-fix.
  { id: "figma", re: /\bFigma\b/g, tier: "review", kind: "brand" },
  { id: "notion", re: /\bNotion\b/g, tier: "review", kind: "brand" },
  { id: "slack", re: /\bSlack\b/g, tier: "review", kind: "brand" },
  { id: "netflix", re: /\bNetflix\b/g, tier: "review", kind: "brand" },
  { id: "spotify", re: /\bSpotify\b/g, tier: "review", kind: "brand" },
  { id: "airbnb", re: /\bAirbnb\b/g, tier: "review", kind: "brand" },
  { id: "shopify", re: /\bShopify\b/g, tier: "review", kind: "brand" },
  { id: "salesforce", re: /\bSalesforce\b/g, tier: "review", kind: "brand" },
  { id: "snowflake", re: /\bSnowflake\b/g, tier: "review", kind: "brand" },
  { id: "clickhouse", re: /\bClickHouse\b/g, tier: "review", kind: "brand" },
  { id: "stripe", re: /\bStripe\b/g, tier: "review", kind: "brand" },
  { id: "jira", re: /\bJira\b/g, tier: "review", kind: "brand" },
  { id: "zendesk", re: /\bZendesk\b/g, tier: "review", kind: "brand" },
  { id: "hubspot", re: /\bHubSpot\b/gi, tier: "review", kind: "brand" },
  { id: "intercom", re: /\bIntercom\b/g, tier: "review", kind: "brand" },
];

/**
 * Names deliberately NOT on the list, with the reason — so the next person does
 * not "helpfully" add them back. Every one was measured in this repo.
 */
export const REJECTED = [
  { name: "Linear", reason: "444 hits, all of them the linear scale / interpolation" },
  { name: "Sigma", reason: "the BI tool is real; every hit here is the letter or the statistic" },
  {
    name: "Observable",
    reason: "the pattern, not the product — 'Observable Plot' is listed instead",
  },
  { name: "Heap", reason: "the data structure; the brand appears only as a theme name" },
  {
    name: "Graphite",
    reason: "the colour and the material; the brand appears only as a theme name",
  },
  {
    name: "Vercel, Radix, Tailwind, Lucide, TanStack, MapLibre, Monaco, shadcn, Storybook",
    reason: "actual dependencies and interop formats — naming them is required, not a leak",
  },
];

// --------------------------------------------------------------------------
// zones
// --------------------------------------------------------------------------

const ALLOWED = [
  /(^|\/)attributions?[.-]/i,
  /(^|\/)ATTRIBUTIONS?\.md$/i,
  /^scripts\/gen-attributions\./,
  /^scripts\/check\/rules\/attribution-provenance\.mjs$/,
  /^docs\/rules-history\/attribution\.md$/,
  /^apps\/home\/app\/attributions\//,
  /^themes\//,
  /^packages\/tokens\/src\/themes\.css$/,
  /^packages\/tokens\/tokens\//,
  /theme-types\.ts$/,
];

/** This tooling has to spell the names out to look for them. */
const SELF_EXEMPT = [
  /^\.claude\/skills\/repo-cleanup\/scripts\/reference-leakage\.mjs$/,
  /^\.claude\/skills\/repo-cleanup\/references\/reference-leakage\.md$/,
  /^\.claude\/skills\/repo-cleanup\/tests\//,
  /^scripts\/check\/rules\/reference-leakage\.mjs$/,
  /^scripts\/check\/baseline\.json$/,
];

/**
 * Ordered: FIRST MATCH WINS, and the order is load-bearing. The internal rules
 * come first because `roadmap/README.md` is a planning note, not a shipped
 * README, and the generic README rule below would otherwise claim it.
 */
const ZONES = [
  ["internal", /^roadmap\//],
  ["internal", /^docs\/review\//],
  ["internal", /^\.claude\//],
  ["internal", /^scripts\//],
  ["internal", /^fixtures\//],
  // Everything under packages/ ships, not just src/: schemas/, the CLI's lib/
  // and bin/ are published too, and the first cut of this rule missed all three.
  ["shipped", /^packages\//],
  ["shipped", /^registry\//],
  ["shipped", /^apps\/home\//],
  ["shipped", /^skills\//],
  ["shipped", /^plugin\//],
  ["shipped", /\.manifest\.json$/],
  ["shipped", /^\.changeset\/.*\.md$/],
  ["shipped", /(^|\/)CHANGELOG\.md$/],
  ["shipped", /(^|\/)README\.md$/],
  ["shipped", /^llms(\.txt|\/)/],
  ["published-doc", /^apps\/docs\//],
  ["published-doc", /^docs\//],
  ["published-doc", /^(PROJECT|CONTRIBUTING|AGENTS|CLAUDE)\.md$/],
];

export function classifyZone(rel) {
  if (SELF_EXEMPT.some((re) => re.test(rel))) return "self-exempt";
  if (ALLOWED.some((re) => re.test(rel))) return "allowed";
  for (const [zone, re] of ZONES) if (re.test(rel)) return zone;
  return "other";
}

/**
 * Zone × tier → severity. A leak into something a user reads outranks the same
 * word in a planning note, even though both are in scope.
 */
export function severityFor(zone, tier) {
  if (tier === "review") return "informational";
  switch (zone) {
    case "shipped":
      return "high";
    case "published-doc":
      return "medium";
    case "internal":
      return "low";
    default:
      return "low";
  }
}

// --------------------------------------------------------------------------
// what KIND of mention is it
// --------------------------------------------------------------------------

/**
 * Not every mention is the same mistake, and treating them alike is how a
 * cleanup breaks working software. Measured in this repo, the same deny-listed
 * word appears as:
 *
 *   a parity note  — "Datawrapper's own guidance is…"            → the real leak
 *   a package name — `["@mui/material", "mui"]` in the migrate   → LOAD-BEARING;
 *                    command's mapping table                       deleting it
 *                                                                  breaks the CLI
 *   an interop fact — "React, React Flow, Radix and Recharts all  → true, and
 *                     write style attributes" in the CSP doc        arguably owed
 *   demo data      — `source: "Shopify"` in a table fixture       → swap the value
 *
 * These labels are HEURISTIC and they never suppress a hit — they only rank it.
 * A suppressed finding cannot be argued with; a labelled one can.
 */
const CONTEXT_RULES = [
  [
    "migration-source",
    /\b(?:migrat\w*|codemod|adapter|convert\w*|port(?:ed|ing)? from|upgrade from)\b/i,
  ],
  [
    "interop-claim",
    /\b(?:depends? on|also writes?|compatible|interop\w*|bring your own|works with|alongside|embed\w*|host(?:s|ed)?|mounts?)\b/i,
  ],
  [
    "planning-reference",
    /\b(?:parity|gap analysis|survey|inspired by|benchmark|competitor|equivalent|guidance|vocabulary|their own|'s own|does not|recipe)\b/i,
  ],
  ["demo-data", /^\s*(?:name|source|label|title|company|vendor|org|customer)\s*:\s*["'`]/],
];

/**
 * Whether a hit sits INSIDE a specifier is a question about position, not about
 * the line. Asking it at line level was the first cut and it was actively
 * harmful: a changeset sentence that merely contains `"monotone"` or a
 * `docs/review/…md` path was read as a package specifier, and the genuine
 * "Datawrapper parity" leak on that same line was demoted to informational.
 * A classifier that hides real findings is worse than none.
 */
const SPEC_TOKEN = /["'`]([^"'`\s]+)["'`]/g;
const PKG_LIKE = /^(?:@[\w.-]+\/)?[\w.-]+(?:\/[\w.-]+)*$/;
const FILE_EXT = /\.(?:md|mdx|json|jsonc|tsx?|jsx?|mjs|cjs|css|txt|ya?ml|html|svg|png|csv)$/i;

export function specifierSpans(line) {
  const out = [];
  SPEC_TOKEN.lastIndex = 0;
  for (const m of line.matchAll(SPEC_TOKEN)) {
    const t = m[1];
    if (!t.includes("/") && !t.startsWith("@")) continue;
    if (!PKG_LIKE.test(t)) continue;
    // A path citation names the product too — that is a leak, not an exemption.
    out.push({
      from: m.index ?? 0,
      to: (m.index ?? 0) + m[0].length,
      kind: FILE_EXT.test(t) ? "path-citation" : "package-specifier",
    });
  }
  return out;
}

export function classifyContext(line, rel, index = -1, spans = null) {
  if (/migrate|codemod/i.test(rel)) return "migration-source";
  const inSpan = (spans ?? specifierSpans(line)).find((x) => index >= x.from && index < x.to);
  if (inSpan) return inSpan.kind;
  for (const [name, re] of CONTEXT_RULES) if (re.test(line)) return name;
  return "unclassified";
}

/** Load-bearing classes: report them, never batch-edit them. */
const LOAD_BEARING = new Set(["package-specifier", "migration-source"]);

// --------------------------------------------------------------------------
// scanning
// --------------------------------------------------------------------------

const SCANNABLE = /\.(md|mdx|txt|json|jsonc|ya?ml|tsx?|jsx?|mts|cts|mjs|cjs|css|html)$/i;
const SKIP_DIR =
  /(^|\/)(node_modules|\.git|dist|build|out|coverage|\.next|\.turbo|storybook-static|__output|\.claude\/worktrees)(\/|$)/;

/** A file this dense is a research document, not a document with leaks in it. */
const RETIRE_HIT_THRESHOLD = 8;

function trackedFiles(root) {
  try {
    return execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    })
      .split("\0")
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** Fast reject: a case-insensitive union is a superset of every product regex. */
const ANY_PRODUCT = new RegExp(PRODUCTS.map((p) => p.re.source).join("|"), "i");

/** @param {string} [rootArg] */
export function runReferenceLeakage(rootArg) {
  const root = rootArg ?? findRepoRoot();
  const config = loadConfig(root);
  const maxBytes = (config?.limits?.max_file_size_mb ?? 10) * 1024 * 1024;

  /** @type {{file:string,zone:string,product:string,tier:string,kind:string,line:number,severity:string,excerpt:string}[]} */
  const hits = [];
  /** @type {{file:string,zone:string,products:string[]}[]} */
  const pathNamed = [];
  let filesScanned = 0;
  let filesSkipped = 0;

  for (const rel of trackedFiles(root)) {
    if (SKIP_DIR.test(rel) || !SCANNABLE.test(rel)) continue;
    const zone = classifyZone(rel);
    if (zone === "allowed" || zone === "self-exempt") continue;

    // The PATH itself naming a product is its own finding: renaming a directory
    // is a different, larger action than editing lines inside it.
    const named = PRODUCTS.filter((p) => {
      p.re.lastIndex = 0;
      return p.tier === "deny" && p.re.test(rel);
    }).map((p) => p.id);
    if (named.length) pathNamed.push({ file: rel, zone, products: named });

    let text;
    try {
      if (statSync(join(root, rel)).size > maxBytes) {
        filesSkipped++;
        continue;
      }
      text = readFileSync(join(root, rel), "utf8");
    } catch {
      filesSkipped++;
      continue;
    }
    filesScanned++;
    if (!ANY_PRODUCT.test(text)) continue;

    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!ANY_PRODUCT.test(line)) continue;
      const spans = specifierSpans(line);
      for (const p of PRODUCTS) {
        p.re.lastIndex = 0;
        for (const m of line.matchAll(p.re)) {
          const context = classifyContext(line, rel, m.index ?? 0, spans);
          hits.push({
            file: rel,
            zone,
            product: p.id,
            tier: p.tier,
            kind: p.kind,
            line: i + 1,
            context,
            loadBearing: LOAD_BEARING.has(context),
            severity: LOAD_BEARING.has(context) ? "informational" : severityFor(zone, p.tier),
            excerpt: line.trim().slice(0, 180),
          });
        }
      }
    }
  }

  // --- rollups -----------------------------------------------------------
  const byFile = new Map();
  for (const h of hits) {
    const e = byFile.get(h.file) ?? {
      file: h.file,
      zone: h.zone,
      hits: 0,
      deny: 0,
      loadBearing: 0,
      products: new Set(),
    };
    e.hits++;
    if (h.loadBearing) e.loadBearing++;
    else if (h.tier === "deny") e.deny++;
    e.products.add(h.product);
    byFile.set(h.file, e);
  }
  const files = [...byFile.values()]
    .map((e) => ({ ...e, products: [...e.products].sort() }))
    .sort((a, b) => b.deny - a.deny || b.hits - a.hits);

  const pathNamedFiles = new Set(pathNamed.map((p) => p.file));
  const retire = files.filter((f) => f.deny >= RETIRE_HIT_THRESHOLD || pathNamedFiles.has(f.file));
  const lineEdits = files.filter((f) => f.deny > 0 && !retire.includes(f));

  const byProduct = {};
  for (const h of hits) {
    const e = (byProduct[h.product] ??= {
      product: h.product,
      tier: h.tier,
      hits: 0,
      loadBearing: 0,
      actionable: 0,
      files: new Set(),
      zones: new Set(),
    });
    e.hits++;
    if (h.loadBearing) e.loadBearing++;
    else if (h.tier === "deny") e.actionable++;
    e.files.add(h.file);
    e.zones.add(h.zone);
  }
  const products = Object.values(byProduct)
    .map((e) => ({ ...e, files: e.files.size, zones: [...e.zones].sort() }))
    .sort((a, b) => b.hits - a.hits);

  const byZone = {};
  for (const h of hits) {
    const e = (byZone[h.zone] ??= {
      zone: h.zone,
      hits: 0,
      deny: 0,
      loadBearing: 0,
      files: new Set(),
    });
    e.hits++;
    if (h.loadBearing) e.loadBearing++;
    else if (h.tier === "deny") e.deny++;
    e.files.add(h.file);
  }
  const zones = Object.values(byZone)
    .map((e) => ({ ...e, files: e.files.size }))
    .sort((a, b) => b.deny - a.deny);

  // "deny" alone over-counts: a package specifier in the migrate command's
  // mapping table is deny-listed AND required. Actionable = deny minus those.
  const loadBearing = hits.filter((h) => h.loadBearing);
  const denyHits = hits.filter((h) => h.tier === "deny" && !h.loadBearing);
  const shippedDeny = denyHits.filter((h) => h.zone === "shipped");

  const byContext = {};
  for (const h of hits) (byContext[h.context] ??= { context: h.context, hits: 0 }).hits++;
  const contexts = Object.values(byContext).sort((a, b) => b.hits - a.hits);

  const result = {
    schema: "repo-cleanup/reference-leakage@1",
    root,
    generatedBy: "reference-leakage.mjs",
    policy: {
      allowedZones: ["attribution surfaces", "theme surfaces"],
      productsWatched: PRODUCTS.length,
      denyListed: PRODUCTS.filter((p) => p.tier === "deny").length,
      reviewListed: PRODUCTS.filter((p) => p.tier === "review").length,
      deliberatelyNotWatched: REJECTED,
    },
    totals: {
      filesScanned,
      filesSkipped,
      hits: hits.length,
      denyHits: denyHits.length,
      reviewHits: hits.filter((h) => h.tier === "review" && !h.loadBearing).length,
      loadBearingHits: loadBearing.length,
      shippedDenyHits: shippedDeny.length,
      filesAffected: files.length,
      filesToRetireOrRename: retire.length,
      filesNeedingLineEdits: lineEdits.length,
    },
    products,
    zones,
    contexts,
    loadBearing: loadBearing.slice(0, 40),
    retire: retire.slice(0, 60),
    lineEdits: lineEdits.slice(0, 120),
    pathNamed,
    worstShipped: shippedDeny.slice(0, 40),
    measurementGaps: [
      "the context labels (package-specifier, migration-source, interop-claim, planning-reference, demo-data) are HEURISTIC line matches; they rank a hit, never hide it, and a mislabel changes the order of the list rather than its contents",
      "the product list is CURATED — a reference product nobody added is invisible to this scan, and no heuristic covers that gap",
      "`review`-tier names have a real false-positive rate (a stripe fill, a Figma interop claim); they are reported, never ranked, and must be read individually",
      "a paraphrase that describes a competitor's feature without naming it is undetectable here",
      "whether a named product is a leak or a required interop claim is a judgement this script does not make",
      "binary and generated artefacts are not scanned; a leak baked into a built bundle is invisible until the source is fixed and it is rebuilt",
    ],
  };

  result.observations = buildObservations(result);
  return result;
}

function buildObservations(r) {
  const obs = [];
  const push = (code, statement, data) => obs.push({ code, statement, data });

  push(
    "REF.totals",
    "third-party product names found outside attribution and theme surfaces",
    r.totals,
  );

  if (r.totals.shippedDenyHits) {
    push("REF.shipped", "reference products named in surfaces a user or downstream agent reads", {
      hits: r.totals.shippedDenyHits,
      samples: r.worstShipped.slice(0, 15),
    });
  }
  if (r.pathNamed.length) {
    push(
      "REF.path-named",
      "files or directories whose own PATH names a reference product",
      r.pathNamed,
    );
  }
  if (r.retire.length) {
    push(
      "REF.research-documents",
      "files dense enough in reference names to be research, not prose with leaks",
      r.retire.slice(0, 20),
    );
  }
  if (r.totals.denyHits) {
    push(
      "REF.by-product",
      "which reference products account for the leakage",
      r.products.filter((p) => p.tier === "deny").slice(0, 20),
    );
    push("REF.by-zone", "where the leakage sits", r.zones);
  }
  if (r.loadBearing.length) {
    push(
      "REF.load-bearing",
      "mentions the software NEEDS — package specifiers and migration sources; report these, never batch-edit them",
      { hits: r.totals.loadBearingHits, samples: r.loadBearing.slice(0, 10) },
    );
  }
  const review = r.products.filter((p) => p.tier === "review");
  if (review.length) {
    push(
      "REF.review-tier",
      "real company names that may be demo data, a theme source or a true interop claim — read, do not batch-fix",
      review,
    );
  }
  return obs;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf("--root");
  process.stdout.write(
    `${JSON.stringify(runReferenceLeakage(i === -1 ? undefined : process.argv[i + 1]), null, 2)}\n`,
  );
}
