#!/usr/bin/env node
/**
 * check-status-rung.mjs — status FILL-rung-as-text ratchet (#124).
 *
 * `.claude/rules/styling-and-tokens.md` § "Which status rung a graphical MARK
 * reaches for" defines three rungs per tone (`destructive`/`success`/`warning`/
 * `info`): the bare FILL rung (`text-<tone>`, guaranteed only >=3:1 — a MARK:
 * icon, dot, stroke), the INK rung (`text-<tone>-text`, >=4.5:1 — coloured
 * running TEXT), and `-foreground` (ink on a solid plate). #124 found 18
 * shipped call sites painting running text with the 3:1-guaranteed FILL rung,
 * which is a WCAG 1.4.3 failure on `dark` (measured: `text-destructive` on
 * `dark --card` = 4.253:1, below the 4.5:1 bar) even though several of those
 * sites happened to clear AA on `light`'s different token values.
 *
 * ## Detectable slice (honest scope — read this before trusting a green run)
 *
 * Within ONE class-string literal: a bare `text-<tone>` token (no `-text`/
 * `-foreground` suffix, not scoped to a descendant via `[&>svg]:`/`[&_svg]:`)
 * co-occurring with a TEXT TELL (`text-xs`/a type role — `text-meta` etc. —
 * /a `font-*` weight utility/`truncate`) is a VIOLATION. Co-occurring instead
 * with a MARK TELL (`size-*`, `fill-*`, or an `[&>svg]:`/`[&_svg]:` selector
 * anywhere in the string) is judged a mark and left SILENT. Neither tell
 * present → SILENT (ambiguous — see below).
 *
 * ## Measured precision & completeness (analyst's prototype, #124 issue)
 *
 * Run against the pre-fix #124 corpus (29 bare-rung literals: 18 real TEXT
 * violations, 7 legitimate MARKS, 4 comment mentions): **7 flagged, 7/7
 * genuine (100% precision, zero false positives)**; 5 of the 7 real marks
 * correctly judged silent; **17 silent** (11 of those were real, uncaught
 * TEXT violations — ~39% completeness on the true violation count).
 *
 * Two cheap extensions were identified and are DELIBERATELY NOT implemented
 * here (would raise completeness to ~61%, named so a future round can pick
 * them up rather than reinvent them):
 *   1. Scan the WHOLE `cn(...)` call, not one string literal — catches a bare
 *      tone token sitting in its own ternary-branch literal
 *      (`log.level === "error" && "text-destructive"`) whose text tell
 *      (`"text-xs"`) is a SIBLING argument, not in the same literal.
 *   2. Treat a bare `text-<tone>` that co-occurs with `[&>svg]:text-<tone>`
 *      of the SAME tone as text on its own (no text tell required) — the
 *      `[&>svg]:` variant is scoped to a CHILD icon, so a bare sibling of the
 *      identical utility is doing separate, unscoped (parent-element) work;
 *      naively treating "`[&>svg]` present anywhere" as a mark tell currently
 *      suppresses this shape (`alert.tsx`'s pre-fix
 *      `"... text-destructive [&>svg]:text-destructive"` is the reference
 *      case this would have caught).
 *
 * Irreducibly review-only, not fixable by widening the scan: a BARE class
 * with no other tokens at all (`error && "text-destructive"`) and a
 * LOOKUP-MAP value (`{ destructive: "text-destructive" }`) applied to both an
 * icon slot and a text slot elsewhere in the component — the string alone
 * carries no clue which job it is doing. `/review-component` and
 * `brand-ui-accessibility-reviewer` are the backstop for those.
 *
 * Comments are NOT stripped before scanning (matches `check-separation.mjs`'s
 * existing scope) — a backtick-wrapped mention inside a JSDoc/line comment is
 * read as a literal. In practice this has not produced a false positive in
 * this corpus (a documentation mention is a bare, tell-less token, which
 * lands in the SILENT bucket) but a comment that happens to pair a tone
 * mention with a text tell in the same backtick span would.
 *
 * RATCHET: pre-existing violations are baselined
 * (`scripts/status-rung-baseline.json`); a file may only go down or stay.
 * `registry/` is warn-only (copy-own). Same flags as check-separation.mjs:
 * --warn / --update / --force.
 *
 * Dependency-free; ESM; cwd-independent. Pure helpers exported for the
 * self-test (check-status-rung.test.mjs / pnpm rung:check:test).
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);
const BASELINE_PATH = join(SCRIPT_DIR, "status-rung-baseline.json");

/** The four status tones this repo ships a fill/ink/foreground triple for. */
const TONES = ["destructive", "success", "warning", "info"];

