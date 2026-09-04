# Enforcement over reminders — the gate catalogue

> **What this is.** The full inventory of the automated checks that keep this repo's
> conventions true: what each gate asserts, the incident that motivated it, and the
> escape hatches. It was moved here from `.claude/rules/quality-gates.md` so it stops
> loading into every Claude Code session — it is 3,144 words of machinery description
> that changes nothing about how a component is written, and every gate below already
> prints its own failure message when it fires.
>
> **Who reads it.** Anyone adding, changing or debugging a gate; `/prepare-release`,
> `/session-retro` and the `repo-architect-*` auditors; and any agent that a failing
> gate has just pointed here. The always-on _principle_ — a convention ships with its
> enforcement — stays in `.claude/rules/quality-gates.md`, which links here.

The repo is **self-maintaining**: it stays correct because machinery enforces its
conventions, not because contributors remember to. A prose reminder decays — a gate,
hook, or generator does not. So this is a standing rule, not a one-off:

- **A new convention must ship with its enforcement.** If a change introduces a
  convention — a new file that must be _registered_ somewhere, a new _inventory_ that
  must stay fresh, a new _rule_ everything must follow — it ships **in the same change**
  with a generator (so the artifact is produced, not hand-kept) and/or a gate/hook (so a
  violation _fails_, not merely _warns in a doc_). A convention documented only in prose
  is incomplete.
