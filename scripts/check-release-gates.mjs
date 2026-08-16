#!/usr/bin/env node
/**
 * check-release-gates.mjs — nothing is published from a commit the battery has
 * not passed (#103).
 *
 * ## What changed on 2026-08-10, and why
 *
 * `ci.yml` is `on: pull_request` + `push: branches: [main]`, so a `v*` tag ref
 * NEVER triggers it. The original hole was release.yml hand-copying a SUBSET of
 * the battery: measured at c1a170b, ci.yml ran 81 blocking gate steps and
 * release.yml reached 11, while its header claimed it ran "the same battery CI
 * runs". The fix was to make BOTH workflows call one reusable `gates.yml`, and
 * this gate asserted SET parity between the two callers plus the `needs:` edge
 * from the publish job.
 *
 * That was correct and unaffordable. On the v3.0.0 run (31373230456) the tag ref
 * re-ran the whole battery for 20 minutes, then waited another 9 on a
 * non-blocking job it had no reason to wait for — while `main`'s own CI run for
 * the IDENTICAL commit (2332858) ran alongside it, 09:08:34→09:37:21, proving
 * the same thing at the same time. 29 of 38 minutes bought nothing.
 *
 * So the release path no longer RE-RUNS the battery; it REQUIRES the battery's
 * verdict for the exact commit under the tag (`scripts/check-release-verdict.mjs`).
 * Set parity is therefore gone as a concept — the release path deliberately runs
 * a handful of publish-only preflight gates and nothing else. What replaces it:
 *
 *   1. VERDICT — release.yml checks the battery's verdict for this commit BEFORE
 *      `pnpm -r publish`. This is the rung that used to be enforced structurally
 *      by `needs:`, which GitHub guaranteed; a step is weaker, so its POSITION is
 *      asserted too. A verdict checked after an immutable publish is worthless.
 *   2. RATCHET — every gate step recorded in `scripts/release-gates-baseline.json`
 *      is still reachable from ci.yml. This rung did not change and now carries
 *      more weight than before: it is the only thing that notices `gates.yml`
 *      shrinking, and the release's authority is now entirely inherited from
 *      whatever ci.yml actually ran. A battery quietly reduced to nothing would
 *      still produce a green verdict.
 *
 * "Gate step" means both shapes a blocking check is written in:
 *   - `pnpm <gate>`                    — the root battery
 *   - `pnpm --filter <pkg> <script>`   — workspace-scoped, e.g. the blocking
 *                                        Storybook interaction tests (#280)
 *
 * What it still does NOT cover, deliberately: a job marked
 * `continue-on-error: true` cannot fail a PR, so it is not a gate.
 *
 *   pnpm release-gates:check
 *   pnpm release-gates:check -- --update            # ratchet the baseline (rung 2)
 *   node scripts/check-release-gates.mjs --root <dir>   # self-test fixtures
 *
 * Dependency-free; ESM; cwd-independent.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { VERDICT_GATE, checkPublishRequiresVerdict, collectGates } from "./lib/workflow-gates.mjs";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** Rung 2's record of the gate steps a PR is known to run. Repo-root relative. */
export const BASELINE_REL = "scripts/release-gates-baseline.json";

/**
 * The blocking gate steps ci.yml reaches, following its reusable workflows.
 * `readWorkflow(relPath)` resolves a local reusable workflow's text.
 * Pure — exported for the self-test.
 */
export function ciGateSteps({ ciYml, readWorkflow = () => null }) {
  return [...collectGates(ciYml, { readWorkflow })].sort();
}

/**
 * Rung 2 — gate steps the baseline records that ci.yml can no longer reach.
 * Pure set difference, exported for the self-test.
 *
 * This is the rung that sees gates.yml SHRINK, and since the release now
 * inherits its authority from a ci.yml run rather than re-deriving it, this is
 * also the only rung that can see the battery being hollowed out.
 */
export function missingFromBaseline(baselineGates, ciGates) {
  const have = new Set(ciGates);
  return [...baselineGates].filter((g) => !have.has(g)).sort();
}

/** Read the recorded baseline; `null` when the file is absent or malformed. */
export function readBaseline(root) {
  const p = join(root, BASELINE_REL);
  if (!existsSync(p)) return null;
  try {
    const json = JSON.parse(readFileSync(p, "utf8"));
    return Array.isArray(json.gates) ? json.gates : null;
  } catch {
    return null;
  }
}

