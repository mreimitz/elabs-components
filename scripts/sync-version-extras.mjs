#!/usr/bin/env node
/**
 * sync-version-extras.mjs — stamp the lockstep version onto the sites Changesets
 * does not know about.
 *
 * `changeset version` bumps every package in the `fixed` group (.changeset/config.json)
 * to one version. These sites are not workspace packages, so it never touches them:
 *   - the root package.json `version`
 *   - .claude-plugin/plugin.json and .claude-plugin/marketplace.json — the plugin
 *     pointer a `/plugin marketplace add` consumer follows
 *   - SERVER_INFO.version in packages/cli/lib/mcp.mjs — what the MCP server reports
 *
 * The source of truth is the fixed group itself: every distributable package must
 * agree (a disagreement is a broken `fixed` config, and is reported, never guessed).
 *
 * Usage:
 *   node scripts/sync-version-extras.mjs          write the group version to the extras
 *   node scripts/sync-version-extras.mjs --check  exit 1 when any site drifts (CI gate)
 *
 * Runs inside `pnpm changeset:version`, i.e. in the release workflow's Version PR.
 * Dependency-free; ESM; cwd-independent.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT, distributablePackages } from "./lib/distributables.mjs";

/** The non-package version sites: `{ file, get(text), set(text, version) }`. Pure. */
export function extraSites() {
  const jsonVersion = (file) => ({
    file,
    get: (text) => JSON.parse(text).version,
    // Rewrite the literal so key order and formatting survive untouched.
    set: (text, version) =>
      text.replace(`"version": "${JSON.parse(text).version}"`, `"version": "${version}"`),
  });
  return [
    jsonVersion("package.json"),
    jsonVersion(".claude-plugin/plugin.json"),
    {
      // The version is nested inside the plugin entry, so match the first occurrence.
      file: ".claude-plugin/marketplace.json",
      get: (text) => text.match(/"version":\s*"([^"]+)"/)?.[1],
      set: (text, version) => text.replace(/("version":\s*)"[^"]+"/, `$1"${version}"`),
    },
    {
      file: "packages/cli/lib/mcp.mjs",
      get: (text) => text.match(/SERVER_INFO\s*=\s*\{[^}]*version:\s*"([^"]+)"/)?.[1],
      set: (text, version) =>
        text.replace(/(SERVER_INFO\s*=\s*\{[^}]*version:\s*)"[^"]+"/, `$1"${version}"`),
    },
  ];
}

/**
 * The one version the fixed group agrees on. Returns `{ version, error }`; `error`
 * is set when there are no distributables or they disagree. Pure apart from fs reads.
 */
export function groupVersion(root = REPO_ROOT) {
  const pkgs = distributablePackages(root);
  if (pkgs.length === 0) return { version: null, error: "no distributable packages found" };
  const versions = [...new Set(pkgs.map((p) => p.version))];
  if (versions.length > 1) {
    const detail = pkgs.map((p) => `${p.name}@${p.version}`).join(", ");
    return {
      version: null,
      error: `distributable packages disagree (${detail}) — is every one in .changeset/config.json "fixed"?`,
    };
  }
  return { version: versions[0], error: null };
}

/**
 * Sync (or check) every extra site against the group version.
 * Returns `{ version, drift: [{file, found}], changed: string[], errors: string[] }`.
 */
export function syncVersionExtras({ root = REPO_ROOT, check = false } = {}) {
  const errors = [];
  const drift = [];
  const changed = [];
  const { version, error } = groupVersion(root);
  if (error) return { version, drift, changed, errors: [error] };

  for (const site of extraSites()) {
    const path = join(root, site.file);
    if (!existsSync(path)) {
      errors.push(`missing version site ${site.file}`);
      continue;
    }
    const before = readFileSync(path, "utf8");
    const found = site.get(before);
    if (found === version) continue;
    drift.push({ file: site.file, found: found ?? null });
    if (check) continue;
    const after = site.set(before, version);
    if (site.get(after) !== version) {
      errors.push(`could not rewrite ${site.file} (pattern did not match)`);
      continue;
    }
    writeFileSync(path, after);
    changed.push(site.file);
  }
  return { version, drift, changed, errors };
}

function main(argv) {
  const check = argv.includes("--check");
  const { version, drift, changed, errors } = syncVersionExtras({ check });
  if (errors.length > 0) {
    for (const e of errors) console.error(`✖ version-sync: ${e}`);
    return 1;
  }
  if (check) {
    if (drift.length > 0) {
      console.error(
        `✖ version-sync: ${drift.length} site(s) disagree with the package version ${version}:`,
      );
      for (const d of drift) console.error(`    ${d.file} — ${d.found ?? "(unreadable)"}`);
      console.error("\n  Fix: node scripts/sync-version-extras.mjs");
      return 1;
    }
    console.log(`✔ version-sync: every extra site agrees on ${version}.`);
    return 0;
  }
  console.log(`✔ version-sync: ${version} (${changed.length} site(s) updated).`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
