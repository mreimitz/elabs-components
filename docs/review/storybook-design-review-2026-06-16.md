# @qlik-coe-emea/qlabs-components-\* Storybook design + a11y + QA review

**Date:** 2026-06-16 · **Scope:** the running Storybook at `localhost:6006` · **Method:** parallel subagents drove a real browser (agent-browser, isolated sessions), opened each story's iframe, interacted as an end user (click/type/open/keyboard), read the console, inspected the a11y tree, and sampled the dark / high-contrast / blueprint themes. Rubric: the design-taste skill (AI-tells, interaction states, taste) + the repo's own a11y/token/interaction rules.

## Coverage

718 entries (559 stories + 159 docs) across 23 sections / 186 components. Every section and component type was reviewed. The earlier gap (Overlays slice indices 7–13) is now **closed** — see "## Overlays (variant stories, indices 7–13)" at the end of this report; it turned out to be the 4 `Default` stories HoverCard / Popover / Sheet / Tooltip (Overlays has only 11 stories total, not ~7 extra variants). Every Overlays component **type** (Dialog, AlertDialog, Drawer, Sheet, Popover, Tooltip, HoverCard, Command, ContextMenu, DropdownMenu) was reviewed deeply. Docs autodoc pages were skimmed, not interacted.

## Verdict

Solid, mature library. Token/theme discipline is strong, most interactive components have correct Radix-backed keyboard + focus behavior, and zero console errors in the large majority of stories. The findings cluster into **a few systemic patterns** rather than one-off bugs — fixing the ~10 cross-cutting items below resolves the bulk of the report. Four stories are hard-broken (crash / no-op). Your recent editor/dialog/iteration/calc work was verified working in the browser (one story-level test bug noted).

---

## P0 — Broken (fix first)

1. **`forms-taginput--with-validation` crashes** — Storybook render error overlay; story unviewable. (Also note `aria-invalid` does get set before the crash.)
2. **`feedback-toast-sonner--default` is a no-op** — clicking "Show toast" produces zero DOM change; the Sonner `<section aria-live>` stays empty; no console error. Toaster/global-state likely not initialized in the isolated iframe. The story is dead.
3. **`templates-data-app--default` crashes** — `Error: Too many re-renders` in `ForwardRef(DataTableInner)`; Storybook error boundary; story cannot render at all.
4. **`navigation-wizard--with-validation-gating` crashes on Next** — `useState` is called inside the Story's `render:` method (hooks-in-non-component), suppressed with an eslint-disable; clicking Next (unchecked) throws and unmounts. Fix: extract `const Story = () => {…}` and `render: () => <Story/>`.

**Functionally broken (P1, but effectively unusable):**

5. **`ai-context--default`** — the "Model context usage" button is a stub: clicking opens nothing, `data-state` never changes, no portal, no `aria-haspopup`/`aria-expanded`.
6. **`charts-chartcard--*` bars render at zero height in every story** — the div-based mini bar chart never shows bars (only x-axis labels); parent height doesn't resolve. Affects default, with-actions, tall-height, title-only.
7. **`navigation-tree--lazy-loading` Retry is `disabled`** — after a child-load error, the only recovery button is disabled; the user cannot retry without reloading.

---

## Cross-cutting patterns (the high-leverage P1 fixes)

These repeat across many components; each is one fix applied broadly.

**A. Standalone form/widget controls lack an accessible name.** Systematic across Forms + others: `Select`, `Combobox`, `Slider`, `NumberInput`, `InputOTP`, `InputGroup` (search), `RadioGroup` (group), `TagInput` (group+input), `ToggleGroup` (group), `TreeSelect`, `VirtualSelect`, plus `Command` input, `Popover` content, `Tree` root (`role="tree"`), `Menubar`. Two-pronged fix: surface/﻿document an `aria-label` prop on each, and have the stories model a real `<label>`. (`ButtonGroup` additionally lacks `aria-pressed` on its toggles.)

**B. Navigation lacks `<nav>` landmarks and `aria-current`.** No `<nav>` wrapper and no `aria-current="page"` on the active item across `AppShell` (Dashboard/Mail/Double-Sided), `AppSidebar`, `Sidebar`, `TopNav`, `NavigationMenu`, and every Template/Scenario sidebar. Collapsed icon sidebars (`layout-app-shell-dashboard-sidebar-02--default`) strip the label text entirely, leaving nav buttons with empty accessible names. No skip-to-main link in any full-page template/scenario.

