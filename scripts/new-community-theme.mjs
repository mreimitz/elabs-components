#!/usr/bin/env node
/**
 * new-community-theme.mjs — scaffold a downloadable theme family (ADR 0036).
 *
 *   pnpm theme:new <slug> --label "Ocean" [--hue 230] [--only light|dark] [--preset flat]
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
 * and chroma are untouched.
 *
 * `--preset` swaps the starting SHAPE (never a colour) for one of `PRESETS`
 * below. Without it the copy is unchanged. Then edit the values by hand and run
 * `pnpm check --rule community-themes`.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { COMMUNITY_THEMES_DIR, SCHEMES, formatForPath } from "./lib/community-themes.mjs";
import { TOKENS_SRC } from "./lib/theme-sources.mjs";

const BRAND_TOKEN = /^--(primary|ring|sidebar-primary|sidebar-ring|brand-mark|chart-1$)/;
const NEUTRAL_MAX_CHROMA = 0.04;

/**
 * Shape presets: token overrides applied on top of the copied reference values,
 * `shared` in every scheme and then the scheme's own. Shape only — a preset
 * never touches a colour, so the copy's contrast is unchanged. A preset may only
 * override a token the reference theme declares (`scaffoldCss` throws
 * otherwise), so a renamed token fails the scaffold instead of slipping out of
 * the contract.
 *
 * `flat` is the shape every SaaS product in the 2026-09-18 theme review shares:
 * flatter and denser than the reference themes. Hairline cards with no resting
 * shadow, flat fields, 4 px corners on cards AND controls, 32 px controls, a 48 px
 * top bar, table rows split by a hairline instead of a stripe, underline tabs, a
 * 1.5 icon stroke, and a weak shadow ink so menus and dialogs still float (their
 * 1 px ring is not scaled by strength). Dark grounds need more ink to show a
 * shadow at all, hence the per-scheme strength.
 */
export const PRESETS = {
  flat: {
    shared: {
      "--radius-base": "0.25rem",
      "--control-radius": "var(--radius)",
      "--control-size": "8",
      "--header-size": "12",
      "--input-shadow": "none",
      "--card-shadow": "none",
      "--card-border": "var(--border)",
      "--table-stripe": "transparent",
      "--table-row-rule-width": "1px",
      "--tabs-variant": "underline",
      "--icon-stroke": "1.5",
    },
    light: { "--shadow-strength": "0.4" },
    dark: { "--shadow-strength": "1" },
  },
};

