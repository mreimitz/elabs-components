#!/usr/bin/env node
/**
 * check-merge-readiness.mjs — the merge guard (#386 parts B + C).
 *
 * WHY THIS EXISTS
 * ---------------
 * `.github/workflows/gates.yml` runs the whole blocking battery, including the
 * `Storybook interaction + axe` job. On this repo's plan those jobs CANNOT be
 * made required checks — verified, not inherited:
 *
 *     $ gh api repos/:owner/:repo/branches/main/protection
 *     {"message":"Upgrade to GitHub Pro or make this repository public to
 *       enable this feature.","status":"403"}
 *     $ gh api repos/:owner/:repo/rulesets
 *     {"message":"Upgrade to GitHub Pro or make this repository public to
 *       enable this feature.","status":"403"}
 *
 *     (probed 2026-08-02 against <owner>/<repo>, private.)
 *
 * So GitHub itself will happily merge over a red X — which is exactly what
 * happened to PR #375: it merged while `Quality gates (blocking)` reported
 * FAIL and `Storybook interaction + axe` was still PENDING, and that is the
 * mechanism behind #379 (conflict markers on `main`). A red X is a social
 * control, and `.claude/rules/quality-gates.md` § "Enforcement over reminders"
 * says a convention ships with its teeth.
 *
 * This script IS those teeth for the merge step: run it before `gh pr merge`
 * and it refuses while any blocking check is failing OR has not reported yet.
 * `.claude/hooks/gate-pr-merge-readiness.sh` calls it automatically (and BLOCKS,
 * exit 2) whenever an agent session runs `gh pr merge`, which is the actor that
 * merged #375.
 *
 * PENDING IS BLOCKING — that is the whole of part C. "Not yet reported" is not
 * "fine"; a merge that races the battery is indistinguishable from a merge that
 * ignored it.
 *
 * FAIL-CLOSED. No PR, no `gh`, an unparseable rollup, an empty rollup: all
 * refuse. The one way past is the loud, documented escape hatch
 * `ALLOW_UNVERIFIED_MERGE=1`, which prints what it is overriding.
 *
 * USAGE
 *   pnpm merge:check              # resolves the PR for the current branch
 *   pnpm merge:check -- 375       # an explicit PR number
 *   pnpm merge:check -- --json    # machine-readable verdict
 *   ALLOW_UNVERIFIED_MERGE=1 pnpm merge:check   # documented override
 *
 * Dependency-free; ESM; every path resolved from this file (cwd-independent).
 * Self-tested: `node --test scripts/check-merge-readiness.test.mjs`.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);

export const SETTINGS_PATH = join(REPO_ROOT, ".claude", "settings.json");
export const GATES_PATH = join(REPO_ROOT, ".github", "workflows", "gates.yml");
export const HOOK_REL = ".claude/hooks/gate-pr-merge-readiness.sh";

/**
 * A job is blocking unless it SAYS it is not. `ci.yml` marks its one
 * `continue-on-error` job in its own name — "E2E (Playwright, non-blocking)" —
 * so the convention is machine-readable and, more importantly, FAIL-CLOSED: a
 * job added later is required until somebody deliberately renames it. Matching
 * an allowlist of required names instead would silently stop requiring a job
 * the day it is renamed, which is the failure mode this whole issue is about.
 */
export const NON_BLOCKING_NAME = /non-blocking/i;

/** Conclusions that mean "this check is done and did not object". */
const OK_CONCLUSIONS = new Set(["SUCCESS", "SKIPPED", "NEUTRAL"]);
/** Statuses that mean "this check has not reported a conclusion yet". */
const UNREPORTED_STATUSES = new Set([
  "QUEUED",
  "IN_PROGRESS",
  "PENDING",
  "WAITING",
  "REQUESTED",
  "EXPECTED",
]);

/**
 * Normalizes one `statusCheckRollup` entry (GraphQL `CheckRun` or
 * `StatusContext`) to `{ name, state }` where state is one of
 * `"pass" | "fail" | "unreported"`.
 */
export function normalizeCheck(entry) {
  if (!entry || typeof entry !== "object") return null;
  // StatusContext (the legacy commit-status shape).
  if (typeof entry.context === "string") {
    const state = String(entry.state ?? "").toUpperCase();
    if (state === "SUCCESS") return { name: entry.context, state: "pass" };
    if (state === "PENDING" || state === "EXPECTED")
      return { name: entry.context, state: "unreported" };
    return { name: entry.context, state: "fail" };
  }
  const name = typeof entry.name === "string" ? entry.name : null;
  if (!name) return null;
  const status = String(entry.status ?? "").toUpperCase();
  const conclusion = String(entry.conclusion ?? "").toUpperCase();
  if (status && status !== "COMPLETED" && UNREPORTED_STATUSES.has(status))
    return { name, state: "unreported" };
  if (!conclusion) return { name, state: "unreported" };
  return { name, state: OK_CONCLUSIONS.has(conclusion) ? "pass" : "fail" };
}

