/**
 * community-themes.mjs — read and audit the downloadable theme families under
 * the repo-root `themes/` folder (ADR 0036).
 *
 * These themes are NOT shipped: they are never in `BUILT_IN_THEMES`, never feed
 * `THEME_TOKEN_NAMES`, never appear in the audit artifact. Each family folder is
 * `themes/<slug>/` holding `<slug>-light.css` and/or `<slug>-dark.css` plus a
 * `theme.ts` of `defineTheme(...)` entries. The bar (maintainer decision) is
 * "complete + readable": every contract token declared, `color-scheme` and the
 * registry entry agree with the file, and the core ink pairs clear WCAG AA.
 *
 * Shared by `check-community-themes.mjs` (the gate), `gen-community-themes.mjs`
 * (Storybook wiring) and `new-community-theme.mjs` (the scaffolder).
 * ESM, cwd-independent; Prettier (a root devDependency) is loaded lazily for
 * `formatForPath` only.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { blankComments } from "../check-elevation.mjs";
import { REPO_ROOT, THEMES_CSS } from "./theme-sources.mjs";

export const COMMUNITY_THEMES_DIR = join(REPO_ROOT, "themes");
export const TOKEN_NAMES_TS = join(
  REPO_ROOT,
  "packages",
  "tokens",
  "src",
  "theme-token-names.generated.ts",
);
export const SCHEMES = /** @type {const} */ (["light", "dark"]);
const SLUG_RE = /^[a-z][a-z0-9-]*[a-z0-9]$/;

/**
 * Ink pairs every community theme must clear at WCAG AA (4.5:1) — body text on
 * each everyday surface plus ink on the primary plate. Deliberately NOT the full
 * built-in battery (`themes-contrast.test.ts`).
 */
export const INK_PAIRS = [
  ["--foreground", "--background"],
  ["--card-foreground", "--card"],
  ["--popover-foreground", "--popover"],
  ["--muted-foreground", "--background"],
  ["--muted-foreground", "--card"],
  ["--primary-foreground", "--primary"],
  ["--secondary-foreground", "--secondary"],
  ["--accent-foreground", "--accent"],
];
export const AA = 4.5;

/**
 * Format `content` as Prettier would for `path` (repo config), so generated and
 * scaffolded files pass `pnpm format:check` without a second step.
 */
export async function formatForPath(path, content) {
  const prettier = await import("prettier");
  const options = (await prettier.resolveConfig(path)) ?? {};
  return prettier.format(content, { ...options, filepath: path });
}

/** The token contract, parsed from the generated TS (no TS toolchain needed). */
export function readTokenNames(path = TOKEN_NAMES_TS) {
  return [...readFileSync(path, "utf8").matchAll(/^\s*"(--[\w-]+)",?$/gm)].map((m) => m[1]);
}

/** `--token: value;` declarations of a CSS block body, comments blanked first. */
export function declarations(body) {
  const map = new Map();
  for (const m of blankComments(body).matchAll(/(--[\w-]+)\s*:\s*([^;]*?)\s*;/g)) {
    map.set(m[1], m[2].trim());
  }
  return map;
}

/** Every `[data-theme="…"] { … }` block in a stylesheet, comments blanked. */
export function themeBlocks(cssText) {
  const css = blankComments(cssText);
  return [...css.matchAll(/\[data-theme="([^"]+)"\]\s*\{([\s\S]*?)\n\}/g)].map((m) => ({
    name: m[1],
    body: m[2],
  }));
}

/** The engine's `:root` declarations — the cascade fallback for `var()` aliases. */
export function readRootDeclarations(path = THEMES_CSS) {
  const m = blankComments(readFileSync(path, "utf8")).match(/:root\s*\{([\s\S]*?)\n\}/);
  return declarations(m?.[1] ?? "");
}

