# apps/diagram — harvest inventory for P4

Date: 2026-09-27 · Subject: `apps/diagram` at the close of P0–P3 (`diagram/integrate` @ `b3ccbba5`: DG-01…DG-18 and every wave-3 fix merged) · Input for: the P4 track in the plan (`2026-09-26-plan.md` §7).

**Goal.** P4 moves the generic parts of the diagram app into published packages: `@elabs-ai/components-flow/architecture`, `flow/spec`, `icons`, `editor`, `ui` and `tokens`. This document is the single, evidence-backed input for that move. It lists every library gap the app hit, says where the app works around it, and proposes a home and an API for each. It is aligned with the phases of the flow review (`docs/review/2026-09-25-flow-unified-contract-and-yaml-review.md` §6), so that the review’s track and this harvest become one track. It proposes and does not change code. P4 starts from the maintainer’s decision, not from this document.

**Decisions this inventory builds on:**

- **Plan (2026-09-26):** D4 (icons are names; vendor packs stay in the app), D7 (app first, then harvest), D8 (the library home is the `@elabs-ai/components-flow/architecture` subpath), D10 (`monaco-yaml` goes into the editor package in P4), and §11 (decided during execution).
- **Flow review (2026-09-25):** the shared definition base in `ui` is built by the charts plan’s foundation wave (Phase A); flow then runs Phase 0 (unify), 1 (contract), 2 (spec core), 3 (rendering) and 4 (proof). A flow ADR (Proposed) records FlowSpec v1 before Phase 2.

---

## 0. How this was done

- **Findings.** All 17 findings docs under `apps/diagram/docs/findings/` (DG-01 … DG-18; DG-03 has two, DG-04 and DG-10 have none), read in full. Each gap in them is one row below, or is listed in Appendix B as “not a gap” with the reason.
- **Code.** Every `// P4: library gap` comment under `apps/diagram/src`: **93 comments in 41 files, mapped to 77 rows**. Appendix A maps each comment to its row. All 120 rows cite a findings section, the app plan, or a review finding.
- **Reviews.** The wave 0–3 reviews and their fix reports were read for gaps found in review rather than in a findings doc. They added three: a curtain that lightens the page in the dark theme (H-50), dimmed labels falling to about 1.3:1 (folded into H-65), and a z-band for group headers above elevated edges (H-89). Reviews are cited by what they found.
- **Paths.** App paths are relative to `apps/diagram/src/` unless they start with `apps/`, `packages/` or `themes/`. “DG-NN §x” means section x of `apps/diagram/docs/findings/DG-NN-*.md`. Line numbers are at `b3ccbba5`. A parallel minor-fix lane is editing `layout/use-manual-layout.ts`, `state/history.ts`, `panes/focus-canvas.ts`, `interaction/step-player.tsx`, `panes/editor-pane.tsx` and `io/document-controls.tsx`; lines in those files are given with the function or constant name, because they may shift.

## 1. Verdict

**What the app proved.** An architecture diagram can be written as YAML text and kept as the only source of truth, on today’s packages. The text is parsed with source positions, validated into line-anchored issues, compiled to FlowSpec v1, and rendered by `CanvasShell` with nested ELK layout, including per-zone direction. Four real examples render cleanly in light, dark and qlik-light. The canvas writes back into the text: inspector edits, manual moves and re-parenting. On top of that the app has undo, file open and save, a share link, PNG and SVG export, a hover details card, a step walk-through and a presentation mode. On `b3ccbba5` the root `pnpm typecheck`, `pnpm lint`, `pnpm check` (95/95) and `pnpm check:test` (467/467) pass, the app’s `typecheck:local` reports 0 errors, `lint:local` reports the accepted baseline of 12 `conventions/i18n-strings` warnings, and `pnpm brand-ui audit --strict apps/diagram/src` passes.

**What the library must gain.** 110 of the 120 rows are class (a): a primitive is missing. They cluster in five places:

| Cluster                                      | Rows                  | What hurts most                                                                                                                                                                                         |
| -------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| flow group operations and layout             | H-76…H-89, H-97…H-104 | `expandGroup` is not an exact inverse (148 of 272 fold orders broke the graph); `layoutFlowElk` has no per-group options, no group minimum size, and drops ELK’s routes and label boxes                 |
| `CanvasShell` fit, measure, focus and states | H-52…H-69             | fit ignores panels and reads stale cached sizes; no loading state, no re-fit on resize, no focus restore, no dimmed state                                                                               |
| `ui` definition base and `SchemaForm`        | H-01…H-12             | no recursive, map-of or pattern field kinds; `appliesWhen` never reaches the JSON Schema; the inspector form needs enum clear, tags and “one of”                                                        |
| small `ui` accessibility and layout fixes    | H-13…H-35             | `ConfirmDialog` without a trigger drops focus (hit three times); `Sidebar` has no landmark; `DropdownMenuContent` clips; `IconButton` has no pressed look or shortcut hint                              |
| `editor`, `icons` and `tokens`               | H-36…H-51             | `CodeEditor` traps Tab, has no focus ring and puts its aria on the wrong element; `ServiceLogo` has no mono mask or dark source; several flow tokens miss 3:1; the dark modal curtain lightens the page |

**What stays app-local.** Four rows are class (b), app-local by design: the vendored icon packs and their licence notes, the pack assets themselves (wordmarks, dark-theme contrast), the icon index labels, and `cva` as an app dependency. The six custom node components, the zone and the edge stay in the app until P4 moves them into `flow/architecture` (§4). Six rows are class (c), dialect changes for v0.1.

**One track.** Most class (a) rows fit into the flow review’s phases without changing them: 40 are additive fixes to existing flow parts (Phase 0), 6 belong to the contract (Phase 1), 23 to rendering (Phase 3), and 8 amend the shared base (Phase A). The remaining 33 are `ui`, `editor`, `icons` and `tokens` fixes that depend on no flow phase and can land any time (“Side” below). §5 lays this out as one skeleton.

## 2. The gap table

Columns: **ID** (`H-NN`, defined in this document only) · **Missing** · **Evidence** (the app’s workaround at file:line, then the findings section) · **Class** ((a) library primitive missing, (b) app-local by design, (c) dialect or spec change for v0.1) · **Home and proposed API** · **Phase** (the flow review phase: A, 0, 1, 2, 3; “Side” = a package outside flow, no phase dependency; “—” = not harvested).

### 2.1 `ui` definition base and `SchemaForm`

| ID   | Missing                                                                   | Evidence                                                                  | Class | Home and proposed API                                                                             | Phase |
| ---- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------- | ----- |
| H-01 | Recursive or `$ref` field kind (zone `children:`)                         | `spec/dialect/definitions.ts:43`, `spec/dialect/schema.ts:40` · DG-09 §1  | (a)   | `ui/definition`: `field.ref(id)` that emits `$ref` into `$defs`                                   | A     |
| H-02 | Map-of field kind (`styles:`)                                             | `spec/dialect/definitions.ts:101`, `spec/dialect/schema.ts:95` · DG-09 §2 | (a)   | `ui/definition`: `field.record({ of })`, emitted as `additionalProperties`                        | A     |
| H-03 | String `pattern`, `patternProperties` (ids, the `a -> b` shorthand)       | `spec/dialect/schema.ts:24`, `:53` · DG-09 §3                             | (a)   | `string({ pattern })`; `record({ keyPattern })` emitted as `patternProperties`                    | A     |
| H-04 | `appliesWhen` is sibling-only and never reaches the JSON Schema           | `spec/dialect/schema.ts:101` · DG-09 §4                                   | (a)   | `toJsonSchema` emits `appliesWhen` as `if`/`then`                                                 | A     |
| H-05 | `toJsonSchema` has no fragment mode                                       | `spec/dialect/schema.ts:13` · DG-09 §5                                    | (a)   | `toJsonSchema(def, { fragment: true })` without `$schema`/`title`                                 | A     |
| H-06 | `SpecIssueSeverity` has no `"info"`                                       | `spec/dialect/issues.ts:4` · DG-09 §6                                     | (a)   | add `"info"` to the shared issue shape                                                            | A     |
| H-07 | Issue messages pre-quote the path and the values                          | `panes/issues-panel.tsx:64` · DG-09 §7                                    | (a)   | issues carry structured params (`expected`, `received`); the message does not quote them          | A     |
| H-08 | The merged (effective) field table is not exported                        | `spec/dialect/form-spec.ts:29` · DG-14 §5                                 | (a)   | `ui/definition`: export `effectiveFields(def)`                                                    | A     |
| H-09 | `SchemaFormProvider` in controlled mode drops keystrokes under StrictMode | `panes/inspector-pane.tsx:97` · DG-14 §1                                  | (a)   | `ui` `SchemaFormProvider`: fix the controlled path (bug fix)                                      | Side  |
| H-10 | `EnumControl` cannot clear a value                                        | `spec/dialect/form-spec.ts:12` (`UNSET`) · DG-14 §2                       | (a)   | `ui` `SchemaForm`: a clear option on optional enums                                               | 3     |
| H-11 | No tag input and no icon picker field                                     | `spec/dialect/form-spec.ts:72` · DG-14 §3                                 | (a)   | `ui` `SchemaForm`: a tags control for `string[]`; a host-supplied control slot for an icon picker | 3     |
| H-12 | `visibleWhen` has no “one of”                                             | `spec/dialect/form-spec.ts:46` · DG-14 §4                                 | (a)   | `visibleWhen: { field, in: [...] }`                                                               | 3     |

