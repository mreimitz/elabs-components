# 01 · per-component reuse audit (the evidence)

Every shipped `@qlik-coe-emea/qlabs-components-ai` component: what base it reuses, what it hand-rolls, and the
bucket (① REPLACE-with-base · ② ENHANCE-base · ③ PROMOTE-down · ④ KEEP-AI-specific).
Read [`README.md`](./README.md) for the verdict; this is the appendix. `file:line` citations
are from a source read (Observed); the load-bearing ones were spot-verified. No code changed.

Legend — **Reuse** = base primitives correctly imported · **Hand-rolls** = UI built by hand
that overlaps an existing base · **Bucket** = recommended action.

## Chat core + disclosure

| Component              | Reuse (`@qlik-coe-emea/qlabs-components-ui`)                                                                 | Hand-rolls / overlap                                                                     | Bucket                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ----------------------------------------- |
| `conversation.tsx`     | `Button`                                                                                                     | `ConversationEmptyState` ≈ `StatePanel kind="empty"` (`:29-60`)                          | ① REPLACE                                 |
| `message.tsx`          | `Button`, `ButtonGroup`, `Tooltip*`                                                                          | branch carousel is chat-specific (not base `Carousel`)                                   | ④ KEEP                                    |
| `prompt-input.tsx`     | `Command*`, `DropdownMenu*`, `HoverCard*`, `InputGroup*`, `Select*`, `Spinner`, `Tooltip*` (excellent reuse) | `PromptInputTab*` raw `<div>` tabs, **no `role=tab/tabpanel`** (`:1227-1260`) → `Tabs`   | ① REPLACE (a11y)                          |
| `reasoning.tsx`        | `Collapsible*`                                                                                               | imports Radix `useControllableState` directly (util leak, not a UI dup)                  | ④ KEEP                                    |
| `sources.tsx`          | `Collapsible*`                                                                                               | `Source` raw `<a>` vs `Button asChild` (minor)                                           | ④ KEEP                                    |
| `tool.tsx`             | `Badge`, `Collapsible*`                                                                                      | delegates code to sibling `CodeBlock`; no dup                                            | ④ KEEP                                    |
| `suggestion.tsx`       | `Button`, `ScrollArea`, `ScrollBar`                                                                          | none — generic chip strip                                                                | ③ PROMOTE (borderline)                    |
| `task.tsx`             | `Collapsible*`                                                                                               | `TaskItemFile` = a `<span>` Badge (`:10-20`) → `Badge variant="secondary"`               | ① REPLACE                                 |
| `context.tsx`          | `Button`, `HoverCard*`, `Progress`                                                                           | `ContextIcon` hand-drawn radial ring (`:54-93`) — no base circular progress              | ② ENHANCE (`Progress variant="circular"`) |
| `snippet.tsx`          | `InputGroup*`                                                                                                | none — generic copy-snippet                                                              | ③ PROMOTE                                 |
| `shimmer.tsx`          | — (`@qlik-coe-emea/qlabs-components-tokens useReducedMotion`)                                                | motion text shimmer; relates to `Skeleton`                                               | ③ PROMOTE                                 |
| `inline-citation.tsx`  | `Badge`, `Carousel*`, `HoverCard*`                                                                           | `…CarouselPrev/Next` raw `<button>` ≈ exported `CarouselPrevious/Next` (`:161-211`)      | ① REPLACE                                 |
| `chat-shell.tsx`       | — (`cn` only)                                                                                                | header+transcript+sticky-composer+aside layout; partial `PageShell`/`SplitPanel` overlap | ② ENHANCE (chat layout primitive)         |
| `_chat-shell-rail.tsx` | —                                                                                                            | story fixture only (not shipped)                                                         | ④ KEEP                                    |
| `panel.tsx`            | — (`cn`)                                                                                                     | thin wrap of `@xyflow/react` `Panel`                                                     | ④ KEEP                                    |
| `toolbar.tsx`          | — (`cn`)                                                                                                     | thin wrap of `@xyflow/react` `NodeToolbar`                                               | ④ KEEP                                    |

## Generative / workspace / flow