/** Write the baseline (rung 2's `--update`). Sorted, so the diff is readable. */
export function writeBaseline(root, gates) {
  writeFileSync(
    join(root, BASELINE_REL),
    JSON.stringify(
      {
        $comment:
          "Rung 2 of `pnpm release-gates:check` (#103). Every gate step listed here must stay " +
          "reachable from .github/workflows/ci.yml. Since 2026-08-10 the release path does not " +
          "re-run the battery — it requires ci.yml's verdict for the tagged commit — so this " +
          "record is the ONLY thing that notices gates.yml being hollowed out. Ratchets UP; " +
          "regenerate with `pnpm release-gates:check -- --update` when a gate is deliberately " +
          "retired or renamed, and say why in the PR.",
        gates: [...gates].sort(),
      },
      null,
      2,
    ) + "\n",
  );
}

// ──────────────────────────────── CLI ─────────────────────────────────────────
function main(argv = []) {
  const rootIdx = argv.indexOf("--root");
  const root = rootIdx >= 0 ? argv[rootIdx + 1] : REPO_ROOT;
  const update = argv.includes("--update");
  const wfDir = join(root, ".github", "workflows");
  const ciPath = join(wfDir, "ci.yml");
  const releasePath = join(wfDir, "release.yml");
  for (const p of [ciPath, releasePath]) {
    if (!existsSync(p)) {
      console.error(`✖ release-gates: missing ${p.slice(root.length + 1)}`);
      return 1;
    }
  }

  const releaseYml = readFileSync(releasePath, "utf8");
  const ciGates = ciGateSteps({
    ciYml: readFileSync(ciPath, "utf8"),
    readWorkflow: (rel) => {
      const p = join(root, rel);
      return existsSync(p) ? readFileSync(p, "utf8") : null;
    },
  });

  if (ciGates.length === 0) {
    console.error(
      "✖ release-gates: resolved ZERO blocking gates from ci.yml — every rung below would " +
        "pass vacuously, and the release's whole authority is inherited from this run. Check " +
        "that the gates job still runs `pnpm <gate>` steps (directly or via a reusable " +
        "workflow this script can read).",
    );
    return 1;
  }

  // Rung 1: the publish must be authorised by the battery's verdict for THIS
  // commit, and must be authorised BEFORE it happens.
  const order = checkPublishRequiresVerdict(releaseYml);
  if (!order.ok) {
    console.error(`✖ release-gates: ${order.error}.`);
    console.error(
      `\n  Fix: run \`pnpm ${VERDICT_GATE}\` in release.yml as a preflight step of the publishing\n` +
        "  job, before `pnpm -r publish` (or in a job the publish declares `needs:` on). That gate\n" +
        "  refuses unless ci.yml concluded success on the exact commit under the tag — it is what\n" +
        "  replaced re-running the battery on the tag ref. See docs/RELEASING.md § 4.",
    );
    return 1;
  }

  // Rung 2: the recorded gate steps must still be reachable from the PR path.
  if (update) {
    writeBaseline(root, ciGates);
    console.log(
      `✔ release-gates: baseline ratcheted to ${ciGates.length} gate step(s) in ${BASELINE_REL}.`,
    );
    return 0;
  }
  const baseline = readBaseline(root);
  if (baseline === null) {
    console.error(
      `✖ release-gates: ${BASELINE_REL} is missing or malformed — rung 2 (the ratchet that\n` +
        "  notices gates.yml SHRINKING) cannot run. Regenerate it with\n" +
        "  `pnpm release-gates:check -- --update`.",
    );
    return 1;
  }
  const lost = missingFromBaseline(baseline, ciGates);
  if (lost.length > 0) {
    console.error(
      `✖ release-gates: ${lost.length} recorded gate step(s) are no longer reachable from ` +
        "the PR path:",
    );
    for (const g of lost) console.error(`    pnpm ${g}`);
    console.error(
      "\n  Fix: they were almost certainly dropped from .github/workflows/gates.yml. Put them\n" +
        "  back. A release now INHERITS its authority from a ci.yml run, so a gate deleted here\n" +
        "  is a gate no release will ever run again. If one was deliberately retired or renamed,\n" +
        `  ratchet the record with \`pnpm release-gates:check -- --update\` and say why in the PR\n` +
        `  (${BASELINE_REL}).`,
    );
    return 1;
  }

  console.log(
    `✔ release-gates: the publishing job \`${order.publishJob}\` runs \`pnpm ${VERDICT_GATE}\` ` +
      `before it publishes (${order.where}), so it can only publish a commit whose blocking ` +
      `battery concluded success; and all ${baseline.length} recorded gate step(s) are still ` +
      `reachable from ci.yml (${ciGates.length} found). Non-blocking jobs ` +
      "(`continue-on-error: true`) are out of scope — they cannot fail a PR either.",
  );
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
