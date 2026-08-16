#!/usr/bin/env node
/**
 * check-role-distinctness.mjs — the role-distinctness gate (#385).
 *
 * Asserts that pairs of SEMANTICALLY INDEPENDENT roles which can co-occur in one
 * view stay PERCEPTUALLY distinguishable in every theme block of
 * `packages/tokens/src/themes.css` (`:root` included, enrolled as `light`).
 *
 * WHY THIS EXISTS. `pnpm theme-parity:check` proves every theme *defines* every
 * token (presence). `themes-contrast.test.ts` proves a token clears a ratio
 * against a *surface*. Neither expresses distinctness, which is a property of two
 * tokens against **each other** — so the whole class was invisible to CI. #334
 * found `--success` byte-identical to `--primary` and `--ring` to `--info` in
 * both qlik themes; #385 found the same class in `:root` (five roles —
 * `--primary`, `--ring`, `--sidebar-primary`, `--sidebar-ring`, `--chart-1` — on
 * ONE literal) and in blueprint. A focus ring that renders in exactly the colour
 * of the primary button and of chart series 1 has destroyed the only signal
 * those tokens carry.
 *
 * WHAT IT MEASURES, AND WHY NOT STRING INEQUALITY. Byte inequality is too weak:
 * a 0.001 nudge in L would satisfy it while still rendering as the same colour.
 * The gate measures Euclidean distance in **OKLab** (ΔE) and requires
 * `ROLE_SEPARATION_DELTA_E` — the same 0.05 floor `themes-contrast.test.ts` uses
 * for `ROLE_PAIRS`, chosen because ~0.02 is roughly the just-noticeable
 * difference for two large patches, so 0.05 reads as "different colours" while
 * still allowing an in-family nudge.
 *
 * `var(--…)` IS NOT A LAUNDERING DEVICE. An alias is resolved to its literal
 * before comparison, so `--ring: var(--primary)` fails exactly as a duplicated
 * literal does. Declaring an alias only documents intent; it does not make two
 * MUST_DIFFER roles compatible. (Conversely, an alias between roles that are NOT
 * in MUST_DIFFER — `--sidebar-primary: var(--primary)` — is the *sanctioned*
 * way to express an intentional mirror, and this gate ignores it.)
 *
 * RELATIONSHIP TO THE OTHER TWO GATES — keep all three; they are complementary:
 *   - `themes-contrast.test.ts` `ROLE_PAIRS` (:179, #334) owns `(success, primary)`
 *     and `(ring, info)`. This file deliberately does NOT duplicate those two rows.
 *   - This gate proves THE TOKENS DIFFER.
 *   - #391 proves THE DIFFERENCE SURVIVES TO THE PIXEL (blueprint's status roles
 *     are NOT aliased — ΔE 0.070/0.212 — yet render identically because
 *     `decoration.css` rewrites every `.bg-<tone>` to one declaration set). A
 *     token-level gate is structurally blind to that; do not delete either as
 *     redundant.
 *
 * Flags:
 *   --warn   never exit non-zero (dev-hook mode); still prints findings.
 *
 * Dependency-free; ESM; locates themes.css relative to this file (cwd-independent).
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
// Same hazard, same fix, one implementation: `themes.css` comments describe the
// declarations these gates scan for, so both must blank comments before matching.
import { blankComments } from "./check-elevation.mjs";
// The ACTIVE theme set — a paused theme is kept as source but never gated
// (single source of truth: PAUSED_THEMES in theme-types.ts).
import { ACTIVE_THEMES } from "./lib/paused-surfaces.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR); // scripts/ → repo root
const THEMES_CSS = join(REPO_ROOT, "packages", "tokens", "src", "themes.css");

/**
 * The mode key standing for the `:root` neutral base/fallback — NOT a selectable
 * theme. `root`, not `light`, because `light` is a real shipped theme slug and a
 * colliding sentinel resolves the light theme's block to `:root`. Canonical
 * declaration: `ROOT_MODE` in `packages/tokens/scripts/lib/themes-io.mjs`.
 */
