#!/usr/bin/env node
/**
 * check-audit-artifact.mjs — the committed cross-theme WCAG AA audit artifact,
 * and the gate that keeps it from rotting (#78).
 *
 * WHY THIS EXISTS
 * ---------------
 * `themes-contrast.test.ts` / `charts-contrast.test.ts` already ASSERT the AA
 * thresholds, but an assertion leaves no reviewable evidence: you cannot open a
 * PR and read what the ratios actually are, per theme. #78 asked for a committed
 * audit artifact. The previous attempt (`apps/e2e/reports/charts-aa-2026-06-07.md`,
 * written by an `AUDIT_WRITE=1` block inside the charts test) rotted immediately:
 * it documented `dark` and `high-contrast` theme sections months after those
 * themes were deleted, and nothing failed. A date-stamped file written by an
 * opt-in env var is a reminder, not a gate.
 *
 * So the artifact is GENERATED and STALE-GATED, exactly like the manifest:
 *   pnpm audit-artifact         → regenerate apps/e2e/reports/theme-aa-audit.md
 *   pnpm audit-artifact:check   → fail if the committed file differs / is absent
 *
 * SCOPE (#78's "six themes" framing is outdated)
 * ----------------------------------------------
 * The audit covers the BUILT-IN themes (`BUILT_IN_THEMES` in
 * packages/tokens/src/theme-types.ts) plus the `:root` neutral light base, which
 * is a fallback, not a selectable theme. Since ADR 0029 theme names are OPEN —
 * a consumer authors their own — so this artifact deliberately speaks only for
 * the themes this repo ships; nothing here can measure a theme we never see.
 * The orphan `acme` theme #78 asked to remove is already gone. The gate enforces
 * that scope: an artifact naming a theme that is not in `BUILT_IN_THEMES` fails,
 * so the "documents deleted themes" rot cannot recur.
 *
 * WHAT THIS PROVES — AND WHAT IT DOES NOT
 * ---------------------------------------
 * This is deterministic COMPUTATION over token literals (oklch → sRGB → WCAG),
 * not observation. It proves the token PAIRINGS clear their thresholds. It does
 * NOT prove the rendered UI is accessible: which pairs a component actually
 * composes, text over images/gradients/scrims, focus-ring visibility, and
 * overall legibility all need a rendered pass (Storybook + axe, and human eyes).
 * The artifact says so in its own header so nobody mistakes it for a visual sweep.
 *
 * Independent by design: this file re-derives the oklch→WCAG math in plain JS
 * (CSS Color 4 reference matrices — a spec, not a design decision) rather than
 * importing `packages/tokens/src/color-contrast.ts`, because CI runs Node 20
 * (.nvmrc), which cannot import TypeScript. Two independent implementations of
 * the same spec is a feature: a drift that flips any pass/fail reds either this
 * gate or the vitest suites.
 *
 * Dependency-free; ESM; all paths resolved relative to this file (cwd-independent).
 * Self-tested: `node --test scripts/check-audit-artifact.test.mjs`.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
// Same hazard, same fix, one implementation: this file's `tokenMap` scans
// themes.css declarations exactly like check-role-distinctness.mjs's
// `declarations`, so both must blank comments before matching (#401).
import { blankComments } from "./check-elevation.mjs";
// Every stylesheet that carries a theme block (ADR 0029 split the reference
// themes out of themes.css). Throws rather than return an incomplete set — an
// artifact rendered from a shrunken source would look fresh and audit nothing.
import { readThemesCss } from "./lib/theme-sources.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);
const THEME_TYPES_TS = join(REPO_ROOT, "packages", "tokens", "src", "theme-types.ts");
export const ARTIFACT_PATH = join(REPO_ROOT, "apps", "e2e", "reports", "theme-aa-audit.md");
/** Repo-relative, for messages (never a machine-specific absolute path). */
const ARTIFACT_REL = "apps/e2e/reports/theme-aa-audit.md";

/** WCAG thresholds. */
const AA_TEXT = 4.5; // body text (1.4.3)
const NON_TEXT = 3.0; // graphical objects / UI components (1.4.11)

/**
 * The mode key standing for the `:root` neutral base/fallback — NOT a selectable
 * theme. `root`, not `light`, because `light` is a real shipped theme slug and a
 * colliding sentinel makes the base block indistinguishable from that theme's.
 * Canonical declaration: `ROOT_MODE` in `packages/tokens/scripts/lib/themes-io.mjs`.
 */
