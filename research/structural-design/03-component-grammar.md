# 03 · The component grammar

The visual grammar the maintainer asked for: a distinct, consistent treatment per
interaction type, each owning **one separation channel** (tint / rail / elevation /
size) so the border channel stops carrying all the weight. Every treatment is
assembled from the backbone in [02](02-systemic-backbone.md) (the type scale + the
zone/rail/badge tokens) — these are not 14 fresh piles of `text-sm` + `border bg-card`.

For each: **current → target → layer → new component vs edit to an existing one.**
Execution-trace components (`AgentStep`, `ToolResultCard`, `StatusBadge`) get their
own detail in [05](05-execution-traces.md); the context-rail set
(`ProducedAssetTree`, `AssetPreview`) in [04](04-context-panel-and-assets.md).

> **The message / approval / evidence / KPI treatments (§1–3, §6–8) are refined and
> superseded by [11-message-approval-grammar.md](11-message-approval-grammar.md)** (the
> top-down design: `UserMessage`/`AgentMessage` preset wrappers + a `cva emphasis="answer"`
> rail, `ApprovalCard` = enhance `Confirmation`, `EvidenceChip`/`SourceList` re-skins,
> `MetricCard emphasis` + the `MetricGrid` ownership correction, and the unguarded
> `noopener` finding). This doc remains the at-a-glance channel-per-type map across all 14;
> the execution-trace grammar is refined by [10](10-execution-trace-grammar.md), the
> `ContextPanel` set by [09](09-context-panel-integration.md).

---

## The channel assignment (the core idea)

| Interaction type | Owns this channel                                                 | Border?                                        |
| ---------------- | ----------------------------------------------------------------- | ---------------------------------------------- |
| User message     | filled `--chat-user` tint + right-align + avatar                  | none                                           |
| Agent answer     | quiet ground + **green left accent rail** + structured sections   | none                                           |
| Approval         | attention surface (status-subtle) + accent rail + light elevation | only the action-area divider (`border-strong`) |
| Agent step       | timeline **rail** + `StatusBadge`                                 | none (rail is the cue)                         |
| Tool result      | light **elevation** (`shadow-sm`), result as headline             | none                                           |
| KPI              | **size/weight** (headline tier)                                   | the card's own (kept)                          |
| Evidence         | green-tinted **chip**                                             | none                                           |
| Produced asset   | sans + type icon + row hover                                      | none (section header + spacing)                |
| Suggestion       | soft neutral **pill**                                             | none                                           |
| Composer         | soft **fill** + focus ring                                        | hairline only                                  |

Borders survive only where a region has _no other_ structural cue (a standalone
`Separator`, the action-area divider in an approval) — the redundant-boundary test.

---

## 1. `UserMessage` (MSG-1, MSG-2) — new wrapper · `@qlik-coe-emea/qlabs-components-ai`

- **Current:** `<Message from="user">` → `MessageContent` paints `bg-secondary` (≈ white) right-aligned (`message.tsx:38`). No avatar/label. Carries a dead `is-user:dark` class (MSG-5).
- **Target:** filled `bg-chat-user` (revalued, §[02-4](02-systemic-backbone.md)) bubble, right-aligned, with an optional avatar/initials and a "You" label slot.
- **Layer:** component-internal (wire chat tokens, drop `is-user:dark`) + token (revalue `--chat-user`) + a thin semantic wrapper.

## 2. `AgentMessage` (MSG-2, MSG-3, MSG-4) — new wrapper · `@qlik-coe-emea/qlabs-components-ai`

- **Current:** bare `text-foreground` block; the final answer crams KPI grid + prose + a muted-gray citation `<p>` + collapsed Sources + ghost actions at one `text-sm` weight (`agentic-workspace.stories.tsx:839-943`).
- **Target:** a quiet ground with a **brand-green left accent rail** on the _final_ answer only (intermediate steps stay neutral), a brand-mark + "Atlas" label, and explicit sections: **headline KPI band → prose body (real prose scale) → grounding footer**. Prose gets the type scale via `MessageResponse` (MSG-3), not the wrapper's `text-sm`.
- **Layer:** component-internal (`MessageResponse` scale, an answer container) + scenario (compose the sections).

## 3. `ApprovalCard` (APPROVE-1/2/3) — promote `Confirmation` · `@qlik-coe-emea/qlabs-components-ai`

