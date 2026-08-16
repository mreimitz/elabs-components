#!/usr/bin/env node
/**
 * release-snapshot.mjs — assemble `release/v<version>/` and its machine-readable
 * record (#105, #295).
 *
 * Two things used to be missing:
 *
 *   1. The pack loop lived ONLY as inline bash inside `.github/workflows/release.yml`,
 *      so there was no local path to produce the coordinated artifact set, nothing to
 *      dry-run before a tag, and nothing a test could target (#295).
 *   2. Nothing recorded WHAT shipped. The `.tgz` files are the documented offline
 *      rollback path for consumers who — by definition — cannot reach the registry
 *      that would otherwise vouch for them, and the agent-kit / plugin ZIPs are not
 *      npm packages at all, so they get no registry integrity whatsoever (#105).
 *
 * So this packs the DERIVED distributable set (`scripts/lib/distributables.mjs` —
 * one predicate, shared with `set-version` / `check-publish-ready` / the workflow)
 * and writes `release-manifest.json`: version, git SHA, ISO date, every package's
 * name + version, and for EVERY asset in the folder a SHA-256 checksum and byte size.
 *
 * It also writes the RECORD half of the snapshot (#105) — the part that makes a
 * release auditable rather than merely downloadable:
 *   RELEASE_NOTES.md         this version's CHANGELOG section, extracted (not retyped)
 *   CHANGELOG.md             the full changelog as it stood at the tag
 *   validation-report.json   what `pnpm release:report` recorded about this run —
 *   validation-report.md     the gates, packages, commit and runner. Written by an
 *                            EARLIER release.yml step, so it is already on disk here.
 *   ground-truth/            brand-ui.manifest.json + component-inventory.md + llms.txt
 *                            (+ the per-package llms spokes) — the agent-facing ground
 *                            truth for exactly this version
 * Every one of those carries a SHA-256 + byte size too, under `records`. The
 * validation report is the reason to be pedantic about it: it is the artifact that
 * ASSERTS the release was validated, and it was attached to the Release unhashed
 * while this file's own header claimed everything was checksummed.
 *
 * The records are then archived into `release-record-<version>.zip` — and that
 * archive is what makes the record real. `release/` is git-ignored throwaway and
 * the runner is deleted when the job ends, so a record that exists only as loose
 * files in the workspace is retrievable by nobody: you could look up the SHA-256
 * of the agent-facing ground truth for a released version and never obtain the
 * bytes. Because it is a top-level `.zip` it lands in `assets`, is checksummed
 * like any other asset, and is attached by release.yml's existing
 * `release/v$version/*.zip` glob.
 *
 * `assets` means the `.tgz`/`.zip` BUNDLES; the Release attaches those plus four
 * bookkeeping files — `release-manifest.json` (which cannot hash itself),
 * `RELEASE_NOTES.md` and both `validation-report.*`, all three of the latter
 * checksummed under `records`. The post-release verify step asserts every
 * `assets` entry is attached, so that contract is unchanged.
 *
 * Deliberately NOT in the snapshot: the built shadcn registry JSON. A release does
 * not build, publish or host the registry (consumers self-host it) — recorded in
 * docs/REGISTRY_GUIDELINES.md and docs/RELEASING.md § 5. The A2UI catalog is not
 * shipped yet (WP-11).
 *
 *   pnpm release:snapshot              pack + write the records + the manifest
 *   pnpm release:snapshot --no-pack    only (re)write the records over what is there
 *
 * Flags:
 *   --no-pack        do not run `pnpm pack`; hash and record whatever is in the folder
 *   --out <dir>      output directory (default: <root>/release/v<version>)
 *   --root <dir>     repo root (default: this file's repo)
 *   --quiet          only print the summary line
 *
 * Dependency-free; ESM; cwd-independent.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { REPO_ROOT, distributablePackages } from "./lib/distributables.mjs";

/** File extensions that count as release assets (everything else is bookkeeping). */
export const ASSET_EXTENSIONS = [".tgz", ".zip"];

/**
 * The agent-facing ground truth copied into `ground-truth/`, as
 * `[repo-relative source, snapshot-relative destination]`. Sources that do not
 * exist (a generator that has not run) are reported, never silently skipped.
 */