**C. Streaming / dynamic AI content has no live region.** `ai-shimmer--default`, `ai-message--presets` (streaming text), `ai-agenttimeline--default` (status changes), `ai-changereview--default` (approval counter), `ai-chat--default` (`role="log"` unlabeled) — state changes are silent to screen readers. Add `role="status"`/`aria-live` and name the log.

**D. Color-only encoding in low-chroma themes (WCAG 1.4.1).** `charts-candlestickchart--default` (bull/bear, HC), `flow-legend--full-pipeline` + `flow-canvasshell--pipeline` (Source & Output both green in qlik-bright; all hue-only in HC), `ai-changereview--default` diff markers (HC), `ai-test-results--default` progress bar. Needs shape/pattern/text alternatives. (Related: the calc B1 follow-on below.)

**E. Missing `motion-reduce:` neutralizers.** All States components animate unconditionally: `animate-spin` (LoadingState), `animate-pulse` (Skeleton), `animate-in` (Empty/Error/Loading). Add `motion-reduce:` per the repo motion rule.

**F. EmptyState anatomy not met.** `data-datatable--empty` (bare `<td>` text), `states-emptystate--default` (no illustration slot — dashed box only), `states-statepanel--empty-no-icon` (no action). The repo's own anatomy (illustration + title + one sentence + one action) isn't honored.

**G. Tables missing `<th scope>`.** Every `DataTable` story and `data-table--default` omit `scope="col"` (WCAG 1.3.1 / H63). `ColumnPicker` + `FacetFilter` items use `role="menuitem"` instead of `role="menuitemcheckbox"` with `aria-checked` (toggle state invisible to AT).

**H. `div`/`span` used as interactive controls.** `ai-task--default` collapse header (`div` + onclick, no role/keyboard), `ai-inline-citation--default` (`span tabindex=-1` + onclick — unreachable), `marketing-usecasecard--default` (card `div` cursor-pointer + "Learn more" `div`), `ai-chat-shell--default` context items (`div tabindex=-1`). Use real `<button>`/`<a>`.

**I. Blueprint theme token gap.** `--destructive` resolves to near-white (`oklch(0.98 0.01 240)`) in blueprint, so `states-errorstate--default` loses its error badge/icon/tint entirely (only the accent rail survives). A token-value fix in `themes.css` blueprint block. (`Resizable` handle is also near-invisible in qlik-dark/blueprint.)

**J. `alertdialog` dismisses on Escape.** `overlays-alertdialog--default` closes on Esc; per ARIA an alertdialog must require an explicit choice (`onEscapeKeyDown` preventDefault). Focus trap/return are otherwise correct.

**K. Overlay polish (non-modal dialogs).** `Popover` + `Sheet` lack `aria-modal`; `Popover` has no accessible name; `Tooltip` visible div lacks `role="tooltip"` (only a hidden span carries it, with duplicated text); `Drawer` default story has no focusable content and focus doesn't enter on open; `ContextMenu` drops focus to `<body>` on Esc (trigger `<span>` not focusable).

---

## Notable per-section highlights (condensed)