### 2.2 `ui` components

| ID   | Missing                                                              | Evidence                                                                                                                                        | Class | Home and proposed API                                                                                      | Phase |
| ---- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------- | ----- |
| H-13 | `ui` reads `process.env` without declaring it                        | `types/process-env.d.ts:1` · DG-01                                                                                                              | (a)   | `ui`: ship the ambient declaration or guard the two call sites (DG-01, “Proposed fix”)                     | Side  |
| H-14 | `Sidebar` renders no landmark                                        | `shell/diagram-shell.tsx:59` · DG-02 §2                                                                                                         | (a)   | `Sidebar` renders a named `nav` (or takes `aria-label`)                                                    | Side  |
| H-15 | `SkipLink` assumes hash navigation is free                           | `shell/diagram-shell.tsx:48` · DG-02 §3                                                                                                         | (a)   | `SkipLink` focuses its target by id without changing the hash                                              | Side  |
| H-16 | `SidebarHeader` does not share the top bar’s band                    | `shell/diagram-shell.tsx:63` · DG-02 §4                                                                                                         | (a)   | the CLI dashboard template and the `header-band` rule cover a `SidebarHeader` without a border             | Side  |
| H-17 | Theme switcher marks the current theme visually only                 | none · DG-02 §5                                                                                                                                 | (a)   | `ThemeSwitcher` theme items as `DropdownMenuRadioItem`                                                     | Side  |
| H-18 | `ResizableHandle` has no default accessible name                     | `app.tsx:84` · DG-02 §6                                                                                                                         | (a)   | a default, overridable name such as “Resize panels”                                                        | Side  |
| H-19 | `SidebarProvider` writes its cookie but never reads it               | `shell/diagram-shell.tsx:41` · DG-02 §7                                                                                                         | (a)   | `SidebarProvider` reads the cookie as its default `open`                                                   | Side  |
| H-20 | `ResizableHandle`: Enter collapses a panel without notifying it      | `app.tsx:85` · DG-02 §8                                                                                                                         | (a)   | Enter goes through the panel’s collapse API so `onCollapse`/`onExpand` fire                                | Side  |
| H-21 | No responsive toolbar that folds its overflow into a menu            | `shell/top-bar.tsx:253` (`DiagramOptionsMenu`) · DG-02 §9, DG-14 §10                                                                            | (a)   | a `ui` toolbar that measures its own width (not the window) and moves overflow into a menu                 | Side  |
| H-22 | `Heading`’s `text-balance` defeats `truncate`                        | `shell/top-bar.tsx:118` · DG-02 §10                                                                                                             | (a)   | `Heading` drops `text-balance` when it truncates                                                           | Side  |
| H-23 | `ScrollArea`’s `display: table` wrapper defeats `truncate`           | `panes/issues-panel.tsx:106` · DG-12 §“Library gaps” 7                                                                                          | (a)   | `ScrollArea` opts out of the table wrapper for rows that truncate                                          | Side  |
| H-24 | `ConfirmDialog` without a trigger returns focus to `<body>`          | `shell/sidebar-nav.tsx:57`, `layout/layout-bridge.ts:54`, `io/document-controls.tsx:105` (`DocumentControls`) · DG-13 gap 1, DG-15 §1, DG-16 §3 | (a)   | `ConfirmDialog` `returnFocusTo` ref, or `onCloseAutoFocus` passed through                                  | Side  |
| H-25 | `SidebarMenuButton` shows `tooltip` only while collapsed             | none (the label truncates) · DG-13 gap 6                                                                                                        | (a)   | a product call first; then a tooltip mode that also shows when the label is truncated                      | Side  |
| H-26 | `DropdownMenuContent` clips a tall menu                              | `shell/top-bar.tsx:271` · DG-14 §9                                                                                                              | (a)   | cap to Radix’s available height and scroll; default collision padding                                      | Side  |
| H-27 | `IconButton` has no pressed look                                     | `shell/top-bar.tsx:216` (`InspectorToggle`) · DG-14 §12                                                                                         | (a)   | `IconButton` styles `aria-pressed`                                                                         | Side  |
| H-28 | `IconButton` cannot show a keyboard shortcut                         | `io/document-controls.tsx:171` (`DocumentControls`) · DG-16 §1                                                                                  | (a)   | `IconButton` `shortcut` prop rendering `Kbd` in its tooltip                                                | Side  |
| H-29 | A toast from the first effects is lost unless `Toaster` mounts first | `main.tsx:39` (`Toaster` mounted before the app) · DG-16 §2                                                                                     | (a)   | the toast store queues until a `Toaster` mounts                                                            | Side  |
| H-30 | `DropdownMenuSubTrigger` does not size an icon                       | `io/export-menu.tsx:238` · DG-17 §9                                                                                                             | (a)   | size child icons as `DropdownMenuItem` does                                                                | Side  |
| H-31 | `DropdownMenuSubContent` runs off a phone screen; no inline sub-menu | `io/export-menu.tsx:213` (`ExportMenuItems`) · DG-17 §11                                                                                        | (a)   | an inline (accordion) sub-menu below a breakpoint                                                          | Side  |
| H-32 | `Badge` has no circular count shape                                  | `edges/edge-label-cluster.tsx:69` (the step badge) · DG-07 §7                                                                                   | (a)   | `Badge shape="count"`                                                                                      | Side  |
| H-33 | `cn()` drops a fill next to a hatch texture (tailwind-merge)         | `nodes/zone-variants.ts:60` · DG-06 §2                                                                                                          | (a)   | a texture class group in `cn()`’s tailwind-merge config                                                    | Side  |
| H-34 | The info and destructive glyphs are vertical mirrors                 | none · DG-05 §8 (third point)                                                                                                                   | (a)   | `ui` status icon and flow `FlowToneIndicator`: a destructive glyph with a different shape (`OctagonAlert`) | Side  |
| H-35 | The charts exporter’s font and XML helpers are internal              | `io/export.ts:709` · DG-17 §4                                                                                                                   | (a)   | export the font-embedding and XML helpers from one shared place, used by charts and by H-108               | Side  |

### 2.3 `editor`

| ID   | Missing                                                              | Evidence                                                                                                  | Class | Home and proposed API                                                                               | Phase |
| ---- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------- | ----- |
| H-36 | `CodeEditor` traps Tab and hides how to leave                        | `panes/editor-pane.tsx:181` (`EditorPane`; chord in `TAB_FOCUS_KEYS`) · DG-02 §1, DG-12 §“Library gaps” 8 | (a)   | `CodeEditor` discloses its Tab-focus chord (caption or `aria-describedby`)                          | Side  |
| H-37 | Aria props land on the textarea, not on Monaco’s EditContext surface | `panes/editor-pane.tsx:186` (`EditorPane`; `EDITOR_OPTIONS`) · DG-12 §“Library gaps” 6                    | (a)   | default `editContext: false` while `CodeEditor` owns the aria props, or stamp them on both surfaces | Side  |
| H-38 | `CodeEditor` draws no focus indicator                                | `panes/editor-pane.tsx:159` (`EditorPane`) · DG-13 gap 7                                                  | (a)   | an inset ring on the root above Monaco’s layers; `focusRing?: boolean` opt-out                      | Side  |
| H-39 | `path` seeds the new model with the old text; no new undo history    | `panes/editor-pane.tsx:169` (`EditorPane`) · DG-16 §4                                                     | (a)   | seed the new model from `value`; a `historyKey` prop that starts a fresh history                    | Side  |
| H-40 | Programmatic edits merge into one Monaco undo step                   | none (recorded) · DG-14 §8                                                                                | (a)   | apply an external `value` with undo stops (`pushEditOperations`)                                    | Side  |
| H-41 | No YAML language service with JSON-Schema autocomplete               | none; issues are shown as markers (`EditorPane`) · plan D10                                               | (a)   | `CodeEditor` `schema` prop wiring `monaco-yaml` (§3.5)                                              | Side  |

