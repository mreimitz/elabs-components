/**
 * check-publish-ready.test.mjs — locks the publish-readiness preflight.
 * Run in CI: `node --test scripts/check-publish-ready.test.mjs`.
 *
 * The failure this guards is the worst one in a release: npm versions are
 * immutable, so if packages 1-6 publish and 7 is rejected, the release cannot be
 * undone. Every blocker below must be caught BEFORE anything is tagged.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REGISTRY,
  ownerFromRepo,
  scopeOf,
  publishBlockers,
  npmrcBlockers,
} from "./check-publish-ready.mjs";

/** A package.json with everything correct; tests mutate one field at a time. */
const ok = () => ({
  name: "@qlik-coe-emea/qlabs-components-ui",
  repository: {
    type: "git",
    url: "git+https://github.com/Qlik-CoE-EMEA/qlabs-components.git",
    directory: "packages/ui",
  },
  publishConfig: { registry: REGISTRY, exports: {} },
});
const ctx = { owner: "qlik-coe-emea", relDir: "packages/ui" };

test("owner and scope are compared case-insensitively", () => {
  // The GitHub owner is `Qlik-CoE-EMEA`; npm scopes are lowercase. Comparing
  // them raw would reject a perfectly valid package.
  assert.equal(ownerFromRepo("Qlik-CoE-EMEA/qlabs-components"), "qlik-coe-emea");
  assert.equal(scopeOf("@qlik-coe-emea/qlabs-components-ui"), "qlik-coe-emea");
  assert.equal(scopeOf("unscoped-package"), null);
});

test("PASSES: a fully configured package", () => {
  assert.deepEqual(publishBlockers(ok(), ctx), []);
});

test("FAILS: the wrong scope — GitHub Packages' hard requirement", () => {
  // The pre-migration name. This is the blocker that forced the whole rename:
  // GitHub Packages will not accept a scope that isn't the repository owner.
  const v = publishBlockers({ ...ok(), name: "@brand/ui" }, ctx);
  assert.equal(v.length, 1);
  assert.equal(v[0].rule, "scope-mismatch");
  assert.match(v[0].detail, /@qlik-coe-emea/, "must name the scope it should be");
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
  // The pre-rename state of this repo: wrong scope, private, no repository,
  // no registry. A preflight that stopped at the first would take four rounds.
  const v = publishBlockers({ name: "@brand/ui", private: true }, ctx);
  assert.deepEqual(
    new Set(v.map((x) => x.rule)),
    new Set(["scope-mismatch", "private-package", "missing-repository", "missing-registry"]),
  );
});

test("FAILS: .npmrc that does not map the scope", () => {
  const v = npmrcBlockers("auto-install-peers=true\n", "qlik-coe-emea");
  assert.equal(v.length, 1);
  assert.equal(v[0].rule, "npmrc-unmapped");
});

test("PASSES: .npmrc with the scope mapped", () => {
  const npmrc = `auto-install-peers=true\n@qlik-coe-emea:registry=${REGISTRY}\n`;
  assert.deepEqual(npmrcBlockers(npmrc, "qlik-coe-emea"), []);
});
