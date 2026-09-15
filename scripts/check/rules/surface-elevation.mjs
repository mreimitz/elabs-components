/**
 * surface-elevation — app chrome stays recessed below the content canvas.
 *
 * Every color block (`:root` + the first block per `[data-theme]`) keeps
 * `L(--background) − L(--sidebar) ≥ 0.02` (oklch L) and `L(--card) ≥ L(--background)`.
 * Direction-agnostic: in light AND dark themes the canvas is lighter than the chrome.
 * Without it an app shell reads flat (a past regression set `--sidebar` equal to
 * `--background`). Blocks lacking `--sidebar`/`--background` are skipped (parity's job).
 * Reads every theme file through the complete theme set — a split that shrinks the set
 * fails loudly instead of auditing `:root` alone.
 */
import { themeFixture, themeSet } from "../lib/themes.mjs";

export const MIN_CHROME_CANVAS_DELTA = 0.02;

const oklchL = (body, token) => {
  const m = body.match(new RegExp(`${token}\\s*:\\s*oklch\\(\\s*([0-9.]+)`));
  return m ? Number.parseFloat(m[1]) : null;
};

/** `[{ selector, index, body }]` — `:root` + first block per theme name. */
function colorBlocks(css) {
  const blocks = [];
  const root = css.match(/:root\s*\{([\s\S]*?)\n\}/);
  if (root) blocks.push({ selector: ":root", index: root.index, body: root[1] });
  const seen = new Set();
  for (const m of css.matchAll(/\[data-theme="([^"]+)"\]\s*\{([\s\S]*?)\n\}/g)) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    blocks.push({ selector: `[data-theme="${m[1]}"]`, index: m.index, body: m[2] });
  }
  return blocks;
}

export function findElevationViolations(css) {
  const out = [];
  for (const { selector, index, body } of colorBlocks(css)) {
    const sidebar = oklchL(body, "--sidebar");
    const background = oklchL(body, "--background");
    if (sidebar == null || background == null) continue;
    const delta = Number((background - sidebar).toFixed(4));
    if (delta < MIN_CHROME_CANVAS_DELTA)
      out.push({
        index,
        msg: `${selector} chrome-below-canvas: --background L ${background} − --sidebar L ${sidebar} = ${delta} < ${MIN_CHROME_CANVAS_DELTA} — lower --sidebar so content reads brighter`,
      });
    const card = oklchL(body, "--card");
    if (card != null && card < background - 0.001)
      out.push({
        index,
        msg: `${selector} raised-not-below-canvas: --card L ${card} < --background L ${background}`,
      });
  }
  return out;
}

const body = ({ sidebar, background, card }) =>
  [
    `  --background: oklch(${background} 0 0);`,
    `  --sidebar: oklch(${sidebar} 0 0);`,
    card != null ? `  --card: oklch(${card} 0 0);` : "",
  ].join("\n");
const ok = body({ sidebar: 0.96, background: 0.985, card: 1 });
const withDark = (dark) => themeFixture({ root: ok, themes: { dark: body(dark) } });

export default {
  id: "surface-elevation",
  scope: "themes",
  doc: "Keep app chrome recessed below the canvas in every theme: `L(--background) − L(--sidebar) ≥ 0.02` and `--card` never below `--background` — fix flatness in the theme's `--sidebar`, never in components.",
  baseline: "none",
  run(ctx) {
    let set;
    try {
      set = themeSet(ctx);
    } catch (err) {
      return [{ file: "packages/tokens/src/themes.css", line: 1, msg: err.message }];
    }
    return findElevationViolations(set.css).map(({ index, msg }) => ({
      ...set.locate(index),
      msg,
    }));
  },
  fixtures: {
    pass: [
      themeFixture({ root: ok }),
      withDark({ sidebar: 0.17, background: 0.2, card: 0.24 }),
      themeFixture({ root: ok, themes: { dark: "  --decoration: 10;\n  --deco-hatch: red;" } }),
    ],
    fail: [
      withDark({ sidebar: 0.985, background: 0.985, card: 1 }),
      withDark({ sidebar: 0.99, background: 0.97, card: 1 }),
      withDark({ sidebar: 0.978, background: 0.984, card: 1 }),
      withDark({ sidebar: 0.95, background: 0.985, card: 0.97 }),
    ],
  },
};
