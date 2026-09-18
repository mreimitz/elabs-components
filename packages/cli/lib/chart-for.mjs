/**
 * @elabs-ai/components-cli — `chart-for` : rank chart containers by data shape (RM-040).
 *
 * The engine behind `brand-ui chart-for "<data shape>"` (bin/brand-ui.mjs) and the
 * `chart_for` MCP tool (lib/mcp.mjs). Both are thin renderers over
 * {@link matchChartFor}, which is a PURE function over the manifest — no
 * filesystem, no network, no LLM call, so it is unit-testable without either
 * caller and its ranking is reproducible from the manifest alone.
 *
 * WHERE THE DATA COMES FROM: `dataShapes` / `avoidWhen` are NOT authored here or
 * anywhere in `@elabs-ai/components-cli` — they are generated at `pnpm gen`
 * time from each chart container's own `@dataShape` / `@avoidWhen` JSDoc tags
 * (`extractChartDataShapes` in `./core.mjs`), merged into that component's
 * `intent` entry. This module only READS `manifest.packages[pkg].intent[Name]
 * .dataShapes`; it has no way to invent a candidate a container's own source
 * doesn't declare. See `skills/brand-ui/reference/chart-selection.md` for the
 * authored shape → container table this mechanism is meant to serve.
 *
 * RANKING, deliberately legible — two kinds of point, both reproducible by hand:
 *   1. a LITERAL point: a word the caller typed that the container's own
 *      `@dataShape` also uses (singular/plural folded);
 *   2. a ROLE point: callers describe their DATA ("revenue by month by region"),
 *      docblocks describe SHAPES ("measures over continuous time"). {@link ROLES}
 *      names the five roles both vocabularies share — measure, time, category,
 *      geography, part-to-whole. A query word that did not match literally still
 *      earns one point when it and the shape speak of the same role. Without this
 *      the example above returned ONE candidate (ChoroplethChart, on "region") and
 *      no time-series chart at all.
 *   A role point is 1 when the shape names the role outright ("time", "measure"),
 *   0.75 when it only implies it ("periods", "metric") — general charts lead,
 *   specialists follow.
 *   One structural rule: when the query has a time dimension and a shape has
 *   none, that candidate is scaled by 0.75 — a chart that cannot show time
 *   should not outrank one that can.
 * The roles read out of the query are printed ("read as: …") so the ranking is
 * never a black box.
 *
 * The literal pass, as before: a query is tokenized into lowercase words, stop-
 * words dropped; each candidate's SCORE is the count of query tokens that also
 * appear as whole tokens in its best-matching `dataShape` string. No fuzzy
 * matching, no stemming, no weighting by field length — every point in a
 * candidate's score is a word the caller typed and the container's own
 * docblock also uses, so the ranking is legible from the query and the source
 * text alone, never a black box. Ties break on component name (alphabetical)
 * so the order is stable across a manifest regeneration that reorders packages.
 */

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "of",
  "for",
  "and",
  "or",
  "by",
  "per",
  "in",
  "on",
  "to",
  "with",
  "is",
  "are",
  "vs",
]);

const singular = (w) =>
  w.length > 4 && w.endsWith("ies")
    ? `${w.slice(0, -3)}y`
    : w.length > 3 && w.endsWith("s") && !w.endsWith("ss")
      ? w.slice(0, -1)
      : w;

/** Lowercase word tokens (letters/digits only), stopwords + single chars dropped, plurals folded. */
function meaningfulTokens(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(singular);
}

/** The five roles a data description and a chart-shape description share. */
export const ROLES = {
  measure:
    "measure metric value numeric revenue sale count volume amount cost profit spend price rate total number kpi score quantity margin budget order user",
  time: "time date day daily week weekly weekday month monthly quarter quarterly year yearly annual hour hourly minute period timeline trend calendar",
  category:
    "category categorical segment group grouped product team customer channel department type status region country state city entity named",
  geography: "geographic geography geo region country state city map territory location postcode",
  "part-to-whole": "part whole share proportion percentage percent breakdown composition mix",
};
/** The word(s) that NAME each role outright. */
const ROLE_NAMES = {
  measure: ["measure"],
  time: ["time"],
  category: ["category", "categorical"],
  geography: ["geographic", "geography"],
  "part-to-whole": ["whole", "part"],
};
const ROLE_SETS = Object.entries(ROLES).map(([role, words]) => [role, new Set(words.split(" "))]);

/** The roles a token list speaks of. */
function rolesOf(tokens) {
  const out = new Set();
  for (const [role, set] of ROLE_SETS) if (tokens.some((t) => set.has(t))) out.add(role);
  return out;
}

/** Roles read out of a query — exported for the renderers' "read as:" line. */
export function queryRoles(query) {
  return [...rolesOf(meaningfulTokens(query))];
}

/**
 * Literal overlap + role overlap (module docblock). A role scores only through
 * query words that did NOT match literally, so a word is never counted twice.
 */
