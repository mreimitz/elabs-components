#!/usr/bin/env node
/**
 * build-icon-index.mjs (`icons:index`) — walks `public/icons/<vendor>/*.svg`
 * and writes `public/icons/index.json`: `{ "vendor/name": { path, label, pack } }`.
 * `label` is the filename Title Cased (`-` → space), unless the vendor folder
 * has a `labels.json` override (`{ "<stem>": "<label>" }`) for that stem —
 * used where the source filename is an abbreviation (e.g. k8s `svc` → "Service").
 *
 * Not a turbo task (no such task is declared for this app), so it never runs
 * in CI — the item's DG-04 step 4 note. Re-run by hand after refreshing a pack.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const APP_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ICONS_DIR = join(APP_ROOT, "public", "icons");

function titleCase(stem) {
  return stem.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildIndex() {
  const index = {};
  const vendors = readdirSync(ICONS_DIR).filter((name) =>
    statSync(join(ICONS_DIR, name)).isDirectory(),
  );

  for (const vendor of vendors) {
    const vendorDir = join(ICONS_DIR, vendor);
    let labelOverrides = {};
    const labelsPath = join(vendorDir, "labels.json");
    if (existsSync(labelsPath)) {
      labelOverrides = JSON.parse(readFileSync(labelsPath, "utf8"));
    }

    for (const file of readdirSync(vendorDir)) {
      if (extname(file).toLowerCase() !== ".svg") continue;
      const stem = basename(file, ".svg");
      const key = `${vendor}/${stem}`;
      index[key] = {
        path: `/icons/${vendor}/${file}`,
        label: labelOverrides[stem] ?? titleCase(stem),
        pack: vendor,
      };
    }
  }

  return index;
}

const index = buildIndex();
const sortedKeys = Object.keys(index).sort();
const sortedIndex = Object.fromEntries(sortedKeys.map((key) => [key, index[key]]));

writeFileSync(join(ICONS_DIR, "index.json"), JSON.stringify(sortedIndex, null, 2) + "\n");

console.log(
  `icons:index — ${sortedKeys.length} icons across ${new Set(sortedKeys.map((k) => index[k].pack)).size} packs`,
);
