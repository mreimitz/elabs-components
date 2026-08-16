/**
 * release-smoke.test.mjs — self-test for the post-release fresh-install smoke
 * (#106, #71). Run in CI: `node --test scripts/release-smoke.test.mjs`
 * (`pnpm release:smoke:test`).
 *
 * The smoke itself needs a published release and registry auth, so CI cannot run
 * its network path. What CI CAN lock is the thing that makes the smoke worth
 * having: that it FAILS on the defects `npm view` is blind to. Every assertion
 * below plants one and asserts a violation:
 *
 *   - a package the install did not produce at all,
 *   - a package whose `exports` entry is missing from the tarball,
 *   - a package whose entry is present but zero bytes,
 *   - a DEFAULT-BRANCH marketplace pointer left on the previous version,
 *   - a manifest naming zero packages (the vacuous pass).
 *
 * Two assertions are here because their absence made the smoke worthless once
 * already, and neither is visible from the outside:
 *
 *   - the install argv carries NO bare `--registry=` (a process-wide default
 *     sends public transitive deps to GitHub Packages, which 404s them), and the
 *     generated `.npmrc` maps only the release scopes;
 *   - the pointer check resolves the DEFAULT BRANCH, not the tag's working tree
 *     (where `pnpm version:check` has already forced agreement).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_REGISTRY,
  checkInstalledEntries,
  consumerNpmrc,
  installArgs,
  judgeMarketplacePointer,
  marketplaceVersion,
  packagesFromManifest,
  parseMarketplaceVersion,
  resolveInstalledEntry,
  resolveMarketplacePointer,
} from "./release-smoke.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

/** A scratch dir with a fake installed tree: node_modules/<name>/… */
function fixtureInstall(pkgs) {
  const root = mkdtempSync(join(tmpdir(), "brand-ui-smoke-fixture-"));
  for (const [name, { json, files = {} }] of Object.entries(pkgs)) {
    const dir = join(root, "node_modules", ...name.split("/"));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify(json));
    for (const [rel, body] of Object.entries(files)) {
      const full = join(dir, rel);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, body);
    }
  }
  return root;
}

const GOOD = {
  json: { name: "@x/ui", version: "9.9.9", exports: { ".": { default: "./dist/index.js" } } },
  files: { "dist/index.js": "export const ok = 1;\n" },
};

// ── the package set is DERIVED from the release manifest ──────────────────────

test("the package set comes from the release manifest, never a literal", () => {
  const names = packagesFromManifest({
    packages: [
      { name: "@x/ui", version: "9.9.9" },
      { name: "@x/maps", version: "9.9.9" },
    ],
  });
  assert.deepEqual(names, ["@x/ui", "@x/maps"]);
});

test("a manifest naming ZERO packages yields an empty set (the CLI refuses it)", () => {
  assert.deepEqual(packagesFromManifest({ packages: [] }), []);
  assert.deepEqual(packagesFromManifest({}), []);
});

test("the install argv pins every package at the released version", () => {
  const args = installArgs(["@x/ui", "@x/cli"], "9.9.9");
  assert.ok(args.includes("@x/ui@9.9.9"));
  assert.ok(args.includes("@x/cli@9.9.9"));
});

test("the install argv carries NO process-wide --registry (it would 404 public deps)", () => {
  // A global `--registry=https://npm.pkg.github.com` makes GitHub Packages the
  // default for every TRANSITIVE dependency, and it does not proxy npmjs.org:
  //   npm error 404 GET https://npm.pkg.github.com/@hookform%2fresolvers
  // That failed EVERY release, after the irreversible publish. The scope→registry
  // mapping belongs in the .npmrc, never on the command line.
  const args = installArgs(["@x/ui", "@x/cli"], "9.9.9");
  assert.ok(
    !args.some((a) => /^--registry(=|$)/.test(a)),
    `installArgs must not set a process-wide registry — got ${JSON.stringify(args)}`,
  );
});

