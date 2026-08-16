# 01 · Root-cause map

Each maintainer complaint and each stated design goal, mapped to its **symptom →
root cause (`file:line`) → layer → where the fix lives**. This is the
"analyze every single problem and find out _why_" deliverable in one scannable
place. Detailed evidence is in [00-findings-register.md](00-findings-register.md);
finding IDs are cross-referenced.

Legend — layer: **T**=token-theme · **CI**=component-internal · **CC**=component-choice ·
**SC**=scenario-composition · **MC**=missing-component.

---

## A. The three explicit complaints

### Complaint 1 — "the right context panel is not animated like the left menu"

| #       | Symptom                                   | Root cause                                                                                                                                                                                                   | Layer       | Fix location                                                                                             |
| ------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | -------------------------------------------------------------------------------------------------------- |
| PANEL-1 | Rail pops in/out; sidebar glides          | Rail is conditionally **mounted** (`agentic-workspace.stories.tsx:1100`); a mount/unmount has no width to tween. The Sidebar is always-mounted + `transition-[width] duration-base` (`sidebar.tsx:196-219`). | SC → **MC** | new `ContextPanel` in `@qlik-coe-emea/qlabs-components-ai` (always-mounted, width-animated like Sidebar) |
| PANEL-2 | No reusable rail exists                   | `panel.tsx` is the React-Flow Panel; `ChatShell.aside` is inert (`chat-shell.tsx:38`).                                                                                                                       | **MC**      | `@qlik-coe-emea/qlabs-components-ai` `ContextPanel` (architect-gated)                                    |
| PANEL-5 | A JS animation would skip the motion gate | No `BrandMotionConfig` ancestor (`agentic-workspace.stories.tsx:986`)                                                                                                                                        | SC          | prefer CSS-gated; or internal `BrandMotionConfig` in `ContextPanel`                                      |

**Why:** it's not a missing CSS line — it's a missing _component_. A hand-rolled
`<aside>` can't inherit behaviour it was never given. → [04](04-context-panel-and-assets.md)

### Complaint 2 — "the asset tree / md preview are the loudest text, wrong font, shown as source, and there's no drill-in"

| #                | Symptom                                       | Root cause                                                                                                                                                                                  | Layer      | Fix location                                                                                                                                                             |
| ---------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ASSET-1 / TYPE-5 | Tree in a **different (mono) font**, hard box | `FileTree` hardcodes `font-mono ... border bg-background` (`file-tree.tsx:69`); **and** `--font-mono` is undefined in `:root` so it falls back to a system mono stack (`themes.css:108`).   | CI + **T** | `FileTree` `cva` variant / new `ProducedAssetTree`; add `--font-mono` to `:root`                                                                                         |
| ASSET-2          | Markdown shown as **source**                  | `AssetPreview` uses `CodeBlock language="markdown"` (`agentic-workspace.stories.tsx:484`); `CodeBlock` is a Shiki source highlighter, body unconditionally mono (`code-block.tsx:271-276`). | **CC**     | render markdown via a branded renderer (ASSET-3)                                                                                                                         |
| ASSET-3          | The branded renderer is in the wrong package  | `@qlik-coe-emea/qlabs-components-ai` can't import `@qlik-coe-emea/qlabs-components-editor` (sibling dep); prose primitives live only in editor (`prose.tsx`).                               | **MC**     | branded markdown renderer in `@qlik-coe-emea/qlabs-components-ai` on the existing `streamdown` dep; **promote prose primitives to `@qlik-coe-emea/qlabs-components-ui`** |
| ASSET-4          | Tree/preview hand-rolled in the story         | No produced-asset surface in `@qlik-coe-emea/qlabs-components-ai` (grep → only the story).                                                                                                  | **MC**     | `ProducedAssetTree` + `AssetPreview` (Preview/Raw) in `@qlik-coe-emea/qlabs-components-ai`                                                                               |
| PANEL-3          | No drill-in, no back button                   | Flat `asset` state; tree+grounding+preview rendered simultaneously (`agentic-workspace.stories.tsx:488,504-586`).                                                                           | **MC**     | two-view `ContextPanel` (root↔detail) + View-Transition morph (CSS fallback first)                                                                                       |

**Why "loudest text":** the tree is mono (visually heavier) and the preview is a
code block — both shout because they borrowed code-display treatments. The fix is
to render documents _as documents_ and drop the box. → [04](04-context-panel-and-assets.md)

### Complaint 3 — "the whole thing is flat / chaotic / a debug console" (can't tell interaction types apart)

This is the largest complaint and decomposes into four systemic root causes:

| Root cause                                                                     | Evidence                                                                                                                 | Layer       | Fix                                                                                                                                                      |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No type scale** — everything is `text-sm`/`text-xs`                          | 326 small-text uses vs ~15 larger; zero `--text-*` tokens (`themes.css:961-1085`)                                        | **T**       | a 7-role type scale (TYPE-1/2) → [02](02-systemic-backbone.md)                                                                                           |
| **Border uniformity** — every type is the same outlined white box              | global subtle `--border` applied everywhere (`themes.css:1107`); Tool/Task/Artifact/Card/Alert all `rounded border bg-*` | **T + CI**  | one separation channel per type (BTN-4) → [02](02-systemic-backbone.md)                                                                                  |
| **"Harsh" outlines** — Share/Deny/chips/composer                               | `--input` (the dark form-field rung) borrowed by `outline` buttons (`button.tsx:14`, `themes.css:763`)                   | **CC + CI** | route off `outline`; soft pill / soft composer (BTN-1/2/3) → [02](02-systemic-backbone.md)                                                               |
| **No interaction-type grammar** — each trace/message/approval is its own idiom | 6 divergent trace containers; `Message` ignores chat tokens; `Confirmation` neutral while pending                        | **CI + MC** | the component grammar (UserMessage/AgentMessage/ApprovalCard/AgentStep/ToolResultCard/...) → [03](03-component-grammar.md), [05](05-execution-traces.md) |

