#!/usr/bin/env node
/**
 * set-version.mjs — the single writer of the lockstep version.
 *
 * brand-ui versions every distributable package together. Until now that meant
 * hand-editing 15 files per release (docs/RELEASING.md listed them as a
 * checklist), and a missed one shipped a package whose `version` disagreed with
 * its tarball, its plugin manifest, or the version its own MCP server reports.
 *
 * Sites, all DERIVED rather than hard-coded so a new package joins automatically:
 *   - the root package.json
 *   - every distributable package.json — one with `publishConfig`, or one that
 *     is not `private` (that is the 11 component packages + the CLI; apps and
 *     the eslint/typescript config packages have neither and stay off the train)
 *   - .claude-plugin/plugin.json and .claude-plugin/marketplace.json
 *   - SERVER_INFO.version in packages/cli/lib/mcp.mjs — the version the MCP
 *     server reports to an agent, which silently drifted before
 *
 * Usage:
 *   node scripts/set-version.mjs 1.10.0     write the version everywhere
 *   node scripts/set-version.mjs --check    verify every site agrees (CI gate)
 *
 * Dependency-free; ESM; cwd-independent.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { distributablePackages, isDistributable } from "./lib/distributables.mjs";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** Semver, optionally with a prerelease (1.10.0-rc.0). Build metadata is out. */
export const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/**
 * A package is on the lockstep train when it can be distributed: it declares
 * `publishConfig`, or it is not marked private. Apps and config-only packages
 * are neither, so they keep their own independent 0.1.0.
 *
 * THE predicate now lives in `scripts/lib/distributables.mjs` (#295) — every
 * caller (this writer, `check-publish-ready`, `release-snapshot`, and through it
 * the release workflow's pack step) imports that one definition. Re-exported
 * here so the existing import path keeps working.
 */
export { isDistributable };

/** Every version site: `{ file, get(text), set(text, version) }`. */
export function versionSites(root = REPO_ROOT) {
  const sites = [];

  const jsonVersion = (file) => ({
    file,
    get: (text) => JSON.parse(text).version,
    set: (text, version) => {
      // Rewrite the literal so key order and formatting survive untouched.
      const current = JSON.parse(text).version;
      return text.replace(`"version": "${current}"`, `"version": "${version}"`);
    },
  });

  sites.push(jsonVersion("package.json"));

  for (const pkg of distributablePackages(root)) {
    sites.push(jsonVersion(join(pkg.relDir, "package.json")));
  }

  // The plugin manifests. marketplace.json nests the version inside a plugin
  // entry, so it is matched positionally rather than at the top level.
  sites.push(jsonVersion(".claude-plugin/plugin.json"));
  sites.push({
    file: ".claude-plugin/marketplace.json",
    get: (text) => text.match(/"version":\s*"([^"]+)"/)?.[1],
    set: (text, version) => text.replace(/("version":\s*)"[^"]+"/, `$1"${version}"`),
  });

  // The version the MCP server reports to agents.
  sites.push({
    file: "packages/cli/lib/mcp.mjs",
    get: (text) => text.match(/SERVER_INFO\s*=\s*\{[^}]*version:\s*"([^"]+)"/)?.[1],
    set: (text, version) =>
      text.replace(/(SERVER_INFO\s*=\s*\{[^}]*version:\s*)"[^"]+"/, `$1"${version}"`),
  });

  return sites;
}

// ──────────────────────────────── CLI ─────────────────────────────────────────
function main(argv) {
  const check = argv.includes("--check");
  const version = argv.find((a) => !a.startsWith("--"));

  if (!check && !version) {
    console.error("usage: set-version.mjs <version> | --check");
    return 1;
  }
  if (version && !SEMVER.test(version)) {
    console.error(`✖ set-version: "${version}" is not a valid semver (e.g. 1.10.0, 1.10.0-rc.0).`);
    return 1;
  }

  const sites = versionSites();
  const missing = sites.filter((s) => !existsSync(join(REPO_ROOT, s.file)));
  if (missing.length > 0) {
    console.error(
      `✖ set-version: missing version site(s): ${missing.map((m) => m.file).join(", ")}`,
    );
    return 1;
  }

  const read = (s) => s.get(readFileSync(join(REPO_ROOT, s.file), "utf8"));

  if (check) {
    const root = read(sites[0]);
    const wrong = sites.filter((s) => read(s) !== root);
    if (wrong.length > 0) {
      console.error(`✖ version: ${wrong.length} site(s) disagree with the root version ${root}:`);
      for (const s of wrong) console.error(`    ${s.file} — ${read(s) ?? "(unreadable)"}`);
      console.error("\n  Fix: pnpm version:set " + root);
      return 1;
    }
    console.log(`✔ version: all ${sites.length} lockstep site(s) agree on ${root}.`);
    return 0;
  }

  let changed = 0;
  for (const s of sites) {
    const path = join(REPO_ROOT, s.file);
    const before = readFileSync(path, "utf8");
    const after = s.set(before, version);
    if (s.get(after) !== version) {
      console.error(`✖ set-version: could not rewrite ${s.file} (pattern did not match).`);
      return 1;
    }
    if (after !== before) {
      writeFileSync(path, after);
      changed++;
    }
  }
  console.log(`✔ version: ${version} written to ${sites.length} site(s) (${changed} changed).`);
  console.log("  Next: update CHANGELOG.md's ## Unreleased heading, then commit and tag.");
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
