// check-baseline-provenance.test.mjs — self-test for the ratchet-baseline
// PROVENANCE meta-gate (#400).
//
// Every ratchet-baseline gate (variant-coverage, loading-states,
// state-coverage) trusted the CONTENTS of its committed baseline file
// unconditionally — hand-editing scripts/variant-coverage-baseline.json to
// add a fabricated, non-reproducible entry made `pnpm variants:check` exit 0,
// no --force, no script involvement. This meta-gate re-derives what each
// gate's OWN --update would currently write and fails when the committed
// baseline contains an entry that derivation does not explain.
//
// Locks: (1) the pure provenance check (`findOrphanedBaselineEntries`) flags
// exactly the entries with no matching derived gap, and is silent when the
// baseline is a subset of (or equal to) the derivation; (2) end-to-end via a
// planted fixture manifest/repo, a fabricated key has no matching REAL gap
// (via the real `findVariantGaps`); (3) the CLI (`--root`) fails on a
// hand-raised baseline file and passes on one shaped exactly like the current
// derivation (the sanctioned `--update` outcome); (4) all three named gates
// are registered; (5) the REAL repo currently passes the meta-gate.
//
// Run: node --test scripts/check-baseline-provenance.test.mjs  (pnpm baseline-provenance:check:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  GATES,
  findOrphanedBaselineEntries,
  checkGateProvenance,
  findAddedBaselineKeys,
  readBaselineAtRef,
} from "./check-baseline-provenance.mjs";
import { findVariantGaps } from "./check-variant-coverage.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

// ── findOrphanedBaselineEntries: pure provenance check ─────────────────────

test("findOrphanedBaselineEntries: a baseline entry with NO matching derived gap is an orphan (laundering signature)", () => {
  const derived = ["pkg::A::variant=x"];
  const committed = ["pkg::A::variant=x", "pkg::A::variant=FABRICATED"];
  assert.deepEqual(findOrphanedBaselineEntries(committed, derived), ["pkg::A::variant=FABRICATED"]);
});

test("findOrphanedBaselineEntries: baseline exactly equal to derivation — no orphans", () => {
  const derived = ["pkg::A::variant=x", "pkg::A::variant=y"];
  assert.deepEqual(findOrphanedBaselineEntries(derived, derived), []);
});

test("findOrphanedBaselineEntries: baseline is a SUBSET of the derivation — no orphans (pre-existing debt, not yet ratcheted)", () => {
  const derived = ["pkg::A::variant=x", "pkg::A::variant=y"];
  const committed = ["pkg::A::variant=x"];
  assert.deepEqual(findOrphanedBaselineEntries(committed, derived), []);
});

// ── findAddedBaselineKeys: pure GIT-PROVENANCE check (#400 Finding 3) ──────
// Independent of derivation: this asks "did the branch add it", not "is it
// currently real". A genuinely real, currently-derivable gap that the branch
// hand-added instead of fixing is exactly what this must flag — derivation
// alone (findOrphanedBaselineEntries) explains it fine and stays silent.

test("findAddedBaselineKeys: a key present now but absent at the base ref is ADDED", () => {
  const atBase = ["pkg::A::variant=x"];
  const committed = ["pkg::A::variant=x", "pkg::A::variant=NEW"];
  assert.deepEqual(findAddedBaselineKeys(committed, atBase), ["pkg::A::variant=NEW"]);
});

test("findAddedBaselineKeys: baseline unchanged vs base ref — nothing added", () => {
  const atBase = ["pkg::A::variant=x", "pkg::A::variant=y"];
  assert.deepEqual(findAddedBaselineKeys(atBase, atBase), []);
});

test("findAddedBaselineKeys: baseline SHRANK vs base ref (a fix landed) — nothing added", () => {
  const atBase = ["pkg::A::variant=x", "pkg::A::variant=y"];
  const committed = ["pkg::A::variant=x"];
  assert.deepEqual(findAddedBaselineKeys(committed, atBase), []);
});

// ── GATES: the three named gates are registered ────────────────────────────

test("GATES registers exactly variant-coverage, loading-states, state-coverage", () => {
  const names = GATES.map((g) => g.name).sort();
  assert.deepEqual(names, ["loading-states", "state-coverage", "variant-coverage"]);
});

// ── checkGateProvenance / findVariantGaps: end-to-end via a planted fixture ─

