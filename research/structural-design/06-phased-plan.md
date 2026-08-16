# 06 · Phased plan — the consolidated, build-ready sequence

The single actionable plan, reconciled with the five integration docs
([07](07-type-system-integration.md) type · [08](08-separation-surface-system.md)
surface · [09](09-context-panel-integration.md) ContextPanel ·
[10](10-execution-trace-grammar.md) traces · [11](11-message-approval-grammar.md)
message/approval/evidence/KPI). Each item names its package, the doc that resolved it,
and the finding it closes. **Nothing is built until it's filed as an issue**
(`/file-issue` → `brand-ui-root-cause-analyst`); structural / public-API items route
through `brand-ui-design-system-architect`; any `themes.css` value edit needs a
`brand-ui-visual-ux-reviewer` six-theme sweep before merge.

> This supersedes the pre-refinement draft. The refinements changed several decisions
> the old draft listed — most notably: **no `-subtle` status tokens** (08 uses the
> `/10` wash), **native Tailwind `--text-*` not `@utility`** (07), **a CSS `translateX`
> drill-in not `AnimatePresence`** (09), and the **`@qlik-coe-emea/qlabs-components-ui` extractions are firm, not
> "long-term maybe"** (the pattern below).

---

## The dependency DAG (why this order)

```
Phase 0  @qlik-coe-emea/qlabs-components-tokens         type scale · --font-mono/-display · --chat-user revalue · rules+gates
            │  (no new -subtle / separation / trace tokens — 08/10 use existing washes + the /10 convention)
            ▼
Phase 1  @qlik-coe-emea/qlabs-components-ui leaves      Text/Heading · StatusBadge · useCollapsiblePanel(+re-point Sidebar)
            │                  · Timeline(MOVED from editor) · outline-subtle · Alert role-override
            │                  · re-point CardTitle/Section/Dialog/MetricCard to roles · MetricCard emphasis
            │                  · prose primitives promoted editor→ui
            ▼
Phase 2  @qlik-coe-emea/qlabs-components-charts         MetricGrid featured/colSpan
            ▼
Phase 3  @qlik-coe-emea/qlabs-components-ai grammar     Message internals + UserMessage/AgentMessage · ApprovalCard · EvidenceChip/SourceList
            │                  · AgentTimeline/AgentStep · ToolResultCard · Tool disclosure · Suggestion pill · CommandComposer
            │                  · markdown renderer + ProducedAssetTree + AssetPreview · ContextPanel(+drill-in)
            │                  + flow InspectorPanel converges onto the shared base
            ▼
Phase 4  scenario re-wire      the story SHRINKS to composition (+ optional registry block)
```

Dependencies point downward. You cannot calmly build the grammar on top of
`text-sm`-everywhere, a border-only channel, and five status idioms — so the
tokens + the `@qlik-coe-emea/qlabs-components-ui` leaves land first.

---

## The "extract a leaf to `@qlik-coe-emea/qlabs-components-ui`" pattern (named — it recurs FOUR times)

The refinements surfaced one structural move so often it's now a confirmed pattern, not
a one-off: **when a primitive is needed by two sibling packages (which can't import each
other), extract it to the shared upstream `@qlik-coe-emea/qlabs-components-ui`, re-point the original consumer
byte-identically, and ship a fork-prevention gate.** The four instances:

