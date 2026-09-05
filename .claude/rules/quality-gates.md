# Quality gates (every component must pass)

A component is "done" only when ALL of these hold:

- [ ] **Reuse audit (do this FIRST, before scaffolding)** — grep the `@elabs-ai/components-*`
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
      (not just a new component) requires a `brand-ui-visual-ux-reviewer` cross-theme sweep
      before merge** — the contrast tests (`themes-contrast` / `charts-contrast`)
      and `test-storybook` are necessary but NOT sufficient: they prove ratios and
      render, not that the recolored surfaces still read well. (Meta #161.)
      **How to actually run the non-default theme headlessly** — a bare
      `vitest --project storybook` run has no toolbar and no URL globals, so it
      measures `light` and only `light`:
      `cd apps/docs && STORYBOOK_THEME=dark pnpm exec vitest --project storybook run <name>`.
      Cite the theme slug you ran, not just "both themes". See
      @.claude/rules/storybook-mcp.md § Themes.
      **A story that flips `data-theme` IN PLACE must prove the flip took
      (measured, 2026-09-02).** Setting the attribute on a guessed ancestor
      (`document.body`, `document.documentElement`) is a silent no-op whenever
      the decorator wrote `data-theme` onto an element NEARER the story — the
      nearer attribute wins the cascade, so both branches of a "check it in
      both themes" loop assert in the same theme and the cross-theme claim is
      false. Resolve the governing element from the subject
      (`el.closest("[data-theme]")`), then assert two things: the attribute is
      what you set, AND the resolved ink actually differs between the two
      branches. `packages/ui/src/components/input/input.stories.tsx` is the
      worked example — it claimed both themes for months while only ever
      measuring one, and nothing caught it until the suite was run under
      `STORYBOOK_THEME=dark`.
      **CI measures `light` only.** `gates.yml` runs the storybook project with
      no theme pinned, so a dark-only failure is invisible to every blocking
      job. Run the dark sweep by hand before claiming theme-safety on anything
      cross-cutting.
      **An anti-vacuity guard must pick a token pair that differs in EVERY
      theme.** Two roles may legitimately carry the same literal in one theme
      and not another — `--sidebar-foreground` equals `--foreground` in the
      dark reference theme (light's sidebar ink is near-white because that
      theme's sidebar ground is dark; dark's is near-white because everything
      is), which is a coincidence, not an undeclared alias. A guard built on
      that pair is unsatisfiable in dark.
- [ ] **Accessible** — keyboard operable, visible focus ring, correct
      roles/labels, no div-as-button (see `accessibility.md`).
- [ ] **Variants via `cva`** when it has more than one visual axis.
- [ ] **Story** — at least a Default story with `tags: ["autodocs"]`. If the
      Storybook dev server is running, it passes `mcp__storybook__run-story-tests`
      (interaction + axe a11y) and renders across both themes via
      `mcp__storybook__preview-stories` (`globals=theme:<slug>`); otherwise verify
      with `pnpm --filter @elabs-ai/components-docs test-storybook`. See @.claude/rules/storybook-mcp.md.
- [ ] **Test** — at least one smoke test (render + key behavior) where practical.
- [ ] **Barrel export** — re-exported from the package's `src/index.ts`.
- [ ] **Agent-legible API** — predictable props a coding agent can use without
      reading the implementation.
- [ ] **No paid dependencies.**
- [ ] **Separation of concerns** — app UI in `@elabs-ai/components-ui`, marketing in
      `@elabs-ai/components-marketing`; data/ai/flow/charts stay in their packages. The
      one-way line ends in `→ process`: `@elabs-ai/components-process` is the single
      **layer-3** composite (ADR 0034), so a missing primitive goes **down** into the base
      package that owns it — it is never authored in `process`, and never reached for
      sideways between two layer-2 leaves.
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
quality agents?"), the gate failed — that is exactly the failure upstream#45 records. The
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
- `CLAUDE.md` — the one-way dependency line (prose, not the generated table), plus its
  three siblings that must state it identically: `.claude/rules/design-system.md`,
  `.claude/rules/architecture-review.md` D1 and
  `.claude/agents/repo-architect-structure-auditor.md`.
- `scripts/check-dep-direction.mjs` — the `ALLOWED` map is the MACHINE-READABLE copy of
  that line; a package missing from it fails `pnpm dep-direction:check` by name.
- `.claude/commands/new-component.md` — add it to the target-package list.
- `skills/brand-ui/SKILL.md` (the **judgment prose** around the generated catalogue) +
  `skills/brand-ui-component/SKILL.md` (routing) — and their `description` package lists.
- `apps/docs/.storybook/preview.tsx` — add its story-title group to `storySort.order`,
  and to the numbered list in `docs/STORYBOOK_GUIDELINES.md` (the two must match).
- **`apps/docs/.storybook/preview.css`** (and any other app CSS with `@source` lines,
  e.g. `fixtures/consumer-smoke/src/index.css`) — add an `@source` directive pointing at
  the new package's source, **if** it ships real Tailwind class strings. Tailwind v4 does
  not auto-scan workspace packages resolved via `node_modules`; a package missing here
  compiles no styles for its own classes and silently renders unstyled (#348). This is
  **gated**, not just documented: `pnpm tailwind-sources:check` fails CI if a package with
  `.tsx` source containing real class strings is absent from every `@source`-bearing CSS
  file in the repo.
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

**Adding a new public subpath export** (e.g. `@elabs-ai/components-editor/markdown/frontmatter`)
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
  path unexercised."
- **Never claim "done / verified" when the PRIMARY validation surface wasn't
  exercised.** For a visual/theme change that surface is a real app screen (see
  Theme-safe above), not a self-authored demo. Don't let a footnote cancel a
  "verified" claim — if the surface wasn't exercised, the honest claim itself is
  "candidate — not yet validated on a real screen." The `Stop` hook
  `gate-completion-claims.sh` nudges on bare claims.
- **State what you did NOT verify in the `Problems` section**, in one plain line
  (the answer contract in `~/.claude/CLAUDE.md`). It is never omitted — the
  disclosure is mandatory — but it is not the opening either: a report that
  starts with an inventory of self-doubt buries the thing the reader actually
  needs. Placement is the only part of this that changed (2026-08-31); the
  duty to disclose is unchanged, and `gate-completion-claims.sh` accepts the
  marker anywhere in the message, so a `Problems` line satisfies it.
- **Verify every file path / link you cite resolves** before putting it in a
  summary. A broken self-link undercuts the whole report.
- **A11y / visual claims must cite the REAL rendered surface — never a mock or a
  self-authored demo.** "Accessible" / "verified across both themes" is only
  true if the assertion ran against the actual component as it ships (a Storybook
  story in a browser, `test-storybook`, or the real app screen). A test that
  `vi.mock`s a `@elabs-ai/components-*` component and then asserts a11y attributes on the
  stand-in proves nothing about the real surface — the mock (e.g. a `<textarea>`
  that happens to honor `aria-label`) can **mask** a P0 a11y bug in the real
  component (the upstream#34/upstream#46 lesson). Likewise a cross-theme pass scoped to one
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

- **A new convention must ship with its enforcement, in the SAME change.** If a change
  introduces something that must be _registered_ somewhere, kept _fresh_, or universally
  _followed_, it ships with a generator (so the artifact is produced, not hand-kept)
  and/or a gate or hook (so a violation _fails_, not merely _warns in a doc_). A
  convention documented only in prose is incomplete.
- **A "must always hold" rule belongs in a check, not only a sentence.** When you find
  yourself writing "always do X" / "never do Y", ask whether it can be _checked_. If it
  can, wire the check — that is what makes the rule load-bearing. Prefer, in order: a
  deterministic **CI gate** (`scripts/*.mjs` + a `pnpm <x>:check`) → a **PostToolUse
  hook** (edit-time feedback) → a documented manual step (last resort).
- **Self-test every gate.** A gate that can silently stop firing is worse than none. Ship
  a `*.test.mjs` self-test (`node --test`) that plants a bad fixture and asserts the gate
  fails, wired as `pnpm <x>:check:test` in CI.
- **Nothing is published from a commit the battery has not passed**, and a blocking check
  that is **failing _or still pending_** blocks a merge — "the battery hasn't finished"
  and "the battery passed" are not the same state.

**The catalogue of what is actually wired — every gate, what it asserts, the incident
behind it, its ratchet baselines and its escape hatches — lives in
[`docs/GATES.md`](../../docs/GATES.md).** Read it when you add or change a gate, when one
fails and you need to know what it was defending, or when you need the exact command. It
is deliberately not loaded into every session: it describes machinery that announces
itself when it fires.

## Session cadence (review your own work — wired, not remembered)

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
    overwhelmingly the ones _declining_ it ("a `brand-ui-visual-ux-reviewer` cross-theme
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
