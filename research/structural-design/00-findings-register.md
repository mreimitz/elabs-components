# 00 · Findings register

The full evidence base. 35 findings from the 8-finder root-cause sweep, deduped
and re-ID'd into a collision-free scheme (the finders independently reused
`A`/`C` prefixes). Each finding: symptom → root cause (`file:line`) → **layer** →
severity → fix. Layers: `token-theme` · `component-internal` ·
`component-choice` (wrong component used) · `scenario-composition` ·
`missing-component`.

Severity reflects _how much it blocks the stated goal_, not user-facing breakage:
**P0** = a primary cause of a complaint; **P1** = blocks the target grammar;
**P2** = polish / latent.

ID prefixes: `PANEL` (context panel) · `ASSET` (produced assets) · `MSG`
(message grammar) · `TRACE` (execution) · `APPROVE` (approval) · `BTN`
(buttons/borders/composer) · `KPI` · `TYPE` (typography/token backbone).

---

## PANEL — right context panel: animation + drill-in

### PANEL-1 · Right rail is conditionally mounted, so it can never animate — P1 · missing-component

- **Symptom:** toggling the header `PanelRight` button pops the rail in/out instantly; the left Sidebar collapses smoothly.
- **Root cause:** the rail is `{railOpen ? <ContextRail /> : null}` — mount/unmount has no intermediate width to tween (`agentic-workspace.stories.tsx:1100`). The Sidebar is **always mounted** and animates a gap-spacer `transition-[width] duration-base ease-linear → w-0` (`sidebar.tsx:196-205`) plus a `fixed` container sliding `transition-[left,right,width] duration-base ease-linear` (`sidebar.tsx:206-219`); `duration-base` resolves to the gated `--t-base` (`themes.css:310`). The rail's own `<aside>` has no transition, no `data-state`, no spacer (`agentic-workspace.stories.tsx:492`).
- **Fix:** an always-mounted, width-animating component (PANEL-2), not a transition class bolted onto this `<aside>`.

### PANEL-2 · No `ContextPanel`/`Inspector` exists in `@qlik-coe-emea/qlabs-components-ai` — P1 · missing-component

- **Symptom:** every app must re-create the ~100-line rail by hand and re-acquire its bugs.
- **Root cause:** `@qlik-coe-emea/qlabs-components-ai`'s `panel.tsx` is a React-Flow `<Panel>` re-export, not a chat rail (`panel.tsx:1-12`). `ChatShell`'s `aside` prop is inert layout (`chat-shell.tsx:13,38`). The closest real pattern — flow's `InspectorPanel` (always-mounted `flex h-full w-72 flex-col border-s bg-surface` + header + `Reveal key=` body, `inspector-panel.tsx:27-79`) — is in the wrong package and single-view.
- **Fix:** a compound, lifted-state `ContextPanel` in `@qlik-coe-emea/qlabs-components-ai` (Provider owns `{ open, view, selectedAsset }` + `{ toggle, openDetail, back }`, interface modeled on `SidebarProvider`). Route through `brand-ui-design-system-architect`.

### PANEL-3 · No drill-in: preview is stacked permanently, no focused view, no back button — P1 · missing-component

- **Symptom:** clicking a file only swaps a preview that's always shown _below_ the tree; tree + grounding + preview compete in one scroll; no transition, nothing to go "back" from.
- **Root cause:** a single flat `asset` string (`agentic-workspace.stories.tsx:488`); grounding + tree + preview render as three simultaneous `<section>`s (`:504-586`); `onSelect={setAsset}` (`:531`) only changes _which_ file renders — no `view: 'root'|'detail'` mode, no back affordance.
- **Fix:** model drill-in as a two-view state inside the `ContextPanel` provider. Transition = the canonical View-Transitions "list→detail morph" (`view-transitions/01-design.md` §6.1, the earmarked primary proof case) — but ship the safe CSS-gated fallback first (a two-pane `translateX` track, or `AnimatePresence` slide behind an internal `BrandMotionConfig`), shaped so a later `useViewTransition` swap is internal-only. **Not** a Radix Dialog/Sheet — drill-in stays inside the rail width.

### PANEL-4 · Rail lacks every Sidebar affordance (keyboard, drag-rail, persistence, tooltips, mobile Sheet) — P2 · missing-component

