/**
 * chart-style-constants — dash, opacity and duration literals in chart source go through the
 * shared constants (ADR 0042 §11, RM-188).
 *
 * The same "threshold" dash was written as a literal by seven painters and the same "dimmed"
 * opacity by a dozen families, each free to drift. The shared homes are:
 *   - `packages/charts/src/charts/chart-stroke.ts` — `CHART_DASH`, the one dash map;
 *   - `packages/charts/src/charts/chart-opacity.ts` — the dim / emphasis opacities;
 *   - `packages/charts/src/charts/animation.ts` — the chart motion durations.
 * Everything else under `packages/charts/src/**` (tests, stories, type tests and fixtures
 * excepted) is counted. The count is a BASELINE THAT ONLY SHRINKS: move a literal into a shared
 * constant (or reuse one) and ratchet down with `pnpm check --rule chart-style-constants
 * --update-baseline`; a new literal fails.
 *
 * Counted, one finding per literal (read per line, comments stripped):
 *   - dash: a string of two or more numbers (`"4 3"`, `"6,4"`, `"10 3 2 3"`) on a line that
 *     names a dash (`strokeDasharray`, `dash`, `*_DASH*`);
 *   - opacity: a numeric literal assigned to an opacity (`opacity={0.4}`, `fillOpacity: 0.2`,
 *     `const DIM_OPACITY = 0.35`, `opacity: isHovered ? 1 : 0.7` counts the 0.7 — `1` and `0`
 *     are "fully on / off", not a tuned value, and are never counted);
 *   - duration: a numeric literal assigned to a duration (`duration: 0.4`, `duration={200}`,
 *     `const FADE_DURATION_MS = 150`, `transitionDuration: 120`).
 * Declared gaps: Tailwind class spellings (`opacity-40`, `duration-150`) and CSS strings
 * (`"opacity 150ms"`) are not read — the motion-tokens rule owns CSS time.
 */

const ROOT = "packages/charts/src/**/*.{ts,tsx}";
const IGNORE = [
  "**/*.{test,stories,spec}.{ts,tsx}",
  "**/*.test-d.ts",
  "**/__fixtures__/**",
  "**/__baselines__/**",
  "**/{node_modules,dist}/**",
];

/** The shared homes: literals here ARE the constants. */
export const SHARED_CONSTANT_MODULES = [
  "packages/charts/src/charts/chart-stroke.ts",
  "packages/charts/src/charts/chart-opacity.ts",
  "packages/charts/src/charts/animation.ts",
];

