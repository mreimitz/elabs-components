/**
 * decoration-css — the decoration-overlay CSS contract (#29, #257).
 *
 *   1. TOUCH GATING (#29 item 3). `background-attachment: fixed` (one continuous
 *      ground sheet) repaints the viewport on every touch-scroll frame, so it may
 *      only live inside `@media (hover: hover) and (pointer: fine)`.
 *   2. THE GROUND FADE PAINTS A LAYER, NEVER THE HOST (#257). `[data-decoration-fade]`
 *      masks an inert `::before` layer that paints `var(--deco-grid)`; masking the
 *      host fades its text and controls too. The plain-grid rule must exclude the
 *      faded host AND its descendants (else ruled twice), and every `--deco-fade-*`
 *      the CSS consumes must be declared in themes.css.
 *   3. RELATIVE-COLOR FALLBACK (#29 item 2). `oklch(from …)` inks in themes.css need
 *      an `@supports not (color: oklch(from …))` fallback for below-floor browsers.
 */
import { lineOf } from "../context.mjs";
import { blankComments, ruleBlocks } from "../lib/css.mjs";

const DECORATION = "packages/tokens/src/decoration.css";
const THEMES = "packages/tokens/src/themes.css";
const POINTER_MEDIA_RE = /@media[^{]*\(\s*hover\s*:\s*hover\s*\)[^{]*\(\s*pointer\s*:\s*fine\s*\)/g;

function pointerMediaRanges(css) {
  const ranges = [];
  for (const m of css.matchAll(POINTER_MEDIA_RE)) {
    const open = css.indexOf("{", m.index + m[0].length - 1);
    if (open === -1) continue;
    let depth = 0;
    let i = open;
    for (; i < css.length; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}" && --depth === 0) break;
    }
    ranges.push({ start: m.index, end: i });
  }
  return ranges;
}

/** `background-attachment: fixed` outside a pointer-device media query → `[{ line }]`. */
export function findUngatedFixedAttachment(rawCss) {
  const css = blankComments(rawCss);
  const ranges = pointerMediaRanges(css);
  return [...css.matchAll(/background-attachment\s*:\s*fixed/g)]
    .filter((m) => !ranges.some((r) => m.index > r.start && m.index < r.end))
    .map((m) => ({ line: lineOf(css, m.index) }));
}

/** `:not(…)` arguments, whitespace-normalised so a prettier wrap cannot defeat a match. */
function notArguments(selector) {
  const out = [];
  for (const m of selector.matchAll(/:not\(([^)]*)\)/gs))
    for (const arg of (m[1] ?? "").split(",")) {
      const n = arg.trim().replace(/\s+/g, " ");
      if (n) out.push(n);
    }
  return out;
}

