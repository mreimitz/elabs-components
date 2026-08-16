#!/usr/bin/env node
/**
 * check-baseline-provenance.mjs — ratchet-baseline PROVENANCE meta-gate (#400).
 *
 * Every ratchet-baseline gate (`check-variant-coverage.mjs`, `check-loading-states.mjs`,
 * `check-state-coverage.mjs`) asserts one thing: does the CURRENT gap set match the
 * committed baseline file? That check trusts the baseline JSON's CONTENTS, never its
 * PROVENANCE — nothing stopped a hand-edit from adding a fabricated key (a violation
 * that was never real) or a stale key (debt that has since been fixed). Either way the
 * underlying `:check` exits 0 with no `--force` and no script involvement, because it
 * only ever compares two sets it is handed; it never asks "could `--update` have
 * produced this file?"
 *
 * This meta-gate asks exactly that question. For each of the three named gates it
 * re-derives what that gate's OWN `--update` would write RIGHT NOW (by calling its
 * exported `find*Gaps`/`findMissing*` + `computeRatchetUpdate` functions directly — no
 * shelling out, no re-implementing the gap logic here) and asserts the COMMITTED
 * baseline is a SUBSET of (or equal to) that live derivation. Any committed entry with
 * no matching, currently-reproducible gap is an "orphan" — the laundering signature —
 * and fails the gate, whether it is fabricated or simply stale: the remedy is
 * identical either way, run `pnpm <gate>:check -- --update`.
 *
 * Deliberately narrow, per the #400 brief: only the three named gates are covered.
 * data-slot / text-scale / separation / a11y-baseline / intent-coverage are explicit
 * named follow-ups, NOT silently folded in here — widening `GATES` to a fourth gate
 * is a separate, deliberate change, not a side effect of touching this file.
 *
 * SECOND rung — git provenance (#400 Finding 3, fix round 1). The derivation
 * check above proves a committed entry corresponds to a real, CURRENTLY
 * reproducible gap — but a genuinely NEW, real violation hand-added to the
 * baseline (instead of being fixed) is real by construction, so it passes
 * derivation and launders exactly the way the issue's own title describes
 * ("a hand-edit can launder any new violation"). Derivation alone cannot
 * distinguish "pre-existing debt" from "debt this branch just introduced and
 * hid" — only git history can. So this rung compares the COMMITTED baseline
 * against that SAME file's content at the merge-base (`git show <base>:<path>`)
 * and fails on any key present now that was absent there — the ratchet's
 * "only goes down" contract, enforced at the git level instead of trusted from
 * the file's own contents. It runs ADDITIONALLY to (never instead of) the
 * derivation check above; either one failing fails the gate.
 *
 * Honest scope limit: this rung needs a resolvable base ref AND a readable/
 * parseable historical copy of the baseline file. When neither is available —
 * no git history (a fixture tree, a shallow clone with no base fetchable), or
 * the baseline file did not exist at the base ref (uncommon: it would mean the
 * baseline itself is brand-new on this branch) — it SKIPS silently for that
 * gate rather than guessing, exactly like `resolveBase` in
 * check-changelog-entry.mjs (reused here, not reimplemented) already does for
 * its own git-diff rung. `--force` bypasses it entirely for a rare, justified
 * ratchet-up (mirrors the sibling gates' own `--update --force` escape).
 *
 * Dependency-free (beyond the three sibling gate modules + check-changelog-entry's
 * `resolveBase`, all of which are themselves dependency-free); ESM;
 * cwd-independent via `--root`. Pure helpers exported for the self-test
 * (check-baseline-provenance.test.mjs / pnpm baseline-provenance:check:test).
 *
 * Flags:
 *   --root <dir>   read the manifest + baseline files from <dir> instead of the real
 *                  repo (isolated fixture-tree testing — never touches the real
 *                  committed brand-ui.manifest.json or scripts/*-baseline.json).
 *   --base <ref>   explicit ref for the git-provenance rung (default: resolved via
 *                  `resolveBase` — GITHUB_BASE_REF, origin/main, then main).
 *   --force        skip the git-provenance rung entirely (rare; justify in the PR —
 *                  the derivation rung above still runs).
 *   --warn         never exit non-zero; still prints findings (for a PostToolUse hook).
 */
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  findVariantGaps,
  computeRatchetUpdate as variantRatchet,
} from "./check-variant-coverage.mjs";
import {
  findMissingLoadingStories,
  computeRatchetUpdate as loadingRatchet,
} from "./check-loading-states.mjs";
import {
  findMissingStateStories,
  computeRatchetUpdate as stateRatchet,
} from "./check-state-coverage.mjs";
import { resolveBase } from "./check-changelog-entry.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);

