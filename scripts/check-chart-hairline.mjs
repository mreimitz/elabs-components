#!/usr/bin/env node
/**
 * check-chart-hairline.mjs — the chart-furniture hairline gate.
 *
 * WHAT IT DEFENDS
 * ---------------
 * Chart "furniture" is every rule the data sits on but that is not itself data:
 * grid rows and columns, axis rules, scatter drop lines, dumbbell tracks, tree
 * links, radar rings, network edges, a sparkline's empty baseline. All of it
 * paints ONE ink (`--chart-grid`) at ONE weight (`CHART_HAIRLINE_WIDTH`).
 *
 * THE INCIDENT
 * ------------
 * Before this gate, every mark picked its own weight (0.55 / 0.6 / 0.65 / 1 /
 * 1.4) and two of them additionally multiplied the shared ink by an opacity of
 * their own — network edges by 0.35, radar rings by 0.6. One token therefore
 * rendered at five weights and three inks. A line chart's gridlines read as
 * furniture while a network chart's edges measured 1.07:1 against a white card
 * — invisible. `--chart-grid` was `var(--border)`, a UI hairline tuned for a
 * 1px region boundary, which is not the same job as a sub-pixel stroke over a
 * plot ground; it now carries its own, darker rung.
 *
 * WHAT IT ASSERTS (three rules, no ratchet — the surface is small and clean)
 * -------------------------------------------------------------------------
 *   1. INK IS NEVER DIMMED. A JSX element whose `stroke` is the grid ink must
 *      not carry an `opacity` / `strokeOpacity` below 1. Furniture recedes by
 *      being a quiet TOKEN, never by being a fraction of a louder one — a
 *      multiplier puts the ink back under the visibility floor the token was
 *      just tuned to clear.
 *   2. WEIGHT IS THE SHARED CONSTANT. A numeric `strokeWidth` literal on such
 *      an element must equal `CHART_HAIRLINE_WIDTH`. An identifier or any other
 *      expression passes: a named constant is the sanctioned way to share the
 *      value, and a data-driven width (a network edge's weight) is the one
 *      legitimate reason a furniture stroke varies at all.
 *   3. THE TOKEN KEEPS ITS OWN RUNG. No theme may alias `--chart-grid` back to
 *      `var(--border)`. That alias IS the original bug, and it is a one-word
 *      edit to reintroduce.
 *
 * A single element may opt out with an in-span `// chart-hairline-exempt: <reason>`
 * comment. The reason is required, and the opt-out reaches exactly one element —
 * it exists for a stroke that paints the furniture ink without being a rule (the
 * choropleth no-data hatch is the only such case today).
 *
 * Rule 1's Tailwind-CLASS spelling (`opacity-[0.35]` on a `<path>`) is NOT
 * checked: a class sits on the element while the ink sits in an attribute, and
 * tying the two together reliably needs a real parser. That is a declared gap,
 * not an oversight — the attribute spellings are the ones the incident used
 * everywhere except `network-link.tsx`, whose resting rung is pinned by its own
 * unit test instead.
 *
 * Dependency-free; locates the workspace relative to this file (cwd-independent).
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CHARTS_SRC = join(REPO_ROOT, "packages", "charts", "src");
const HAIRLINE_MODULE = join(CHARTS_SRC, "chart-hairline.ts");

/** The spellings that mean "this stroke is chart furniture ink". */
const GRID_INK = [
  'stroke="var(--chart-grid)"',
  "stroke={chartCssVars.grid}",
  "stroke={radarCssVars.grid}",
  "stroke={gridLineColor}",
];

/** Read `CHART_HAIRLINE_WIDTH` from its source of truth rather than restating it. */
export function readHairlineWidth(modulePath = HAIRLINE_MODULE) {
  const src = readFileSync(modulePath, "utf8");
  const m = src.match(/export const CHART_HAIRLINE_WIDTH\s*=\s*([0-9.]+)\s*;/);
  if (!m) throw new Error(`CHART_HAIRLINE_WIDTH not found in ${modulePath}`);
  return Number(m[1]);
}

/** Every non-test, non-story `.ts`/`.tsx` under a directory. */
function sourceFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      sourceFiles(p, out);
      continue;
    }
    if (!/\.tsx?$/.test(name)) continue;
    if (/\.(test|stories|spec)\.tsx?$/.test(name)) continue;
    out.push(p);
  }
  return out;
}

/**
 * The attribute span of the JSX element that owns the ink at `inkIndex`.
 *
 * Walks back to the element's `<` and forward to the `>` that closes the OPENING
 * tag, tracking quotes and brace depth so a `strokeWidth={a > b ? 1 : 2}` does
 * not end the span early. Returns null if the element cannot be delimited —
 * an undelimitable element is reported rather than silently skipped, because a
 * gate whose unknown case is "pass" is defeated by making the code harder to read.
 */
