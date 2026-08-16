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

test("FLAGS: a domain→sibling edge (@qlik-coe-emea/qlabs-components-data deps @qlik-coe-emea/qlabs-components-charts)", () => {
  const v = violationsFor([
    {
      name: "@qlik-coe-emea/qlabs-components-data",
      dependencies: { "@qlik-coe-emea/qlabs-components-charts": "workspace:*" },
    },
  ]);
  assert.equal(v.length, 1);
  assert.equal(v[0].from, "@qlik-coe-emea/qlabs-components-data");
  assert.equal(v[0].to, "@qlik-coe-emea/qlabs-components-charts");
});

test("FLAGS: an upward edge (@qlik-coe-emea/qlabs-components-ui deps @qlik-coe-emea/qlabs-components-data)", () => {
  const v = violationsFor([
    {
      name: "@qlik-coe-emea/qlabs-components-ui",
      dependencies: { "@qlik-coe-emea/qlabs-components-data": "workspace:*" },
    },
  ]);
  assert.equal(v.length, 1);
  assert.equal(v[0].from, "@qlik-coe-emea/qlabs-components-ui");
  assert.equal(v[0].to, "@qlik-coe-emea/qlabs-components-data");
});

test("FLAGS: @qlik-coe-emea/qlabs-components-charts deps @qlik-coe-emea/qlabs-components-data specifically (ADR 0012 / chart-components.md)", () => {
  const v = violationsFor([
    {
      name: "@qlik-coe-emea/qlabs-components-charts",
      peerDependencies: { "@qlik-coe-emea/qlabs-components-data": "workspace:*" },
    },
  ]);
  assert.equal(v.length, 1);
  assert.equal(v[0].from, "@qlik-coe-emea/qlabs-components-charts");
  assert.equal(v[0].to, "@qlik-coe-emea/qlabs-components-data");
});

test("FLAGS: @qlik-coe-emea/qlabs-components-tokens deps @qlik-coe-emea/qlabs-components-ui (foundation depending on layer 1)", () => {
  const v = violationsFor([
    {
      name: "@qlik-coe-emea/qlabs-components-tokens",
      dependencies: { "@qlik-coe-emea/qlabs-components-ui": "workspace:*" },
    },
  ]);
  assert.equal(v.length, 1);
  assert.equal(v[0].from, "@qlik-coe-emea/qlabs-components-tokens");
  assert.equal(v[0].to, "@qlik-coe-emea/qlabs-components-ui");
});

test("FLAGS: a @qlik-coe-emea/qlabs-components-* package missing from ALLOWED", () => {
  const v = violationsFor([{ name: "@qlik-coe-emea/qlabs-components-newthing", dependencies: {} }]);
  assert.equal(v.length, 1);
  assert.equal(v[0].from, "@qlik-coe-emea/qlabs-components-newthing");
  assert.equal(v[0].to, null);
  assert.match(v[0].reason, /not registered in ALLOWED/);
});

// ── DOES NOT FLAG ─────────────────────────────────────────────────────────────

test("DOES NOT FLAG: every real current edge (the manifests documented in the issue)", () => {
  const manifests = [
    { name: "@qlik-coe-emea/qlabs-components-tokens" },
    { name: "@qlik-coe-emea/qlabs-components-icons" },
    {
      name: "@qlik-coe-emea/qlabs-components-ui",
      peerDependencies: { "@qlik-coe-emea/qlabs-components-tokens": "workspace:*" },
    },
    {
      name: "@qlik-coe-emea/qlabs-components-data",
      peerDependencies: {
        "@qlik-coe-emea/qlabs-components-tokens": "workspace:*",
        "@qlik-coe-emea/qlabs-components-icons": "workspace:*",
        "@qlik-coe-emea/qlabs-components-ui": "workspace:*",
      },
    },
    {
      name: "@qlik-coe-emea/qlabs-components-ai",
      peerDependencies: {
        "@qlik-coe-emea/qlabs-components-tokens": "workspace:*",
        "@qlik-coe-emea/qlabs-components-ui": "workspace:*",
      },
    },
    {
      name: "@qlik-coe-emea/qlabs-components-charts",
      peerDependencies: {
        "@qlik-coe-emea/qlabs-components-tokens": "workspace:*",
        "@qlik-coe-emea/qlabs-components-ui": "workspace:*",
      },
    },
  ];
  assert.deepEqual(violationsFor(manifests), []);
});

test("DOES NOT FLAG: a devDependencies-only sibling edge (story/test composition)", () => {
  const v = violationsFor([
    {
      name: "@qlik-coe-emea/qlabs-components-ai",
      peerDependencies: {
        "@qlik-coe-emea/qlabs-components-tokens": "workspace:*",
        "@qlik-coe-emea/qlabs-components-ui": "workspace:*",
      },
      devDependencies: { "@qlik-coe-emea/qlabs-components-charts": "workspace:*" },
    },
  ]);
  assert.deepEqual(v, []);
});

test("DOES NOT FLAG: @qlik-coe-emea/qlabs-components-eslint-config / @qlik-coe-emea/qlabs-components-typescript-config deps", () => {
  const v = violationsFor([
    {
      name: "@qlik-coe-emea/qlabs-components-eslint-config",
      dependencies: { "@qlik-coe-emea/qlabs-components-ui": "workspace:*" },
    },
    {
      name: "@qlik-coe-emea/qlabs-components-ui",
      devDependencies: { "@qlik-coe-emea/qlabs-components-eslint-config": "workspace:*" },
    },
  ]);
  assert.deepEqual(v, []);
});

test("DOES NOT FLAG: non-@qlik-coe-emea/qlabs-components-* third-party deps", () => {
  const v = violationsFor([
    {
      name: "@qlik-coe-emea/qlabs-components-flow",
      peerDependencies: {
        "@qlik-coe-emea/qlabs-components-tokens": "workspace:*",
        "@qlik-coe-emea/qlabs-components-ui": "workspace:*",
      },
      dependencies: { "@xyflow/react": "^12.0.0", ai: "^4.0.0", "monaco-editor": "^0.50.0" },
    },
  ]);
  assert.deepEqual(v, []);
});

test("DOES NOT FLAG: non-@qlik-coe-emea/qlabs-components-* package.json (e.g. an app manifest) is ignored", () => {
  const v = violationsFor([
    { name: "some-app", dependencies: { "@qlik-coe-emea/qlabs-components-ui": "workspace:*" } },
  ]);
  assert.deepEqual(v, []);
});

// ── shape sanity ───────────────────────────────────────────────────────────────

test("ALLOWED / TOOLING_PACKAGES shape sanity", () => {
  assert.deepEqual(ALLOWED["@qlik-coe-emea/qlabs-components-tokens"], []);
  assert.deepEqual(ALLOWED["@qlik-coe-emea/qlabs-components-icons"], []);
  assert.ok(
    !ALLOWED["@qlik-coe-emea/qlabs-components-charts"].includes(
      "@qlik-coe-emea/qlabs-components-data",
    ),
  );
  assert.ok(TOOLING_PACKAGES.has("@qlik-coe-emea/qlabs-components-eslint-config"));
  assert.ok(TOOLING_PACKAGES.has("@qlik-coe-emea/qlabs-components-typescript-config"));
});

// ── CLI: the REAL repo currently passes the gate (verified dry-run) ────────────

test("the REAL repo currently passes dep-direction:check (CLI run)", () => {
  const out = execFileSync("node", [join(HERE, "check-dep-direction.mjs")], { encoding: "utf8" });
  assert.match(out, /✔ dep-direction/);
});