function overlapScore(queryTokens, shapeText) {
  const shapeList = meaningfulTokens(shapeText);
  const shapeTokens = new Set(shapeList);
  let score = 0;
  const unmatched = [];
  for (const t of new Set(queryTokens)) {
    if (shapeTokens.has(t)) score++;
    else unmatched.push(t);
  }
  // Roles are read from the shape's own statement, not from its illustrations:
  // "(weekday by hour, for example)" and "— ticket volume, event counts" are
  // examples of a two-category grid, they do not make a heatmap a time series.
  const head = String(shapeText || "")
    .replace(/\([^)]*\)/g, " ")
    .split(/\s[—–]\s/)[0];
  // In a SHAPE, "region" means a map, not just another category.
  const geo = ROLE_SETS.find(([role]) => role === "geography")[1];
  const categorySet = ROLE_SETS.find(([role]) => role === "category")[1];
  const headTokens = meaningfulTokens(head);
  const shapeRoles = rolesOf(headTokens);
  if (!headTokens.some((t) => !geo.has(t) && categorySet.has(t))) shapeRoles.delete("category");
  // A shape that NAMES the role ("measures over continuous time") states the
  // general case and earns the full point; one that only implies it ("rank of
  // entities over ordered periods") is a specialisation and earns 0.75 — so the
  // general-purpose chart leads and the specialist follows.
  for (const role of rolesOf(unmatched))
    if (shapeRoles.has(role))
      score += headTokens.some((t) => ROLE_NAMES[role].includes(t)) ? 1 : 0.75;
  // The time rule: the query's time words found no home in this shape at all.
  const timeSet = ROLE_SETS.find(([role]) => role === "time")[1];
  const timeWords = [...new Set(queryTokens)].filter((t) => timeSet.has(t));
  if (
    score &&
    timeWords.length &&
    timeWords.every((t) => unmatched.includes(t)) &&
    !shapeRoles.has("time")
  )
    score *= 0.75;
  return { score, density: score / Math.max(shapeList.length, 1) };
}

/**
 * @typedef {object} ChartForCandidate
 * @property {string} name           the chart container's export name, e.g. "HeatmapChart"
 * @property {string} pkg            the package it ships from, e.g. "@elabs-ai/components-charts"
 * @property {number} score          overlap score (see module docblock) — always > 0
 * @property {string} matchedShape   the container's OWN `@dataShape` text that scored highest
 * @property {string|null} avoidWhen the container's `@avoidWhen` text, when it declared one
 */

/**
 * Rank chart containers against a free-text data-shape query.
 *
 * @param {object|null} manifest       `loadManifest(root)` — reads `packages[*].intent`
 * @param {string} query               free text or shape keywords, e.g. "weekday by hour ticket volume"
 * @param {{ limit?: number }} [opts]  `limit` — max candidates returned (default 5)
 * @returns {ChartForCandidate[]}      ranked, highest score first; empty when the
 *   query has no meaningful tokens, the manifest is absent, or nothing scored.
 */
export function matchChartFor(manifest, query, { limit = 5 } = {}) {
  const queryTokens = meaningfulTokens(query);
  if (!manifest || typeof manifest !== "object" || !queryTokens.length) return [];
  const candidates = [];
  for (const [pkgName, pkg] of Object.entries(manifest.packages || {})) {
    const intent = pkg?.intent || {};
    for (const [name, meta] of Object.entries(intent)) {
      const shapes = meta?.dataShapes;
      if (!Array.isArray(shapes) || !shapes.length) continue;
      // A container that closes several data shapes is judged by whichever
      // ONE shape matches best — never an average across shapes the query
      // didn't ask about — and that shape is what gets quoted back as the
      // reason, so the reader sees exactly why it ranked where it did.
      let best = null;
      for (const shape of shapes) {
        const { score, density } = overlapScore(queryTokens, shape);
        if (score > 0 && (!best || score > best.score)) best = { shape, score, density };
      }
      if (best) {
        candidates.push({
          name,
          pkg: pkgName,
          score: best.score,
          matchedShape: best.shape,
          avoidWhen: meta.avoidWhen ?? null,
          density: best.density,
        });
      }
    }
  }
  // Equal scores: the shape that is MORE ABOUT the query (points per shape word)
  // leads — "measures over continuous time" beats a long docblock that merely
  // mentions time — then the name, so the order is stable.
  candidates.sort(
    (a, b) => b.score - a.score || b.density - a.density || a.name.localeCompare(b.name),
  );
  return candidates.slice(0, limit).map(({ density: _density, ...c }) => c);
}

/** Render {@link matchChartFor}'s output as the compact text both the CLI and the MCP tool print. */
export function renderChartForText(query, candidates) {
  if (!candidates.length) {
    return (
      `chart-for "${query}": no chart container declared a matching @dataShape.\n` +
      `Try different keywords, or see skills/brand-ui/reference/chart-selection.md for the full table.`
    );
  }
  const lines = [`chart-for "${query}" — ${candidates.length} candidate(s), ranked:`];
  const roles = queryRoles(query);
  if (roles.length) lines.push(`  read as: ${roles.join(" × ")}`);
  candidates.forEach((c, i) => {
    lines.push(`  ${i + 1}. ${c.name}  (${c.pkg}, score ${c.score})`);
    lines.push(`     shape: ${c.matchedShape}`);
    if (c.avoidWhen) lines.push(`     avoid when: ${c.avoidWhen}`);
  });
  lines.push(
    "",
    "Per the chart-selection rules: compare at least 3 candidates and write down why the",
    "others lost — see skills/brand-ui/reference/chart-selection.md.",
  );
  return lines.join("\n");
}
