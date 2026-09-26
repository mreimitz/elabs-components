#!/usr/bin/env node
/**
 * copy-themes.mjs — copy the brand theme families this app uses (`themes/<slug>/`,
 * repo root) into `src/themes/<slug>/` (git-ignored), the way `themes/README.md`
 * tells any consumer to. Everything except `README.md` is copied, overwriting.
 *
 * Run before `dev`/`build:local`/`typecheck:local` (wired into those scripts).
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const APP_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const THEMES_SRC = join(APP_ROOT, "..", "..", "themes");
const THEMES_DEST = join(APP_ROOT, "src", "themes");

const FAMILIES = ["qlik", "clickhouse", "salesforce", "snowflake"];

function copyFamily(slug) {
  const src = join(THEMES_SRC, slug);
  const dest = join(THEMES_DEST, slug);
  if (!existsSync(src)) throw new Error(`copy-themes: themes/${slug} does not exist`);
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  for (const name of readdirSync(src)) {
    if (name === "README.md") continue;
    const from = join(src, name);
    const to = join(dest, name);
    if (statSync(from).isDirectory()) cpSync(from, to, { recursive: true });
    else cpSync(from, to);
  }
}

for (const slug of FAMILIES) copyFamily(slug);
console.log(FAMILIES.join(" "));
