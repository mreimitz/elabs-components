# ai-components-blend-in · how well `@qlik-coe-emea/qlabs-components-ai` reuses the base system

Does `@qlik-coe-emea/qlabs-components-ai` (the vendored Vercel AI Elements) actually sit **on top of** the
brand-ui base — `@qlik-coe-emea/qlabs-components-ui`, `@qlik-coe-emea/qlabs-components-charts`, `@qlik-coe-emea/qlabs-components-data`, `@qlik-coe-emea/qlabs-components-flow`,
`@qlik-coe-emea/qlabs-components-editor` — or does it re-implement things the base already ships? This folder is
the assessment. **No code was changed.** Findings route to `/file-issue` if pursued
(finders report, builders fix — `.claude/rules/issue-workflow.md`).

> **Status:** assessment only (2026-06-08). Conclusions are from reading the source of all
> ~51 shipped `@qlik-coe-emea/qlabs-components-ai` components + the base package barrels; the load-bearing claims
> (flow duplication, `confirmation` semantics, `terminal` tokens, that `Combobox`/`StatePanel`
> exist) were spot-verified at `file:line`. Nothing was run or visually validated.

## Opinion up front (the verdict)

**The port is mostly good. `@qlik-coe-emea/qlabs-components-ai` genuinely rides on `@qlik-coe-emea/qlabs-components-ui` — ~85 import sites,
real reuse of `Button`, `Collapsible`, `Card`, `Command`, `Dialog`, `Badge`, `Tooltip`,
`HoverCard`, `InputGroup`, `ScrollArea`, `Tabs`, `Avatar`.** This is not a parallel
component universe; the rewire-onto-`@qlik-coe-emea/qlabs-components-ui` work in the vendoring was done.

The blend-in gaps are **narrow and concentrated**, in four shapes:

1. **A few straight re-implementations of base primitives** (an empty-state, a couple of
   carousel buttons, a badge, a combobox, a tab strip) — delete-and-replace, low risk.
2. **Raw Tailwind colors / one-off chips** where a base `Badge` variant already exists —
   mechanical, but it's a theme-safety bug, not just style drift (`terminal.tsx` literally
   won't re-theme).
3. **A handful of genuinely generic components trapped inside `@qlik-coe-emea/qlabs-components-ai`** (`CodeBlock`,
   `FileTree`, `Snippet`, `Shimmer`) that have **zero** AI-SDK coupling and would serve
   non-AI consumers if promoted down a layer.
4. **A structural duplication of `@qlik-coe-emea/qlabs-components-flow`** (`Canvas`/`Controls`/`Edge`) that the
   one-way dependency rule makes _unavoidable as a direct import_ — so the fix is
   **alignment, not consolidation** (see below).

**On the specific "do they reuse charts?" question:** No — and that is **correct**.
`@qlik-coe-emea/qlabs-components-ai` does not (and must not) depend on `@qlik-coe-emea/qlabs-components-charts`; they are peers in the
one-way graph. AI renders no real charts itself. Charts-in-chat is an **app-layer** compose
(`<ToolOutput output={<AutoChart …/>}>`) — already designed in
[`../ai-charts/`](../ai-charts/README.md). Don't re-open that here.

## The dependency rule shapes the whole answer (read this first)

`tokens → ui/icons → {ai, charts, data, flow, editor, …}`. `@qlik-coe-emea/qlabs-components-ai` may import
**downward** (`@qlik-coe-emea/qlabs-components-ui`, `@qlik-coe-emea/qlabs-components-tokens`, `@qlik-coe-emea/qlabs-components-icons`) but **never sideways** into a
peer (`charts`, `data`, `flow`, `editor`). That single rule explains every "why didn't they
just reuse X":

- **Reuse a `@qlik-coe-emea/qlabs-components-ui` primitive?** Always allowed — and mostly done. Gaps here are real
  bugs (REPLACE / ENHANCE).
- **Reuse `@qlik-coe-emea/qlabs-components-charts` / `@qlik-coe-emea/qlabs-components-flow` / `@qlik-coe-emea/qlabs-components-data`?** Forbidden as a direct import.
  So the resolution is one of: (a) the shared thing lives **down** in `@qlik-coe-emea/qlabs-components-ui`
  (PROMOTE), (b) it's composed at the **app/registry** layer (charts-in-chat), or (c) it's
  an unavoidable **parallel specialization** that we keep visually **aligned** (flow).

This is why the recommendations below are buckets, not "make AI import the other packages."

## The four buckets

### ① REPLACE with an existing base primitive (AI hand-rolls what base already does)

