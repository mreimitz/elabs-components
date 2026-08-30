#!/usr/bin/env node
/**
 * validate-registry.mjs
 * ----------------------------------------------------------------------------
 * Dependency-free validator for the internal shadcn-compatible registry.
 *
 * Checks, for `registry/registry.json`:
 *   - top-level shape ($schema, name, items[])
 *   - the top-level `homepage` is a real, absolute https:// URL — never a
 *     placeholder host (#264: `example.internal` shipped, unhosted, undetected)
 *   - each item has a unique name, a valid `type`, a `title` and `description`
 *   - file-backed items list `files[]` and every referenced file exists on disk
 *   - theme items define `cssVars`
 *
 * Run with: `pnpm registry:validate` (or `node scripts/validate-registry.mjs`).
 * Exits non-zero on any error so it can gate CI / `prepare-release`.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { findHomepageViolation } from "./lib/registry-homepage.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = resolve(root, "registry/registry.json");

// ---------------------------------------------------------------------------
// `homepage` — OPTIONAL, but a real resolvable URL when present (#264, #31)
// ---------------------------------------------------------------------------
// The registry IS hosted since #31: `registry/registry.items.json` sets
// `homepage` to the real GitHub Pages base URL, published on every release by
// `scripts/publish-registry-pages.mjs` (see docs/REGISTRY_GUIDELINES.md). A
// fork with no public host may still omit `homepage` (a private/internal
// clone has nothing to name), so this stays a validator of SHAPE — absent is
// fine, present-but-placeholder/non-https/empty is not — rather than a hard
// requirement. Re-exported for the self-test AND for
// check-registry-published.mjs, which needs the same rule without importing
// this whole top-level-executing script. See lib/registry-homepage.mjs.
export { findHomepageViolation };

const VALID_TYPES = new Set([
  "registry:base",
  "registry:block",
  "registry:component",
  "registry:font",
  "registry:lib",
  "registry:hook",
  "registry:ui",
  "registry:page",
  "registry:file",
  "registry:style",
  "registry:theme",
  "registry:item",
]);

const errors = [];
const warnings = [];

function fail(msg) {
  errors.push(msg);
}

if (!existsSync(registryPath)) {
  console.error(`✖ registry.json not found at ${registryPath}`);
  process.exit(1);
}

let registry;
try {
  registry = JSON.parse(readFileSync(registryPath, "utf8"));
} catch (err) {
  console.error(`✖ registry.json is not valid JSON: ${err.message}`);
  process.exit(1);
}

if (!registry.name) fail("registry.json is missing a top-level `name`.");
const homepageViolation = findHomepageViolation(registry.homepage);
if (homepageViolation) fail(homepageViolation);
if (!Array.isArray(registry.items)) {
  console.error("✖ registry.json must contain an `items` array.");
  process.exit(1);
}

const seen = new Set();

for (const [i, item] of registry.items.entries()) {
  const label = item?.name ? `item "${item.name}"` : `item #${i}`;

  if (!item.name) fail(`${label}: missing \`name\`.`);
  else if (seen.has(item.name)) fail(`${label}: duplicate name.`);
  else seen.add(item.name);

  if (!item.type) fail(`${label}: missing \`type\`.`);
  else if (!VALID_TYPES.has(item.type)) fail(`${label}: invalid type "${item.type}".`);

  if (!item.title) warnings.push(`${label}: missing \`title\`.`);
  if (!item.description) warnings.push(`${label}: missing \`description\`.`);

  const isTheme = item.type === "registry:theme" || item.type === "registry:style";

  if (isTheme) {
    if (!item.cssVars && !item.css) {
      fail(`${label}: theme/style items should define \`cssVars\` or \`css\`.`);
    }
  } else {
    if (!Array.isArray(item.files) || item.files.length === 0) {
      fail(`${label}: must list at least one entry in \`files\`.`);
      continue;
    }
    for (const file of item.files) {
      if (!file.path) {
        fail(`${label}: a file entry is missing \`path\`.`);
        continue;
      }
      if (!file.type || !VALID_TYPES.has(file.type)) {
        fail(`${label}: file "${file.path}" has an invalid \`type\`.`);
      }
      if ((file.type === "registry:page" || file.type === "registry:file") && !file.target) {
        fail(`${label}: file "${file.path}" of type ${file.type} requires a \`target\`.`);
      }
      const abs = resolve(root, file.path);
      if (!existsSync(abs)) fail(`${label}: file not found on disk: ${file.path}`);
    }
  }
}

for (const w of warnings) console.warn(`⚠ ${w}`);

if (errors.length) {
  for (const e of errors) console.error(`✖ ${e}`);
  console.error(`\nRegistry validation failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log(
  `✓ Registry OK — ${registry.items.length} item(s) validated${
    warnings.length ? ` (${warnings.length} warning(s))` : ""
  }.`,
);