function fixtureManifest(variants) {
  return {
    packages: {
      "@elabs/components-fixture": {
        path: "pkg-fixture",
        components: [{ name: "Widget", module: "pkg-fixture/src/widget.tsx" }],
        variants: { Widget: variants },
      },
    },
  };
}

function writeFixtureRepo(storyContents) {
  const root = mkdtempSync(join(tmpdir(), "baseline-provenance-e2e-"));
  mkdirSync(join(root, "pkg-fixture", "src"), { recursive: true });
  writeFileSync(join(root, "pkg-fixture", "src", "widget.tsx"), "export function Widget() {}\n");
  writeFileSync(
    join(root, "pkg-fixture", "src", "widget.stories.tsx"),
    'import { Widget } from "./widget";\n' + storyContents,
  );
  return root;
}

test("checkGateProvenance: a HAND-RAISED (fabricated) baseline entry has no matching REAL gap", () => {
  const root = writeFixtureRepo(
    [
      "const meta = { argTypes: { variant: { options: ['default', 'success'] } } };",
      "export default meta;",
      'export const Default: Story = { args: { variant: "default" } };',
      'export const Success: Story = { args: { variant: "success" } };',
      "",
    ].join("\n"),
  );
  try {
    const manifest = fixtureManifest({
      variants: { variant: ["default", "success"] },
      defaultVariants: { variant: "default" },
    });
    // Sanity: this fixture genuinely has no real gaps (both values rendered).
    assert.deepEqual(findVariantGaps(manifest, root), []);
    const fabricated = ["@elabs/components-fixture::Widget::variant=FABRICATED"];
    const variantGate = GATES.find((g) => g.name === "variant-coverage");
    const result = checkGateProvenance(variantGate, manifest, fabricated, root);
    assert.deepEqual(result.orphans, fabricated);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("checkGateProvenance: a baseline shaped like a real --update output has zero orphans", () => {
  const root = writeFixtureRepo(
    [
      "const meta = { argTypes: { variant: { options: ['default', 'success'] } } };",
      "export default meta;",
      'export const Default: Story = { args: { variant: "default" } };',
      "",
    ].join("\n"),
  );
  try {
    const manifest = fixtureManifest({
      variants: { variant: ["default", "success"] },
      defaultVariants: { variant: "default" },
    });
    const realGaps = findVariantGaps(manifest, root).map((g) => g.key);
    assert.deepEqual(realGaps, ["@elabs/components-fixture::Widget::variant=success"]);
    const variantGate = GATES.find((g) => g.name === "variant-coverage");
    const result = checkGateProvenance(variantGate, manifest, realGaps, root);
    assert.deepEqual(result.orphans, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── CLI (--root): isolated fixture tree, never touches the real committed files ──

function writeCliFixtureRoot({
  variantBaseline,
  loadingBaseline = [],
  stateBaseline = [],
  // Both variant values rendered by default (zero real gaps) — override with a
  // Default-only story to exercise a fixture that DOES have a real, derivable gap.
  storyLines = [
    'import { Widget } from "./widget";',
    "const meta = { argTypes: { variant: { options: ['default', 'success'] } } };",
    "export default meta;",
    'export const Default: Story = { args: { variant: "default" } };',
    'export const Success: Story = { args: { variant: "success" } };',
    "",
  ],
}) {
  const root = mkdtempSync(join(tmpdir(), "baseline-provenance-cli-"));
  mkdirSync(join(root, "pkg-fixture", "src"), { recursive: true });
  mkdirSync(join(root, "scripts"), { recursive: true });
  writeFileSync(join(root, "pkg-fixture", "src", "widget.tsx"), "export function Widget() {}\n");
  writeFileSync(join(root, "pkg-fixture", "src", "widget.stories.tsx"), storyLines.join("\n"));
  writeFileSync(
    join(root, "brand-ui.manifest.json"),
    JSON.stringify({
      packages: {
        "@elabs/components-fixture": {
          path: "pkg-fixture",
          components: [{ name: "Widget", module: "pkg-fixture/src/widget.tsx" }],
          variants: {
            Widget: {
              variants: { variant: ["default", "success"] },
              defaultVariants: { variant: "default" },
            },
          },
        },
      },
    }),
  );
  writeFileSync(
    join(root, "scripts", "variant-coverage-baseline.json"),
    JSON.stringify(variantBaseline),
  );
  writeFileSync(
    join(root, "scripts", "loading-states-baseline.json"),
    JSON.stringify(loadingBaseline),
  );
  writeFileSync(
    join(root, "scripts", "state-coverage-baseline.json"),
    JSON.stringify(stateBaseline),
  );
  return root;
}

test("CLI --root: a hand-raised (fabricated) baseline entry FAILS the meta-gate, non-zero exit", () => {
  const root = writeCliFixtureRoot({
    variantBaseline: ["@elabs/components-fixture::Widget::variant=FABRICATED"],
  });
  try {
    const result = spawnSync(
      "node",
      [join(HERE, "check-baseline-provenance.mjs"), "--root", root],
      {
        encoding: "utf8",
      },
    );
    assert.notEqual(result.status, 0, `expected failure, got: ${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /variant-coverage/);
    assert.match(result.stderr, /FABRICATED/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI --root: a baseline shaped exactly like the current derivation (the --update outcome) PASSES", () => {
  // Default-only story: this fixture's ONE real gap is `variant=success` (no
  // story renders it) — a baseline recording exactly that, and nothing else,
  // is what a real `pnpm variants:check -- --update` run on it would write.
  const root = writeCliFixtureRoot({
    variantBaseline: ["@elabs/components-fixture::Widget::variant=success"],
    storyLines: [
      'import { Widget } from "./widget";',
      "const meta = { argTypes: { variant: { options: ['default', 'success'] } } };",
      "export default meta;",
      'export const Default: Story = { args: { variant: "default" } };',
      "",
    ],
  });
  try {
    const out = execFileSync(
      "node",
      [join(HERE, "check-baseline-provenance.mjs"), "--root", root],
      {
        encoding: "utf8",
      },
    );
    assert.match(out, /✔ baseline-provenance/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── CLI --root, GIT-BACKED fixture: the git-provenance rung (#400 Finding 3) ──
// The derivation-only fixtures above (writeCliFixtureRoot) are plain directories
// with NO git history — resolveBase() correctly finds nothing to diff against
// there, so those tests exercise rung 1 in isolation (unaffected by this rung).
// This section builds a REAL two-commit git repo to reproduce the issue's own
// literal §Reproduction: a genuinely NEW, real, currently-derivable violation
// hand-added to the baseline in the SAME change instead of being fixed.

function gitFixture(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function writeGitFixtureState(root, { variantOptions, variantBaseline, storyRendersCritical }) {
  mkdirSync(join(root, "pkg-fixture", "src"), { recursive: true });
  mkdirSync(join(root, "scripts"), { recursive: true });
  writeFileSync(join(root, "pkg-fixture", "src", "widget.tsx"), "export function Widget() {}\n");
  const storyLines = [
    'import { Widget } from "./widget";',
    `const meta = { argTypes: { variant: { options: ${JSON.stringify(variantOptions)} } } };`,
    "export default meta;",
    'export const Default: Story = { args: { variant: "default" } };',
  ];
  if (storyRendersCritical) {
    storyLines.push('export const Critical: Story = { args: { variant: "critical" } };');
  }
  storyLines.push("");
  writeFileSync(join(root, "pkg-fixture", "src", "widget.stories.tsx"), storyLines.join("\n"));
  writeFileSync(
    join(root, "brand-ui.manifest.json"),
    JSON.stringify({
      packages: {
        "@elabs/components-fixture": {
          path: "pkg-fixture",
          components: [{ name: "Widget", module: "pkg-fixture/src/widget.tsx" }],
          variants: {
            Widget: {
              variants: { variant: variantOptions },
              defaultVariants: { variant: "default" },
            },
          },
        },
      },
    }),
  );
  writeFileSync(
    join(root, "scripts", "variant-coverage-baseline.json"),
    JSON.stringify(variantBaseline),
  );
  writeFileSync(join(root, "scripts", "loading-states-baseline.json"), JSON.stringify([]));
  writeFileSync(join(root, "scripts", "state-coverage-baseline.json"), JSON.stringify([]));
}

test("CLI --root --base: a genuinely NEW, real violation hand-added to the baseline (not fixed) is CAUGHT", () => {
  const root = mkdtempSync(join(tmpdir(), "baseline-provenance-git-repro-"));
  try {
    gitFixture(root, ["init", "--quiet"]);
    gitFixture(root, ["config", "user.email", "test@example.com"]);
    gitFixture(root, ["config", "user.name", "Test"]);

    // Commit A ("before"): Widget has only `default`, fully covered, baseline empty.
    writeGitFixtureState(root, {
      variantOptions: ["default"],
      variantBaseline: [],
      storyRendersCritical: false,
    });
    gitFixture(root, ["add", "-A"]);
    gitFixture(root, ["commit", "--quiet", "-m", "before"]);
    const before = gitFixture(root, ["rev-parse", "HEAD"]);

    // Commit B ("branch"): a NEW real, currently-derivable gap (`critical` added,
    // no story ships it) is LAUNDERED by hand-adding its key to the baseline
    // instead of adding the story — the issue's own §Reproduction, verbatim.
    writeGitFixtureState(root, {
      variantOptions: ["default", "critical"],
      variantBaseline: ["@elabs/components-fixture::Widget::variant=critical"],
      storyRendersCritical: false,
    });
    gitFixture(root, ["add", "-A"]);
    gitFixture(root, ["commit", "--quiet", "-m", "branch: add critical, launder via baseline"]);

    // Sanity, matching the verdict's own Finding 3 repro: derivation ALONE
    // (rung 1, with rung 2 skipped via --force) does NOT catch this — the key
    // IS a real, currently-reproducible gap, so it is not an "orphan".
    const derivationOnly = spawnSync(
      "node",
      [join(HERE, "check-baseline-provenance.mjs"), "--root", root, "--base", before, "--force"],
      { encoding: "utf8" },
    );
    assert.equal(
      derivationOnly.status,
      0,
      `expected derivation-only (--force) to pass, got: ${derivationOnly.stdout}\n${derivationOnly.stderr}`,
    );

    // The git-provenance rung (default, no --force) DOES catch it.
    const result = spawnSync(
      "node",
      [join(HERE, "check-baseline-provenance.mjs"), "--root", root, "--base", before],
      { encoding: "utf8" },
    );
    assert.notEqual(result.status, 0, `expected failure, got: ${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /variant-coverage/);
    assert.match(result.stderr, /variant=critical/);
    assert.match(result.stderr, /ADDED/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI --root --base: baseline unchanged vs the base ref — git-provenance rung passes", () => {
  const root = mkdtempSync(join(tmpdir(), "baseline-provenance-git-unchanged-"));
  try {
    gitFixture(root, ["init", "--quiet"]);
    gitFixture(root, ["config", "user.email", "test@example.com"]);
    gitFixture(root, ["config", "user.name", "Test"]);
    writeGitFixtureState(root, {
      variantOptions: ["default", "critical"],
      variantBaseline: ["@elabs/components-fixture::Widget::variant=critical"],
      storyRendersCritical: false,
    });
    gitFixture(root, ["add", "-A"]);
    gitFixture(root, ["commit", "--quiet", "-m", "only commit — baseline pre-existing, not new"]);
    const only = gitFixture(root, ["rev-parse", "HEAD"]);

    const out = execFileSync(
      "node",
      [join(HERE, "check-baseline-provenance.mjs"), "--root", root, "--base", only],
      { encoding: "utf8" },
    );
    assert.match(out, /✔ baseline-provenance/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("readBaselineAtRef: unresolvable ref — returns null (skip, never a false failure)", () => {
  const root = mkdtempSync(join(tmpdir(), "baseline-provenance-unresolvable-"));
  try {
    gitFixture(root, ["init", "--quiet"]);
    assert.equal(
      readBaselineAtRef(root, "not-a-real-ref", "scripts/variant-coverage-baseline.json"),
      null,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI --root (no git history): git-provenance rung is skipped, never a false failure", () => {
  // Empty baseline (not the `variant=success` fixture used above): the default
  // storyLines render BOTH variant values, so there is zero REAL gap — any
  // non-empty baseline here would fail rung 1 on its own and defeat the point
  // of this test, which is isolating rung 2's skip behaviour.
  const root = writeCliFixtureRoot({ variantBaseline: [] });
  try {
    const out = execFileSync(
      "node",
      [join(HERE, "check-baseline-provenance.mjs"), "--root", root],
      { encoding: "utf8" },
    );
    assert.match(out, /✔ baseline-provenance/);
    assert.match(out, /skipped/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── CLI: the REAL repo currently passes the meta-gate ──────────────────────

test("CLI: the REAL repo currently passes baseline-provenance:check", () => {
  const out = execFileSync("node", [join(HERE, "check-baseline-provenance.mjs")], {
    encoding: "utf8",
  });
  assert.match(out, /✔ baseline-provenance/);
});