export function elementSpan(src, inkIndex) {
  let start = -1;
  for (let i = inkIndex; i >= 0; i--) {
    if (src[i] === "<") {
      start = i;
      break;
    }
    // A `>` walking backwards normally means we left the element — except when
    // it is an arrow (`=>`) or a comparison (`>=`), both of which appear inside
    // attribute expressions (`angle={(d) => scale(d) ?? 0}`). Missing this read
    // every `<LineRadial>` in the radar charts as undelimitable.
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
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    else if (ch === ">" && depth === 0) return src.slice(start, i + 1);
  }
  return null;
}

const lineOf = (src, index) => src.slice(0, index).split("\n").length;

/** Rules 1 and 2, over one file's source. Exported for the self-test. */
export function auditSource(src, file, hairline) {
  const findings = [];
  for (const ink of GRID_INK) {
    let from = 0;
    for (;;) {
      const at = src.indexOf(ink, from);
      if (at === -1) break;
      from = at + ink.length;
      const line = lineOf(src, at);
      const span = elementSpan(src, at);
      if (span == null) {
        findings.push({ file, line, msg: `could not delimit the element owning ${ink}` });
        continue;
      }

      // A narrow, in-place opt-out for a stroke that paints the furniture ink
      // but is not a rule — the one real case is a hatch PATTERN standing in for
      // a fill on a no-data region. It must carry its reason, and it only
      // silences this element.
      // The reason must sit on the SAME line as the marker. Using `\s*` here
      // let a bare `chart-hairline-exempt:` borrow the next line's first
      // character as its "reason" and silence the element anyway.
      if (/\/\/[^\S\n]*chart-hairline-exempt:[^\S\n]*\S/.test(span)) continue;

      // Rule 1 — ink is never dimmed.
      const dim = span.match(/\b(?:stroke)?[Oo]pacity=\{\s*([0-9.]+)\s*\}/);
      if (dim && Number(dim[1]) < 1) {
        findings.push({
          file,
          line,
          msg: `chart furniture ink dimmed by ${dim[1]} — --chart-grid is already tuned for a sub-pixel stroke; a multiplier puts it back under the visibility floor. Drop the opacity, or use a different token.`,
        });
      }

      // Rule 2 — weight is the shared constant.
      const w = span.match(/\bstrokeWidth=\{\s*([0-9.]+)\s*\}/);
      if (w && Number(w[1]) !== hairline) {
        findings.push({
          file,
          line,
          msg: `chart furniture drawn at strokeWidth ${w[1]}, not the shared CHART_HAIRLINE_WIDTH (${hairline}). Import it from packages/charts/src/chart-hairline.ts.`,
        });
      }
    }
  }
  return findings;
}

/** Rule 3 — the token keeps its own rung in every theme. */
export function auditThemes(root = REPO_ROOT) {
  const findings = [];
  const dir = join(root, "packages", "tokens", "src");
  const files = [join(dir, "themes.css")];
  const themes = join(dir, "themes");
  if (existsSync(themes)) {
    for (const n of readdirSync(themes)) if (n.endsWith(".css")) files.push(join(themes, n));
  }
  for (const f of files) {
    if (!existsSync(f)) continue;
    const src = readFileSync(f, "utf8");
    const m = src.match(/--chart-grid:\s*var\(--border\)/);
    if (m) {
      findings.push({
        file: f,
        line: lineOf(src, m.index),
        msg: "--chart-grid is aliased back to var(--border). That alias IS the original bug: a UI hairline is tuned for a 1px region boundary, chart furniture is drawn sub-pixel over a plot ground. Give it its own literal.",
      });
    }
  }
  return findings;
}

function main() {
  const hairline = readHairlineWidth();
  const findings = [];
  for (const file of sourceFiles(CHARTS_SRC)) {
    findings.push(...auditSource(readFileSync(file, "utf8"), file, hairline));
  }
  findings.push(...auditThemes());

  if (findings.length > 0) {
    console.error("✖ chart-hairline: chart furniture must be ONE ink at ONE weight.\n");
    for (const f of findings) {
      console.error(`  ${relative(REPO_ROOT, f.file)}:${f.line}\n    ${f.msg}`);
    }
    console.error("\n  See .claude/rules/chart-components.md § Hairline furniture.");
    process.exit(1);
  }
  console.log(
    `✔ chart-hairline: every --chart-grid stroke draws at full opacity and CHART_HAIRLINE_WIDTH (${hairline}), and no theme aliases the token back to --border.`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) main();