/** One scheme's overrides for a preset name (`{}` when no preset). */
export function presetOverrides(preset, scheme) {
  if (preset === undefined) return {};
  const spec = PRESETS[preset];
  if (!spec)
    throw new Error(`unknown preset "${preset}" (known: ${Object.keys(PRESETS).join(", ")})`);
  return { ...spec.shared, ...spec[scheme] };
}

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
export function scaffoldCss(referenceCss, { slug, scheme, label, hue, preset }) {
  const block = referenceCss
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .match(new RegExp(`\\[data-theme="${scheme}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!block) throw new Error(`reference theme "${scheme}" has no [data-theme] block`);
  const overrides = presetOverrides(preset, scheme);
  const applied = new Set();
  // One statement per line, whitespace collapsed — a value the formatter wrapped
  // across lines (`oklch(\n 0.74 … \n)`) must be retinted like any other.
  const lines = block[1]
    .split(";")
    .map((statement) => statement.replace(/\s+/g, " ").trim())
    .filter((statement) => statement !== "")
    .map((statement) => {
      const decl = statement.match(/^(--[\w-]+)\s*:\s*(.*)$/);
      if (decl && Object.hasOwn(overrides, decl[1])) {
        applied.add(decl[1]);
        return `  ${decl[1]}: ${overrides[decl[1]]};`;
      }
      if (!decl || hue === undefined) return `  ${statement};`;
      return `  ${decl[1]}: ${retint(decl[1], decl[2].replace(/\(\s+/g, "(").replace(/\s+\)/g, ")"), hue)};`;
    });
  const unknown = Object.keys(overrides).filter((token) => !applied.has(token));
  if (unknown.length > 0) {
    throw new Error(
      `preset "${preset}": reference theme "${scheme}" declares no ${unknown.join(", ")}`,
    );
  }
  const presetNote = preset === undefined ? "" : ` Started from the "${preset}" shape preset.`;
  return [
    `/* ${commentSafe(label)} — ${scheme}. Downloadable theme family "${slug}" (see ../README.md).${presetNote} */`,
    `[data-theme="${slug}-${scheme}"] {`,
    ...lines,
    "}",
    "",
  ].join("\n");
}

/** A label made safe inside a block comment and on one line. */
function commentSafe(label) {
  return label.replace(/\s+/g, " ").replace(/\*\//g, "*\\/");
}

export function scaffoldThemeTs({ slug, label, schemes }) {
  const constName = slug.replace(/-([a-z0-9])/g, (_, ch) => ch.toUpperCase());
  const entries = schemes.map((scheme, i) => {
    const familyLabel = i === 0 ? `\n    familyLabel: ${JSON.stringify(label)},` : "";
    const schemeLabel = scheme === "dark" ? "Dark" : "Light";
    return `  defineTheme({
    value: "${slug}-${scheme}",
    label: ${JSON.stringify(`${label} ${schemeLabel}`)},
    dark: ${scheme === "dark"},
    family: "${slug}",${familyLabel}
  }),`;
  });
  return `import { defineTheme, type ThemeDefinition } from "@elabs-ai/components-tokens";

/** The ${commentSafe(JSON.stringify(label))} theme family — register on <ThemeProvider themes={…}>. */
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

A dark variant also needs the required \`dark:\` variant line — see [the themes folder README](../README.md).
`;
}

/** Write a family into `folder`, replacing an existing scaffold cleanly. */
export async function writeScaffold({ folder, slug, label, hue, schemes, preset }) {
  // Render and format everything BEFORE touching the folder, so a formatter
  // error can never leave a half-written scaffold behind.
  const outputs = new Map();
  for (const scheme of schemes) {
    const reference = readFileSync(join(TOKENS_SRC, "themes", `${scheme}.css`), "utf8");
    outputs.set(
      `${slug}-${scheme}.css`,
      scaffoldCss(reference, { slug, scheme, label, hue, preset }),
    );
  }
  outputs.set("theme.ts", scaffoldThemeTs({ slug, label, schemes }));
  outputs.set("README.md", scaffoldReadme({ slug, label, schemes }));
  for (const [name, content] of outputs) {
    outputs.set(name, await formatForPath(join(folder, name), content));
  }

  mkdirSync(folder, { recursive: true });
  // --force may drop a scheme: remove the stylesheet the new theme.ts no longer registers.
  for (const scheme of SCHEMES) {
    const stale = join(folder, `${slug}-${scheme}.css`);
    if (!schemes.includes(scheme) && existsSync(stale)) rmSync(stale);
  }
  for (const [name, content] of outputs) writeFileSync(join(folder, name), content);
}

async function main(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      label: { type: "string" },
      hue: { type: "string" },
      only: { type: "string" },
      preset: { type: "string" },
      force: { type: "boolean", default: false },
    },
  });
  const slug = positionals[0];
  if (!slug || !/^[a-z][a-z0-9-]*[a-z0-9]$/.test(slug)) {
    console.error(
      'usage: pnpm theme:new <kebab-slug> --label "Name" [--hue 0-360] [--only light|dark] [--preset flat]',
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
  if (values.preset !== undefined && !Object.hasOwn(PRESETS, values.preset)) {
    console.error(`--preset must be one of: ${Object.keys(PRESETS).join(", ")}`);
    return 2;
  }
  const schemes = values.only ? [values.only] : [...SCHEMES];
  const folder = join(COMMUNITY_THEMES_DIR, slug);
  if (existsSync(folder) && !values.force) {
    console.error(`themes/${slug} already exists (pass --force to overwrite)`);
    return 1;
  }

  await writeScaffold({ folder, slug, label, hue, schemes, preset: values.preset });
  const shape = values.preset === undefined ? "" : `, ${values.preset} preset`;
  console.log(`new-community-theme: wrote themes/${slug}/ (${schemes.join(" + ")}${shape})`);
  console.log(
    "next: edit the colours, then run `pnpm check --rule community-themes` and `pnpm gen`.",
  );
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = await main(process.argv.slice(2));
}
