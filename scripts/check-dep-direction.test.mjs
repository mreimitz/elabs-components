/**
 * check-dep-direction.test.mjs — locks the #184 one-way package DAG gate.
 * Run in CI: `node --test scripts/check-dep-direction.test.mjs` (`pnpm dep-direction:check:test`).
 *
 * All fixtures are INLINE manifest objects (hermetic — never real files), mirroring
 * check-charts-reuse.test.mjs. Also runs the CLI once against the real repo to
 * confirm today's manifests are clean (per the issue's "verified dry-run" note).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { findDepDirectionViolations, ALLOWED, TOOLING_PACKAGES } from "./check-dep-direction.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

function violationsFor(manifests) {
  return findDepDirectionViolations(manifests);
}

// ── FLAGS ────────────────────────────────────────────────────────────────────

test("FLAGS: a domain→sibling edge (@elabs/components-data deps @elabs/components-charts)", () => {
  const v = violationsFor([
    {
      name: "@elabs/components-data",
      dependencies: { "@elabs/components-charts": "workspace:*" },
    },
  ]);
  assert.equal(v.length, 1);
  assert.equal(v[0].from, "@elabs/components-data");
  assert.equal(v[0].to, "@elabs/components-charts");
});

test("FLAGS: an upward edge (@elabs/components-ui deps @elabs/components-data)", () => {
  const v = violationsFor([
    {
      name: "@elabs/components-ui",
      dependencies: { "@elabs/components-data": "workspace:*" },
    },
  ]);
  assert.equal(v.length, 1);
  assert.equal(v[0].from, "@elabs/components-ui");
  assert.equal(v[0].to, "@elabs/components-data");
});

test("FLAGS: @elabs/components-charts deps @elabs/components-data specifically (ADR 0012 / chart-components.md)", () => {
  const v = violationsFor([
    {
      name: "@elabs/components-charts",
      peerDependencies: { "@elabs/components-data": "workspace:*" },
    },
  ]);
  assert.equal(v.length, 1);
  assert.equal(v[0].from, "@elabs/components-charts");
  assert.equal(v[0].to, "@elabs/components-data");
});

test("FLAGS: @elabs/components-tokens deps @elabs/components-ui (foundation depending on layer 1)", () => {
  const v = violationsFor([
    {
      name: "@elabs/components-tokens",
      dependencies: { "@elabs/components-ui": "workspace:*" },
    },
  ]);
  assert.equal(v.length, 1);
  assert.equal(v[0].from, "@elabs/components-tokens");
  assert.equal(v[0].to, "@elabs/components-ui");
});

test("FLAGS: a @elabs/components-* package missing from ALLOWED", () => {
  const v = violationsFor([{ name: "@elabs/components-newthing", dependencies: {} }]);
  assert.equal(v.length, 1);
  assert.equal(v[0].from, "@elabs/components-newthing");
  assert.equal(v[0].to, null);
  assert.match(v[0].reason, /not registered in ALLOWED/);
});

// ── DOES NOT FLAG ─────────────────────────────────────────────────────────────

test("DOES NOT FLAG: every real current edge (the manifests documented in the issue)", () => {
  const manifests = [
    { name: "@elabs/components-tokens" },
    { name: "@elabs/components-icons" },
    {
      name: "@elabs/components-ui",
      peerDependencies: { "@elabs/components-tokens": "workspace:*" },
    },
    {
      name: "@elabs/components-data",
      peerDependencies: {
        "@elabs/components-tokens": "workspace:*",
        "@elabs/components-icons": "workspace:*",
        "@elabs/components-ui": "workspace:*",
      },
    },
    {
      name: "@elabs/components-ai",
      peerDependencies: {
        "@elabs/components-tokens": "workspace:*",
        "@elabs/components-ui": "workspace:*",
      },
    },
    {
      name: "@elabs/components-charts",
      peerDependencies: {
        "@elabs/components-tokens": "workspace:*",
        "@elabs/components-ui": "workspace:*",
      },
    },
  ];
  assert.deepEqual(violationsFor(manifests), []);
});

test("DOES NOT FLAG: a devDependencies-only sibling edge (story/test composition)", () => {
  const v = violationsFor([
    {
      name: "@elabs/components-ai",
      peerDependencies: {
        "@elabs/components-tokens": "workspace:*",
        "@elabs/components-ui": "workspace:*",
      },
      devDependencies: { "@elabs/components-charts": "workspace:*" },
    },
  ]);
  assert.deepEqual(v, []);
});

test("DOES NOT FLAG: @elabs/components-eslint-config / @elabs/components-typescript-config deps", () => {
  const v = violationsFor([
    {
      name: "@elabs/components-eslint-config",
      dependencies: { "@elabs/components-ui": "workspace:*" },
    },
    {
      name: "@elabs/components-ui",
      devDependencies: { "@elabs/components-eslint-config": "workspace:*" },
    },
  ]);
  assert.deepEqual(v, []);
});

test("DOES NOT FLAG: non-@elabs/components-* third-party deps", () => {
  const v = violationsFor([
    {
      name: "@elabs/components-flow",
      peerDependencies: {
        "@elabs/components-tokens": "workspace:*",
        "@elabs/components-ui": "workspace:*",
      },
      dependencies: { "@xyflow/react": "^12.0.0", ai: "^4.0.0", "monaco-editor": "^0.50.0" },
    },
  ]);
  assert.deepEqual(v, []);
});

test("DOES NOT FLAG: non-@elabs/components-* package.json (e.g. an app manifest) is ignored", () => {
  const v = violationsFor([
    { name: "some-app", dependencies: { "@elabs/components-ui": "workspace:*" } },
  ]);
  assert.deepEqual(v, []);
});

// ── shape sanity ───────────────────────────────────────────────────────────────

test("ALLOWED / TOOLING_PACKAGES shape sanity", () => {
  assert.deepEqual(ALLOWED["@elabs/components-tokens"], []);
  assert.deepEqual(ALLOWED["@elabs/components-icons"], []);
  assert.ok(!ALLOWED["@elabs/components-charts"].includes("@elabs/components-data"));
  assert.ok(TOOLING_PACKAGES.has("@elabs/components-eslint-config"));
  assert.ok(TOOLING_PACKAGES.has("@elabs/components-typescript-config"));
});

// ── CLI: the REAL repo currently passes the gate (verified dry-run) ────────────

test("the REAL repo currently passes dep-direction:check (CLI run)", () => {
  const out = execFileSync("node", [join(HERE, "check-dep-direction.mjs")], { encoding: "utf8" });
  assert.match(out, /✔ dep-direction/);
});