/**
 * The three ratchet-baseline gates this meta-gate covers. `gapsFn(manifest, repoRoot)`
 * returns that gate's `{ key, ... }[]` (regardless of baseline); `computeFn` is that
 * gate's own exported `computeRatchetUpdate`, reused as-is so the derivation is
 * BYTE-IDENTICAL to what a real `--update` run would write.
 */
export const GATES = [
  {
    name: "variant-coverage",
    baselineRel: "scripts/variant-coverage-baseline.json",
    gapsFn: findVariantGaps,
    computeFn: variantRatchet,
  },
  {
    name: "loading-states",
    baselineRel: "scripts/loading-states-baseline.json",
    gapsFn: findMissingLoadingStories,
    computeFn: loadingRatchet,
  },
  {
    name: "state-coverage",
    baselineRel: "scripts/state-coverage-baseline.json",
    gapsFn: findMissingStateStories,
    computeFn: stateRatchet,
  },
];

/**
 * Pure provenance check: which COMMITTED keys have no matching entry in the live
 * derivation? A committed baseline that is a subset of (or equal to) the derivation
 * has zero orphans — pre-existing debt not yet ratcheted down is NOT an orphan (it is
 * a real, currently-reproducible gap the gate simply hasn't been asked to shrink to
 * yet). Only a key the derivation does NOT reproduce at all is a laundering signature.
 */
export function findOrphanedBaselineEntries(committedKeys, derivedKeys) {
  const derived = new Set(derivedKeys);
  return committedKeys.filter((k) => !derived.has(k)).sort();
}

/**
 * GIT-PROVENANCE rung (#400 Finding 3): which COMMITTED keys were NOT present
 * in this SAME baseline file at the base ref? Unlike `findOrphanedBaselineEntries`
 * (which asks "is this key currently derivable"), this asks "did THIS BRANCH add
 * it" — the two are independent: a genuinely real, currently-reproducible gap that
 * a branch hand-adds instead of fixing is NOT an orphan (derivation explains it
 * fine) but IS an addition (the base ref never had it), which is exactly the
 * laundering the issue's own title describes. Pure — exported for the self-test.
 */
export function findAddedBaselineKeys(committedKeys, baseKeys) {
  const atBase = new Set(baseKeys);
  return committedKeys.filter((k) => !atBase.has(k)).sort();
}

/**
 * Read one gate's baseline file's CONTENTS as they were at `ref` (`git show
 * <ref>:<relPath>`), for the git-provenance rung. Returns `null` — "cannot
 * verify, skip this gate's git-provenance rung" — when the ref can't be
 * resolved, the file didn't exist there, or its content isn't a JSON array;
 * this rung must never invent a false failure out of a git/history limitation
 * (see file header "Honest scope limit"). Not pure (shells out); kept separate
 * from the pure `findAddedBaselineKeys` so the self-test can drive the latter
 * without a real git history.
 */