const DASH_LINE = /strokeDasharray|\bdash\b|dashArray|_DASH|Dash[A-Z]?\w*\s*[=:]/;
const DASH_LITERAL = /(["'`])(\d+(?:\.\d+)?(?:[ ,]+\d+(?:\.\d+)?)+)\1/g;
// `opacity`, `fillOpacity`, `strokeOpacity`, `DIM_OPACITY`, `…_OPACITY_…`
const OPACITY_ASSIGN = /(?:[oO]pacity\w*|[A-Z_]*OPACITY[A-Z_]*)\s*(?:=\s*\{?|:)\s*([^,;}\n]+)/g;
const DURATION_ASSIGN = /(?:[dD]uration\w*|[A-Z_]*DURATION[A-Z_]*)\s*(?:=\s*\{?|:)\s*([^,;}\n]+)/g;
const NUMBER = /(?<![\w.$-])(\d*\.\d+|\d+)(?![\w.%])/g;

/** Strip `//` line comments and the body of block comments (per line; good enough for a count). */
function codeLines(src) {
  const out = [];
  let inBlock = false;
  for (const raw of src.split("\n")) {
    let line = raw;
    if (inBlock) {
      const end = line.indexOf("*/");
      if (end === -1) {
        out.push("");
        continue;
      }
      line = line.slice(end + 2);
      inBlock = false;
    }
    line = line.replace(/\/\*.*?\*\//g, "");
    const open = line.indexOf("/*");
    if (open !== -1) {
      line = line.slice(0, open);
      inBlock = true;
    }
    line = line.replace(/(^|[^:"'`])\/\/.*$/, "$1");
    out.push(line);
  }
  return out;
}

/** One file's findings. Exported for the fixtures and for a quick local audit. */
export function styleLiteralFindings(src, file) {
  const findings = [];
  codeLines(src).forEach((line, i) => {
    const at = i + 1;
    if (DASH_LINE.test(line)) {
      for (const m of line.matchAll(DASH_LITERAL))
        findings.push({
          file,
          line: at,
          msg: `dash literal "${m[2]}" — name it in CHART_DASH (chart-stroke.ts)`,
        });
    }
    for (const [kind, re] of [
      ["opacity", OPACITY_ASSIGN],
      ["duration", DURATION_ASSIGN],
    ]) {
      for (const m of line.matchAll(re)) {
        for (const n of m[1].matchAll(NUMBER)) {
          if (kind === "opacity" && (n[1] === "1" || n[1] === "0")) continue;
          if (kind === "duration" && n[1] === "0") continue;
          findings.push({
            file,
            line: at,
            msg: `${kind} literal ${n[1]} — use a shared constant (${
              kind === "opacity" ? "chart-opacity.ts" : "animation.ts"
            })`,
          });
        }
      }
    }
  });
  return findings;
}

const CHART = "packages/charts/src/charts/demo-chart.tsx";

export default {
  id: "chart-style-constants",
  scope: "components",
  doc: "Name chart dash, opacity and duration values through the shared constants (`CHART_DASH` in `chart-stroke.ts`, `chart-opacity.ts`, `animation.ts`) instead of literals; the count of literals left in `packages/charts/src` only goes down.",
  baseline: "count",
  run(ctx) {
    const findings = [];
    for (const file of ctx.glob(ROOT, { ignore: IGNORE })) {
      if (SHARED_CONSTANT_MODULES.includes(file)) continue;
      findings.push(...styleLiteralFindings(ctx.readFile(file), file));
    }
    return findings;
  },
  fixtures: {
    pass: [
      {
        files: {
          [CHART]:
            'import { CHART_DASH } from "./chart-stroke";\nimport { LEGEND_DIM_OPACITY } from "./chart-opacity";\nexport const R = () => <line opacity={LEGEND_DIM_OPACITY} strokeDasharray={CHART_DASH.dashed} />;',
        },
      }, // shared constants only
      {
        files: {
          "packages/charts/src/charts/chart-stroke.ts":
            'export const CHART_DASH = { dashed: "4 3" };',
          "packages/charts/src/charts/chart-opacity.ts": "export const LEGEND_DIM_OPACITY = 0.35;",
          "packages/charts/src/charts/animation.ts": "export const DEFAULT_CHART_ENTER_MS = 900;",
        },
      }, // literals inside the shared homes are the constants themselves
      {
        files: {
          [CHART]:
            '// strokeDasharray="4 3" once lived here\n/* opacity: 0.35 */\nexport const R = () => <g opacity={1} style={{ opacity: 0 }} />;',
        },
      }, // comments are not code; fully on / off is not a tuned value
      {
        files: {
          "packages/charts/src/charts/demo-chart.stories.tsx":
            'export const S = () => <line strokeDasharray="4 3" opacity={0.4} />;',
          "packages/charts/src/charts/demo-chart.test.tsx":
            "expect(el).toHaveAttribute('opacity', '0.4'); const duration = 200;",
        },
      }, // stories and tests are not shipped source
    ],
    fail: [
      { files: { [CHART]: 'export const R = () => <line strokeDasharray="4 3" />;' } }, // JSX dash
      { files: { [CHART]: 'const TREND_DASH = "5 4";\nexport { TREND_DASH };' } }, // a private dash constant
      { files: { [CHART]: "export const R = () => <rect fillOpacity={0.22} />;" } }, // JSX opacity
      { files: { [CHART]: "const HOVER_DIM_OPACITY = 0.15;\nexport { HOVER_DIM_OPACITY };" } }, // a private dim constant
      {
        files: {
          [CHART]:
            "export const t = { animate: { opacity: isHovered ? 1 : 0.7 }, transition: { duration: 0.15 } };",
        },
      }, // a ternary's tuned branch, and a motion duration
      {
        files: {
          "packages/charts/src/gantt/demo.tsx":
            "const ZOOM_DURATION_MS = 180;\nexport { ZOOM_DURATION_MS };",
        },
      }, // any folder under charts/src
    ],
  },
};