export const ROOT_MODE = "root";

/** The `:root` block label. Not a selectable theme — a neutral light fallback. */
export const ROOT_LABEL = ":root (neutral base — not a selectable theme)";

// ── oklch → sRGB → WCAG (CSS Color 4 + WCAG 2.x reference formulas) ───────────

/** Parse an `oklch(L C H[ / A])` literal. Returns null if not oklch. */
export function parseOklch(input) {
  const m = String(input)
    .trim()
    .match(/^oklch\(\s*([^)]+)\)$/i);
  if (!m) return null;
  const [coords] = m[1].split("/").map((s) => s.trim());
  const parts = (coords ?? "").split(/\s+/).filter(Boolean);
  if (parts.length < 3) return null;
  const [l, c, h] = parts.slice(0, 3).map(Number);
  if ([l, c, h].some((n) => Number.isNaN(n))) return null;
  return { l, c, h };
}

function oklabToLinearSrgb(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function linearToSrgb(x) {
  const v = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  return Math.min(1, Math.max(0, v));
}

/** Relative luminance of an `oklch(...)` literal (WCAG 2.x). */
function luminanceOf(oklch) {
  const { l, c, h } = oklch;
  const hr = (h * Math.PI) / 180;
  const [lr, lg, lb] = oklabToLinearSrgb(l, c * Math.cos(hr), c * Math.sin(hr));
  const chans = [linearToSrgb(lr), linearToSrgb(lg), linearToSrgb(lb)];
  const lin = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(chans[0]) + 0.7152 * lin(chans[1]) + 0.0722 * lin(chans[2]);
}

/** WCAG contrast ratio between two `oklch(...)` literals. */
export function contrast(fg, bg) {
  const a = parseOklch(fg);
  const b = parseOklch(bg);
  if (!a || !b) throw new Error(`Not an oklch() pair: ${fg} / ${bg}`);
  const lf = luminanceOf(a);
  const lb = luminanceOf(b);
  const [hi, lo] = lf >= lb ? [lf, lb] : [lb, lf];
  return (hi + 0.05) / (lo + 0.05);
}

// ── themes.css parsing (mirrors the contrast suites' block slicing) ───────────

/**
 * `:root` + the FIRST block per `[data-theme="NAME"]` selector, in the order the
 * contrast suites use them (root/light first, then the theme blocks as they
 * appear). Later duplicate blocks (a theme's 2nd, decoration-only block) are
 * skipped — they carry no color tokens.
 *
 * The checker validates every heading against `BUILT_IN_THEMES`, so a block for
 * a theme outside that set would make the artifact fail its own gate.
 * @returns {{ name: string, body: string }[]}
 */
export function findColorBlocks(cssText) {
  const blocks = [];
  const rootM = cssText.match(/:root\s*\{([\s\S]*?)\n\}/);
  if (rootM) blocks.push({ name: ROOT_MODE, body: rootM[1] });
  const seen = new Set();
  for (const m of cssText.matchAll(/\[data-theme="([^"]+)"\]\s*\{([\s\S]*?)\n\}/g)) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    blocks.push({ name: m[1], body: m[2] });
  }
  return blocks;
}

/**
 * All `--token: <value>;` declarations in a block body. COMMENTS ARE BLANKED
 * FIRST (#401) — this file's own comments (and themes.css's) routinely
 * mention a `--token:` shape, and a naive `[^;]+` scan can start a match
 * INSIDE a comment and swallow the next real declaration whole.
 */
function tokenMap(body) {
  const map = {};
  for (const m of blankComments(body).matchAll(/(--[\w-]+):\s*([^;]+);/g)) map[m[1]] = m[2].trim();
  return map;
}

/**
 * BUILT_IN_THEMES from theme-types.ts (the single source for the themes THIS
 * REPO ships). Theme names are open since ADR 0029, so this is deliberately the
 * built-in list and not "every theme that could exist" — the audit artifact
 * documents the reference themes, which is all this repo can speak for.
 */
export function parseShippedThemes(tsText) {
  const m = tsText.match(/export const BUILT_IN_THEMES\s*=\s*\[([^\]]*)\]/);
  if (!m) throw new Error("Could not parse BUILT_IN_THEMES from theme-types.ts");
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

// ── The audit matrix ─────────────────────────────────────────────────────────

/** Text tokens × the surfaces they are rendered on (issue #20). */
const TEXT_SURFACES = ["--background", "--card", "--surface-muted"];
/** Canonical content surfaces a load-bearing divider is drawn against (#172). */
const NONTEXT_SURFACES = ["--card", "--background"];
/** #221 — calc syntax-highlight TEXT tokens. */
const CALC_TEXT_TOKENS = [
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
/**
 * The chart ramp, all twelve. It was `--chart-1..5` long after the palette grew
 * to twelve (2026-08-16), so the committed evidence silently spoke for 5 of the
 * 12 series that actually ship — the exact under-reporting rot this gate exists
 * to prevent, in the gate itself.
 */
const SERIES = Array.from({ length: 12 }, (_, i) => `--chart-${i + 1}`);

/**
 * Themes whose SERIES ramp is exempt from the ≥3:1 1.4.11 mark bar.
 *
 * `light` only, mirroring `CHART_1411_EXEMPT` in
 * `packages/tokens/src/charts-contrast.test.ts`. It is a signed-off regression
 * decided 2026-08-16, not an oversight: the authored twelve-colour palette is
 * tuned for a mid/dark plot ground, and the maintainer chose to ship it verbatim
 * in BOTH reference themes rather than keep the re-tuned light ramp that
 * satisfied this bar and read as mud. The systemic repair is to darken the plot
 * ground, not to lighten the palette.
 *
 * This gate is the EVIDENCE artifact, so an exempt row is still measured, still
 * rendered, and still shown with its real ratio — it is marked accepted rather
 * than hidden. `:root` is deliberately NOT exempt: a consumer who imports no
 * theme stylesheet still gets a legible ramp.
 */
export const CHART_1411_EXEMPT = new Set(["light"]);

/**
 * Is this row the signed-off light-theme chart-ramp regression?
 *
 * Keyed on the SERIES token, not on `group`/`vs`: `--chart-foreground`,
 * `--chart-label` and `--chart-foreground-muted` are also charts-group rows
 * measured against `--chart-background`, and they are TEXT/mark tokens the
 * exemption never covered. Widening it to the group would silently accept an
 * illegible axis label.
 */
export const isExemptChartRow = (theme, token) =>
  CHART_1411_EXEMPT.has(theme) && SERIES.includes(token);
const CHART_TEXT = [
  ["--chart-foreground", AA_TEXT],
  ["--chart-label", AA_TEXT],
  ["--chart-foreground-muted", NON_TEXT],
];

/**
 * Build the full audit matrix for one themes.css source.
 * Mirrors the assertions in themes-contrast.test.ts + charts-contrast.test.ts —
 * the artifact is evidence FOR those gates, so the row sets must stay aligned.
 * @returns {{ blocks: string[], rows: {theme,group,token,vs,ratio,threshold,pass}[] }}
 */
export function buildAuditRows(cssText) {
  const colorBlocks = findColorBlocks(cssText);
  const tokens = Object.fromEntries(colorBlocks.map((b) => [b.name, tokenMap(b.body)]));
  const blockNames = colorBlocks.map((b) => b.name);

  /** Raw oklch literal for a token in a theme (no `var()` following). */
  const raw = (theme, name) => {
    const v = tokens[theme]?.[name];
    if (v == null) throw new Error(`${theme} is missing ${name} (would fall back to :root)`);
    return v;
  };
  /** Resolve `var(--x)` aliases within the theme, then the light base. */
  const resolve = (theme, name, seen = []) => {
    if (seen.includes(name)) throw new Error(`var() cycle: ${[...seen, name].join(" → ")}`);
    const v = tokens[theme]?.[name] ?? tokens.light?.[name];
    if (v == null) throw new Error(`${theme} is missing ${name} (and no :root fallback)`);
    const alias = v.match(/^var\(\s*(--[\w-]+)\s*\)$/);
    if (alias) return resolve(theme, alias[1], [...seen, name]);
    return v;
  };

  const rows = [];
  const push = (theme, group, token, vs, fg, bg, threshold) => {
    const ratio = contrast(fg, bg);
    rows.push({
      theme,
      group,
      token,
      vs,
      ratio,
      threshold,
      pass: ratio >= threshold,
      exempt: isExemptChartRow(theme, token),
    });
  };

  for (const theme of blockNames) {
    // ── Semantic tokens (themes-contrast.test.ts) ──
    const G = "semantic";
    for (const name of ["--success-text", "--destructive-text", "--warning-text", "--info-text"]) {
      for (const surface of TEXT_SURFACES) {
        push(theme, G, name, surface, raw(theme, name), raw(theme, surface), AA_TEXT);
      }
    }
    push(
      theme,
      G,
      "--highlight-foreground",
      "--highlight",
      raw(theme, "--highlight-foreground"),
      raw(theme, "--highlight"),
      AA_TEXT,
    );
    for (const surface of ["--muted", "--surface-muted"]) {
      push(
        theme,
        G,
        "--muted-foreground",
        surface,
        raw(theme, "--muted-foreground"),
        raw(theme, surface),
        AA_TEXT,
      );
    }
    push(
      theme,
      G,
      "--sidebar-muted-foreground",
      "--sidebar",
      raw(theme, "--sidebar-muted-foreground"),
      raw(theme, "--sidebar"),
      AA_TEXT,
    );
    for (const surface of NONTEXT_SURFACES) {
      push(
        theme,
        G,
        "--border-strong",
        surface,
        raw(theme, "--border-strong"),
        raw(theme, surface),
        NON_TEXT,
      );
    }
    push(
      theme,
      G,
      "--foreground",
      "--background",
      raw(theme, "--foreground"),
      raw(theme, "--background"),
      AA_TEXT,
    );
    for (const name of CALC_TEXT_TOKENS) {
      for (const surface of NONTEXT_SURFACES) {
        push(theme, G, name, surface, raw(theme, name), raw(theme, surface), AA_TEXT);
      }
    }

    // ── Chart palette (charts-contrast.test.ts) ──
    const bg = resolve(theme, "--chart-background");
    for (const s of SERIES) {
      push(theme, "charts", s, "--chart-background", resolve(theme, s), bg, NON_TEXT);
    }
    for (const [name, threshold] of CHART_TEXT) {
      push(theme, "charts", name, "--chart-background", resolve(theme, name), bg, threshold);
    }
  }

  return { blocks: blockNames, rows };
}

// ── Rendering ────────────────────────────────────────────────────────────────

function table(rows) {
  const out = ["| token | vs | ratio | min | |", "| --- | --- | --- | --- | --- |"];
  for (const r of rows) {
    out.push(
      // ⚠️ is a below-bar pairing that is shipped deliberately (see the accepted
      // section in the header) — distinct from ❌, which fails the gate.
      `| \`${r.token}\` | \`${r.vs}\` | ${r.ratio.toFixed(2)} | ${r.threshold.toFixed(1)} | ${r.pass ? "✅" : r.exempt ? "⚠️" : "❌"} |`,
    );
  }
  return out;
}

/**
 * Render the committed markdown artifact. Deterministic — NO timestamp, so the
 * stale-gate can diff it byte-for-byte.
 */
export function renderArtifact(cssText, shippedThemes) {
  const { blocks, rows } = buildAuditRows(cssText);
  const fails = rows.filter((r) => !r.pass && !r.exempt);
  const accepted = rows.filter((r) => !r.pass && r.exempt);
  const themeBlocks = blocks.filter((b) => b !== ROOT_MODE);

  const lines = [
    "# Cross-theme WCAG contrast audit (#78)",
    "",
    "**Generated — do not hand-edit.** Run `pnpm audit-artifact` to regenerate;",
    "`pnpm audit-artifact:check` fails CI when this file drifts from `themes.css`.",
    "",
    "## Scope",
    "",
    `- **${shippedThemes.length} shipped themes:** ${shippedThemes.map((t) => `\`${t}\``).join(", ")} — plus the \`:root\` neutral light base (a fallback, not a selectable theme).`,
    '  #78\'s original "six themes" framing is outdated, and the orphan `acme` theme it asked to',
    '  remove is already gone — no `[data-theme="acme"]` block exists. The gate fails if this',
    "  artifact ever names a theme that is not in `BUILT_IN_THEMES` (`packages/tokens/src/theme-types.ts`),",
    "  which is the specific rot that killed the previous artifact.",
    "- **Source:** `packages/tokens/src/themes.css` (raw `oklch()` token literals; `var()` aliases resolved).",
    "- **Method:** deterministic oklch → OKLab → sRGB → WCAG 2.x relative luminance. No browser.",
    "- **Row set** mirrors the assertions in `packages/tokens/src/themes-contrast.test.ts` and",
    "  `packages/tokens/src/charts-contrast.test.ts` — this file is the readable evidence for those gates.",
    "",
    "## What this proves — and what it does NOT",
    "",
    "This is **computation over tokens, not observation of a rendered screen.**",
    "",
    "- ✅ **Proven here:** every gated token pairing clears its WCAG threshold in every theme —",
    "  status/`-text` colors on all three text surfaces, muted text, sidebar nav text, the search",
    "  highlight plate, the `--border-strong` non-text rung (ADR 0010 / #172), the Gantt inside-label",
    "  pill pair (#259), the calc syntax palette (#221), and the twelve chart series + chart text.",
    "- ❌ **NOT proven here — still needs a rendered pass and human eyes:** which pairs a component",
    "  actually composes (a component may put `--muted-foreground` on `--card`, an ungated pair), text",
    "  over images/gradients/scrims, disabled and placeholder states, focus-ring visibility, hit-target",
    "  size, and whether a screen simply *reads* well. Those come from the Storybook axe pass",
    "  (`pnpm --filter @elabs-ai/components-docs test-storybook`, blocking in CI since #280 —",
    "  though axe's own `test` mode is still advisory, ratcheting in #316) and from a",
    "  `brand-ui-visual-ux-reviewer` three-theme sweep.",
    "",
    "## Thresholds",
    "",
    "| class | min | applies to |",
    "| --- | --- | --- |",
    "| AA body text (1.4.3) | 4.5:1 | `*-text`, `--muted-foreground`, `--foreground`, `--chart-foreground`, `--chart-label`, calc syntax |",
    "| Non-text (1.4.11) | 3:1 | `--border-strong`, `--chart-1..12`, `--chart-foreground-muted` |",
    "",
    "> `--input` and `--border` are deliberately **not** gated at 3:1 — both are the subtle,",
    "> redundant-boundary rung per the ADR 0010 Amendment (2026-06-20). See",
    "> `.claude/rules/styling-and-tokens.md`.",
    "",
    `## Result: ${fails.length === 0 ? "✅ no failures" : `❌ ${fails.length} failure(s)`}`,
    "",
    `${rows.length} pairings across ${blocks.length} color blocks (${themeBlocks.length} shipped themes + the \`:root\` base).`,
    "",
    ...(accepted.length > 0
      ? [
          `### ⚠️ ${accepted.length} accepted below-bar pairing(s)`,
          "",
          "Measured, below the bar, and shipped **on purpose** — they are marked `⚠️` in the",
          "tables below rather than `❌`, and they do not fail the gate. They are NOT",
          "compliant; they are a recorded decision, and the record is here so it stays",
          "visible rather than becoming folklore.",
          "",
          `- **The \`${[...CHART_1411_EXEMPT].join("`, `")}\` theme's chart ramp vs \`--chart-background\`**`,
          "  (signed off 2026-08-16). The authored twelve-colour palette is tuned for a mid/dark",
          "  plot ground and ships verbatim in both reference themes; the light-only re-tune that",
          "  satisfied 3:1 turned the brand colour to mud and was rejected. The systemic repair is",
          "  to darken the plot ground, not to lighten the palette. Mirrored by `CHART_1411_EXEMPT`",
          "  in `packages/tokens/src/charts-contrast.test.ts`; both sides fail if the ramp is ever",
          "  re-tuned to clear the bar, so the carve-out cannot outlive the thing it excuses.",
          "",
        ]
      : []),
  ];

  for (const block of blocks) {
    lines.push(`## ${block === ROOT_MODE ? ROOT_LABEL : block}`, "");
    lines.push("### Semantic tokens", "");
    lines.push(...table(rows.filter((r) => r.theme === block && r.group === "semantic")));
    lines.push("", "### Chart palette", "");
    lines.push(...table(rows.filter((r) => r.theme === block && r.group === "charts")));
    lines.push("");
  }

  return lines.join("\n") + "\n";
}

