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
 * anywhere in `@elabs-ai/components-cli` — they are generated at `pnpm manifest`
 * time from each chart container's own `@dataShape` / `@avoidWhen` JSDoc tags
 * (`extractChartDataShapes` in `./core.mjs`), merged into that component's
 * `intent` entry. This module only READS `manifest.packages[pkg].intent[Name]
 * .dataShapes`; it has no way to invent a candidate a container's own source
 * doesn't declare. See `skills/brand-ui/reference/chart-selection.md` for the
 * authored shape → container table this mechanism is meant to serve.
 *
 * RANKING, deliberately dumb: a query is tokenized into lowercase words, stop-
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

/** Lowercase word tokens (letters/digits only), stopwords + single chars dropped. */
function meaningfulTokens(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** How many of `queryTokens` appear as a whole token in `shapeText`. */
function overlapScore(queryTokens, shapeText) {
  const shapeTokens = new Set(meaningfulTokens(shapeText));
  let score = 0;
  for (const t of queryTokens) if (shapeTokens.has(t)) score++;
  return score;
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
        const score = overlapScore(queryTokens, shape);
        if (score > 0 && (!best || score > best.score)) best = { shape, score };
      }
      if (best) {
        candidates.push({
          name,
          pkg: pkgName,
          score: best.score,
          matchedShape: best.shape,
          avoidWhen: meta.avoidWhen ?? null,
        });
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return candidates.slice(0, limit);
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
