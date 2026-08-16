# 14 · Example & scaffold coverage — gap analysis

**Date:** 2026-06-20 · **Lens:** _scaffold / vibe-coder start_ (what an end-user or the
new-app scaffolder copies first) · **Mode:** audit + first remediation pass.

> Companion to `03-gap-analysis.md` (component gaps) and `07-component-audit.md`. This doc
> is specifically about **example coverage** — the worked apps, shells, screen states and
> blocks an end-user learns from and copies — not about missing primitives.

---

## TL;DR

The **primitives are strong; the worked examples are thin.** Every state and structural
primitive an enterprise app needs already exists in `@qlik-coe-emea/qlabs-components-ui`
(`StatePanel`, `Skeleton`, `Spinner`, `SplitPanel`, `PageShell`, `SectionHeader`,
`Wizard`, `Command`, `Descriptions`, `Sheet`/`Drawer`, `Breadcrumb`, `ButtonGroup`). What
an end-user is missing is the **compositions that show how to assemble them into a
complete, on-baseline, fully-stated enterprise screen** — and a way to **install and
discover** those compositions.

A vibe-coder who opens Storybook today finds, for whole-screen guidance, **seven
single-variant `Patterns/Templates/*` happy-path stories and exactly one
`Patterns/Scenarios/*`**. They cannot copy a screen that (a) wires the mandatory baseline,
(b) shows the master-detail object hub — the most common enterprise screen, or (c) models
the empty/loading/error/first-run states that `design-first` requires. So they either
under-build (happy path only) or go off-rails (marketing slop in a pro surface). That is
the experience to stabilize.

---

## Method

Inventoried, against the `brand-ui-enterprise` baseline + the `design-first` state grid:

- **Stories** — 190 `*.stories.tsx` across 10 packages; story `title:` groups; per-story
  `export const` variant counts; state-named variants (`Empty`/`Loading`/`Error`/…).
- **Registry** — `registry/registry.json` item types and blocks.
- **Apps** — `apps/playground` demos, `apps/docs` story groups.
- **The baseline target** — `enterprise-app-baseline.md` (mandatory chrome), the two shell
  archetypes (A tool/workspace, B admin console), and the `design-first` state grid.

---

## What exists (the inventory)

| Layer                  | Present                                                                                                                                       | Count                         |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| **Whole-app examples** | `Patterns/Templates/*`: Dashboard, Data App, AI Assistant, Settings, Marketing, Flow Workspace · `Patterns/Scenarios/*`: Agentic AI Workspace | 7 templates + 1 scenario      |
| **Shells**             | `app-shell` (bare), `sidebar-02` (dashboard), `sidebar-04` (mail), `sidebar-05` (double) — all **archetype B**                                | 4 (B only)                    |
| **State primitives**   | `StatePanel` (empty/error/loading), `Skeleton`, `Spinner`, `LoadingState`/`ErrorState`/`EmptyState` (deprecated → `StatePanel`)               | full primitive set            |
| **Registry items**     | 1 `registry:ui`, 14 `registry:block`, 3 `registry:theme`                                                                                      | 18, **0 `registry:template`** |
| **Playground demos**   | dashboard, chat, editor, flow, marketing                                                                                                      | 5                             |

**State coverage across component stories:** Empty **19** · Loading **12** · Disabled
**11** · Error **5** · Overflow **2** · Skeleton **1** · **FirstRun 0**.

---

## The gaps, ranked for the scaffold-start lens

### G1 — The flagship shell example doesn't model the mandatory baseline · **impact: high · effort: S** ✅ _addressed this pass_

`Layout/App Shell/Basic` renders `AppShell` + `TopNav` + one button. It omits every piece
of the baseline the skill calls mandatory: collapsing Qlik app icon (lockup↔mark),
`ThemeSwitcher`, a Settings modal, the Sonner `Toaster`, and a right-side detail panel. A
builder copying the only "here's the shell" example starts **off-baseline** and bolts the
chrome on later (or never). **Build:** one baseline-complete archetype-B console scenario
that wires all of it in a single copy-start screen.

### G2 — No master-detail object detail hub · **impact: high · effort: M** ✅ _addressed this pass_