| Leaf                                    | From → to                                                                       | Re-pointed consumer                                             | Gate                      | Doc                                   |
| --------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------- | ------------------------------------- |
| **prose primitives** (`Heading`/`Text`) | `@qlik-coe-emea/qlabs-components-editor` → `@qlik-coe-emea/qlabs-components-ui` | editor `prose` + `markdown-scale` derive                        | `text-scale:check`        | [07](07-type-system-integration.md)   |
| **`useCollapsiblePanel`**               | (new, from Sidebar's mechanism) `@qlik-coe-emea/qlabs-components-ui`            | `Sidebar` re-pointed byte-identical                             | `check-collapse-fork.mjs` | [09](09-context-panel-integration.md) |
| **`Timeline`**                          | `@qlik-coe-emea/qlabs-components-editor` → `@qlik-coe-emea/qlabs-components-ui` | editor `markdown/index.ts` re-exports                           | `check-timeline-fork.mjs` | [10](10-execution-trace-grammar.md)   |
| **`StatusBadge`**                       | (new, on the existing `Badge` cva) `@qlik-coe-emea/qlabs-components-ui`         | `Tool`/`ChainOfThought`/`Confirmation`/`test-results`/`sandbox` | `palette:check`           | [10](10-execution-trace-grammar.md)   |

Each is architect-gated and each ships its gate so a fifth fork can't appear. This is the
ADR-0012 `MetricCard` model generalized.

---

## Phase 0 — `@qlik-coe-emea/qlabs-components-tokens` (the systemic backbone) · highest leverage, lowest surface

| #   | Item                                                                                                                                                                                                                                                      | Doc                                                                        | Closes        | Gate                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------- | --------------------------------------- |
| 0.1 | **Type scale**: 8 role tokens (`display/title/subtitle/body/caption/meta/kpi/code`) via a plain `@theme` block + native `--text-<role>--{line-height,font-weight,letter-spacing}` companion keys (**no `@utility`**); `--text-body == text-sm` (identity) | [07](07-type-system-integration.md)                                        | TYPE-1/2      | typecheck; **visual-ux sweep**          |
| 0.2 | `--font-mono` + `--font-display` in `:root` (both identity-default); add to the theme-parity allowlist                                                                                                                                                    | [07](07-type-system-integration.md)                                        | TYPE-5        | `theme-parity`; sweep                   |
| 0.3 | Revalue `--chat-user` in **qlik-bright (`oklch(0.94 0.035 252)`) + qlik-dark (`oklch(0.34 0.05 252)`) ONLY** (the other four are already distinct)                                                                                                        | [08](08-separation-surface-system.md)/[11](11-message-approval-grammar.md) | MSG-1         | **visual-ux sweep** + `themes-contrast` |
| 0.4 | **NO new tokens.** Document the surface convention: the `bg-<status>/10` wash (status zones), `border-s-<role>` (accent rail), the `surface → surface-muted → surface-elevated + shadow-sm` elevation ladder                                              | [08](08-separation-surface-system.md)                                      | TYPE-6, BTN-4 | (docs only)                             |
| 0.5 | Rules + gates: `styling-and-tokens.md` **Typography** + **Surface separation** sections; `text-scale:check` ratchet; `check-separation.mjs`                                                                                                               | [07](07-type-system-integration.md)/[08](08-separation-surface-system.md)  | governance    | gate self-tests                         |

> **The biggest correction vs the old draft:** Phase 0 adds **zero** `-subtle` tokens and
> zero separation/rail/elevation tokens — 08 proved the existing `/10` wash + role-color
> rails + the surface ladder cover it, and the wash composes with the decoration overlay
> for free. The only token-VALUE edit is `--chat-user` in two themes.

---

## Phase 1 — `@qlik-coe-emea/qlabs-components-ui` leaves · architect-gated (the foundation)

| #   | Item                                                                                                                                                                                                                                                                                                | Doc                                                                | Closes             | Note                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------ | ------------------------------------------------------------------------- |
| 1.1 | `Text` + `Heading` primitives (variants → role tokens; `cva`+`forwardRef`+`asChild`)                                                                                                                                                                                                                | [07](07-type-system-integration.md)                                | TYPE-7             | the agent-legible scale surface                                           |
| 1.2 | **Promote prose primitives** `@qlik-coe-emea/qlabs-components-editor` → `@qlik-coe-emea/qlabs-components-ui`; editor `prose` + `markdown-scale.ts` derive from the roles                                                                                                                            | [07](07-type-system-integration.md)                                | ASSET-3, TYPE-4    | unblocks the `@qlik-coe-emea/qlabs-components-ai` markdown renderer (3.x) |
| 1.3 | `StatusBadge` — 7-state canonical enum (`pending/running/complete/awaiting-approval/denied/failed/skipped`) on the existing `Badge` cva; **hybrid visual** (the `/10` wash for calm incl. `complete`; solid fill only for `awaiting-approval`+`failed`); typed `fromToolState`/`fromTimelineStatus` | [10](10-execution-trace-grammar.md)                                | TRACE-5, APPROVE-4 | **also fixes the raw-`-600` bug**                                         |
| 1.4 | `useCollapsiblePanel` extracted from Sidebar's mechanism; **re-point Sidebar byte-identically**                                                                                                                                                                                                     | [09](09-context-panel-integration.md)                              | PANEL-1/4          | gated by Sidebar story-tests + a visual diff                              |
| 1.5 | **Move `Timeline`** `@qlik-coe-emea/qlabs-components-editor` → `@qlik-coe-emea/qlabs-components-ui` byte-identical + add compound `TimelineRoot`/`TimelineItem`; editor `markdown/index.ts` re-exports                                                                                              | [10](10-execution-trace-grammar.md)                                | TRACE-1/6          | array API unchanged; node takes canonical `Status`                        |
| 1.6 | `outline-subtle` Button variant (`border-border`, not `border-input`)                                                                                                                                                                                                                               | [02](02-systemic-backbone.md)                                      | BTN-1              | real inputs stay on `border-input`                                        |
| 1.7 | `Alert` accepts a `role` override (default `"alert"`)                                                                                                                                                                                                                                               | [11](11-message-approval-grammar.md)                               | APPROVE-3          | so `ApprovalCard` can be `role="group"`                                   |
| 1.8 | Re-point `CardTitle`/`SectionHeader`/`DialogTitle`/`MetricCard` value to role tokens                                                                                                                                                                                                                | [07](07-type-system-integration.md)                                | TYPE-3/4           | ~6 one-line edits fix the whole library                                   |
| 1.9 | `MetricCard` `cva emphasis: default/headline` axis + optional `evidence` footer slot                                                                                                                                                                                                                | [11](11-message-approval-grammar.md)/[03](03-component-grammar.md) | KPI-1/3            | size/weight only (KPI-5: no hue)                                          |

**Gates that ship in this phase** (the fork-preventers + the palette check):
`check-collapse-fork.mjs` (1.4), `check-timeline-fork.mjs` (1.5), `palette:check` + extend
the boundary hook to catch raw Tailwind palette (1.3), `check-vendored-leftovers.mjs` (for
`is-user:dark`-class drift), and **wire `react/jsx-no-target-blank`** into
`packages/eslint-config/react.js` (currently unwired — the `noopener` gap, [11](11-message-approval-grammar.md) §F).

---

## Phase 2 — `@qlik-coe-emea/qlabs-components-charts`

| #   | Item                                                                     | Doc                                  | Closes |
| --- | ------------------------------------------------------------------------ | ------------------------------------ | ------ |
| 2.1 | `MetricGrid` `featured`/`colSpan` axis (so one headline KPI spans wider) | [11](11-message-approval-grammar.md) | KPI-2  |

> Ownership correction (from [11](11-message-approval-grammar.md)): `MetricCard` is
> `@qlik-coe-emea/qlabs-components-ui` (the `emphasis` axis, 1.9) but `MetricGrid` is `@qlik-coe-emea/qlabs-components-charts`. They compose
> across the legal `charts → ui` edge: `<MetricGrid featured={0}>` spans the first child,
> which is `<MetricCard emphasis="headline">`.

---

## Phase 3 — `@qlik-coe-emea/qlabs-components-ai` grammar (depends on Phase 1 leaves)

_Each built to the gates (`/review-component` + `brand-ui-accessibility-reviewer`),
storied, six-theme-verified. As each container is touched, apply the **border-noise pass**
(BTN-4): drop `border` where a fill/rail/elevation/gap already separates the region — the
redundant-boundary test, with the caveat that a border redundant on light but sole-cue in
blueprint is KEPT (08 §G.5)._

**3a · Message + approval + evidence + KPI** ([11](11-message-approval-grammar.md), lightest):

| #    | Item                                                                                                                                                                                                                                                                                 | Closes        |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| 3a.1 | `Message` internals: wire `bg-chat-user`, drop `is-user:dark`, `text-sm`→`text-body`; `MessageResponse` prose scale; `MessageHeader`/`MessageAvatar` slot                                                                                                                            | MSG-1/2/3/5   |
| 3a.2 | `UserMessage`/`AgentMessage` thin preset wrappers; `AgentMessage emphasis="answer"` = the green rail (a `cva` visual axis; KPI/prose/footer are composed children)                                                                                                                   | MSG-2/4       |
| 3a.3 | `Confirmation`→`ApprovalCard`: pending `warning` wash + `border-s-4 border-s-border-strong shadow-sm`; 3 zones (title up-scale + `ConfirmationDescription` + `border-strong` action band); role-named `Approve`(green)/`Deny`(ghost); `StatusBadge` resolved; `role="group"` pending | APPROVE-1/2/3 |
| 3a.4 | `EvidenceChip` (re-skin the `InlineCitation` trigger → green wash); `SourceList` (structure `Sources`) + the `noopener` fix on `Source`                                                                                                                                              | MSG-4, KPI-3  |
| 3a.5 | `Checkpoint` reads as a control (lighter than the approval — local polish)                                                                                                                                                                                                           | APPROVE-5     |

**3b · Execution traces** ([10](10-execution-trace-grammar.md)):

| #    | Item                                                                                                                                                                                | Closes      |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 3b.1 | `AgentTimeline`/`AgentStep` on the moved `Timeline` + `StatusBadge`; converge `ChainOfThought` + `Task` steps + inspect-only `Tool` (keep `Plan`/`Checkpoint`/`Reasoning` distinct) | TRACE-1/6/7 |
| 3b.2 | `Tool`: `ToolHeader.summary` + a default-collapsed `ToolDetails` (JSON-behind-disclosure as the package default)                                                                    | TRACE-2     |
| 3b.3 | `ToolResultCard` (separate component; elevation channel; hosts a chart/table/file as `children`; no charts/data import)                                                             | TRACE-3     |
| 3b.4 | Re-point `test-results`/`sandbox`/`Confirmation` status to `StatusBadge`; `Task.defaultOpen` `true`→`false`, drop `SearchIcon`+pills                                                | TRACE-4/5/7 |

**3c · Buttons + composer** ([02](02-systemic-backbone.md)):

| #    | Item                                                                                               | Closes |
| ---- | -------------------------------------------------------------------------------------------------- | ------ |
| 3c.1 | `Suggestion` default → soft tinted pill (`SuggestionChip`)                                         | BTN-2  |
| 3c.2 | `CommandComposer` preset / `InputGroup variant="surface"` (soft fill + focus ring, no hard border) | BTN-3  |

**3d · Produced assets + the ContextPanel** ([09](09-context-panel-integration.md)/[04](04-context-panel-and-assets.md)):

| #    | Item                                                                                                                                                                                                                   | Closes          |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 3d.1 | Branded read-only **markdown renderer** in `@qlik-coe-emea/qlabs-components-ai` (on the existing `streamdown` dep + the promoted prose primitives 1.2)                                                                 | ASSET-2/3       |
| 3d.2 | `FileTree` `cva` `code`/`document` variant + `ProducedAssetTree` (sans, no box, asset-type icons)                                                                                                                      | ASSET-1, TYPE-5 |
| 3d.3 | `AssetPreview` (type-switch: markdown→renderer, code/sql→`CodeBlock`, csv→table, png→image; Preview/Raw toggle; reuse `Artifact` chrome)                                                                               | ASSET-2/4       |
| 3d.4 | `ContextPanel` (+ `Provider`/`Header`/`Body`/`Section`/`Detail`) on `useCollapsiblePanel` (1.4): always-mounted width animation + a two-view root↔detail drill-in + BACK; mobile `Sheet`; the tab-panel-swap a11y spec | PANEL-1/2/3/4   |
| 3d.5 | Drill-in transition: **CSS `translateX` two-pane track v1** (gated, motion-free) behind the `useViewTransition` v2 seam (VT-01 is the proof case, **not** a blocker)                                                   | PANEL-3/5       |
| 3d.6 | Converge flow's `InspectorPanel` onto the shared `@qlik-coe-emea/qlabs-components-ui` collapse+frame base (keeps single-view)                                                                                          | PANEL-1/4       |

---

## Phase 4 — scenario re-wire (the only true story edits) + registry

| #   | Item                                                                                                                                                                                      | Closes               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| 4.1 | Replace the hand-rolled `<aside>` ContextRail with an always-mounted `<ContextPanel>` under a workspace-wrapping `ContextPanelProvider`; the header toggle → `<ContextPanelTrigger>`      | PANEL-1              |
| 4.2 | Final answer → `<AgentMessage emphasis="answer">` (KPI band via `<MetricGrid featured={0}>` + headline `<MetricCard>`, `<MessageResponse>`, `<SourceList>`); user turns → `<UserMessage>` | the grammar          |
| 4.3 | Approval → `<ApprovalCard>` (question/consequence/`Approve`/`Deny`); traces default-open **only** the chart `ToolResultCard` + the answer                                                 | TRACE-4, APPROVE-1/2 |
| 4.4 | KPI #4: real value + `delta`/`deltaDirection="up"` (pure story fix); inline citation → `<EvidenceChip>`                                                                                   | KPI-4, MSG-4         |
| 4.5 | (optional) a registry "context rail" block once the components stabilize                                                                                                                  | ASSET-4              |

The story should **shrink** to composition. If it grows, the grammar didn't absorb enough.

---

## Standalone bugs — file regardless of the redesign

These are real defects independent of the grammar work; file them now (finders → `/file-issue`):

1. **Raw-palette theme-safety** ([10](10-execution-trace-grammar.md) §F): `tool.tsx:54-60`
   status icons (`text-yellow-600`…) won't track the six themes — the headline; siblings
   `schema-display.tsx`/`commit.tsx` as follow-ups; `terminal.tsx` likely a deliberate
   dark-IDE exception (verify). Fixed by `StatusBadge` (1.3) + the `palette:check` gate.
2. **Unguarded `noopener`** ([11](11-message-approval-grammar.md) §F): `Source` (`sources.tsx:45`)
   uses `rel="noreferrer"` only; the lint doesn't catch it (no jsx-a11y in `react.js`). Fix
   the call site **and** wire `react/jsx-no-target-blank`. Grep for other `target="_blank"`
   in the AI-Element ports.
3. **Dead `is-user:dark`** ([11](11-message-approval-grammar.md) §F): `message.tsx:37` — remove;
   covered by `check-vendored-leftovers.mjs`.

---

## The new gate inventory (each ships with its convention — `enforcement-over-reminders`)

| Gate                                         | Flags                                                                                           | Sibling of                         |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------- |
| `text-scale:check`                           | new raw `text-sm/xs/[…px]` in component source (ratchet)                                        | the raw-hex check                  |
| `check-separation.mjs`                       | same-element `border` + a non-default fill (redundant border)                                   | `validate-component-boundaries.sh` |
| `palette:check` (+ extend the boundary hook) | raw Tailwind palette (`text-yellow-600`, …)                                                     | the raw-hex check                  |
| `check-collapse-fork.mjs`                    | a hand-rolled `transition-[width]`+`data-state=collapsed` panel not using `useCollapsiblePanel` | —                                  |
| `check-timeline-fork.mjs`                    | a hand-rolled rail+node (absolute `w-px` connector + status `cn` map) not using `Timeline`      | `check-collapse-fork.mjs`          |
| `check-vendored-leftovers.mjs`               | dead AI-Element idioms (`is-user:dark`, non-document `dark:` flips)                             | —                                  |
| `react/jsx-no-target-blank` (wire it)        | `target="_blank"` without `rel="noopener"`                                                      | —                                  |
| `theme-parity` additions                     | `--font-mono`/`--font-display` present per theme                                                | the existing parity gate           |

Each `*.mjs` ships a `node --test` self-test (plant a bad fixture → assert it fails) so the
gate can't silently rot.

---

## Quick wins vs structural

**Quick wins (low risk, high visible payoff, mostly no architect gate):**

- 0.3 revalue `--chat-user` + 3a.1 wire `Message` → instant user/agent distinction.
- 1.3 `StatusBadge` (also fixes the raw-`-600` theme-safety bug — ship standalone).
- 3c.1 soft suggestion pills + 1.6/3c.2 soft composer → removes the "harsh black border" feel.
- 3a.3 `ApprovalCard` pending treatment + Deny→`ghost` → the decision boundary stands out.
- 4.4 KPI #4 delta fix + the `noopener` + `is-user:dark` fixes → pure, safe.

**Structural (architect-gated, sequence-dependent):** 0.1 type scale · 1.1/1.2 `Text`/`Heading`

- prose promotion · 1.4 `useCollapsiblePanel` + Sidebar re-point · 1.5 `Timeline` move ·
  3d.4 `ContextPanel` · 3d.6 `InspectorPanel` convergence · 3b.1 `AgentTimeline`.

---

## Gates each change must clear (`quality-gates.md` Definition-of-Done battery)

| Change type                                                                   | Required before "done"                                                                                       |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **any**                                                                       | full-repo `pnpm typecheck` + `lint` + `test` + `build`                                                       |
| **`themes.css` token-VALUE edit** (0.1–0.3)                                   | **`brand-ui-visual-ux-reviewer` six-theme sweep on the real scenario** + `themes-contrast`/`charts-contrast` |
| **component / UI**                                                            | `/review-component` + `brand-ui-accessibility-reviewer` (real-surface a11y)                                  |
| **structural / public-API / package move** (1.1/1.2/1.4/1.5, 3d.4/3d.6, 3b.1) | `brand-ui-design-system-architect`                                                                           |
| **new package surface / subpath**                                             | `pnpm manifest` + register in docs/skill surfaces                                                            |
| **drill-in animation** (3d.5)                                                 | render across six themes **and** `data-motion-pref=reduced`                                                  |
| **the approval a11y** (3a.3)                                                  | a **screen-reader pass**, not just axe (the `role="group"` change)                                           |

---

## Consolidated needs-render (confirm on a real six-theme render before / during building)

_Diagnosis baseline (the defects, confirm they look as the source predicts):_

1. The right rail pops while the Sidebar glides; ⌘B works only on the left (PANEL-1).
2. Clicking a file only swaps the lower preview — no view change / back today (PANEL-3).
3. `FileTree` mono is the visible "different font"; `CodeBlock` shows literal `#`/`**` (ASSET-1/2).
4. qlik-bright user-bubble-vs-card delta is as weak as the tokens predict (MSG-1).
5. The pending `Confirmation` reads at the same weight as a `Tool` card; Deny reads as a hard black outline (APPROVE-1/2).
6. The `-600` status icons render off-token on blueprint/high-contrast (TRACE-5).
7. Five `defaultOpen` traces read as a wall; the chart is demoted by the "Result" heading (TRACE-3/4).

_Design-decision gates (settle these on a render before committing the build):_ 8. **Body line-height**: true identity (1.43, dense-safe) vs readability (1.57) — verify on the transcript + a dense `DataTable` (TYPE/07 §G.1). 9. **`CardTitle` rung**: `title` (20px) vs `subtitle` for dense cards (07 §G.2). 10. The branded board-note render doesn't become "biggest text" inside the `w-80` rail — needs a constrained heading rung (ASSET-3/04 §5). 11. **Dark/blueprint elevation**: does `bg-surface-elevated` lift perceptibly without the shadow? (08 §G.2 / 09 — elevation is the weakest channel). 12. **`StatusBadge` hybrid visual** across six themes — `complete`'s wash distinct from `pending`'s neutral; the two fills clearly more prominent; washes not too faint on dark (10 §G.4). 13. **Four greens in one answer** — rail + evidence chip + primary button + favourable delta; do they read as a deliberate gradient or a clash? (11 §G.2 — the sharpest open call). 14. The **`--chat-user` revalue** + any wash clears AA for its `-text` ink in all six themes (08/11 §G.3). 15. The **drill-in** transition gates to instant under `data-motion-pref=reduced` and reads as continuity, six themes (PANEL-3/09 §B.3).

_Build-detail gates (catch during implementation):_ 16. The `AgentMessage` green rail isn't clipped by `MessageContent`'s `overflow-hidden` — the `border-s` must sit outside the clip (11 §G.1). 17. The `ContextPanel` `fixed`-vs-`flex` container bounds to the shell, not the viewport (09 §G.3). 18. The off-screen drill-in pane + the collapsed panel are `inert`, not just `aria-hidden` (09 §G.4). 19. The approval `role="group"` SR pass; the `awaiting-approval` solid `StatusBadge` doesn't double-up loudly on the card's `bg-warning/10` zone (11 §G.4).
