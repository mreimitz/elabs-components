// Self-test for publish-registry-pages.mjs's pure planning logic (#31).
// No git, no filesystem — see check-registry-published.test.mjs for the
// companion gate's tests, and publish-registry-pages.mjs's header comment for
// why this ships as a `gh-pages` branch push rather than `actions/deploy-pages`.
import test from "node:test";
import assert from "node:assert/strict";
import { planRegistrySite, hostedUrl } from "./publish-registry-pages.mjs";

test("planRegistrySite: computes a versioned dir and a latest alias", () => {
  const plan = planRegistrySite({
    builtFiles: ["app-shell.json", "registry.json"],
    version: "4.0.0",
  });
  assert.equal(plan.versionDir, "r/4.0.0");
  assert.equal(plan.latestDir, "r/latest");
  assert.deepEqual(plan.files, ["app-shell.json", "registry.json"]);
});

test("planRegistrySite: sorts the file list (deterministic output)", () => {
  const plan = planRegistrySite({
    builtFiles: ["z.json", "a.json"],
    version: "1.0.0",
  });
  assert.deepEqual(plan.files, ["a.json", "z.json"]);
});

test("planRegistrySite: rejects an empty file list", () => {
  assert.throws(() => planRegistrySite({ builtFiles: [], version: "1.0.0" }), /non-empty array/);
});

test("planRegistrySite: rejects a non-semver-shaped version", () => {
  assert.throws(
    () => planRegistrySite({ builtFiles: ["a.json"], version: "latest" }),
    /semver-shaped/,
  );
  assert.throws(() => planRegistrySite({ builtFiles: ["a.json"], version: "" }), /semver-shaped/);
});

test("planRegistrySite: accepts a pre-release/build suffix", () => {
  const plan = planRegistrySite({ builtFiles: ["a.json"], version: "4.0.0-rc.1" });
  assert.equal(plan.versionDir, "r/4.0.0-rc.1");
});

test("hostedUrl: builds the versioned URL for one file", () => {
  assert.equal(
    hostedUrl({
      baseUrl: "https://mreimitz.github.io/elabs-components/r",
      version: "4.0.0",
      file: "app-shell.json",
    }),
    "https://mreimitz.github.io/elabs-components/r/4.0.0/app-shell.json",
  );
});

test("hostedUrl: tolerates a trailing slash on baseUrl", () => {
  assert.equal(
    hostedUrl({
      baseUrl: "https://mreimitz.github.io/elabs-components/r/",
      version: "latest",
      file: "app-shell.json",
    }),
    "https://mreimitz.github.io/elabs-components/r/latest/app-shell.json",
  );
});
