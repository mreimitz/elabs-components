#!/usr/bin/env node
/**
 * check-release-notes.mjs — the publish-only PREFLIGHT for the release notes.
 *
 * `gh release create` lists `release/v<version>/RELEASE_NOTES.md` as a REQUIRED
 * asset, but that file only exists if `CHANGELOG.md` carries a `## v<version>`
 * heading — and writing it is a documented-but-ungated MANUAL step
 * (docs/RELEASING.md § 2, `.claude/commands/release.md` § 3). Skip the rename and
 * the run publishes all 12 immutable npm versions, THEN dies at `gh release
 * create` with a missing file: no Release, no assets, no manifest, and neither
 * post-release verify step ever runs. That is precisely the half-published
 * failure mode the workflow's preflight block exists to prevent — and until this
 * gate, `release-snapshot.mjs` only WARNED (`! snapshot record not written`) and
 * exited 0.
 *
 * So: assert the notes are extractable BEFORE anything is published.
 *
 *   pnpm changelog:check                 # against the root package.json version
 *   node scripts/check-release-notes.mjs --version 2.1.0 --root <dir>
 *
 * Flags:
 *   --version <v>   version to require a section for (default: root package.json)
 *   --root <dir>    repo root (default: this file's repo)
 *
 * Deliberately NOT part of the per-PR battery: on a feature branch the changelog
 * correctly has no `## v<next>` heading yet (the entries live under
 * `## Unreleased`), so this can only be a release-path preflight. Its self-test
 * (`pnpm changelog:check:test`) runs on every PR instead.
 *
 * Dependency-free; ESM; cwd-independent.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractReleaseNotes } from "./release-snapshot.mjs";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * Why the release notes for `version` cannot be produced from `changelog`, or
 * null when they can. Pure — exported for the self-test.
 *
 * Two distinct failures, because they need different fixes:
 *   - no `## v<version>` heading at all (the rename in § 2 was skipped);
 *   - the heading exists but the section is empty (renamed, never written).
 */
export function releaseNotesProblem(changelog, version) {
  const notes = extractReleaseNotes(changelog, version);
  if (notes === null) {
    return (
      `CHANGELOG.md has no "## v${version}" heading, so release/v${version}/RELEASE_NOTES.md ` +
      "cannot be written — and `gh release create` lists it as a required asset."
    );
  }
  const body = notes
    .split("\n")
    .slice(1)
    .filter((l) => l.trim() !== "")
    .join("\n");
  if (body.trim() === "") {
    return `CHANGELOG.md's "## v${version}" section is empty — the release notes would ship blank.`;
  }
  return null;
}

// ──────────────────────────────── CLI ─────────────────────────────────────────
function argValue(argv, flag) {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
}

function main(argv = []) {
  const root = argValue(argv, "--root") ?? REPO_ROOT;
  const rootPkgPath = join(root, "package.json");
  if (!existsSync(rootPkgPath)) {
    console.error(`✖ changelog:check: no package.json at ${root}`);
    return 1;
  }
  const version =
    argValue(argv, "--version") ?? JSON.parse(readFileSync(rootPkgPath, "utf8")).version;

  const changelogPath = join(root, "CHANGELOG.md");
  if (!existsSync(changelogPath)) {
    console.error(`✖ changelog:check: no CHANGELOG.md at ${root}`);
    return 1;
  }

  const problem = releaseNotesProblem(readFileSync(changelogPath, "utf8"), version);
  if (problem) {
    console.error(`✖ changelog:check: ${problem}`);
    console.error(
      `\n  Fix (docs/RELEASING.md § 2): rename CHANGELOG.md's \`## Unreleased\` heading to\n` +
        `  \`## v${version} — <date>\` and open a fresh \`## Unreleased\` above it, then commit\n` +
        "  and re-tag. This runs BEFORE the publish precisely so you still can.",
    );
    return 1;
  }

  console.log(
    `✔ changelog:check: CHANGELOG.md carries a non-empty "## v${version}" section — ` +
      "RELEASE_NOTES.md will be extractable.",
  );
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
