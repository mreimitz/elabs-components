/**
 * charts-honesty — `@elabs-ai/components-charts` draws honestly (RM-039, #265, #275, #299).
 * Ported from scripts/check-charts-honesty.mjs (rules 1–3; rule 4, unit captions,
 * is `chart-unit-caption`). Provenance: docs/review/2026-09-04-lieflat-charts-gap-analysis.md §5 C5.
 *
 *   1. zero-based bars — a `bar-chart`/`waterfall-chart`/`histogram` file that owns a
 *      `scaleLinear` domain must call `domain: resolveBarValueDomain(` / `return
 *      resolveBarValueDomain(` or `resolveYDomain(…, { includeZero: true })`.
 *   2. area radius sqrt — `const radius|r = … / …max…` must contain `sqrt(`; also
 *      catches the same ratio laundered through an intermediate variable and then
 *      linearly interpolated (`MIN_x + t * (MAX_x - MIN_x)`, #299 (c)).
 *   3. no Math.random — use `seededRnd` (stories in scope; tests exempt).
 * Scope: rules 1–2 police a value ENCODING → `charts/**` + `marks/**` +
 * `registry/blocks/**` (#299 (a) — a copy-own block is exactly where this lie ships
 * and can never be patched after the fact); rule 3 is determinism → the whole
 * package. Comments are blanked (line-preserving) first.
 * Escape hatch: `// honesty:allow <reason>` on the flagged line or the line above.
 */

export const CHARTS_ROOT = "packages/charts/src";
export const REGISTRY_BLOCKS_ROOT = "registry/blocks";
export const ENCODING_GLOB = [
  `${CHARTS_ROOT}/charts/**/*.{ts,tsx}`,
  `${CHARTS_ROOT}/marks/**/*.{ts,tsx}`,
  `${REGISTRY_BLOCKS_ROOT}/**/*.{ts,tsx}`,
];
const DIRS_IGNORE = "**/{node_modules,dist}/**";
const DOC_REF = "docs/review/2026-09-04-lieflat-charts-gap-analysis.md §5 C5";

const isTestFile = (f) => /\.test\.(ts|tsx)$/.test(f);
const isStoryFile = (f) => /\.stories\.tsx$/.test(f);
const lineNoAt = (src, index) => src.slice(0, index).split("\n").length;
const lineText = (src, n) => src.split("\n")[n - 1] ?? "";
const hasHonestyAllow = (src, n) =>
  /honesty:allow/.test(lineText(src, n)) || /honesty:allow/.test(lineText(src, n - 1));

/** Blank comment content, preserving newlines and every other character's position. */
export function stripCommentsPreservingLines(src) {
  const out = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  return out.replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(m.length - p1.length));
}

