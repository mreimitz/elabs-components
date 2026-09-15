/**
 * chart-hairline — chart furniture is ONE ink at ONE weight.
 * Ported from scripts/check-chart-hairline.mjs.
 *
 * Furniture (grid rows, axis rules, drop lines, tracks, links, radar rings, network
 * edges) paints `--chart-grid` at `CHART_HAIRLINE_WIDTH`. Three rules:
 *   1. INK IS NEVER DIMMED — an element stroked with the grid ink carries no
 *      `opacity`/`strokeOpacity` literal below 1.
 *   2. WEIGHT IS THE SHARED CONSTANT — a numeric `strokeWidth` literal on such an
 *      element equals `CHART_HAIRLINE_WIDTH` (identifiers/expressions pass).
 *   3. THE TOKEN KEEPS ITS OWN RUNG — no theme aliases `--chart-grid: var(--border)`.
 * One element opts out with an in-span `// chart-hairline-exempt: <reason>`.
 * Declared gap: Tailwind class spellings (`opacity-[0.35]`) are not checked.
 * An element that cannot be delimited is reported, never skipped.
 */
import { lineOf } from "../context.mjs";

const HAIRLINE_MODULE = "packages/charts/src/chart-hairline.ts";
const GRID_INK = [
  'stroke="var(--chart-grid)"',
  "stroke={chartCssVars.grid}",
  "stroke={radarCssVars.grid}",
  "stroke={gridLineColor}",
];

/** The attribute span of the JSX element owning the ink at `inkIndex`, or null. */
export function elementSpan(src, inkIndex) {
  let start = -1;
  for (let i = inkIndex; i >= 0; i--) {
    if (src[i] === "<") {
      start = i;
      break;
    }
    // `=>` / `>=` live inside attribute expressions; any other `>` left the element.
    if (src[i] === ">" && src[i - 1] !== "=" && src[i + 1] !== "=") return null;
  }
  if (start < 0) return null;
  let depth = 0;
  let quote = null;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "{") depth++;
    else if (ch === "}") depth--;
    else if (ch === ">" && depth === 0) return src.slice(start, i + 1);
  }
  return null;
}

/** Rules 1 and 2 over one file's source → findings. */
export function auditSource(src, file, hairline) {
  const findings = [];
  for (const ink of GRID_INK) {
    for (let at = src.indexOf(ink); at !== -1; at = src.indexOf(ink, at + ink.length)) {
      const line = lineOf(src, at);
      const span = elementSpan(src, at);
      if (span == null) {
        findings.push({ file, line, msg: `could not delimit the element owning ${ink}` });
        continue;
      }
      // The reason must sit on the marker's own line.
      if (/\/\/[^\S\n]*chart-hairline-exempt:[^\S\n]*\S/.test(span)) continue;
      const dim = span.match(/\b(?:stroke)?[Oo]pacity=\{\s*([0-9.]+)\s*\}/);
      if (dim && Number(dim[1]) < 1)
        findings.push({
          file,
          line,
          msg: `chart furniture ink dimmed by ${dim[1]} — --chart-grid is already tuned for a sub-pixel stroke; drop the opacity or use a different token`,
        });
      const w = span.match(/\bstrokeWidth=\{\s*([0-9.]+)\s*\}/);
      if (w && Number(w[1]) !== hairline)
        findings.push({
          file,
          line,
          msg: `chart furniture drawn at strokeWidth ${w[1]}, not the shared CHART_HAIRLINE_WIDTH (${hairline}) — import it from ${HAIRLINE_MODULE}`,
        });
    }
  }
  return findings;
}

// ── fixtures ─────────────────────────────────────────────────────────────────
const HAIRLINE_TS = "export const CHART_HAIRLINE_WIDTH = 0.65;\n";
const chart = (body) => ({
  files: { [HAIRLINE_MODULE]: HAIRLINE_TS, "packages/charts/src/x/grid.tsx": body },
});
const themes = (css) => ({
  files: {
    [HAIRLINE_MODULE]: HAIRLINE_TS,
    "packages/tokens/src/themes.css": ":root { --chart-grid: oklch(0.74 0.01 264); }",
    "packages/tokens/src/themes/light.css": css,
  },
});

