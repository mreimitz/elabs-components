#!/usr/bin/env node
/**
 * check-charts-honesty.mjs — @elabs-ai/components-charts "honesty" gate (RM-039, #265).
 *
 * lieflat-charts enforces four rules through its prompt and its own validator:
 * bars never break the axis, area/radius encodings scale by `sqrt(v)` (not
 * `v` itself), demo data is deterministic (`Math.random` banned — reach for
 * `seededRnd`), and every unit-decomposed chart states its unit ("one X = N")
 * somewhere a reader can see it. This repo's stance is "a rule that matters is
 * a script, not a sentence" (`.claude/rules/quality-gates.md`, "Enforcement
 * over reminders") — this is that script.
 *
 * Provenance: `docs/review/2026-09-04-lieflat-charts-gap-analysis.md` §5 C5;
 * lieflat `SKILL.md` §2 "数据", §7, §8.
 *
 * ## Scope — a DECLARED limit, not an implicit one (orchestrator send-back, #265)
 *
 * `SCAN_DIRS` is `packages/charts/src/charts/**` and `packages/charts/src/marks/**`
 * only — narrower than the item's literal spec ("`Math.random` banned in
 * `packages/charts/src/**`"). Sibling directories (`gantt/`, `metric-card/`,
 * `metric-grid/`, `sparkline/`, `chart-card/`, `chart-frame/`, `auto-chart/`)
 * are NOT SCANNED AT ALL, by any of the four rules — this is a real, stated
 * gap, not a claim that those directories are clean.
 *
 * For rules 1, 2 and 4 the narrowing is a reasoned exclusion: those rules
 * police a VALUE ENCODING (a length/area/radius/unit scale), and `gantt/`,
 * `metric-card/` etc. own no such encoding — a Gantt bar draws a DATE RANGE
 * and a 0–100 progress fraction against a fixed timeline, never a length
 * pulled from an arbitrary y-domain, and has no area/radius mark at all; a
 * MetricCard has no scale. `charts/` + `marks/` is also where this item's own
 * roadmap entry (RM-039) placed its two new files (`charts/y-domain-utils.ts`,
 * `marks/area-radius.ts`).
 *
 * For rule 3 (no `Math.random`) that reasoning does NOT apply — the item's
 * spec bans it package-wide, with no encoding caveat, and a Gantt story can
 * be exactly as non-reproducible as a bar-chart story. The scope narrowing
 * hid a REAL, in-spec violation:
 * `packages/charts/src/gantt/gantt.stories.tsx:250` calls `Math.random()` in
 * a story's fixture data. This was found during RM-039 development, reported
 * to the orchestrator instead of fixed here (`gantt.stories.tsx` is outside
 * this item's `touches`), and is being routed to `/file-issue` by the
 * orchestrator. Widening `SCAN_DIRS` to fix it here was considered and
 * declined: it would mean editing `gantt.stories.tsx` (an inline
 * `honesty:allow`) or the file outside this item's write-set either way, and
 * a ratchet baseline for rule 3 is explicitly NOT authorized for this item
 * (RM-039's orchestrator amendments permit a ratchet baseline for rule 4's
 * story captions only). So the chosen resolution is the third option the
 * orchestrator offered: keep the narrower scope and STATE the limit here and
 * in `docs/GATES.md`, rather than widen the scan and immediately need an
 * exception this item isn't allowed to make. **Whoever fixes the Gantt
 * finding should also decide there whether to widen `SCAN_DIRS` to
 * `packages/charts/src` for rule 3** (dropping this whole paragraph) or add
 * the `honesty:allow` once the fix lands.
 *
 * ## Escape hatch
 *
 * A line that is a deliberate, reasoned exception carries an inline
 * `// honesty:allow <reason>` comment (on the same line, or the line
 * immediately above it) — the gate skips exactly that occurrence.
 *
 * Flags:
 *   --warn      never exit non-zero (dev-hook mode); still prints findings.
 *   --update    (rule 4 only) rewrite the story-caption baseline from the
 *               current tree — ratchets DOWN only; use --force to raise it.
 *   --force     with --update, allow the baseline to GROW (use in the same
 *               change that adds a new, deliberately uncaptioned story).
 *
 * Dependency-free; ESM; cwd-independent (locates packages/charts/src relative
 * to this file). Pure helpers are exported for the self-test
 * (check-charts-honesty.test.mjs / `pnpm charts:honesty:check:test`).
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);
const CHARTS_ROOT = join(REPO_ROOT, "packages", "charts", "src");
const SCAN_DIRS = [join(CHARTS_ROOT, "charts"), join(CHARTS_ROOT, "marks")];
const BASELINE_PATH = join(SCRIPT_DIR, "charts-honesty-caption-baseline.json");

// ─────────────────────────────────────────── file discovery ──────────────────

/** Recursively collect `.ts`/`.tsx` files under `dir`, skipping dist/node_modules. */
function listAllFiles(dir, acc = []) {
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === "dist") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      listAllFiles(p, acc);
    } else if (/\.(ts|tsx)$/.test(e.name)) {
      acc.push(p);
    }
  }
  return acc;
}