/** Follow `var(--…)` aliases in the block, then `:root`, to an oklch literal (or null). */
export function resolveColor(name, block, root, seen = new Set()) {
  if (seen.has(name)) return null;
  seen.add(name);
  const raw = block.get(name) ?? root.get(name);
  if (raw == null) return null;
  if (/^oklch\(/i.test(raw)) return raw;
  const alias = raw.match(/^var\(\s*(--[\w-]+)\s*\)$/);
  return alias ? resolveColor(alias[1], block, root, seen) : null;
}

/** `oklch(L C H [/ A])` → { l, c, h, alpha }, or null. */
export function parseOklch(input) {
  const m = input.trim().match(/^oklch\(\s*([^)]+)\)$/i);
  if (!m) return null;
  const [channels, alphaRaw] = m[1].split("/");
  const parts = channels.trim().split(/\s+/);
  if (parts.length < 3) return null;
  const [l, c, h] = parts.map((p) => (p === "none" ? 0 : Number(p.replace(/%$/, ""))));
  if (![l, c, h].every(Number.isFinite)) return null;
  let alpha = 1;
  if (alphaRaw !== undefined) {
    const a = alphaRaw.trim();
    alpha = a.endsWith("%") ? Number(a.slice(0, -1)) / 100 : Number(a);
    if (!Number.isFinite(alpha)) return null;
  }
  return { l: parts[0].endsWith("%") ? l / 100 : l, c, h, alpha };
}

/** True when an oklch literal carries an alpha below 1 (its rendered ink depends on what is behind it). */
export function isTranslucent(raw) {
  const p = parseOklch(raw);
  return p !== null && p.alpha < 1;
}