test("the consumer .npmrc maps ONLY the release scopes and carries auth", () => {
  // Pinned to a PRIVATE host on purpose: the auth line is what a private target
  // needs, and asserting it against DEFAULT_REGISTRY would silently stop
  // exercising that shape the moment the default moved to public npm.
  const PRIVATE_REGISTRY = "https://npm.pkg.github.com";
  const npmrc = consumerNpmrc(["@x/ui", "@x/cli"], { registry: PRIVATE_REGISTRY, token: "t0k" });
  assert.match(npmrc, /^@x:registry=https:\/\/npm\.pkg\.github\.com$/m);
  assert.match(npmrc, /\/\/npm\.pkg\.github\.com\/:_authToken=t0k/);
  // exactly one line per distinct scope
  const registryLines = npmrc.split("\n").filter((l) => l.includes("registry="));
  assert.equal(registryLines.length, 1);
  // …and every one of them is SCOPED — a bare `registry=` line is the same defect
  // as the `--registry` flag, one layer down.
  for (const line of registryLines) {
    assert.match(line, /^@[^:]+:registry=/, `.npmrc must not set a default registry: ${line}`);
  }
});

test("a two-scope release maps each scope, still with no default registry", () => {
  const npmrc = consumerNpmrc(["@x/ui", "@y/cli"], { registry: DEFAULT_REGISTRY });
  const registryLines = npmrc.split("\n").filter((l) => l.includes("registry="));
  assert.deepEqual(registryLines.sort(), [
    `@x:registry=${DEFAULT_REGISTRY}`,
    `@y:registry=${DEFAULT_REGISTRY}`,
  ]);
});

// ── FLAGS: the defects `npm view` is blind to ─────────────────────────────────

