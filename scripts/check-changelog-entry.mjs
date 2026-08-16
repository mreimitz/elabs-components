#!/usr/bin/env node
/**
 * check-changelog-entry.mjs — a package-affecting change must record itself (#64).
 *
 * WP-07 issue-01 asks for "a changeset is required for package-affecting PRs (CI
 * check)". This repo does not use Changesets — ADR 0020 records why (16 lockstep
 * sites, four of which are not npm packages; one number written by
 * `pnpm version:set`). But the AC's PROPERTY is not about Changesets: it is that
 * a change to shipped package source cannot land without a written record of what
 * changed. ADR 0020 accepted that gap explicitly ("no per-PR ceremony"); this is
 * the lockstep-idiom equivalent, so the property holds without a second
 * versioning tool.
 *
 * The rule: if a branch touches SHIPPED source in a distributable package
 * (`packages/<distributable>/src/**`, excluding tests and stories), it must also
 * add at least one line to `CHANGELOG.md` inside the `## Unreleased` section.
 *
 * Deliberately narrow, so it flags a missing record and nothing else:
 *   - only `src/**` of a DERIVED distributable package (scripts/lib/distributables.mjs)
 *     — an app, a config package, a doc or a gate script needs no consumer-facing note;
 *   - `*.test.*` / `*.stories.*` / `__tests__/` are excluded — they change no shipped
 *     behaviour a consumer upgrades into;
 *   - an ADDED line inside `## Unreleased` is required, not merely a touched
 *     CHANGELOG.md, so a whitespace edit or a heading rename does not satisfy it.
 *
 * Section membership (#380): an added line counts iff its ABSOLUTE post-image
 * line number falls inside the `## Unreleased` span read directly from HEAD's
 * CHANGELOG.md — not inferred from git's optional per-hunk funcname (this repo
 * configures no diff driver, so that text is arbitrary nearby prose) or from a
 * fixed diff-context window (the section is 1300+ lines long with 20+ `###`
 * subsections on `main`, which blows past any such window). See
 * `addedLineNumbers` / `unreleasedSpan` / `addsUnreleasedEntry` below.
 *
 * It needs a BASE REF to diff against. On a pull request that is
 * `$GITHUB_BASE_REF`; locally, `--base <ref>` or the default branch. If no base
 * can be resolved (a tag build, a shallow clone with nothing fetchable), it
 * reports that plainly and exits 0 — a gate must not red a release for having
 * nothing to compare against.
 *
 *   pnpm changelog-entry:check
 *   pnpm changelog-entry:check --base origin/main
 *   node scripts/check-changelog-entry.mjs --root <dir> --base <ref>
 *
 * Dependency-free; ESM; cwd-independent.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT, distributablePackages } from "./lib/distributables.mjs";

/** Paths under a package's `src/` that change no shipped behaviour. */
const NON_SHIPPING_RE = /(?:^|\/)(?:__tests__|__mocks__)\/|\.(?:test|spec|stories)\.[cm]?[jt]sx?$/;

/**
 * Which of `changedFiles` are shipped source of a distributable package.
 * `relDirs` are repo-relative package directories (`packages/ui`). Pure.
 */
export function shippedSourceChanges(changedFiles, relDirs) {
  const prefixes = relDirs.map((d) => `${d.split("\\").join("/")}/src/`);
  return changedFiles
    .map((f) => f.split("\\").join("/"))
    .filter((f) => prefixes.some((p) => f.startsWith(p)))
    .filter((f) => !NON_SHIPPING_RE.test(f))
    .sort();
}

/**
 * Absolute POST-IMAGE line numbers of every ADDED, non-blank, non-heading line
 * in a unified diff of a single file. Pure — exported for the self-test.
 *
 * Resolved from the diff's own `@@ -a,b +c,d @@` headers (which git always
 * emits, mechanically) by walking each hunk with a running post-image line
 * counter: `+` and context (` `) lines advance it, `-` lines do not (they exist
 * only in the pre-image). Deliberately does NOT read the optional funcname text
 * git appends after the second `@@` — this repo has no diff driver configured
 * for CHANGELOG.md, so that text is arbitrary nearby prose, not a heading (#380
 * root cause a/c).
 */