/** Type-role utilities (styling-and-tokens.md § Typography scale). */
const TYPE_ROLE_RE = /^text-(display|title|subtitle|body|caption|meta|kpi|code)$/;
/** Raw Tailwind text-size utilities — still a "this is running text" tell. */
const TEXT_SIZE_RE = /^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl)$/;
/** Font-weight utilities. */
const FONT_WEIGHT_RE = /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/;

/** String literals a className could live in (single-line; class strings are). */
const STRING_LITERAL_RE = /"[^"\n]*"|'[^'\n]*'|`[^`\n]*`/g;

/** Strip every leading `variant:` prefix chain (`dark:hover:text-x` → `text-x`). */
function stripVariants(token) {
  return token.replace(/^.*:/, "");
}

/** True iff `token` is scoped to a descendant `svg` via an arbitrary variant. */
function isSvgScoped(token) {
  return /^\[&[_>]svg\]:/.test(token);
}

function isBareToneToken(token) {
  if (isSvgScoped(token)) return false;
  const stripped = stripVariants(token);
  return TONES.some((tone) => stripped === `text-${tone}`);
}

function isTextTell(token) {
  const stripped = stripVariants(token);
  return (
    TYPE_ROLE_RE.test(stripped) ||
    TEXT_SIZE_RE.test(stripped) ||
    FONT_WEIGHT_RE.test(stripped) ||
    stripped === "truncate"
  );
}

function isMarkTell(token, wholeString) {
  const stripped = stripVariants(token);
  if (/^size-/.test(stripped) || /^fill-/.test(stripped)) return true;
  // `[&>svg]:`/`[&_svg]:` anywhere in the string is a mark tell even when the
  // scoped token itself isn't `token` (a sibling utility can be the tell).
  return wholeString.includes("[&>svg]") || wholeString.includes("[&_svg]");
}

/**
 * Does ONE class string violate the rule? True iff it contains a bare
 * `text-<tone>` token co-occurring with a text tell and NOT (only) a mark tell.
 * See the header comment for the exact, honestly-scoped decision procedure.
 */
export function classStringViolates(classString) {
  const tokens = classString.split(/\s+/).filter(Boolean);
  if (!tokens.some(isBareToneToken)) return false;
  if (tokens.some((t) => isTextTell(t))) return true;
  return false;
}

/** Count violating class-string literals in one file's text. */
export function countRungViolations(text) {
  let n = 0;
  for (const m of text.match(STRING_LITERAL_RE) ?? []) {
    const inner = m.slice(1, -1);
    if (classStringViolates(inner)) n++;
  }
  return n;
}

/** Compare current per-file counts to the baseline (same contract as separation). */
export function compareToBaseline(counts, baseline) {
  const violations = [];
  for (const [file, count] of Object.entries(counts)) {
    const allowed = baseline[file] ?? 0;
    if (count > allowed) violations.push({ file, count, allowed });
  }
  return violations.sort((a, b) => a.file.localeCompare(b.file));
}

