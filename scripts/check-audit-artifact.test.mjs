/**
 * check-audit-artifact.test.mjs — locks the #78 AA-audit-artifact gate.
 * Run in CI: `node --test scripts/check-audit-artifact.test.mjs`.
 *
 * A gate that can silently stop firing is worse than none, so every failure mode
 * the gate exists to catch is planted here as an INLINE fixture (hermetic — the
 * real themes.css and the real committed artifact are never touched).
 *
 * The failure modes, in the order they killed the previous artifact:
 *   1. the artifact is missing;
 *   2. the artifact drifts from themes.css (nobody regenerated it);
 *   3. the artifact documents a theme that no longer exists (`dark`,
 *      `high-contrast` survived in `charts-aa-2026-06-07.md` for months);
 *   4. a token pairing actually fails WCAG.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contrast,
  parseOklch,
  parseShippedThemes,
  findColorBlocks,
  buildAuditRows,
  renderArtifact,
  findArtifactViolations,
  ROOT_LABEL,
  ROOT_MODE,
} from "./check-audit-artifact.mjs";

// ── Fixture builder ──────────────────────────────────────────────────────────

const INK = "oklch(0.2 0 0)"; // near-black — clears AA on every light surface
const PAPER = "oklch(1 0 0)"; // white
const MID = "oklch(0.96 0 0)"; // a light surface
const RUNG = "oklch(0.55 0 0)"; // clears 3:1 on white, not 4.5:1

const CALC = [
  "--calc-foreground",
  "--calc-number",
  "--calc-unit",
  "--calc-currency",
  "--calc-variable",
  "--calc-reference",
  "--calc-function",
  "--calc-operator",
  "--calc-result",
  "--calc-comment",
  "--calc-warning",
];

/** A block body with every token the audit matrix reads. `over` patches tokens. */
function blockBody(over = {}) {
  const t = {
    "--background": PAPER,
    "--card": PAPER,
    "--surface-muted": MID,
    "--muted": MID,
    "--sidebar": MID,
    "--highlight": PAPER,
    "--highlight-foreground": INK,
    "--foreground": INK,
    "--muted-foreground": INK,
    "--sidebar-muted-foreground": INK,
    "--success-text": INK,
    "--destructive-text": INK,
    "--warning-text": INK,
    "--info-text": INK,
    "--border-strong": RUNG,
    "--chart-background": "var(--card)",
    "--chart-1": RUNG,
    "--chart-2": RUNG,
    "--chart-3": RUNG,
    "--chart-4": RUNG,
    "--chart-5": RUNG,
    "--chart-foreground": INK,
    "--chart-label": INK,
    "--chart-foreground-muted": RUNG,
    ...Object.fromEntries(CALC.map((n) => [n, INK])),
    ...over,
  };
  return Object.entries(t)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
}

/** A themes.css fixture: `:root` + one `[data-theme="mint"]` block. */
function css({ root = {}, mint = {} } = {}) {
  return [
    `:root {\n${blockBody(root)}\n}`,
    "",
    `[data-theme="mint"] {\n${blockBody(mint)}\n}`,
    "",
    // A 2nd, decoration-only block for the same theme — must be SKIPPED (it has
    // no color tokens; the real drafting theme ships exactly this shape).
    `[data-theme="mint"] {\n  --decoration: 10;\n}`,
    "",
  ].join("\n");
}

const THEMES = ["mint"];

// ── The color math (spec anchors) ────────────────────────────────────────────

test("contrast: black vs white is the WCAG maximum 21:1", () => {
  assert.ok(Math.abs(contrast("oklch(0 0 0)", "oklch(1 0 0)") - 21) < 0.001);
});

test("contrast: a color against itself is 1:1", () => {
  assert.ok(Math.abs(contrast(RUNG, RUNG) - 1) < 1e-9);
});

test("contrast is symmetric (fg/bg order does not matter)", () => {
  assert.ok(Math.abs(contrast(INK, PAPER) - contrast(PAPER, INK)) < 1e-12);
});

test("parseOklch returns null for a non-oklch value instead of throwing", () => {
  assert.equal(parseOklch("var(--card)"), null);
  assert.equal(parseOklch("#fff"), null);
});

// ── themes.css parsing ───────────────────────────────────────────────────────

test("findColorBlocks takes :root + the FIRST block per theme (skips the 2nd)", () => {
  const blocks = findColorBlocks(css());
  assert.deepEqual(
    blocks.map((b) => b.name),
    [ROOT_MODE, "mint"],
  );
});

test("parseShippedThemes reads BUILT_IN_THEMES out of theme-types.ts", () => {
  const src = `export const BUILT_IN_THEMES = ["light", "dark", "drafting"] as const;`;
  assert.deepEqual(parseShippedThemes(src), ["light", "dark", "drafting"]);
});

test("buildAuditRows resolves var() aliases (--chart-background: var(--card))", () => {
  const { rows } = buildAuditRows(css());
  const series = rows.find((r) => r.theme === "mint" && r.token === "--chart-1");
  // RUNG on white ≈ 4.0:1 — proves the alias resolved to --card, not to a literal.
  assert.ok(series.ratio > 3 && series.ratio < 5, `unexpected ratio ${series.ratio}`);
  assert.equal(series.pass, true);
});

test("buildAuditRows throws when a theme block omits a semantic token", () => {
  const broken = css().replace("  --border-strong: oklch(0.55 0 0);\n", "");
  assert.throws(() => buildAuditRows(broken), /missing --border-strong/);
});