- **Root cause:** those behaviours live in the Sidebar provider/parts: ⌘B (`sidebar.tsx:91-100`), cookie persistence (`:80-82`), drag rail (`:256-278`), collapsed tooltips (`:521-534`), mobile Sheet (`:164-183`). The rail is a bare `<aside>` + one `useState` + one toggle (`agentic-workspace.stories.tsx:492,961,1015-1023`).
- **Fix:** fold a deliberate subset into `ContextPanel` (persistence + collapse yes; global keyboard maybe app-owned per the library-vs-app line). Long-term: extract the Sidebar collapse mechanism into a shared `@qlik-coe-emea/qlabs-components-ui` `CollapsiblePanel` so left nav, this rail and flow's `InspectorPanel` share one implementation (WP-13 drift risk).

### PANEL-5 · A JS/Framer rail animation would silently bypass the motion gate (no `BrandMotionConfig`) — P2 · scenario-composition

- **Root cause:** `BrandMotionConfig` bridges `useReducedMotion()` into motion.dev (`motion-config.tsx:39-49`); `MOTION_GUIDELINES.md` requires wrapping the Motion subtree near the root. The workspace tree has no such ancestor (`agentic-workspace.stories.tsx:986-1101`).
- **Fix:** prefer the CSS-gated mechanism (auto-gates via `--t-*`, needs no `BrandMotionConfig`); if `AnimatePresence` is needed, `ContextPanel` renders its own internal boundary so a consumer can't forget it.

---

## ASSET — produced assets: tree font + markdown-as-code

### ASSET-1 · `FileTree` hardcodes IDE-code styling (mono + hard border) — P1 · component-internal

- **Symptom:** the produced-assets list is monospace inside a hard grey box — reads like a code editor's explorer, louder than the surrounding prose.
- **Root cause:** `cn("rounded-lg border bg-background font-mono text-sm", className)` at `file-tree.tsx:69`. `font-mono` is unconditional; the story's `className="text-sm"` (`agentic-workspace.stories.tsx:532`) can't strip it (no later font utility for tailwind-merge to win with). `FileTree` is structurally an IDE source tree repurposed for business documents.
- **Fix:** (a) make the mono/border treatment a `cva` variant (`code | document`); (b) introduce a purpose-built `ProducedAssetTree` (ASSET-4) defaulting to the document variant.

### ASSET-2 · `AssetPreview` renders a markdown _document_ as Shiki _source_ via `CodeBlock` — P0 · component-choice

- **Symptom:** clicking `board-note.md` shows raw `# …`, literal `**bold**`, `-` bullets, syntax-highlighted in a mono code block — not a rendered note.
- **Root cause:** `return <CodeBlock code={BOARD_NOTE_MD} language="markdown" wrap />` (`agentic-workspace.stories.tsx:484`). `CodeBlock`'s body is unconditionally mono + bordered (`code-block.tsx:271-276,301`) — it can only show markdown-as-code. The same kind of prose is rendered correctly via `<MessageResponse>` 390 lines down (`:874`). The repo already renders markdown; the preview picked the wrong tool.
- **Fix:** render markdown as markdown (see ASSET-3); keep a Preview/Raw toggle (Raw = `CodeBlock`).

### ASSET-3 · `@qlik-coe-emea/qlabs-components-ai` needs its OWN branded markdown renderer — can't import `@qlik-coe-emea/qlabs-components-editor` — P0 · missing-component

