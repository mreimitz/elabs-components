/**
 * check-release-notes.test.mjs — self-test for the release-notes preflight
 * (#106/#71). Run in CI: `node --test scripts/check-release-notes.test.mjs`
 * (`pnpm changelog:check:test`).
 *
 * The gate exists for ONE scenario: the CHANGELOG rename in docs/RELEASING.md § 2
 * is a manual step, and skipping it used to publish 12 immutable npm versions and
 * only then fail at `gh release create` on a missing RELEASE_NOTES.md. So the
 * fixtures plant exactly that, plus the near-miss variants:
 *
 *   - a changelog still on `## Unreleased` (the rename was skipped),
 *   - a renamed but EMPTY section (renamed, never written),
 *   - a heading for the PREVIOUS version only (bumped, changelog lagged),
 *   - the good shape, in both `## v2.1.0` and `## 2.1.0` forms.
 *
 * A gate that can silently stop firing is worse than none (quality-gates.md,
 * "Self-tested gates"), so the CLI is also driven end-to-end over a fixture repo.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { releaseNotesProblem } from "./check-release-notes.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

const GOOD = [
  "# Changelog",
  "",
  "## Unreleased",
  "",
  "## v2.1.0 — 2026-08-02",
  "",
  "### Fixed",
  "",
  "- the release smoke no longer 404s every public dependency",
  "",
  "## v2.0.0 — 2026-08-01",
  "",
  "- the scope rename",
].join("\n");

test("PASSES: a non-empty `## v<version>` section", () => {
  assert.equal(releaseNotesProblem(GOOD, "2.1.0"), null);
});

test("PASSES: the heading written without the `v` prefix", () => {
  const text = "# Changelog\n\n## 2.1.0 — 2026-08-02\n\n- a real entry\n";
  assert.equal(releaseNotesProblem(text, "2.1.0"), null);
});

test("FLAGS: the § 2 rename was skipped — entries still under `## Unreleased`", () => {
  const text = [
    "# Changelog",
    "",
    "## Unreleased",
    "",
    "- the release smoke no longer 404s every public dependency",
    "",
    "## v2.0.0 — 2026-08-01",
  ].join("\n");
  const problem = releaseNotesProblem(text, "2.1.0");
  assert.match(problem, /no "## v2\.1\.0" heading/);
  assert.match(problem, /required asset/);
});

test("FLAGS: the heading exists but the section is empty", () => {
  const text = "# Changelog\n\n## v2.1.0 — 2026-08-02\n\n\n## v2.0.0 — 2026-08-01\n\n- prior\n";
  assert.match(releaseNotesProblem(text, "2.1.0"), /is empty/);
});

test("FLAGS: only the PREVIOUS version has a section (the bump outran the changelog)", () => {
  assert.match(releaseNotesProblem(GOOD, "2.2.0"), /no "## v2\.2\.0" heading/);
});

test("a version whose dots could act as regex wildcards is matched literally", () => {
  // "2.1.0" must not match a "2X1Y0" heading — the extractor escapes the dots.
  const text = "# Changelog\n\n## v2X1Y0\n\n- entry\n";
  assert.match(releaseNotesProblem(text, "2.1.0"), /no "## v2\.1\.0" heading/);
});

// ── CLI: the gate reds on the real failure and greens on the real fix ─────────

function run(args) {
  return new Promise((resolve) => {
    execFile("node", args, { encoding: "utf8" }, (err, stdout, stderr) =>
      resolve({ code: err?.code ?? 0, stdout, stderr }),
    );
  });
}

/** A throwaway repo root with a package.json + the given CHANGELOG. */
function fixtureRepo(version, changelog) {
  const root = mkdtempSync(join(tmpdir(), "brand-ui-changelog-"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture", version }));
  if (changelog !== null) writeFileSync(join(root, "CHANGELOG.md"), changelog);
  return root;
}

test("CLI: exits 1 and names the § 2 fix when the rename was skipped", async () => {
  const root = fixtureRepo("2.1.0", "# Changelog\n\n## Unreleased\n\n- an entry\n");
  try {
    const { code, stderr } = await run([join(HERE, "check-release-notes.mjs"), "--root", root]);
    assert.equal(code, 1, "an unwritable RELEASE_NOTES.md must fail BEFORE the publish");
    assert.match(stderr, /no "## v2\.1\.0" heading/);
    assert.match(stderr, /RELEASING\.md § 2/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI: exits 0 once the section exists", async () => {
  const root = fixtureRepo("2.1.0", GOOD);
  try {
    const { code, stdout } = await run([join(HERE, "check-release-notes.mjs"), "--root", root]);
    assert.equal(code, 0);
    assert.match(stdout, /✔ changelog:check/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI: a missing CHANGELOG.md is a failure, not a silent pass", async () => {
  const root = fixtureRepo("2.1.0", null);
  try {
    const { code, stderr } = await run([join(HERE, "check-release-notes.mjs"), "--root", root]);
    assert.equal(code, 1);
    assert.match(stderr, /no CHANGELOG\.md/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI: --version overrides the package.json version", async () => {
  const root = fixtureRepo("9.9.9", GOOD);
  try {
    const ok = await run([
      join(HERE, "check-release-notes.mjs"),
      "--root",
      root,
      "--version",
      "2.1.0",
    ]);
    assert.equal(ok.code, 0);
    const bad = await run([join(HERE, "check-release-notes.mjs"), "--root", root]);
    assert.equal(bad.code, 1, "9.9.9 has no section — the default must still be checked");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
