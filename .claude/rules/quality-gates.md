# Quality gates (every component must pass)

A component is "done" only when ALL of these hold:

- [ ] **Reuse audit (do this FIRST, before scaffolding)** — grep the `@elabs/components-*`
      barrels + `registry/` for the capability AND for shared helpers (copy
      buttons, context menus, `cn`, hooks) by name and by concept; reuse or extend
      what exists instead of duplicating. A new component/helper is only justified
      after this check. See @.claude/rules/storybook-mcp.md (ADD/dedupe workflow).
- [ ] **Types exported** — public props/types are exported from the package.
- [ ] **Composable** — accepts `className`, spreads `...props`, `forwardRef`
      where a DOM ref is meaningful.
- [ ] **Semantic tokens** — uses token-backed utilities; no raw hex/arbitrary
      colors anywhere except `themes.css`.
- [ ] **Theme-safe** — visually correct in both themes (`light`, `dark`). This is an **observed** result:
      render/screenshot the component (visual sweep or `test-storybook`) in each
      theme. **Never infer theme-safety from "it uses tokens"** — token usage is
      necessary, not sufficient (runtime-computed themes, e.g. a wrapped editor,
      can read tokens and still render wrong). For a THEME or system-wide visual
      change, observe it on a **real, representative, unmodified app screen**
      (e.g. a `scenarios-*` story) — never only on demo stories you authored to
      show the change off; a self-authored demo confirms nothing. See
      @.claude/rules/conceptual-framing.md. **A `themes.css` / token-VALUE edit
      (not just a new component) requires a `brand-ui-visual-ux-reviewer` three-theme sweep
      before merge** — the contrast tests (`themes-contrast` / `charts-contrast`)
      and `test-storybook` are necessary but NOT sufficient: they prove ratios and
      render, not that the recolored surfaces still read well. (Meta #161.)
- [ ] **Accessible** — keyboard operable, visible focus ring, correct
      roles/labels, no div-as-button (see `accessibility.md`).
- [ ] **Variants via `cva`** when it has more than one visual axis.
- [ ] **Story** — at least a Default story with `tags: ["autodocs"]`. If the
      Storybook dev server is running, it passes `mcp__storybook__run-story-tests`
      (interaction + axe a11y) and renders across both themes via
      `mcp__storybook__preview-stories` (`globals=theme:<slug>`); otherwise verify
      with `pnpm --filter @elabs/components-docs test-storybook`. See @.claude/rules/storybook-mcp.md.
- [ ] **Test** — at least one smoke test (render + key behavior) where practical.
- [ ] **Barrel export** — re-exported from the package's `src/index.ts`.
- [ ] **Agent-legible API** — predictable props a coding agent can use without
      reading the implementation.
- [ ] **No paid dependencies.**
- [ ] **Separation of concerns** — app UI in `@elabs/components-ui`, marketing in
      `@elabs/components-marketing`; data/ai/flow/charts stay in their packages.
- [ ] **Green checks** — `pnpm --filter <pkg> typecheck test` (and `lint`) pass.
- [ ] **Motion-tokened** — animations use the gated `duration-*`/`ease-*`
      utilities (or `--t-*`), never raw `duration-200`/`ease-in-out`; movement
      gets a `motion-reduce:` neutralizer. See docs/MOTION_GUIDELINES.md.

Run `/review-component <path>` to audit against this list.

## Definition-of-Done battery (run the review BEFORE you integrate)

"Done" is gated on the review battery having **already run** — review precedes
integration, it does not follow it. Never merge to `main`, push the default
branch, or claim "done" before the checks that match your change-type have run
and passed. Pick every row that applies (a network-touching component triggers
three rows, not one):

| Change type                            | Required checks before "done" / merge                                       |
| -------------------------------------- | --------------------------------------------------------------------------- |
| **Any change**                         | full-repo `pnpm typecheck` + `pnpm lint` + `pnpm test` + `pnpm build`       |
| **Component / UI**                     | `/review-component` + `brand-ui-accessibility-reviewer` (real-surface a11y) |
| **Security / network / auth-touching** | `/security-review`                                                          |
| **Structural / public-API / subpath**  | `brand-ui-design-system-architect`                                          |
| **Pre-publish or merge-to-`main`**     | `/prepare-release` (in addition to all rows above that apply)               |

Order: run the battery → fix what it finds → **then** commit/merge/push. If the
battery runs only after you've merged (because someone asked "did you run the
quality agents?"), the gate failed — that is exactly the failure #45 records. The
named agents/commands all exist; binding them to a pre-integration gate is what
makes them load-bearing.

The `pre-merge-review-gate.sh` `PreToolUse(Bash)` hook warns (does not block)
when it sees `git merge` / `git checkout main` / `git push … main` — a reminder
to confirm the battery ran first.

## Adding a new package or a public subpath export

A new `packages/<pkg>` isn't "done" when it builds — it's done when the
agent/skill path can discover it. Register it everywhere packages are enumerated:

- Run `pnpm gen` — the package tables in `CLAUDE.md` / `AGENTS.md` / `PROJECT.md` /
  `apps/docs/stories/Introduction.mdx` **and the factual catalogue region in
  `skills/brand-ui/SKILL.md`** (themes/tokens + per-package component/hook counts, #87)
  are **generated** (`pnpm gen:check` gates them); edit a package's purpose in
  `packages/cli/lib/render-docs.mjs` (`PKG_PURPOSE` for the 10 manifest packages,
  `INFRA_PKGS` for the 5 infra rows), then run `pnpm gen`. Only edit the prose
  **outside** the `<!-- brand-ui:gen:* -->` markers by hand.
- `CLAUDE.md` — the one-way dependency line (prose, not the generated table).
- `.claude/commands/new-component.md` — add it to the target-package list.
- `skills/brand-ui/SKILL.md` (the **judgment prose** around the generated catalogue) +
  `skills/brand-ui-component/SKILL.md` (routing) — and their `description` package lists.
- `apps/docs/.storybook/preview.tsx` — add its story-title group to `storySort`.
- Run `pnpm manifest` to regenerate `brand-ui.manifest.json`.

**This manual list is now belt-and-suspenders for the common case, not the only
path (#396).** `.githooks/pre-commit` chains the manifest write to its 5
downstream generators (`scripts/run-agent-docs-cascade.mjs`: `manifest` →
`inventory` → `llms` → `context` → `gen`, which itself runs `gen:readmes`) on
the same trigger as the manifest step — so committing a change under
`packages/*/src/**` regenerates and stages `component-inventory.md`, `llms.txt`,
`brand-ui-context.md`, the `pnpm gen`-owned regions and package READMEs
automatically, not just the manifest. This closes the gap that let 4 of 10
wave-2 work units land with 5-6 derived-artifact gates red despite a green
`manifest:check`. Keep the manual list above — it is the documented fallback
for a CI-only clone, a `--no-verify` commit, or adding a whole new package
(whose registration touches files the trigger regex doesn't scan, e.g.
`apps/docs/.storybook/preview.tsx`).

**Adding a new public subpath export** (e.g. `@elabs/components-editor/markdown/frontmatter`)
is _equally_ a structural API change — not a quiet implementation detail you reach
for to dodge a test. Before adding one:

- **Route it through `brand-ui-design-system-architect`** — confirm the subpath clears the
  gate (see @.claude/rules/component-api.md "Subpath exports"); don't add one on
  your own initiative to unblock a failing test.
- **Add it in all three places** — `exports`, `publishConfig.exports`, and the
  `tsup.config.ts` entry — so source-consumed and built consumers agree.
- **Register it for discovery** — re-run `pnpm manifest` (the crawler must see the
  new leaf, not just the barrel) and add it to the docs/skill surfaces above.

The `check-package-registered` hook warns when a library package's `package.json`
is written but its name is missing from `CLAUDE.md`, and when a `package.json`
write **adds a new `exports` subpath key** — a reminder to run the architect +
`pnpm manifest`.

## Reporting completion honestly

"Done" and "validated" are claims about what you actually **ran** — not what you
wrote. They apply to all work, not just components. Before reporting completion:

- **Only call something "validated" if its primary path was executed.** If you
  built it but never ran it, say so — e.g. "extractor validated; reviewer + filing
  path unexercised" — and put that in the **headline, not a footnote.**
- **Never headline "done / verified" when the PRIMARY validation surface wasn't
  exercised.** For a visual/theme change that surface is a real app screen (see
  Theme-safe above), not a self-authored demo. Footers don't cancel a "verified"
  headline — the honest headline is "candidate — not yet validated on a real
  screen." The `Stop` hook `gate-completion-claims.sh` nudges on bare claims.
- **Lead with what you did NOT verify.** The caveat is the most important
  sentence; never bury it under "all green."
- **Verify every file path / link you cite resolves** before putting it in a
  summary. A broken self-link undercuts the whole report.
- **A11y / visual claims must cite the REAL rendered surface — never a mock or a
  self-authored demo.** "Accessible" / "verified across both themes" is only
  true if the assertion ran against the actual component as it ships (a Storybook
  story in a browser, `test-storybook`, or the real app screen). A test that
  `vi.mock`s a `@elabs/components-*` component and then asserts a11y attributes on the
  stand-in proves nothing about the real surface — the mock (e.g. a `<textarea>`
  that happens to honor `aria-label`) can **mask** a P0 a11y bug in the real
  component (the #34/#46 lesson). Likewise a three-theme pass scoped to one
  self-authored story does not cover the surfaces a feature actually adds. State
  the exact surface (story ID + theme slug, or the real screen) you observed.

## Editing discipline

- **Read before Edit, batched.** Before a multi-file edit pass, `Read` the targets
  first — the harness blocks Edit-on-unread and each miss wastes a turn. After a
  `PostToolUse` formatter rewrites a file you're mid-editing, **re-`Read` it**
  before the next `Edit` (table padding / wrapping shifts your anchors).
- **A gate-affecting artifact is not "cosmetic" — fix it the first time.** If an
  artifact touches a gate (lint / format / types — e.g. a stray BOM, irregular
  whitespace, an unused import), it is not deferrable as cosmetics: it WILL trip
  the gate later and cost more turns than fixing it now. Don't deem it cosmetic
  and move on; fix it correctly before you continue.
- **In a git worktree, `Read` the WORKTREE path before editing it.** When you read
  a file from the main repo "for reference" and then `Edit` the same file in a
  worktree, the harness treats the worktree copy as unread (wasted turn). Always
  read the exact path you will edit.
- **Verify a shell script's own logic before trusting its output.** Three recurring
  false alarms come from sloppy idioms: use `git diff --quiet <path>` (exit 1 = changed)
  — NOT `git status <path>` exit code, which is always 0; resolve paths relative to the
  file's own dir (don't assume cwd); quote/realpath filenames. A script that prints
  "changed"/"broken"/"error" is a hypothesis — confirm it (e.g. `git diff`) before acting.

## Enforcement over reminders (a convention ships with its teeth)

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
  ONLY exemptions are paused surfaces, derived from `scripts/lib/paused-surfaces.mjs`
  — a whole directory for a paused package, and inside `themes.css` only the paused
  theme's own block. `--staged` runs the same detector over the index and is wired as
  a blocking step in `.githooks/pre-commit`, which in this fork is the only
  enforcement point: it has no `.github/workflows`. Self-tested by
  `pnpm debrand:check:test`, which asserts the hook wiring too), the manifest
  stale-gate (`pnpm manifest:check`), the component-registration gate
  (`pnpm components:check` — barrel export AND a co-located story, the latter a ratchet
  vs `scripts/components-story-baseline.json`: a NEW `@elabs/components-ui`
  component with no `*.stories.tsx` FAILS, and the baseline only ratchets down; the
  `*.test.tsx` arm stays advisory-by-design per "where practical" + #59), the
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
  not "not yet enumerated". **A green run is NOT "#60 satisfied":** the gate proves no
  spoke is empty, no shipped entry is thin/wrong, and the gap cannot grow — it does not
  prove the gap is closed. Every run prints the residual and `pnpm intent:check --
--residual` lists it; `@elabs/components-ai` is fully covered, the
  `@elabs/components-charts` internals are not, and **#60 stays open until
  the residual is 0**), the docs-accuracy gate (`pnpm docs:check`), the agent-name
  gate (`pnpm agents:check`), the AI-SDK types-only gate (`pnpm ai:types-only` + its
  PostToolUse hook), the content anti-slop ratchet (`pnpm slop:check` — the
  taste-skill's "Jane Doe effect" with teeth, WP-15 #107), the inventory/llms
  generators, the one-way package DAG gate (`pnpm dep-direction:check`, #184 — a
  sideways/upward `@elabs/components-*` `package.json` edge fails CI), the state-story
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
  `--force` bypasses it for a rare, justified ratchet-up).
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
  (#386, #379).** Branch protection cannot make any check required on this repo's plan:
  re-verified 2026-08-02, both `gh api repos/:owner/:repo/branches/main/protection`
  and `gh api repos/:owner/:repo/rulesets` return `403 "Upgrade to GitHub Pro or make
this repository public to enable this feature"`. **Do not re-derive this from the
  older prose — re-probe it; the day the plan changes, required checks are the correct
  fix and this whole section becomes a fallback.** Until then a red X is a _social_
  control, and PR #375 proved it: it merged while `Quality gates (blocking)` reported
  **fail** and `Storybook interaction + axe` was still **pending**, which is how #379
  put conflict markers on `main`. The teeth that replace it:
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

### Session cadence (review your own work — wired, not remembered)

The self-review machinery already exists; running it is part of the cadence, not an
optional extra:

- **After a larger building session**, review your own changed work before reporting
  done: run `/visual-review` (→ `brand-ui-visual-ux-reviewer`) and the
  `brand-ui-accessibility-reviewer` on the surfaces you touched, and `/review-component`
  on new/changed components. Findings route through `/file-issue` (finders report,
  builders fix) — do not silently patch.
- **At session completion**, run `/session-retro` so a fresh `brand-ui-session-reviewer`
  audits the session's _process_ and files `meta`/`type:process` issues, then hardens
  governance (rules + hooks) so the gaps can't recur.
- This is a **nudge that needs judgment** about "larger", so it is intentionally not a
  hard block; the honesty gate (`gate-completion-claims.sh`, `Stop`) already stops false
  "done" claims. The runtime nudge is `.claude/hooks/session-cadence-nudge.sh`, a `Stop`
  hook and a sibling of `gate-completion-claims.sh` — when a session edited ≥5 distinct
  product files (`packages/*/src/**`, `apps/*/{src,stories}/**`, tests excluded) and no
  self-review was **dispatched**, it prints the battery once and exits 2. It is guarded
  by `stop_hook_active`, so it fires at most once and can never loop or block.
  - **"Dispatched" means executed, not described.** Evidence is exactly two things: a
    real assistant `Task`.`subagent_type` / `SlashCommand`.`command` / `Skill`.`skill`
    call naming a reviewer, or **user** text (a human typing `/visual-review`). Every
    reviewer in this repo is reachable only through those three tools, so nothing
    legitimate is lost.
  - **What it deliberately ignores, and why.** Raw transcript bytes: Claude Code injects
    the reviewer roster into every session as `type:"attachment"` lines
    (`agent_listing_delta`, `skill_listing`), so a whole-file grep matched on line ~5 of
    every transcript and silently disabled the hook — as do a `Read` of this very rule
    (`tool_result`), a `<system-reminder>`, and a `Write` that quotes the battery. And
    **assistant prose**: in the real transcripts the sentences that name a reviewer are
    overwhelmingly the ones _declining_ it ("a `brand-ui-visual-ux-reviewer` three-theme
    sweep is still owed"), so counting them inverted the hook — it went silent on exactly
    the sessions it exists to catch.
  - **Verified against real bytes, not only fixtures.** Replayed over the transcripts in
    `~/.claude/projects/-Users-czq-Documents-DEV-elabs-elabs-components/`, it now nudges
    on all three large sessions with no reviewer dispatch (18 / 19 / 20 product files —
    including the one whose only dispatch is the _builder_ skill) and stays silent on the
    13-file session that really dispatched `review-component`.
  - Self-tested by `pnpm cadence:check:test` (`scripts/check-session-cadence.test.mjs`),
    whose fixtures carry that harness noise **and** the declining/claiming prose verbatim
    (a synthetic-only fixture is what let the dead hook pass its own gate), and which also
    asserts the hook is still registered in `.claude/settings.json` — an unregistered hook
    never fires.