export const ROOT_MODE = "root";

/**
 * Theme mode key → block. `ROOT_MODE` is the FIRST `:root` block (the neutral
 * fallback, never selected by `ThemeProvider` but still the value anything
 * un-themed renders). Mirrors `themes-io.mjs THEME_NAMES` and the parity gate.
 */
export const THEME_NAMES = [ROOT_MODE, ...ACTIVE_THEMES];

/**
 * Perceptual floor, as an OKLab ΔE. Deliberately the SAME constant as
 * `ROLE_SEPARATION_DELTA_E` in `packages/tokens/src/themes-contrast.test.ts:190`
 * — one perceptual bar for the whole role-distinctness class. If you move one,
 * move both.
 */
export const ROLE_SEPARATION_DELTA_E = 0.05;

/**
 * Roles that can be on screen SIMULTANEOUSLY and whose only carrier is colour,
 * so collapsing any pair destroys a distinction the user needs. `[a, b]`.
 *
 * NOT here, on purpose:
 *   - `(--success, --primary)` and `(--ring, --info)` — owned by `ROLE_PAIRS` in
 *     `themes-contrast.test.ts:179` (#334). Duplicating them would mean two
 *     places to update and two places to accidentally weaken.
 *   - `(--primary, --chart-1)` — see the ADR-style note in EXEMPTIONS below.
 *   - `(--ring, --primary-text)`, `(--ring, --success-text)`, `(--ring, --info-text)`
 *     — a 2px stroke and a word of TEXT are different channels, the same reasoning
 *     that keeps `(--primary, --chart-1)` out. They stay advisory (ADR 0027);
 *     do not "helpfully" add them.
 *   - the `--sidebar-*` mirrors (`--sidebar-primary`, `--sidebar-ring`,
 *     `--sidebar-accent-foreground`) — intentional aliases (Tier A in #385), now
 *     expressed as `var()` references. They are SUPPOSED to be equal, which is
 *     exactly why the gate has to be pair-scoped rather than a blanket
 *     "no two tokens share a literal" scan.
 */
export const MUST_DIFFER = [
  // A focus ring must never read as the primary action: "this is focused" and
  // "this is the default button" are different messages on the same screen.
  ["--ring", "--primary"],
  // …nor as chart series 1. A focused control sitting beside a chart is the
  // ordinary dashboard case.
  ["--ring", "--chart-1"],
  // A hovered/selected row's ink vs the focus ring — both are "attention" cues
  // that must be told apart.
  ["--accent-foreground", "--ring"],
  // The focus ring and the success mark, once the ring is brand-derived
  // (ADR 0027). Both are graphical MARKS in the green family — a focus halo
  // that reads as "this completed" is the #334 failure one role over. The
  // (--ring, --info) half of this lives in ROLE_PAIRS (themes-contrast.test.ts,
  // #334) and is deliberately NOT duplicated here.
  ["--ring", "--success"],
  // The CURRENT search match vs a destructive state (ADR 0025). Both are deep,
  // saturated plates with white ink; collapsed, "the match you are on" reads as
  // an error. The first draft of `--highlight-active` shipped at ΔE 0.011 from
  // `--destructive` in `:root` — an undeclared alias — which is why this pair is
  // an invariant rather than a comment.
  ["--highlight-active", "--destructive"],
  // Categorical series are, by definition, distinguished from each other. Any
  // two collapsing makes two series one.
  ["--chart-1", "--chart-2"],
  ["--chart-1", "--chart-3"],
  ["--chart-1", "--chart-4"],
  ["--chart-1", "--chart-5"],
  ["--chart-2", "--chart-3"],
  ["--chart-2", "--chart-4"],
  ["--chart-2", "--chart-5"],
  ["--chart-3", "--chart-4"],
  ["--chart-3", "--chart-5"],
  ["--chart-4", "--chart-5"],
];