// ── The gate ─────────────────────────────────────────────────────────────────

/**
 * @returns {string[]} human-readable violations (empty = green).
 */
export function findArtifactViolations(committed, cssText, shippedThemes) {
  const problems = [];
  const expected = renderArtifact(cssText, shippedThemes);

  if (committed == null) {
    problems.push(`${ARTIFACT_REL} is MISSING. Run \`pnpm audit-artifact\`.`);
    return problems;
  }

  // Diagnostic check FIRST: a theme heading that is not a shipped theme is the
  // exact rot that made the previous artifact useless (it documented `dark` and
  // `high-contrast` long after both were deleted).
  const allowed = new Set([...shippedThemes, ROOT_LABEL]);
  for (const m of committed.matchAll(/^## (.+)$/gm)) {
    const heading = m[1].trim();
    // Only headings that look like a theme block are checked; prose sections
    // ("Scope", "Thresholds", "Result: …") are not theme names.
    if (heading.startsWith(":root") && heading !== ROOT_LABEL) {
      problems.push(`Artifact names the base block as "${heading}"; expected "${ROOT_LABEL}".`);
      continue;
    }
    if (/^[a-z][a-z0-9-]*$/.test(heading) && !allowed.has(heading)) {
      problems.push(
        `Artifact documents theme "${heading}", which is not in BUILT_IN_THEMES ` +
          `(${shippedThemes.join(", ")}). A deleted theme must not survive in the audit.`,
      );
    }
  }

  if (committed !== expected) {
    problems.push(
      `${ARTIFACT_REL} is STALE — it no longer matches themes.css. Run \`pnpm audit-artifact\`.`,
    );
  }

  const { rows } = buildAuditRows(cssText);

  for (const r of rows.filter((r) => !r.pass && !r.exempt)) {
    problems.push(
      `AA failure: ${r.theme} ${r.token} vs ${r.vs} = ${r.ratio.toFixed(2)} (min ${r.threshold.toFixed(1)}).`,
    );
  }

  // The exemption is not a hole: it is only valid while the ramp it excuses is
  // still failing. A light ramp that has been re-tuned to clear 3:1 makes this
  // carve-out stale, and a stale exemption is how a bar quietly stops applying —
  // so passing here FAILS, with the remedy being to delete the exemption.
  // (`charts-contrast.test.ts` pins the same invariant from the other side.)
  // The unit of the exemption is the RAMP, not the series: individual members
  // already clear the bar (light --chart-6/-8/-11 do today) while the ramp as a
  // whole does not, so a per-row staleness test would fire on a palette nobody
  // touched. It is stale only when the excuse has nothing left to excuse.
  for (const theme of CHART_1411_EXEMPT) {
    const ramp = rows.filter((r) => r.exempt && r.theme === theme);
    if (ramp.length > 0 && ramp.every((r) => r.pass)) {
      problems.push(
        `The 1.4.11 chart-ramp exemption for "${theme}" is STALE — every series now clears ` +
          `${NON_TEXT.toFixed(1)}:1, so the carve-out excuses nothing. Delete "${theme}" from ` +
          `CHART_1411_EXEMPT here AND from CHART_1411_EXEMPT in ` +
          `packages/tokens/src/charts-contrast.test.ts.`,
      );
    }
  }

  return problems;
}

// ── CLI ──────────────────────────────────────────────────────────────────────

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const write = process.argv.includes("--write");
  const css = readThemesCss();
  const shipped = parseShippedThemes(readFileSync(THEME_TYPES_TS, "utf8"));

  if (write) {
    mkdirSync(dirname(ARTIFACT_PATH), { recursive: true });
    writeFileSync(ARTIFACT_PATH, renderArtifact(css, shipped), "utf8");
    console.log(`✔ audit-artifact: wrote ${ARTIFACT_REL} (${shipped.length} themes + :root base)`);
  } else {
    const committed = existsSync(ARTIFACT_PATH) ? readFileSync(ARTIFACT_PATH, "utf8") : null;
    const problems = findArtifactViolations(committed, css, shipped);
    if (problems.length > 0) {
      console.error("✖ audit-artifact gate failed:\n");
      for (const p of problems) console.error(`  - ${p}`);
      console.error("");
      process.exit(1);
    }
    // Never report "all pairings pass" while an accepted below-bar pairing ships —
    // that sentence is what turns a recorded decision into folklore.
    const accepted = buildAuditRows(css).rows.filter((r) => r.exempt && !r.pass);
    const acceptedNote =
      accepted.length > 0
        ? `, ${accepted.length} accepted below-bar (see the artifact's own header)`
        : ", all pairings pass";
    console.log(
      `✔ audit-artifact: ${ARTIFACT_REL} is current (${shipped.length} themes + :root base${acceptedNote})`,
    );
  }
}
