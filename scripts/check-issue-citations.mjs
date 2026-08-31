#!/usr/bin/env node
/**
 * check-issue-citations.mjs — issue #63 guard: a bare `#N` issue citation in a
 * rule/doc/ADR is ambiguous once a fork's own issue tracker starts numbering from
 * 1 again. `.claude/rules/quality-gates.md` cited `#45` and `#59`/`#60` as if they
 * were self-evidently about the topics being described; live `gh issue view` shows
 * `#45`/`#59`/`#60` (and `#34`/`#42`/`#43`/`#46`/`#47`, cited elsewhere) are real,
 * unrelated, CURRENT fork issues. A reader or coding agent following the bare
 * citation lands on the wrong issue with full confidence.
 *
 * CONVENTION (recorded here — issue #63 AC2, "the maintainer has decided, and
 * recorded, the disambiguation convention"): a citation that does NOT refer to the
 * live fork issue at that number is rewritten `upstream#N`. This is the
 * HISTORICAL-MARKER option of the three the issue weighed (vs. rewriting to the
 * fork-equivalent issue, vs. dropping the number entirely) — chosen because it is
 * non-destructive (whatever the citation used to point to is preserved, not
 * guessed-and-replaced) and mechanically simple to gate: a regex, no semantic
 * understanding of what `#N` used to mean is required or attempted.
 *
 * NOT every bare `#N` in the repo is a collision, and this gate does NOT scan the
 * whole doc corpus for one — most bare citations (e.g. "#375", "#403" in
 * quality-gates.md) correctly name a live, current fork issue and marking them
 * `upstream#` would be actively wrong. Telling "correctly live" apart from
 * "collides with something else entirely" requires reading BOTH the citing prose
 * and the real GitHub issue at that number (`gh issue view <N>`) — a semantic
 * judgment this script deliberately does not attempt (see check-docs-accuracy.mjs's
 * "do NOT attempt semantic matching" precedent for the same reason). So instead of
 * a live-`gh`-backed, repo-wide threshold scan (network/auth/rate-limit dependent —
 * exactly the kind of blocking gate that goes flaky and gets `--no-verify`d), this
 * gate verifies a small, maintained, evidence-backed REGISTRY
 * (issue-citations-registry.json) of citations already confirmed as collisions.
 * Growing the registry is a manual step: run `gh issue view <N>` on the fork,
 * confirm the live issue is NOT what the citing prose describes, then add an
 * entry. Two of the six collisions issue #63 asked about — `.claude/rules/
 * decoration.md:75`'s and `AGENTS.md`'s "#29 item 3" / "(#29)" — are deliberately
 * NOT in the registry: `docs/ADR/0017-microcopy-adoption-and-namespacing.md` and
 * `docs/ADR/0019-lazy-engine-boundaries.md` both cite a "consumer report (a
 * workbench app) item #N" using the same "item #N" shape, which is evidence (not
 * proof) that decoration.md's "#29 item 3" names an item in that same external
 * report, not GitHub issue #29 — a different numbering space this gate has no
 * business rewriting as `upstream#29`. Per the issue's own instruction ("clarify
 * the source … or leave it unmarked pending clarification"), those two citations
 * are left as-is; a human should confirm the source before either registering or
 * rewriting them.
 *
 * For each registry entry, the named file must contain the marked `upstream#N`
 * form and must NOT still contain an unmarked bare `#N` — so stripping the marker
 * back off, or only marking one of several occurrences, is a red build.
 *
 * The pure `findIssueCitationViolations` threshold function below is the general
 * mechanism a registry entry's check is built on (a bare citation at/below a given
 * "head" is a violation unless marked; above head is today-safe because the fork's
 * counter hasn't reached it yet) — exported so the self-test can exercise the
 * mechanism directly with a mocked head, independent of the registry file.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { findRepoRoot } from "../packages/cli/lib/core.mjs";

const root = findRepoRoot(process.cwd()) ?? process.cwd();

/** A bare `#N` citation — NOT already marked `upstream#N`. */
export const BARE_CITATION_RE = /(?<!upstream)#(\d+)\b/g;

/** The historical-marker form for one specific number. */
export function markedRe(number) {
  return new RegExp(`\\bupstream#${number}\\b`);
}

/** A still-unmarked bare citation of one specific number. */
export function bareRe(number) {
  return new RegExp(`(?<!upstream)#${number}\\b`);
}

/**
 * Pure mechanism (exported for the self-test): every bare `#N` in `text` with
 * N <= currentHead is a violation — the fork's issue tracker has already reached
 * that number, so an unmarked citation at or below it is a live collision risk.
 * N > currentHead is today-safe: the counter hasn't gotten there yet, so nothing
 * can collide with it YET. Returns `{ number, index }[]`.
 */
export function findIssueCitationViolations(text, currentHead) {
  const violations = [];
  for (const m of text.matchAll(BARE_CITATION_RE)) {
    const number = Number(m[1]);
    if (Number.isFinite(number) && number <= currentHead) {
      violations.push({ number, index: m.index });
    }
  }
  return violations;
}

/**
 * Registry-driven check (exported for the self-test): for every `{file, number}`
 * entry, the file's current text must carry `upstream#<number>` and must NOT
 * still carry an unmarked `#<number>`. `readFile` is injectable so the self-test
 * can plant fixtures without touching disk.
 */
export function findRegistryViolations(registry, readFile) {
  const violations = [];
  for (const { file, number, issueTitle } of registry) {
    let text;
    try {
      text = readFile(file);
    } catch {
      violations.push(`${file}: registry names a file that does not exist or is unreadable`);
      continue;
    }
    if (!markedRe(number).test(text)) {
      violations.push(
        `${file}: registered collision #${number} ("${issueTitle ?? "no title recorded"}") ` +
          `is not marked \`upstream#${number}\` — see issue #63.`,
      );
    } else if (bareRe(number).test(text)) {
      violations.push(
        `${file}: registered collision #${number} has an UNMARKED bare citation ` +
          "alongside the marked one — mark every occurrence.",
      );
    }
  }
  return violations;
}

const registryPath = join(root, "scripts", "issue-citations-registry.json");
const registry = existsSync(registryPath) ? JSON.parse(readFileSync(registryPath, "utf8")) : [];

const violations = findRegistryViolations(registry, (relPath) => {
  const full = join(root, relPath);
  if (!existsSync(full)) throw new Error(`missing: ${relPath}`);
  return readFileSync(full, "utf8");
});

if (violations.length) {
  console.error(`✖ issue-citations (${violations.length}):`);
  for (const v of violations) console.error("  - " + v);
  console.error(
    "  Fix: mark the citation `upstream#N` (see this script's header for the convention), " +
      "or — if it never referred to a GitHub issue at all — leave it unmarked and remove it " +
      "from scripts/issue-citations-registry.json.",
  );
  process.exit(1);
}
console.log(
  `✔ issue-citations: ${registry.length} registered collision(s) stay marked \`upstream#N\`.`,
);