/** Fade-hook violations → `[{ line, msg }]`. */
export function findFadeViolations(decorationCss, themesCss) {
  if (!/\[data-decoration-fade/.test(decorationCss)) return [];
  const out = [];
  const rules = ruleBlocks(decorationCss);
  const at = (r) => lineOf(decorationCss, r?.start ?? 0);
  const fadeRules = rules.filter((r) => r.selector.includes("[data-decoration-fade"));

  for (const r of fadeRules) {
    if (!/(?:^|[^-])mask-image\s*:/.test(r.body)) continue;
    if (!r.selector.includes("::before") && !r.selector.includes("::after"))
      out.push({
        line: at(r),
        msg: `mask-on-host: \`${r.selector.trim()}\` sets mask-image on the HOST — that masks its children too; mask a ::before layer`,
      });
  }

  const painter = fadeRules
    .filter((r) => r.selector.includes("::before"))
    .find((r) => /background-image\s*:\s*var\(--deco-grid\)/.test(r.body));
  if (!painter)
    out.push({
      line: 1,
      msg: "no-layer: no `[data-decoration-fade]…::before` rule paints `var(--deco-grid)` — the fade has nothing to show",
    });
  else if (!/pointer-events\s*:\s*none/.test(painter.body))
    out.push({
      line: at(painter),
      msg: "layer-not-inert: the `[data-decoration-fade]::before` layer must set `pointer-events: none`",
    });

  const plainGrid = rules.find(
    (r) =>
      r.selector.includes(".bg-background") &&
      /background-image\s*:\s*var\(--deco-grid\)/.test(r.body) &&
      !r.selector.includes("::before"),
  );
  if (plainGrid) {
    const excluded = notArguments(plainGrid.selector);
    for (const [needle, why] of [
      ["[data-decoration-fade]", "a faded region would be ruled twice (crisp + faded)"],
      [
        "[data-decoration-fade] *",
        "a nested surface inside a faded region re-rules it at full strength",
      ],
    ])
      if (!excluded.includes(needle))
        out.push({
          line: at(plainGrid),
          msg: `double-grid: the plain-grid surface rule must exclude \`${needle}\` — otherwise ${why}`,
        });
  }

  const consumed = new Set(
    [...decorationCss.matchAll(/var\((--deco-fade[\w-]*)\)/g)].map((m) => m[1]),
  );
  for (const name of [...consumed].sort())
    if (!new RegExp(`${name}\\s*:`).test(themesCss))
      out.push({
        line: lineOf(decorationCss, decorationCss.indexOf(`var(${name})`)),
        msg: `undefined-fade-var: decoration.css consumes ${name} but themes.css never declares it`,
      });
  return out;
}

export function hasRelativeColorFallback(themesCss) {
  if (!/oklch\(\s*from\s/.test(themesCss)) return true;
  return /@supports\s+not\s*\(\s*color\s*:\s*oklch\(\s*from\s/.test(themesCss);
}

// ── fixtures ─────────────────────────────────────────────────────────────────
const GATED = `@layer base {\n  @media (hover: hover) and (pointer: fine) {\n    body { background-attachment: fixed; }\n  }\n}\n`;
const THEMES_OK = `:root {\n  --deco-fade-top: linear-gradient(to bottom, transparent 0%, black 45%);\n  --deco-fade: var(--deco-fade-top);\n}\n`;
const FADE_OK = `@layer base {
  :is([data-decoration]) :is(.bg-background, .bg-card):not(
      [role="dialog"],
      [data-decoration-fade],
      [data-decoration-fade] *
    ) {
    background-image: var(--deco-grid);
  }
  [data-decoration-fade] { position: relative; isolation: isolate; }
  [data-decoration-fade]::before {
    content: "";
    pointer-events: none;
    background-image: var(--deco-grid);
    mask-image: var(--deco-fade);
  }
}
`;
const tree = (decoration, themes = THEMES_OK) => ({
  files: { [DECORATION]: decoration, [THEMES]: themes },
});

export default {
  id: "decoration-css",
  scope: "themes",
  doc: "Keep `background-attachment: fixed` inside `@media (hover: hover) and (pointer: fine)`; mask the `[data-decoration-fade]` fade on an inert `::before` layer, never the host; give `oklch(from …)` inks an `@supports not` fallback.",
  baseline: "none",
  run(ctx) {
    const decoration = ctx.readFile(DECORATION);
    const themes = ctx.readFile(THEMES);
    const findings = [
      ...findUngatedFixedAttachment(decoration).map(({ line }) => ({
        file: DECORATION,
        line,
        msg: "`background-attachment: fixed` outside `@media (hover: hover) and (pointer: fine)` (touch-scroll jank, #29)",
      })),
      ...findFadeViolations(decoration, themes).map((v) => ({ file: DECORATION, ...v })),
    ];
    if (!hasRelativeColorFallback(themes))
      findings.push({
        file: THEMES,
        line: lineOf(themes, themes.search(/oklch\(\s*from\s/)),
        msg: "no-relative-color-fallback: `oklch(from …)` without an `@supports not (color: oklch(from …))` fallback (docs/BROWSER-SUPPORT.md, #29)",
      });
    return findings;
  },
  fixtures: {
    pass: [
      tree(GATED),
      tree(`/* do not re-add background-attachment: fixed here */\n${GATED}`),
      tree(FADE_OK),
      tree(FADE_OK.replace("[data-decoration-fade] *", "[data-decoration-fade]\n      *")),
      tree(GATED, `:root { --x: oklch(0.5 0 0); }\n`),
      tree(
        GATED,
        `:root { --ink: oklch(from var(--foreground) l c h / 0.1); }\n@supports not (color: oklch(from red l c h)) { :root { --ink: transparent; } }\n`,
      ),
    ],
    fail: [
      tree(
        `@layer base { body { background-image: var(--deco-grid); background-attachment: fixed; } }`,
      ),
      tree(`@media (hover: hover) { body { background-attachment: fixed; } }`),
      tree(
        FADE_OK.replace(
          "[data-decoration-fade] { position: relative; isolation: isolate; }",
          "[data-decoration-fade] { mask-image: var(--deco-fade); }",
        ),
      ),
      tree(FADE_OK.replace("pointer-events: none;", "")),
      tree(FADE_OK.replace("      [data-decoration-fade],\n", "")),
      tree(FADE_OK.replace(",\n      [data-decoration-fade] *", "")),
      tree(FADE_OK.replace("var(--deco-fade)", "var(--deco-fade-nowhere)")),
      tree(GATED, `:root { --ink: oklch(from var(--foreground) l c h / 0.1); }\n`),
    ],
  },
};
