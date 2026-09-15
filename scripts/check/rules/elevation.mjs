/**
 * elevation — the stacked-elevation contract (ADR 0020).
 *
 * One ramp of token-inked shadows lives in themes.css § ELEVATION RAMP, dialled by
 * `--shadow-color` / `--shadow-strength` / `--shadow-ring-color`. Four things can
 * silently undo it:
 *   1. RAMP INTEGRITY — `--shadow-ring-<size>` must be exactly `--shadow-<size>` plus
 *      the hairline layer; `--shadow-hairline` is that layer alone.
 *   2. TOKENED INK — every `--elevation-ink-N` mixes `var(--shadow-color)` scaled by
 *      `var(--shadow-strength)`; no literal color in any rung.
 *   3. SHADOWLESS DIAL — `--shadow-strength: 0` in decoration.css stays UNLAYERED and
 *      keeps its doubled `[data-decoration]` specificity, or the document-level dial
 *      loses to the unlayered theme block on the root.
 *   4. COMPONENT DISCIPLINE — no raw `box-shadow`/`boxShadow`, no arbitrary
 *      `shadow-[…]`, no `border` + floating rung (`shadow-md`+) in one class string.
 *      `shadow-sm`/`xs` + border is the resting-surface pattern; `hover:shadow-md` is
 *      a lift. Escape hatch: `elevation-check-ignore -- <reason>` on the line or the
 *      line above (reported as advisory). `registry/` is warn-only.
 */
import { lineOf } from "../context.mjs";
import { blankComments, blankJsComments } from "../lib/css.mjs";

const THEMES = "packages/tokens/src/themes.css";
const DECORATION = "packages/tokens/src/decoration.css";
export const SIZES = ["2xs", "xs", "sm", "md", "lg", "xl", "2xl"];
const FLOATING_SIZES = ["md", "lg", "xl", "2xl"];
export const HAIRLINE_LAYER = "0 0 0 1px var(--shadow-ring-color)";
const norm = (s) => s.replace(/\s+/g, " ").trim();

/** All `--name: value;` declarations (last wins) → Map name → { value, index }. */
function declarations(cssText) {
  const out = new Map();
  for (const m of blankComments(cssText).matchAll(/(--[\w-]+)\s*:\s*([^;}]+);/g))
    out.set(m[1], { value: norm(m[2]), index: m.index });
  return out;
}

/** Ramp contract (1) + (2) → `[{ index, msg }]`. */
export function checkRamp(css) {
  const out = [];
  const decls = declarations(css);
  const get = (k) => decls.get(k)?.value;
  const at = (k) => decls.get(k)?.index ?? 0;

  for (let n = 1; n <= 7; n++) {
    const ink = get(`--elevation-ink-${n}`);
    if (!ink) out.push({ index: 0, msg: `missing --elevation-ink-${n} (the ${n}% depth rung)` });
    else if (!ink.includes("var(--shadow-color)") || !ink.includes("var(--shadow-strength)"))
      out.push({
        index: at(`--elevation-ink-${n}`),
        msg: `--elevation-ink-${n} must mix var(--shadow-color) scaled by var(--shadow-strength) — got: ${ink}`,
      });
  }
  for (const size of SIZES) {
    const plain = get(`--shadow-${size}`);
    const ring = get(`--shadow-ring-${size}`);
    if (!plain) out.push({ index: 0, msg: `missing --shadow-${size}` });
    if (!ring) out.push({ index: 0, msg: `missing --shadow-ring-${size}` });
    if (plain && ring && ring !== `${plain}, ${HAIRLINE_LAYER}`)
      out.push({
        index: at(`--shadow-ring-${size}`),
        msg: `--shadow-ring-${size} must be --shadow-${size} plus the hairline (expected: ${plain}, ${HAIRLINE_LAYER} · actual: ${ring})`,
      });
  }
  const hairline = get("--shadow-hairline");
  if (!hairline) out.push({ index: 0, msg: "missing --shadow-hairline (the ring layer alone)" });
  else if (hairline !== HAIRLINE_LAYER)
    out.push({
      index: at("--shadow-hairline"),
      msg: `--shadow-hairline must be exactly \`${HAIRLINE_LAYER}\``,
    });

  for (const size of SIZES)
    for (const key of [`--shadow-${size}`, `--shadow-ring-${size}`]) {
      const literal = get(key)?.match(
        /\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\s*\(|#[0-9a-f]{3,8}\b/i,
      );
      if (literal)
        out.push({
          index: at(key),
          msg: `${key} carries a literal color (\`${literal[0]}\`) — every layer's ink must be a var(--elevation-ink-N)`,
        });
    }
  return out;
}

/** Shadowless-dial cascade contract (3) → `[{ index, msg }]`. */
export function checkShadowlessDial(raw) {
  const css = blankComments(raw);
  const layered = [];
  for (const m of css.matchAll(/@layer[^{;]*\{/g)) {
    let depth = 0;
    let i = m.index;
    for (; i < css.length; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}" && --depth === 0) break;
    }
    layered.push([m.index, i]);
  }
  const hits = [...css.matchAll(/--shadow-strength\s*:\s*0\s*;/g)];
  if (hits.length === 0)
    return [
      {
        index: 0,
        msg: "no `--shadow-strength: 0` rule — high decoration (≥8) is no longer shadowless",
      },
    ];
  const unlayered = hits.filter((h) => !layered.some(([a, b]) => h.index > a && h.index < b));
  if (unlayered.length === 0)
    return [
      {
        index: hits[0].index,
        msg: "the `--shadow-strength: 0` rule is inside an @layer — it loses to the unlayered theme block on the document root; move it out of the layer",
      },
    ];
  const before = css.slice(0, unlayered[0].index);
  const selector = before.slice(before.lastIndexOf("}") + 1);
  if (!/\[data-decoration="(?:8|9|10)"\][\s\S]*\)\[data-decoration\]/.test(norm(selector)))
    return [
      {
        index: unlayered[0].index,
        msg: 'the `--shadow-strength: 0` selector lost its doubled `[data-decoration]` — keep the `:is([data-decoration="8"], …)[data-decoration]` form',
      },
    ];
  return [];
}

const STRING_LITERAL_RE = /"[^"\n]*"|'[^'\n]*'|`[^`\n]*`/g;
const IGNORE_RE = /elevation-check-ignore\s*--\s*\S/;
const base = (t) => t.replace(/^.*:/, "").replace(/^!/, "").replace(/!$/, "");