export function addedLineNumbers(changelogDiff) {
  const added = [];
  let postLine = 0;
  let inHunk = false;
  for (const raw of String(changelogDiff).split("\n")) {
    const hunk = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      postLine = Number(hunk[1]) - 1;
      inHunk = true;
      continue;
    }
    if (!inHunk) continue;
    if (/^[-+]{3}\s/.test(raw)) continue; // ---/+++ file headers
    if (raw.startsWith("+")) {
      postLine += 1;
      const body = raw.slice(1);
      // A heading addition (renaming/moving `## Unreleased` itself, or any
      // other heading) is not a record of what changed.
      if (body.trim() !== "" && !/^#{1,6}\s/.test(body)) added.push(postLine);
    } else if (raw.startsWith("-")) {
      // pre-image-only line — no post-image line number to advance.
    } else if (raw.startsWith(" ") || raw === "") {
      postLine += 1;
    }
    // Any other line shape (e.g. `\ No newline at end of file`) is ignored.
  }
  return added;
}

/**
 * The `## Unreleased` section's line span in a CHANGELOG's POST-IMAGE content:
 * `{ start, end }`, both 1-based; a line strictly between `start` and `end`
 * belongs to the section (so the heading line itself, at `start`, is excluded —
 * renaming it is not an entry). `null` when there is no `## Unreleased` heading.
 * Pure — exported for the self-test.
 *
 * `/^##\s+/` (exactly two `#` then whitespace) deliberately does NOT match a
 * `###` subsection heading — the third `#` sits where `\s+` must match — so a
 * `### Fixed` subsection stays INSIDE the span instead of prematurely closing
 * it (#380 root cause c).
 */
export function unreleasedSpan(content) {
  const lines = String(content).split("\n");
  const headingIdx = lines.findIndex((l) => /^##\s+Unreleased\b/i.test(l));
  if (headingIdx === -1) return null;
  let endIdx = lines.length; // sentinel: no next `## ` heading — span runs to EOF
  for (let i = headingIdx + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) {
      endIdx = i;
      break;
    }
  }
  return { start: headingIdx + 1, end: endIdx + 1 };
}

/**
 * Does a unified diff of CHANGELOG.md ADD at least one line inside the
 * `## Unreleased` section? Pure — exported for the self-test.
 *
 * `postImageContent` is the file AFTER the diff is applied (i.e. `HEAD`'s
 * CHANGELOG.md) — the section boundary is read directly from it, not inferred
 * from the diff's context window. A 1300+-line `## Unreleased` section (as on
 * `main`, #380) blows past any fixed `-U<n>` context, which is exactly why the
 * previous body-scan fallback went silently blind on any entry more than a few
 * lines below the heading. Resolving to absolute line numbers removes the
 * dependency on both the diff driver (root cause a) and the context window
 * (root cause b) — and works identically with or without `.gitattributes`.
 */
export function addsUnreleasedEntry(changelogDiff, postImageContent) {
  const span = unreleasedSpan(postImageContent);
  if (!span) return false;
  return addedLineNumbers(changelogDiff).some((n) => n > span.start && n < span.end);
}

// ──────────────────────────────── CLI ─────────────────────────────────────────
function git(root, args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: "pipe" });
}