### 2.4 `icons`

| ID   | Missing                                                                        | Evidence                                       | Class | Home and proposed API                                                                                 | Phase |
| ---- | ------------------------------------------------------------------------------ | ---------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------- | ----- |
| H-42 | `ServiceLogo` `mono` is a greyscale filter, so dark marks vanish; no `srcDark` | `icons/register-packs.ts:106` · DG-05 §9a, §9b | (a)   | `mono` as a CSS mask in `currentColor`; `srcDark` on a registry entry, chosen by `resolveThemeIsDark` | Side  |
| H-43 | No icon-name mark for JSON node data; `icon` is a `ReactNode`                  | `nodes/arch-mark.tsx:27` · DG-05 §5            | (a)   | `icons`: the name scheme and resolver (§3.4); flow: `FlowNodeBaseData.iconName` resolved through it   | 1     |

### 2.5 `tokens`

| ID   | Missing                                                                                                      | Evidence                                                                                                                   | Class | Home and proposed API                                                                                                             | Phase |
| ---- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------- | ----- |
| H-44 | Nested group borders below 3:1 in light themes                                                               | `nodes/zone-variants.ts:30` (`zoneVariants`) · DG-03 §2, DG-06 §11                                                         | (a)   | `--flow-group-border` on the strong rung (≥3:1 against a nested fill)                                                             | 0     |
| H-45 | No provider accent token                                                                                     | `nodes/zone-node.tsx:166` · DG-06 §10                                                                                      | (a)   | `--flow-group-accent`                                                                                                             | 0     |
| H-46 | `--flow-edge` at 2.95:1 in qlik-light                                                                        | `edges/edge-style.ts:61` · DG-07 M7                                                                                        | (a)   | raise `--flow-edge` in `themes/qlik/qlik-light.css`; cover it in the theme contrast test                                          | 0     |
| H-47 | No striped rail token                                                                                        | `nodes/arch-node-variants.ts:63` · DG-05 §7                                                                                | (a)   | a striped rail utility on the flow rail tokens                                                                                    | 0     |
| H-48 | A neutral dashed frame cannot take the strong border rung                                                    | `nodes/arch-node-variants.ts:43` · DG-05 §6                                                                                | (a)   | a strong neutral rung for `FlowNodeCard`’s frame                                                                                  | 0     |
| H-49 | No emphasis colour for a highlighted edge (`--flow-edge-strong` means “access”)                              | none; the lit flow is drawn wider · DG-18 §6                                                                               | (a)   | `--flow-edge-emphasis`, only if a coloured highlight is wanted                                                                    | 3     |
| H-50 | The dark theme’s modal curtain lightens the page instead of dimming it                                       | none · the review of the wave-3 fixes: `--overlay` is derived from `--foreground` at `packages/tokens/src/themes.css:1122` | (a)   | derive the dark `--overlay` from a dark base in the DTCG source, rebuild, and assert “curtain darkens” in the theme contrast test | Side  |
| H-51 | Reduced motion: `useReducedMotion` reads a preference, not `data-motion-pref`; React Flow’s `.animated` rule | `edges/data-flow-edge.tsx:53` · DG-07 §4                                                                                   | (a)   | `tokens` `useReducedMotion` honours the attribute; `FlowEdgePath` gates `animated` on it                                          | 0     |

### 2.6 `flow`: exports and `CanvasShell`

| ID   | Missing                                                                                            | Evidence                                                                                                                                                                                            | Class | Home and proposed API                                                                                                                                                                   | Phase |
| ---- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| H-52 | Engine API not re-exported                                                                         | `layout/use-diagram-layout.ts:9`, `chrome/diagram-legend.tsx:2`, `edges/data-flow-edge.tsx:9`, `chrome/fit-padding.ts:23` · DG-07 §5 (gap a), DG-08 §2, DG-11 P4 gap 3, DG-12 §“Library gaps” 4, 11 | (a)   | re-export `useNodes`, `useEdges`, `useNodesInitialized`, `useInternalNode`, `useStore`, `useStoreApi`, `getViewportForBounds`, and the types `FitViewOptions`, `Viewport`, `EdgeMarker` | 0     |
| H-53 | `CanvasShell` caches measured sizes by id, so fit and layout read stale boxes                      | `panes/canvas-pane.tsx:160`, `layout/use-diagram-layout.ts:111`, `:178` · DG-12 §“Library gaps” 1                                                                                                   | (a)   | drop a cached size when `type`, `data` or size changes; or `invalidateMeasurements(ids?)`                                                                                               | 0     |
| H-54 | `fitBounds` padding typed as a number only (upstream)                                              | `layout/use-diagram-layout.ts:184` (`fitLaid`) · DG-12 §“Library gaps” 5                                                                                                                            | (a)   | upstream `@xyflow/system`; no brand-ui change, flow keeps `getViewportForBounds`                                                                                                        | Side  |
| H-55 | No `loading` or `error` state on `CanvasShell`                                                     | `panes/canvas-pane.tsx:339` · DG-03 §1, DG-11 P4 gap 4                                                                                                                                              | (a)   | `loading?: boolean`, `error?: ReactNode`                                                                                                                                                | 3     |
| H-56 | Fit cannot avoid panels; the `fitViewKey` path takes a numeric padding only                        | `chrome/fit-padding.ts:19`, `galleries/legend-gallery-view.tsx:39` · DG-08 M3, DG-11 defect 4, DG-12 §“Library gaps” 3, 12                                                                          | (a)   | `fitViewOptions.avoid: "panels"` avoiding the visible node boxes plus extra rects; per-side padding on the `fitViewKey` path                                                            | 3     |
| H-57 | Default `minZoom` (0.5) stops a large diagram from fitting                                         | `layout/use-diagram-layout.ts:39` (`FIT_MIN_ZOOM`) · DG-03-elk-nested gap 5                                                                                                                         | (a)   | `CanvasShell` fits with its own lower floor, or documents `minZoom` for large graphs                                                                                                    | 3     |
| H-58 | TB: the last node sat about 8 px below the fitted pane                                             | none; not reproduced after the app’s fit · DG-03-elk-nested gap 6                                                                                                                                   | (a)   | re-measure on the library fit once H-53 and H-56 land; close if clean                                                                                                                   | 3     |
| H-59 | No re-fit when the pane resizes; move events cannot tell user from program                         | `panes/canvas-pane.tsx:223` · DG-11 defect 5, DG-12 §“Library gaps” 10                                                                                                                              | (a)   | `refitOnResize?: boolean`, or `origin: "user"` or `"program"` on move events                                                                                                            | 3     |
| H-60 | `ZoomControls`’ Fit view ignores the app’s fit                                                     | `panes/canvas-pane.tsx:327` · DG-12 §“Library gaps” 9                                                                                                                                               | (a)   | `ZoomControls` `onFitView` or `fitViewOptions`                                                                                                                                          | 3     |
| H-61 | Tab order follows React Flow’s layer order (all edges before all nodes)                            | none · DG-03 §3, DG-07 §7 (tab order), DG-08 §3                                                                                                                                                     | (a)   | `CanvasShell` orders focus nodes first, then edges, or by reading order                                                                                                                 | 3     |
| H-62 | No focus restore after a keyboard delete or a text-driven change                                   | `panes/focus-canvas.ts:5` (`focusCanvasElement`) · DG-08 m4, DG-14 §7                                                                                                                               | (a)   | `CanvasShell` moves focus to a neighbour after a removal                                                                                                                                | 3     |
| H-63 | Escape on a focused node or flow drops focus to `<body>`                                           | `interaction/use-canvas-interaction.ts:112` · DG-18 §9                                                                                                                                              | (a)   | Escape deselects and keeps focus on the element or the pane                                                                                                                             | 3     |
| H-64 | One accessible description for every node, not extendable (and React Flow’s keys are swapped)      | `interaction/use-canvas-interaction.ts:46` · DG-18 §4                                                                                                                                               | (a)   | `CanvasShell` `nodeKeyHints` appended to the default sentence                                                                                                                           | 3     |
| H-65 | No dimmed or highlight state for nodes, edges and labels                                           | `interaction/use-canvas-interaction.ts:21` (`DIMMED`) · DG-18 §5; the wave-3 review measured dimmed label text at about 1.3:1                                                                       | (a)   | `CanvasShell` `highlight` (ids kept, the rest dimmed), with a contrast floor for dimmed text                                                                                            | 3     |
| H-66 | Two panels at one position overlap                                                                 | none · DG-18 §7                                                                                                                                                                                     | (a)   | `Panel` stacking: panels at one position lay out in a column                                                                                                                            | 0     |
| H-67 | No floating panel surface; `TitleBlock` has no library part; the surface is not capped to its pane | `chrome/diagram-legend.tsx:40` (`FLOATING_SURFACE`), `chrome/title-block.tsx:37` (`TitleBlock`) · DG-08 §4, m2                                                                                      | (a)   | `FlowPanelSurface` (class or thin `Panel` wrapper), capped to the pane                                                                                                                  | 0     |
| H-68 | A keyboard move fires no drag event                                                                | `layout/use-manual-layout.ts:170` (`useManualLayout`) · DG-15 §2                                                                                                                                    | (a)   | `onNodesMoveEnd(nodes, origin)` for pointer and keyboard moves                                                                                                                          | 3     |
| H-69 | No re-parenting on drop                                                                            | `layout/reparent.ts:7` (`dropTarget` at `:32`) · DG-15 §3                                                                                                                                           | (a)   | `dropTarget(node, groups)` helper or `onNodeDropIntoGroup`                                                                                                                              | 3     |