function listScanFiles() {
  const acc = [];
  for (const dir of SCAN_DIRS) {
    if (existsSync(dir)) listAllFiles(dir, acc);
  }
  return acc;
}

const isTestFile = (f) => /\.test\.(ts|tsx)$/.test(f);
const isStoryFile = (f) => /\.stories\.tsx$/.test(f);

function toRel(file) {
  return file.startsWith(REPO_ROOT) ? relative(REPO_ROOT, file) : file;
}

/** Line number (1-based) of a match index within `src`. */
function lineNoAt(src, index) {
  return src.slice(0, index).split("\n").length;
}

function lineText(src, lineNo) {
  return src.split("\n")[lineNo - 1] ?? "";
}

/** Is there a `// honesty:allow …` on this line or the one before it? */
function hasHonestyAllow(src, lineNo) {
  const here = lineText(src, lineNo);
  const above = lineText(src, lineNo - 1);
  return /honesty:allow/.test(here) || /honesty:allow/.test(above);
}

/**
 * Blank out comment CONTENT (block and line) while preserving every newline
 * and every non-comment character's position — so a regex run against the
 * result reports the exact same line numbers as the original, but never
 * matches a docblock's example/explanation prose (e.g. `seeded-rnd.ts`'s own
 * docblock explains, in English, why `Math.random()` is banned — matching
 * that sentence as a violation would be exactly backwards). Same technique as
 * `check-charts-reuse.mjs`'s `stripComments`, adapted to be line-preserving
 * since this gate reports line numbers.
 */
export function stripCommentsPreservingLines(src) {
  let out = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  out = out.replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(m.length - p1.length));
  return out;
}

// ═══════════════════════════════ Rule 1 — zero-based bars ═══════════════════
//
// "Bars never break the axis" (lieflat honesty rule #1): a LENGTH encoding
// must be drawn from a domain that includes 0, never a domain that starts
// somewhere else to exaggerate a difference.
//
// A file is a "bar-family domain owner" when BOTH hold: (a) its name marks it
// as a bar/waterfall/histogram container — the length-encoding families this
// package ships — and (b) it computes its own `scaleLinear(...)` domain (i.e.
// it OWNS a value axis, rather than consuming a scale a parent already built,
// the way `bar.tsx`'s `<rect>` renderer consumes `BarChart`'s context scale).
// A file that renders bar-shaped marks but never calls `scaleLinear` itself
// (`unit-chart.tsx` — no scale at all, marks are counted, not measured;
// `distribution/kinds/histogram.tsx` — count is a DIRECT proportion of
// `count / countMax`, never a `scaleLinear` domain) is inherently zero-based
// by construction and is correctly not flagged.
const BAR_FAMILY_FILE_RE = /[/\\](bar-chart|waterfall-chart|histogram)\.tsx?$/i;

/**
 * A CALL SITE that is known to force the domain to include zero — scoped to
 * the statement that actually feeds a `domain`, never a bare mention of the
 * helper's name. `bar-chart.tsx` both CALLS `resolveBarValueDomain` (as
 * `domain: resolveBarValueDomain(...)` and `return resolveBarValueDomain(...)`
 * inside a `resolveDomain` callback) AND, being the one file that owns the
 * helper, DEFINES it (`function resolveBarValueDomain(...)`). An unscoped
 * `/resolveBarValueDomain\s*\(/` matches the definition too, which makes the
 * marker permanently present in the one file rule 1 exists to police —
 * unfalsifiable exactly where it matters (found by orchestrator mutation
 * probe: replacing both call sites' domains with `[min, max]` left the gate
 * at exit 0). Requiring the call to be immediately preceded by `domain:` or
 * `return` matches every real call site and never the `function` keyword.
 */