- **Current:** while pending, a neutral `Alert` with no variant (`confirmation.tsx:72-82`) — the _least_ prominent card exactly when it should be the most. Deny is a black `outline` button (`agentic-workspace.stories.tsx:787`). No consequence slot; no action-area separation.
- **Target:** a control-boundary surface — attention tint (status-subtle) + brand left accent rail + `border-border-strong` + `shadow-sm` — with a three-zone structure: **question** (up the type scale) → **consequence** (`ConfirmationDescription`, "Posts the final note to #finance; visible to 42 people") → a **separated action band** (filled green Approve + ghost Deny). Encode the approve/deny variants inside the card so consumers can't choose `outline` again. Keep the resolved success/destructive tint (it works).
- **Layer:** component-internal (pending treatment + structure + button grammar) + token (attention/rail). → [05](05-execution-traces.md#approval)

## 4. `AgentStep` / `AgentTimeline` (TRACE-1, TRACE-6) — new primitive · `@qlik-coe-emea/qlabs-components-ai`

- **Current:** six divergent trace containers (`Tool` box, `Plan` Card, `ChainOfThought`/`Task`/`Reasoning` bare divs, `Checkpoint` row). `ChainOfThought` hand-rolls a timeline that already exists in `@qlik-coe-emea/qlabs-components-editor`.
- **Target:** one vertical-rail step (icon + name + `StatusBadge` + business summary); `ChainOfThought`, `Task`, and inspect-only tool calls converge onto it. Hoist a shared rail into `@qlik-coe-emea/qlabs-components-ui` (don't fork a third timeline). → [05](05-execution-traces.md)
- **Layer:** missing-component (architect-gated).

## 5. `ToolResultCard` (TRACE-2, TRACE-3) — new surface · `@qlik-coe-emea/qlabs-components-ai`

- **Current:** `Tool` is JSON-first; a rendered chart lands under a muted uppercase "Result" heading next to raw-JSON siblings (`tool.tsx:132-156`).
- **Target:** for artifact-producing tool calls, the rendered chart/table/file is the **headline** on a light-elevation card; raw params/output sit behind a "Show technical details" disclosure (collapsed). Business-readable tools (`Tool`) get a one-line summary + the same disclosure. → [05](05-execution-traces.md)
- **Layer:** component-internal (`Tool` disclosure) + missing-component (`ToolResultCard`).

## 6. `KpiCard` = `MetricCard` extended (KPI-1/2/3/5) — edit · `@qlik-coe-emea/qlabs-components-ui`

- **Current:** sound (delta polarity, success/destructive tokens, `tabular-nums`, monochrome `data-polarity` + aria — KPI-5 all correct) but **single-treatment**: 24px value, no emphasis axis, no evidence slot; all four tiles equal-weight (`metric-card.tsx:21,60`; `agentic-workspace.stories.tsx:842`).
- **Target:** a `cva` `emphasis: default | headline` axis (headline → `--text-kpi` ~32-36px + more padding; default byte-for-byte) so one KPI reads as the answer; an optional **`MetricGrid` `featured`/`colSpan`** so the headline is expressible as data, not a per-story CSS hack; an optional subdued **evidence/source footer slot** (small muted text + optional green check / `EvidenceChip`).
- **Layer:** component-internal (`MetricCard`) + missing-component (`MetricGrid` feature). Owned by `@qlik-coe-emea/qlabs-components-ui` per ADR-0012; charts/editor re-export.
- **Guardrail (KPI-5):** emphasis comes from **size/weight/space, not hue** — keep green reserved for favourable deltas + evidence.

## 7. `EvidenceChip` (MSG-4, KPI-3) — new · `@qlik-coe-emea/qlabs-components-ai`

- **Current:** the citation is a muted-gray `<p>` + an `InlineCitation` (hover span + secondary `Badge`, `inline-citation.tsx:20-50`) with no evidence identity.
- **Target:** a green-tinted soft pill (sibling of `SuggestionChip` — tint-by-role) anchored near the claim; default content of `MetricCard`'s evidence slot. Reserves green for the "grounded / verified" signal per the brand guidance.
- **Layer:** missing-component + token (green-subtle).

## 8. `SourceList` (MSG-4) — structure `Sources` · `@qlik-coe-emea/qlabs-components-ai`

- **Current:** `Sources`/`SourcesTrigger count` is fine but reads as a generic collapsible; in the right rail it's a bare section.
- **Target:** a structured grounding footer — a green evidence chip header + an expandable list with source names + optional reconciliation notes — connected to the answer (and reused in the `ContextPanel` grounding section). → [04](04-context-panel-and-assets.md)
- **Layer:** component-internal (light structuring).

## 9. `ProducedAssetTree` (ASSET-1, ASSET-4, TYPE-5) — new · `@qlik-coe-emea/qlabs-components-ai`

- **Current:** `FileTree` (IDE code tree) hardcodes `font-mono` + hard border (`file-tree.tsx:69`); `--font-mono` also undefined in `:root`.
- **Target:** a document-feeling tree — UI font (sans), no hard `border bg-background` box (section header + spacing, optional soft `bg-muted/30` zone), asset-type icons (doc/csv/sql/image) first-class. Keep `FileTree` as the code surface via a `cva` `code | document` variant. → [04](04-context-panel-and-assets.md)
- **Layer:** component-internal (`FileTree` variant) + missing-component (`ProducedAssetTree`) + token (`--font-mono`).

## 10. `AssetPreview` (ASSET-2/3/4) — new · `@qlik-coe-emea/qlabs-components-ai`

- **Current:** story-local type-switch that renders markdown through `CodeBlock` (source) (`agentic-workspace.stories.tsx:466-485`).
- **Target:** a type-switch — **markdown → branded renderer** (ASSET-3), code/sql → `CodeBlock`, csv → small table/summary, png → image — with a **Preview/Raw toggle** (Raw keeps `CodeBlock`), reusing `Artifact` chrome for header/actions. Lifted selected-asset state for the drill-in. → [04](04-context-panel-and-assets.md)
- **Layer:** missing-component (+ the branded markdown renderer, ASSET-3).

## 11. `SuggestionChip` (BTN-2) — change default · `@qlik-coe-emea/qlabs-components-ai`

- **Current:** `Suggestion` defaults `variant="outline"` (`suggestion.tsx:27`) → a `border-input` pill.
- **Target:** default to a **soft tinted pill** (`secondary` / borderless `bg-secondary rounded-full`), `variant` still overridable. Pairs with `EvidenceChip` as a tint-by-role pill family.
- **Layer:** component-internal.

## 12. `CommandComposer` (BTN-3) — preset/variant of `PromptInput` · `@qlik-coe-emea/qlabs-components-ai`

- **Current:** `PromptInput` wraps `InputGroup` with `border-input shadow-sm` (`prompt-input.tsx:854`, `input-group.tsx:18`) — same hard edge as everything else.
- **Target:** a calm command bar — soft fill + the existing `focus-within` ring as the single strong signal (`input-group.tsx:23`), no hard outline. An `InputGroup variant="surface"` / `CommandComposer` preset so chat composers differ from data-entry fields. Cleaner tool icons + send-button alignment.
- **Layer:** component-internal.

## 13. `SidebarSection` (left nav) — mostly fine · `@qlik-coe-emea/qlabs-components-ui`

- **Current:** `SidebarGroup`/`SidebarGroupLabel`/`SidebarMenuSub*` already structure the left nav well; the "New chat" button is a primary-tinted `SidebarMenuButton` (`agentic-workspace.stories.tsx:291-299`).
- **Target:** the brief's left-sidebar asks (stronger selected-session state, more group breathing room, softer count badges, consistent icon sizing, cleaner profile area) are mostly **density + typography**, delivered by the type scale + the count-badge token + `data-active` treatment — not new components. Lowest-priority cluster.
- **Layer:** component-internal (minor) + token (the scale).

## 14. `StatusBadge` (TRACE-5, APPROVE-4) — new · `@qlik-coe-emea/qlabs-components-ui`

- **Current:** three incompatible idioms; `Tool`'s `getStatusBadge` hardcodes `text-yellow-600`…`text-red-600` (`tool.tsx:54-60`) — a tokens-only violation that won't track themes.
- **Target:** a token-driven badge mapping semantic status (pending/running/complete/awaiting-approval/denied/failed/skipped) → `Badge` variant + icon via `success`/`warning`/`destructive`/`info`/`secondary` + the status-subtle surfaces. Re-point `Tool`, `ChainOfThought`, `Confirmation`. The single place "green = done/approved" is decided. **File the raw-colour bug regardless of the redesign.** → [05](05-execution-traces.md)
- **Layer:** missing-component + token.

---

## What is NOT a new component (avoid widget-kit sprawl)

- `Reasoning`, `Plan`, `Checkpoint` stay distinct (genuinely different artifacts) —
  only their container **tokens** harmonize with the rail.
- `Card`, `Alert`, `Badge`, `Sidebar`, `Sources`, `Artifact`, `InlineCitation`,
  `Tool`, `Conversation`, `ChatShell` are **edited**, not replaced.
- The brief's named elements that already exist (`KpiCard`→`MetricCard`,
  `SuggestionChip`→`Suggestion`, `CommandComposer`→`PromptInput`,
  `SidebarSection`→`SidebarGroup`, `SourceList`→`Sources`, `ApprovalCard`→`Confirmation`)
  are **extended in place** per the reuse-audit gate — not forked.

Genuinely new: `ContextPanel` (+ parts), `ProducedAssetTree`, `AssetPreview`, the
`@qlik-coe-emea/qlabs-components-ai` markdown renderer, `AgentStep`/`AgentTimeline`, `ToolResultCard`,
`EvidenceChip`, and the `@qlik-coe-emea/qlabs-components-ui` `Text`/`Heading` + `StatusBadge` + a shared
`Timeline`/`CollapsiblePanel`.
