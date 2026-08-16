/**
 * set-version.test.mjs — locks the lockstep-version writer.
 * Run in CI: `node --test scripts/set-version.test.mjs`.
 *
 * The failure this guards: a release where one of the 16 sites was missed by
 * hand, shipping a package whose version disagreed with its plugin manifest or
 * with the version its own MCP server reports to agents.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SEMVER, isDistributable, versionSites } from "./set-version.mjs";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

test("accepts releases and prereleases, rejects junk", () => {
  for (const ok of ["1.9.0", "1.10.0", "2.0.0-rc.0", "1.0.0-alpha.1"]) {
    assert.ok(SEMVER.test(ok), `${ok} should be valid`);
  }
  for (const bad of ["1.9", "v1.9.0", "1.9.0.1", "latest", "", "1.9.0 "]) {
    assert.ok(!SEMVER.test(bad), `${bad} should be rejected`);
  }
});

test("the lockstep train is derived, not hard-coded", () => {
  // Distributable: has publishConfig, or isn't private.
  assert.ok(
    isDistributable({ publishConfig: { exports: {} }, private: true }),
    "component package",
  );
  assert.ok(
    isDistributable({ name: "@elabs/components-cli" }),
    "the CLI — not private, no publishConfig",
  );
  // Off the train: private with nothing to publish (apps, config packages).
  assert.ok(!isDistributable({ private: true }), "an app");
  assert.ok(
    !isDistributable({ private: true, name: "@elabs/components-eslint-config" }),
    "config package",
  );
});

test("every derived site exists on disk", () => {
  for (const s of versionSites()) {
    assert.ok(existsSync(join(REPO_ROOT, s.file)), `${s.file} should exist`);
  }
});

test("covers the sites a hand-edit historically missed", () => {
  const files = versionSites().map((s) => s.file);
  for (const required of [
    "package.json",
    ".claude-plugin/plugin.json",
    ".claude-plugin/marketplace.json",
    "packages/cli/lib/mcp.mjs",
    "packages/cli/package.json",
    "packages/tokens/package.json",
    "packages/ui/package.json",
  ]) {
    assert.ok(files.includes(required), `${required} must be on the train`);
  }
  // Apps and config-only packages must NOT be dragged onto the release version.
  for (const excluded of [
    "packages/eslint-config/package.json",
    "packages/typescript-config/package.json",
  ]) {
    assert.ok(!files.includes(excluded), `${excluded} must stay off the train`);
  }
});

test("set() is exact and get() round-trips, for every site shape", () => {
  for (const site of versionSites()) {
    const text = readFileSync(join(REPO_ROOT, site.file), "utf8");
    const before = site.get(text);
    assert.ok(before, `${site.file}: get() found no version`);

    const rewritten = site.set(text, "9.9.9-test.0");
    assert.equal(site.get(rewritten), "9.9.9-test.0", `${site.file}: set() did not take`);
    assert.notEqual(rewritten, text, `${site.file}: set() changed nothing`);

    // Round-trip must restore the file byte-for-byte — no reformatting.
    assert.equal(site.set(rewritten, before), text, `${site.file}: not byte-stable`);
  }
});

test("a JSON site rewrite touches ONLY the version line", () => {
  const site = versionSites().find((s) => s.file === "packages/ui/package.json");
  const text = readFileSync(join(REPO_ROOT, site.file), "utf8");
  const changed = site.set(text, "9.9.9");
  const diff = text.split("\n").filter((l, i) => l !== changed.split("\n")[i]);
  assert.equal(diff.length, 1, "exactly one line may differ");
  assert.match(diff[0], /"version"/);
});

test("the committed tree is self-consistent right now", () => {
  const sites = versionSites();
  const root = sites[0].get(readFileSync(join(REPO_ROOT, sites[0].file), "utf8"));
  for (const s of sites) {
    const v = s.get(readFileSync(join(REPO_ROOT, s.file), "utf8"));
    assert.equal(v, root, `${s.file} is ${v}, root is ${root} — run pnpm version:set ${root}`);
  }
});