const ZERO_FORCING_MARKERS = [
  /\b(?:domain\s*:\s*|return\s+)resolveBarValueDomain\s*\(/,
  /\b(?:domain\s*:\s*|return\s+)resolveYDomain\s*\([\s\S]{0,200}?includeZero\s*:\s*true/,
];

export function findZeroBasedBarViolations(file, src) {
  if (!BAR_FAMILY_FILE_RE.test(file)) return [];
  const code = stripCommentsPreservingLines(src);
  if (!/\bscaleLinear\s*\(/.test(code)) return []; // not a domain owner
  if (ZERO_FORCING_MARKERS.some((re) => re.test(code))) return [];

  const m = /\bscaleLinear\s*\(/.exec(code);
  const lineNo = m ? lineNoAt(code, m.index) : 1;
  if (hasHonestyAllow(src, lineNo)) return [];

  return [
    {
      rule: "zero-based-bars",
      file,
      line: lineNo,
      message:
        `computes its own scaleLinear value-domain but never calls resolveBarValueDomain(...) ` +
        `or resolveYDomain(..., { includeZero: true }) — a bar/waterfall/histogram length must ` +
        `be drawn from a domain that includes 0 (lieflat honesty rule #1, "bars never break the ` +
        `axis"; see docs/review/2026-09-04-lieflat-charts-gap-analysis.md §5 C5).`,
    },
  ];
}

// ═══════════════════════════════ Rule 2 — area/radius sqrt ══════════════════
//
// An area encoding must scale its RADIUS by sqrt(value / max), never
// linearly — see packages/charts/src/marks/area-radius.ts for the full
// reasoning. The anti-pattern this looks for: a `radius`/`r`-named variable
// assigned a ratio of a value to a max WITHOUT `sqrt` anywhere in that
// statement.
const RADIUS_ASSIGNMENT_RE = /\b(?:const|let)\s+(\w*[Rr]adius\w*|r)\s*=\s*([^;\n]+);?/g;
const RATIO_OF_MAX_RE = /\/\s*\w*(?:[Mm]ax|MAX)\w*/;
const CONTAINS_SQRT_RE = /\bsqrt\s*\(/i;

export function findAreaRadiusViolations(file, src) {
  const violations = [];
  const code = stripCommentsPreservingLines(src);
  RADIUS_ASSIGNMENT_RE.lastIndex = 0;
  let m;
  while ((m = RADIUS_ASSIGNMENT_RE.exec(code))) {
    const rhs = m[2];
    if (!RATIO_OF_MAX_RE.test(rhs)) continue; // not a "ratio of a max" shape
    if (CONTAINS_SQRT_RE.test(rhs)) continue; // already honest
    const lineNo = lineNoAt(code, m.index);
    if (hasHonestyAllow(src, lineNo)) continue;
    violations.push({
      rule: "area-radius-sqrt",
      file,
      line: lineNo,
      message:
        `"${m[0].trim()}" scales a radius linearly by a ratio of a max value. Area encodings must ` +
        `scale by sqrt(value / max) (packages/charts/src/marks/area-radius.ts's areaRadius helper) — ` +
        `a linear radius quadruples the drawn AREA when a value only doubles (lieflat honesty rule ` +
        `#2; see docs/review/2026-09-04-lieflat-charts-gap-analysis.md §5 C5).`,
    });
  }
  return violations;
}

// ═══════════════════════════════ Rule 3 — no Math.random ════════════════════
//
// Demo data and every drawn jitter must be deterministic — reach for
// `seededRnd` (packages/charts/src/marks/seeded-rnd.ts). Scope note: `.test.*`
// files are EXCLUDED — a test using `Math.random()` to build a unique cache
// key or fixture label (e.g. `distribution/bins.test.ts`) is not rendered
// chart output and carries none of the reproducibility risk (flaky snapshot /
// visual-regression / play-function assertions) this rule protects against;
// gating it would be enforcing the letter of the rule against its purpose.
// `.stories.tsx` files ARE in scope — a story renders real chart output and is
// exactly the "demo data" lieflat's rule means.
const MATH_RANDOM_RE = /Math\.random\s*\(/g;

export function findMathRandomViolations(file, src) {
  if (isTestFile(file)) return [];
  const violations = [];
  const code = stripCommentsPreservingLines(src);
  MATH_RANDOM_RE.lastIndex = 0;
  let m;
  while ((m = MATH_RANDOM_RE.exec(code))) {
    const lineNo = lineNoAt(code, m.index);
    if (hasHonestyAllow(src, lineNo)) continue;
    violations.push({
      rule: "no-math-random",
      file,
      line: lineNo,
      message:
        `Math.random() is banned in @elabs-ai/components-charts — reach for seededRnd(i, k) ` +
        `(packages/charts/src/marks/seeded-rnd.ts) so drawn output is reproducible across renders, ` +
        `tests and visual-regression snapshots (lieflat honesty rule #3; see ` +
        `docs/review/2026-09-04-lieflat-charts-gap-analysis.md §5 C5).`,
    });
  }
  return violations;
}

// ═══════════════════════════════ Rule 4 — unit captions ═════════════════════
//
// Every unit-decomposed chart states its unit ("one X = N" / "1 X = N")
// somewhere a reader can see it. Checked against the ONLY prop that currently
// renders a visible caption for this family, `UnitChart`'s `unitLabel`, and —
// for the four containers that have no visible caption prop yet
// (BarChart/WaterfallChart/HeatmapChart/DumbbellChart only expose
// `accessibleDescription`, which is AT-only, not a subtitle) —
// `accessibleDescription`, so the gate accepts the one real mechanism each
// container actually has rather than inventing a prop that doesn't exist.
// Adding a genuine VISIBLE caption prop to those four containers is a
// container-level change, out of this item's `touches`.
//
// `layout="rows"` UnitChart stories are structurally exempt: `unitLabel` is
// documented as "Ignored by rows" (unit-chart.tsx) — the rows layout is a
// tally of independent series (each may sum past 100), not a "one mark = one
// unit of a whole" proportion, so there is no unit ratio to caption.
// Requires literal " = " (spaces both sides) so a JSX attribute equals
// (`unit={2000}`, no surrounding spaces) or an unrelated `x="1) ..."` string
// can never masquerade as the prose pattern "one dot = one visit in a hundred".
const UNIT_PHRASE_RE = /\b(?:one|1)\b[^=\n]{0,40}\s=\s[^=\n]{0,60}/i;

// Only the VALUE of a caption-carrying prop is searched for the unit phrase —
// never the whole story block's text — so nothing in the surrounding JSX/JS
// punctuation (an "=" from an attribute, a "1" from `--chart-1`) can produce a
// false match. See `check-charts-honesty.test.mjs`'s
// "does not false-positive on JSX attribute punctuation" case: an earlier
// whole-block-text version of this rule matched `fill="var(--chart-1)"
// lineCap="round" unit={2000}` as a caption before this was scoped down.
const CAPTION_PROP_RE =
  /\b(?:unitLabel|description|accessibleDescription)\s*[:=]\s*\{?\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;

/** Does this unit-mode story block state its unit in a caption-carrying prop? */
function hasUnitCaption(block) {
  CAPTION_PROP_RE.lastIndex = 0;
  let m;
  while ((m = CAPTION_PROP_RE.exec(block.text))) {
    if (UNIT_PHRASE_RE.test(m[2])) return true;
  }
  return false;
}

/**
 * Find the index just AFTER the `}` matching the `{` at `openIndex`, walking
 * past string/template literals and comments so a brace inside a string
 * (`"{"`) or a comment never miscounts. Good enough for well-formed
 * TypeScript/TSX story source; not a general JS parser.
 */
function findMatchingBrace(src, openIndex) {
  let depth = 0;
  let i = openIndex;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    if (ch === "{") {
      depth++;
      i++;
    } else if (ch === "}") {
      depth--;
      i++;
      if (depth === 0) return i;
    } else if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      while (i < n && src[i] !== quote) {
        i += src[i] === "\\" ? 2 : 1;
      }
      i++;
    } else if (ch === "`") {
      i++;
      while (i < n && src[i] !== "`") {
        if (src[i] === "\\") {
          i += 2;
        } else if (src[i] === "$" && src[i + 1] === "{") {
          i += 2;
          let tDepth = 1;
          while (i < n && tDepth > 0) {
            if (src[i] === "{") tDepth++;
            else if (src[i] === "}") tDepth--;
            i++;
          }
        } else {
          i++;
        }
      }
      i++;
    } else if (ch === "/" && src[i + 1] === "/") {
      while (i < n && src[i] !== "\n") i++;
    } else if (ch === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
    } else {
      i++;
    }
  }
  return n;
}

/**
 * Split a `*.stories.tsx` file into named story blocks — `export const Name:
 * Story = { … }`, sliced to the OBJECT LITERAL'S own matching closing brace
 * (not "up to the next `export const`", which used to bleed trailing
 * module-scope code — a fixture array, a later JSDoc comment — into the
 * previous story and could produce a false-positive caption match).
 */
function splitStoryBlocks(src) {
  const blocks = [];
  const re = /export const (\w+)\s*:\s*Story\s*=\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    const start = m.index;
    const braceOpen = m.index + m[0].length - 1;
    const end = findMatchingBrace(src, braceOpen);
    blocks.push({ name: m[1], text: src.slice(start, end) });
  }
  return blocks;
}

/** Whether this story block plots a unit-mode chart this rule cares about. */
function isUnitModeStory(file, block) {
  if (/unit-chart\.stories\.tsx$/.test(file)) {
    const hasWaffleOrField = /layout\s*[=:]\s*"(?:waffle|field)"/.test(block.text);
    const rowsOnly = /layout\s*[=:]\s*"rows"/.test(block.text) && !hasWaffleOrField;
    return hasWaffleOrField && !rowsOnly ? true : hasWaffleOrField;
  }
  if (/heatmap-chart\.stories\.tsx$/.test(file)) {
    return /mode\s*:\s*"dot"/.test(block.text) || /^DotHeat/.test(block.name);
  }
  if (/[/\\]bar-chart\.stories\.tsx$/.test(file)) {
    return /<Bar\b[^>]*\bunit=\{/.test(block.text);
  }
  if (/waterfall-chart\.stories\.tsx$/.test(file)) {
    return /<WaterfallChart\b[^>]*\bunit=\{/.test(block.text) || /\bunit\s*:\s*\d/.test(block.text);
  }
  if (/dumbbell-chart\.stories\.tsx$/.test(file)) {
    return /\bbeads\s*:\s*\{/.test(block.text);
  }
  return false;
}

/**
 * Every unit-mode story key (`<relFile>#<StoryName>`) that fails to state its
 * unit, given the current tree.
 */
export function findUnitCaptionFailures(storyFiles, readFile = (f) => readFileSync(f, "utf8")) {
  const failing = [];
  for (const file of storyFiles) {
    let src;
    try {
      src = readFile(file);
    } catch {
      continue;
    }
    for (const block of splitStoryBlocks(src)) {
      if (!isUnitModeStory(file, block)) continue;
      if (hasUnitCaption(block)) continue;
      failing.push(`${toRel(file)}#${block.name}`);
    }
  }
  return failing.sort();
}

/** Baseline keys not present in the current failing set are ratcheted down (fine, no action needed). */
export function compareUnitCaptionBaseline(currentFailingKeys, baselineKeys) {
  const baseline = new Set(baselineKeys);
  return currentFailingKeys.filter((k) => !baseline.has(k));
}

/**
 * The `--update` write, factored out as a pure function so the "only shrinks"
 * guarantee is unit-testable directly (not just exercised end-to-end via the
 * CLI). Mirrors `scripts/check-text-scale.mjs`'s `--update`/`--force` shape.
 *
 * - Without `force`: a key in `current` that is NOT already in `baseline` is a
 *   genuinely NEW failure — `--update` must not silently swallow it into the
 *   baseline (that would defeat the whole ratchet), so it is returned as
 *   `rejected` and the baseline is left unchanged (well, computed as if those
 *   new keys were never offered — i.e. old baseline keys that are still
 *   failing are KEPT, one that's fixed is dropped: the "only shrinks" case).
 * - With `force`: the new baseline is exactly `current` — growing OR
 *   shrinking is allowed, for the one deliberate case (the same PR that adds
 *   the new, knowingly-uncaptioned story).
 */
export function computeUpdatedBaseline(currentFailingKeys, baselineKeys, { force = false } = {}) {
  const oldSet = new Set(baselineKeys);
  const newlyIntroduced = currentFailingKeys.filter((k) => !oldSet.has(k));
  if (force) {
    return { baseline: [...currentFailingKeys].sort(), rejected: [] };
  }
  const currentSet = new Set(currentFailingKeys);
  const baseline = baselineKeys.filter((k) => currentSet.has(k)).sort();
  return { baseline, rejected: newlyIntroduced.sort() };
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return [];
  try {
    const data = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
    return Array.isArray(data.knownFailing) ? data.knownFailing : [];
  } catch {
    return [];
  }
}

function writeBaseline(keys) {
  writeFileSync(
    BASELINE_PATH,
    `${JSON.stringify(
      {
        $schema:
          "Ratchet baseline for charts:honesty:check rule 4 (unit captions) — RM-039, #265. " +
          "Only shrinks: a key here is a pre-existing story that does not yet state its unit " +
          "visibly. Never add a NEW key by hand for a NEW story — write the caption instead. " +
          "Regenerate with `node scripts/check-charts-honesty.mjs --update` after fixing one.",
        knownFailing: keys,
      },
      null,
      2,
    )}\n`,
  );
}

// ═══════════════════════════════════ CLI ═════════════════════════════════════

function main(argv) {
  const args = argv.slice(2);
  const warnOnly = args.includes("--warn");
  const update = args.includes("--update");
  const force = args.includes("--force");

  const files = listScanFiles();
  const sourceFiles = files.filter((f) => !isTestFile(f) && !isStoryFile(f));
  const storyFiles = files.filter(isStoryFile);

  const findings = [];
  for (const file of sourceFiles) {
    let src;
    try {
      src = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    findings.push(...findZeroBasedBarViolations(file, src));
    findings.push(...findAreaRadiusViolations(file, src));
    findings.push(...findMathRandomViolations(file, src));
  }
  // Rule 3 also runs over story files (demo data is in scope; see rule-3 note above).
  for (const file of storyFiles) {
    let src;
    try {
      src = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    findings.push(...findMathRandomViolations(file, src));
  }

  const currentFailingCaptions = findUnitCaptionFailures(storyFiles);

  if (update) {
    const { baseline, rejected } = computeUpdatedBaseline(currentFailingCaptions, loadBaseline(), {
      force,
    });
    if (rejected.length) {
      console.error(
        `✖ charts-honesty --update: ${rejected.length} NEW failing caption(s) are not already ` +
          `in the baseline — write the caption instead, or rerun with --force if this is a ` +
          `deliberate new exception:\n${rejected.map((k) => `  - ${k}`).join("\n")}`,
      );
      process.exit(1);
    }
    writeBaseline(baseline);
    console.log(
      `✔ charts-honesty: rewrote ${relative(REPO_ROOT, BASELINE_PATH)} with ${baseline.length} known-failing caption(s).`,
    );
    return;
  }

  const baselineKeys = loadBaseline();
  const newCaptionFailures = compareUnitCaptionBaseline(currentFailingCaptions, baselineKeys);
  for (const key of newCaptionFailures) {
    findings.push({
      rule: "unit-caption",
      file: key.split("#")[0],
      line: null,
      message:
        `story "${key.split("#")[1]}" plots a unit-decomposed chart but states no visible unit ` +
        `("one X = N" / "1 X = N") in its description/unitLabel/accessibleDescription — every ` +
        `unit chart must state its unit where a reader can see it (lieflat honesty rule #4; see ` +
        `docs/review/2026-09-04-lieflat-charts-gap-analysis.md §5 C5). If this is a pre-existing ` +
        `gap rather than new work, rerun with --update to add it to the ratchet baseline instead ` +
        `of silently passing.`,
    });
  }

  if (findings.length) {
    const label = warnOnly ? "⚠ charts-honesty" : "✖ charts-honesty gate FAILED";
    console.error(`\n${label} (${findings.length}):`);
    for (const f of findings) {
      const rel = toRel(f.file);
      const where = f.line ? `${rel}:${f.line}` : rel;
      console.error(`  - [${f.rule}] ${where}\n      ${f.message}`);
    }
    console.error(
      `\nSee .claude/rules/quality-gates.md ("Enforcement over reminders") and ` +
        `docs/review/2026-09-04-lieflat-charts-gap-analysis.md §5 C5. A deliberate, reasoned ` +
        `exception carries an inline "// honesty:allow <reason>" comment on the flagged line (or ` +
        `the line above it).`,
    );
    if (!warnOnly) process.exit(1);
    return;
  }

  if (!warnOnly) {
    console.log(
      `✔ charts-honesty: zero-based bars, sqrt area radii, no Math.random, unit captions — ` +
        `${sourceFiles.length + storyFiles.length} file(s) scanned, ` +
        `${baselineKeys.length} pre-existing caption gap(s) tracked in baseline.`,
    );
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main(process.argv);
}