- **Symptom:** the "correct" branded renderer (`MarkdownPreview`) lives in `@qlik-coe-emea/qlabs-components-editor/markdown`, but `@qlik-coe-emea/qlabs-components-ai` may not import it.
- **Root cause:** one-way dep graph — `@qlik-coe-emea/qlabs-components-ai` and `@qlik-coe-emea/qlabs-components-editor` are siblings; importing editor from ai is a `DEP_DIRECTION_VIOLATION` (confirmed no `@qlik-coe-emea/qlabs-components-editor` dep, `packages/ai/package.json:29-54`). `MarkdownPreview`'s brandedness comes from the **prose primitives** that live _only_ in `packages/editor/src/prose/prose.tsx`. Note `MessageResponse` passes _no_ `components` map (`message.tsx:275-285`), so it renders Streamdown defaults — weaker than `MarkdownPreview`'s brand-component mapping.
- **Fix:** build a branded read-only markdown renderer native to `@qlik-coe-emea/qlabs-components-ai` on the **existing** `streamdown` dep (`package.json:44`). For true brand output, **promote the prose primitives down to `@qlik-coe-emea/qlabs-components-ui`** (their own doc comment says they're generic, `prose.tsx:1-6`) so both editor's `MarkdownPreview` and the new `@qlik-coe-emea/qlabs-components-ai` renderer map onto one source — dep graph stays one-way (`ui → ai`, `ui → editor`). Architect-gated (relocates a public surface).

### ASSET-4 · `ProducedAssetTree`/`AssetPreview`/`ContextRail` are hand-rolled in the story — P1 · missing-component

- **Root cause:** grep for `AssetPreview`/`ProducedAsset`/`AssetTree` across `packages/`+`registry/` → only `agentic-workspace.stories.tsx`. The story assembles raw `Artifact` + a bare type-switch (`:466-485`) + raw `FileTree` (`:528-565`); because the blocks are unopinionated, it invented the composition — and its choices are ASSET-1/ASSET-2.
- **Fix:** a small `@qlik-coe-emea/qlabs-components-ai` produced-asset suite — `ProducedAssetTree` (document variant, asset-type icons) + `AssetPreview` (type-switch: markdown→branded, code/sql→`CodeBlock`, csv→table/summary, png→image) with Preview/Raw, reusing existing `Artifact` chrome. Lifted selected-asset state for the drill-in.

---

## MSG — message grammar: user vs agent vs final answer

### MSG-1 · `Message` uses `bg-secondary` (≈ white) and ignores the orphaned `--chat-user` tokens — P1 · component-internal

- **Symptom:** user bubble and assistant block are nearly indistinguishable on the white card.
- **Root cause:** `MessageContent` hardcodes user = `bg-secondary`, assistant = bare `text-foreground` (`message.tsx:38-39`). In qlik-bright `--secondary = oklch(0.95 0.012 252)` on white `--background` (`themes.css:732,719`) — a ~5% lightness delta. Meanwhile `--chat-user`/`--chat-assistant` are defined in **all six themes** and bridged to `bg-chat-*` utilities (`themes.css:189-192,1030-1033`) with **zero consumers** — and in qlik-bright `--chat-user` is set to the _same_ value as `--secondary` (`:790`), so adopting it _alone_ won't fix it; the token value also needs separation.
- **Fix:** (component) wire `MessageContent` to `bg-chat-user`/`text-chat-user-foreground` + give the assistant its own ground/accent-rail; (token) revalue `--chat-user` per theme to a perceptibly stronger tint than `--secondary`. **Token-value edit ⇒ six-theme `brand-ui-visual-ux-reviewer` sweep before merge.**

### MSG-2 · No identity affordance (avatar / role label) on messages — P2 · missing-component

- **Root cause:** `Message` sets only alignment from `from` (`message.tsx:21-30`); `MessageContent` has no header/avatar slot (`:34-46`); no `MessageHeader`/`UserMessage`/`AgentMessage` exists (`index.ts:29`). The workspace's avatar + `BrandLogo` live only in the sidebar (`agentic-workspace.stories.tsx:430-436`).
- **Fix:** add an optional `MessageHeader`/`MessageAvatar` slot + thin `UserMessage`/`AgentMessage` wrappers that preset it.

### MSG-3 · `MessageContent` forces `text-sm` on all content, so markdown prose has no scale — P1 · component-internal

- **Root cause:** `MessageContent` applies blanket `text-sm` (`message.tsx:37`); `MessageResponse` adds only margin-resets (`:275-285`); no typography/prose plugin in the repo. So Streamdown headings/bold inherit small body text. (MetricCard escapes only because it hardcodes `text-2xl/sm/xs`.)
- **Fix:** give `MessageResponse` its own brand-tokened prose scale (consume the type-scale roles — TYPE-1 — and the markdown-scale tokens), in the component, not the story.

### MSG-4 · The final answer crams KPIs + prose + citation + sources + actions into one flat block — P2 · scenario-composition

- **Root cause:** the whole answer is one `MessageContent` with no sectioning (`agentic-workspace.stories.tsx:839-943`); the citation is a muted `<p>` (`:875-914`); `InlineCitation` is a hover-span + secondary `Badge` with no evidence identity (`inline-citation.tsx:20-50`).
- **Fix:** an `AgentMessage` answer grammar (headline KPI band → prose → grounding footer) + an `EvidenceChip` (green-tinted, anchored to the claim).

### MSG-5 · Dead/misleading `is-user:dark` class on `MessageContent` — P2 · component-internal

- **Root cause:** `message.tsx:37` carries `is-user:dark`; the `@custom-variant dark` matches only when the _document_ theme is dark (`themes.css:85-89`), not the user bubble — an upstream AI-Elements dark-flip leftover, evidence the styling was ported not re-derived (hence MSG-1).
- **Fix:** remove it when reworking `MessageContent`; replace the role block with explicit chat-token utilities.

---

## TRACE — agent execution: tool / plan / task / chain-of-thought / reasoning / checkpoint

### TRACE-1 · Five divergent collapsible-trace idioms; no shared execution grammar — P1 · missing-component

- **Root cause:** vendored individually with no shared "agent step" contract: `Tool` = bordered `rounded-md` box (`tool.tsx:24`); `Plan` = `Card` (`plan.tsx:45`); `ChainOfThought` = borderless step list (`chain-of-thought.tsx:52,109-128`); `Task` = borderless + left-border content (`task.tsx:62`); `Reasoning` = inline text (`reasoning.tsx:130`); `Checkpoint` = inline row (`checkpoint.tsx:13-21`). Stacked, they read as unrelated widgets.
- **Fix:** one `AgentStep`/`AgentTimeline` primitive (icon + name + `StatusBadge` + business summary on a vertical rail); converge `ChainOfThought`, `Task`, inspect-only tools onto it. Keep `Plan`/`Checkpoint` distinct but harmonize tokens.

### TRACE-2 · `Tool` exposes raw JSON input **and** output by default — P0 · component-internal

- **Symptom:** every tool call shows a "Parameters" JSON block + a "Result" JSON block, no business summary; raw SQL + `{rows, q3_total…}` are the primary transcript content.
- **Root cause:** JSON-first by construction — `ToolInput` always pipes input through `CodeBlock language='json'` (`tool.tsx:111-120`); `ToolOutput` `JSON.stringify`s objects and even wraps strings as `language='json'` (`:127-156`). No summary slot, no disclosure gate.
- **Fix:** a business-summary headline + a nested "Show technical details" disclosure (collapsed) holding the JSON.

### TRACE-3 · Rich tool outputs (a chart) land inside the JSON "Result" frame, not a `ToolResultCard` — P1 · component-choice

- **Root cause:** `ToolOutput` has one path for all outputs (`tool.tsx:132-154`): a React element renders bare under a muted uppercase "Result" heading, an object is stringified. The polished chart (`agentic-workspace.stories.tsx:737-773`) is framed identically to a debug blob.
- **Fix:** a `ToolResultCard` for artifact-producing calls (rendered chart/table/file as headline, raw params/output behind the TRACE-2 disclosure).

### TRACE-4 · Too many traces are `defaultOpen` — P1 · scenario-composition

- **Root cause:** scenario forces open Plan (`:620`), ChainOfThought (`:650`), Tool#1 (`:682`), Tool#3 chart (`:726`), Task (`:804`); Reasoning auto-opens; only Tool#2 is collapsed. Compounded by component defaults: `Task` defaults `defaultOpen=true` (`task.tsx:32`), `Reasoning` auto-opens (`reasoning.tsx:65`).
- **Fix:** default-open only the chart + final summary once TRACE-1/2 give traces a calm collapsed-summary state; reconsider `Task`'s open default.

### TRACE-5 · No `StatusBadge`; status logic duplicated + uses raw Tailwind palette colours — P1 · missing-component _(+ latent theme-safety bug)_

- **Root cause:** three incompatible status idioms — `Tool` `getStatusBadge` always renders a grey `secondary` badge with **hardcoded** `text-yellow-600`/`blue-600`/`green-600`/`orange-600`/`red-600` icons (`tool.tsx:43-68`, colours at `:54-60`) — a tokens-only violation that won't track themes; `ChainOfThought` uses text-opacity only (`chain-of-thought.tsx:93-97`); `Confirmation` maps to `Alert` variant (`confirmation.tsx:72-96`). `Badge` itself has no status semantics.
- **Fix:** a token-driven `StatusBadge` in `@qlik-coe-emea/qlabs-components-ui` (semantic status → variant + icon via `success`/`warning`/`destructive`/`info`/`secondary`); re-point all three. Fixes the raw-colour bug too — **file regardless of the redesign.**

### TRACE-6 · `ChainOfThought` reinvents a `Timeline` that already exists (wrong package) — P2 · missing-component

- **Root cause:** `ChainOfThoughtStep` hand-rolls an icon/label/description + absolutely-positioned connector with `done|active|pending` (`chain-of-thought.tsx:109-128`); `@qlik-coe-emea/qlabs-components-editor` ships a `Timeline` with the identical grammar (`editor/src/timeline/timeline.tsx:10-36`), unreachable across the dep boundary.
- **Fix:** when building `AgentStep` (TRACE-1), hoist a shared rail into `@qlik-coe-emea/qlabs-components-ui` both consume — don't fork a third. Architect-gated.

### TRACE-7 · `Task` uses a search/file-pill idiom; semantics ("what got done") mismatch — P2 · component-choice

- **Root cause:** vendored as a search/sources disclosure (default `SearchIcon` `task.tsx:44`, bordered `bg-secondary` file pills `:10-20`) but used as the completion summary (`agentic-workspace.stories.tsx:804-828`); the pills also duplicate the produced-assets tree and add border noise.
- **Fix:** route the completion summary to the `ToolResultCard`/run-summary surface; at minimum drop the search icon + bordered pills, cross-link the asset tree.

---

## APPROVE — approval / decision boundary

### APPROVE-1 · The pending approval has the SAME treatment as a Tool card — P0 · component-internal

- **Symptom:** while awaiting a decision the Confirmation is a plain white bordered box, indistinguishable from the Tool/Task cards around it — least prominent exactly when it should be most.
- **Root cause:** `Confirmation` is built on `Alert` and computes `resolvedVariant` only for _resolved_ states (`confirmation.tsx:72-76`); in `approval-requested`, `approved` is `undefined` → `variant` `undefined` → `Alert` `default` = `bg-card` + base `rounded-lg border` (`alert.tsx:6,10`), same _kind_ as `tool.tsx:24`. Colour/elevation arrive only **after** the user decides — backwards.
- **Fix:** give the pending state a control-boundary treatment (brand left accent rail + attention tint + `border-border-strong` + `shadow-sm`); promote into a first-class `ApprovalCard`.

### APPROVE-2 · Deny uses `variant="outline"` → harsh near-black outline — P1 · component-choice

- **Root cause:** `<ConfirmationAction variant="outline">Deny` (`agentic-workspace.stories.tsx:787`); `outline` = `border border-input bg-background` (`button.tsx:14`); `--input` is the strong rung `oklch(0.65 …)`, ~3.5× the lightness step from white vs the hairline `--border` (`themes.css:159 vs 156`; qlik-bright `:763 vs 760`). Reads as a hard black outline and competes with Approve. (Approve is already correct — filled green `bg-primary` default, `button.tsx:11,27`.)
- **Fix:** Deny = `ghost` (or subtle-destructive), never `outline`; encode the approve/deny pairing inside `ApprovalCard`.

### APPROVE-3 · No separation between "what will happen" and the action area — P1 · component-internal

- **Root cause:** `Confirmation` lays children as `flex flex-col gap-2` (`confirmation.tsx:82`); `ConfirmationActions` is `flex justify-end gap-2` (`:171`) — no divider/footer band; only `ConfirmationTitle` exists (no consequence/explanation slot), and the story supplies one line (`:782-785`).
- **Fix:** a three-zone structure — question (up the type scale) → consequence/`ConfirmationDescription` → a `border-border-strong`-divided or tinted action band. Mirror `AlertDialog` title/description/footer.

### APPROVE-4 · Tool status icons hardcode raw palette colours (not theme-safe) — P2 · token-theme

- _Duplicate of TRACE-5's colour defect, seen from the approval side._ Replace `text-{color}-600` in `tool.tsx:54-60` with semantic status tokens so approval + tool statuses share one theme-safe language.

### APPROVE-5 · `Checkpoint` restore is a low-contrast ghost control — P2 · component-choice

- **Root cause:** wrapped in `text-muted-foreground` (`checkpoint.tsx:15`); `CheckpointTrigger` defaults `variant="ghost" size="sm"` (`:35-37`) — at rest indistinguishable from a muted label, though it changes agent state.
- **Fix:** make it _read_ as an actionable restore (leading icon + non-muted label, subtle hover affordance) without escalating to the approval treatment (budget: one focal control gesture per region).

---

## BTN — buttons, border noise, suggestion chips, composer

### BTN-1 · The "harsh black border" is `--input` on non-field controls — P1 · component-choice

- **Root cause:** `outline` = `border border-input` (`button.tsx:14`); `--input` is the deliberate AA-strong rung (qlik-bright `oklch(0.65 0.014 252)` = `--border-strong`; **pure black `oklch(0 0 0)` in high-contrast**, `themes.css:763,762,640`), correct for editable fields, wrong on fill-less buttons/chips where the boundary is redundant. Used at Share (`agentic-workspace.stories.tsx:1024`) and Deny (`:787`).
- **Fix:** **do not** change `--input` (breaks form fields + high-contrast). Route non-field controls off `outline`: Share → `ghost`/`secondary`; add an `outline-subtle` button variant (`border-border`, the hairline) for legitimate calm-outline needs.

### BTN-2 · Suggestion chips are outline Buttons, not soft pills — P1 · component-internal

- **Root cause:** `Suggestion` hardcodes `variant="outline"` + `rounded-full px-4` (`suggestion.tsx:27,38`) → a `border-input` pill that competes with real controls.
- **Fix:** default `Suggestion` to a soft tinted pill (`variant="secondary"` or a borderless `bg-secondary` pill); `--secondary` is AA-safe in all six themes. The canonical `SuggestionChip`.

### BTN-3 · The composer is a bordered `InputGroup` box, not a calm command bar — P1 · component-internal

- **Root cause:** `PromptInput` wraps children in `<InputGroup>` whose root is `rounded-md border border-input shadow-sm` (`prompt-input.tsx:854`, `input-group.tsx:18`); the textarea is borderless (`:134`), so the hard edge is the `--input` frame. The composer footer already draws a `border-t` (`chat-shell.tsx:36`), so the box border is redundant; `bg-background` gives zero fill separation.
- **Fix:** soft fill + ring — `border-border bg-surface-muted shadow-sm`, focus carried by the existing `focus-within` ring (`input-group.tsx:23`). A `CommandComposer` preset/`InputGroup variant="surface"` so command bars differ from data-entry fields.

### BTN-4 · Border noise is systemic: nearly every type is a `rounded border bg-background/card` box — P0 · token-theme

- **Symptom:** Tool, Task, Artifact, FileTree, Alert/Confirmation, ChatShell, Card all draw the same outlined white rectangle, so the border channel carries no type info.
- **Root cause:** each component independently reaches for a bordered box (`tool.tsx:24`, `artifact.tsx:15`, `file-tree.tsx:69`, `task.tsx:13`, `alert.tsx:6`, `card.tsx:20`, `chat-shell.tsx:27`), all resolving to the **subtle** `--border` via the global `@layer base * { border-color: var(--color-border) }` (`themes.css:1107`). The defect is **uniformity**, not harshness — the diagnosis "lighter border" is wrong; the border is already the hairline.
- **Fix:** assign one separation channel per interaction type (tinted zone / accent rail / elevation / spacing) using existing `--surface*`/`--secondary`/`--accent` + status washes, and **drop the border where a fill/gap/elevation already separates** the region (the `styling-and-tokens.md` redundant-boundary test). Codify a "one separation channel per region" rule + a lint heuristic.

---

## KPI — MetricCard hierarchy

### KPI-1 · Value typography (24px) has no headline tier — P1 · component-internal

- **Root cause:** `MetricCard` hardcodes one value treatment `text-2xl font-semibold tracking-tight tabular-nums` (`metric-card.tsx:60`); plain `forwardRef`, no `cva`, no emphasis prop (`:5-18,21`). All four tiles read equal; nothing is "the answer."
- **Fix:** add a `cva` `emphasis: default | headline` axis (headline → `text-3xl/4xl` + more padding; default byte-for-byte). Canonical `@qlik-coe-emea/qlabs-components-ui` (ADR 0012); charts/editor re-export.

### KPI-2 · No headline-KPI emphasis expressible as data — P1 · missing-component

- **Root cause:** four equal cards in `MetricGrid columns={4}` (`agentic-workspace.stories.tsx:842`); `MetricGrid` offers only `columns 2|3|4` + reveal, no span/feature (`metric-grid.tsx:5-18`). Only fix today = per-story CSS hack.
- **Fix:** pair KPI-1's emphasis with an optional `MetricGrid` `featured`/`colSpan`; scenario change collapses to `emphasis="headline"` on one card.

### KPI-3 · No source/evidence slot on the tile — P2 · component-internal

- **Root cause:** slots are label/value/description/delta/icon/visual only (`metric-card.tsx:5-18`); `description` is one muted `p` already used for QoQ (`:74`); citation sits detached below the grid (`agentic-workspace.stories.tsx:875-878`).
- **Fix:** an optional subdued evidence footer slot (small muted text + optional green check / `EvidenceChip`).

### KPI-4 · Scenario: KPI #4 bakes its delta into the value — P2 · scenario-composition

- **Root cause:** "Cloud subscriptions" renders `value="+18%"` with no `delta`/`deltaDirection` (`agentic-workspace.stories.tsx:867-872`), so the polarity/arrow/colour path (`metric-card.tsx:36-72`) never runs; +18% reads as a flat neutral number while peers get the favourable treatment.
- **Fix:** give it a real value + move `+18%` to `delta`/`deltaDirection="up"`. Pure story fix. A story-test could assert all-or-none delta within a grid.

### KPI-5 · Delta polarity colour system is correct — no change — P2 · (verification)

- `MetricCard` maps polarity → `text-success-text`/`text-destructive-text`/`text-muted-foreground` with a `positiveIsGood` flip + a theme-agnostic `data-polarity` hook + AT `aria-label` + `tabular-nums` (`metric-card.tsx:36-50,60,65-67`); tokens present in every theme (`themes.css:142-145,988-992`). **Do not add colour.** Headline emphasis (KPI-1) must use size/weight/space, not hue — keep green deliberate.

---

## TYPE — typography scale + token backbone (the keystone)

### TYPE-1 · No semantic type-scale tokens exist at all — P0 · token-theme

- **Root cause:** `themes.css` defines only `--font-sans` (`:108`) + `--font-mono` (blueprint only, `:1153`); `@theme inline` (`:961-1085`) maps colour/radius/motion and **nothing** for size/leading/tracking/weight. Zero `--text-*` anywhere in `packages/*/src`. `styling-and-tokens.md` is silent on typography. The only numeric scale (`markdown-scale.ts`) is an editor-internal detail mirroring Tailwind steps (`:16-18`).
- **Fix:** add ~7 named **role** tokens to `:root` (theme-invariant) + bridge in `@theme inline` so Tailwind emits `text-<role>` utilities: `--text-display` (~30px) · `--text-title` (~20px) · `--text-subtitle` (~16px) · `--text-body` (= current `text-sm`, so nothing shifts) · `--text-secondary`/meta (~12px) · `--text-kpi` (~32-36px) · `--text-code`. Each bundles size + line-height + tracking + weight intent. Add a `styling-and-tokens.md` typography section + a gate flagging new raw `text-sm/xs` in component source.

### TYPE-2 · The codebase is overwhelmingly `text-sm`/`text-xs` (326 vs ~15) — P0 · token-theme

- **Root cause:** non-story/test component source: `text-sm` ×193, `text-xs` ×133 vs `text-lg` ×7, `text-base` ×6, `text-2xl` ×3, `text-xl` ×2, `text-3xl` ×2. With no role token to reach for, every author defaults to `text-sm`. The flatness is the aggregate — a per-component or per-scenario fix can't solve it.
- **Fix:** introduce the scale (TYPE-1), then re-point the **shared primitives** (CardTitle, SectionHeader, DialogTitle, MetricCard, Message authorship, the new grammar components) — not all 326 sites. Keep `--text-body == text-sm`. Track the count as a regression metric.

### TYPE-3 · `CardTitle` has no size class — inherits ambient `text-sm` — P1 · component-internal

- **Root cause:** `CardTitle` = `font-semibold leading-none tracking-tight` with **no** `text-*` (`card.tsx:265`); `CardDescription` is `text-sm` (`:279`). Title and description differ only by weight, not size — the per-component symptom of the missing scale.
- **Fix:** point `CardTitle` at `--text-title` after TYPE-1. One line fixes every card.

### TYPE-4 · Title sizes are ad-hoc per component (no shared scale) — P1 · component-choice

- **Root cause:** `SectionHeader` h2 = `text-xl` (`section-header.tsx:30`), `DialogTitle` = `text-lg` (`dialog.tsx:105`), `MetricCard` value = `text-2xl` (`metric-card.tsx:60`), `CardTitle` unsized (`card.tsx:265`); editor's prose `Heading` has its own scale (`prose.tsx:17-24`). Multiple independent scales = no scale.
- **Fix:** re-point all title subcomponents to the same role tokens; derive editor's prose `Heading` + `markdown-scale.ts` from them so the markdown scale and app scale are one source.

### TYPE-5 · No `--font-mono` in `:root` — non-blueprint themes fall back to a clashing system mono — P1 · token-theme

- **Symptom:** the FileTree's "different font" — half of complaint #2.
- **Root cause:** `font-mono` resolves to `--font-mono`, but `:root` never defines it (only `--font-sans`, `themes.css:108`); it's set _only_ in blueprint (`:1153`). So qlik-bright/qlik-dark/light/dark/high-contrast fall through to Tailwind's default mono stack — a different family from Inter.
- **Fix:** (token) add a brand-aligned `--font-mono` to `:root` (e.g. the vendored IBM Plex Mono) + add it to the theme-parity allowlist; (component) the produced-asset tree shouldn't be mono at all (ASSET-1/ASSET-4).

### TYPE-6 · The grammar's non-colour channels are under-tokened — P1 · token-theme

- **Root cause:** **HAVE** but unused: `--chat-user`/`--chat-assistant` (ignored by `Message`, MSG-1), `--surface*` (`bg-surface-elevated` used ~4×, `shadow-sm` ~21× across all component src). **MISSING:** accent-rail tokens, status-subtle badge surfaces (only `--success`/etc. fills + `-text` variants exist, `themes.css:142-154`), an evidence/grounding tint. So the only systemic differentiator left is `--border` → everything gets a border (BTN-4).
- **Fix:** add to every theme block (parity-gated): keep `--chat-user` as the user tint (revalued, MSG-1); status-subtle surfaces (`--success-subtle`/`--warning-subtle`/`--info-subtle`/`--destructive-subtle`); accent-rail roles (reuse `--primary` completed, `--info` in-progress, `--muted` technical); document the `surface → surface-muted → surface-elevated + shadow-sm` elevation ladder as the sanctioned border-replacement.

### TYPE-7 · No `Text`/`Heading` primitive in `@qlik-coe-emea/qlabs-components-ui` — only in editor's prose — P1 · missing-component

- **Root cause:** `packages/ui/src/components` has no text/heading/typography component; `@qlik-coe-emea/qlabs-components-ui` barrel exports none; the only `Heading`/`Text` live in `packages/editor/src/prose/prose.tsx`, markdown-scoped + capped at `text-2xl` (`:30-66`). App authors have nothing to reach for → they hardcode `text-sm` (root of TYPE-2).
- **Fix:** add `Text` + `Heading` to `@qlik-coe-emea/qlabs-components-ui` mapping variants onto the role tokens; have editor's prose re-export/derive from them (one vocabulary). The agent-legible surface the new grammar composes from. Per ADR-0012 precedent (`@qlik-coe-emea/qlabs-components-ui` owns the primitive; editor re-exports).