/** WCAG contrast between two oklch literals — same math as `color-contrast.ts`. */
export function contrast(fgRaw, bgRaw) {
  const lum = (raw) => {
    const p = parseOklch(raw);
    if (!p) return null;
    const hr = (p.h * Math.PI) / 180;
    const a = p.c * Math.cos(hr);
    const b = p.c * Math.sin(hr);
    const l_ = (p.l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m_ = (p.l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s_ = (p.l - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const lin = [
      4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
      -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
      -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
    ];
    const [r, g, bl] = lin.map((x) => {
      const v = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
      const c = Math.min(1, Math.max(0, v));
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const lf = lum(fgRaw);
  const lb = lum(bgRaw);
  if (lf == null || lb == null) return null;
  const [hi, lo] = lf >= lb ? [lf, lb] : [lb, lf];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Parse `theme.ts` — every `defineTheme({ … })` object literal's `value`,
 * `dark`, `family`, `label` and `familyLabel`. A deliberately narrow reader: the
 * file is authored from the scaffolder's shape, and anything it cannot read is
 * reported rather than guessed.
 */
export function readThemeDefinitions(source) {
  const defs = [];
  for (const m of source.matchAll(/defineTheme\(\s*\{([\s\S]*?)\}\s*\)/g)) {
    const body = m[1];
    // A string literal in either quote style, escapes included — Prettier picks
    // single quotes for a label that itself contains a double quote.
    const str = (key) => {
      const lit = body.match(
        new RegExp(`\\b${key}\\s*:\\s*("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*')`),
      )?.[1];
      if (lit === undefined) return undefined;
      const inner = lit.slice(1, -1);
      return JSON.parse(
        `"${lit[0] === "'" ? inner.replace(/\\'/g, "'").replace(/"/g, '\\"') : inner}"`,
      );
    };
    const bool = body.match(/\bdark\s*:\s*(true|false)\b/)?.[1];
    defs.push({
      value: str("value"),
      label: str("label"),
      family: str("family"),
      familyLabel: str("familyLabel"),
      dark: bool === undefined ? undefined : bool === "true",
    });
  }
  return defs;
}

/** Family folders under `dir` (skips dotfiles, `_`-prefixed and plain files). */
export function listFamilies(dir = COMMUNITY_THEMES_DIR) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => !name.startsWith(".") && !name.startsWith("_"))
    .filter((name) => statSync(join(dir, name)).isDirectory())
    .sort();
}

/**
 * Audit one family folder. Returns `{ slug, variants, errors }` where each
 * variant is `{ scheme, name, file, definition }`.
 */
export function auditFamily(slug, { dir = COMMUNITY_THEMES_DIR, tokenNames, root } = {}) {
  const errors = [];
  const folder = join(dir, slug);
  const variants = [];
  const contract = new Set(tokenNames);

  if (!SLUG_RE.test(slug)) errors.push(`folder name "${slug}" must be kebab-case (a-z, 0-9, -)`);

  const files = readdirSync(folder);
  const cssFiles = files.filter((f) => f.endsWith(".css"));
  const expected = SCHEMES.map((s) => `${slug}-${s}.css`);
  for (const f of cssFiles) {
    if (!expected.includes(f))
      errors.push(`unexpected stylesheet ${f} (only ${expected.join(" / ")})`);
  }

  let definitions = [];
  if (!files.includes("theme.ts")) errors.push("missing theme.ts");
  else definitions = readThemeDefinitions(readFileSync(join(folder, "theme.ts"), "utf8"));
  if (!files.includes("README.md")) errors.push("missing README.md");

  for (const scheme of SCHEMES) {
    const file = `${slug}-${scheme}.css`;
    if (!cssFiles.includes(file)) continue;
    const name = `${slug}-${scheme}`;
    const where = `${file}`;
    const blocks = themeBlocks(readFileSync(join(folder, file), "utf8"));
    if (blocks.length !== 1 || blocks[0].name !== name) {
      errors.push(`${where}: must hold exactly one [data-theme="${name}"] block`);
      continue;
    }
    const decls = declarations(blocks[0].body);
    const colorScheme = blankComments(blocks[0].body)
      .match(/\bcolor-scheme\s*:\s*([^;]+);/)?.[1]
      .trim();
    if (colorScheme !== scheme) {
      errors.push(`${where}: color-scheme must be "${scheme}" (found ${colorScheme ?? "none"})`);
    }

    const missing = tokenNames.filter((t) => !decls.has(t));
    if (missing.length > 0) {
      errors.push(`${where}: missing ${missing.length} contract token(s): ${missing.join(", ")}`);
    }
    const unknown = [...decls.keys()].filter(
      (t) => !contract.has(t) && !t.startsWith("--font-") && t !== "--radius-base",
    );
    if (unknown.length > 0) {
      errors.push(`${where}: token(s) outside the contract: ${unknown.join(", ")}`);
    }

    for (const [fg, bg] of INK_PAIRS) {
      const fgRaw = resolveColor(fg, decls, root);
      const bgRaw = resolveColor(bg, decls, root);
      if (fgRaw == null || bgRaw == null) {
        if (decls.has(fg) && decls.has(bg))
          errors.push(`${where}: ${fg} on ${bg} is not an oklch() colour`);
        continue;
      }
      // The contrast math ignores alpha, so a translucent ink or ground would be
      // measured as opaque and could pass while rendering unreadable. Refuse it.
      const translucent = [fg, bg].filter((t, i) => isTranslucent(i === 0 ? fgRaw : bgRaw));
      if (translucent.length > 0) {
        errors.push(
          `${where}: ${translucent.join(" and ")} must be opaque for the ${fg} on ${bg} readability check (drop the "/ alpha")`,
        );
        continue;
      }
      const ratio = contrast(fgRaw, bgRaw);
      if (ratio == null || ratio < AA) {
        errors.push(
          `${where}: ${fg} on ${bg} is ${ratio?.toFixed(2) ?? "unreadable"}:1 (needs ${AA}:1)`,
        );
      }
    }

    const definition = definitions.find((d) => d.value === name);
    if (!definition) errors.push(`theme.ts: no defineTheme({ value: "${name}" })`);
    else {
      if (definition.dark !== (scheme === "dark")) {
        errors.push(`theme.ts: "${name}" must set dark: ${scheme === "dark"}`);
      }
      if (definition.family !== slug) errors.push(`theme.ts: "${name}" must set family: "${slug}"`);
      if (!definition.label) errors.push(`theme.ts: "${name}" needs a label`);
    }
    variants.push({ scheme, name, file: join(folder, file), definition });
  }

  if (variants.length === 0 && errors.length === 0) {
    errors.push(`needs ${expected.join(" and/or ")}`);
  }
  const stray = definitions.filter((d) => !variants.some((v) => v.name === d.value));
  for (const d of stray) errors.push(`theme.ts: "${d.value}" has no matching stylesheet`);
  if (variants.length > 0 && !definitions.some((d) => d.familyLabel)) {
    errors.push("theme.ts: set familyLabel on at least one definition");
  }

  return { slug, variants, errors };
}