export const GROUND_TRUTH_FILES = [
  ["brand-ui.manifest.json", "brand-ui.manifest.json"],
  ["apps/docs/public/component-inventory.md", "component-inventory.md"],
  ["apps/docs/public/llms.txt", "llms.txt"],
];

/** Directory of per-package llms spokes, copied wholesale when present. */
export const GROUND_TRUTH_DIRS = [["apps/docs/public/llms", "llms"]];

/**
 * The validation report `pnpm release:report` writes into the same folder. It is
 * produced by an EARLIER step of release.yml, so by the time the snapshot runs it
 * is already on disk — which is exactly why it must be hashed here: `gh release
 * create` attaches both files, and until #105's follow-up they were the only
 * attached artifacts carrying no checksum at all.
 */
export const VALIDATION_REPORT_FILES = ["validation-report.json", "validation-report.md"];

/**
 * Top-level (non-`ground-truth/`) snapshot files the manifest hashes under
 * `records`. Every file `gh release create` attaches by NAME must be in here, or
 * be `release-manifest.json` (which cannot hash its own output) — that is the
 * property `release-snapshot.test.mjs` asserts against the real release.yml, so a
 * newly attached artifact cannot ship unchecksummed the way the validation report
 * did.
 */
export const RECORD_TOP_LEVEL_FILES = [
  "RELEASE_NOTES.md",
  "CHANGELOG.md",
  ...VALIDATION_REPORT_FILES,
];

/**
 * Snapshot-relative entries the record archive carries, in order. Anything that
 * does not exist is skipped (a fixture with no ground truth still archives, and a
 * local `--no-pack` run without `pnpm release:report` still works).
 */
export const RECORD_ARCHIVE_ENTRIES = [
  "ground-truth",
  "CHANGELOG.md",
  "RELEASE_NOTES.md",
  ...VALIDATION_REPORT_FILES,
];

/** The attachable form of the record half. Top-level `.zip` ⇒ it is an asset. */
export function recordArchiveName(version) {
  return `release-record-${version}.zip`;
}