| AI surface                                             | Hand-rolls                                                    | Base to use                                                                                             | Evidence                                                                   |
| ------------------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `conversation.tsx` `ConversationEmptyState`            | icon+title+desc empty state                                   | `StatePanel kind="empty"` (`@qlik-coe-emea/qlabs-components-ui`)                                        | `conversation.tsx:29-60`                                                   |
| `task.tsx` `TaskItemFile`                              | a `<span>` pill                                               | `<Badge variant="secondary">`                                                                           | `task.tsx:10-20`                                                           |
| `inline-citation.tsx` `…CarouselPrev/Next`             | raw `<button>` scroll arrows                                  | `CarouselPrevious` / `CarouselNext` (already exported by `@qlik-coe-emea/qlabs-components-ui` carousel) | `inline-citation.tsx:161-211`                                              |
| `mic-selector.tsx`                                     | Popover+Command+Button+chevron picker                         | `Combobox` (`@qlik-coe-emea/qlabs-components-ui`, confirmed at `index.ts:35`)                           | `mic-selector.tsx:188-331`                                                 |
| `prompt-input.tsx` `PromptInputTab*`                   | raw `<div>`/`<h3>` tab panel, **no `role=tab/tabpanel`**      | `Tabs` (a11y gap, not just style)                                                                       | `prompt-input.tsx:1227-1260`                                               |
| `confirmation.tsx`                                     | `Alert` (informational banner) for an **approve/deny** action | `AlertDialog` (`AlertDialogAction`/`Cancel`, focus trap)                                                | `confirmation.tsx:3` + body                                                |
| `schema-display.tsx`, `package-info.tsx`, `commit.tsx` | raw `bg-red-100 text-red-700 …` on/around `Badge`             | `Badge` semantic variants (`destructive`/`success`/`warning`) which **already exist**                   | `schema-display.tsx:43-49`, `package-info.tsx:43-49`, `commit.tsx:259-344` |

### ② ENHANCE a base primitive so it serves the AI use case (base gains a small, generic addition)

| Need                      | Today (AI)                                            | Proposed base enhancement                                                                                             |
| ------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Circular usage/quota ring | hand-drawn SVG ring in `context.tsx:54-93`            | `Progress variant="circular"` in `@qlik-coe-emea/qlabs-components-ui` (useful for any quota, not just tokens)         |
| Status-dot / file chip    | `queue.tsx:43-61,142-150`, `commit.tsx` colored spans | `Badge` gains a `dot` affordance / icon slot (absorbs ~6 hand-rolled chips)                                           |
| Streaming text shimmer    | `shimmer.tsx` (motion text sweep)                     | sits next to `Skeleton`; promote as a base motion primitive (see ③)                                                   |
| AI-graph canvas defaults  | `canvas.tsx` re-wraps ReactFlow                       | a **named preset** on `@qlik-coe-emea/qlabs-components-flow` `CanvasShell` + an `animated` `FlowEdge` variant (see ④) |

### ③ PROMOTE down a layer (generic, **zero** AI-SDK coupling — trapped in `@qlik-coe-emea/qlabs-components-ai`)

These import nothing from `ai` and have no chat semantics; a non-AI app (docs, editor
workspace, dashboards) would want them but can't take the whole AI package:

- **`code-block.tsx`** — Shiki read-only highlighter. **Complementary to** `@qlik-coe-emea/qlabs-components-editor`
  `CodeEditor` (Monaco/editable), _not_ a duplicate. ⚠ Tension: repo rules currently name
  `@qlik-coe-emea/qlabs-components-ai` as CodeBlock's canonical home (`.claude/rules/editor-components.md`,
  `ai-chat-components.md`). Promoting it is a **structural API decision** — route through
  `brand-ui-design-system-architect`, don't just move it.
- **`file-tree.tsx`** — generic `role=tree` explorer; `@qlik-coe-emea/qlabs-components-editor` `CodeWorkspace` wants
  one too.
- **`snippet.tsx`** — copy-snippet (read-only `InputGroup` + copy button); pure utility.
- **`shimmer.tsx`** — animated text shimmer; reusable in any loading context.
- **`motion-config.tsx`** — bridges `@qlik-coe-emea/qlabs-components-tokens` `useReducedMotion` to Motion's
  `MotionConfig`; belongs in `@qlik-coe-emea/qlabs-components-tokens`, not `@qlik-coe-emea/qlabs-components-ai`.

### ④ KEEP AI-specific (correctly built, genuinely chat/agent-only)

Most of the package. `message` (branch nav), `reasoning`, `sources`, `tool`, `sandbox`,
`web-preview`, `jsx-preview`, `stack-trace`, `test-results`, `persona` (Rive),
`agent`, `plan`, `checkpoint`, `audio-player`, `transcription`, `speech-input`,
`model-selector`/`voice-selector` (full-screen `Command`+`Dialog` is the right pattern),
`open-in-chat`, `chain-of-thought`, and the flow leaves `node`/`edge`/`connection`/`panel`/
`toolbar`. These either have no base analog or wrap a base primitive correctly.