---

## B. The stated design goals → where each is delivered

| Design goal (from the brief)                    | Primary findings      | Layer      | Delivered in                                                 |
| ----------------------------------------------- | --------------------- | ---------- | ------------------------------------------------------------ |
| Clear visual grammar per interaction type       | the whole grammar     | MC + CI    | [03](03-component-grammar.md)                                |
| Stronger typography scale (not all `text-sm`)   | TYPE-1/2/3/4/7, MSG-3 | **T** + MC | [02](02-systemic-backbone.md)                                |
| Remove harsh black-outline buttons              | BTN-1, APPROVE-2      | CC + CI    | [02](02-systemic-backbone.md), [03](03-component-grammar.md) |
| Reduce border noise                             | BTN-4, TYPE-6         | **T** + CI | [02](02-systemic-backbone.md)                                |
| Execution traces business-readable; JSON hidden | TRACE-1/2/3/4         | CI + MC    | [05](05-execution-traces.md)                                 |
| Right panel structured + useful, not cramped    | PANEL-2/3, ASSET-4    | MC         | [04](04-context-panel-and-assets.md)                         |
| Composer feels like a modern AI command bar     | BTN-3                 | CI         | [02](02-systemic-backbone.md), [03](03-component-grammar.md) |
| Serious / calm / enterprise (green deliberate)  | TYPE-6, KPI-5, BTN-4  | T          | throughout                                                   |
| KPI cards feel like executive insight           | KPI-1/2/3             | CI + MC    | [03](03-component-grammar.md)                                |
| User vs agent instantly distinguishable         | MSG-1/2               | CI + **T** | [03](03-component-grammar.md)                                |
| Approval reads as a control boundary            | APPROVE-1/2/3         | CI         | [03](03-component-grammar.md), [05](05-execution-traces.md)  |
| Drill-in asset preview + back button            | PANEL-3, ASSET-3/4    | MC         | [04](04-context-panel-and-assets.md)                         |

---

## C. The component-grammar elements the maintainer named → status today

The brief asked for 14 named components. Here is what each maps to:

| Named element       | Exists today?                    | Action                                                               | Lives in                             |
| ------------------- | -------------------------------- | -------------------------------------------------------------------- | ------------------------------------ |
| `UserMessage`       | no (only `Message from="user"`)  | new thin wrapper presetting chat-user tint + avatar                  | `@qlik-coe-emea/qlabs-components-ai` |
| `AgentMessage`      | no                               | new wrapper: brand mark + label + answer grammar + green accent rail | `@qlik-coe-emea/qlabs-components-ai` |
| `ApprovalCard`      | partial (`Confirmation`)         | promote `Confirmation` → first-class decision surface                | `@qlik-coe-emea/qlabs-components-ai` |
| `AgentStep`         | no (6 divergent traces)          | new timeline-step primitive; traces converge onto it                 | `@qlik-coe-emea/qlabs-components-ai` |
| `ToolResultCard`    | no (`ToolOutput` only)           | new artifact-result surface                                          | `@qlik-coe-emea/qlabs-components-ai` |
| `KpiCard`           | yes (`MetricCard`)               | extend with `emphasis` + evidence slot                               | `@qlik-coe-emea/qlabs-components-ui` |
| `EvidenceChip`      | no (`InlineCitation` muted)      | new green-tinted citation chip                                       | `@qlik-coe-emea/qlabs-components-ai` |
| `SourceList`        | partial (`Sources`)              | structure the grounding footer                                       | `@qlik-coe-emea/qlabs-components-ai` |
| `ProducedAssetTree` | no (`FileTree` reused)           | new document-feeling tree                                            | `@qlik-coe-emea/qlabs-components-ai` |
| `AssetPreview`      | no (story-local)                 | new type-switch preview + Preview/Raw                                | `@qlik-coe-emea/qlabs-components-ai` |
| `SuggestionChip`    | yes (`Suggestion`, outline)      | change default → soft pill                                           | `@qlik-coe-emea/qlabs-components-ai` |
| `CommandComposer`   | yes (`PromptInput`, hard border) | calm-surface preset/variant                                          | `@qlik-coe-emea/qlabs-components-ai` |
| `SidebarSection`    | yes (`SidebarGroup*`)            | mostly fine; density/typography via the scale                        | `@qlik-coe-emea/qlabs-components-ui` |
| `StatusBadge`       | no (3 idioms + raw colours)      | new token-driven badge                                               | `@qlik-coe-emea/qlabs-components-ui` |

Two foundational primitives the brief _didn't_ name but everything depends on:
`Text`/`Heading` (TYPE-7, `@qlik-coe-emea/qlabs-components-ui`) and the type-scale + zone/rail/badge
**tokens** (TYPE-1/6, `@qlik-coe-emea/qlabs-components-tokens`). These are the keystone — see
[02](02-systemic-backbone.md).