The single most common enterprise screen — a list that drives a rich detail hub (header +
attributes + tabbed sections + related lists + a focused task) — has **no example**.
`SplitPanel` exists as a primitive with a 2-variant story, but nothing shows the _screen_:
sticky `SectionHeader` identity, `ButtonGroup` toolbar, `Tabs` sections, `Descriptions`
attributes, a related-runs list, and a Run task promoted to its own `Dialog`. Without it,
builders stack detail _below_ the list or dump everything on one page — the exact
anti-patterns `screen-layout-patterns.md` warns against.

### G3 — Templates are happy-path only; no screen state grid · **impact: high · effort: M** ✅ _addressed this pass_

Every `Patterns/Templates/*` is a single `Default` variant. **FirstRun coverage is 0**
across all 190 stories; whole-screen loading/empty/error are never modeled even though the
primitives exist. `design-first` requires the state grid be designed _with_ the happy
path. A builder copying a template ships the happy path and learns the empty/error states
only when a user hits them in production. **Build:** one representative screen rendered
across Ready / Loading / Empty / Error / FirstRun.

### G4 — Archetype A (tool/workspace) is entirely unexampled · **impact: med-high · effort: L**

The skill defines two shells; only **B** exists in-repo. There is **no** tool/workspace
example (left navigator + right inspector + status bar + ⌘K palette + focus mode), and
**`StatusBar` does not exist as a component** — the skill had to ship its own under
`assets/tool-shell/`. Any builder making an editor/canvas/IDE-like surface (a common
brand-ui use case — `@qlik-coe-emea/qlabs-components-editor`, `@qlik-coe-emea/qlabs-components-flow`) has no on-brand starting point.
**Build:** a `StatusBar` primitive + an archetype-A `Tool Workspace` scenario (can reuse
`Command` for ⌘K and `SplitPanel`/inspector for the panes).

### G5 — Whole-app examples installable + discoverable · **impact: high · effort: M** ✅ _addressed this pass_

The audit's framing ("0 `registry:template` items") was half-right: the **installable-screen
mechanism in this repo is the `gen:templates` pipeline, not the shadcn registry.** The six
templates are story-source-of-truth → generated `docs/playbooks/templates/<name>.tsx` +
`index.json`, which `build-agent-kit` copies into the agent kit (so the scaffolder reads
them). The registry (`registry.json`) is for blocks/components/themes and skews to single
widgets. **Done:** the three new screens (G1/G2/G3) were authored as `templates-*` stories,
so the same pipeline now generates copy-installable consumer source for them and lists them
in `index.json` + the manifest — discoverable to both Storybook users and the scaffolder.

### G6 — No onboarding / auth / error-page / 404 scenarios · **impact: med · effort: M**

No sign-in, first-run onboarding, empty-workspace, 404 or 500 example anywhere. These are
the first screens a real app needs and the easiest to get wrong. G3 introduces the
first-run _state_; the standalone account/auth and not-found _pages_ remain open.

### G7 — Per-component state stories are uneven · **impact: med · effort: M (ongoing)**

High-traffic components ship a single happy-path story: `chat-shell`, `conversation`,
`tool`, `combobox`, `command`, `date-picker`, `drawer`, `dropdown-menu`, `accordion`,
`breadcrumb`, `calendar`. The component-API rule asks stories to exercise
default/loading/error/empty where they apply. This is a steady ratchet, not a one-shot
build — best tracked as a per-component checklist (a candidate `slop`/coverage gate).

### G8 — `apps/playground` lacks the enterprise-representative screens · **impact: low-med · effort: S**

The runnable Vite app demos dashboard/chat/editor/flow/marketing but not an admin console,
a data app, settings, a detail hub, or auth — so the one _runnable_ reference omits the
most enterprise-representative surfaces. Once G1–G3 exist as scenarios, wiring them into
the playground is cheap.

---

## What this pass scaffolded (G1–G3)