### 2.7 `flow`: nodes

| ID   | Missing                                                 | Evidence                                                                  | Class | Home and proposed API                                                        | Phase |
| ---- | ------------------------------------------------------- | ------------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------- | ----- |
| H-70 | `FlowNodeCard` has no bare look (the D5 `icon` variant) | `nodes/arch-node-variants.ts:31`, `nodes/service-node.tsx:100` · DG-05 §1 | (a)   | `FlowNodeCard variant="bare"`, tone carried by the title                     | 0     |
| H-71 | `FlowPort` is always visible                            | `nodes/service-node.tsx:29` · DG-05 §3                                    | (a)   | `FlowPort showOn` (always, hover or connecting)                              | 0     |
| H-72 | No badge row part                                       | `nodes/service-node.tsx:78` · DG-05 §4                                    | (a)   | `FlowNodeBadges`                                                             | 0     |
| H-73 | The node’s accessible name has no kind and no tone      | `nodes/service-node.tsx:58` · DG-05 §8 (fourth point), §10                | (a)   | the default label appends kind and tone; a definition may supply `ariaLabel` | 1     |
| H-74 | Featured star and border at 1.42:1 in light             | none · DG-05 §8 (first point)                                             | (a)   | `text-primary-text` for the star, a darker rung for the frame                | 0     |
| H-75 | Selected and focused look almost the same               | none · DG-05 §8 (second point)                                            | (a)   | a distinct selection colour or offset                                        | 0     |

### 2.8 `flow`: groups and zones

| ID   | Missing                                                                                           | Evidence                                                                                                                          | Class | Home and proposed API                                                                                                                    | Phase |
| ---- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| H-76 | No boundary `cva` for groups                                                                      | `nodes/zone-variants.ts:26` · DG-06 §1                                                                                            | (a)   | `flowBoundaryVariants` (kind × owner), used by `FlowGroupNode`                                                                           | 0     |
| H-77 | Group header is closed; its count hook is private; the title cannot win space                     | `nodes/zone-node.tsx:88` (`useDirectChildCount`) · DG-06 §3, §3a                                                                  | (a)   | `FlowGroupHeader` parts (title, meta, actions) with title priority; export `useGroupChildCount`                                          | 0     |
| H-78 | Group geometry is three private constants                                                         | `nodes/zone-data.ts:60` · DG-06 §4                                                                                                | (a)   | export `FLOW_GROUP_GEOMETRY` (header height, padding, insets)                                                                            | 0     |
| H-79 | Resize handles sit under a positioned body                                                        | `nodes/zone-node.tsx:241` (`NodeResizer`) · DG-06 §3b                                                                             | (a)   | `FlowGroupNode` stacks its resizer above the body                                                                                        | 0     |
| H-80 | React Flow never fits a parent to its children                                                    | `nodes/use-zone-autofit.ts:161`, `:33` · DG-06 §5                                                                                 | (a)   | `useFlowGroups({ autoFit: true })` or a pure `fitGroupsToChildren(nodes)` (§3.9)                                                         | 0     |
| H-81 | A group cannot start collapsed from data                                                          | `galleries/zone-gallery-view.tsx:25` · DG-06 §8                                                                                   | (a)   | `collapseGroups(nodes, edges, ids)`; `expandGroup` works without a snapshot                                                              | 0     |
| H-82 | `fitViewKey` pins a correctly fitted graph off-screen                                             | `galleries/zone-gallery-view.tsx:88` · DG-06 §9                                                                                   | (a)   | fix the overflow maths in `anchorToStartWhenClamped`                                                                                     | 0     |
| H-83 | `FlowGroupNode` collapse cannot be switched off and does not re-lay out                           | none (the app uses its own zone node) · DG-03 §4                                                                                  | (a)   | `collapsible?: boolean`, `onCollapsedChange`                                                                                             | 0     |
| H-84 | `FlowGroupNode` ports are fixed at top and bottom                                                 | `fixtures/lakehouse-hardcoded.ts:247` · DG-03-elk-nested gap 1                                                                    | (a)   | a `ports` option (side ports)                                                                                                            | 0     |
| H-85 | Collapsed size fixed at 220 × 48                                                                  | `layout/layout-from-spec.ts:164` (`chipWidth`) · DG-11 “Library gaps, sharpened”                                                  | (a)   | `collapseGroup(nodes, edges, id, { size })`                                                                                              | 0     |
| H-86 | `toggleCollapse` writes a stale snapshot (the clicked zone ends up unselected)                    | `state/pipeline.ts:236` (`keepSelection`) · DG-12 §“Library gaps” 2                                                               | (a)   | apply through an updater over the live nodes                                                                                             | 0     |
| H-87 | `expandGroup` is an exact inverse only in last-folded-first order; the snapshot is restored whole | `layout/zone-folds.ts:72` (`drawFolds`), `layout/use-diagram-layout.ts:235` · DG-15 §4, DG-18 §8 (sibling fold order, root cause) | (a)   | recompute edge visibility and proxies from node visibility; snapshots record only what the fold changed; export the proxy builder (§3.9) | 0     |
| H-88 | No “collapse all” or “expand all”                                                                 | `interaction/use-canvas-interaction.ts:67` (`collapseAllZones` at `:71`) · DG-18 §8 (collapse all)                                | (a)   | `collapseAll(nodes, edges)`, `expandAll(nodes, edges)`                                                                                   | 0     |
| H-89 | An elevated edge covers a group header’s collapse button                                          | none (keyboard still works) · DG-12 “Other findings”; the wave-2 review proposed a z-band for group headers                       | (a)   | a z-band that keeps group headers above elevated edges                                                                                   | 0     |

### 2.9 `flow`: edges

| ID   | Missing                                                                     | Evidence                                                                                                                     | Class | Home and proposed API                                                         | Phase |
| ---- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----- | ----------------------------------------------------------------------------- | ----- |
| H-90 | `EdgeLabelPill` cannot be part of a label cluster                           | `edges/edge-label-cluster.tsx:26` · DG-07 §1                                                                                 | (a)   | the edge group’s `Label` and `Meta` parts (DG-07 “Summary for P4”)            | 1     |
| H-91 | Marker colour is a literal grey, never follows selection; small at fit zoom | `edges/edge-style.ts:129` (`edgeMarkers`) · DG-07 §2, §7 (marker size)                                                       | (a)   | the edge group draws markers per edge from its stroke and selection           | 1     |
| H-92 | Stroke paint must go through `stroke`; no tone prop                         | `edges/edge-style.ts:65` (`KIND_STROKE`) · DG-07 §3                                                                          | (a)   | `FlowEdgePath` `stroke`/`tone` prop                                           | 1     |
| H-93 | `getEdgeParams` floats both ends; no “one end towards a point”              | `edges/zone-endpoint.ts:46` (`resolveEdgeEnds`) · DG-07 §5 (gap b)                                                           | (a)   | `getBorderPoint(node, towards)`                                               | 0     |
| H-94 | Default edge names are raw ids; the edge cannot name its focus target       | `edges/edge-style.ts:147` (`edgeAriaLabel`) · DG-03 §5, DG-07 §6                                                             | (a)   | the edge group computes the name from its parts; the default uses node titles | 1     |
| H-95 | `FlowEdgeLabel`’s fixed z sits under child nodes and selected zones         | `edges/edge-label-cluster.tsx:60`, `panes/canvas-pane.tsx:293` (`elevateNodesOnSelect`) · DG-07 B1, DG-12 §“Library gaps” 13 | (a)   | `FlowEdgeLabel` derives its z from its edge’s z plus the selection lift       | 0     |
| H-96 | `FlowEdge` never renders `data.label`                                       | `fixtures/lakehouse-hardcoded.ts:155` · DG-03-elk-nested gap 4                                                               | (a)   | `FlowEdge` renders `data.label`                                               | 0     |

