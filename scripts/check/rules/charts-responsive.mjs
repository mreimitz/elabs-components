/**
 * charts-responsive — every chart container follows the responsive contract (ADR 0039).
 *
 *   1. publishes its tier — a container module (`packages/charts/src/charts/**\/*-chart.tsx`
 *      exporting a `forwardRef` component) renders `ChartPlotRoot`, sets
 *      `data-chart-breakpoint` itself, or renders another container that does (a thin
 *      wrapper such as WaterfallChart over BarChart).
 *   2. resolves per-breakpoint props — a prop typed `Responsive<…>` is read through
 *      `resolveResponsive(` / `useResponsiveValue(` or handed on whole (`plotBox={{ plotHeight }}`,
 *      `plotHeight={plotHeight}`); never branched on directly (`plotHeight.base`,
 *      `typeof plotHeight === "number"`, `"base" in plotHeight`).
 * Scope: rule 1 → `charts/**`; rule 2 → `charts/**`, `chart-frame/**`, `auto-chart/**`,
 * minus `charts/chart-breakpoint.ts` (the resolvers themselves). Comments are blanked first.
 * Escape hatch: `// charts-responsive-exempt: <reason>` on the flagged line or the line above.
 */

export const CHARTS_ROOT = "packages/charts/src";
const DIRS_IGNORE = "**/{node_modules,dist}/**";
const RESOLVER_MODULE = `${CHARTS_ROOT}/charts/chart-breakpoint.ts`;
const ADR = "docs/ADR/0039-chart-responsive-contract.md";

const isTestOrStory = (f) => /\.(test|stories)\.(ts|tsx)$/.test(f);
const isContainerFile = (f) => /\/charts\/(?:.+\/)?[a-z0-9-]+-chart\.tsx$/.test(f);

/** Blank `//` and `/* *\/` comments, keeping every newline so line numbers hold. */
function blankComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, (m, lead) => lead + " ".repeat(m.length - lead.length));
}

const lineAt = (text, index) => text.slice(0, index).split("\n").length;

function isExempt(src, line) {
  const lines = src.split("\n");
  const here = lines[line - 1] ?? "";
  const above = lines[line - 2] ?? "";
  return (
    /charts-responsive-exempt:\s*\S/.test(here) || /charts-responsive-exempt:\s*\S/.test(above)
  );
}

// ── Rule 1 ──────────────────────────────────────────────────────────────────
const EXPORTED_CONTAINER_RE = /export\s+const\s+([A-Z]\w*)\s*=\s*forwardRef\b/g;
const PUBLISHES_TIER_RE = /<ChartPlotRoot\b|data-chart-breakpoint\s*=/;

/**
 * @param {Record<string, string>} files container file → source
 * @returns {{ file: string, line: number, msg: string }[]}
 */
export function findUnpublishedContainers(files) {
  const exportsOf = new Map();
  const compliant = new Set();
  for (const [file, src] of Object.entries(files)) {
    const code = blankComments(src);
    const names = [...code.matchAll(EXPORTED_CONTAINER_RE)].map((m) => m[1]);
    exportsOf.set(file, names);
    if (PUBLISHES_TIER_RE.test(code)) for (const n of names) compliant.add(n);
  }
  // A wrapper that renders a compliant container is compliant; iterate to a fixed point.
  let grew = true;
  while (grew) {
    grew = false;
    for (const [file, names] of exportsOf) {
      if (names.length === 0 || names.every((n) => compliant.has(n))) continue;
      const code = blankComments(files[file]);
      const rendersCompliant = [...code.matchAll(/<([A-Z]\w*)[\s/>]/g)].some(
        (m) => compliant.has(m[1]) && !names.includes(m[1]),
      );
      if (rendersCompliant) {
        for (const n of names) compliant.add(n);
        grew = true;
      }
    }
  }
  const out = [];
  for (const [file, names] of exportsOf) {
    const src = files[file];
    for (const name of names) {
      if (compliant.has(name)) continue;
      const index = src.search(new RegExp(`export\\s+const\\s+${name}\\b`));
      const line = lineAt(src, Math.max(index, 0));
      if (isExempt(src, line)) continue;
      out.push({
        file,
        line,
        msg: `[publish-tier] ${name} never publishes its breakpoint tier — render its root as <ChartPlotRoot> (charts/chart-breakpoint.ts), or render a container that does (${ADR} §1)`,
      });
    }
  }
  return out;
}

// ── Rule 2 ──────────────────────────────────────────────────────────────────
const RESPONSIVE_PROP_RE = /\b(\w+)\??\s*:\s*Responsive</g;

/** @returns {{ file: string, line: number, msg: string }[]} */
export function findDirectResponsiveReads(file, src) {
  if (file === RESOLVER_MODULE) return [];
  const code = blankComments(src);
  const props = new Set([...code.matchAll(RESPONSIVE_PROP_RE)].map((m) => m[1]));
  const out = [];
  for (const name of props) {
    const direct = new RegExp(
      [
        `\\b${name}\\??\\.(?:base|medium|narrow)\\b`,
        `\\b${name}\\[["'](?:base|medium|narrow)["']\\]`,
        `\\btypeof\\s+${name}\\b`,
        `["'](?:base|medium|narrow)["']\\s+in\\s+${name}\\b`,
      ].join("|"),
      "g",
    );
    for (const m of code.matchAll(direct)) {
      const line = lineAt(code, m.index);
      if (isExempt(src, line)) continue;
      out.push({
        file,
        line,
        msg: `[resolve-responsive] "${m[0]}" reads the Responsive<…> prop "${name}" directly — resolve it with resolveResponsive(${name}, breakpoint) / useResponsiveValue(${name}), or hand it on whole (${ADR} §2)`,
      });
    }
  }
  return out;
}