/** Try hard to name a base ref to diff against; null when there is none. */
export function resolveBase(root, explicit) {
  const exists = (ref) => {
    try {
      git(root, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
      return true;
    } catch {
      return false;
    }
  };
  if (explicit) return exists(explicit) ? explicit : null;

  // GitHub Actions, `pull_request`: the target branch. Shallow clones do not have
  // it, so fetch it first — best effort, never fatal.
  const baseRef = process.env.GITHUB_BASE_REF;
  if (baseRef) {
    if (!exists(`origin/${baseRef}`)) {
      try {
        git(root, [
          "fetch",
          "--no-tags",
          "--depth=200",
          "origin",
          `+refs/heads/${baseRef}:refs/remotes/origin/${baseRef}`,
        ]);
      } catch {
        /* offline / no such branch — handled by the exists() check below */
      }
    }
    return exists(`origin/${baseRef}`) ? `origin/${baseRef}` : null;
  }

  for (const ref of ["origin/main", "main"]) if (exists(ref)) return ref;
  return null;
}

function main(argv = []) {
  const at = (flag) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const root = at("--root") ?? REPO_ROOT;

  const base = resolveBase(root, at("--base"));
  if (!base) {
    console.log(
      "• changelog-entry: no base ref to diff against (not a pull request, or the branch is " +
        "unavailable) — nothing to compare, skipping. Pass --base <ref> to force one.",
    );
    return 0;
  }

  // Two-dot against the resolved base. On a `pull_request` run the checkout is
  // already the merge commit, so this is the PR's own change set; locally it is
  // "what this branch has that the base does not", which is the same question.
  let changed;
  try {
    changed = git(root, ["diff", "--name-only", base, "HEAD"]).split("\n").filter(Boolean);
  } catch (err) {
    console.log(
      `• changelog-entry: could not diff against ${base} (${err.message.trim().split("\n")[0]}) ` +
        "— skipping rather than failing on a git limitation.",
    );
    return 0;
  }

  const relDirs = distributablePackages(root).map((p) => p.relDir);
  const shipped = shippedSourceChanges(changed, relDirs);
  if (shipped.length === 0) {
    console.log(
      `✔ changelog-entry: no shipped package source changed vs ${base} — no CHANGELOG entry required.`,
    );
    return 0;
  }

  if (!existsSync(join(root, "CHANGELOG.md"))) {
    console.error("✖ changelog-entry: CHANGELOG.md does not exist.");
    return 1;
  }
  let diff = "";
  try {
    diff = git(root, ["diff", "-U0", base, "HEAD", "--", "CHANGELOG.md"]);
  } catch {
    diff = "";
  }
  // The post-image is HEAD's CHANGELOG.md — the exact ref the diff's `+c,d`
  // headers are numbered against — not the working tree (which may hold
  // uncommitted edits the diff never saw).
  let postImage = "";
  try {
    postImage = git(root, ["show", "HEAD:CHANGELOG.md"]);
  } catch {
    postImage = "";
  }

  if (addsUnreleasedEntry(diff, postImage)) {
    console.log(
      `✔ changelog-entry: ${shipped.length} shipped source file(s) changed vs ${base}, ` +
        "and CHANGELOG.md's `## Unreleased` section records it.",
    );
    return 0;
  }

  console.error(
    `✖ changelog-entry: ${shipped.length} file(s) of shipped package source changed vs ${base}, ` +
      "but CHANGELOG.md's `## Unreleased` section gained no entry:",
  );
  for (const f of shipped.slice(0, 12)) console.error(`    ${f}`);
  if (shipped.length > 12) console.error(`    … and ${shipped.length - 12} more`);
  console.error(
    "\n  Fix: add a line under `## Unreleased` in CHANGELOG.md saying what a CONSUMER gets.\n" +
      "  This repo versions in lockstep rather than with Changesets (docs/ADR/0020), so the\n" +
      "  hand-written `## Unreleased` section IS the per-change record: `/release` renames it\n" +
      "  to `## vX.Y.Z`, release-snapshot.mjs extracts RELEASE_NOTES.md from it, and\n" +
      "  `pnpm changelog:check` refuses to publish without it. A change with no entry ships\n" +
      "  to consumers undocumented.\n" +
      "  Test-only / story-only / app-only changes are already exempt.",
  );
  return 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