### 2.10 `flow`: layout (`layoutFlowElk`)

| ID    | Missing                                                       | Evidence                                                                                                       | Class | Home and proposed API                                                                            | Phase |
| ----- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------ | ----- |
| H-97  | One `direction`, no per-group options                         | `layout/run-elk.ts:285` · DG-11 P4 gap 1, DG-13 gap 5                                                          | (a)   | `groups[].layoutOptions` or a `decorateGraph` hook (§3.8)                                        | 0     |
| H-98  | `extent: "parent"` forced on every child                      | `layout/layout-from-spec.ts:212`, `galleries/zone-gallery-view.tsx:61` · DG-06 §6, DG-11 P4 gap 2              | (a)   | `extent?: "parent"` or `null`, default `"parent"`                                                | 0     |
| H-99  | No group minimum size; in a DOWN run the pair must be swapped | `layout/run-elk.ts:126` · DG-06 §7, DG-11 defect 2, “Library gaps, sharpened”, wave-3 m4                       | (a)   | `groups[].minSize`, swapped for DOWN and UP runs (§3.8)                                          | 0     |
| H-100 | Returns the input edges: no routes, no label boxes, no ports  | `layout/run-elk.ts:42`, `:422` · DG-03-elk-nested gap 2, DG-11 defect 3, P4 gap 5 and “sharpened”, DG-13 gap 3 | (a)   | `edgeLabels(edge)`, `ports: "handles"`, result edges carry `data.elk = { points, label }` (§3.8) | 0     |
| H-101 | Cross-boundary edges cut through group headers                | none · DG-03-elk-nested gap 3; DG-11 “Known limits” (a lifted edge’s join step)                                | (a)   | group header height as top padding, from H-78’s geometry                                         | 0     |
| H-102 | Cycle breaking hard-coded to `MODEL_ORDER`                    | `layout/run-elk.ts:259` · DG-13 gap 2                                                                          | (a)   | a `cycleBreaking` option                                                                         | 0     |
| H-103 | `nodeSpacing`/`rankSpacing` set on the root only              | `layout/run-elk.ts:331` · DG-13 gap 4, DG-11 “sharpened” (rank spacing counts label layers)                    | (a)   | apply both to every group                                                                        | 0     |
| H-104 | Misleading fallback warning                                   | none · DG-11 P4 gap 6                                                                                          | (a)   | word the warning from the error; `onFallback?(error)`                                            | 0     |

### 2.11 `flow`: inspector, details, export and legend

| ID    | Missing                                                                                | Evidence                                                                             | Class | Home and proposed API                                                                  | Phase |
| ----- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----- | -------------------------------------------------------------------------------------- | ----- |
| H-105 | `InspectorPanel`’s empty state takes text only                                         | `panes/inspector-pane.tsx:176` · DG-14 §6                                            | (a)   | `emptyState?: ReactNode`                                                               | 3     |
| H-106 | `InspectorPanel` has no small-screen form                                              | `panes/inspector-pane.tsx:137` (`OVERLAY_CLASS`) · DG-14 §11                         | (a)   | an overlay (sheet) form below a breakpoint                                             | 3     |
| H-107 | No node details card: `HoverCard` cannot be opened by the canvas; focus return by hand | `interaction/details-card.tsx:69`, `:114` · DG-18 §1, §2, §3                         | (a)   | `ui` `HoverCard` with a virtual anchor; flow `FlowNodeDetails` opened by hover and `?` | 3     |
| H-108 | `CanvasShell` has no export API                                                        | `io/export.ts:76` · DG-17 §1, §2, §5                                                 | (a)   | `useCanvasExport()` with `toSvg`, `toPng`, `copyPng` (§3.6)                            | 3     |
| H-109 | Selection is painted from React props, so a DOM clone carries it                       | `io/export.ts:224` · DG-17 §3                                                        | (a)   | paint selection from an attribute the exporter can strip                               | 3     |
| H-110 | `Legend` has no non-colour swatch                                                      | `chrome/diagram-legend.tsx:97` (`OwnerSwatch`), `:113` (`EdgeKindSwatch`) · DG-08 §1 | (a)   | `Legend` items take a `swatch`; a spec-driven builder (§3.7)                           | 3     |

### 2.12 Dialect v0.1 (class c)

All six come from DG-13 “Dialect v0.1 input”. They land with the dialect when it moves into `flow/architecture` (Phase 2 timing).

| ID    | Missing                                                             | Evidence                                                               | Class | Home and proposed change                                                 | Phase |
| ----- | ------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------ | ----- |
| H-111 | No diagram-level `description:`                                     | `spec/dialect/types.ts:117` (`ArchDiagram`); the examples use comments | (c)   | `description:` shared by the title block, the sidebar and export         | 2     |
| H-112 | `theme:` is accepted but not applied to the canvas                  | `spec/dialect/types.ts:117` (`ArchDiagram`)                            | (c)   | a product call first (DG-13 question 43); then apply it or drop the key  | 2     |
| H-113 | Zone `description` is dropped by the compiler                       | `spec/compile/compile-arch.ts:165` (`compileArch`)                     | (c)   | carry it to the zone’s data (details card, export)                       | 2     |
| H-114 | Node `provider` is not derived from the icon                        | `spec/compile/compile-arch.ts:165` (`compileArch`)                     | (c)   | derive `provider` from the icon’s vendor unless set                      | 2     |
| H-115 | `class: [pii]` where a `badges:` key would do                       | `spec/dialect/definitions.ts:172` (`NODE_DEF`)                         | (c)   | a plain `badges:` list                                                   | 2     |
| H-116 | No layering hint; four flows are written reversed only to steer ELK | `layout/run-elk.ts:259`                                                | (c)   | a `rank:`/`layer:` key or a flow flag ignored for layering (needs H-102) | 2     |

### 2.13 App-local by design (class b)

| ID    | What                                                                      | Evidence                                                                            | Class | Home                                                                            | Phase |
| ----- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------- | ----- |
| H-117 | Vendored icon packs and their licence notes                               | `apps/diagram/public/icons/`, `apps/diagram/THIRD_PARTY_ICONS.md` · plan D4         | (b)   | the app, never a package                                                        | —     |
| H-118 | Wordmarks in square mark slots; dark-theme contrast of some vendor assets | `apps/diagram/public/icons/` · DG-05 §9, DG-13 “Library gaps hit” (outside touches) | (b)   | the app’s packs (square marks, dark variants); H-42 supplies the `srcDark` hook | —     |
| H-119 | `ICON_INDEX` labels wrong for two vendors (`Aws`, `K8s`)                  | `chrome/diagram-legend.tsx:58` (`PROVIDER_LABEL_OVERRIDE`) · DG-08 §5               | (b)   | a per-vendor label table in `apps/diagram/scripts/build-icon-index.mjs`         | —     |
| H-120 | `cva` was not an app dependency                                           | resolved by plan §11 (app dependency) · DG-05 §2, DG-06 §1 (dependency part)        | (b)   | the app’s `package.json`; nothing to harvest                                    | —     |

## 3. Proposals

Each proposal ends with its acceptance test. The shared form is: **the app consumes the library version, its workaround and `// P4: library gap` comment are deleted, and its screenshots are unchanged** (the four examples in light, dark and qlik-light at 1920 × 1080 and 1440 × 900, the way the findings docs took them), with `typecheck:local`, `lint:local` and `pnpm brand-ui audit --strict apps/diagram/src` as clean as before.

### 3.1 `@elabs-ai/components-flow/architecture`: the export list

Plan D8 names this subpath. It carries the architecture vocabulary on top of the generic parts; everything generic goes to flow’s root or to `flow/spec` first.