/**
 * By-design equalities, keyed `"<theme>/<roleA>|<roleB>"` with the roles in
 * MUST_DIFFER's own order. Every entry carries the decision that justifies it —
 * an exemption without a recorded reason is indistinguishable from a bug.
 *
 * This list is HAND-AUTHORED, never `--update`d from the current state: that is
 * the difference between an invariant and a ratchet. Adding an entry must be a
 * deliberate act with an argument attached.
 */
export const EXEMPTIONS = new Map([
  // Empty on purpose. The only exemptions this list ever carried were the three
  // monochrome rows for the now-PAUSED `blueprint` theme (the architect's
  // 2026-08-02 decision for #385). The gate reads the ACTIVE theme set, so an
  // exemption naming a paused theme is dead weight — and the self-test rejects
  // it as an unknown theme. Restore them from git history if that theme is ever
  // un-paused (.claude/rules/paused-surfaces.md).
]);

/**
 * THE RULE FOR ADDING AN EXEMPTION, so the list cannot quietly become a ratchet:
 * an exemption is scoped to ONE `(theme, pair)` and must cite the THEME'S OWN
 * design contract. A pair that needs an exemption in a POLYCHROME theme is not
 * an invariant — delete the pair from MUST_DIFFER instead. That test is exactly
 * why `(--primary, --chart-1)` is absent above: it is below the floor in
 * light (ΔE 0.0463) and barely over it in dark (0.0544), because both
 * themes ship series 1 as a chart-tuned cousin of the brand hue ON PURPOSE.
 * `--primary` is control chrome and `--chart-1` is a data mark — different
 * channels, no confusion — so the honest fix was to drop the pair, not to exempt
 * the flagship theme for shipping its brand colour. The chart-side hazards stay
 * covered by `(--ring, --chart-1)` and the chart-N/chart-M rows.
 */

/** Extract the FIRST block body for a theme (same regex as the parity gate). */
function extractBlock(cssText, name) {
  const re =
    name === ROOT_MODE
      ? /:root\s*\{([\s\S]*?)\n\}/
      : new RegExp(`\\[data-theme="${name}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`);
  const m = cssText.match(re);
  return m?.[1] ?? null;
}

/**
 * All `--token: <value>;` declarations in a block body → ordered map.
 *
 * COMMENTS ARE BLANKED FIRST, and that is load-bearing, not tidiness. This file
 * documents the very patterns it scans for, so a prose comment routinely contains
 * a `--token:` sequence. Without blanking, the lazy `[^;]*?` happily starts a
 * match INSIDE a comment and runs to the first `;` it finds — which is the
 * semicolon of the next REAL declaration, swallowing it whole.
 *
 * That is not hypothetical: `themes.css`'s light `--ring` comment says
 * "…distinct from the green brand AND (#334) from --info: it used to be…", so
 * the scan produced `--info` = "it used to be byte-identical…" and **no
 * `--ring` at all** — and the `:root` fallback in `resolveToken()` then silently
 * compared `:root`'s ring against light's primary. Three of this gate's
 * pairs were evaluated against the wrong theme in the DEFAULT theme, so planting
 * a real collision on `light --ring` produced zero violations.
 *
 * `blankComments` is reused from the elevation gate (same hazard, same fix)
 * rather than re-implemented — it preserves length and newlines, so offsets stay
 * valid for any caller that needs them.
 */
function declarations(body) {
  const map = new Map();
  for (const m of blankComments(body).matchAll(/(--[\w-]+)\s*:\s*([^;]*?)\s*;/g)) {
    map.set(m[1], m[2].trim());
  }
  return map;
}

/**
 * Resolve a token to its `oklch()` literal, following `var(--…)` aliases inside
 * the block and falling back to `:root` the way the cascade does. Returns null
 * if the chain does not terminate in an oklch literal (a hex brand mark, a
 * `calc()`, an unresolvable name) — such a token is simply not comparable and is
 * reported as `unresolved`, never silently passed.
 */
