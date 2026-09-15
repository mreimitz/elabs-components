#!/usr/bin/env node
/**
 * new-community-theme.mjs — scaffold a downloadable theme family (ADR 0036).
 *
 *   pnpm theme:new <slug> --label "Ocean" [--hue 230] [--only light|dark]
 *
 * Writes `themes/<slug>/` with `<slug>-light.css` / `<slug>-dark.css`,
 * `theme.ts` and `README.md`. The stylesheets start as COPIES of the reference
 * themes' current values (so a scaffold never lags the token contract the way a
 * checked-in template would), comments stripped, selector renamed.
 *
 * `--hue` re-tints the starting point: brand tokens (primary, ring, sidebar
 * primary, brand mark, first chart series) and every low-chroma neutral take the
 * given oklch hue; status colours (destructive / success / warning / info) and
 * the rest of the chart ramp are left alone so their meaning survives. Lightness
 * and chroma are untouched. Then edit the values by hand and run
 * `pnpm community-themes:check`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { COMMUNITY_THEMES_DIR, SCHEMES, formatForPath } from "./lib/community-themes.mjs";
import { TOKENS_SRC } from "./lib/theme-sources.mjs";

const BRAND_TOKEN = /^--(primary|ring|sidebar-primary|sidebar-ring|brand-mark|chart-1$)/;
const NEUTRAL_MAX_CHROMA = 0.04;

/** Re-tint one declaration's oklch literals when its token is brand or neutral. */
export function retint(name, value, hue) {
  return value.replace(
    /oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)(\s*\/\s*[\d.]+%?)?\s*\)/g,
    (whole, l, c, _h, alpha = "") => {
      const brand = BRAND_TOKEN.test(name);
      if (!brand && Number(c) >= NEUTRAL_MAX_CHROMA) return whole;
      return `oklch(${l} ${c} ${hue}${alpha.replace(/\s+/g, " ")})`;
    },
  );
}

/** Build a theme stylesheet from a reference theme's source. */
export function scaffoldCss(referenceCss, { slug, scheme, label, hue }) {
  const block = referenceCss
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .match(new RegExp(`\\[data-theme="${scheme}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!block) throw new Error(`reference theme "${scheme}" has no [data-theme] block`);
  // One statement per line, whitespace collapsed — a value the formatter wrapped
  // across lines (`oklch(\n 0.74 … \n)`) must be retinted like any other.
  const lines = block[1]
    .split(";")
    .map((statement) => statement.replace(/\s+/g, " ").trim())
    .filter((statement) => statement !== "")
    .map((statement) => {
      const decl = statement.match(/^(--[\w-]+)\s*:\s*(.*)$/);
      if (!decl || hue === undefined) return `  ${statement};`;
      return `  ${decl[1]}: ${retint(decl[1], decl[2].replace(/\(\s+/g, "(").replace(/\s+\)/g, ")"), hue)};`;
    });
  return [
    `/* ${label} — ${scheme}. Downloadable theme family "${slug}" (see ../README.md). */`,
    `[data-theme="${slug}-${scheme}"] {`,
    ...lines,
    "}",
    "",
  ].join("\n");
}

export function scaffoldThemeTs({ slug, label, schemes }) {
  const constName = slug.replace(/-([a-z0-9])/g, (_, ch) => ch.toUpperCase());
  const entries = schemes.map((scheme, i) => {
    const familyLabel = i === 0 ? `\n    familyLabel: "${label}",` : "";
    const schemeLabel = scheme === "dark" ? "Dark" : "Light";
    return `  defineTheme({
    value: "${slug}-${scheme}",
    label: "${label} ${schemeLabel}",
    dark: ${scheme === "dark"},
    family: "${slug}",${familyLabel}
  }),`;
  });
  return `import { defineTheme, type ThemeDefinition } from "@elabs-ai/components-tokens";

/** The "${label}" theme family — register on <ThemeProvider themes={…}>. */
export const ${constName}Themes: ThemeDefinition[] = [
${entries.join("\n")}
];
`;
}

export function scaffoldReadme({ slug, label, schemes }) {
  const constName = slug.replace(/-([a-z0-9])/g, (_, ch) => ch.toUpperCase());
  const imports = schemes.map((s) => `import "./themes/${slug}/${slug}-${s}.css";`).join("\n");
  const modes = schemes.length === 2 ? "light and dark" : `${schemes[0]} only`;
  return `# ${label}

A downloadable theme family for brand-ui — ${modes}.

## Use it

1. Copy this folder into your app, e.g. \`src/themes/${slug}/\`.
2. Import the stylesheet(s) after the token engine:

   \`\`\`ts
   import "@elabs-ai/components-tokens/styles.css";
   ${imports.split("\n").join("\n   ")}
   \`\`\`

3. Register the family:

   \`\`\`tsx
   import { ThemeProvider } from "@elabs-ai/components-tokens";
   import { ${constName}Themes } from "./themes/${slug}/theme";

   <ThemeProvider themes={${constName}Themes} defaultTheme="${slug}-${schemes[0]}">
   \`\`\`

   Passing only this family REPLACES the default themes. To offer both, use
   \`themes={[...BUILT_IN_THEME_DEFINITIONS, ...${constName}Themes]}\`.

See [the themes folder README](../README.md) for the \`dark:\` variant step.
`;
}

async function main(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      label: { type: "string" },
      hue: { type: "string" },
      only: { type: "string" },
      force: { type: "boolean", default: false },
    },
  });
  const slug = positionals[0];
  if (!slug || !/^[a-z][a-z0-9-]*[a-z0-9]$/.test(slug)) {
    console.error(
      'usage: pnpm theme:new <kebab-slug> --label "Name" [--hue 0-360] [--only light|dark]',
    );
    return 2;
  }
  const label =
    values.label ??
    slug.replace(/(^|-)([a-z])/g, (_, sep, ch) => `${sep ? " " : ""}${ch.toUpperCase()}`);
  const hue = values.hue === undefined ? undefined : Number(values.hue);
  if (hue !== undefined && !(hue >= 0 && hue <= 360)) {
    console.error("--hue must be a number between 0 and 360");
    return 2;
  }
  if (values.only !== undefined && !SCHEMES.includes(values.only)) {
    console.error("--only must be light or dark");
    return 2;
  }
  const schemes = values.only ? [values.only] : [...SCHEMES];
  const folder = join(COMMUNITY_THEMES_DIR, slug);
  if (existsSync(folder) && !values.force) {
    console.error(`themes/${slug} already exists (pass --force to overwrite)`);
    return 1;
  }

  mkdirSync(folder, { recursive: true });
  const write = async (name, content) => {
    const path = join(folder, name);
    writeFileSync(path, await formatForPath(path, content));
  };
  for (const scheme of schemes) {
    const reference = readFileSync(join(TOKENS_SRC, "themes", `${scheme}.css`), "utf8");
    await write(`${slug}-${scheme}.css`, scaffoldCss(reference, { slug, scheme, label, hue }));
  }
  await write("theme.ts", scaffoldThemeTs({ slug, label, schemes }));
  await write("README.md", scaffoldReadme({ slug, label, schemes }));
  console.log(`new-community-theme: wrote themes/${slug}/ (${schemes.join(" + ")})`);
  console.log("next: edit the colours, then run `pnpm community-themes:check` and `pnpm gen`.");
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = await main(process.argv.slice(2));
}