| Export (proposed name)                                                                   | From (app)                                                                                                |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `ServiceNode`, `ActorNode`, `DatastoreNode`, `QueueNode`, `ExternalNode`, `NoteNode`     | `nodes/service-node.tsx` … `nodes/note-node.tsx`                                                          |
| `ZoneNode`, `zoneVariants`                                                               | `nodes/zone-node.tsx`, `nodes/zone-variants.ts` (after H-76, H-77 land in `FlowGroupNode`)                |
| `DataFlowEdge`                                                                           | `edges/data-flow-edge.tsx`, `edges/edge-style.ts`, `edges/route-path.ts`                                  |
| `architectureFlowTypes` (the eight definitions, §3.3)                                    | `spec/compile/arch-definitions.ts` (`ARCH_DEFINITION_LIST`), `nodes/node-types.ts`, `edges/edge-types.ts` |
| `parseArchYaml`, `checkArchYaml`, `validateArch`, `buildArchSchema`, dialect types       | `spec/dialect/*` (`parse.ts:15`, `index.ts:18`, `validate.ts:7`, `schema.ts:35`, `types.ts`)              |
| `compileArch`                                                                            | `spec/compile/compile-arch.ts:165`                                                                        |
| `setEntryKeys`, `setFlowKeys`, `removeEntries`, `moveEntry` (text-preserving write-back) | `spec/dialect/write-back.ts`                                                                              |
| `buildArchitectureLegend` feeding `Legend` (§3.7)                                        | `chrome/build-legend.ts` (`buildLegend`)                                                                  |
| `layoutArchitecture` (dialect-aware wrapper over `layoutFlowElk`)                        | `layout/layout-from-spec.ts` (`layoutDiagram`, `followZoneDirection`), `layout/place-notes.ts`            |
| the JSON Schema file for the dialect                                                     | `apps/diagram/scripts/build-schema.mjs`                                                                   |

Not exported, because they move to a generic home instead: the ELK decoration (§3.8), zone auto-fit and folds (§3.9), fit padding (H-56), export (§3.6), the details card (H-107), icon names (§3.4). Not exported at all: the app shell, the stores, the pipeline, history, share link, file controls and the presentation view.

**Acceptance:** the app imports every name above from the subpath, `src/nodes`, `src/edges` and `src/spec` are deleted, and the screenshots are unchanged.

### 3.2 `@elabs-ai/components-flow/spec`: the core mapping

The flow review (§4.4) plans the spec core as a React-free `/spec` subpath. The app built a minimal version of it that is already pure (`spec/flow-spec`, React-free, `import type` from `@xyflow/react` only).

| App file                                                          | Package file (proposed)                                     | Notes                                                                                                           |
| ----------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `spec/flow-spec/types.ts` (`FLOW_SPEC_VERSION = "1"`, `FlowSpec`) | `packages/flow/src/spec/types.ts`                           | `FlowSpecDefinition` (`types.ts:64`) is a stand-in for Phase 1’s definition and is replaced by it               |
| `spec/flow-spec/validate.ts` (`validateFlowSpec`)                 | `packages/flow/src/spec/validate.ts`                        | issues use the shared shape from Phase A (with H-06’s `"info"`)                                                 |
| `spec/flow-spec/to-react-flow.ts` (`toReactFlow`, `pickPort`)     | `packages/flow/src/spec/to-react-flow.ts`                   | takes the registry from `createFlowRegistry` instead of a `Map`                                                 |
| `spec/flow-spec/from-react-flow.ts` (`fromReactFlow`)             | `packages/flow/src/spec/from-react-flow.ts`                 |                                                                                                                 |
| `spec/flow-spec/index.ts`                                         | `packages/flow/src/spec/index.ts` (the subpath entry)       |                                                                                                                 |
| `spec/dialect/source-map.ts` (`locate`, `toSourceRange`)          | `packages/flow/src/spec/yaml-source-map.ts`                 | generic YAML path → range; `parseFlowYaml` needs it for line-anchored issues (review §7, resolved)              |
| — (not built in the app)                                          | `normalizeFlowSpec`, `buildFlowSpecSchema`, `parseFlowYaml` | the app normalizes and parses at the dialect level (`normalizeArch`, `parseArchYaml`); the review’s list stands |

**Acceptance:** `apps/diagram/src/spec/flow-spec/` is deleted, the app compiles against `@elabs-ai/components-flow/spec`, the `#spec-check` view reports the same issues for the four examples, and the screenshots are unchanged.

### 3.3 The `defineFlowNodeType` definitions: six node kinds, the zone and the edge

In the shape of the flow review §4.1, the app’s eight definitions (`spec/compile/arch-definitions.ts:89`) become:

| Type key         | Kind | Label           | Ports (targets)                                | Fields (beyond the header group)                                                                          | Needs           |
| ---------------- | ---- | --------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------- |
| `arch/service`   | node | Service         | `in` left, `out` right, `top` in, `bottom` out | `icon` (name), `badges`, `variant` (icon or card), `tone`, `href`, `classes`                              | H-43, H-70…H-73 |
| `arch/actor`     | node | Actor           | `in` left, `out` right                         | as service                                                                                                | H-43, H-73      |
| `arch/datastore` | node | Data store      | all four                                       | as service                                                                                                | H-43, H-73      |
| `arch/queue`     | node | Queue           | all four                                       | as service                                                                                                | H-43, H-73      |
| `arch/external`  | node | External system | all four                                       | as service                                                                                                | H-43, H-73      |
| `arch/note`      | node | Note            | none                                           | `text`                                                                                                    | —               |
| `arch/zone`      | node | Zone            | `in` left, `out` right; capability `container` | `kind`, `owner`, `provider`, `icon`, `direction`, `classes`                                               | H-76…H-81, H-97 |
| `arch/flow`      | edge | Flow            | —                                              | `kind`, `style`, `animated`, `secure`, `direction`, `step`, `protocol`, `schedule`, `floating`, `classes` | H-90…H-95       |

Every node kind shares one field list (`NODE_FIELDS`, `arch-definitions.ts:39`), which becomes one field group on the Phase A base. The icon is a name, resolved through the registry’s `icons` option (review §4.2), never a component in data.

**Acceptance:** `createFlowRegistry([...builtInFlowTypes, ...architectureFlowTypes])` replaces `createArchRegistry` (`spec/compile/registry.ts:111`), the inspector form is generated from the definitions (Phase 3), and the screenshots are unchanged.

### 3.4 `icons`: the name scheme

- **Scheme.** A name is `vendor/name` (for example `aws/lambda`), or `lucide:name` for a generic glyph. The app’s parser and key (`icons/icon-name.ts:20` `parseIconName`, `:27` `iconKey`) move to `icons` as is.
- **Resolver.** `resolveIconName(name)` returns a registered `ServiceLogo` entry, a Lucide glyph from a small built-in map (the app’s `icons/lucide-map.ts` `LUCIDE_ICONS`), or the monogram fallback that `ServiceLogo` already draws. No vendor artwork ships (D4).
- **Registry.** `registerServiceLogos` stays the one way to add vendor marks. It gains the `mono` mask and `srcDark` of H-42, which retires the app’s `VendorMark` (`icons/theme-aware-mark.tsx:35`).
- **Flow.** `FlowNodeBaseData.iconName` is resolved through the registry’s `icons` option (H-43).

**Acceptance:** `icons/icon-name.ts`, `icons/lucide-map.ts` and `icons/theme-aware-mark.tsx` are deleted, the icon sheet (the `#icons` route) shows the same marks in light and dark, and the screenshots are unchanged.

### 3.5 `editor`: `monaco-yaml`, and the `CodeEditor` gaps

- **YAML language service (D10, H-41).** `CodeEditor` takes `schema?: { uri: string; schema: JsonSchema }` when `language="yaml"` and wires `monaco-yaml` for completion, hover and schema validation. The app passes the dialect schema (§3.1). The app’s own validator keeps owning the Problems list; `monaco-yaml`’s diagnostics must not duplicate it (a `validate: false` option, completion and hover only, is the likely default).
- **Aria on the EditContext surface (H-37).** Monaco 0.55 in Chromium focuses `DIV.native-edit-context`, not the textarea `CodeEditor` stamps. Default `editContext: false` while `CodeEditor` owns `ariaLabel`, `ariaInvalid` and `ariaDescribedBy`, or stamp them on both.
- **`path` and undo across a load (H-39).** Switching `path` creates a new model seeded with the old text, so undo crosses a file load. Seed the new model from `value`, and add `historyKey` to start a fresh history on purpose.
- **Also:** Tab-out disclosure (H-36), a focus ring (H-38), undo stops for external edits (H-40).