function collectFiles(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const p = join(dir, name);
    if (/node_modules|dist|storybook-static|\.turbo|coverage|__output/.test(p)) continue;
    const st = statSync(p);
    if (st.isDirectory()) collectFiles(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.(test|stories)\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

export function scanTree(rootAbs, repoRoot = REPO_ROOT) {
  const counts = {};
  for (const file of collectFiles(rootAbs)) {
    const n = countRungViolations(readFileSync(file, "utf8"));
    if (n > 0) counts[relative(repoRoot, file).split("\\").join("/")] = n;
  }
  return counts;
}

const RESIDUAL_NOTE =
  "NOTE (honest completeness, #124): this gate only sees a bare status-fill\n" +
  "utility co-occurring with a text tell IN THE SAME class-string literal —\n" +
  "measured ~39% completeness on the #124 corpus (100% precision on what it\n" +
  "does flag). A standalone ternary-branch token, a lookup-map value reused for\n" +
  "an icon AND a text slot, or a tone paired with `[&>svg]:` of the same tone,\n" +
  "are NOT detected — see the header comment. Review remains necessary.";

// ───────────────────────────────── CLI ────────────────────────────────────────
function main(argv) {
  const args = argv.slice(2);
  const warnOnly = args.includes("--warn");
  const update = args.includes("--update");
  const force = args.includes("--force");
  // `--root <dir>` lets the self-test point the scan at a planted fixture
  // tree instead of this repo (mirrors check-microtypography.mjs).
  const rootIdx = args.indexOf("--root");
  const root = rootIdx >= 0 ? args[rootIdx + 1] : REPO_ROOT;
  const baselinePath = root === REPO_ROOT ? BASELINE_PATH : join(root, "status-rung-baseline.json");

  const pkgsDir = join(root, "packages");
  const pkgCounts = {};
  for (const pkg of existsSync(pkgsDir) ? readdirSync(pkgsDir) : []) {
    const src = join(pkgsDir, pkg, "src");
    if (existsSync(src)) Object.assign(pkgCounts, scanTree(src, root));
  }
  const registryCounts = scanTree(join(root, "registry"), root);

  const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")) : {};

  if (update) {
    const raised = compareToBaseline(pkgCounts, baseline);
    if (raised.length && !force) {
      console.error(
        "✖ rung --update would RAISE the ceiling for:\n" +
          raised.map((v) => `  ${v.file}  ${v.allowed} → ${v.count}`).join("\n") +
          "\nThe ratchet only goes down. If a flagged site is genuinely a mark (a false\n" +
          "positive), fix the call site or re-run with --force and say why.",
      );
      process.exit(1);
    }
    writeFileSync(baselinePath, JSON.stringify(pkgCounts, null, 2) + "\n");
    const total = Object.values(pkgCounts).reduce((a, b) => a + b, 0);
    console.log(
      `✔ rung baseline updated: ${Object.keys(pkgCounts).length} files, ${total} violation(s).`,
    );
    return;
  }

  const violations = compareToBaseline(pkgCounts, baseline);
  const regTotal = Object.values(registryCounts).reduce((a, b) => a + b, 0);
  if (regTotal > 0) {
    console.warn(
      `⚠ rung (registry, warn-only): ${regTotal} status-fill-as-text occurrence(s) in copy-own blocks.`,
    );
  }

  if (violations.length) {
    const label = warnOnly ? "⚠ rung" : "✖ rung gate FAILED";
    console.error(`\n${label} — status FILL rung used as running text (new occurrences):`);
    for (const v of violations) {
      console.error(`  ${v.file} — ${v.count} occurrence(s), baseline allows ${v.allowed}`);
    }
    console.error(
      "\nA bare `text-<tone>` is the 3:1-guaranteed MARK rung — use `text-<tone>-text`\n" +
        "(>=4.5:1, gated) for running text: a message, a label, an error sentence. See\n" +
        '.claude/rules/styling-and-tokens.md ("Which status rung a graphical MARK\n' +
        'reaches for").',
    );
    if (!warnOnly) process.exit(1);
    return;
  }

  const total = Object.values(pkgCounts).reduce((a, b) => a + b, 0);
  if (!warnOnly) {
    console.log(`✔ rung: no new status-fill-as-text violations (${total} baselined).`);
    console.log(RESIDUAL_NOTE);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv);
}
