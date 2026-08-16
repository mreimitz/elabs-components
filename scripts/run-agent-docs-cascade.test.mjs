/**
 * run-agent-docs-cascade.test.mjs — self-test for the agent-docs cascade (#396).
 * Run in CI: `node --test scripts/run-agent-docs-cascade.test.mjs`
 * (`pnpm agent-docs-cascade:check:test`).
 *
 * The incident: 4 of 10 wave-2 work units regenerated `brand-ui.manifest.json`
 * (per `.githooks/pre-commit`'s existing step) and left its 5 downstream
 * generators (inventory/llms/context/gen) stale — 5-6 CI gates red every time,
 * caught only by an independent validator. The fix is wiring, not a new
 * generator: run the 5 `pnpm` scripts in the right order, on the SAME trigger
 * the manifest step already uses, and stage only what actually changed. This
 * file proves that WIRING can't silently rot (quality-gates.md, "Self-tested
 * gates").
 *
 * IMPORTANT — fix-round-1 note (an independent validator's D1 finding): an
 * earlier version of this file expressed EVERY orchestration assertion in
 * terms of `CASCADE_STEPS`/`FIXED_ARTIFACT_PATHS` themselves (e.g.
 * `artifactPaths: CASCADE_STEPS.map(...)`, `assert.deepEqual(order,
 * CASCADE_STEPS)`), so shrinking either constant left every assertion true
 * FOR THAT SHRUNKEN VALUE — the suite was self-satisfying and could not
 * detect the #396 regression returning (proved: deleting llms/context/gen
 * from CASCADE_STEPS, or removing llms.txt from the artifact set, both left
 * `13 pass / 0 fail`). The fix below adds tests anchored on LITERAL,
 * hand-written expectations (this file does NOT import the module's own
 * constant into what it compares that constant against) plus a DRIFT GUARD
 * against the real `packages/cli/lib/gen.mjs` target list — so a future
 * regression of either kind fails this suite, not just a downstream CI gate.
 * The mocked/fixture-based orchestration tests further below remain useful
 * for a different property (does `runCascade` call `run()` once per step, in
 * order, stop on failure, stage only diffs) and stay fast, matching the
 * `ensure-deps-synced.test.mjs` precedent (PURE logic, no real generators).
 * One additional REAL, self-reverting, live test (bottom of this file) closes
 * the remaining gap a mocked suite can't: it invokes `.githooks/pre-commit`
 * itself against a real, tiny, fully-reverted export addition to this actual
 * repo, and asserts the real generators actually ran and actually staged the
 * real artifacts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  TRIGGER_PATTERN,
  CASCADE_STEPS,
  matchesTrigger,
  resolveArtifactPaths,
  stageChangedArtifacts,
  dirtyPaths,
  runCascade,
} from "./run-agent-docs-cascade.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(HERE); // scripts/ -> repo root

// ── matchesTrigger: the SAME condition `.githooks/pre-commit` gates step 1 on ──

test("PURE: matchesTrigger fires on a staged package src file", () => {
  assert.equal(matchesTrigger(["packages/ui/src/components/button/button.tsx"]), true);
});

test("PURE: matchesTrigger fires on the token themes file", () => {
  assert.equal(matchesTrigger(["packages/tokens/src/themes.css"]), true);
});

test("PURE: matchesTrigger fires on a registry file", () => {
  assert.equal(matchesTrigger(["registry/registry.json"]), true);
});

test("PURE: matchesTrigger does NOT fire on docs, stories, or a package README", () => {
  assert.equal(
    matchesTrigger([
      "apps/docs/stories/Intro.mdx",
      "packages/ui/stories/button.stories.tsx", // not under src/
      "packages/ui/README.md",
      "scripts/some-gate.mjs",
    ]),
    false,
  );
});

test("PURE: matchesTrigger is false for an empty staged list", () => {
  assert.equal(matchesTrigger([]), false);
});

test("PURE: TRIGGER_PATTERN stays byte-identical to the grep -E pattern .githooks/pre-commit uses", () => {
  const hook = readFileSync(join(REPO_ROOT, ".githooks/pre-commit"), "utf8");
  assert.ok(
    hook.includes(`'${TRIGGER_PATTERN}'`),
    "the cascade's trigger must match the SAME condition the hook gates step 1 on — " +
      "if this fails, either the hook's grep pattern or TRIGGER_PATTERN drifted out of sync",
  );
});

// ── LITERAL regression guards (fix-round-1 / D1): NOT derived from the module's
// own constants — a hand-written expectation that must independently match. ──

test("REGRESSION GUARD: CASCADE_STEPS is the literal, ordered 5-script list", () => {
  // Hand-written on purpose — do NOT refactor this into `CASCADE_STEPS.map(...)`
  // or similar; the whole point is a truth that does not move when the module
  // under test moves. This is what makes "shrink CASCADE_STEPS" a red build.
  assert.deepEqual(CASCADE_STEPS, ["manifest", "inventory", "llms", "context", "gen"]);
});

test("REGRESSION GUARD: resolveArtifactPaths names every known manifest-derived artifact, literally", () => {
  const paths = new Set(resolveArtifactPaths(REPO_ROOT));
  const expected = [
    "brand-ui.manifest.json",
    "apps/docs/public/component-inventory.md",
    "apps/docs/public/llms.txt",
    "apps/docs/public/llms",
    "apps/docs/public/brand-ui-context.md",
    "CLAUDE.md",
    "AGENTS.md",
    "PROJECT.md",
    "apps/docs/stories/Introduction.mdx",
    "skills/brand-ui/SKILL.md",
    "apps/docs/stories/AI-Output-Contract-for-Agents.mdx",
    "docs/playbooks/README.md",
  ];
  const missing = expected.filter((p) => !paths.has(p));
  assert.deepEqual(missing, [], `resolveArtifactPaths is missing: ${missing.join(", ")}`);
});

test("DRIFT GUARD (#396 D2): resolveArtifactPaths is a superset of every REAL `pnpm gen` target", async () => {
  // Imports the ACTUAL generator module (packages/cli/lib/gen.mjs) — the single
  // source of truth for what `pnpm gen` writes — so if a target is ever
  // added/renamed there without a matching update to FIXED_ARTIFACT_PATHS, THIS
  // test fails, independent of any hand-written literal list going stale too.
  const { genTargets } = await import("../packages/cli/lib/gen.mjs");
  const { loadManifest } = await import("../packages/cli/lib/core.mjs");
  const manifest = loadManifest(REPO_ROOT);
  const genFiles = genTargets(REPO_ROOT, manifest).map((t) =>
    relative(REPO_ROOT, t.file).split(sep).join("/"),
  );
  assert.ok(genFiles.length > 0, "sanity: genTargets() must return at least one real target");
  const artifactPaths = new Set(resolveArtifactPaths(REPO_ROOT));
  const missing = genFiles.filter((f) => !artifactPaths.has(f));
  assert.deepEqual(
    missing,
    [],
    `resolveArtifactPaths is missing pnpm-gen target(s) genTargets() actually writes: ${missing.join(", ")}`,
  );
});

// ── stageChangedArtifacts: only NEWLY-changed artifact paths get reported ─────

function gitRepo() {
  const root = mkdtempSync(join(tmpdir(), "brand-ui-agent-docs-cascade-"));
  const g = (...args) => execFileSync("git", ["-C", root, ...args], { stdio: "pipe" });
  g("init", "-q", "-b", "main");
  g("config", "user.email", "t@example.com");
  g("config", "user.name", "T");
  g("config", "commit.gpgsign", "false");
  return { root, g };
}

function cachedNames(root) {
  return execFileSync("git", ["-C", root, "diff", "--cached", "--name-only"], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}

test("stageChangedArtifacts stages only artifact paths whose content actually changed", () => {
  const { root, g } = gitRepo();
  try {
    writeFileSync(join(root, "artifact1.txt"), "v1\n");
    writeFileSync(join(root, "artifact2.txt"), "v1\n");
    writeFileSync(join(root, "other.txt"), "v1\n");
    g("add", "-A");
    g("commit", "-qm", "base");

    // Pre-existing staged content NOT in the artifact set — must not leak into
    // the reported result.
    writeFileSync(join(root, "other.txt"), "v2 (staged separately)\n");
    g("add", "other.txt");

    // Only artifact1 actually changes; artifact2 is untouched.
    writeFileSync(join(root, "artifact1.txt"), "v2\n");

    const { staged, skipped } = stageChangedArtifacts(root, ["artifact1.txt", "artifact2.txt"]);
    assert.deepEqual(staged, ["artifact1.txt"]);
    assert.deepEqual(skipped, []);

    // artifact1 is now staged; other.txt's pre-existing staged status is untouched.
    assert.deepEqual(cachedNames(root).sort(), ["artifact1.txt", "other.txt"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("stageChangedArtifacts reports nothing when no artifact path changed", () => {
  const { root, g } = gitRepo();
  try {
    writeFileSync(join(root, "artifact1.txt"), "v1\n");
    g("add", "-A");
    g("commit", "-qm", "base");
    assert.deepEqual(stageChangedArtifacts(root, ["artifact1.txt"]), { staged: [], skipped: [] });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("stageChangedArtifacts ignores an artifact path that does not exist on disk", () => {
  const { root, g } = gitRepo();
  try {
    writeFileSync(join(root, "artifact1.txt"), "v1\n");
    g("add", "-A");
    g("commit", "-qm", "base");
    assert.deepEqual(stageChangedArtifacts(root, ["artifact1.txt", "does-not-exist.txt"]), {
      staged: [],
      skipped: [],
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── stageChangedArtifacts / runCascade: the partial-staging guard (#396 D3) ────

test("stageChangedArtifacts SKIPS a path present in preExistingDirty, even though it changed", () => {
  const { root, g } = gitRepo();
  try {
    writeFileSync(join(root, "hand-edited.txt"), "committed baseline\n");
    g("add", "-A");
    g("commit", "-qm", "base");
    writeFileSync(join(root, "hand-edited.txt"), "an in-flight, unstaged hand edit\n");

    const { staged, skipped } = stageChangedArtifacts(root, ["hand-edited.txt"], {
      preExistingDirty: new Set(["hand-edited.txt"]),
    });
    assert.deepEqual(staged, []);
    assert.deepEqual(skipped, ["hand-edited.txt"]);
    assert.deepEqual(cachedNames(root), [], "must not be staged");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("dirtyPaths reports exactly the files with an unstaged (working-tree vs index) diff", () => {
  const { root, g } = gitRepo();
  try {
    writeFileSync(join(root, "a.txt"), "v1\n");
    writeFileSync(join(root, "b.txt"), "v1\n");
    g("add", "-A");
    g("commit", "-qm", "base");

    writeFileSync(join(root, "a.txt"), "v2, unstaged\n"); // dirty
    writeFileSync(join(root, "b.txt"), "v2, staged\n");
    g("add", "b.txt"); // NOT dirty (staged, matches worktree)

    assert.deepEqual(dirtyPaths(root), new Set(["a.txt"]));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("runCascade does NOT sweep a pre-existing, UNRELATED unstaged hand edit into the commit (#396 D3)", () => {
  const { root, g } = gitRepo();
  try {
    for (const step of CASCADE_STEPS) writeFileSync(join(root, `${step}.txt`), "stale\n");
    writeFileSync(join(root, "hand-edited.txt"), "committed baseline\n");
    g("add", "-A");
    g("commit", "-qm", "base");

    // An in-flight, NOT-yet-staged hand edit made BEFORE the triggering commit —
    // the cascade must never touch this, even though it's in `artifactPaths`.
    writeFileSync(join(root, "hand-edited.txt"), "in-flight hand edit — must NOT be committed\n");

    const result = runCascade({
      root,
      staged: ["packages/ui/src/button.tsx"],
      run: (step) => writeFileSync(join(root, `${step}.txt`), `fresh (by ${step})\n`),
      artifactPaths: [...CASCADE_STEPS.map((s) => `${s}.txt`), "hand-edited.txt"],
    });

    // The genuine (generator-produced) artifacts still get staged...
    assert.deepEqual([...result.staged].sort(), CASCADE_STEPS.map((s) => `${s}.txt`).sort());
    // ...but the pre-existing hand edit is reported as skipped, NOT staged.
    assert.deepEqual(result.skipped, ["hand-edited.txt"]);
    assert.equal(cachedNames(root).includes("hand-edited.txt"), false);
    assert.equal(
      readFileSync(join(root, "hand-edited.txt"), "utf8"),
      "in-flight hand edit — must NOT be committed\n",
      "the hand edit itself must be untouched on disk — nothing reverted, nothing lost",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("runCascade skips an artifact even when the (simulated) generator ALSO writes it, if it was already dirty (compound case)", () => {
  const { root, g } = gitRepo();
  try {
    writeFileSync(join(root, "manifest.txt"), "committed baseline\n");
    g("add", "-A");
    g("commit", "-qm", "base");

    // Pre-existing hand edit to the SAME file the (simulated) "manifest" step
    // will also rewrite — cannot be safely disentangled, so it must be skipped.
    writeFileSync(join(root, "manifest.txt"), "in-flight hand edit\n");

    const result = runCascade({
      root,
      staged: ["packages/ui/src/button.tsx"],
      run: (step) => {
        if (step === "manifest") writeFileSync(join(root, "manifest.txt"), "generator output\n");
      },
      artifactPaths: ["manifest.txt"],
    });

    assert.deepEqual(result.staged, []);
    assert.deepEqual(result.skipped, ["manifest.txt"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── runCascade: orchestration, with an INJECTED run() (never the real generators) ──

test("runCascade does not run anything when the trigger does not match", () => {
  const { root, g } = gitRepo();
  try {
    writeFileSync(join(root, "manifest.txt"), "stale\n");
    g("add", "-A");
    g("commit", "-qm", "base");
    let calls = 0;
    const result = runCascade({
      root,
      staged: ["apps/docs/stories/Intro.mdx"],
      run: () => calls++,
      artifactPaths: ["manifest.txt"],
    });
    assert.equal(calls, 0);
    assert.deepEqual(result, { ran: false, staged: [], skipped: [], errors: [] });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("runCascade runs every step, in order, when the trigger matches", () => {
  const { root, g } = gitRepo();
  try {
    for (const step of CASCADE_STEPS) writeFileSync(join(root, `${step}.txt`), "stale\n");
    g("add", "-A");
    g("commit", "-qm", "base");

    const order = [];
    const result = runCascade({
      root,
      staged: ["packages/ui/src/button.tsx"],
      run: (step) => {
        order.push(step);
        // Simulate the real generator: it rewrites its own artifact.
        writeFileSync(join(root, `${step}.txt`), `fresh (by ${step})\n`);
      },
      artifactPaths: CASCADE_STEPS.map((s) => `${s}.txt`),
    });

    // Hand-written literal, not `CASCADE_STEPS` compared to itself.
    assert.deepEqual(order, ["manifest", "inventory", "llms", "context", "gen"]);
    assert.equal(result.ran, true);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.skipped, []);
    assert.deepEqual([...result.staged].sort(), [
      "context.txt",
      "gen.txt",
      "inventory.txt",
      "llms.txt",
      "manifest.txt",
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("runCascade stops at the first failing step (downstream steps read the SAME manifest) but stages whatever already changed", () => {
  const { root, g } = gitRepo();
  try {
    for (const step of CASCADE_STEPS) writeFileSync(join(root, `${step}.txt`), "stale\n");
    g("add", "-A");
    g("commit", "-qm", "base");

    const ran = [];
    const failAt = "inventory"; // literal — the second step
    const result = runCascade({
      root,
      staged: ["packages/ui/src/button.tsx"],
      run: (step) => {
        ran.push(step);
        if (step === failAt) throw new Error("boom");
        writeFileSync(join(root, `${step}.txt`), `fresh (by ${step})\n`);
      },
      artifactPaths: CASCADE_STEPS.map((s) => `${s}.txt`),
    });

    // Only the first two steps ran (the second threw); the rest never did.
    assert.deepEqual(ran, ["manifest", "inventory"]);
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].step, "inventory");
    // The first step's artifact DID change and gets staged despite the later failure.
    assert.deepEqual(result.staged, ["manifest.txt"]);
    assert.deepEqual(result.skipped, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("runCascade reports no staged files when the trigger matches but nothing actually changed", () => {
  const { root, g } = gitRepo();
  try {
    for (const step of CASCADE_STEPS) writeFileSync(join(root, `${step}.txt`), "already-fresh\n");
    g("add", "-A");
    g("commit", "-qm", "base");

    const result = runCascade({
      root,
      staged: ["packages/tokens/src/themes.css"],
      run: () => {}, // a no-op generator: nothing changes
      artifactPaths: CASCADE_STEPS.map((s) => `${s}.txt`),
    });
    assert.equal(result.ran, true);
    assert.deepEqual(result.staged, []);
    assert.deepEqual(result.skipped, []);
    assert.deepEqual(result.errors, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── REAL, self-reverting, live test against the ACTUAL repo (not a fixture) ───
//
// Everything above is fast and mocked by design (matching the
// `ensure-deps-synced.test.mjs` precedent for git-hook logic). This is the ONE
// test that closes the remaining gap: it adds a real, tiny, temporary hook
// export to an existing package, stages it, invokes `.githooks/pre-commit`
// ITSELF (a real subprocess, not `runCascade` called directly), and asserts
// the real generators regenerated + staged the real manifest-derived
// artifacts — exactly #396's own "Test to add" ask. It ALWAYS reverts every
// file it touches and unstages everything it staged, in a `finally`, even on
// assertion failure or a thrown error.
const PROBE_SOURCE = join(REPO_ROOT, "packages/ui/src/components/command/command.tsx");
const PROBE_BARREL = join(REPO_ROOT, "packages/ui/src/components/command/index.ts");
// Must look like a real hook (`use*`) — the manifest generator's export
// scanner only counts `use*`-named functions as hooks (and PascalCase ones as
// components); a `__dunder__`-named probe is invisible to it, producing a
// byte-identical (no-op) manifest and silently defeating this whole test.
const PROBE_EXPORT = "useAgentDocsCascadeSelfTestProbe";

test(
  "REAL: staging a real new hook export and invoking .githooks/pre-commit regenerates + stages the real manifest-derived artifacts",
  { timeout: 60_000 },
  (t) => {
    if (!existsSync(PROBE_SOURCE) || !existsSync(PROBE_BARREL)) {
      // The probe targets moved/were renamed — skip rather than false-fail.
      t.skip("probe targets (packages/ui/src/components/command/*) not found");
      return;
    }
    // Scoped precondition (not "the whole repo must be clean"): the hook only
    // ever acts on STAGED content (conflict-marker scan, cascade trigger,
    // Prettier step all read `git diff --cached`), so unrelated UNSTAGED work
    // elsewhere in this worktree is harmless and must not block this test.
    // What DOES matter: (a) nothing is currently STAGED — otherwise the hook
    // run below would fold in and then unstage someone else's in-progress
    // staging, and (b) the two probe files themselves aren't already dirty —
    // otherwise this test's unconditional `git checkout HEAD --` in `finally`
    // would discard real, unrelated work on those exact two files.
    const preexistingStaged = cachedNames(REPO_ROOT);
    const dirtyNow = dirtyPaths(REPO_ROOT);
    const probeSourceRel = relative(REPO_ROOT, PROBE_SOURCE).split(sep).join("/");
    const probeBarrelRel = relative(REPO_ROOT, PROBE_BARREL).split(sep).join("/");
    if (
      preexistingStaged.length > 0 ||
      dirtyNow.has(probeSourceRel) ||
      dirtyNow.has(probeBarrelRel)
    ) {
      t.skip(
        "repo has staged content or a dirty probe file right now (normal mid-development; " +
          `always clean in CI) — staged: ${JSON.stringify(preexistingStaged)}`,
      );
      return;
    }
    const sourceBefore = readFileSync(PROBE_SOURCE, "utf8");
    const barrelBefore = readFileSync(PROBE_BARREL, "utf8");

    try {
      writeFileSync(
        PROBE_SOURCE,
        `${sourceBefore}\n/** ${PROBE_EXPORT} — temporary, added + reverted by the self-test. */\nexport function ${PROBE_EXPORT}(): boolean {\n  return true;\n}\n`,
      );
      assert.ok(
        barrelBefore.includes("useCommandActiveItemId,"),
        "probe assumes this exact barrel shape — update the probe if command/index.ts changed",
      );
      writeFileSync(
        PROBE_BARREL,
        barrelBefore.replace(
          "useCommandActiveItemId,",
          `useCommandActiveItemId,\n  ${PROBE_EXPORT},`,
        ),
      );
      execFileSync("git", ["-C", REPO_ROOT, "add", "--", PROBE_SOURCE, PROBE_BARREL]);

      const hookOutput = execFileSync("bash", [join(REPO_ROOT, ".githooks/pre-commit")], {
        cwd: REPO_ROOT,
        encoding: "utf8",
      });

      const stagedAfter = new Set(cachedNames(REPO_ROOT));
      // These reliably change for a new barrel export, independent of which
      // FIXED_ARTIFACT_PATHS entries happen to also change for this exact probe
      // shape (a single new hook doesn't necessarily touch every `pnpm gen`
      // target's rendered content — the DRIFT GUARD test above is what proves
      // every target is at least COVERED by the path list; this test proves the
      // covered ones actually get regenerated + staged for real).
      const mustBeStaged = [
        "brand-ui.manifest.json",
        "apps/docs/public/component-inventory.md",
        "apps/docs/public/llms.txt",
        "apps/docs/public/brand-ui-context.md",
      ];
      const missing = mustBeStaged.filter((f) => !stagedAfter.has(f));
      assert.deepEqual(
        missing,
        [],
        `hook did not stage expected artifact(s): ${missing.join(", ")}\nhook output:\n${hookOutput}`,
      );

      // The staged manifest must actually be valid, fresh JSON (not the #375-class
      // "stale/half-written" failure) — belt-and-suspenders on top of `manifest:check`.
      const manifestContent = execFileSync(
        "git",
        ["-C", REPO_ROOT, "show", ":brand-ui.manifest.json"],
        { encoding: "utf8" },
      );
      assert.doesNotThrow(() => JSON.parse(manifestContent));
    } finally {
      // Unstage everything (whatever the hook staged, plus our own `git add`) —
      // the precondition above already guaranteed NOTHING was staged before
      // this test started, so `reset HEAD` here can only be undoing OUR OWN
      // staging, never a concurrent, unrelated caller's.
      try {
        execFileSync("git", ["-C", REPO_ROOT, "reset", "HEAD", "--", "."], { stdio: "ignore" });
      } catch {
        /* nothing was staged — fine */
      }
      // Hard-restore every file this probe could plausibly have touched to its
      // committed HEAD content.
      const allArtifacts = resolveArtifactPaths(REPO_ROOT);
      execFileSync(
        "git",
        [
          "-C",
          REPO_ROOT,
          "checkout",
          "HEAD",
          "--",
          "packages/ui/src/components/command/command.tsx",
          "packages/ui/src/components/command/index.ts",
          ...allArtifacts.filter((p) => existsSync(join(REPO_ROOT, p))),
        ],
        { stdio: "ignore" },
      );
      // Verify OUR OWN footprint is gone — NOT a repo-wide dirty scan, which
      // would false-positive on any unrelated work-in-progress elsewhere in
      // this worktree that has nothing to do with this test (a real prior
      // incident: an earlier version of this check flagged the developer's own
      // concurrent edits to THIS test file as "failed to revert").
      const stillStaged = cachedNames(REPO_ROOT);
      const probeReverted =
        readFileSync(PROBE_SOURCE, "utf8") === sourceBefore &&
        readFileSync(PROBE_BARREL, "utf8") === barrelBefore;
      if (stillStaged.length > 0 || !probeReverted) {
        // Should be unreachable given the restore above; surfaced loudly rather
        // than silently leaving the real repo dirty if it ever is.
        throw new Error(
          "REAL cascade test failed to fully revert its own footprint — " +
            `staged: ${JSON.stringify(stillStaged)}, probe files reverted: ${probeReverted}`,
        );
      }
    }
  },
);
