/**
 * on-mark-ink.fixtures.ts — TEST-ONLY. The shipped theme stylesheets as data,
 * so the on-mark ink tests measure the real ramps instead of copied literals.
 *
 * jsdom neither inherits custom properties nor substitutes `var()`, so
 * {@link applyThemeVars} paints every declaration onto `*` and the resolver's
 * own `var()` walk does the rest. Node-only (`node:fs`); never imported by
 * package source.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { ReadCssVar } from "./on-mark-ink";

const require = createRequire(import.meta.url);

export type ReferenceTheme = "light" | "dark";

function declarations(block: string): Record<string, string> {
  const map: Record<string, string> = {};
  const body = block.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    if (m[1] && m[2]) map[m[1]] = m[2].trim();
  }
  return map;
}

function blockOf(css: string, selector: RegExp, what: string): string {
  const body = css.match(selector)?.[1];
  if (body == null) throw new Error(`on-mark-ink fixtures: no ${what} block`);
  return body;
}

/** Every custom property a reference theme resolves: `:root` base, then the theme. */
export function themeVars(theme: ReferenceTheme): Record<string, string> {
  const engine = readFileSync(require.resolve("@elabs-ai/components-tokens/styles.css"), "utf8");
  const themed = readFileSync(
    require.resolve(`@elabs-ai/components-tokens/themes/${theme}.css`),
    "utf8",
  );
  return {
    ...declarations(blockOf(engine, /:root\s*\{([\s\S]*?)\n\}/, ":root")),
    ...declarations(
      blockOf(themed, new RegExp(`\\[data-theme="${theme}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`), theme),
    ),
  };
}

/** A `ReadCssVar` over a theme's declarations. */
export function readerFor(theme: ReferenceTheme): ReadCssVar {
  const vars = themeVars(theme);
  return (name) => vars[name] ?? "";
}

/** Inject a theme's declarations onto every element; returns the cleanup. */
export function applyThemeVars(theme: ReferenceTheme): () => void {
  const vars = themeVars(theme);
  const style = document.createElement("style");
  style.setAttribute("data-on-mark-ink-fixture", theme);
  style.textContent = `* { ${Object.entries(vars)
    .map(([k, v]) => `${k}: ${v};`)
    .join(" ")} }`;
  document.head.appendChild(style);
  return () => style.remove();
}