| Component            | Reuse                                         | Hand-rolls / overlap                                                                                                     | Bucket                                      |
| -------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| `canvas.tsx`         | —                                             | dup of `@qlik-coe-emea/qlabs-components-flow` `CanvasShell`; uses `bgColor="var(--sidebar)"` not `--canvas-grid` (`:23`) | ② ENHANCE flow preset (can't import flow)   |
| `node.tsx`           | `Card*`                                       | `Card`-based compound, L↔R handles — **diverges** from flat `FlowNode`                                                   | ④ KEEP (document divergence)                |
| `edge.tsx`           | —                                             | `Edge.Animated`/`Temporary` add motion `FlowEdge` lacks — diverges                                                       | ④ KEEP (→ `animated` variant on `FlowEdge`) |
| `connection.tsx`     | —                                             | bespoke in-progress connection line; no base analog                                                                      | ④ KEEP                                      |
| `controls.tsx`       | — (`cn`)                                      | skins ReactFlow native `Controls`; **parallel** to flow `ZoomControls`                                                   | ② ENHANCE (one canonical control)           |
| `artifact.tsx`       | `Button`, `Tooltip*`                          | header/shell ≈ `Card`/`CardHeader` by hand (minor)                                                                       | ② ENHANCE (optional)                        |
| `sandbox.tsx`        | `Collapsible*`, `Tabs*`                       | style overrides on base tabs — fine                                                                                      | ④ KEEP                                      |
| `web-preview.tsx`    | `Button`, `Collapsible*`, `Input`, `Tooltip*` | iframe+urlbar+console — no base analog                                                                                   | ④ KEEP                                      |
| `terminal.tsx`       | `Button`                                      | **hardcoded `zinc-*`** colors, theme-unsafe (`:36,48,64,124,153,188,221`)                                                | ④ KEEP **but fix tokens**                   |
| `file-tree.tsx`      | `Collapsible*`                                | generic `role=tree`; no AI coupling                                                                                      | ③ PROMOTE                                   |
| `code-block.tsx`     | `Button`, `Select*`                           | Shiki read-only — **complements** Monaco `CodeEditor`, not a dup                                                         | ③ PROMOTE (architect-gated)                 |
| `jsx-preview.tsx`    | — (`cn`)                                      | runtime JSX eval — unique; error box could use `Alert` (`:270-278`)                                                      | ④ KEEP                                      |
| `schema-display.tsx` | `Badge`, `Collapsible*`                       | raw `bg-red-100 …` instead of `Badge` variants (`:43-49,156,231,269`); `dangerouslySetInnerHTML` (`:99`)                 | ① REPLACE (color)                           |
| `stack-trace.tsx`    | `Button`, `Collapsible*`                      | none meaningful                                                                                                          | ④ KEEP                                      |
| `test-results.tsx`   | `Badge` (semantic variants ✓), `Collapsible*` | segmented progress bar by hand — additive, no base analog                                                                | ④ KEEP                                      |

## Media + selectors + agent-meta

| Component                   | Reuse                                        | Hand-rolls / overlap                                                                             | Bucket                         |
| --------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------ |
| `audio-player.tsx`          | `Button`, `ButtonGroup*`                     | media-chrome shell — no base analog                                                              | ④ KEEP                         |
| `voice-selector.tsx`        | `Command*`, `Dialog*`, `Button`, `Spinner`   | `VoiceSelectorGender/Accent` raw chips (`:156-379`) → `Badge`                                    | ② ENHANCE (chips→Badge)        |
| `mic-selector.tsx`          | `Command*`, `Popover*`, `Button`             | manually rebuilds `Combobox` (`:188-331`)                                                        | ① REPLACE → `Combobox`         |
| `transcription.tsx`         | — (`cn`)                                     | karaoke word `<button>` (`:74-117`) — unique; could use `Button asChild`                         | ④ KEEP                         |
| `speech-input.tsx`          | `Button`, `Spinner`                          | `animate-ping` pulse rings — self-contained                                                      | ④ KEEP                         |
| `model-selector.tsx`        | `Command*`, `Dialog*`                        | `ModelSelectorLogoGroup` avatar stack (`:160-169`) ≈ `Avatar`                                    | ② ENHANCE (logos→Avatar)       |
| `image.tsx`                 | — (`cn`)                                     | raw `<img>` (`:13`) — no aspect control                                                          | ② ENHANCE (wrap `AspectRatio`) |
| `attachments.tsx`           | `Button`, `HoverCard*`                       | inline chip (`:192-209`)→`Badge`; `AttachmentEmpty` (`:386`)→`EmptyState`                        | ② ENHANCE                      |
| `persona.tsx`               | —                                            | Rive WebGL animated orb — unique (not `Avatar`)                                                  | ④ KEEP                         |
| `agent.tsx`                 | `Accordion*`, `Badge`                        | `AgentInstructions`/root ≈ `Card` by hand (`:16,52-54`)                                          | ② ENHANCE (optional)           |
| `plan.tsx`                  | `Button`, `Card*`, `Collapsible*`            | none — exemplary reuse                                                                           | ④ KEEP                         |
| `queue.tsx`                 | `Button`, `Collapsible*`, `ScrollArea`       | `QueueItemIndicator`/`QueueItemFile` chips (`:43-61,142-150`); raw trigger `<button>` (`:177`)   | ② ENHANCE (chips→Badge)        |
| `checkpoint.tsx`            | `Button`, `Separator`, `Tooltip*`            | none                                                                                             | ④ KEEP                         |
| `commit.tsx`                | `Avatar*`, `Button`, `Collapsible*`          | `CommitFileStatus` + add/del spans hardcode `text-green/red/yellow/blue-600` (`:259-344`)        | ① REPLACE (color)/②            |
| `environment-variables.tsx` | `Badge`, `Button`, `Switch`                  | container ≈ `Card`/`CardHeader`/`CardContent` by hand (`:62-76,208`)                             | ② ENHANCE (optional)           |
| `package-info.tsx`          | `Badge`                                      | raw color classes bypass `Badge` variants (`:43-49`); card shell (`:135`); dep list (`:171-205`) | ① REPLACE (color)              |
| `chain-of-thought.tsx`      | `Badge`, `Collapsible*`                      | step timeline w/ connector (`:99-129`) — no base `Stepper`                                       | ④ KEEP                         |
| `confirmation.tsx`          | `Alert*`, `Button`                           | uses `Alert` (info banner) for **approve/deny** → `AlertDialog`                                  | ① REPLACE (semantics + a11y)   |
| `open-in-chat.tsx`          | `Button`, `DropdownMenu*`                    | provider routing + inline brand SVGs — unique                                                    | ④ KEEP                         |
| `motion-config.tsx`         | — (`@qlik-coe-emea/qlabs-components-tokens`) | bridges tokens↔Motion; belongs in `@qlik-coe-emea/qlabs-components-tokens`                       | ③ PROMOTE                      |

## Roll-up counts

- **④ KEEP-AI-specific:** ~28 (most of the package) — the port is sound.
- **② ENHANCE-base / align:** ~12 — small generic additions (`Progress` circular, `Badge`
  dot/icon, `AspectRatio` wrap, `Card` deferral, flow presets).
- **① REPLACE-with-base:** ~8 — straight swaps (`StatePanel`, `Badge`, `Carousel*` buttons,
  `Combobox`, `Tabs`, `AlertDialog`, `Badge` semantic variants ×3).
- **③ PROMOTE-down:** ~5 — `CodeBlock`, `FileTree`, `Snippet`, `Shimmer`, `motion-config`
  (all zero AI coupling; `CodeBlock` is architect-gated by current rules).

## Cross-cutting themes (the patterns behind the rows)

1. **Raw status colors instead of `Badge` variants.** `schema-display`, `package-info`,
   `commit`, `terminal` write `bg-red-100`/`text-green-600`/`zinc-*` directly. `Badge`
   already ships `destructive`/`success`/`warning`. This is a **theme-safety** defect, not
   cosmetics — `.claude/rules/styling-and-tokens.md` (no raw color outside `themes.css`).
2. **Hand-rolled `Card`/empty-state shells.** `environment-variables`, `package-info`,
   `agent`, `artifact`, `conversation` re-draw `rounded-lg border bg-*` containers that
   `Card`/`StatePanel` already standardize — `plan.tsx` shows the right way.
3. **Pickers split correctly but inconsistently.** Full-screen pickers (`model`/`voice`)
   rightly use `Command`+`Dialog`; the compact one (`mic`) re-builds `Combobox` by hand. Use
   `Combobox` for compact, `Command`+`Dialog` for palette — pick by size, not by re-rolling.
4. **Flow is a forced fork.** The only large structural duplication, and it's a consequence
   of the peer-dependency rule, not carelessness — resolve by **alignment** (shared tokens +
   presets on `@qlik-coe-emea/qlabs-components-flow`), since a direct import is illegal.