> **One KEEP with a bug:** `terminal.tsx` is AI-specific (no base analog) **but hardcodes
> `bg-zinc-950 text-zinc-100 … hover:bg-zinc-800`** (`terminal.tsx:36,48,64,124,153,188,221`),
> bypassing tokens — it will **not** re-theme under light/blueprint/high-contrast. That
> violates `.claude/rules/styling-and-tokens.md` (no raw color outside `themes.css`). Fix =
> a `--terminal-*` token set, not a promote/replace.

## The `@qlik-coe-emea/qlabs-components-flow` situation (the subtle one)

`@qlik-coe-emea/qlabs-components-ai` ships its own ReactFlow wrappers — `canvas`, `node`, `edge`, `connection`,
`controls`, `panel`, `toolbar` — **in parallel to** `@qlik-coe-emea/qlabs-components-flow` (`CanvasShell`,
`FlowNode`, `FlowEdge`, `ZoomControls`, …). Because `ai` and `flow` are peers, AI **cannot**
import `@qlik-coe-emea/qlabs-components-flow`. So:

- **Genuine duplication** (same job, diverging implementation): `Canvas` vs `CanvasShell`
  (both wrap `<ReactFlow>`+`<Background>`; AI even uses `bgColor="var(--sidebar)"` where the
  branded token is `--canvas-grid` — a **token inconsistency bug**, `canvas.tsx:23` vs
  `canvas-shell.tsx:35`); `Controls` (skins ReactFlow's native widget) vs `ZoomControls`
  (custom panel) — two branded answers to the same control.
- **Genuine divergence** (not duplication): AI `Node` is a `Card`-based compound w/ Left↔Right
  handles; `FlowNode` is a flat data tile w/ Top↕Bottom. AI `Edge.Animated`/`Edge.Temporary`
  add motion `FlowEdge` doesn't have.

**Recommendation = align, don't consolidate.** We can't merge across the peer boundary, so
keep the two consistent: (1) AI canvas should use the **same `--canvas*` tokens** as
`@qlik-coe-emea/qlabs-components-flow`; (2) push the AI-graph interaction defaults and the `animated` edge into
`@qlik-coe-emea/qlabs-components-flow` as **opt-in presets/variants**, so an app that wants the AI look composes
`@qlik-coe-emea/qlabs-components-flow` instead of forking it. Track as a `brand-ui-design-system-architect` decision.

## What's NOT a problem (so we don't churn it)

- **Charts:** absence of `@qlik-coe-emea/qlabs-components-charts` in `@qlik-coe-emea/qlabs-components-ai` deps is **correct** — see
  [`../ai-charts/`](../ai-charts/README.md). AI's tiny in-house viz (`context` ring,
  `test-results` segmented bar) are fine; they're not "charts."
- **Editor:** `CodeBlock` (Shiki, read-only) does **not** duplicate `CodeEditor` (Monaco,
  editable) — they're complementary by design.
- **Data:** a few display-only key/value lists (`environment-variables`, `package-info`
  deps) _could_ use `Table`/`DataTable`, but they're lightweight and `@qlik-coe-emea/qlabs-components-data` is a peer
  — low priority, app-layer if ever.

## Index

- [`01-component-reuse-audit.md`](./01-component-reuse-audit.md) — the full per-component
  evidence table (all ~51 shipped components, what each reuses / hand-rolls, `file:line`).

## Key references (verified)

- `packages/ai/package.json` — peerDeps are `@qlik-coe-emea/qlabs-components-ui` + `@qlik-coe-emea/qlabs-components-tokens` only; **no**
  `@qlik-coe-emea/qlabs-components-charts`/`@qlik-coe-emea/qlabs-components-flow`/`@qlik-coe-emea/qlabs-components-data`/`@qlik-coe-emea/qlabs-components-editor`.
- `packages/ui/src/index.ts:35,42,74` — `Combobox`, `EmptyState`, `StatePanel` all exist.
- `packages/ai/src/canvas.tsx:13-25` vs `packages/flow/src/canvas-shell/canvas-shell.tsx:32-39`
  — the canvas duplication + the `--sidebar` vs `--canvas-grid` token mismatch.
- `packages/ai/src/confirmation.tsx:3` — `Alert` import where `AlertDialog` is the right
  primitive for an approve/deny flow.
- `packages/ai/src/terminal.tsx:36-221` — hardcoded `zinc-*`, theme-unsafe.
- `.claude/rules/styling-and-tokens.md`, `.claude/rules/design-system.md` (one-way deps),
  `docs/DECISIONS.md` §D1/§D5.