// ── fixtures ─────────────────────────────────────────────────────────────────
const at = (file, body) => ({ files: { [`${CHARTS_ROOT}/${file}`]: body } });
const ROOTED_BAR =
  "export const BarChart = forwardRef(function BarChart(p, ref) {\n  return <ChartPlotRoot ref={ref} plotBox={{ plotHeight: p.plotHeight }} />;\n});";

export default {
  id: "charts-responsive",
  scope: "components",
  doc: "Every `@elabs-ai/components-charts` container publishes its breakpoint tier (renders `ChartPlotRoot`, sets `data-chart-breakpoint`, or wraps a container that does), and a `Responsive<…>` prop is read only through `resolveResponsive` / `useResponsiveValue` or handed on whole — never branched on directly (ADR 0039); opt out with `// charts-responsive-exempt: <reason>`.",
  baseline: "none",
  run(ctx) {
    const containers = {};
    for (const file of ctx.glob(`${CHARTS_ROOT}/charts/**/*.tsx`, { ignore: DIRS_IGNORE })) {
      if (isTestOrStory(file) || !isContainerFile(file)) continue;
      containers[file] = ctx.readFile(file);
    }
    const out = findUnpublishedContainers(containers);
    const readScope = ["charts", "chart-frame", "auto-chart"].map(
      (dir) => `${CHARTS_ROOT}/${dir}/**/*.{ts,tsx}`,
    );
    for (const file of ctx.glob(readScope, { ignore: DIRS_IGNORE })) {
      if (isTestOrStory(file)) continue;
      out.push(...findDirectResponsiveReads(file, ctx.readFile(file)));
    }
    return out;
  },
  fixtures: {
    pass: [
      at("charts/bar-chart.tsx", ROOTED_BAR),
      at(
        "charts/sparkline-chart.tsx",
        "export const SparklineChart = forwardRef(function SparklineChart(p, ref) {\n  return <div ref={ref} data-chart-breakpoint={breakpoint} />;\n});",
      ),
      {
        files: {
          [`${CHARTS_ROOT}/charts/bar-chart.tsx`]: ROOTED_BAR,
          [`${CHARTS_ROOT}/charts/waterfall-chart.tsx`]:
            "export const WaterfallChart = forwardRef(function WaterfallChart(p, ref) {\n  return <BarChart ref={ref} plotHeight={p.plotHeight} />;\n});",
        },
      },
      at(
        "charts/pie-chart.tsx",
        "// charts-responsive-exempt: sized by the host, never by its container\nexport const PieChart = forwardRef(function PieChart(p, ref) {\n  return <div ref={ref} />;\n});",
      ),
      // not a container module: only `*-chart.tsx` files are held to rule 1
      at(
        "charts/bar.tsx",
        "export const Bar = forwardRef(function Bar(p, ref) { return <rect />; });",
      ),
      at(
        "charts/line-chart.tsx",
        "interface P { plotHeight?: Responsive<ChartPlotHeight> }\nconst h = useResponsiveValue(plotHeight);\nconst style = resolveResponsive(plotHeight, bp);\nconst fill = plotHeight === undefined;",
      ),
      at(
        "chart-frame/chart-frame.tsx",
        "interface P { plotHeight?: Responsive<ChartPlotHeight> }\n<ChartFramePlotHeightProvider value={plotHeight} />",
      ),
      at(
        "auto-chart/auto-chart.tsx",
        'interface P { plotHeight?: Responsive<ChartPlotHeight> }\n// charts-responsive-exempt: a pixel number is the fixed-box form here\nconst fixed = typeof plotHeight === "number" ? plotHeight : undefined;',
      ),
      // the resolver module itself may look inside
      at(
        "charts/chart-breakpoint.ts",
        "export function resolveResponsive(value: Responsive<T>, bp) { return value.base; }",
      ),
    ],
    fail: [
      at(
        "charts/bar-chart.tsx",
        "export const BarChart = forwardRef(function BarChart(p, ref) {\n  return <div ref={ref} style={{ aspectRatio: '2 / 1' }} />;\n});",
      ),
      at(
        "charts/waterfall-chart.tsx",
        "export const WaterfallChart = forwardRef(function WaterfallChart(p, ref) {\n  return <BarChart ref={ref} />;\n});",
      ),
      at(
        "charts/line-chart.tsx",
        "interface P { plotHeight?: Responsive<ChartPlotHeight> }\nconst wide = plotHeight.base;",
      ),
      at(
        "charts/line-chart.tsx",
        'interface P { plotHeight?: Responsive<ChartPlotHeight> }\nconst px = typeof plotHeight === "number";',
      ),
      at(
        "chart-frame/chart-frame.tsx",
        'interface P { density?: Responsive<ChartDensity> }\nif ("narrow" in density) {}',
      ),
      at(
        "auto-chart/auto-chart.tsx",
        "interface P { plotHeight?: Responsive<ChartPlotHeight> }\nconst n = plotHeight?.narrow;",
      ),
    ],
  },
};
