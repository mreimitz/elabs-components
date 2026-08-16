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

test("FLAGS: a domain→sibling edge (@elabs-ai/components-data deps @elabs-ai/components-charts)", () => {
  const v = violationsFor([
    {
      name: "@elabs-ai/components-data",
      dependencies: { "@elabs-ai/components-charts": "workspace:*" },
    },
  ]);
  assert.equal(v.length, 1);
  assert.equal(v[0].from, "@elabs-ai/components-data");
  assert.equal(v[0].to, "@elabs-ai/components-charts");
});

test("FLAGS: an upward edge (@elabs-ai/components-ui deps @elabs-ai/components-data)", () => {
  const v = violationsFor([
    {
      name: "@elabs-ai/components-ui",
      dependencies: { "@elabs-ai/components-data": "workspace:*" },
    },
  ]);
  assert.equal(v.length, 1);
  assert.equal(v[0].from, "@elabs-ai/components-ui");
  assert.equal(v[0].to, "@elabs-ai/components-data");
});

test("FLAGS: @elabs-ai/components-charts deps @elabs-ai/components-data specifically (ADR 0012 / chart-components.md)", () => {
  const v = violationsFor([
    {
      name: "@elabs-ai/components-charts",
      peerDependencies: { "@elabs-ai/components-data": "workspace:*" },
    },
  ]);
  assert.equal(v.length, 1);
  assert.equal(v[0].from, "@elabs-ai/components-charts");
  assert.equal(v[0].to, "@elabs-ai/components-data");
});

test("FLAGS: @elabs-ai/components-tokens deps @elabs-ai/components-ui (foundation depending on layer 1)", () => {
  const v = violationsFor([
    {
      name: "@elabs-ai/components-tokens",
      dependencies: { "@elabs-ai/components-ui": "workspace:*" },
    },
  ]);
  assert.equal(v.length, 1);
  assert.equal(v[0].from, "@elabs-ai/components-tokens");
  assert.equal(v[0].to, "@elabs-ai/components-ui");
});

test("FLAGS: a @elabs-ai/components-* package missing from ALLOWED", () => {
  const v = violationsFor([{ name: "@elabs-ai/components-newthing", dependencies: {} }]);
  assert.equal(v.length, 1);
  assert.equal(v[0].from, "@elabs-ai/components-newthing");
  assert.equal(v[0].to, null);
  assert.match(v[0].reason, /not registered in ALLOWED/);
});

// ── DOES NOT FLAG ─────────────────────────────────────────────────────────────

test("DOES NOT FLAG: every real current edge (the manifests documented in the issue)", () => {
  const manifests = [
    { name: "@elabs-ai/components-tokens" },
    { name: "@elabs-ai/components-icons" },
    {
      name: "@elabs-ai/components-ui",
      peerDependencies: { "@elabs-ai/components-tokens": "workspace:*" },
    },
    {
      name: "@elabs-ai/components-data",
      peerDependencies: {
        "@elabs-ai/components-tokens": "workspace:*",
        "@elabs-ai/components-icons": "workspace:*",
        "@elabs-ai/components-ui": "workspace:*",
      },
    },
    {
      name: "@elabs-ai/components-ai",
      peerDependencies: {
        "@elabs-ai/components-tokens": "workspace:*",
        "@elabs-ai/components-ui": "workspace:*",
      },
    },
    {
      name: "@elabs-ai/components-charts",
      peerDependencies: {
        "@elabs-ai/components-tokens": "workspace:*",
        "@elabs-ai/components-ui": "workspace:*",
      },
    },
  ];
  assert.deepEqual(violationsFor(manifests), []);
});

test("DOES NOT FLAG: a devDependencies-only sibling edge (story/test composition)", () => {
  const v = violationsFor([
    {
      name: "@elabs-ai/components-ai",
      peerDependencies: {
        "@elabs-ai/components-tokens": "workspace:*",
        "@elabs-ai/components-ui": "workspace:*",
      },
      devDependencies: { "@elabs-ai/components-charts": "workspace:*" },
    },
  ]);
  assert.deepEqual(v, []);
});

test("DOES NOT FLAG: @elabs-ai/components-eslint-config / @elabs-ai/components-typescript-config deps", () => {
  const v = violationsFor([
    {
      name: "@elabs-ai/components-eslint-config",
      dependencies: { "@elabs-ai/components-ui": "workspace:*" },
    },
    {
      name: "@elabs-ai/components-ui",
      devDependencies: { "@elabs-ai/components-eslint-config": "workspace:*" },
    },
  ]);
  assert.deepEqual(v, []);
});

test("DOES NOT FLAG: non-@elabs-ai/components-* third-party deps", () => {
  const v = violationsFor([
    {
      name: "@elabs-ai/components-flow",
      peerDependencies: {
        "@elabs-ai/components-tokens": "workspace:*",
        "@elabs-ai/components-ui": "workspace:*",
      },
      dependencies: { "@xyflow/react": "^12.0.0", ai: "^4.0.0", "monaco-editor": "^0.50.0" },
    },
  ]);
  assert.deepEqual(v, []);
});

test("DOES NOT FLAG: non-@elabs-ai/components-* package.json (e.g. an app manifest) is ignored", () => {
  const v = violationsFor([
    { name: "some-app", dependencies: { "@elabs-ai/components-ui": "workspace:*" } },
  ]);
  assert.deepEqual(v, []);
});

// ── shape sanity ───────────────────────────────────────────────────────────────

test("ALLOWED / TOOLING_PACKAGES shape sanity", () => {
  assert.deepEqual(ALLOWED["@elabs-ai/components-tokens"], []);
  assert.deepEqual(ALLOWED["@elabs-ai/components-icons"], []);
  assert.ok(!ALLOWED["@elabs-ai/components-charts"].includes("@elabs-ai/components-data"));
  assert.ok(TOOLING_PACKAGES.has("@elabs-ai/components-eslint-config"));
  assert.ok(TOOLING_PACKAGES.has("@elabs-ai/components-typescript-config"));
});

// ── CLI: the REAL repo currently passes the gate (verified dry-run) ────────────

test("the REAL repo currently passes dep-direction:check (CLI run)", () => {
  const out = execFileSync("node", [join(HERE, "check-dep-direction.mjs")], { encoding: "utf8" });
  assert.match(out, /✔ dep-direction/);
});
