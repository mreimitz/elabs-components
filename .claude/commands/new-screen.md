---
description: Design a net-new screen/page before scaffolding it — walk the design-first checklist (intent, references, distinct concepts, mocked concept, full state grid, non-component layers) so it doesn't ship as function-first "list + card" assembly
argument-hint: <app-or-package> <ScreenName> [one-line purpose]
allowed-tools: Read, Edit, Write, Grep, Glob, WebFetch, WebSearch, Bash(pnpm:*), mcp__storybook__*
---

You are designing a **net-new screen, page, or major surface** — not a single
component (use `/new-component` for that). Per @.claude/rules/design-first.md, this
retro (2026-06-11) found screens built function-first, visual design treated as an
afterthought, and components assembled because they exist ("list + card slop"). This
command makes the design pass a **required first step**: do not write app/route code
until Steps 1–6 are settled.

Inputs: `$ARGUMENTS` (the app/package the screen belongs in, a screen name, and
optionally a one-line purpose). If the purpose is missing, ask for it once. Do not
ask anything else you can infer from the repo.

## Step 1 — Intent, in one sentence (BLOCKING)

Who opens this screen, and what feeling/answer/decision do they leave with? Write
**one sentence**. "A directory of orders" is not an intent; "Tells ops which orders
need action today" is. If you can't write it yet, ask the user — don't guess and
move on.

## Step 2 — References, proactively (BLOCKING)

Look at **2–3 comparable products or comparable screens** FIRST (web access exists —
use it; don't wait for the user to paste a link). Name what each does that this
screen should match or beat.

## Step 3 — 2–3 distinct concepts, not one composition (BLOCKING)

Per @.claude/rules/conceptual-framing.md: generate **2–3 conceptually different**
approaches (e.g. "reading desk" vs "mission control" vs "guided wizard") — never
three parameter variations of a layout you already picked. Score each against the
Step 1 intent sentence, not against ease of building. State a recommendation and a
one-line rationale, then confirm it with the user before continuing.

## Step 4 — Mock the recommended concept before app code (BLOCKING)

Render the chosen concept as a Storybook story before wiring it into a real
route/page. If the Storybook dev server is running, preview it
(`mcp__storybook__preview-stories`) and confirm hierarchy/spacing read right — this
is far cheaper to redo as a story than as wired app code. See
@.claude/rules/storybook-mcp.md.

## Step 5 — Design the full state grid WITH the happy path (BLOCKING)

Every screen ships five states, designed together, never retrofitted: **Ready ·
Loading · Empty · Error · First-run**.

- Reference implementation: `packages/ui/src/templates-screen-states.stories.tsx`
  (already cites this same ritual); the `pnpm states:check` ratchet (#247) gives
  state-story coverage teeth — make sure the new screen's story is covered by it.
- Loading → a layout-shaped `Skeleton` (@.claude/rules/loading-states.md), never a
  spinner over blank space.
- Empty → `StatePanel kind="empty"` (icon + title + one sentence + one action),
  never a blank region or a dashed placeholder box.
- Error → `StatePanel kind="error"` (what happened + how to fix it), never a raw
  stack trace or a silently blank panel — errors are terminal-only, per
  @.claude/rules/loading-states.md.
- First-run → a purposeful onboarding moment, not the empty state relabeled.

## Step 6 — The non-component layers (BLOCKING)

Decide on purpose, out loud, for each — this is part of the design, not polish added
later:

- **Illustration** — does this moment (empty/first-run/success) deserve one, or is
  text enough? The illustration vocabulary itself is tracked separately by issue
  #210 — don't block this screen on it; use restraint until it lands.
- **Motion** — what state change must be _felt_ (a save landing, a row appearing)?
  Use the gated `duration-*`/`ease-*` utilities (or `--t-*`) and a `motion-reduce:`
  neutralizer — see `docs/MOTION_GUIDELINES.md`.
- **Voice/microcopy** — user-facing strings go through `t()` (ADR 0017,
  `pnpm microcopy:check`); is the copy fix-oriented and specific, never a generic
  "Something went wrong"?
- **Information hierarchy** — what reads first on the screen — is that actually the
  highest-value region for the task?

## Step 7 — Only now, scaffold

Component lists and API budgets are the **last** step, not the first (failure F4
from the 2026-06-11 retro — a brief that opens with "use Card, Badge, Table" instead
of the intent sentence gets you mechanics, not a designed screen). Once Steps 1–6
are settled:

1. Pick real components via `brand-ui docs` / `mcp__storybook__get-documentation` —
   never guess a prop.
2. Build the screen. If a genuinely new reusable component surfaces along the way,
   route it through `/new-component` (dedupe gate first) instead of inlining it.
3. Add or extend the state-grid story so `pnpm states:check` covers the new screen.
4. If the layout/anatomy repeats a second time anywhere in the app (a second
   banner, a second page scaffold, a second list-row shape) — per
   @.claude/rules/design-first.md "Patterns over instances" — stop and name the
   pattern (extend the library or a registry block) instead of a third local copy.

## Step 8 — Close with review, not a compile

A screen is not done at green typecheck (@.claude/rules/quality-gates.md). Before
calling it done:

- Run `/visual-review` (cross-theme screenshot + design critique) on the new
  screen.
- Run the `brand-ui-accessibility-reviewer` agent against the real rendered
  surface — never a mock standing in for it.
- If either surfaces a defect, route it through `/file-issue` — finders report,
  they don't fix (@.claude/rules/issue-workflow.md).

In your summary, name the chosen concept + why, list the states you designed, and
state plainly what you did **not** visually verify (compiled ≠ looked at) — per
@.claude/rules/quality-gates.md "Reporting completion honestly".
