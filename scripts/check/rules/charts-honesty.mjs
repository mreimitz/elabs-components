/**
 * charts-honesty — `@elabs-ai/components-charts` draws honestly (RM-039, #265, #275).
 * Ported from scripts/check-charts-honesty.mjs (rules 1–3; rule 4, unit captions,
 * is `chart-unit-caption`). Provenance: docs/review/2026-09-04-lieflat-charts-gap-analysis.md §5 C5.
 *
 *   1. zero-based bars — a `bar-chart`/`waterfall-chart`/`histogram` file that owns a
 *      `scaleLinear` domain must call `domain: resolveBarValueDomain(` / `return
 *      resolveBarValueDomain(` or `resolveYDomain(…, { includeZero: true })`.
 *   2. area radius sqrt — `const radius|r = … / …max…` must contain `sqrt(`.
 *   3. no Math.random — use `seededRnd` (stories in scope; tests exempt).
 * Scope: rules 1–2 police a value ENCODING → `charts/**` + `marks/**`; rule 3 is
 * determinism → the whole package. Comments are blanked (line-preserving) first.
 * Escape hatch: `// honesty:allow <reason>` on the flagged line or the line above.
 */

export const CHARTS_ROOT = "packages/charts/src";
export const ENCODING_GLOB = [
  `${CHARTS_ROOT}/charts/**/*.{ts,tsx}`,
  `${CHARTS_ROOT}/marks/**/*.{ts,tsx}`,
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
const RATIO_OF_MAX_RE = /\/\s*\w*(?:[Mm]ax|MAX)\w*/;
const CONTAINS_SQRT_RE = /\bsqrt\s*\(/i;

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
    ],
  },
};
