/**
 * check-publish-ready.test.mjs — locks the publish-readiness preflight.
 * Run in CI: `node --test scripts/check-publish-ready.test.mjs`.
 *
 * The failure this guards is the worst one in a release: npm versions are
 * immutable, so if packages 1-6 publish and 7 is rejected, the release cannot be
 * undone. Every blocker below must be caught BEFORE anything is tagged.
 *
 * The fixtures deliberately use a MADE-UP scope/owner rather than this repo's
 * own. These rules are about the scope-equals-owner relationship, not about any
 * particular name — pinning them to the live scope is what made this file break
 * the moment the repo was renamed, while proving nothing extra.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  publishTarget,
  ownerFromRepo,
  scopeOf,
  publishBlockers,
  npmrcBlockers,
} from "./check-publish-ready.mjs";

const REGISTRY = "https://npm.example-registry.test";

/** A package.json with everything correct; tests mutate one field at a time. */
const ok = () => ({
  name: "@acme-org/ui",
  repository: {
    type: "git",
    url: "git+https://github.com/Acme-Org/widgets.git",
    directory: "packages/ui",
  },
  publishConfig: { registry: REGISTRY, exports: {} },
});
const ctx = { owner: "acme-org", relDir: "packages/ui", registry: REGISTRY };

// ── the publish target is READ from .npmrc, never hard-coded ────────────────

test("publishTarget: no scoped registry in .npmrc means publishing is disabled", () => {
  assert.equal(publishTarget(""), null);
  assert.equal(publishTarget("auto-install-peers=true\nstrict-peer-dependencies=false\n"), null);
  // A comment mentioning a registry is not a mapping.
  assert.equal(publishTarget("# @acme-org:registry=https://x.test\n"), null);
});

test("publishTarget: a scope mapping is the enable switch", () => {
  assert.deepEqual(publishTarget(`auto-install-peers=true\n@acme-org:registry=${REGISTRY}\n`), {
    scope: "acme-org",
    registry: REGISTRY,
  });
});

test("owner and scope are compared case-insensitively", () => {
  // A GitHub owner may be mixed-case (`Acme-Org`); npm scopes are lowercase.
  // Comparing them raw would reject a perfectly valid package.
  assert.equal(ownerFromRepo("Acme-Org/widgets"), "acme-org");
  assert.equal(scopeOf("@acme-org/ui"), "acme-org");
  assert.equal(scopeOf("unscoped-package"), null);
});

test("PASSES: a fully configured package", () => {
  assert.deepEqual(publishBlockers(ok(), ctx), []);
});

test("FAILS: the wrong scope — GitHub Packages' hard requirement", () => {
  // This is the blocker that forced the original rename: GitHub Packages will
  // not accept a scope that isn't the repository owner.
  const v = publishBlockers({ ...ok(), name: "@brand/ui" }, ctx);
  assert.equal(v.length, 1);
  assert.equal(v[0].rule, "scope-mismatch");
  assert.match(v[0].detail, /@acme-org/, "must name the scope it should be");
});

test("FAILS: an unscoped package", () => {
  const v = publishBlockers({ ...ok(), name: "brand-ui" }, ctx);
  assert.equal(v[0].rule, "scope-mismatch");
});

test("FAILS: still private — npm refuses before it leaves the machine", () => {
  const v = publishBlockers({ ...ok(), private: true }, ctx);
  assert.equal(v.length, 1);
  assert.equal(v[0].rule, "private-package");
});

test("FAILS: no repository field — the package won't link to the repo", () => {
  const p = ok();
  delete p.repository;
  const v = publishBlockers(p, ctx);
  assert.equal(v.length, 1);
  assert.equal(v[0].rule, "missing-repository");
});

test("FAILS: repository.directory pointing at the wrong package", () => {
  const p = ok();
  p.repository.directory = "packages/data";
  const v = publishBlockers(p, ctx);
  assert.equal(v.length, 1);
  assert.equal(v[0].rule, "missing-repository");
  assert.match(v[0].detail, /packages\/ui/);
});

test("FAILS: no publishConfig.registry — it would publish to npmjs.org", () => {
  const p = ok();
  delete p.publishConfig.registry;
  const v = publishBlockers(p, ctx);
  assert.equal(v.length, 1);
  assert.equal(v[0].rule, "missing-registry");
});

test("FAILS: registry pointing somewhere else entirely", () => {
  const p = ok();
  p.publishConfig.registry = "https://registry.npmjs.org";
  assert.equal(publishBlockers(p, ctx)[0].rule, "missing-registry");
});

test("reports every independent blocker at once, not just the first", () => {
  // Wrong scope, private, no repository, no registry. A preflight that stopped
  // at the first would take four rounds.
  const v = publishBlockers({ name: "@brand/ui", private: true }, ctx);
  assert.deepEqual(
    new Set(v.map((x) => x.rule)),
    new Set(["scope-mismatch", "private-package", "missing-repository", "missing-registry"]),
  );
});

test("FAILS: .npmrc that does not map the scope", () => {
  const v = npmrcBlockers("auto-install-peers=true\n", "acme-org", REGISTRY);
  assert.equal(v.length, 1);
  assert.equal(v[0].rule, "npmrc-unmapped");
});

test("PASSES: .npmrc with the scope mapped", () => {
  const npmrc = `auto-install-peers=true\n@acme-org:registry=${REGISTRY}\n`;
  assert.deepEqual(npmrcBlockers(npmrc, "acme-org", REGISTRY), []);
});
