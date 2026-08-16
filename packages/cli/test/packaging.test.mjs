/**
 * packaging.test.mjs — the assets the PUBLISHED CLI must carry.
 *
 * `skills/brand-ui-new-app` (shipped in `.claude-plugin/plugin.json`) tells every
 * consumer to run `pnpm exec brand-ui scaffold <spec> --write <dir>` in a project
 * that installed `@qlik-coe-emea/qlabs-components-cli`. That instruction is only
 * true while the CLI ships the archetype templates and the manifest — otherwise
 * `scaffold` dead-ends with "template not found" and `context`/`docs` have no
 * ground truth. This test is the teeth on that promise: it locks the `files`
 * entries, the `prepack` bundling step, and the assets it copies.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ARCHETYPES, BUNDLED_TEMPLATE_DIR, packagePeers, templatePath } from "../lib/engine.mjs";
import { BUNDLED_ASSETS } from "../scripts/bundle-assets.mjs";
import { findRepoRoot, loadManifest } from "../lib/core.mjs";

const PKG_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(PKG_DIR, "package.json"), "utf8"));
const root = findRepoRoot();

test("the published CLI ships the templates and the manifest", () => {
  for (const entry of ["bin", "lib", "templates", "brand-ui.manifest.json"]) {
    assert.ok(pkg.files.includes(entry), `package.json files[] carries ${entry}`);
  }
  assert.match(pkg.scripts.prepack, /bundle-assets\.mjs/, "prepack bundles the repo-owned assets");
});

test("bundle-assets copies exactly what `files` promises", () => {
  const destinations = BUNDLED_ASSETS.map((a) => a.to);
  assert.deepEqual(
    destinations.slice().sort(),
    ["brand-ui.manifest.json", "templates"],
    "every generated asset the package declares is actually bundled",
  );
  for (const { from } of BUNDLED_ASSETS) {
    assert.ok(existsSync(join(root, from)), `${from} exists in the repo to be copied`);
  }
});

test("every archetype the engine offers has a template to bundle", () => {
  const available = readdirSync(join(root, "docs/playbooks/templates")).filter((f) =>
    f.endsWith(".tsx"),
  );
  for (const archetype of ARCHETYPES) {
    assert.ok(existsSync(join(root, templatePath(archetype))), `${archetype}.tsx exists`);
    assert.ok(available.includes(`${archetype}.tsx`), `${archetype}.tsx would be copied`);
  }
});

test("the manifest carries each package's peers, so consumer mode can derive them", () => {
  const manifest = loadManifest(root);
  // Without a checkout (the published-CLI case) the manifest is the ONLY source
  // for the engine ranges the install handoff hands over.
  const declared = (pkg) =>
    JSON.parse(readFileSync(join(root, `packages/${pkg}/package.json`), "utf8")).peerDependencies;
  for (const pkg of ["flow", "ai", "editor", "maps"]) {
    const name = `@qlik-coe-emea/qlabs-components-${pkg}`;
    assert.deepEqual(
      manifest.packages[name].peerDependencies,
      declared(pkg),
      `${name} peers reach the manifest verbatim`,
    );
    // …and reading them WITHOUT a root gives the same engine ranges (minus the
    // intra-scope + base peers every app installs anyway).
    const fromManifest = packagePeers(name, { manifest });
    const fromDisk = packagePeers(name, { root, manifest });
    assert.deepEqual(fromManifest, fromDisk, `${name}: manifest and checkout agree`);
  }
  assert.equal(
    packagePeers("@qlik-coe-emea/qlabs-components-ai", { manifest })["@xyflow/react"],
    declared("ai")["@xyflow/react"],
  );
});

test("the bundled template dir resolves inside the package (not the repo)", () => {
  // It is generated at prepack, so it is usually ABSENT in a dev checkout — what
  // must hold is that the path points into the package, so an installed copy is
  // found without a repo.
  assert.equal(BUNDLED_TEMPLATE_DIR, join(PKG_DIR, "templates"));
});