export function resolveToken(name, block, root, seen = new Set()) {
  if (seen.has(name)) return null; // cycle guard
  seen.add(name);
  const raw = block.get(name) ?? root.get(name);
  if (raw == null) return null;
  if (/^oklch\(/i.test(raw)) return raw;
  const alias = raw.match(/^var\(\s*(--[\w-]+)\s*\)$/);
  if (alias) return resolveToken(alias[1], block, root, seen);
  return null;
}

/** Parse `oklch(L C H [/ A])` → { l, c, h }. */
function parseOklch(input) {
  const m = input.trim().match(/^oklch\(\s*([^)]+)\)$/i);
  if (!m) return null;
  const coords = m[1].split("/")[0].trim().split(/\s+/).filter(Boolean);
  if (coords.length < 3) return null;
  const [l, c, h] = coords.map(Number);
  if ([l, c, h].some(Number.isNaN)) return null;
  return { l, c, h };
}

/**
 * Euclidean distance in OKLab between two `oklch()` literals. Identical to
 * `oklabDistance()` in `themes-contrast.test.ts` — the polar chroma/hue pair is
 * converted to rectangular a/b first, so a hue difference at low chroma counts
 * for as little as it actually looks.
 */
export function oklabDistance(a, b) {
  const toLab = (raw) => {
    const p = parseOklch(raw);
    if (!p) return null;
    const rad = (p.h * Math.PI) / 180;
    return [p.l, p.c * Math.cos(rad), p.c * Math.sin(rad)];
  };
  const A = toLab(a);
  const B = toLab(b);
  if (!A || !B) return null;
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}

/**
 * Compute role-distinctness violations for a themes.css source string.
 *
 * @param {string} cssText - the full themes.css source.
 * @param {object} [opts]
 * @param {Map<string,string>} [opts.exemptions] - override the shipped list (tests).
 * @param {Array<[string,string]>} [opts.mustDiffer] - override the pair list (tests).
 * @param {number} [opts.floor] - override the ΔE floor (tests).
 * @returns {{ theme: string, a: string, b: string, kind: "collision"|"unresolved",
 *             deltaE: number|null, valueA: string|null, valueB: string|null }[]}
 */
export function findRoleCollisions(cssText, opts = {}) {
  const exemptions = opts.exemptions ?? EXEMPTIONS;
  const mustDiffer = opts.mustDiffer ?? MUST_DIFFER;
  const floor = opts.floor ?? ROLE_SEPARATION_DELTA_E;

  const rootBody = extractBlock(cssText, ROOT_MODE);
  const root = rootBody ? declarations(rootBody) : new Map();

  const violations = [];
  for (const theme of THEME_NAMES) {
    const body = extractBlock(cssText, theme);
    if (body == null) continue; // absent block is theme-parity's / dup-blocks' job
    const block = declarations(body);

    for (const [a, b] of mustDiffer) {
      if (exemptions.has(`${theme}/${a}|${b}`)) continue;

      // A parse miss must never masquerade as a legitimate cascade fallback.
      // Every MUST_DIFFER role is a per-theme SEMANTIC token, and
      // `theme-parity:check` already guarantees every theme block declares every
      // one of them — so if a role is absent from this block's parsed map, the
      // gate is looking at the wrong theme's value and MUST say so loudly rather
      // than quietly comparing `:root`'s. This is the second half of the #385
      // fix: blanking comments stops today's miss, this stops the whole CLASS of
      // miss from ever being silent again.
      for (const role of [a, b]) {
        if (!block.has(role)) {
          violations.push({
            theme,
            a: role,
            b: role,
            kind: "not-declared",
            deltaE: null,
            valueA: null,
            valueB: null,
          });
        }
      }
      if (!block.has(a) || !block.has(b)) continue;

      const va = resolveToken(a, block, root);
      const vb = resolveToken(b, block, root);
      if (va == null || vb == null) {
        // Only report if the token is actually declared somewhere — a role a
        // theme legitimately does not have is not this gate's business.
        if (block.has(a) && block.has(b)) {
          violations.push({
            theme,
            a,
            b,
            kind: "unresolved",
            deltaE: null,
            valueA: va,
            valueB: vb,
          });
        }
        continue;
      }
      const deltaE = oklabDistance(va, vb);
      if (deltaE == null || deltaE < floor) {
        violations.push({ theme, a, b, kind: "collision", deltaE, valueA: va, valueB: vb });
      }
    }
  }
  return violations;
}

