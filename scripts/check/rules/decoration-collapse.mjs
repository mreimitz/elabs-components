/**
 * decoration-collapse — a role-fill collapse must ship a non-colour channel (#391).
 *
 * A `decoration.css` rule scoped to high decoration (`[data-decoration="8|9|10"]`)
 * that lists ≥2 role fills (`.bg-primary`/`-secondary`/`-destructive`/`-success`/
 * `-warning`/`-info`) and sets a collapsing declaration (`background-color`,
 * `border`, `border-color`, `color`) renders those roles identically once it fires.
 * That is only acceptable when a real `[data-status="…"]` channel (≥2 distinct
 * values, same scope) compensates. `[data-polarity]` does NOT count — it answers a
 * different collapse (#162) and would make the gate vacuously green.
 * `themes-contrast.test.ts` cannot see this: it tests the token, not what
 * decoration.css does to it downstream. The shipped stylesheet collapses nothing;
 * this guards against reintroducing the drawn-not-filled override.
 */
import { lineOf } from "../context.mjs";
import { ruleBlocks } from "../lib/css.mjs";

const DECORATION = "packages/tokens/src/decoration.css";
export const ROLE_FILL_CLASSES = [
  ".bg-primary",
  ".bg-secondary",
  ".bg-destructive",
  ".bg-success",
  ".bg-warning",
  ".bg-info",
];
const SCOPE_RE = /\[data-decoration="(?:8|9|10)"\]/;
const COLLAPSING_PROPS = ["background-color", "border", "border-color", "color"];

export function findRoleCollapses(css) {
  const out = [];
  for (const rule of ruleBlocks(css)) {
    if (!SCOPE_RE.test(rule.selector)) continue;
    const roles = ROLE_FILL_CLASSES.filter((cls) => rule.selector.includes(cls));
    if (roles.length < 2) continue;
    const props = COLLAPSING_PROPS.filter((p) =>
      new RegExp(`(?:^|[^-\\w])${p}\\s*:`).test(rule.body),
    );
    if (props.length === 0) continue;
    out.push({
      start: rule.start,
      selector: rule.selector.trim().replace(/\s+/g, " "),
      roles,
      props,
    });
  }
  return out;
}

export function hasCompensatingRule(css) {
  const values = new Set();
  for (const rule of ruleBlocks(css)) {
    if (!SCOPE_RE.test(rule.selector)) continue;
    for (const m of rule.selector.matchAll(/\[data-status="([^"]+)"\]/g)) values.add(m[1]);
  }
  return values.size >= 2;
}

// ── fixtures ─────────────────────────────────────────────────────────────────
const SCOPE = `:is([data-decoration="8"], [data-decoration="9"], [data-decoration="10"])`;
const COLLAPSE = `  ${SCOPE}\n    :is(.bg-primary, .bg-secondary, .bg-destructive, .bg-success, .bg-warning, .bg-info) {\n    background-color: transparent;\n    background-image: var(--deco-hatch);\n    color: var(--foreground);\n    border: 1px solid var(--rule-strong);\n  }\n`;
const status = (v, style) =>
  `  ${SCOPE}\n    [data-status="${v}"] {\n    border-style: ${style};\n  }\n`;
const layer = (...parts) => ({
  files: { [DECORATION]: `@layer utilities {\n${parts.join("")}}\n` },
});

export default {
  id: "decoration-collapse",
  scope: "themes",
  doc: "Never let a high-decoration rule in decoration.css collapse two or more role fills (`.bg-primary`, `.bg-success`, …) to one appearance without a compensating `[data-status]` channel (≥2 values, same scope).",
  baseline: "none",
  run(ctx) {
    const css = ctx.readFile(DECORATION);
    const collapses = findRoleCollapses(css);
    if (collapses.length === 0 || hasCompensatingRule(css)) return [];
    return collapses.map((c) => ({
      file: DECORATION,
      line: lineOf(css, c.start),
      msg: `\`${c.selector}\` collapses ${c.roles.join(", ")} to one appearance (${c.props.join("/")}) with no [data-status] channel (≥2 values) in the same scope — [data-polarity] does not count`,
    }));
  },
  fixtures: {
    pass: [
      layer(`  :is([data-decoration="8"]) :is(.bg-primary) { background-color: transparent; }\n`),
      layer(`  .bg-primary, .bg-secondary { background-color: red; }\n`),
      layer(
        `  ${SCOPE} :is(.bg-primary, .bg-secondary) { background-image: var(--deco-hatch); }\n`,
      ),
      layer(COLLAPSE, status("running", "dashed"), status("complete", "solid")),
      { files: { [DECORATION]: `/* ${SCOPE} .bg-primary, .bg-secondary { color: red; } */\n` } },
    ],
    fail: [
      layer(COLLAPSE),
      layer(COLLAPSE, status("running", "dashed")),
      layer(
        COLLAPSE,
        `  ${SCOPE}\n    [data-polarity="good"]::before {\n    content: "● ";\n  }\n`,
      ),
      layer(
        COLLAPSE,
        `  [data-status="running"] { border-style: dashed; }\n  [data-status="complete"] { border-style: solid; }\n`,
      ),
    ],
  },
};