// ── Rule 1 ──────────────────────────────────────────────────────────────────
const BAR_FAMILY_FILE_RE = /[/\\](bar-chart|waterfall-chart|histogram)\.tsx?$/i;
const ZERO_FORCING_MARKERS = [
  /\b(?:domain\s*:\s*|return\s+)resolveBarValueDomain\s*\(/,
  /\b(?:domain\s*:\s*|return\s+)resolveYDomain\s*\([\s\S]{0,200}?includeZero\s*:\s*true/,
];

export function findZeroBasedBarViolations(file, src) {
  if (!BAR_FAMILY_FILE_RE.test(file)) return [];
  const code = stripCommentsPreservingLines(src);
  const m = /\bscaleLinear\s*\(/.exec(code);
  if (!m || ZERO_FORCING_MARKERS.some((re) => re.test(code))) return [];
  const line = lineNoAt(code, m.index);
  if (hasHonestyAllow(src, line)) return [];
  return [
    {
      file,
      line,
      msg: `[zero-based-bars] owns a scaleLinear value-domain but never calls resolveBarValueDomain(...) or resolveYDomain(..., { includeZero: true }) — a bar length must be drawn from a domain that includes 0 (${DOC_REF})`,
    },
  ];
}

// ── Rule 2 ──────────────────────────────────────────────────────────────────
const RADIUS_ASSIGNMENT_RE = /\b(?:const|let)\s+(\w*[Rr]adius\w*|r)\s*=\s*([^;\n]+);?/g;
// #299 (b): a min–max normalisation's denominator is parenthesised
// (`/ (maxValue - minValue)`), not a bare identifier — allow an optional `(`
// after the `/` so the ratio is still recognised as "of a max".
const RATIO_OF_MAX_RE = /\/\s*\(?\s*\w*(?:[Mm]ax|MAX)\w*/;
const CONTAINS_SQRT_RE = /\bsqrt\s*\(/i;
// #299 (c): the ratio is laundered through an intermediate variable (any name,
// not just one shaped like a radius) and then linearly interpolated between a
// MIN_ and a MAX_ constant — the exact `chart-editorial-almanac` idiom:
//   const t = (value - minValue) / (maxValue - minValue);
//   return MIN_RADIUS + t * (MAX_RADIUS - MIN_RADIUS);
const RADIUS_INTERPOLATION_RE = /\bMIN_\w*\s*\+\s*(\w+)\s*\*\s*\(\s*MAX_\w*\s*-\s*MIN_\w*\s*\)/g;

/** The last `const|let <name> = <rhs>` assignment to `name` before `beforeIndex`. */
function findLastAssignmentBefore(code, name, beforeIndex) {
  const re = new RegExp(`\\b(?:const|let)\\s+${name}\\s*=\\s*([^;\\n]+);?`, "g");
  let last = null;
  for (const m of code.slice(0, beforeIndex).matchAll(re)) last = m[1];
  return last;
}

export function findAreaRadiusViolations(file, src) {
  const out = [];
  const code = stripCommentsPreservingLines(src);
  for (const m of code.matchAll(RADIUS_ASSIGNMENT_RE)) {
    if (!RATIO_OF_MAX_RE.test(m[2]) || CONTAINS_SQRT_RE.test(m[2])) continue;
    const line = lineNoAt(code, m.index);
    if (hasHonestyAllow(src, line)) continue;
    out.push({
      file,
      line,
      msg: `[area-radius-sqrt] "${m[0].trim()}" scales a radius linearly by a ratio of a max — use sqrt(value / max) (marks/area-radius.ts areaRadius) (${DOC_REF})`,
    });
  }
  for (const m of code.matchAll(RADIUS_INTERPOLATION_RE)) {
    const varName = m[1];
    const ratioRhs = findLastAssignmentBefore(code, varName, m.index);
    if (!ratioRhs || !RATIO_OF_MAX_RE.test(ratioRhs) || CONTAINS_SQRT_RE.test(ratioRhs)) continue;
    const line = lineNoAt(code, m.index);
    if (hasHonestyAllow(src, line)) continue;
    out.push({
      file,
      line,
      msg: `[area-radius-sqrt] "${m[0].trim()}" linearly interpolates a radius using "${varName}", a ratio-of-max computed without sqrt(...) — use sqrt(value / max) (marks/area-radius.ts areaRadius) (${DOC_REF})`,
    });
  }
  return out;
}

// ── Rule 3 ──────────────────────────────────────────────────────────────────
export function findMathRandomViolations(file, src) {
  if (isTestFile(file)) return [];
  const out = [];
  const code = stripCommentsPreservingLines(src);
  for (const m of code.matchAll(/Math\.random\s*\(/g)) {
    const line = lineNoAt(code, m.index);
    if (hasHonestyAllow(src, line)) continue;
    out.push({
      file,
      line,
      msg: `[no-math-random] Math.random() is banned in @elabs-ai/components-charts — use seededRnd(i, k) (marks/seeded-rnd.ts) so output is reproducible (${DOC_REF})`,
    });
  }
  return out;
}

// ── fixtures ─────────────────────────────────────────────────────────────────
const at = (file, body) => ({ files: { [`${CHARTS_ROOT}/${file}`]: body } });
// #299 (a): a copy-own registry block, not a package chart/mark — the file this
// gate missed. Deliberately a fixture, not the real block: fixing the block
// itself is a separate change; this gate must catch the shape wherever it ships.
const atRegistryBlock = (file, body) => ({
  files: { [`${REGISTRY_BLOCKS_ROOT}/${file}`]: body },
});

export default {
  id: "charts-honesty",
  scope: "components",
  doc: "In `@elabs-ai/components-charts`, draw bars from a zero-including domain (`resolveBarValueDomain` / `resolveYDomain(…, { includeZero: true })`), scale area radii by `sqrt(value / max)`, and never call `Math.random` (use `seededRnd`); a reasoned exception carries `// honesty:allow <reason>`.",
  baseline: "none",
  run(ctx) {
    const out = [];
    for (const file of ctx.glob(ENCODING_GLOB, { ignore: DIRS_IGNORE })) {
      if (isTestFile(file) || isStoryFile(file)) continue;
      const src = ctx.readFile(file);
      out.push(...findZeroBasedBarViolations(file, src), ...findAreaRadiusViolations(file, src));
    }
    for (const file of ctx.glob(`${CHARTS_ROOT}/**/*.{ts,tsx}`, { ignore: DIRS_IGNORE }))
      out.push(...findMathRandomViolations(file, ctx.readFile(file)));
    return out;
  },
  fixtures: {
    pass: [
      at(
        "charts/bar-chart.tsx",
        "const s = scaleLinear({\n  domain: resolveBarValueDomain(maxValue, minValue),\n});",
      ),
      at(
        "charts/bar-chart.tsx",
        "const s = scaleLinear({\n  domain: resolveYDomain(raw, { includeZero: true }),\n});",
      ),
      at(
        "charts/bar-chart.tsx",
        "const s = scaleLinear({ domain: [lo, hi] }); // honesty:allow zoomed, see #123",
      ),
      at(
        "charts/bar-chart.tsx",
        "export function UnitChart() { return marks.map((m) => m.size); }",
      ),
      at(
        "charts/dumbbell-chart.tsx",
        "const s = scaleLinear({ domain: [lo, hi], range: [0, w] });",
      ),
      at("charts/bar.tsx", "const scale = useChart().valueScale; scale(value);"),
      at(
        "charts/bar-chart.tsx",
        "function resolveBarValueDomain(max, min) {\n  return [Math.min(min, 0), Math.max(max, 0)];\n}\nconst v = scaleLinear({\n  domain: resolveBarValueDomain(maxValue, minValue),\n});\nconst r = (k) => {\n  return resolveBarValueDomain(max, min);\n};",
      ),
      // rule 1 is encoding-scoped: a bar-chart outside charts/ + marks/ is not scanned
      at("gantt/bar-chart.tsx", "const s = scaleLinear({ domain: [lo, hi] });"),
      at("charts/heatmap-scale.ts", "const radius = rMax * Math.sqrt(value / maxValue);"),
      at(
        "marks/area-radius.ts",
        "export function areaRadius(v, max, rMax) {\n  const ratio = Math.max(v, 0) / max;\n  return rMax * Math.sqrt(ratio);\n}",
      ),
      at("charts/dumbbell-chart.tsx", "const radius = 5;"),
      at(
        "charts/heatmap-scale.ts",
        "const radius = rMax * (value / maxValue); // honesty:allow corrected upstream, #124",
      ),
      at(
        "charts/heatmap-scale.ts",
        "/**\n * WRONG: const radius = rMax * (value / maxValue);\n */\nconst radius = rMax * Math.sqrt(value / maxValue);",
      ),
      at("gantt/layout.ts", "const radius = rMax * (value / maxValue);"),
      at("charts/some-chart.tsx", "const jitter = seededRnd(i, seed);"),
      at(
        "charts/network/layouts/force.ts",
        "export function seededRandomSource(seed) {\n  let i = 0;\n  return () => seededRnd(i++, seed);\n}",
      ),
      at("charts/distribution/bins.test.ts", "const label = `drop-${Math.random()}`;"),
      at(
        "marks/seeded-rnd.ts",
        "/**\n * Math.random() would make every render a different picture.\n */\nexport function seededRnd(i, k) { return 0; }",
      ),
      at(
        "charts/some-chart.tsx",
        "const x = Math.random(); // honesty:allow dev-only warning, #125",
      ),
      at(
        "charts/some-chart.tsx",
        "// honesty:allow dev-only warning, #125\nconst x = Math.random();",
      ),
      // #299 (c): the ratio is laundered through an intermediate variable, but that
      // variable is itself computed with sqrt — a legitimate area encoding.
      at(
        "charts/heatmap-scale.ts",
        "const MIN_RADIUS = 3;\nconst MAX_RADIUS = 16;\nfunction radiusFor(value, maxValue, minValue) {\n  const t = Math.sqrt((value - minValue) / (maxValue - minValue));\n  return MIN_RADIUS + t * (MAX_RADIUS - MIN_RADIUS);\n}",
      ),
      // #299 (a): scope now reaches registry/blocks — a block using the honest
      // sqrt helper must still pass.
      atRegistryBlock(
        "chart-editorial-almanac/chart-editorial-almanac.tsx",
        'import { areaRadius } from "@elabs-ai/components-charts";\nconst radiusFor = (value) => areaRadius(value, maxValue, MAX_RADIUS);',
      ),
    ],
    fail: [
      at(
        "charts/bar-chart.tsx",
        "const valueScale = scaleLinear({\n  domain: [minValue, maxValue],\n});",
      ),
      at(
        "charts/waterfall-chart.tsx",
        "const s = scaleLinear({ domain: [lo, hi], range: [0, w] });",
      ),
      at("marks/histogram.ts", "scaleLinear({domain:[a,b]})"),
      at(
        "charts/bar-chart.tsx",
        "function resolveBarValueDomain(max, min) {\n  return [Math.min(min, 0), Math.max(max, 0)];\n}\nconst v = scaleLinear({\n  domain: [minValue, maxValue],\n});",
      ),
      at("charts/heatmap-scale.ts", "const radius = rMax * (value / maxValue);"),
      at("charts/network-layout.ts", "const r = maxRadius * (count / countMax);"),
      at("charts/some-chart.tsx", "const jitter = Math.random();"),
      at("charts/some.stories.tsx", "progress: Math.random(),"),
      at("gantt/gantt.stories.tsx", "export const tasks = [{ progress: Math.random() }];"),
      // #299 (b): the min–max denominator is parenthesised — the shape the old
      // RATIO_OF_MAX_RE could not see.
      at(
        "charts/heatmap-scale.ts",
        "const radius = rMax * (value - minValue) / (maxValue - minValue);",
      ),
      // #299 (c): the ratio is laundered through an intermediate variable named
      // `t` (no "radius"/"r" in its name) and then linearly interpolated — the
      // exact `chart-editorial-almanac` idiom (verbatim fixture, not the block).
      at(
        "charts/heatmap-scale.ts",
        "const MIN_RADIUS = 3;\nconst MAX_RADIUS = 16;\nfunction radiusFor(value, maxValue, minValue) {\n  const t = (value - minValue) / (maxValue - minValue);\n  return MIN_RADIUS + t * (MAX_RADIUS - MIN_RADIUS);\n}",
      ),
      // #299 (a): scope now reaches registry/blocks — the exact shape must be
      // caught there too, via a fixture (fixing the real block is a separate change).
      atRegistryBlock(
        "chart-editorial-almanac/chart-editorial-almanac.tsx",
        "const MIN_RADIUS = 3;\nconst MAX_RADIUS = 16;\nfunction radiusFor(value, maxValue, minValue) {\n  const t = (value - minValue) / (maxValue - minValue);\n  return MIN_RADIUS + t * (MAX_RADIUS - MIN_RADIUS);\n}",
      ),
    ],
  },
};