export default {
  id: "chart-hairline",
  scope: "components",
  doc: "Draw chart furniture with `--chart-grid` at full opacity and `CHART_HAIRLINE_WIDTH` (never a dimming `opacity`/`strokeOpacity` or another numeric `strokeWidth`), and never alias `--chart-grid` to `var(--border)`; one element may opt out with `// chart-hairline-exempt: <reason>`.",
  baseline: "none",
  run(ctx) {
    const m = ctx
      .readFile(HAIRLINE_MODULE)
      .match(/export const CHART_HAIRLINE_WIDTH\s*=\s*([0-9.]+)\s*;/);
    if (!m) return [{ file: HAIRLINE_MODULE, line: 1, msg: "CHART_HAIRLINE_WIDTH not found" }];
    const hairline = Number(m[1]);
    const findings = [];
    for (const file of ctx.glob("packages/charts/src/**/*.{ts,tsx}", {
      ignore: "**/*.{test,stories,spec}.{ts,tsx}",
    }))
      findings.push(...auditSource(ctx.readFile(file), file, hairline));
    for (const file of ctx.glob([
      "packages/tokens/src/themes.css",
      "packages/tokens/src/themes/*.css",
    ])) {
      const src = ctx.readFile(file);
      const hit = src.match(/--chart-grid:\s*var\(--border\)/);
      if (hit)
        findings.push({
          file,
          line: lineOf(src, hit.index),
          msg: "--chart-grid is aliased back to var(--border) — that alias IS the original bug; give it its own literal",
        });
    }
    return findings;
  },
  fixtures: {
    pass: [
      chart("<line stroke={chartCssVars.grid} strokeWidth={CHART_HAIRLINE_WIDTH} />"),
      chart('<path stroke="var(--chart-grid)" strokeWidth={link.width} />'),
      chart("<line stroke={chartCssVars.grid} strokeWidth={TRACK_STROKE_WIDTH} />"),
      chart(
        "<line stroke={chartCssVars.grid} strokeOpacity={1} strokeWidth={CHART_HAIRLINE_WIDTH} />",
      ),
      chart("<line stroke={gridLineColor} strokeWidth={0.65} />"),
      chart('<line stroke="var(--chart-1)" strokeOpacity={0.35} strokeWidth={2} />'),
      chart(
        '<path stroke="var(--chart-grid)"\n  // chart-hairline-exempt: a hatch texture, not a rule\n  strokeWidth={1} />',
      ),
      {
        files: {
          [HAIRLINE_MODULE]: HAIRLINE_TS,
          "packages/charts/src/x/grid.test.tsx":
            '<path stroke="var(--chart-grid)" strokeWidth={1} />',
        },
      },
      themes('[data-theme="dark"] { --chart-grid: oklch(0.52 0.012 257); }'),
    ],
    fail: [
      chart('<path stroke="var(--chart-grid)" strokeOpacity={0.35} strokeWidth={0.65} />'),
      chart("<line stroke={chartCssVars.grid} strokeOpacity={0.6} strokeWidth={0.65} />"),
      chart("<line stroke={radarCssVars.grid} opacity={0.5} strokeWidth={0.65} />"),
      chart("<line stroke={chartCssVars.grid} strokeWidth={1} />"),
      chart('<path stroke="var(--chart-grid)" strokeWidth={1.4} />'),
      chart('<path stroke="var(--chart-grid)"\n  // chart-hairline-exempt:\n  strokeWidth={1} />'),
      chart(
        '<path stroke="var(--chart-grid)"\n  // chart-hairline-exempt: hatch\n  strokeWidth={1} />\n<line stroke={chartCssVars.grid} strokeWidth={1} />',
      ),
      chart(
        '<LineRadial\n  angle={(d) => radialScale(d.angle) ?? 0}\n  fill="none"\n  stroke={radarCssVars.grid}\n  strokeWidth={1}\n/>',
      ),
      chart('stroke="var(--chart-grid)" strokeWidth={1}'),
      themes('[data-theme="light"] { --chart-grid: var(--border); }'),
      { files: { "packages/charts/src/chart-hairline.ts": "export const X = 1;" } },
    ],
  },
};
