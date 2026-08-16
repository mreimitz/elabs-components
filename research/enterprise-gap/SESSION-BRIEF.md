# SESSION BRIEF — Enterprise breadth: finish & reconcile WP-05 + WP-13

> A self-contained handover for a fresh session. Status verified 2026-06-20.
> This is the **alternative to the plugin brief** (`../vibe-coder-plugin/SESSION-BRIEF.md`)
> — the strict-roadmap "Phase 2 features / Lane C — Core UI" path.

## ⚠️ Read this first: these WPs are ~90% already shipped

The epics (**WP-05 #62 hard widgets**, **WP-13 #70 consolidation + widgets + templates/icons**)
and their child issues are **open but the tracking is stale** — the components mostly exist on
`main`. This brief is therefore **"verify → close the done ones → finish the genuine tail → reconcile
the backlog,"** NOT "build two WPs from scratch." Verified present as of 2026-06-20:

- **WP-05:** `DataTable` has row virtualization (`useVirtualizer`) **and** a server-side model
  (`manualPagination`/`manualSorting`); `DateRangePicker`, `Tree`, `TreeSelect`, `Transfer`,
  `VirtualSelect` exist; `@qlik-coe-emea/qlabs-components-charts` shipped (CH-01).
- **WP-13:** `StatePanel` (#98), `AppSidebar` (#99), `MetricCard` (#100), and the net-new widgets
  `NumberInput`/`TagInput`/`FileUpload`/`Rating`/`ColorPicker`/`Descriptions`/`Wizard` (#101) all
  exist; 6 registry templates (`ai-assistant`, `dashboard`, `data-app`, `flow-workspace`,
  `marketing`, `settings`) + `@qlik-coe-emea/qlabs-components-icons` (#102) exist.

The same stale-tracking applies to WP-02/WP-03/WP-10 (gates + manifest `props`/intent + `context`
generator are all live). Treat open epic checkboxes as **unverified**, not as "to build."

## The actual work (in priority order)

### 1. Reconcile the backlog (do this FIRST — it's most of the "remaining" list)

For each open child of #62 and #70 (#98–#102 are filed; WP-05's are inline in the epic body):

- Verify the shipped component against the issue's acceptance criteria.
- If satisfied → **close with a verification comment** citing the file + a green test (the pattern
  used for #232/#233/#234 on 2026-06-20). Tick the epic checkbox.
- If partially satisfied → leave open, narrow the issue body to the genuine gap.

### 2. The genuine net-new tail

- **Gantt chart/timeline widget** (WP-13 #101, "heavy") — the one clearly-MISSING widget. Decide
  package (`@qlik-coe-emea/qlabs-components-charts` vs `@qlik-coe-emea/qlabs-components-data`) via `brand-ui-design-system-architect`; build with the
  full DoD (cva, tokens, story, smoke test, three-theme verification).
- **Registry template quality** — **#199** (templates have silent placeholders → annotate wiring
  points with structured TODOs) and **#200** (no full-page marketing/landing template — presales
  archetype has zero scaffold coverage). Both feed the plugin's scaffolding (VP-02), so they pay off
  twice.
- **DataTable "saved views"** — confirm whether the saved-views slice of WP-05/issue-01 is complete;
  finish + story it if not.
- **MetricCard description slot + retire the editor metric-block fork** (#100) — verify the fork is
  actually retired (ADR 0012 says `@qlik-coe-emea/qlabs-components-charts`/`@qlik-coe-emea/qlabs-components-editor` re-export the `@qlik-coe-emea/qlabs-components-ui` tile);
  close or finish.
- **Consolidation drift checks** (#99) — confirm there's one `AppSidebar` + shared nav primitives,
  no drifting copies.

### 3. Specs on disk

- `research/enterprise-gap/working-packages/WP-05-hard-widgets/epic.md` (issues inline)
- `research/enterprise-gap/working-packages/WP-13-component-consolidation/epic.md` + `issue-01..05`
- Component audit the WP-13 work acts on: `research/enterprise-gap/07-component-audit.md`

## Guardrails (repo rules — non-negotiable)

- **Maintainer component workflow:** `/new-component` (dedupe-gate first) → build to the component-API
  rules → `/review-component` + `brand-ui-accessibility-reviewer` → regenerate the manifest
  (`pnpm manifest`). New net-new widgets ride the **WP-10 gates** (auto-register + story + smoke test
  - three-theme).
- **Theme-safe = OBSERVED across the three themes** (qlik-bright, qlik-dark, blueprint), not inferred
  from token usage. (Note: the system was reduced from six to three themes on 2026-06-20.)
- **No raw colors** outside `themes.css`; semantic tokens only; motion-tokened animations.
- **One issue = one PR (`Closes #N`)** with a locking test; finders report / builders fix.
- **Reuse before create** — the audit's lesson is duplication; parameterize/merge, don't fork.

## First steps

1. Pull open children of #62 + #70; for each, `grep`/read the shipped component and decide
   close-as-done vs genuine-gap. Batch-close the done ones with evidence.
2. From the surviving real gaps, pick the highest-value net-new item (likely the registry template
   quality #199/#200, since it also unblocks the plugin) and build it to the DoD.
3. Scope `Gantt` with the architect before building (it's the only true greenfield widget here).

## Working-tree caveat

Branch off **clean `main`** (or a worktree). As of 2026-06-20 the tree may carry an in-flight
theme-removal change and a concurrent session's `apps/workbench` deletion — don't entangle this work
with those; route any `themes.css` token change through the agent-surface lane and regenerate
(never hand-merge) generated files.

## How this compares to the plugin brief (the recommended path)

The plugin (`../vibe-coder-plugin/SESSION-BRIEF.md`) is **greenfield and genuinely unstarted** — a
cleaner "large new WP." This enterprise-breadth path is **mostly reconciliation + a short net-new
tail**; its biggest external payoff (template quality #199/#200, Gantt) also feeds the plugin's
scaffolding. Pick this if you want to harden/close the library before building the exposure layer.
