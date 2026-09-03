---
id: RM-005
title: Story title hygiene — demos out of component groups, naming rule, duplicate entry
status: planned
priority: P2
effort: S (half day)
depends_on: [RM-003]
blocks: []
source: docs/review/2026-09-03-storybook-ia-and-ambiguity-review.md §1.4
---

# RM-005 Story title hygiene

## Finding

Several titles break the rules in `docs/STORYBOOK_GUIDELINES.md` ("Naming", "Group by concern") or put a demo where a component is expected:

| Title | File | Problem |
|---|---|---|
| `AI/Chat` | `packages/ai/src/chat.stories.tsx` | `component: ChatExample` (a local demo composing ChatShell + Conversation + Composer). Sits between `AI/ChatShell` and `AI/Conversation`, so a reader cannot tell which is the importable one. |
| `AI/JSX Preview` | `packages/ai/src/jsx-preview.stories.tsx` | Space in the component segment. |
| `Editor/AI Content Access` | `apps/docs/stories/editor-ai-content-access.stories.tsx` | Spaces; also a concept page, not a component. |
| `Forms/MentionInput/Mirror re-measure` | `packages/ui/src/components/mention-input/mention-input-mirror.stories.tsx` | A regression-test scenario promoted to a sidebar sub-group. |
| `Editor/MarkdownEditor/Slash menu` | `packages/editor/src/markdown-editor/slash/slash-menu.stories.tsx` | Same; also collides by name with the two other slash menus (RM-009). |
| `Charts/MetricCard` | `packages/charts/src/metric-card/metric-card.stories.tsx` | Re-export of `Core/MetricCard`; same component, two sidebar entries. The signpost is only in the docs description, invisible in the sidebar. |

## Change

1. `chat.stories.tsx`: `title: "Patterns/Scenarios/Chat"`; `component: ChatShell` (so autodocs shows a real component), keep the render.
2. `jsx-preview.stories.tsx`: `title: "AI/JSXPreview"`.
3. `AI Content Access`: rename to `Editor/AIContentAccess` if it documents a component; otherwise move it to `Docs/AI Content Access` and add it to the Docs child order.
4. `Mirror re-measure`: fold into `Forms/MentionInput` as a story named `MirrorRemeasure` (keep its `play` test).
5. `Slash menu`: fold into `Editor/MarkdownEditor` as a story named `SlashMenu`.
6. `Charts/MetricCard`: delete the story file, or, if the Sparkline-in-a-card composition is worth keeping, move that story into `Core/MetricCard` as `WithSparkline` (it imports `LineChart` from charts, which is fine for a docs story). The charts package keeps the re-export; only the sidebar entry goes.
7. If RM-002's gate gains the naming check, enable it after this lands.

## Acceptance

- No title has a space inside its component segment except the sanctioned multi-word groups (`App Shell`, `Spacing & Radius`, Docs pages, Patterns leaves).
- `AI` contains no story whose `component` is a story-local function.
- `MetricCard` appears once in the sidebar.

## Test / gate

RM-002 gate; baselines updated for the renamed ids.