// ───────────────────────────────── CLI ────────────────────────────────────────
function main(argv) {
  const warnOnly = argv.slice(2).includes("--warn");

  if (!existsSync(THEMES_CSS)) {
    console.error(`✖ role-distinctness gate: themes.css not found at ${THEMES_CSS}`);
    if (!warnOnly) process.exit(1);
    return;
  }

  let cssText = "";
  try {
    cssText = readFileSync(THEMES_CSS, "utf8");
  } catch (e) {
    console.error(`✖ role-distinctness gate: failed to read ${THEMES_CSS}: ${e.message}`);
    if (!warnOnly) process.exit(1);
    return;
  }

  const violations = findRoleCollisions(cssText);

  if (violations.length) {
    const label = warnOnly ? "⚠ role-distinctness" : "✖ role-distinctness gate FAILED";
    console.error(`\n${label} (${violations.length}):`);
    for (const v of violations) {
      if (v.kind === "not-declared") {
        console.error(
          `  ${v.theme}: ${v.a} is not declared in the ${v.theme} block — the gate cannot ` +
            `measure it here and refuses to fall back to :root's value. Either the theme is ` +
            `genuinely missing the token (theme-parity:check should also be red), or this ` +
            `gate's parse lost it (a comment swallowing the declaration — the #385 defect).`,
        );
        continue;
      }
      if (v.kind === "unresolved") {
        console.error(
          `  ${v.theme}: ${v.a} / ${v.b} — could not resolve one side to an oklch() literal ` +
            `(${v.valueA ?? "?"} / ${v.valueB ?? "?"}); the pair is unmeasurable.`,
        );
        continue;
      }
      console.error(
        `  ${v.theme}: ${v.a} ≈ ${v.b} — ΔE(OKLab) ${v.deltaE.toFixed(4)} ` +
          `< ${ROLE_SEPARATION_DELTA_E} (${v.valueA} vs ${v.valueB})`,
      );
    }
    console.error(
      `\nTwo semantic roles that can appear on screen together have collapsed onto\n` +
        `one colour, so the distinction they carry is gone. Fix it by retuning ONE\n` +
        `side in packages/tokens/tokens/themes/<theme>.tokens.json and re-running\n` +
        `\`pnpm --filter @elabs/components-tokens tokens:build\`.\n\n` +
        `If the equality is genuinely BY DESIGN, add it to EXEMPTIONS in\n` +
        `scripts/check-role-distinctness.mjs WITH the decision that justifies it\n` +
        `(the rule for what qualifies is documented beside that list).\n` +
        `Renaming one side to \`var(--other)\` does NOT satisfy this gate — an\n` +
        `alias is resolved before comparison. See GitHub issue #385.`,
    );
    if (!warnOnly) process.exit(1);
    return;
  }

  if (!warnOnly) {
    const pairs = MUST_DIFFER.length * THEME_NAMES.length - EXEMPTIONS.size;
    console.log(
      `✔ role-distinctness: ${pairs} role pairs across ${THEME_NAMES.length} themes ` +
        `are separated by ≥ ${ROLE_SEPARATION_DELTA_E} ΔE(OKLab)` +
        (EXEMPTIONS.size ? ` (${EXEMPTIONS.size} documented exemption(s)).` : "."),
    );
  }
}

// Run only as a CLI (not when imported by the test).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv);
}