**Acceptance:** `panes/editor-pane.tsx` drops `EDITOR_OPTIONS`, the focus-ring overlay, the Tab caption and the `path` workaround; opening an example and pressing undo does not bring back the previous document; completion offers the dialect keys; the screenshots are unchanged.

### 3.6 `CanvasShell` export

DG-17 built the export on the canvas’s own DOM, not `html-to-image` (measured too slow and too large, DG-17 §1). The pipeline in `io/export.ts` (`pictureOfCanvas` at `:756`, `svgBlob`, `pngBlob`) is generic apart from its fonts:

- **API.** `useCanvasExport()` inside `CanvasShell` returns `toSvg(options)`, `toPng(options)` and `copyPng(options)`; options are `bounds` (`"nodes"` or the viewport), `scale`, `background` and `title`. It waits for the canvas to be drawn (the app’s `canvasDrawn`, `:93`).
- **Faithfulness rules.** The rules DG-17 §8 found become the exporter’s tests (selection stripped, H-109; labels and markers kept; fonts embedded through H-35).
- **SVG honesty.** The SVG is a picture of HTML, which only browsers draw (DG-17 §5); the docs must say so, and a vector-only path is a later option.
- **Twin.** This is the twin of the charts export tracked as RM-042 in the repo roadmap (plan §3); both use the helpers of H-35.

**Acceptance:** `io/export.ts` shrinks to a call of `useCanvasExport()`, and the exported PNG and SVG of the four examples match the current exports pixel for pixel at the same scale.

### 3.7 `Legend` swatches

- **Item shape.** `Legend` items become `{ label, color?, swatch? }`, where `swatch` is a `ReactNode` or a declarative `{ kind: "line", dash, marker }` or `{ kind: "area", pattern }`. The categorical colour dot stays the default.
- **Builder.** `buildArchitectureLegend(graph, { mode })` in `flow/architecture` returns those items from the visible nodes and edges (the app’s `buildLegend`). The owner and edge-kind swatches (`OwnerSwatch`, `EdgeKindSwatch`) become the declarative swatches, so the greyscale check still passes.
- **Surface.** `Legend` renders on `FlowPanelSurface` (H-67).

**Acceptance:** `DiagramLegend` (`chrome/diagram-legend.tsx:240`) renders `Legend`, the greyscale legend screenshot is unchanged, and axe reports 0 violations on `#legend` (as in DG-08).

### 3.8 `layoutFlowElk` group options

- **Per-group options (H-97).** `groups: { id, children, direction?, layoutOptions? }[]`, or a `decorateGraph(graph)` hook. A group with its own direction becomes its own ELK run (`SEPARATE_CHILDREN`), as `decorateElkGraph` (`layout/run-elk.ts:288`) does today.
- **Group minimum size (H-99).** `groups[].minSize?: { width, height }`, emitted as `elk.nodeSize.constraints` and `elk.nodeSize.minimum`. In a DOWN or UP run the pair must be given swapped, because ELK applies the minimum in the run’s rotated frame (DG-11 wave-3 m4, measured in isolation).
- **Routes and labels (H-100).** `edgeLabels?(edge)` for sizes, `ports?: "handles"` for fixed ports at the handles, and result edges carrying `data.elk = { points, label }` in root coordinates (`org.eclipse.elk.json.edgeCoords: ROOT`, labels with `text`).
- **Also:** `extent` (H-98), `cycleBreaking` (H-102), spacing per group (H-103), header as top padding (H-101), `onFallback` (H-104).

**Acceptance:** `layout/run-elk.ts` shrinks to a call of `layoutFlowElk` with these options, the overlap and panel-hit checks DG-11 and DG-13 used report nothing for the four examples in LR and TB, and the screenshots are unchanged.

### 3.9 `useFlowGroups`

- **Auto-fit (H-80).** `useFlowGroups({ autoFit: true })` or a pure `fitGroupsToChildren(nodes, { minSize })`, which grows a group to its children and its header minimum (the app’s `fitZones`, `nodes/use-zone-autofit.ts:70`).
- **`expandGroup` as an exact inverse in any order (H-87).** Recompute edge visibility from node visibility (an edge is hidden exactly when an end is hidden), rebuild each proxy to the outermost collapsed ancestor of each hidden end, never build a proxy from a hidden edge, and let a snapshot record only what its fold changed. Export the proxy builder so callers never copy the id format. DG-18 §8 measured 148 of 272 fold and unfold orders leaving the graph different from a fresh load; the app’s `zone-folds.ts` brings that to 0, and is the reference.
- **Stale collapse snapshot (H-86).** `toggleCollapse` applies through an updater over the live nodes, so selection and other live state survive.
- **Also:** start collapsed (H-81), `collapseAll`/`expandAll` (H-88), collapsed size (H-85).

**Acceptance:** `layout/zone-folds.ts` and `nodes/use-zone-autofit.ts` are deleted, the 272-permutation check reports 0 differences, and the screenshots are unchanged.

## 4. What stays app-local, and why

- **Vendored icon packs and licence notes** (H-117). D4 and the maintainer’s ruling of 2026-09-26: brand and vendor assets may be used inside `apps/diagram` only, and nothing from them is added to `ATTRIBUTION.md`. The packs, `THIRD_PARTY_ICONS.md`, the index generator (`scripts/build-icon-index.mjs`) and its label table (H-119) stay in the app. Asset quality (wordmarks, dark variants, H-118) is pack work, not library work.
- **The custom node components, the zone and the edge, until P4 lands.** They stay in `src/nodes` and `src/edges` until the primitives they work around exist; then they move to `flow/architecture` (§3.1), not to flow’s root, because their vocabulary (owners, providers, flow kinds) is architecture-specific. The same holds for `VendorMark` until H-42.
- **The application itself.** The shell, the stores and the compile pipeline (`state/`), undo and redo (`state/history.ts`), the share link (`io/share-url.ts`), file open and save (`io/files.ts`, `io/document-controls.tsx`), the interaction layer and presentation mode (`interaction/`), and the galleries and fixtures. These are an app built with the library, not parts of it (D5 in `docs/DECISIONS.md`: a presentation layer, not a runtime).
- **The examples** stay app files until P4 turns them into `Flow/Architecture` stories and the registry block the plan names (plan §3).
- **`cva`** is an app dependency by the plan’s §11 decision (H-120).

## 5. P4 track skeleton

P4 is one track with the flow review’s, not a second one. The table puts every class (a) row into a review phase; a wave may start when the phases it depends on have merged. RM numbers are **to be allocated in the repo `roadmap/`**; none are proposed here.

| Wave                              | Delivers                                                                                                                                                                                               | Rows                                                                            | Depends on                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | --------------------------------- |
| **Side** (any time)               | `ui` fixes, `editor` fixes and `monaco-yaml`, `icons` mono mask and `srcDark`, the dark curtain token, the upstream `fitBounds` report                                                                 | H-09, H-13…H-42, H-50, H-54                                                     | —                                 |
| **A-amend** (with review Phase A) | Eight amendments to the shared definition base                                                                                                                                                         | H-01…H-08                                                                       | the charts plan’s foundation wave |
| **0** (with review Phase 0)       | Re-exports, measured-size fix, flow tokens, `FlowNodeCard`/`FlowPort`/`FlowGroupNode` parts, group geometry and header, `useFlowGroups` (§3.9), `layoutFlowElk` options (§3.8), edge label z and fixes | H-44…H-48, H-51, H-52, H-53, H-66, H-67, H-70…H-72, H-74…H-89, H-93, H-95…H-104 | — (can run now)                   |
| **1** (with review Phase 1)       | Icon-name scheme (§3.4), node accessible names from definitions, the edge group, the eight architecture definitions (§3.3)                                                                             | H-43, H-73, H-90…H-92, H-94                                                     | A, 0                              |
| **2** (with review Phase 2)       | `flow/spec` from the app’s core (§3.2); `flow/architecture` dialect and compiler (§3.1) with the v0.1 changes                                                                                          | H-111…H-116                                                                     | 1; the ADR below                  |
| **3** (with review Phase 3)       | `CanvasShell` states, fit, re-fit, focus, key hints, highlight, move and drop events; export (§3.6); legend (§3.7); inspector and form controls; details card                                          | H-10…H-12, H-49, H-55…H-65, H-68, H-69, H-105…H-110                             | 2                                 |
| **4** (with review Phase 4)       | The app consumes `flow/architecture` and deletes its copies; `Flow/Architecture` stories; the registry block; each acceptance test of §3 run                                                           | —                                                                               | 3                                 |