- **Charts:** BarChart horizontal has no Y-axis category labels (`charts-barchart--horizontal`); MetricCard delta is color+arrow only, no text alternative; AutoChart tooltip labels lowercase vs title-case legend; several empty/error states are plain text not branded `EmptyState`/`ErrorState`; Sparkline empty state invisible.
- **Editor (your recent work — verified):** fill-container ✓, code-block Tab-exit ✓, editable-table (controls + Tab) ✓, slash menu (scroll/keyboard) ✓, iteration builder pivot-with-calc preview resolves ✓, DialogContent OverflowGuard regression holds ✓. **Bug:** `editor-markdowntoolbar--insert-parity` `play` throws on load (`findByRole("menuitem",{name:"Calc"})` matches a closed-menu prerendered item) — fails the test gate. **B1 follow-on:** in high-contrast `--calc-number` and `--calc-var-def` both resolve to weight-700 (collide), and `--calc-result` stays hued; read-only editor missing `aria-readonly`; iteration resize splitter missing `aria-label`; `mermaiddiagram--invalid-source` renders a broken graph instead of an error state.
- **Forms:** date/range pickers don't auto-close after selection; `Form` email field is `type="text"`; `Form` validation error has no `role="alert"` (only readable on re-focus); `VirtualSelect` "Empty" story is mislabeled (starts with 14 options) and its no-results message sits outside the `listbox`.
- **Foundation:** outline-subtle & ghost button borders invisible in high-contrast; `Input/Invalid` story sets `aria-invalid` but has no linked error (`aria-describedby`); StatusBadge running/complete contrast risk in HC; LinkPreviewCard loading lacks `role="status"`.
- **Marketing/Templates (taste):** `LogoStrip` uses Jane-Doe brand names (Acme/Globex/Initech/Umbrella/Wayne); Hero CTAs are `<button>` not `<a>`; Dashboard chart area renders literal developer placeholder text; templates show "Alex Johnson/alex@example.com/Acme" filler; FeatureGrid four-columns leaves 2 orphan cells; CTASection ghost button low-contrast in dark.
- **Flow:** node selection produces no visible change in `flow-canvasshell--pipeline`; node accessible names concatenate without separators ("SourcePostgresorders"); **Blueprint stories hard-code `data-theme="blueprint"` on `<html>`**, so the Storybook theme toolbar has no effect on them.
- **Data/Display:** Carousel region unnamed + no `aria-live` on slide change; Progress/`progressbar` and Avatar root unnamed; RevisionTimeline list unnamed. DataTable sort/filter/column-pick/virtualize/saved-view all work well.
- **AI:** AssetPreview Preview/Raw toggle lacks tab semantics; FileTree folder chevron unlabeled; Snippet readonly input unlabeled + copy success not announced; CodeBlock paints raw Shiki rgb() inline (outside token discipline) and shows no copy button; Suggestion chips have no hover state.
- **Navigation:** Wizard completed-step button loses its name (Check icon only) and `aria-current="step"` sits on `<li>` not `<button>`; Pagination page numbers are 36×36px (below 44px target) and unlabeled; Menubar/NavigationMenu single-item stories under-exercise the component; NavigationMenu sub-links have `href={null}`.
- **Blueprint/Icons:** clean and well-built (Icon decorative/titled a11y correct, BrandLogo adapts to themes, decoration dial correct). Main note is the hard-coded-theme story issue above.

---

## Recommended issues to file (grouping ~40 findings into ~11 tickets)

1. **P0 bucket** — 4 broken stories (TagInput validation crash, Toast no-op, Data-App re-render crash, Wizard hooks-in-render crash).
2. **a11y: accessible names for standalone controls** (pattern A) — one epic across Forms + Command/Popover/Tree/Menubar.
3. **a11y: nav landmarks + `aria-current` + skip-link** (pattern B) — AppShell/Sidebar/TopNav/templates/scenarios.
4. **a11y: live regions for AI streaming/status** (pattern C).
5. **a11y: color-only encoding in HC/blueprint** (pattern D) — charts + flow + changereview + test-results (+ calc follow-on).
6. **a11y: `motion-reduce` on States animations** (pattern E).
7. **EmptyState anatomy** (pattern F) — DataTable empty, EmptyState illustration slot, StatePanel no-action.
8. **Tables: `<th scope>` + `menuitemcheckbox`** (pattern G).
9. **div-as-control** (pattern H) — Task/InlineCitation/UseCaseCard/Chat-Shell.
10. **Blueprint `--destructive` token + Blueprint stories hard-coding `data-theme`** (pattern I + Flow/Blueprint story wiring).
11. **Overlays polish** (patterns J+K) — alertdialog Esc, aria-modal, Drawer focusable content, ContextMenu focus return, Popover name.

Plus a small **"my recent work" cleanup**: fix the `markdowntoolbar--insert-parity` story `play`, the calc HC number/var-def weight collision, and read-only editor `aria-readonly`.

---

## Overlays (variant stories, indices 7–13)