/**
 * The verdict. Pure — the self-test drives it with fixtures, no network.
 *
 * @param {unknown} rollup the PR's `statusCheckRollup` array
 * @returns {{ready: boolean, blockers: string[], considered: number}}
 */
export function assessRollup(rollup) {
  if (!Array.isArray(rollup)) {
    return {
      ready: false,
      considered: 0,
      blockers: ["no status-check rollup available — cannot prove the battery ran"],
    };
  }
  const checks = rollup.map(normalizeCheck).filter(Boolean);
  const blocking = checks.filter((c) => !NON_BLOCKING_NAME.test(c.name));
  if (blocking.length === 0) {
    return {
      ready: false,
      considered: checks.length,
      blockers: [
        "no blocking check has reported on this PR yet — merging now races the battery (#375)",
      ],
    };
  }
  const blockers = blocking
    .filter((c) => c.state !== "pass")
    .map((c) => `${c.name} — ${c.state === "fail" ? "FAILING" : "has NOT reported yet (pending)"}`)
    .sort();
  return { ready: blockers.length === 0, blockers, considered: blocking.length };
}

/**
 * Wiring checks — a guard nobody calls is not a guard. Asserted by the
 * self-test so the mechanism cannot be silently unplugged (the same reason
 * `check-session-cadence` asserts its own hook registration).
 */
export function findWiringViolations({ settings, gatesYml }) {
  const out = [];
  if (!settings.includes(HOOK_REL)) {
    out.push(
      `.claude/settings.json no longer registers ${HOOK_REL} — the merge guard would never fire.`,
    );
  }
  if (!gatesYml.includes("merge:check:test")) {
    out.push(
      `.github/workflows/gates.yml no longer runs \`pnpm merge:check:test\` — the guard could rot unnoticed.`,
    );
  }
  return out;
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function main(argv) {
  const json = argv.includes("--json");
  const prArg = argv.find((a) => /^\d+$/.test(a));

  if (process.env.ALLOW_UNVERIFIED_MERGE === "1") {
    console.warn(
      "[merge-readiness] OVERRIDDEN by ALLOW_UNVERIFIED_MERGE=1 — merging without proving that\n" +
        "  `Quality gates (blocking)` and `Storybook interaction + axe` passed. This is the\n" +
        "  exact hole PR #375 went through (#386). Say why in the merge commit.",
    );
    return 0;
  }

  // The wiring half runs offline and always.
  const wiring = findWiringViolations({
    settings: readFileSync(SETTINGS_PATH, "utf8"),
    gatesYml: readFileSync(GATES_PATH, "utf8"),
  });
  if (wiring.length > 0) {
    console.error("[merge-readiness] FAIL — the guard is not wired up:\n");
    for (const v of wiring) console.error(`  • ${v}`);
    return 1;
  }

  let payload;
  try {
    const raw = gh([
      "pr",
      "view",
      ...(prArg ? [prArg] : []),
      "--json",
      "number,title,statusCheckRollup",
    ]);
    payload = JSON.parse(raw);
  } catch (error) {
    console.error(
      "[merge-readiness] FAIL — could not read the PR's checks " +
        `(${error?.message?.split("\n")[0] ?? error}).\n` +
        "  Refusing by default: an unknown check state is not a green one.\n" +
        "  If you genuinely must merge anyway, re-run with ALLOW_UNVERIFIED_MERGE=1.",
    );
    return 1;
  }

  const verdict = assessRollup(payload.statusCheckRollup);
  if (json) console.log(JSON.stringify({ pr: payload.number, ...verdict }, null, 2));

  if (!verdict.ready) {
    console.error(
      `[merge-readiness] REFUSED — PR #${payload.number} is not mergeable (${verdict.blockers.length} blocker(s)):\n`,
    );
    for (const b of verdict.blockers) console.error(`  • ${b}`);
    console.error(
      "\nA blocking job that is FAILING or has NOT REPORTED is not a green build (#386, #379).\n" +
        "Wait for the battery, fix what it finds, then merge. Override: ALLOW_UNVERIFIED_MERGE=1.",
    );
    return 1;
  }

  if (!json) {
    console.log(
      `[merge-readiness] OK — PR #${payload.number}: all ${verdict.considered} blocking checks reported success.`,
    );
  }
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main(process.argv.slice(2)));
}
