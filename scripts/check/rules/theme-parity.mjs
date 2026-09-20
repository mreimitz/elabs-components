/**
 * theme-parity — every theme block defines every semantic token (#89).
 * Ported from scripts/check-theme-parity.mjs. A token declared in one block but
 * forgotten in another silently falls back to `:root` and renders wrong there.
 * Machinery declared only in `:root` (timing, decoration, radius, fonts) is exempt.
 */
import { THEMES_ENGINE_CSS, lineOf, themeCssPath } from "../context.mjs";

/** `:root` sentinel — not `light`, which is a real theme slug. */
const ROOT_MODE = "root";

/** Keys legitimately declared ONLY in :root (anchored so `--text-*` ≠ `--t-*`). */
export const ROOT_ONLY_RE =
  /^--(decoration($|-)|deco-|paper-|hairline-|duration-|t-|motion-|radius($|-)|font-)/;

const selectorOf = (name) => (name === ROOT_MODE ? ":root" : `[data-theme="${name}"]`);
const fileOf = (name) => (name === ROOT_MODE ? THEMES_ENGINE_CSS : themeCssPath(name));

/** FIRST block body for a theme (same regex as themes-contrast.test.ts), or null. */
function extractBlock(cssText, name) {
  const re =
    name === ROOT_MODE
      ? /:root\s*\{([\s\S]*?)\n\}/
      : new RegExp(`\\[data-theme="${name}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`);
  return cssText.match(re)?.[1] ?? null;
}

const tokenKeys = (body) => new Set([...body.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));

/** Pure: `[{ token, theme }]` for each (token, block) gap; `<block>` for a missing block. */
export function findParityViolations(cssText, themeNames) {
  const names = [ROOT_MODE, ...themeNames];
  const violations = [];
  const blocks = {};
  for (const name of names) {
    const body = extractBlock(cssText, name);
    if (body == null) violations.push({ token: "<block>", theme: name });
    else blocks[name] = tokenKeys(body);
  }
  const present = names.filter((n) => blocks[n]);
  const universe = new Set();
  for (const n of present) for (const k of blocks[n]) if (!ROOT_ONLY_RE.test(k)) universe.add(k);
  for (const token of [...universe].sort())
    for (const n of present) if (!blocks[n].has(token)) violations.push({ token, theme: n });
  return violations;
}

function selectorLine(ctx, name) {
  const file = fileOf(name);
  if (!ctx.exists(file)) return { file, line: 1 };
  const text = ctx.readFile(file);
  const i = text.indexOf(selectorOf(name));
  return { file, line: i < 0 ? 1 : lineOf(text, i) };
}

// ── fixtures ─────────────────────────────────────────────────────────────────
const THEMES = ["light", "dark"];
const BASE = "--background: oklch(1 0 0);\n  --foreground: oklch(0 0 0);";
function tree({ rootExtra = "", common = "", drop = [] } = {}) {
  const files = {
    "packages/tokens/src/theme-types.ts": `export const BUILT_IN_THEMES = ["light", "dark"] as const;\n`,
    [THEMES_ENGINE_CSS]: `:root {\n  ${BASE}${common}${rootExtra}\n}\n`,
  };
  for (const t of THEMES)
    files[themeCssPath(t)] = drop.includes(t)
      ? `/* moved */\n`
      : `[data-theme="${t}"] {\n  ${BASE}${common}\n}\n`;
  return { files };
}

export default {
  id: "theme-parity",
  scope: "themes",
  doc: "Every theme block (`:root` and each `[data-theme]`) defines every semantic token; only `:root` machinery (`--decoration*`, `--deco-*`, `--paper-*`, `--hairline-*`, `--duration-*`, `--t-*`, `--motion-*`, `--radius*`, `--font-*`) is exempt.",
  baseline: "none",
  run(ctx) {
    let css;
    try {
      css = ctx.themes.css();
    } catch (err) {
      return [{ file: THEMES_ENGINE_CSS, line: 1, msg: err.message }];
    }
    return findParityViolations(css, ctx.themes.names()).map(({ token, theme }) => ({
      ...selectorLine(ctx, theme),
      msg:
        token === "<block>"
          ? `theme block ${selectorOf(theme)} not found`
          : `${token} missing from ${selectorOf(theme)}`,
    }));
  },
  fixtures: {
    pass: [
      tree(),
      tree({ common: "\n  --foo: oklch(0.5 0 0);" }),
      tree({ rootExtra: "\n  --deco-new: oklch(0.5 0 0);" }),
      tree({ rootExtra: "\n  --t-new: 200ms;" }),
      tree({
        rootExtra:
          "\n  --radius: 0.5rem;\n  --radius-base: 0.5rem;\n  --decoration: 0;\n  --decoration-factor: 1;\n  --duration-fast: 120ms;\n  --motion-factor: 1;\n  --font-sans: Inter;",
      }),
    ],
    fail: [
      tree({ rootExtra: "\n  --foo: oklch(0.5 0 0);" }),
      tree({ rootExtra: "\n  --text-muted: oklch(0.5 0 0);" }),
      tree({ drop: ["dark"] }),
    ],
  },
};
