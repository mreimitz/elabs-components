/**
 * release-snapshot.test.mjs — self-test for the derived release snapshot (#105, #295).
 * Run in CI: `node --test scripts/release-snapshot.test.mjs` (`pnpm release:snapshot:test`).
 *
 * The failure this locks: v1.7.0 shipped without `@brand/maps` because the
 * publishable-package set was hand-kept. So the load-bearing assertions are
 * (a) a planted fixture package with `publishConfig` APPEARS in the derived set —
 * the list cannot rot — and (b) every checksum in `release-manifest.json` matches
 * the bytes actually on disk, since those checksums are the only integrity story
 * the agent-kit / plugin ZIPs have.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { distributablePackages, isDistributable, tarballName } from "./lib/distributables.mjs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  archiveRecords,
  buildReleaseManifest,
  extractReleaseNotes,
  packDistributables,
  recordArchiveName,
  writeReleaseManifest,
  writeSnapshotRecords,
  sha256File,
  ASSET_EXTENSIONS,
  RECORD_TOP_LEVEL_FILES,
  VALIDATION_REPORT_FILES,
} from "./release-snapshot.mjs";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** A throwaway workspace: packages/<name>/package.json for each entry. */
function fixtureWorkspace(pkgs, version = "9.9.9") {
  const root = mkdtempSync(join(tmpdir(), "brand-ui-snapshot-"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture", version }));
  mkdirSync(join(root, "packages"));
  for (const [dir, json] of Object.entries(pkgs)) {
    mkdirSync(join(root, "packages", dir));
    writeFileSync(join(root, "packages", dir, "package.json"), JSON.stringify(json));
  }
  return root;
}

// ── the predicate itself ──────────────────────────────────────────────────────

test("the predicate: publishConfig OR not-private is distributable", () => {
  assert.ok(isDistributable({ publishConfig: { exports: {} }, private: true }), "component pkg");
  assert.ok(isDistributable({ name: "cli" }), "the CLI — not private, no publishConfig");
  assert.ok(!isDistributable({ private: true }), "an app");
  assert.ok(!isDistributable({ private: true, name: "eslint-config" }), "a config package");
});

// ── the derived set cannot rot ────────────────────────────────────────────────

test("a NEWLY PLANTED package with publishConfig appears in the derived set", () => {
  const root = fixtureWorkspace({
    ui: { name: "@x/ui", version: "9.9.9", private: true, publishConfig: { exports: {} } },
    // the #295 shape: a new package someone adds tomorrow
    quantum: { name: "@x/quantum", version: "9.9.9", private: true, publishConfig: {} },
    eslint: { name: "@x/eslint-config", version: "0.1.0", private: true },
    docs: { name: "@x/docs", version: "0.1.0", private: true },
  });
  try {
    const names = distributablePackages(root).map((p) => p.name);
    assert.deepEqual(names.sort(), ["@x/quantum", "@x/ui"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("private infra packages stay OFF the release train", () => {
  const root = fixtureWorkspace({
    eslint: { name: "@x/eslint-config", version: "0.1.0", private: true },
    tsconfig: { name: "@x/typescript-config", version: "0.1.0", private: true },
  });
  try {
    assert.deepEqual(distributablePackages(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the pack loop packs EVERY distributable package (a new one is not skipped)", () => {
  const root = fixtureWorkspace({
    ui: { name: "@x/ui", version: "9.9.9", private: true, publishConfig: {} },
    maps: { name: "@x/maps", version: "9.9.9", private: true, publishConfig: {} },
    docs: { name: "@x/docs", version: "0.1.0", private: true },
  });
  const outDir = join(root, "release", "v9.9.9");
  const packed = [];
  try {
    const rows = packDistributables({
      root,
      outDir,
      run: (cwd, args) => packed.push([cwd, args.join(" ")]),
    });
    assert.equal(rows.length, 2);
    assert.equal(packed.length, 2, "every distributable is packed");
    for (const [, args] of packed) assert.match(args, /^pack --pack-destination /);
    assert.ok(packed.some(([cwd]) => cwd.endsWith(join("packages", "maps"))));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── the record: checksums must match the bytes on disk ────────────────────────

test("release-manifest.json checksums match the bytes on disk", () => {
  const root = fixtureWorkspace({
    ui: { name: "@x/ui", version: "9.9.9", private: true, publishConfig: {} },
  });
  const outDir = join(root, "release", "v9.9.9");
  mkdirSync(outDir, { recursive: true });
  const tgz = tarballName("@x/ui", "9.9.9");
  writeFileSync(join(outDir, tgz), "tarball-bytes");
  writeFileSync(join(outDir, "brand-ui-plugin-9.9.9.zip"), "plugin-bytes");
  writeFileSync(join(outDir, "notes.txt"), "not an asset");

  try {
    const manifest = writeReleaseManifest({
      version: "9.9.9",
      sha: "abc123",
      outDir,
      packages: distributablePackages(root),
    });

    assert.equal(manifest.version, "9.9.9");
    assert.equal(manifest.sha, "abc123");
    assert.deepEqual(
      manifest.packages,
      [{ name: "@x/ui", version: "9.9.9" }],
      "every packed package is named in the record",
    );

    const files = manifest.assets.map((a) => a.file);
    assert.deepEqual(files.sort(), ["brand-ui-plugin-9.9.9.zip", tgz].sort());
    assert.ok(!files.includes("notes.txt"), "only .tgz/.zip count as assets");

    for (const asset of manifest.assets) {
      const bytes = readFileSync(join(outDir, asset.file));
      assert.equal(asset.sha256, createHash("sha256").update(bytes).digest("hex"));
      assert.equal(asset.bytes, bytes.length);
    }

    // The written file agrees with the returned object.
    const onDisk = JSON.parse(readFileSync(join(outDir, "release-manifest.json"), "utf8"));
    assert.deepEqual(onDisk, manifest);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a tampered asset no longer matches its recorded checksum", () => {
  const root = mkdtempSync(join(tmpdir(), "brand-ui-snapshot-tamper-"));
  try {
    const file = join(root, "brand-ui-agent-kit-9.9.9.zip");
    writeFileSync(file, "original");
    const manifest = buildReleaseManifest({
      version: "9.9.9",
      sha: null,
      outDir: root,
      packages: [],
    });
    writeFileSync(file, "tampered");
    assert.notEqual(manifest.assets[0].sha256, sha256File(file));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── the RECORD half: notes, changelog, ground truth — all checksummed (#105) ──

const CHANGELOG = [
  "# Changelog",
  "",
  "## Unreleased",
  "",
  "- something in flight",
  "",
  "## v9.9.9 — 2026-08-01",
  "",
  "- the released thing",
  "",
  "## v9.9.8 — 2026-07-01",
  "",
  "- the previous thing",
  "",
].join("\n");

test("release notes are EXTRACTED from the changelog, never retyped", () => {
  const notes = extractReleaseNotes(CHANGELOG, "9.9.9");
  assert.match(notes, /^## v9\.9\.9 — 2026-08-01/);
  assert.match(notes, /- the released thing/);
  assert.ok(!notes.includes("the previous thing"), "stops at the next heading");
  assert.ok(!notes.includes("something in flight"), "does not swallow Unreleased");
});

test("a version with no changelog heading yields no notes (reported, not faked)", () => {
  assert.equal(extractReleaseNotes(CHANGELOG, "9.9.7"), null);
});

test("the snapshot carries the notes, the changelog and the ground truth — all checksummed", () => {
  const root = fixtureWorkspace({
    ui: { name: "@x/ui", version: "9.9.9", private: true, publishConfig: {} },
  });
  const outDir = join(root, "release", "v9.9.9");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(root, "CHANGELOG.md"), CHANGELOG);
  writeFileSync(join(root, "brand-ui.manifest.json"), '{"packages":{}}\n');
  mkdirSync(join(root, "apps", "docs", "public", "llms"), { recursive: true });
  writeFileSync(join(root, "apps", "docs", "public", "component-inventory.md"), "# inventory\n");
  writeFileSync(join(root, "apps", "docs", "public", "llms.txt"), "# llms\n");
  writeFileSync(join(root, "apps", "docs", "public", "llms", "ui.txt"), "# ui\n");
  writeFileSync(join(outDir, tarballName("@x/ui", "9.9.9")), "tarball-bytes");

  try {
    const { written, missing } = writeSnapshotRecords({ root, outDir, version: "9.9.9" });
    assert.deepEqual(missing, [], "every source exists in this fixture");
    for (const f of [
      "RELEASE_NOTES.md",
      "CHANGELOG.md",
      "ground-truth/brand-ui.manifest.json",
      "ground-truth/component-inventory.md",
      "ground-truth/llms.txt",
      "ground-truth/llms/ui.txt",
    ]) {
      assert.ok(written.includes(f), `${f} is part of the snapshot`);
    }

    const manifest = writeReleaseManifest({
      version: "9.9.9",
      sha: "abc123",
      outDir,
      packages: distributablePackages(root),
    });
    // the binaries stay in `assets` (that is what the Release attaches) …
    assert.deepEqual(
      manifest.assets.map((a) => a.file),
      [tarballName("@x/ui", "9.9.9")],
    );
    // … and every record is checksummed against the bytes on disk.
    const recorded = manifest.records.map((r) => r.file);
    assert.ok(recorded.includes("RELEASE_NOTES.md"));
    assert.ok(recorded.includes("ground-truth/llms/ui.txt"));
    for (const rec of manifest.records) {
      const bytes = readFileSync(join(outDir, rec.file));
      assert.equal(rec.sha256, createHash("sha256").update(bytes).digest("hex"));
      assert.equal(rec.bytes, bytes.length);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── the record half must be RETRIEVABLE, not merely checksummed (#105) ────────
// `release/` is git-ignored and the runner is discarded when the job ends, so a
// record that is hashed but never attached is one nobody can ever obtain: you
// could look up the SHA-256 of a released version's agent-facing ground truth and
// have no way to get the bytes. The archive is what makes the record real.

test("the record half is archived into an attachable, checksummed asset", () => {
  const root = mkdtempSync(join(tmpdir(), "brand-ui-snapshot-archive-"));
  const calls = [];
  try {
    mkdirSync(join(root, "ground-truth"));
    writeFileSync(join(root, "ground-truth", "llms.txt"), "# llms\n");
    writeFileSync(join(root, "CHANGELOG.md"), CHANGELOG);
    writeFileSync(join(root, "RELEASE_NOTES.md"), "## v9.9.9\n");

    const name = archiveRecords({
      outDir: root,
      version: "9.9.9",
      run: (cwd, args) => calls.push([cwd, args]),
    });

    assert.equal(name, "release-record-9.9.9.zip");
    assert.equal(name, recordArchiveName("9.9.9"));
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0][1], [
      "-rq",
      "release-record-9.9.9.zip",
      "ground-truth",
      "CHANGELOG.md",
      "RELEASE_NOTES.md",
    ]);
    // A top-level `.zip` — so it is an ASSET, attached by release.yml's existing
    // `release/v$version/*.zip` glob and hashed like every other asset.
    assert.ok(name.endsWith(".zip"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("archiving skips entries that are not there, and no-ops on an empty snapshot", () => {
  const root = mkdtempSync(join(tmpdir(), "brand-ui-snapshot-archive-empty-"));
  const calls = [];
  try {
    writeFileSync(join(root, "CHANGELOG.md"), CHANGELOG);
    archiveRecords({ outDir: root, version: "9.9.9", run: (cwd, args) => calls.push(args) });
    assert.deepEqual(calls[0], ["-rq", "release-record-9.9.9.zip", "CHANGELOG.md"]);

    const bare = mkdtempSync(join(tmpdir(), "brand-ui-snapshot-archive-bare-"));
    const none = [];
    const name = archiveRecords({ outDir: bare, version: "9.9.9", run: () => none.push(1) });
    assert.equal(name, null, "nothing to archive is not an error");
    assert.equal(none.length, 0);
    rmSync(bare, { recursive: true, force: true });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI: the record archive lands in the manifest's ASSETS, alongside its records", async () => {
  const root = fixtureWorkspace({
    ui: { name: "@x/ui", version: "9.9.9", private: true, publishConfig: {} },
  });
  const outDir = join(root, "release", "v9.9.9");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(root, "CHANGELOG.md"), CHANGELOG);
  writeFileSync(join(root, "brand-ui.manifest.json"), '{"packages":{}}\n');
  mkdirSync(join(root, "apps", "docs", "public", "llms"), { recursive: true });
  writeFileSync(join(root, "apps", "docs", "public", "component-inventory.md"), "# inventory\n");
  writeFileSync(join(root, "apps", "docs", "public", "llms.txt"), "# llms\n");
  writeFileSync(join(root, "apps", "docs", "public", "llms", "ui.txt"), "# ui\n");
  try {
    const { code, stdout } = await runCli(["--root", root, "--out", outDir, "--no-pack"]);
    assert.equal(code, 0, stdout);

    const manifest = JSON.parse(readFileSync(join(outDir, "release-manifest.json"), "utf8"));
    const archive = recordArchiveName("9.9.9");
    const assets = manifest.assets.map((a) => a.file);
    assert.ok(
      assets.includes(archive),
      `the record archive must be an attachable asset; got ${assets.join(", ")}`,
    );
    // Checksummed like everything else, and the loose records stay individually
    // hashed so a consumer can verify a single file out of the archive.
    const row = manifest.assets.find((a) => a.file === archive);
    assert.equal(row.sha256, sha256File(join(outDir, archive)));
    assert.ok(manifest.records.some((r) => r.file === "ground-truth/llms/ui.txt"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a missing ground-truth source is REPORTED, not silently skipped", () => {
  const root = fixtureWorkspace({});
  const outDir = join(root, "release", "v9.9.9");
  mkdirSync(outDir, { recursive: true });
  try {
    const { missing } = writeSnapshotRecords({ root, outDir, version: "9.9.9" });
    assert.ok(missing.some((m) => m.startsWith("CHANGELOG.md")));
    assert.ok(missing.some((m) => m.includes("brand-ui.manifest.json")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI: an unwritable RELEASE_NOTES.md EXITS 1 — `gh release create` requires it", async () => {
  // The half-published failure mode: the § 2 CHANGELOG rename is manual, this
  // step used to only warn and exit 0, and the run then died at `gh release
  // create` on a missing required asset — after every immutable version had
  // published. `pnpm changelog:check` catches it pre-publish; this is the
  // second line of defence.
  const root = fixtureWorkspace({
    ui: { name: "@x/ui", version: "9.9.9", private: true, publishConfig: {} },
  });
  const outDir = join(root, "release", "v9.9.9");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(root, "CHANGELOG.md"), "# Changelog\n\n## Unreleased\n\n- not renamed yet\n");
  try {
    const { code, stderr } = await runCli(["--root", root, "--out", outDir, "--no-pack"]);
    assert.equal(code, 1, "a missing required record must fail the snapshot");
    assert.match(stderr, /required record missing — RELEASE_NOTES\.md/);
    assert.match(stderr, /RELEASING\.md § 2/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI: exits 0 once the changelog carries the version's section", async () => {
  const root = fixtureWorkspace({
    ui: { name: "@x/ui", version: "9.9.9", private: true, publishConfig: {} },
  });
  const outDir = join(root, "release", "v9.9.9");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(root, "CHANGELOG.md"), CHANGELOG);
  try {
    const { code, stdout } = await runCli(["--root", root, "--out", outDir, "--no-pack"]);
    assert.equal(code, 0, stdout);
    assert.match(stdout, /✔ release:snapshot/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function runCli(args) {
  return new Promise((resolve) => {
    execFile(
      "node",
      [new URL("./release-snapshot.mjs", import.meta.url).pathname, ...args],
      { encoding: "utf8" },
      (err, stdout, stderr) => resolve({ code: err?.code ?? 0, stdout, stderr }),
    );
  });
}

// ── the REAL repo's set is non-empty and matches the version gate ─────────────

test("the REAL repo derives a non-empty distributable set at the lockstep version", () => {
  const pkgs = distributablePackages();
  assert.ok(pkgs.length >= 10, `expected the component packages + CLI, got ${pkgs.length}`);
  const rootVersion = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ).version;
  for (const p of pkgs) assert.equal(p.version, rootVersion, `${p.name} is off the lockstep train`);
});

// ── the validation report must be checksummed too (#105 AC1) ──────────────────
// `gh release create` attaches validation-report.json + .md, and that report is
// the artifact ASSERTING the release was validated. It used to sit in neither
// `assets` nor `records`, so the one attached file whose whole job is to vouch
// for the build carried no integrity at all — while this script's own header and
// release.yml's release notes both claimed "a SHA-256 for every asset AND every
// record". These three tests are what keep that claim true.

test("the validation report is checksummed under `records`", () => {
  const root = fixtureWorkspace({
    ui: { name: "@x/ui", version: "9.9.9", private: true, publishConfig: {} },
  });
  const outDir = join(root, "release", "v9.9.9");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(root, "CHANGELOG.md"), CHANGELOG);
  // written by the EARLIER `pnpm release:report` step of release.yml
  writeFileSync(join(outDir, "validation-report.json"), '{"schema":1,"gates":[]}\n');
  writeFileSync(join(outDir, "validation-report.md"), "# Validation report — v9.9.9\n");

  try {
    writeSnapshotRecords({ root, outDir, version: "9.9.9" });
    const manifest = writeReleaseManifest({
      version: "9.9.9",
      sha: "abc123",
      outDir,
      packages: distributablePackages(root),
    });
    const recorded = manifest.records.map((r) => r.file);
    for (const f of VALIDATION_REPORT_FILES) {
      assert.ok(recorded.includes(f), `${f} must carry a checksum; got ${recorded.join(", ")}`);
      const row = manifest.records.find((r) => r.file === f);
      const bytes = readFileSync(join(outDir, f));
      assert.equal(row.sha256, createHash("sha256").update(bytes).digest("hex"));
      assert.equal(row.bytes, bytes.length);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the validation report is archived into the retrievable record zip", () => {
  const root = mkdtempSync(join(tmpdir(), "brand-ui-snapshot-report-zip-"));
  const calls = [];
  try {
    writeFileSync(join(root, "CHANGELOG.md"), CHANGELOG);
    writeFileSync(join(root, "RELEASE_NOTES.md"), "## v9.9.9\n");
    for (const f of VALIDATION_REPORT_FILES) writeFileSync(join(root, f), "x\n");
    archiveRecords({ outDir: root, version: "9.9.9", run: (cwd, args) => calls.push(args) });
    for (const f of VALIDATION_REPORT_FILES) {
      assert.ok(calls[0].includes(f), `${f} must be inside release-record-9.9.9.zip`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/**
 * Every file the REAL release.yml attaches by name (globs are the `.tgz`/`.zip`
 * assets, already covered) must be one the manifest hashes — or
 * `release-manifest.json` itself, which cannot hash its own output. This reads
 * the workflow on disk, so attaching a new artifact without adding it to
 * `RECORD_TOP_LEVEL_FILES` fails here instead of shipping unchecksummed.
 */
test("every named asset release.yml attaches is checksummed (or is the manifest)", () => {
  const yml = readFileSync(join(REPO_ROOT, ".github", "workflows", "release.yml"), "utf8");
  const cut = yml.indexOf("gh release create");
  assert.ok(cut > 0, "release.yml must still create the GitHub Release");
  const tail = yml.slice(cut);
  // `"release/v$version"/*.tgz` — a glob, covered by ASSET_EXTENSIONS …
  const globs = [...tail.matchAll(/"release\/v\$version"\/(\*\.\S+)/g)].map((m) => m[1]);
  // … and `"release/v$version/NAME"` — a file attached by name.
  const named = [...tail.matchAll(/"release\/v\$version\/([^"]+)"/g)].map((m) => m[1]);
  assert.equal(globs.length, 2, `expected the .tgz + .zip globs; got ${globs.join(", ")}`);
  assert.ok(named.length >= 4, `parsed too few named attachments: ${named.join(", ")}`);

  for (const g of globs) {
    assert.ok(
      ASSET_EXTENSIONS.includes(g.slice(1)),
      `the ${g} glob attaches files the manifest's ASSET_EXTENSIONS do not cover`,
    );
  }
  const covered = new Set([...RECORD_TOP_LEVEL_FILES, "release-manifest.json"]);
  for (const file of named) {
    assert.ok(
      covered.has(file),
      `release.yml attaches ${file}, but nothing checksums it — add it to ` +
        "RECORD_TOP_LEVEL_FILES (and RECORD_ARCHIVE_ENTRIES) in release-snapshot.mjs",
    );
  }
});