**ADR need.** One ADR for `flow/architecture` and FlowSpec v1 together. The flow review already plans a flow ADR (Proposed) for FlowSpec v1 before its Phase 2; the architecture subpath should be recorded in the same ADR, because the dialect is the first real consumer of FlowSpec and both land in the same wave. The ADR also has to satisfy the subpath rule in `.claude/rules/conventions.md` (a lighter or different dependency tree and a real consumer): `flow/spec` is React-free, and `flow/architecture` adds the `yaml` parser that flow’s root does not need, with this app as the consumer.

**Counts.** 120 rows: 110 class (a), 4 class (b), 6 class (c). By phase: A 8, 0 40, 1 6, 2 6, 3 23, Side 33, not harvested 4.

## 6. Open points

1. **Maintainer decision.** P4 opens only on the maintainer’s word (DG-19 acceptance). The rows are a proposal; merges, renames and the wave split are the maintainer’s to change.
2. **Product calls held from DG-13:** whether `theme:` in a document applies to the canvas (H-112), and whether a sidebar tooltip shows for truncated labels (H-25).
3. **Plan §4’s sample** names “Qlik Data Gateway – Direct Access” (plan line 107), where DG-13’s judgement call 1 found the story needs Data Movement. The plan is not edited here; the example file is correct.
4. **Browsers.** DG-17 §7: export was checked in Chromium only. The export acceptance (§3.6) should add Firefox and Safari.
5. **H-58** (the 8 px TB residual) may already be gone; it needs a re-measure on the library fit, not a fix.
6. **H-54** is an upstream typing issue in `@xyflow/system`; brand-ui has nothing to change unless flow wraps `fitBounds`.
7. **Edge labels are not fit obstacles.** The app’s panel-aware fit (`chrome/fit-padding.ts`, pass 2) keeps leaf nodes and zone header bands clear of panels, not edge labels. At 1920×1080 with the inspector and the legend both open, the “SAML SSO (console)” label on the ClickHouse example runs under the legend (wave-3 step-player fix lane, 2026-09-27). H-56’s `avoid: "panels"` should count edge-label boxes as obstacles; until then the app accepts it.

## Appendix A: `// P4: library gap` comments → rows

93 comments in 41 files, mapped to 77 rows (every comment to exactly one row). Lines at `b3ccbba5`; in the six files of the parallel lane, the function or constant is named.

| File                                    | Comment line → row                                                             |
| --------------------------------------- | ------------------------------------------------------------------------------ |
| `app.tsx`                               | 85 → H-20                                                                      |
| `chrome/diagram-legend.tsx`             | 2 → H-52                                                                       |
| `chrome/fit-padding.ts`                 | 19 → H-56 · 23 → H-52                                                          |
| `edges/data-flow-edge.tsx`              | 9 → H-52 · 53 → H-51                                                           |
| `edges/edge-label-cluster.tsx`          | 26 → H-90 · 60 → H-95                                                          |
| `edges/edge-style.ts`                   | 61 → H-46                                                                      |
| `fixtures/lakehouse-hardcoded.ts`       | 155 → H-96 · 247 → H-84                                                        |
| `galleries/legend-gallery-view.tsx`     | 39 → H-56                                                                      |
| `galleries/zone-gallery-view.tsx`       | 25 → H-81 · 61 → H-98 · 88 → H-82                                              |
| `icons/register-packs.ts`               | 106 → H-42                                                                     |
| `interaction/details-card.tsx`          | 69 → H-107 · 114 → H-107                                                       |
| `interaction/use-canvas-interaction.ts` | 21 → H-65 · 46 → H-64 · 67 → H-88 · 112 → H-63                                 |
| `io/document-controls.tsx`              | `DocumentControls`: 105 → H-24 · 171 → H-28                                    |
| `io/export-menu.tsx`                    | 213 → H-31 · 238 → H-30                                                        |
| `io/export.ts`                          | 76 → H-108 · 224 → H-109 · 709 → H-35                                          |
| `layout/layout-bridge.ts`               | 54 → H-24                                                                      |
| `layout/reparent.ts`                    | 7 → H-69                                                                       |
| `layout/run-elk.ts`                     | 42 → H-100 · 126 → H-99 · 259 → H-102 · 285 → H-97 · 331 → H-103 · 422 → H-100 |
| `layout/use-diagram-layout.ts`          | 9 → H-52 · 111 → H-53 · 178 → H-53 · 235 → H-87                                |
| `layout/use-manual-layout.ts`           | `useManualLayout`: 170 → H-68                                                  |
| `layout/zone-folds.ts`                  | 72 → H-87                                                                      |
| `nodes/arch-mark.tsx`                   | 27 → H-43                                                                      |
| `nodes/arch-node-variants.ts`           | 31 → H-70 · 43 → H-48 · 63 → H-47                                              |
| `nodes/service-node.tsx`                | 29 → H-71 · 58 → H-73 · 78 → H-72 · 100 → H-70                                 |
| `nodes/use-zone-autofit.ts`             | 33 → H-80 · 161 → H-80                                                         |
| `nodes/zone-data.ts`                    | 60 → H-78                                                                      |
| `nodes/zone-node.tsx`                   | 88 → H-77 · 166 → H-45                                                         |
| `nodes/zone-variants.ts`                | 26 → H-76 · 60 → H-33                                                          |
| `panes/canvas-pane.tsx`                 | 160 → H-53 · 223 → H-59 · 327 → H-60 · 339 → H-55                              |
| `panes/editor-pane.tsx`                 | `EditorPane`: 159 → H-38 · 169 → H-39 · 181 → H-36 · 186 → H-37                |
| `panes/focus-canvas.ts`                 | `focusCanvasElement` (file header): 5 → H-62                                   |
| `panes/inspector-pane.tsx`              | 97 → H-09 · 176 → H-105                                                        |
| `panes/issues-panel.tsx`                | 64 → H-07 · 106 → H-23                                                         |
| `shell/diagram-shell.tsx`               | 41 → H-19 · 48 → H-15 · 59 → H-14                                              |
| `shell/sidebar-nav.tsx`                 | 57 → H-24                                                                      |
| `shell/top-bar.tsx`                     | 118 → H-22 · 216 → H-27 · 253 → H-21 · 271 → H-26                              |
| `spec/dialect/definitions.ts`           | 43 → H-01 · 101 → H-02                                                         |
| `spec/dialect/form-spec.ts`             | 12 → H-10 · 29 → H-08 · 46 → H-12 · 72 → H-11                                  |
| `spec/dialect/issues.ts`                | 4 → H-06                                                                       |
| `spec/dialect/schema.ts`                | 13 → H-05 · 24 → H-03 · 40 → H-01 · 53 → H-03 · 95 → H-02 · 101 → H-04         |
| `types/process-env.d.ts`                | 1 → H-13                                                                       |

The other 43 rows have no comment: the gap was recorded without a workaround (for example H-17, H-40, H-61), the workaround is a plain prop or constant (H-18, H-57), or the row is class (b) or (c).

## Appendix B: findings entries that are not gaps

So that completeness can be checked, these findings entries are deliberately not rows:

- **DG-03-elk-nested:** the headline (the stop condition did not trigger) and “Deviations from the item”.
- **DG-06:** “Deviations from the item” and its corrections.
- **DG-07:** m6 (SSO glyph swap, fixed in the app) and “Step 9” (smart-edge comparison, a measurement).
- **DG-08:** “Not a gap” (arch nodes need explicit handles) and m10 (standalone routes had no `h1`, fixed in the app).
- **DG-11:** defect 1 (legibility at fit, addressed by DG-13’s spacing), defect 6 (every keystroke re-laid out, replaced by DG-12), “Known limits” other than the one cited in H-101, and F4 (not a defect under the current rule).
- **DG-12:** sticky-scroll Tab stops (Monaco’s own behaviour), the harmless ResizeObserver message, the YAML round trip (why write-back splices at source offsets; it moves with §3.1), and the squiggle timing.
- **DG-13:** the domain facts and judgement calls (open point 3), and the zone header minimum width listed under “outside touches” (fixed by DG-11’s wave-2 work; its library side is H-99).
- **DG-15:** “Not a library gap (fixed in the app)”.
- **DG-16:** the build note.
- **DG-17:** §6 (`getNodesBounds`/`getViewportForBounds` not needed), §7 (browsers not checked, open point 4), §8 (faithfulness rules, which become the export’s tests in §3.6) and §10 (the status line is left out of the picture by design).
- **DG-18:** §10 (a test note on how `?` must be dispatched).
