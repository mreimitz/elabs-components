// check-lockfile-dup-keys.test.mjs — self-test for the lockfile dup-key gate (#201).
// -----------------------------------------------------------------------------
// A gate that can silently stop firing is worse than none (quality-gates.md,
// "Self-tested gates"): plant bad fixtures and assert the scanner FAILS them,
// plus good fixtures (including the shapes pnpm-lock.yaml legitimately uses)
// and assert it passes them.
//
// Run: node --test scripts/check-lockfile-dup-keys.test.mjs   (pnpm lockfile:check:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { findDuplicateLockfileKeys } from "./check-lockfile-dup-keys.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

test("clean nested mapping → no violations", () => {
  const yaml = [
    "lockfileVersion: '9.0'",
    "packages:",
    "  '@babel/core@7.0.0':",
    "    resolution: {integrity: sha512-a}",
    "  '@babel/parser@7.0.0':",
    "    resolution: {integrity: sha512-b}",
    "snapshots:",
    "  '@babel/core@7.0.0':",
    "    dependencies:",
    "      '@babel/parser': 7.0.0",
  ].join("\n");
  assert.deepEqual(findDuplicateLockfileKeys(yaml), []);
});

test("the 7f5ead8 failure mode — duplicated sibling block under packages: → FAILS", () => {
  const yaml = [
    "packages:",
    "  '@babel/core@7.0.0':",
    "    resolution: {integrity: sha512-a}",
    "  '@babel/parser@7.0.0':",
    "    resolution: {integrity: sha512-b}",
    "  '@babel/core@7.0.0':",
    "    resolution: {integrity: sha512-a}",
  ].join("\n");
  const v = findDuplicateLockfileKeys(yaml);
  assert.equal(v.length, 1);
  assert.equal(v[0].key, "'@babel/core@7.0.0'");
  assert.equal(v[0].parent, "packages");
  assert.deepEqual(v[0].lines, [2, 6]);
});

test("same key under DIFFERENT parents (packages: vs snapshots:) is legitimate", () => {
  const yaml = [
    "packages:",
    "  'foo@1.0.0':",
    "    resolution: {integrity: sha512-a}",
    "snapshots:",
    "  'foo@1.0.0':",
    "    dependencies: {}",
  ].join("\n");
  assert.deepEqual(findDuplicateLockfileKeys(yaml), []);
});

test("duplicate at a NESTED level (importer dependencies) is caught", () => {
  const yaml = [
    "importers:",
    "  packages/ui:",
    "    dependencies:",
    "      react:",
    "        specifier: ^19.0.0",
    "        version: 19.0.0",
    "      react:",
    "        specifier: ^19.0.0",
    "        version: 19.0.0",
  ].join("\n");
  const v = findDuplicateLockfileKeys(yaml);
  assert.equal(v.length, 1);
  assert.equal(v[0].key, "react");
  assert.equal(v[0].parent, "dependencies");
});

test("block scalars and comments cannot fake keys; sequence items are ignored", () => {
  const yaml = [
    "packages:",
    "  'a@1.0.0':",
    "    notes: |",
    "      fake:",
    "      fake:",
    "    # fake:",
    "    os:",
    "      - linux",
    "      - linux",
  ].join("\n");
  assert.deepEqual(findDuplicateLockfileKeys(yaml), []);
});

test("the REAL pnpm-lock.yaml currently passes the gate", () => {
  const lockfile = readFileSync(path.resolve(HERE, "../pnpm-lock.yaml"), "utf8");
  assert.deepEqual(findDuplicateLockfileKeys(lockfile), []);
});