_Closes the one gap in the coverage above._ The `Overlays/` section has **11 stories total** (one `Default` per component type — there were never ~7 extra "variant" stories), so sorted-slice `[7:14]` resolves to just **4** stories: `overlays-hovercard--default`, `overlays-popover--default`, `overlays-sheet--default`, `overlays-tooltip--default`. All four were driven in a real browser as an end user (open via hover/click, keyboard focus, Esc, focus-return, scrim/scroll-lock); console was read on each (**zero errors across all four**). These four refine — and in two places **correct** — the type-level pattern J/K items above.

**HoverCard — `overlays-hovercard--default`** · preview card shown over a trigger.

- Verified working: opens on pointer hover **and** on keyboard focus (Radix default); content ("The brand-ui design system.") renders; no console errors.
- The content div carries no `role`/accessible name — this is **correct** for Radix HoverCard (a sighted-user affordance, intentionally not exposed as a named region), not a defect. No action.

**Popover — `overlays-popover--default`** · non-modal popover dialog anchored to a trigger.

- Verified working: opens to `role="dialog"` `data-state="open"`; focus moves **into** the content on open; **Esc closes**; **focus returns to the trigger**; `aria-expanded` toggles `true`→`false`.
- **[P2] `role="dialog"` has no accessible name** — no `aria-label` / `aria-labelledby` on the content (axe `aria-dialog-name`, serious). Confirms pattern K's "Popover has no accessible name." Fix: name the content (e.g. a visually-hidden title or `aria-label`).
- **Correction to pattern K:** the popover has **no `aria-modal`, and that is correct** — it is intentionally non-modal (focus not trapped, outside interaction allowed), so `aria-modal="true"` would be a false claim. Drop "Popover lacks `aria-modal`" from the K fix list; the only real Popover gap is the missing name.
- Minor: the `Default` story renders with the popover already open (`defaultOpen`) — harmless, but an opens-on-click default would exercise the trigger affordance better.

**Sheet — `overlays-sheet--default`** · modal slide-in panel ("Settings").

- Verified working: `role="dialog"`, **named** via `aria-labelledby`→"Settings" and **described** via `aria-describedby`→"Manage your workspace."; scrim present; **body scroll-locked** (`overflow:hidden`) on open and **restored** on close; focus moves to the **Close** button (`aria-label="Close"`); **Esc closes**; **focus returns to the trigger**. Strong overall.
- **[P2] No `aria-modal="true"` on the dialog, though it behaves fully modally** (scrim + scroll-lock + focus trap). Screen-reader users aren't told they're in a modal context. This is the case pattern K flags for Sheet — and unlike Popover it is a **real** gap here because the Sheet genuinely is modal. Fix: ensure the underlying Radix `Dialog.Content` runs in modal mode (or set `aria-modal`).
- **[P3] Scrim/content `overscroll-behavior` is `auto`, not `contain`** — the repo's own interaction rule wants `overscroll-behavior: contain` on Dialog/Drawer/Sheet to stop scroll-chaining to the page. Body scroll-lock largely mitigates, so this is polish.

**Tooltip — `overlays-tooltip--default`** · hover/focus tooltip.

- Verified working: opens on hover **and** on keyboard focus; the `role="tooltip"` announcement span is properly **sr-only** (`position:absolute; 1px×1px; clip:rect(0,0,0,0); overflow:hidden`); on focus the trigger gets **`aria-describedby`→"Helpful context"**; **Esc dismisses** the tooltip (WCAG 1.4.13). No console errors.
- **Correction to pattern K:** the "visible div lacks `role="tooltip"`; only a hidden span carries it, with duplicated text" is the **idiomatic Radix Tooltip pattern and tests as accessible** — the visible text serves sighted users while the sr-only span + `aria-describedby` conveys it to AT; the "duplication" exists only in `textContent`/the a11y layer, **not** visually. Recommend **not** filing this as a defect.

**Clean (no issues):** `overlays-hovercard--default`, `overlays-tooltip--default`. **Actionable in this slice:** Popover unnamed dialog **[P2]**; Sheet missing `aria-modal` **[P2]** + `overscroll-behavior:contain` **[P3]**. **Net correction:** pattern K should drop the Popover-`aria-modal` and Tooltip-`role` items (both correct as built); the durable Overlays a11y asks are the Popover accessible-name and the Sheet `aria-modal`.