// #401 — `tokenMap` (the private declaration scanner behind buildAuditRows)
// used to scan the RAW block body: a comment sitting directly above a
// declaration and mentioning a `--token:`-shaped substring (themes.css
// documents its own tokens inline, e.g. the real comment above light's
// `--ring`) made the lazy `[^;]+` regex start matching INSIDE the comment and
// consume through to the semicolon of the NEXT real declaration, silently
// dropping it — which surfaced as exactly the "missing token" throw above,
// for a token that was never actually missing from the source. Same class of
// bug already fixed in `scripts/check-role-distinctness.mjs` (commit 22ca442).
test("buildAuditRows does not swallow a declaration preceded by a comment mentioning another --token: (#401)", () => {
  const source = css().replace(
    "  --border-strong: oklch(0.55 0 0);",
    "  /* mentions --other-token: in prose, not a real declaration */\n  --border-strong: oklch(0.55 0 0);",
  );
  let result;
  assert.doesNotThrow(() => {
    result = buildAuditRows(source);
  });
  const row = result.rows.find((r) => r.theme === ROOT_MODE && r.token === "--border-strong");
  assert.ok(row, "the --border-strong row for the `:root` base block must still be present");
});

// ── The gate: green case ─────────────────────────────────────────────────────

test("PASSES: a freshly generated artifact matching themes.css", () => {
  const source = css();
  const artifact = renderArtifact(source, THEMES);
  assert.deepEqual(findArtifactViolations(artifact, source, THEMES), []);
});

test("the artifact is deterministic (no timestamp) so it can be diffed", () => {
  const source = css();
  assert.equal(renderArtifact(source, THEMES), renderArtifact(source, THEMES));
});

test("the artifact labels the :root block as a non-selectable base", () => {
  assert.ok(renderArtifact(css(), THEMES).includes(`## ${ROOT_LABEL}`));
});

// ── The gate: failure mode 1 — missing ───────────────────────────────────────

test("FAILS: the artifact does not exist", () => {
  const problems = findArtifactViolations(null, css(), THEMES);
  assert.ok(
    problems.some((p) => /MISSING/.test(p)),
    problems.join("\n"),
  );
});

// ── The gate: failure mode 2 — stale (the core rot) ──────────────────────────

test("FAILS: the artifact is stale after a token value changes in themes.css", () => {
  const before = css();
  const artifact = renderArtifact(before, THEMES);
  // Retune --success-text; the committed artifact still shows the old ratio.
  const after = css({ mint: { "--success-text": "oklch(0.3 0 0)" } });
  const problems = findArtifactViolations(artifact, after, THEMES);
  assert.ok(
    problems.some((p) => /STALE/.test(p)),
    problems.join("\n"),
  );
});

test("FAILS: the artifact was hand-edited (a ratio doctored to hide a change)", () => {
  const source = css();
  const artifact = renderArtifact(source, THEMES).replace(/\| \d+\.\d\d \|/, "| 99.00 |");
  const problems = findArtifactViolations(artifact, source, THEMES);
  assert.ok(
    problems.some((p) => /STALE/.test(p)),
    problems.join("\n"),
  );
});

// ── The gate: failure mode 3 — a deleted theme survives ──────────────────────

test("FAILS: the artifact documents a theme that is not in BUILT_IN_THEMES", () => {
  const source = css();
  // Exactly the rot that killed charts-aa-2026-06-07.md: `dark`/`high-contrast`
  // sections outlived the themes themselves and nothing complained.
  const artifact = renderArtifact(source, THEMES) + "\n## high-contrast\n\nstale section\n";
  const problems = findArtifactViolations(artifact, source, THEMES);
  assert.ok(
    problems.some((p) => /high-contrast/.test(p) && /not in BUILT_IN_THEMES/.test(p)),
    problems.join("\n"),
  );
});

test("FAILS: the :root section is renamed to look like a shipped theme", () => {
  const source = css();
  const artifact = renderArtifact(source, THEMES).replace(`## ${ROOT_LABEL}`, "## :root");
  const problems = findArtifactViolations(artifact, source, THEMES);
  assert.ok(
    problems.some((p) => /expected/.test(p)),
    problems.join("\n"),
  );
});

test("DOES NOT FLAG: prose headings are not mistaken for theme names", () => {
  const source = css();
  const artifact = renderArtifact(source, THEMES);
  // "Scope", "Thresholds", "Result: …" are all `## ` headings in the artifact.
  assert.ok(artifact.includes("## Scope"));
  assert.deepEqual(findArtifactViolations(artifact, source, THEMES), []);
});

// ── The gate: failure mode 4 — a real AA regression ──────────────────────────

test("FAILS: a token pairing drops below its WCAG threshold", () => {
  // Muted nav text tuned too light for the sidebar ground (the #23 regression).
  const source = css({ mint: { "--sidebar-muted-foreground": "oklch(0.9 0 0)" } });
  const artifact = renderArtifact(source, THEMES);
  const problems = findArtifactViolations(artifact, source, THEMES);
  assert.ok(
    problems.some((p) => /AA failure/.test(p) && /--sidebar-muted-foreground/.test(p)),
    problems.join("\n"),
  );
});

test("a failing pairing is rendered as ❌ in the artifact, not silently omitted", () => {
  const source = css({ mint: { "--sidebar-muted-foreground": "oklch(0.9 0 0)" } });
  const artifact = renderArtifact(source, THEMES);
  assert.ok(/failure\(s\)/.test(artifact));
  assert.ok(artifact.includes("❌"));
});