Three first-class **templates**, composed **only** from existing `@qlik-coe-emea/qlabs-components-ui` primitives
(no new components, no cross-package deps, semantic tokens only). They were reclassified
into the **`gen:templates` pipeline** (file `templates-<name>.stories.tsx`, title
`Patterns/Templates/*`) so they are **copy-installable** and ride into the agent kit — the
repo's real installable-screen mechanism, the same one the existing six templates use.
There is no separate `registry:template`; the pipeline derives the consumer source +
`index.json` + manifest entry. (So G5 is closed _by this pass_, not just G1–G3.)

| #   | Gaps | Source story → generated consumer                                                                            | Title                                         | Demonstrates                                                                                                                                                                                                                                                                                    |
| --- | ---- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | G1   | `packages/ui/src/templates-admin-console.stories.tsx` → `docs/playbooks/templates/admin-console.tsx`         | `Patterns/Templates/Enterprise Admin Console` | Full mandatory baseline: collapsing `BrandLogo` lockup↔mark · sidebar + `Breadcrumb` · `ThemeSwitcher` (System/Bright/Dark) · Settings `Dialog` (Appearance) · `Toaster` · right `Sheet` detail panel. Stories: `Default`, `CollapsedNav`.                                                      |
| 2   | G2   | `packages/ui/src/templates-object-detail-hub.stories.tsx` → `docs/playbooks/templates/object-detail-hub.tsx` | `Patterns/Templates/Object Detail Hub`        | `SplitPanel` master-detail · sticky `SectionHeader` + status · `ButtonGroup` toolbar · `Tabs` (Overview/Activity/Settings) · `Descriptions` attributes · related-runs list with `StatusBadge` · Run task in a `Dialog` · `StatePanel` empty on no-selection. Stories: `Default`, `NoSelection`. |
| 3   | G3   | `packages/ui/src/templates-screen-states.stories.tsx` → `docs/playbooks/templates/screen-states.tsx`         | `Patterns/Templates/Screen States`            | One screen across the full state grid — `Ready` (Table) · `Loading` (Skeleton) · `Empty` (`StatePanel kind="empty"`) · `Error` (`StatePanel kind="error"` + retry) · `FirstRun` (onboarding empty + CTA).                                                                                       |

**Verification status (honest):**

- ✅ `tsc --noEmit` — **0 errors** across the whole `@qlik-coe-emea/qlabs-components-ui` package (incl. the 3 files).
- ✅ `eslint` — **clean** (exit 0) on all three; **no raw colors** (token boundary holds).
- ✅ `gen:templates --check` — **fresh**: the generated consumer source is byte-identical to
  what `pnpm gen:templates` produces, so CI `templates:check` will pass. `index.json` now
  lists all 9 templates; `brand-ui.manifest.json` regenerated (+3 templates, otherwise
  unchanged).
- ⚠️ **NOT visually verified.** Storybook could not be rendered in this environment, so the
  three-theme visual sweep (qlik-bright / qlik-dark / blueprint) and the `run-story-tests`
  interaction + axe a11y pass were **not** run. Per `quality-gates.md` a token-only screen
  is a _candidate_, not "theme-safe verified," until it has been looked at. **Next step on a
  Mac:** `pnpm storybook`, sweep the three `Patterns/Templates/*` titles in each theme, and
  run `pnpm --filter @qlik-coe-emea/qlabs-components-docs test-storybook`. (The generated `docs/playbooks/templates`
  consumer files were not type-checked in isolation — they are not part of a tsconfig, same
  as the existing six.)

---

## Recommended backlog (remaining, ranked)

1. **G4 — `StatusBar` primitive + archetype-A `Tool Workspace` template** → filed **#245**
   (P1). Unblocks every editor/canvas builder; closes the only missing shell archetype.
2. **G6 — auth / 404 / 500 / empty-workspace page templates** → filed **#246** (P2).
3. **G7 — per-component state-story ratchet** (coverage gate, sibling to `slop:check`) →
   filed **#247** (P2).
4. **G8 — wire the new templates into `apps/playground`** → filed **#248** (P2).

_(G5 closed this pass — the three screens are now installable templates.)_

All four remaining gaps are now tracked as GitHub issues (**#245–#248**), each with an
implementation-ready body (RCA + proposed solution + affected files + acceptance criteria +
test-to-add) following `.github/ISSUE_TEMPLATE/agent-finding.md`. This doc is the finding;
the issues carry the fixes.