export function classStringDoubleEdge(classString) {
  const tokens = classString.split(/\s+/).filter(Boolean);
  const border = tokens.some((t) => ["border", "border-border", "ring-1"].includes(base(t)));
  const floating = tokens.some(
    (t) => !t.includes(":") && FLOATING_SIZES.some((s) => base(t) === `shadow-${s}`),
  );
  return border && floating;
}

/** Component findings in one file → `[{ line, msg, ignored }]`. */
export function checkSource(text) {
  const out = [];
  const code = blankJsComments(text);
  const rawLines = text.split("\n");
  const push = (index, msg) => {
    const line = lineOf(text, index);
    const ignored =
      IGNORE_RE.test(rawLines[line - 1] ?? "") || IGNORE_RE.test(rawLines[line - 2] ?? "");
    out.push({ line, msg, ignored });
  };
  for (const m of code.matchAll(/\bbox-shadow\s*:|\bboxShadow\s*:/g))
    push(
      m.index,
      "raw box-shadow — use a `shadow-*` / `shadow-ring-*` rung (or `shadow-hairline`)",
    );
  for (const m of code.matchAll(STRING_LITERAL_RE)) {
    const inner = m[0].slice(1, -1);
    for (const token of inner.split(/\s+/))
      if (/(^|:)!?shadow-\[/.test(token))
        push(
          m.index,
          `arbitrary shadow \`${token}\` — use a ramp rung; retint a hairline with \`shadow-hairline [--shadow-ring-color:var(--token)]\``,
        );
    if (classStringDoubleEdge(inner))
      push(
        m.index,
        `\`border\` + a floating \`shadow-*\` rung in one class string draws two edges — drop the border, use \`shadow-ring-*\`: ${norm(inner).slice(0, 100)}`,
      );
  }
  return out;
}

const SOURCE_IGNORE = [
  "**/*.test.{ts,tsx}",
  "**/{node_modules,dist,storybook-static,.turbo,coverage,__output}/**",
];

function scan(ctx, patterns, warn) {
  return ctx.glob(patterns, { ignore: SOURCE_IGNORE }).flatMap((file) =>
    checkSource(ctx.readFile(file)).map(({ line, msg, ignored }) => ({
      file,
      line,
      msg: ignored ? `suppressed by elevation-check-ignore: ${msg}` : msg,
      ...(warn || ignored ? { warn: true } : {}),
    })),
  );
}

// ── fixtures ─────────────────────────────────────────────────────────────────
function goodRamp() {
  let css = "@theme {\n";
  for (let n = 1; n <= 7; n++)
    css += `  --elevation-ink-${n}: color-mix(in srgb, var(--shadow-color) calc(${n}% * var(--shadow-strength)), transparent);\n`;
  for (const size of SIZES) {
    css += `  --shadow-${size}: 0 1px 2px 0 var(--elevation-ink-2);\n`;
    css += `  --shadow-ring-${size}: 0 1px 2px 0 var(--elevation-ink-2), ${HAIRLINE_LAYER};\n`;
  }
  return `${css}  --shadow-hairline: ${HAIRLINE_LAYER};\n}\n`;
}
const DIAL = `:is([data-decoration="8"], [data-decoration="9"], [data-decoration="10"])[data-decoration] {\n  --shadow-strength: 0;\n  --shadow-ring-color: var(--rule);\n}\n@layer base {\n  body { color: red; }\n}\n`;
const tree = ({ themes = goodRamp(), decoration = DIAL, src } = {}) => ({
  files: {
    [THEMES]: themes,
    [DECORATION]: decoration,
    ...(src ? { "packages/ui/src/x.tsx": src } : {}),
  },
});
const ringMd = `--shadow-ring-md: 0 1px 2px 0 var(--elevation-ink-2), ${HAIRLINE_LAYER};`;

export default {
  id: "elevation",
  scope: "themes",
  doc: "Use the one elevation ramp: `shadow-*` for resting surfaces, `shadow-ring-*` (no border) for floating ones, `shadow-hairline` for a bare edge — never a raw `box-shadow`, an arbitrary `shadow-[…]`, or `border` + `shadow-md`+ in one class string.",
  baseline: "none",
  run(ctx) {
    const themes = ctx.readFile(THEMES);
    const decoration = ctx.readFile(DECORATION);
    return [
      ...checkRamp(themes).map(({ index, msg }) => ({
        file: THEMES,
        line: lineOf(themes, index),
        msg,
      })),
      ...checkShadowlessDial(decoration).map(({ index, msg }) => ({
        file: DECORATION,
        line: lineOf(decoration, index),
        msg,
      })),
      ...scan(ctx, ["packages/*/src/**/*.{ts,tsx}", "apps/*/{src,stories}/**/*.{ts,tsx}"], false),
      ...scan(ctx, "registry/**/*.{ts,tsx}", true),
    ];
  },
  fixtures: {
    pass: [
      tree(),
      tree({
        decoration: `/* Do not move this into @layer base — it would lose the cascade. */\n${DIAL}`,
      }),
      tree({
        themes: goodRamp().replace(
          "@theme {\n",
          "@theme {\n  /* retint with [--shadow-ring-color:var(--x)]; see the rule. */\n",
        ),
      }),
      tree({ src: 'cn("rounded-lg border bg-card shadow-sm")' }),
      tree({ src: 'cn("rounded-md border border-input bg-background shadow-sm")' }),
      tree({ src: 'cn("rounded-lg border bg-card hover:shadow-md")' }),
      tree({ src: 'cn("rounded-md bg-popover shadow-ring-md")' }),
      tree({ src: "// never hand-roll boxShadow: use a rung\n" }),
      tree({
        src: '/* not shadow-[0_0_0_1px_…] */\ncn("shadow-hairline [--shadow-ring-color:var(--sidebar-border)]")',
      }),
      tree({ src: 'cn("transition-[color,box-shadow] shadow-sm")' }),
      tree({
        src: '{/* elevation-check-ignore -- the story shows the anti-pattern. */}\n<div className="rounded-lg border border-border bg-card shadow-md" />',
      }),
      { files: { ...tree().files, "packages/ui/src/x.test.tsx": 'cn("border shadow-md")' } },
      { files: { ...tree().files, "registry/blocks/a/a.tsx": 'cn("border shadow-md")' } },
    ],
    fail: [
      tree({
        themes: goodRamp().replace(
          ringMd,
          `--shadow-ring-md: 0 4px 9px 0 var(--elevation-ink-2), ${HAIRLINE_LAYER};`,
        ),
      }),
      tree({
        themes: goodRamp().replace(
          `--shadow-ring-lg: 0 1px 2px 0 var(--elevation-ink-2), ${HAIRLINE_LAYER};`,
          "--shadow-ring-lg: 0 1px 2px 0 var(--elevation-ink-2);",
        ),
      }),
      tree({
        themes: goodRamp().replace(
          "--shadow-lg: 0 1px 2px 0 var(--elevation-ink-2);",
          "--shadow-lg: 0 1px 2px 0 rgba(0, 0, 0, 0.1);",
        ),
      }),
      tree({
        themes: goodRamp().replace(
          /--elevation-ink-3: [^\n]*/,
          "--elevation-ink-3: oklch(0 0 0 / 0.03);",
        ),
      }),
      tree({ themes: goodRamp().replace(/ {2}--shadow-2xl:[^\n]*\n/, "") }),
      tree({ decoration: `@layer base {\n${DIAL}\n}` }),
      tree({ decoration: DIAL.replace(")[data-decoration] {", ") {") }),
      tree({ decoration: "@layer base { body { color: red; } }" }),
      tree({ src: 'cn("rounded-md border bg-popover shadow-md")' }),
      tree({ src: 'cn("rounded-md border-border bg-popover shadow-lg")' }),
      tree({ src: 'cn("rounded-md ring-1 shadow-xl")' }),
      tree({ src: 'const s = { boxShadow: "0 4px 8px #000" };' }),
      tree({ src: "a { box-shadow: 0 1px 2px red; }" }),
      tree({ src: 'cn("hover:shadow-[0_0_0_1px_var(--x)]")' }),
      tree({
        src: '{/* elevation-check-ignore */}\n<div className="rounded-lg border border-border bg-card shadow-md" />',
      }),
      tree({
        src: '{/* elevation-check-ignore -- reason */}\n<Spacer />\n<div className="rounded-lg border border-border bg-card shadow-md" />',
      }),
      { files: { ...tree().files, "apps/docs/stories/x.stories.tsx": 'cn("border shadow-md")' } },
    ],
  },
};