export function readBaselineAtRef(root, ref, relPath) {
  try {
    const raw = execFileSync("git", ["-C", root, "show", `${ref}:${relPath}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Re-derive one gate's live `--update` output and diff it against the COMMITTED
 * baseline for that gate. `force: true` on the `computeFn` call is deliberate and
 * safe here — it is only used to obtain "what the current gap set IS", never to
 * write anything; nothing is persisted by this meta-gate.
 * @returns {{ name: string, orphans: string[] }}
 */
export function checkGateProvenance(gate, manifest, committedBaseline, repoRoot) {
  const gaps = gate.gapsFn(manifest, repoRoot);
  const currentKeys = gaps.map((g) => g.key);
  const derived = gate.computeFn(currentKeys, [], true).next;
  return { name: gate.name, orphans: findOrphanedBaselineEntries(committedBaseline, derived) };
}

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

// ───────────────────────────────── CLI ────────────────────────────────────────
function main(argv) {
  const args = argv.slice(2);
  const warnOnly = args.includes("--warn");
  const force = args.includes("--force");
  const rootIdx = args.indexOf("--root");
  const root = rootIdx >= 0 ? args[rootIdx + 1] : REPO_ROOT;
  const baseIdx = args.indexOf("--base");
  const explicitBase = baseIdx >= 0 ? args[baseIdx + 1] : undefined;

  const manifestPath = join(root, "brand-ui.manifest.json");
  if (!existsSync(manifestPath)) {
    console.error("✖ baseline-provenance: brand-ui.manifest.json not found — run `pnpm manifest`.");
    process.exit(warnOnly ? 0 : 1);
    return;
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    console.error("✖ baseline-provenance: brand-ui.manifest.json failed to parse.");
    process.exit(warnOnly ? 0 : 1);
    return;
  }

  const committedByGate = new Map(
    GATES.map((gate) => [gate.name, readJson(join(root, gate.baselineRel), [])]),
  );

  // Rung 1 — derivation: is every committed entry a real, currently-reproducible gap?
  const results = GATES.map((gate) =>
    checkGateProvenance(gate, manifest, committedByGate.get(gate.name), root),
  );
  const withOrphans = results.filter((r) => r.orphans.length > 0);

  // Rung 2 — git provenance: did THIS BRANCH add a key that wasn't there at the
  // base ref? Additional to rung 1 — it is what catches a genuinely real,
  // currently-derivable violation hand-added instead of fixed (#400 Finding 3).
  // Best-effort: skipped (never a false failure) when no base is resolvable.
  let withAdded = [];
  let gitProvenanceNote = null;
  if (force) {
    gitProvenanceNote = "git-provenance rung skipped (--force).";
  } else {
    const base = resolveBase(root, explicitBase);
    if (!base) {
      gitProvenanceNote =
        "git-provenance rung skipped — no base ref to diff against (not a pull request, " +
        "shallow clone with nothing fetchable, or a fixture tree with no git history). " +
        "Pass --base <ref> to force one.";
    } else {
      const perGate = GATES.map((gate) => {
        const baseBaseline = readBaselineAtRef(root, base, gate.baselineRel);
        if (baseBaseline == null) return { name: gate.name, added: [], unverifiable: true };
        const added = findAddedBaselineKeys(committedByGate.get(gate.name), baseBaseline);
        return { name: gate.name, added, unverifiable: false };
      });
      withAdded = perGate.filter((r) => r.added.length > 0);
      const unverifiable = perGate.filter((r) => r.unverifiable);
      gitProvenanceNote = unverifiable.length
        ? `git-provenance rung: could not read ${unverifiable.map((r) => r.name).join(", ")} at ` +
          `${base} — skipped for those gate(s) (baseline file may be new on this branch).`
        : `git-provenance rung: compared against ${base}.`;
    }
  }

  if (withOrphans.length === 0 && withAdded.length === 0) {
    console.log(
      `✔ baseline-provenance: every committed baseline entry across ${GATES.length} gate(s) ` +
        "is reproducible by that gate's own --update, and none was added since the base ref.",
    );
    if (gitProvenanceNote) console.log(`  (${gitProvenanceNote})`);
    return;
  }

  const label = warnOnly ? "⚠ baseline-provenance" : "✖ baseline-provenance gate FAILED";
  if (withOrphans.length) {
    console.error(
      `\n${label} — committed baseline entry has NO matching, currently-reproducible gap:`,
    );
    for (const r of withOrphans) {
      console.error(`  ${r.name}:`);
      for (const key of r.orphans) console.error(`    ${key}`);
    }
    console.error(
      "\nA ratchet-baseline gate's `:check` only compares two sets it is handed — it never\n" +
        "asks whether the committed baseline is still REPRODUCIBLE by that gate's own\n" +
        "`--update`. An orphaned entry is either fabricated (never a real violation) or\n" +
        "stale (debt that has since been fixed) — the remedy is identical either way:\n" +
        "run `pnpm <gate>:check -- --update` for the gate(s) named above to re-derive the\n" +
        "baseline from the current tree, then commit the result.",
    );
  }
  if (withAdded.length) {
    console.error(
      `\n${label} — this branch ADDED a baseline entry that was not present at the base ref ` +
        "(the ratchet only goes down):",
    );
    for (const r of withAdded) {
      console.error(`  ${r.name}:`);
      for (const key of r.added) console.error(`    ${key}`);
    }
    console.error(
      "\nA baseline records PRE-EXISTING debt, never a new violation — fix the violation (add\n" +
        "the story / handle the case) instead of adding its key to the baseline. If raising the\n" +
        "baseline is genuinely intentional and justified, re-run `pnpm <gate>:check -- --update\n" +
        "--force` for the gate(s) named above, then this meta-gate's own `--force`.",
    );
  }
  if (!warnOnly) process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv);
}
