#!/usr/bin/env node
/**
 * check-decoration-collapse.mjs — a role-fill collapse must ship a
 * compensating non-colour channel (#391).
 *
 * A rule in `packages/tokens/src/decoration.css` that collapses ≥2
 * role-distinct fill utilities
 * (`bg-primary`/`bg-secondary`/`bg-destructive`/`bg-success`/`bg-warning`/
 * `bg-info` — the same roles `themes-contrast.test.ts`'s `ROLE_PAIRS` gate
 * requires to stay distinct at the TOKEN layer) to ONE identical declaration
 * set at high decoration leaves NOTHING encoding the roles apart once it
 * fires, unless a real `[data-status]` line-type channel (≥2 distinct status
 * values) exists in the same decoration scope.
 *
 * The `[data-polarity]` glyph (#162) deliberately does NOT count as a
 * compensator here — it answers a different favorable/unfavorable collapse and
 * predates #391, so accepting it would make this gate vacuously green on the
 * very file the issue reports.
 *
 * THE SHIPPED STYLESHEET NO LONGER COLLAPSES ANYTHING. The decoration dial
 * paints BACKGROUNDS only and never re-inks a control, so this gate is now a
 * guard against reintroducing the drawn-not-filled override rather than a check
 * on a live compensation. Its self-test keeps both arms exercised on fixtures.
 *
 * `themes-contrast.test.ts` cannot see this: it asserts a property of the
 * TOKEN, not of what `decoration.css` does to it downstream — a green
 * token-layer gate coexisted with pixel-identical rendering (#391, root cause
 * 1). This gate asserts the missing invariant at the layer that actually
 * paints.
 *
 * Pure functions are exported for the self-test
 * (`check-decoration-collapse.test.mjs`).
 *
 * Flags:
 *   --warn   never exit non-zero (dev-hook mode); still prints findings.
 *
 * Dependency-free; ESM; locates the CSS relative to this file (cwd-independent).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ruleBlocks, stripComments } from "./check-decoration-css.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR); // scripts/ → repo root
export const DECORATION_CSS = join(REPO_ROOT, "packages", "tokens", "src", "decoration.css");

/**
 * The role-distinct fill utilities `decoration.css`'s drawn-controls rule
 * collapses — mirrors `themes-contrast.test.ts`'s `ROLE_PAIRS` role set (and
 * #385's future `MUST_DIFFER`, per the issue's own framing).
 */
export const ROLE_FILL_CLASSES = [
  ".bg-primary",
  ".bg-secondary",
  ".bg-destructive",
  ".bg-success",
  ".bg-warning",
  ".bg-info",
];

/** A high-decoration scope wrapper — the collapse only matters where it
 * actually fires (1–7 is the gentle, non-binary ramp). */
const SCOPE_RE = /\[data-decoration="(?:8|9|10)"\]/;

/**
 * Declarations whose IDENTICAL value across ≥2 role utilities erases the
 * role distinction a sighted user could read. `background-image` (the hatch)
 * is deliberately excluded — it is the COMPENSATING channel's own vocabulary,
 * not a collapsing one.
 */
const COLLAPSING_PROPS = ["background-color", "border", "border-color", "color"];

/**
 * Rules whose selector scopes to high decoration AND lists ≥2 of
 * the role-fill classes AND sets ≥1 collapsing declaration.
 * @param {string} rawCss
 * @returns {{ selector: string, roles: string[], props: string[] }[]}
 */
export function findRoleCollapses(rawCss) {
  const css = stripComments(rawCss);
  const collapses = [];
  for (const rule of ruleBlocks(css)) {
    if (!SCOPE_RE.test(rule.selector)) continue;
    const roles = ROLE_FILL_CLASSES.filter((cls) => rule.selector.includes(cls));
    if (roles.length < 2) continue;
    const props = COLLAPSING_PROPS.filter((prop) =>
      new RegExp(`(?:^|[^-\\w])${prop}\\s*:`).test(rule.body),
    );
    if (props.length === 0) continue;
    collapses.push({ selector: rule.selector.trim().replace(/\s+/g, " "), roles, props });
  }
  return collapses;
}

/**
 * Is there a REAL `[data-status="…"]` non-colour channel — ≥2 DISTINCT status
 * values, each in its own rule scoped to high decoration?
 *
 * Deliberately does NOT accept `[data-polarity]` as a stand-in: polarity
 * compensates a different collapse (the lightness ramp / favorable-unfavorable
 * glyph, #162) and predates #391 in `decoration.css` — accepting it here would
 * make this gate vacuously green on the PRE-FIX file (polarity already
 * existed, `[data-status]` did not), exactly the "gate that never fires"
 * failure mode `.claude/rules/quality-gates.md` warns about. A single stray
 * `[data-status]` hook is also not enough (≥2 distinct values is the signal
 * that a real per-role channel exists, not an incidental one-off selector).
 * @param {string} rawCss
 * @returns {boolean}
 */
export function hasCompensatingRule(rawCss) {
  const css = stripComments(rawCss);
  const values = new Set();
  for (const rule of ruleBlocks(css)) {
    if (!SCOPE_RE.test(rule.selector)) continue;
    for (const m of rule.selector.matchAll(/\[data-status="([^"]+)"\]/g)) {
      values.add(m[1]);
    }
  }
  return values.size >= 2;
}

// ───────────────────────────────── CLI ────────────────────────────────────────
function main(argv) {
  const warnOnly = argv.includes("--warn");
  const css = readFileSync(DECORATION_CSS, "utf8");
  const collapses = findRoleCollapses(css);

  if (collapses.length === 0) {
    console.log("✔ decoration-collapse: no role-fill collapse found in decoration.css.");
    return 0;
  }

  if (hasCompensatingRule(css)) {
    console.log(
      `✔ decoration-collapse: ${collapses.length} role-fill collapse rule(s) found, compensated by a real [data-status] non-colour channel in the same scope.`,
    );
    return 0;
  }

  console.error("✖ decoration-collapse gate FAILED (#391):");
  for (const c of collapses) {
    console.error(
      `  \`${c.selector}\` collapses ${c.roles.join(", ")} to one appearance (${c.props.join("/")}) — no compensating [data-status] rule (≥2 distinct values) exists in the same high decoration scope`,
    );
  }
  console.error(
    '  Fix: add ≥2 [data-status="…"] rules (line type / hatch density) in the same scope, or the six role fills read as one colour at high decoration. [data-polarity] does not count — it answers a different collapse.',
  );
  return warnOnly ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
