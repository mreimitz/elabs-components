/**
 * sync-version-extras.test.mjs — locks the non-package lockstep sites Changesets
 * cannot bump (root, plugin manifests, MCP SERVER_INFO).
 * Run: `node --test scripts/sync-version-extras.test.mjs`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REPO_ROOT } from "./lib/distributables.mjs";
import { extraSites, groupVersion, syncVersionExtras } from "./sync-version-extras.mjs";

function write(root, rel, text) {
  mkdirSync(join(root, rel, ".."), { recursive: true });
  writeFileSync(join(root, rel), text);
}

/** A minimal repo: two fixed-group packages, one private config package, the extras. */
function fixture({ pkgVersions = ["2.0.0", "2.0.0"], extras = "1.0.0" } = {}) {
  const root = mkdtempSync(join(tmpdir(), "version-sync-"));
  write(
    root,
    "package.json",
    `{\n  "name": "root",\n  "version": "${extras}",\n  "private": true\n}\n`,
  );
  pkgVersions.forEach((v, i) =>
    write(
      root,
      `packages/p${i}/package.json`,
      `{\n  "name": "@s/p${i}",\n  "version": "${v}",\n  "publishConfig": {}\n}\n`,
    ),
  );
  write(
    root,
    "packages/config/package.json",
    `{\n  "name": "@s/config",\n  "version": "0.1.0",\n  "private": true\n}\n`,
  );
  write(root, ".claude-plugin/plugin.json", `{\n  "name": "x",\n  "version": "${extras}"\n}\n`);
  write(
    root,
    ".claude-plugin/marketplace.json",
    `{\n  "name": "m",\n  "plugins": [\n    { "name": "x", "version": "${extras}", "source": "./" }\n  ]\n}\n`,
  );
  write(
    root,
    "packages/cli/lib/mcp.mjs",
    `export const SERVER_INFO = { name: "brand-ui", version: "${extras}" };\n`,
  );
  return root;
}

test("the group version ignores private config packages", () => {
  const root = fixture();
  try {
    assert.deepEqual(groupVersion(root), { version: "2.0.0", error: null });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a split fixed group is an error, never a guess", () => {
  const root = fixture({ pkgVersions: ["2.0.0", "2.0.1"] });
  try {
    const r = syncVersionExtras({ root });
    assert.equal(r.errors.length, 1);
    assert.match(r.errors[0], /disagree/);
    assert.equal(JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version, "1.0.0");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("--check reports drift without writing; sync then stamps every site", () => {
  const root = fixture();
  try {
    const checked = syncVersionExtras({ root, check: true });
    assert.deepEqual(
      checked.drift.map((d) => d.file),
      extraSites().map((s) => s.file),
    );
    assert.equal(checked.changed.length, 0);

    const synced = syncVersionExtras({ root });
    assert.deepEqual(synced.errors, []);
    assert.equal(synced.changed.length, 4);
    for (const site of extraSites()) {
      assert.equal(site.get(readFileSync(join(root, site.file), "utf8")), "2.0.0", site.file);
    }
    assert.match(readFileSync(join(root, "package.json"), "utf8"), /"private": true/);
    assert.deepEqual(syncVersionExtras({ root, check: true }).drift, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("every site rewrite is byte-stable on the real repo files", () => {
  for (const site of extraSites()) {
    const text = readFileSync(join(REPO_ROOT, site.file), "utf8");
    const before = site.get(text);
    assert.ok(before, `${site.file}: get() found no version`);
    const rewritten = site.set(text, "9.9.9-test.0");
    assert.equal(site.get(rewritten), "9.9.9-test.0", `${site.file}: set() did not take`);
    assert.equal(site.set(rewritten, before), text, `${site.file}: not byte-stable`);
  }
});

test("the committed tree is in sync right now", () => {
  const r = syncVersionExtras({ root: REPO_ROOT, check: true });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.drift, [], `drift: ${JSON.stringify(r.drift)}`);
});

test(".changeset/config.json's fixed group is exactly the distributable packages", async () => {
  const { distributablePackages } = await import("./lib/distributables.mjs");
  const config = JSON.parse(readFileSync(join(REPO_ROOT, ".changeset", "config.json"), "utf8"));
  assert.equal(config.fixed.length, 1, "one lockstep group");
  assert.deepEqual(
    [...config.fixed[0]].sort(),
    distributablePackages(REPO_ROOT)
      .map((p) => p.name)
      .sort(),
    "a new distributable must join the fixed group (and a removed one leave it)",
  );
  assert.equal(config.access, "public");
});
