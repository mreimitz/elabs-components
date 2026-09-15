#!/usr/bin/env node
/**
 * check-community-themes.mjs — gate for the downloadable theme families in
 * `themes/` (ADR 0036). Bar: complete + readable, not the built-in battery.
 *
 * Per family folder (see `scripts/lib/community-themes.mjs`, `auditFamily`):
 *   - `<slug>-light.css` and/or `<slug>-dark.css`, nothing else `*.css`
 *   - each file is exactly one `[data-theme="<slug>-<scheme>"]` block whose
 *     `color-scheme` matches
 *   - every `THEME_TOKEN_NAMES` token declared; nothing outside the contract
 *   - the core ink pairs (`INK_PAIRS`) clear WCAG AA
 *   - `theme.ts` registers each variant with matching `dark` and `family`
 *   - a README.md
 *
 * Fails loudly on an empty or missing `themes/` folder: a gate that audits zero
 * families is not a pass.
 *
 *   pnpm community-themes:check
 *   node scripts/check-community-themes.mjs --dir <path>   (self-test fixtures)
 */
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import {
  COMMUNITY_THEMES_DIR,
  auditFamily,
  listFamilies,
  readRootDeclarations,
  readTokenNames,
} from "./lib/community-themes.mjs";
import { staleOutputs } from "./gen-community-themes.mjs";

export async function runCheck({ dir = COMMUNITY_THEMES_DIR } = {}) {
  const tokenNames = readTokenNames();
  const root = readRootDeclarations();
  const families = listFamilies(dir);
  if (families.length === 0) {
    return { ok: false, lines: [`community-themes: no theme families found in ${dir}`] };
  }
  const lines = [];
  let ok = true;
  for (const slug of families) {
    const { variants, errors } = auditFamily(slug, { dir, tokenNames, root });
    if (errors.length === 0) {
      lines.push(`  ✓ ${slug} (${variants.map((v) => v.scheme).join(" + ")})`);
    } else {
      ok = false;
      lines.push(`  ✗ ${slug}`);
      for (const e of errors) lines.push(`      ${e}`);
    }
  }
  // Storybook wiring is only meaningful for the real folder, not a fixture dir.
  if (dir === COMMUNITY_THEMES_DIR) {
    const stale = await staleOutputs();
    if (stale.length > 0) {
      ok = false;
      lines.push(`  ✗ Storybook wiring is stale (${stale.join(", ")}) — run \`pnpm gen\``);
    }
  }
  lines.unshift(
    `community-themes: ${families.length} famil${families.length === 1 ? "y" : "ies"}, ` +
      `${tokenNames.length} contract tokens`,
  );
  return { ok, lines };
}

async function main(argv) {
  const { values } = parseArgs({ args: argv, options: { dir: { type: "string" } } });
  const { ok, lines } = await runCheck({ dir: values.dir });
  (ok ? console.log : console.error)(lines.join("\n"));
  return ok ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = await main(process.argv.slice(2));
}