/** SHA-256 of a file, lowercase hex — the integrity the ZIPs otherwise have none of. */
export function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** The repo's HEAD sha: $GITHUB_SHA in Actions, else `git rev-parse HEAD`, else null. */
export function resolveSha(root) {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

/**
 * Pack every distributable package into `outDir`.
 * `run` is injectable so the self-test never shells out to a real `pnpm pack`.
 * Returns the package rows `{ name, version, relDir }`.
 */
export function packDistributables({
  root = REPO_ROOT,
  outDir,
  packages = distributablePackages(root),
  run = (cwd, args) => execFileSync("pnpm", args, { cwd, stdio: "pipe" }),
} = {}) {
  mkdirSync(outDir, { recursive: true });
  for (const pkg of packages) {
    run(pkg.dir, ["pack", "--pack-destination", outDir]);
  }
  return packages.map(({ name, version, relDir }) => ({ name, version, relDir }));
}

/**
 * The CHANGELOG section for `version`, verbatim. Returns null when the changelog
 * has no heading for it (a release whose notes were never written). Pure — the
 * notes are EXTRACTED from the changelog, never retyped, so they cannot disagree.
 */
export function extractReleaseNotes(changelog, version) {
  const lines = String(changelog).split("\n");
  const isHeading = (l) => /^##\s+/.test(l);
  const start = lines.findIndex(
    (l) => isHeading(l) && new RegExp(`^##\\s+v?${version.replace(/\./g, "\\.")}\\b`).test(l),
  );
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (isHeading(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n").trimEnd() + "\n";
}

/**
 * Write the RECORD half of the snapshot: release notes, the changelog, and the
 * agent-facing ground truth for this exact version (#105). Returns
 * `{ written: string[], missing: string[] }` — snapshot-relative paths.
 */
export function writeSnapshotRecords({ root = REPO_ROOT, outDir, version }) {
  const written = [];
  const missing = [];

  const changelogPath = join(root, "CHANGELOG.md");
  if (existsSync(changelogPath)) {
    const changelog = readFileSync(changelogPath, "utf8");
    writeFileSync(join(outDir, "CHANGELOG.md"), changelog);
    written.push("CHANGELOG.md");
    const notes = extractReleaseNotes(changelog, version);
    if (notes) {
      writeFileSync(join(outDir, "RELEASE_NOTES.md"), notes);
      written.push("RELEASE_NOTES.md");
    } else {
      missing.push(`RELEASE_NOTES.md (CHANGELOG.md has no "## v${version}" heading yet)`);
    }
  } else {
    missing.push("CHANGELOG.md");
  }

  const gtDir = join(outDir, "ground-truth");
  mkdirSync(gtDir, { recursive: true });
  for (const [src, dest] of GROUND_TRUTH_FILES) {
    const from = join(root, src);
    if (!existsSync(from)) {
      missing.push(`ground-truth/${dest} (no ${src})`);
      continue;
    }
    const to = join(gtDir, dest);
    mkdirSync(dirname(to), { recursive: true });
    cpSync(from, to);
    written.push(`ground-truth/${dest}`);
  }
  for (const [src, dest] of GROUND_TRUTH_DIRS) {
    const from = join(root, src);
    if (!existsSync(from)) {
      missing.push(`ground-truth/${dest}/ (no ${src})`);
      continue;
    }
    cpSync(from, join(gtDir, dest), { recursive: true });
    for (const f of readdirSync(join(gtDir, dest)).sort())
      written.push(`ground-truth/${dest}/${f}`);
  }
  return { written, missing };
}

/**
 * Archive the record half into `release-record-<version>.zip` so it survives the
 * runner (#105). Without this the ground truth is checksummed and then deleted
 * with the workspace — the manifest would let you verify bytes nobody can get.
 *
 * Uses the system `zip`, exactly as `build-agent-kit.mjs` / `build-plugin.mjs`
 * already do at release time; `run` is injectable so the self-test never shells
 * out. Returns the archive's file name, or null when there was nothing to archive.
 */
export function archiveRecords({
  outDir,
  version,
  entries = RECORD_ARCHIVE_ENTRIES,
  run = (cwd, args) => execFileSync("zip", args, { cwd, stdio: "pipe" }),
} = {}) {
  const present = entries.filter((e) => existsSync(join(outDir, e)));
  if (present.length === 0) return null;
  const name = recordArchiveName(version);
  rmSync(join(outDir, name), { force: true });
  run(outDir, ["-rq", name, ...present]);
  return name;
}

/** Every file under `dir`, recursively, as paths relative to `dir` (POSIX-joined). */
function filesUnder(dir, base = dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...filesUnder(full, base));
    else out.push(relative(base, full).split(sep).join("/"));
  }
  return out;
}

/**
 * Build the release record for the assets sitting in `outDir`.
 * Pure apart from reading the directory — exported for the self-test.
 *
 * `assets` are the .tgz/.zip bundles; `records` are the auditable documents in the
 * snapshot (notes, changelog, the validation report, ground truth). Both carry a
 * SHA-256 + byte size — "all checksummed", not just the binaries. The only file
 * in the folder without one is `release-manifest.json` itself, which cannot hash
 * its own output.
 */
export function buildReleaseManifest({ version, sha, outDir, packages, date = new Date() }) {
  const digest = (file) => {
    const full = join(outDir, file);
    return { file, bytes: statSync(full).size, sha256: sha256File(full) };
  };
  const top = readdirSync(outDir);
  const assets = top
    .filter((f) => ASSET_EXTENSIONS.some((ext) => f.endsWith(ext)))
    .sort()
    .map(digest);

  const recordFiles = RECORD_TOP_LEVEL_FILES.filter((f) => existsSync(join(outDir, f)));
  if (existsSync(join(outDir, "ground-truth"))) {
    recordFiles.push(...filesUnder(join(outDir, "ground-truth")).map((f) => `ground-truth/${f}`));
  }

  return {
    // Bump when the shape changes so a consumer can branch on it.
    schema: 2,
    version,
    sha,
    date: date.toISOString(),
    packages: packages
      .map(({ name, version: v }) => ({ name, version: v }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    assets,
    records: recordFiles.sort().map(digest),
  };
}

/** Write `release-manifest.json` into `outDir` and return the manifest object. */
export function writeReleaseManifest(args) {
  const manifest = buildReleaseManifest(args);
  writeFileSync(
    join(args.outDir, "release-manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  return manifest;
}

// ──────────────────────────────── CLI ─────────────────────────────────────────
function argValue(argv, flag) {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
}

function main(argv) {
  const root = argValue(argv, "--root") ?? REPO_ROOT;
  const quiet = argv.includes("--quiet");
  const noPack = argv.includes("--no-pack");

  const rootPkgPath = join(root, "package.json");
  if (!existsSync(rootPkgPath)) {
    console.error(`✖ release:snapshot: no package.json at ${root}`);
    return 1;
  }
  const version = JSON.parse(readFileSync(rootPkgPath, "utf8")).version;
  const outDir = argValue(argv, "--out") ?? join(root, "release", `v${version}`);

  const packages = distributablePackages(root);
  if (packages.length === 0) {
    console.error("✖ release:snapshot: no distributable packages found under packages/.");
    return 1;
  }

  mkdirSync(outDir, { recursive: true });
  if (!noPack) {
    if (!quiet) console.log(`  packing ${packages.length} package(s) into ${outDir} …`);
    try {
      packDistributables({ root, outDir, packages });
    } catch (err) {
      console.error(`✖ release:snapshot: pnpm pack failed — ${err.message}`);
      return 1;
    }
  }

  // The auditable record half (#105): notes, changelog, ground truth for this
  // exact version. Written BEFORE the manifest so they are checksummed too.
  // `validation-report.{json,md}` is written into the same folder by the earlier
  // `pnpm release:report` step and is picked up here (see VALIDATION_REPORT_FILES).
  const records = writeSnapshotRecords({ root, outDir, version });

  // …and archived BEFORE the manifest as well, so the archive is itself a
  // checksummed ASSET. `release/` is git-ignored and the runner is discarded, so
  // an un-attached record is a record nobody can ever retrieve.
  let archive = null;
  try {
    archive = archiveRecords({ outDir, version });
  } catch (err) {
    console.error(
      `✖ release:snapshot: could not archive the record half — ${err.message.trim().split("\n")[0]}\n` +
        "  The system `zip` is required at release time (build-agent-kit.mjs and build-plugin.mjs\n" +
        "  need it too). Without the archive the ground truth would be checksummed and then\n" +
        "  discarded with the runner.",
    );
    return 1;
  }

  const manifest = writeReleaseManifest({
    version,
    sha: resolveSha(root),
    outDir,
    packages,
  });

  if (!quiet) {
    for (const a of [...manifest.assets, ...manifest.records]) {
      console.log(`  ${a.sha256.slice(0, 12)}…  ${String(a.bytes).padStart(9)}  ${a.file}`);
    }
  }
  // RELEASE_NOTES.md is a REQUIRED `gh release create` asset (release.yml). It
  // used to be a warning here, so a skipped CHANGELOG rename (docs/RELEASING.md
  // § 2, a manual step) exited 0 and the run died at `gh release create` — after
  // 12 immutable versions had already published. `pnpm changelog:check` catches
  // it before the publish; this is the second line of defence, and it is fatal.
  const fatal = records.missing.filter((m) => /^RELEASE_NOTES\.md|^CHANGELOG\.md/.test(m));
  for (const m of records.missing) {
    if (!fatal.includes(m)) console.warn(`  ! snapshot record not written: ${m}`);
  }
  if (fatal.length > 0) {
    for (const m of fatal) console.error(`✖ release:snapshot: required record missing — ${m}`);
    console.error(
      "\n  Fix (docs/RELEASING.md § 2): rename CHANGELOG.md's `## Unreleased` heading to\n" +
        `  \`## v${version} — <date>\`, then re-run. \`pnpm changelog:check\` asserts this on the\n` +
        "  release path BEFORE anything is published.",
    );
    return 1;
  }
  console.log(
    `✔ release:snapshot: v${version} — ${manifest.packages.length} package(s), ` +
      `${manifest.assets.length} asset(s) + ${manifest.records.length} record(s) ` +
      `checksummed in ${outDir}` +
      (archive ? `; the records are attachable as ${archive}.` : "."),
  );
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