- **A "must always hold" rule belongs in a hook or CI gate, not only a sentence.** When
  you find yourself writing "always do X" / "never do Y" in a rule, ask whether it can be
  _checked_. If it can, wire the check — that is what makes the rule load-bearing. Prefer,
  in order: a deterministic **CI gate** (`scripts/*.mjs` + a `pnpm <x>:check`, with a
  self-test so the gate can't rot) → a **PostToolUse hook** (edit-time feedback) → a
  documented manual step (last resort). The WP-10 machinery is the place to plug in:
  the conflict-marker gate (`pnpm conflict-markers:check`, #379 — no tracked file may
  contain a literal, unresolved Git conflict marker; checked BEFORE install since a
  marker can corrupt a JSON/JS gate script's own source before it even runs, the exact
  #375 incident), the debrand gate (`pnpm debrand:check` — this repo is a debranded
  fork, and no tracked text file may name the upstream organisation, matched
  case-insensitively and with no `@scope` required, since the case-sensitive one-shot
  codemods are exactly what let ~140 prose/identifier/camelCase survivors through. The
  ONLY exemptions are this gate's own source (`scripts/check-debrand.mjs`) and its
  self-test (`scripts/check-debrand.test.mjs`), which must quote the names to verify the gate
  works correctly. `--staged` runs the same detector over the index and is wired as
  a blocking step in `.githooks/pre-commit`, which in this fork is the only
  enforcement point: it has no `.github/workflows`. Self-tested by
  `pnpm debrand:check:test`, which asserts the hook wiring too), the manifest
  stale-gate (`pnpm manifest:check`), the component-registration gate
  (`pnpm components:check` — barrel export AND a co-located story, the latter a ratchet
  vs `scripts/components-story-baseline.json`: a NEW `@elabs-ai/components-ui`
  component with no `*.stories.tsx` FAILS, and the baseline only ratchets down; the
  `*.test.tsx` arm stays advisory-by-design per "where practical" + upstream#59), the
  intent-content gate (`pnpm intent:check` — a `stateTokens` class or a relationship name
  that does not resolve against real source fails; the authored ground truth may not
  hallucinate. The class match is **boundary-anchored, not a substring**: claiming
  `border-border` against a module that renders `border-border-strong` FAILS, because
  subtle-vs-strong is a WCAG 1.4.11 decision (ADR 0010) and the loose match shipped the
  non-compliant rung as ground truth. It also **ratchets coverage** —
  `scripts/intent-coverage-baseline.json` freezes today's uncovered ai/charts root
  surfaces, so a NEW surface in those packages cannot ship with zero anti-patterns;
  the baseline only goes down, via `--update`. A "root surface" excludes a sibling whose
  module already carries intent (`UserMessage` under `Message`) and a verbatim
  third-party re-export (visx's `GradientTealBlue`), so the count means "still owed",
  not "not yet enumerated". **A green run is NOT "upstream#60 satisfied":** the gate proves no
  spoke is empty, no shipped entry is thin/wrong, and the gap cannot grow — it does not
  prove the gap is closed. Every run prints the residual and `pnpm intent:check --
--residual` lists it; `@elabs-ai/components-ai` is fully covered, the
  `@elabs-ai/components-charts` internals are not, and **upstream#60 stays open until
  the residual is 0**), the docs-accuracy gate (`pnpm docs:check`), the agent-name
  gate (`pnpm agents:check`), the AI-SDK types-only gate (`pnpm ai:types-only` + its
  PostToolUse hook), the content anti-slop ratchet (`pnpm slop:check` — the
  taste-skill's "Jane Doe effect" with teeth, WP-15 #107), the inventory/llms
  generators, the one-way package DAG gate (`pnpm dep-direction:check`, #184 — a
  sideways/upward `@elabs-ai/components-*` `package.json` edge fails CI), the state-story
  coverage ratchet (`pnpm states:check`, #247), the eager-heavy-dependency ratchet
  (`pnpm heavy-deps:check` — an engine like mermaid/Rive/xterm must be reached by a
  dynamic `import()`; a static edge puts it in every consumer's entry chunk because
  those packages declare no `sideEffects`), the remote-origin inventory
  (`pnpm origins:check` — every `https://` origin in shipped source is allowlisted
  AND documented in `docs/CSP-AND-NETWORK.md`), the Trusted-Types alias dogfood
  (`pnpm tt-aliases:check`), the CSP policy/doc parity gate (`pnpm csp:check`, #314 — the
  gate keeps `docs/CSP-AND-NETWORK.md` §2.7 equal in meaning to `docs/csp-policy.json`
  with a named carve-out for every relaxation, so nobody can widen the policy silently to
  make a page load. **Doc parity only since 80a12fb (2026-08-02):** the app that SERVED
  that policy as a real header and the E2E test that failed on real browser violations
  were deleted, and the removal was completed on 2026-08-10 — so the policy is now
  reviewed, not executed, and rehoming the serving arm onto `apps/docs` is the fix if
  that guarantee is wanted back), the microcopy ratchet (`pnpm microcopy:check` — user
  strings go through `t()`, ADR 0017), and the shipped-CSS asset gate
  (`pnpm css-assets:check` — every relative `url()`/`@import` in an exported
  stylesheet resolves in the artifact a consumer installs, and every bare
  `@import` names a real dependency, not a devDependency), the worktree-branch
  guard (`pnpm worktree-branch:check`, #403 — two independently-dispatched
  `/close-issues` coder agents committed straight to `main` instead of their
  assigned worktree/branch, and a STRONGER brief did not stop the second
  occurrence). TWO checks, since either side of the worktree boundary can
  drift: (a) `.githooks/pre-commit`'s first, hard-abort step rejects a commit
  when the current worktree carries an `.expected-branch` marker — written by
  the orchestrator at worktree-creation time, see `.claude/commands/close-issues.md`
  Phase 2 — that disagrees with what `git rev-parse --abbrev-ref HEAD` resolves
  to, printing both branch names; (b) in the PRIMARY checkout (fix round 1 —
  the marked-worktree check alone is inert exactly where the real incidents
  happened, since a marker only ever lives inside a unit's own linked
  worktree and git refuses to check out `main` in two places at once), a
  commit on `main` is blocked while ANY worktree under
  `.claude/worktrees/<unit>/.expected-branch` is marked (an orchestration run
  is in flight elsewhere), unless the orchestrator's own loud override
  `ALLOW_MAIN_COMMIT=1` is set for its own merge/integration commits. An
  UNMARKED worktree with no orchestration running anywhere is a silent no-op
  either way — see `scripts/check-worktree-branch.mjs`), and the
  ratchet-baseline PROVENANCE meta-gate (`pnpm baseline-provenance:check`,
  #400 — a ratchet-baseline gate (`variants:check`, `loading-states:check`,
  `states:check`) only ever asserted that the CONTENTS of its committed baseline
  JSON matched the file on disk, never that those contents were still
  reproducible; a hand-edit adding a fabricated entry, or one describing debt
  that has since been fixed, made the underlying gate exit 0 with no `--force`
  and no script involvement. `scripts/check-baseline-provenance.mjs` runs TWO
  rungs: derivation re-derives what each of the three gates' own `--update`
  would currently write and fails when the committed baseline contains an
  entry that derivation does not explain (fabricated or stale debt — the
  remedy is identical either way, run `--update`); git provenance (fix round
  1 — derivation alone cannot tell "pre-existing debt" from "debt this branch
  just introduced and hid", since a genuinely new, real violation is
  derivable by construction and so is not an orphan) compares the committed
  baseline against that same file's content at the resolved base ref
  (`git show <base>:<path>`, base resolved via `check-changelog-entry.mjs`'s
  `resolveBase`) and fails on any key the branch ADDED, enforcing the
  ratchet's "only goes down" contract at the git level instead of trusting
  the file's own contents; skipped, never a false failure, when no base is
  resolvable (a fixture tree, a shallow clone with nothing fetchable) —
  `--force` bypasses it for a rare, justified ratchet-up), and the issue-citation
  guard (`pnpm issue-citations:check`, #63 — a bare `#N` citation is ambiguous
  once a fork's own issue tracker restarts numbering from 1: `upstream#59`/`upstream#60`
  in THIS file, `upstream#45`/`upstream#34`/`upstream#46` in
  `.claude/rules/quality-gates.md`, and `upstream#42`/`upstream#43`/
  `upstream#47` in `docs/ADR/0006-subpath-exports.md`, once read as
  self-evidently about the topic being described, actually name real,
  unrelated, CURRENT fork issues. The recorded disambiguation convention — one of
  three the issue weighed (historical marker vs. rewrite-to-fork-equivalent vs.
  drop-the-number) — is the historical marker: a citation that does not refer to
  the live fork issue at that number is rewritten `upstream#N`, non-destructively
  preserving what it used to point to. `scripts/issue-citations-registry.json`
  is the maintained, evidence-backed list of citations already confirmed (via
  `gh issue view <N>`) as collisions; the gate verifies every registered file
  still carries the `upstream#N` form and no longer carries the bare, unmarked
  one — self-tested via `pnpm issue-citations:check:test`. It deliberately does
  NOT scan the whole doc corpus with a live-fetched "current head" — most bare
  citations correctly name a live fork issue, and telling the two apart needs a
  human or an agent reading the actual GitHub issue, not a regex; growing the
  registry is that manual, evidence-backed step. Two candidate collisions —
  `.claude/rules/decoration.md`'s and `AGENTS.md`'s "upstream#29" candidate — are
  deliberately left UNREGISTERED and unmarked (still a bare "#29" in both files):
  `docs/ADR/0017-microcopy-adoption-and-namespacing.md` and
  `docs/ADR/0019-lazy-engine-boundaries.md` both cite a "consumer report (a
  workbench app) item #N" in the same shape, which is evidence (not proof) that
  decoration.md's "#29 item 3" names an item in that external report, not GitHub
  issue #29 — a different numbering space this gate has no business rewriting).
- **`charts:honesty:check`** (`pnpm charts:honesty:check`, self-test
  `pnpm charts:honesty:check:test`, RM-039 / #265) enforces four chart-honesty
  rules ported from an external gap analysis of the "lieflat-charts" project
  (`docs/review/2026-09-04-lieflat-charts-gap-analysis.md` §5 C5). The four
  rules: (1) a bar/length mark's value scale must be zero-based — the gate
  accepts either `resolveBarValueDomain` (the existing RM-027 zero-forcing
  helper `bar-chart.tsx` already calls) or the newer generic
  `resolveYDomain(domain, { includeZero: true })`
  (`packages/charts/src/charts/y-domain-utils.ts`) as proof, **matched only
  at the CALL SITE** (immediately after `domain:` or `return`) — an earlier
  version matched the helper name anywhere in the file, which made the rule
  permanently unfalsifiable in `bar-chart.tsx` itself, the one file that both
  calls AND defines `resolveBarValueDomain` (an orchestrator mutation probe
  — swap both real call sites for a bare `[min, max]` — caught this; the gate
  now fails on that probe and the self-test locks a fixture with the same
  shape: a file that defines the helper without calling it for its own
  domain). **Rule 1's real reach today is one file**, `bar-chart.tsx` — the
  only member of `BAR_FAMILY_FILE_RE` (`bar-chart|waterfall-chart|histogram`)
  that owns a `scaleLinear` domain; `waterfall-chart.tsx` is built on
  `BarChart` and calls no `scaleLinear` of its own, `unit-chart.tsx` has no
  scale at all (marks are counted, not measured), and
  `distribution/kinds/histogram.tsx` computes a direct `count / countMax`
  proportion with no `scaleLinear` domain — all three are zero-based by
  construction and are correctly un-flagged, not un-checked. (2) an
  area/radius mark's size must come from a sqrt-based encoding — the gate
  looks for `Math.sqrt`/`Math.pow(…, 0.5)` alongside the mark's value
  variable, or a call into the new `areaRadius()` helper
  (`packages/charts/src/marks/area-radius.ts`, `radius = rMax *
sqrt(value / max)`, so drawn AREA — not radius — is proportional to value);
  (3) no `Math.random()` — chart randomness must go through the deterministic
  `seededRnd` (`packages/charts/src/marks/seeded-rnd.ts`) so a story/test is
  reproducible; (4) a unit-decomposed chart (a story whose block sets
  `unit={…}` alongside a `layout`/pictogram-style prop) must state its unit
  visibly, via a `unitLabel`/`description`/`accessibleDescription` prop whose
  value reads as "one X = N" (the gate extracts and matches only the VALUE of
  those props — not a story's whole block text — after a brace-depth-aware
  split of each `export const … : Story = {…}` block, specifically so one
  story's caption or a later story's stray comment can't be mistaken for
  another's). Every rule runs its detection regex against a comment-stripped
  copy of the source (`stripCommentsPreservingLines`, blanks comment bodies
  without shifting line numbers) so an explanatory docblock that merely
  discusses `Math.random()` or a sqrt formula can't trip the gate — while an
  inline `// honesty:allow <reason>` escape (checked against the ORIGINAL,
  unstripped source, since the allow comment itself lives in a comment) can
  suppress a genuine, reviewed exception on its line. Rule 4's pre-existing
  gaps (containers with no visible caption prop, or stories that never set
  one) are carried in a **ratchet-only** ADR-parity-style baseline,
  `scripts/charts-honesty-caption-baseline.json` — `--update` (no `--force`)
  can only shrink it (a currently-failing key not already in the baseline is
  REJECTED, not silently added); rules 1-3 have no baseline and fail
  immediately on any new violation.
  **Scope is `packages/charts/src/{charts,marks}/**` only — a DECLARED
  limit, not a silent one.** For rules 1/2/4 this is a reasoned exclusion:
  those rules police a value ENCODING (length/area/radius/unit), and the
  sibling directories (`gantt/`, `metric-card/`, `metric-grid/`,
  `sparkline/`, `chart-card/`, `chart-frame/`, `auto-chart/`) own none — a
  Gantt bar draws a date range and a 0–100 progress fraction against a fixed
  timeline, never a length pulled from an arbitrary y-domain, and has no
  area/radius mark at all. For rule 3 (no `Math.random`) that reasoning does
  **not** hold — the item's spec bans it package-wide with no encoding
  caveat — and the narrowing hid a real, in-spec violation:
  `gantt/gantt.stories.tsx:250`calls`Math.random()`in a story's fixture
  data. This is **not** fixed by this gate: fixing it means editing
 `gantt.stories.tsx`, which is outside this item's write-set, and a ratchet
  baseline for rule 3 is not authorized (RM-039's ratchet exception covers
  only rule 4's story captions). The finding is reported for `/file-issue`   routing instead. Whoever fixes it should also decide whether to widen
  `SCAN_DIRS`to`packages/charts/src` for rule 3 at the same time — see the
  script's own header for the fuller reasoning. Self-tested
  (`scripts/check-charts-honesty.test.mjs`) including a dedicated regression
  for the union-vs-intersect baseline-update bug class (a naive
  `[...current, ...old].filter(current.includes)`always reduces to
 `current`, which would silently accept every new failure) and for the
  real-tree false positives this gate hit during development (a JSX
  attribute like `fill="var(--chart-1)" … unit={2000}` satisfying a
  whole-block "one … = …" regex by punctuation accident, a story-block
  splitter that bled a later story's trailing text into an earlier story's
  block, and the rule-1 call-site vacuity above).
- **Nothing is published from a commit the battery has not passed (#103) — but the
  release path no longer RE-RUNS it (2026-08-10).** Every blocking gate lives once,
  in the reusable `.github/workflows/gates.yml`, which `ci.yml` calls on every PR
  and push to `main`. `release.yml` used to call it too, as a `needs:` dependency
  of the publish. Correct and unaffordable: on the 3.0.0 tag run the tag ref spent
  29 of 38 minutes re-proving a battery `main`'s own CI was proving concurrently on
  the identical commit. So the release now **requires the verdict** instead —
  `pnpm release-verdict:check` (self-tested) refuses unless every **blocking** job
  of the newest `CI` run for the exact tagged SHA concluded success, and fails
  closed on every ambiguous state (no run, pending, red, an unreadable API, a jobs
  list with nothing blocking in it). Pinning to the immutable SHA is the whole
  design — "`main` is green" decays the moment `main` moves. A job counts as
  blocking unless its NAME says otherwise (`/non-blocking/i`, the same regex
  `merge:check` uses), which is what keeps the 25-minute non-blocking Storybook job
  off the release's critical path without weakening anything a PR must pass.
  `pnpm release-gates:check` now has **two** rungs: **verdict** (release.yml's
  publishing job runs that gate BEFORE `pnpm -r publish` — the position is asserted
  because a GitHub-enforced `needs:` edge was traded for an ordinary step, and a
  verdict read after an immutable publish stops nothing) and the **ratchet**
  against `scripts/release-gates-baseline.json`. The ratchet now carries the weight
  set-parity used to share: a release inherits its authority from whatever
  `gates.yml` actually ran, so a gate quietly deleted there is a gate no release
  will ever run again. **Practical consequence for the release flow:** push `main`,
  let CI's blocking jobs go green on that commit, THEN tag — `docs/RELEASING.md` § 4
  gives the one-line local probe.
- **A documentation-only commit takes a reduced battery — the JOB still runs
  (2026-08-17).** Prose cannot break a typecheck, a unit suite, a build or a
  consumer install smoke, so `gates.yml` guards those steps on
  `scripts/resolve-ci-scope.mjs` (`pnpm ci-scope`, self-tested by
  `pnpm ci-scope:test`), which classifies the change and takes ~13 minutes down to
  ~3 for a README fix.
  - **`paths-ignore:` is the wrong tool here and must not be reintroduced.** Both
    `release-verdict:check` and `merge:check` are fail-closed on a blocking check
    that has not reported, so a workflow that does not RUN produces no verdict —
    `paths-ignore` would not skip CI on docs, it would make every docs commit
    unmergeable **and** unreleasable. Only the job's CONTENTS may shrink; the job
    always runs and always concludes.
  - **Why the reduced run is still sound:** by induction on `main`. If commit N
    passed the full battery and N+1 changes only prose, N+1's source is
    byte-identical to N's, so every source-derived gate would re-prove what N
    already proved. That holds only while the classifier is conservative, which is
    its entire design — `.md`/`.mdx` and `LICENSE` only; never `.txt`, `.json` or
    an image; never anything under a `fixtures`/`tests` segment (that markdown is
    test DATA and the fast path skips the tests); and every unresolvable state (no
    base ref, a zero `before` SHA, a git error, an empty diff) falls back to the
    full battery. A **release** commit writes 16 `package.json` version sites, so
    it can never be classified docs-only — the commit a tag names always inherits
    a full battery.
  - **What still runs on the fast path:** `format:check`, the security/shipped-asset
    scans, the derived-artifact freshness gates, docs + governance, and the release
    machinery — i.e. everything a markdown edit can actually break, including a
    hand-edited generated region.
  - **The one thing the ratchet cannot see.** `release-gates:check` rung 2 asserts
    each recorded gate step is still _reachable_ from `ci.yml`; a step that is
    textually present but conditionally skipped still counts. That is why the
    condition is one expression sourced from one self-tested script rather than
    hand-written per step, and why `ci-scope:test` runs on **every** path — a
    classifier that called a source change "prose" would hand a green blocking job
    to a commit nothing compiled.
- **A package-affecting change records itself (#64, ADR 0020).** A branch that
  touches `packages/<distributable>/src/**` (tests and stories excluded) must add
  a line under `CHANGELOG.md`'s `## Unreleased` — `pnpm changelog-entry:check`,
  self-tested, in the battery. This repo has no Changesets; `## Unreleased` IS the
  per-change record (`/release` renames it, `release-snapshot.mjs` extracts
  `RELEASE_NOTES.md` from it), so a change with no entry ships undocumented.
- **axe is BLOCKING, on a ratchet (#78 AC3 / #316).** `apps/docs/.storybook/preview.tsx`
  sets `parameters.a11y.test: "error"`, so `@storybook/addon-a11y` asserts
  `toHaveNoViolations()` on every story and any violation reds the `storybook` CI job —
  a new component can no longer ship an unnamed button with green CI. The 200 stories
  that were already violating when this landed (187 measured in one full run, plus 13
  Monaco-mounting stories that violate intermittently) are exempted per story from the
  **generated** `scripts/a11y-baseline.json`; `pnpm a11y:baseline:check` (self-tested)
  keeps that list generated, keeps the preview.tsx wiring in place, and lets its ceiling
  only ever go DOWN. Re-measure with `pnpm a11y:baseline:run`, then
  `pnpm a11y:baseline:check --update` (add `--prune` to drop what is clean now). **A new
  violation is fixed, never exempted** — the ceiling makes adding one a red build.
- **Merge discipline — a blocking job that is FAILING _or_ PENDING blocks the merge
  (#386, #379).** **UPDATED 2026-08-17 — the repository is PUBLIC now, and branch
  protection on `main` is ACTIVE.** `gh api repos/:owner/:repo/branches/main/protection`
  returns a policy (no longer `403 "Upgrade to GitHub Pro…"`): pull requests are
  required, `enforce_admins` is on, force pushes and deletions are blocked. A direct
  `git push origin main` is rejected with `Changes must be made through a pull
request` — which is why a release now lands through a PR (see
  `docs/RELEASING.md` § 4 and the tag-target rule there; the merge commit is a NEW,
  untested SHA and must not be the one you tag).
  **But `required_status_checks` is still ABSENT from that policy**, so a red X
  remains a _social_ control: the GitHub UI will still merge over a failing or
  pending job. Everything below therefore stands unchanged. **The correct
  structural fix is now available and is not yet done — add the blocking `CI` job
  as a required status check** (`gh api -X PATCH …/branches/main/protection`); until
  someone does, re-probe rather than trusting this paragraph. PR #375 is what the
  gap costs: it merged while `Quality gates (blocking)` reported **fail** and
  `Storybook interaction + axe` was still **pending**, which is how #379 put
  conflict markers on `main`. The teeth that replace it:
  - **`pnpm merge:check`** (`scripts/check-merge-readiness.mjs`) — run it before
    `gh pr merge`. It reads the PR's check rollup and exits non-zero while any
    blocking check is failing **or has not reported yet**. _Pending is blocking_ —
    "the battery hasn't finished" and "the battery passed" are not the same state, and
    conflating them is the exact gap #375 went through. It is **fail-closed**: no PR,
    no `gh`, an empty rollup, a `CANCELLED`/`TIMED_OUT` conclusion — all refuse. A job
    is blocking unless its **name** says otherwise (`E2E (Playwright, non-blocking)`),
    so a job added later is required by default.
  - **`.claude/hooks/gate-pr-merge-readiness.sh`** — a `PreToolUse(Bash)` hook that
    **blocks** (exit 2) `gh pr merge` unless that guard passes. Deliberately narrow: it
    does not touch `git merge` / `git push` / `git checkout main` (local integration is
    normal, and a hook that bricked it would be routed around within a day —
    `pre-merge-review-gate.sh` still warns there). `gh pr merge` is the command that
    merged #375.
  - **`pnpm merge:check:test`** — self-tested in `gates.yml`, planting the real #375
    shape (one blocking job failing, one pending, a non-blocking job red) and asserting
    refusal, plus asserting the hook is still registered in `.claude/settings.json`.
  - **Escape hatch: `ALLOW_UNVERIFIED_MERGE=1`** — loud, logged, and it must be
    justified in the merge commit. **Honest limit: on this plan nothing can make a
    merge impossible** — the GitHub UI still merges over red. These teeth bind the
    agent/CLI path, which is where the damage came from; they are not branch
    protection and must not be described as if they were.
- **Format has commit-time teeth, not just a CI backstop (#239).** `pnpm format:check`
  (`prettier --check .`) is blocking in CI, but branch protection can't be made a
  required check on this repo's plan — so the enforcement has to live in the local
  commit hook. `.githooks/pre-commit` (wired via `core.hooksPath`, the `prepare` npm
  script) runs `prettier --write` over the STAGED Prettier-supported files and
  re-stages the idempotent result on every commit, alongside its existing manifest
  regeneration step — so an unformatted file can't land via the normal commit path.
  `pnpm format:check` in CI remains the backstop for a `--no-verify` bypass or a
  machine that never ran `pnpm install` (no `core.hooksPath`).
- **`node_modules` stays in sync with the lockfile automatically — local-only teeth.**
  A `git pull`/checkout/rebase that changes `pnpm-lock.yaml` (newly-added deps) WITHOUT a
  following `pnpm install` leaves the store behind the lockfile, so Vite can't resolve the
  new imports and floods Storybook/dev with `Failed to resolve import` → bare `404` →
  `Failed to fetch dynamically imported module` (the 2026-07-04 incident: a fast-forward
  pull added `maplibre-gl`/`@dagrejs/dagre`/`@radix-ui/react-direction`). CI can't catch
  this — it always installs fresh — so the enforcement is local git hooks:
  `.githooks/post-merge`, `post-checkout`, `post-rewrite` (wired via `core.hooksPath`) call
  `scripts/ensure-deps-synced.mjs`, which runs `pnpm install` iff the lockfile actually
  changed across the moved refs (idempotent + fast when already in sync). Opt out per-run
  with `BRAND_UI_SKIP_AUTO_INSTALL=1`; skipped under `CI`. Detection logic is self-tested
  (`pnpm deps-sync:test`, in CI). Manual fallback stays: run `pnpm install` after any pull
  that touches `pnpm-lock.yaml`.
- **Self-tested gates.** A gate that can silently stop firing is worse than none. Ship a
  `*.test.mjs` self-test (`node --test`) that plants a bad fixture and asserts the gate
  fails — wired as `pnpm <x>:check:test` in CI (see `check-charts-reuse`,
  `check-agent-names`, `check-ai-sdk-types-only`, `check-anti-slop`).