test("PASSES: a package whose entry is really in the tarball", () => {
  const root = fixtureInstall({ "@x/ui": GOOD });
  try {
    assert.deepEqual(
      checkInstalledEntries(root, ["@x/ui"]).map((r) => r.error),
      [null],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("FLAGS: a package the install did not produce at all", () => {
  const root = fixtureInstall({ "@x/ui": GOOD });
  try {
    const row = resolveInstalledEntry(root, "@x/maps");
    assert.equal(row.error, "not installed");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("FLAGS: `exports` points at a file the published tarball does not contain", () => {
  const root = fixtureInstall({
    "@x/ui": {
      json: { name: "@x/ui", version: "9.9.9", exports: { ".": { default: "./dist/index.js" } } },
      files: {}, // published without dist/ — resolves fine on the registry, unusable
    },
  });
  try {
    const row = resolveInstalledEntry(root, "@x/ui");
    assert.match(row.error, /missing from the published tarball/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("FLAGS: an entry that ships but is zero bytes", () => {
  const root = fixtureInstall({
    "@x/ui": { json: GOOD.json, files: { "dist/index.js": "" } },
  });
  try {
    assert.match(resolveInstalledEntry(root, "@x/ui").error, /is empty/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a bin-only package (the CLI) legitimately declares no `.` export", () => {
  const root = fixtureInstall({
    "@x/cli": {
      json: { name: "@x/cli", version: "9.9.9", bin: { "brand-ui": "./bin/brand-ui.mjs" } },
      files: { "bin/brand-ui.mjs": "#!/usr/bin/env node\n" },
    },
  });
  try {
    assert.equal(resolveInstalledEntry(root, "@x/cli").error, null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("FLAGS: a package with neither an export nor a bin", () => {
  const root = fixtureInstall({ "@x/empty": { json: { name: "@x/empty", version: "9.9.9" } } });
  try {
    assert.match(resolveInstalledEntry(root, "@x/empty").error, /declares no entry point/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── the plugin pointer a consumer actually follows ────────────────────────────

test("FLAGS: a marketplace pointer left on the previous version", () => {
  const root = mkdtempSync(join(tmpdir(), "brand-ui-smoke-mkt-"));
  try {
    mkdirSync(join(root, ".claude-plugin"));
    writeFileSync(
      join(root, ".claude-plugin", "marketplace.json"),
      JSON.stringify({ plugins: [{ name: "brand-ui", version: "1.9.0" }] }),
    );
    assert.equal(marketplaceVersion(root), "1.9.0");
    assert.notEqual(marketplaceVersion(root), "2.0.0");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the REAL repo's marketplace pointer agrees with the lockstep version", () => {
  const repoRoot = dirname(HERE);
  const rootVersion = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")).version;
  assert.equal(marketplaceVersion(repoRoot), rootVersion);
});

// The check that is NOT tautological: the pointer as served by the DEFAULT
// BRANCH. A tag checkout's own copy is forced to agree by `pnpm version:check`
// in the same job, so reading it proves nothing — while a skipped
// `git push origin main` (RELEASING.md § 4 pushes main and the tag separately)
// or a later revert leaves real consumers on the previous plugin.

/** A fake `gh` that serves `version` from `branch` (base64, as the API does). */
function fakeGh(branch, body) {
  return (args) => {
    const path = args[1] ?? "";
    if (/^repos\/[^/]+\/[^/]+$/.test(path)) return `${branch}\n`;
    if (path.includes("/contents/.claude-plugin/marketplace.json")) {
      assert.ok(path.endsWith(`?ref=${branch}`), `must read the default branch, got ${path}`);
      return Buffer.from(body, "utf8").toString("base64") + "\n";
    }
    throw new Error(`unexpected gh api ${path}`);
  };
}

/** A worktree whose OWN pointer already says `version` (the tautology trap). */
function fixtureWorktree(version) {
  const root = mkdtempSync(join(tmpdir(), "brand-ui-smoke-ptr-"));
  mkdirSync(join(root, ".claude-plugin"));
  writeFileSync(
    join(root, ".claude-plugin", "marketplace.json"),
    JSON.stringify({ plugins: [{ name: "brand-ui", version }] }),
  );
  return root;
}

test("FLAGS: the DEFAULT BRANCH pointer is on the previous version (tree says otherwise)", () => {
  // The trap: the tag's own tree is already on 2.0.0 (version:check forced it),
  // so only reading `main` can see that consumers still get 1.9.0.
  const root = fixtureWorktree("2.0.0");
  try {
    const p = resolveMarketplacePointer({
      root,
      repo: "<owner>/<repo>",
      gh: fakeGh("main", JSON.stringify({ plugins: [{ version: "1.9.0" }] })),
    });
    assert.equal(p.source, "default-branch");
    assert.equal(p.ref, "main");
    assert.equal(p.version, "1.9.0");
    assert.notEqual(p.version, "2.0.0", "the released version must NOT be reported as served");
    assert.notEqual(p.version, marketplaceVersion(root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("PASSES: the default branch serves the released version", () => {
  const root = fixtureWorktree("2.0.0");
  try {
    const p = resolveMarketplacePointer({
      root,
      repo: "<owner>/<repo>",
      gh: fakeGh("main", JSON.stringify({ plugins: [{ version: "2.0.0" }] })),
    });
    assert.deepEqual(
      { version: p.version, source: p.source, ref: p.ref, error: p.error },
      { version: "2.0.0", source: "default-branch", ref: "main", error: null },
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a non-`main` default branch is followed, not assumed", () => {
  const root = fixtureWorktree("2.0.0");
  try {
    const p = resolveMarketplacePointer({
      root,
      repo: "o/r",
      gh: fakeGh("trunk", JSON.stringify({ plugins: [{ version: "2.0.0" }] })),
    });
    assert.equal(p.ref, "trunk");
    assert.equal(p.version, "2.0.0");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("falls back to the worktree — and SAYS the fallback is why", () => {
  const root = fixtureWorktree("2.0.0");
  try {
    const p = resolveMarketplacePointer({
      root,
      repo: "o/r",
      gh: () => {
        throw new Error("gh: not authenticated");
      },
    });
    assert.equal(p.source, "worktree");
    assert.equal(p.version, "2.0.0");
    assert.match(p.error, /could not read the pointer from o\/r's default branch/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("with no repo at all it falls back and names the missing input", () => {
  const root = fixtureWorktree("2.0.0");
  try {
    const p = resolveMarketplacePointer({ root });
    assert.equal(p.source, "worktree");
    assert.match(p.error, /no repo given/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("parseMarketplaceVersion reads the first declared version", () => {
  assert.equal(parseMarketplaceVersion('{"plugins":[{"version":"3.1.4"}]}'), "3.1.4");
  assert.equal(parseMarketplaceVersion("{}"), null);
});

// ── the SAME verdict, run twice: before the publish and after ─────────────────
// The pointer assertion needs nothing the publish produces, so running it only
// afterwards discovers a skipped `git push origin main` once twelve immutable
// versions exist. `judgeMarketplacePointer` is the one verdict both callers use.

test("the verdict FAILS a default-branch pointer left on the previous version", () => {
  const v = judgeMarketplacePointer({
    pointer: { version: "1.9.0", source: "default-branch", ref: "main", error: null },
    version: "2.0.0",
    repo: "o/r",
    ci: true,
  });
  assert.equal(v.failures.length, 1);
  assert.match(v.failures[0], /serves 1\.9\.0, not 2\.0\.0/);
  assert.match(v.failures[0], /git push origin main/);
});

test("the verdict PASSES only when the default branch itself serves the version", () => {
  const v = judgeMarketplacePointer({
    pointer: { version: "2.0.0", source: "default-branch", ref: "main", error: null },
    version: "2.0.0",
    repo: "o/r",
    ci: true,
  });
  assert.deepEqual(v.failures, []);
  assert.match(v.logs[0], /o\/r@main serves 2\.0\.0/);
});

test("under CI an unreadable pointer FAILS instead of falling back to the tautology", () => {
  const pointer = {
    version: "2.0.0",
    source: "worktree",
    ref: null,
    error: "gh: not authenticated",
  };
  const inCi = judgeMarketplacePointer({ pointer, version: "2.0.0", repo: "o/r", ci: true });
  assert.equal(inCi.failures.length, 1, "the worktree copy agrees, but version:check forced that");
  const local = judgeMarketplacePointer({ pointer, version: "2.0.0", repo: "o/r", ci: false });
  assert.deepEqual(local.failures, []);
  assert.match(local.warnings[0], /TAUTOLOGICAL/);
});

test("CLI --pointer-only needs no manifest and no install (the pre-publish preflight)", async () => {
  // The post-release smoke refuses to run without a release-manifest.json; the
  // preflight must work before one exists, since it runs before the publish.
  const root = fixtureWorktree("9.9.9");
  try {
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ name: "fixture", version: "9.9.9" }),
    );
    const { code, stdout, stderr } = await run([
      join(HERE, "release-smoke.mjs"),
      "--root",
      root,
      "--pointer-only",
    ]);
    assert.ok(!/no release-manifest\.json/.test(stderr), "must not require the manifest");
    assert.equal(code, 0, stderr || stdout);
    assert.match(stdout, /✔ marketplace:check/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI --pointer-only EXITS 1 when the pointer names another version", async () => {
  const root = fixtureWorktree("1.9.0");
  try {
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ name: "fixture", version: "9.9.9" }),
    );
    const { code, stderr } = await run([
      join(HERE, "release-smoke.mjs"),
      "--root",
      root,
      "--pointer-only",
    ]);
    assert.equal(code, 1);
    assert.match(stderr, /serves 1\.9\.0, not 9\.9\.9/);
    assert.match(stderr, /Fix BEFORE the publish/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── the CLI refuses to pass vacuously ─────────────────────────────────────────

test("FAILS LOUDLY when the release manifest names zero packages (CLI run)", async () => {
  const root = mkdtempSync(join(tmpdir(), "brand-ui-smoke-vacuous-"));
  try {
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ name: "fixture", version: "9.9.9" }),
    );
    const manifest = join(root, "release-manifest.json");
    writeFileSync(manifest, JSON.stringify({ version: "9.9.9", packages: [], assets: [] }));
    const { code, stderr } = await run([
      join(HERE, "release-smoke.mjs"),
      "--root",
      root,
      "--manifest",
      manifest,
    ]);
    assert.equal(code, 1, "a zero-package manifest must fail, not pass by installing nothing");
    assert.match(stderr, /ZERO packages/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("FAILS LOUDLY when there is no release manifest to derive the set from (CLI run)", async () => {
  const root = mkdtempSync(join(tmpdir(), "brand-ui-smoke-nomanifest-"));
  try {
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ name: "fixture", version: "9.9.9" }),
    );
    const { code, stderr } = await run([join(HERE, "release-smoke.mjs"), "--root", root]);
    assert.equal(code, 1);
    assert.match(stderr, /no release-manifest\.json/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/**
 * Run the CLI. `CI` and `GITHUB_REPOSITORY` are cleared unless overridden: the
 * suite must behave the same on a laptop and on a runner, and both variables
 * change the pointer verdict (under CI an unresolvable pointer is fatal).
 */
function run(args, env = {}) {
  return new Promise((resolve) => {
    execFile(
      "node",
      args,
      { encoding: "utf8", env: { ...process.env, CI: "", GITHUB_REPOSITORY: "", ...env } },
      (err, stdout, stderr) => resolve({ code: err?.code ?? 0, stdout, stderr }),
    );
  });
}
