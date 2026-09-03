---
id: RM-016
title: Every story in an ambiguous pair carries a one-sentence description naming its sibling
status: planned
priority: P2
effort: S (half day)
depends_on: [RM-009]
blocks: []
source: docs/review/2026-09-03-storybook-ia-and-ambiguity-review.md §3.3, §3.7, §3.8
---

# RM-016 Missing story descriptions

## Finding

The guidelines require `parameters.docs.description.component` on every story, and the signpost-duplicates rule depends on it. Stories in ambiguous pairs that have no description at all (checked 2026-09-03):

| Story | File |
|---|---|
| `Layout/Sidebar` | `packages/ui/src/components/sidebar/sidebar.stories.tsx` |
| `Layout/Resizable` | `packages/ui/src/components/resizable/resizable.stories.tsx` |
| `Layout/SplitPanel` | `packages/ui/src/components/split-panel/split-panel.stories.tsx` |
| `AI/Snippet` | `packages/ai/src/snippet.stories.tsx` |
| `AI/Chat` | `packages/ai/src/chat.stories.tsx` (moves in RM-005) |

Stories that have a description but do not name their sibling: `Layout/ViewToolbar` (Toolbar names ViewToolbar; not the reverse), `Terminal/Terminal` and `Terminal/InteractiveTerminal` (the docblock explains read-only ANSI log vs xterm; the story does not), `Data/RevisionTimeline` (Timeline), `AI/MessageForm` (looks like a composer sibling), `AI/ContextPanel` (Context), every Terminal story (its AI counterpart), every AI story with a Terminal counterpart.

## Change

For each story above, a description whose first sentence says what it is and whose second names the sibling and the rule, linking to the RM-009 page. Wording, ready to paste:

- Sidebar: "The sidebar primitive set (Sidebar, SidebarHeader, SidebarContent, SidebarFooter, ...). For an application sidebar with typed header/footer slots use `AppSidebar`, which composes these."
- Resizable: "Draggable panel group primitive (`react-resizable-panels`). For a fixed two-pane layout with surface tones use `SplitPanel`."
- SplitPanel: "Fixed two-pane layout with per-pane surface tones. For user-resizable panes use `Resizable`."
- Snippet: (read the component first; say what it is for that `CodeBlock` is not; likely "single-line copyable command" vs "multi-line highlighted source").
- ViewToolbar: append "This row is ordinary tab stops on purpose; a dense secondary row that should be one tab stop with arrow-key roving is `Toolbar`."
- Terminal: "Read-only ANSI log renderer, no stdin. For an interactive shell use `InteractiveTerminal` (xterm.js)." and the reverse on InteractiveTerminal.
- MessageForm: "Not a chat input. A model-emitted, spec-driven form rendered inside a message; the chat input is `Composer`."
- ContextPanel: "The chat workspace's right rail. Unrelated to `TokenUsage` (formerly `Context`), the context-window ring."
- Terminal/AI pairs: "Console skin of `AI/<X>`; use it inside a `TerminalSurface`, use `AI/<X>` in a chat." and the reverse.

Add a check to `scripts/check-storybook-groups.mjs` (RM-002) or a sibling script: fail when a `*.stories.tsx` with `tags: ["autodocs"]` has no `docs.description.component`. Start it in `todo` mode with a baseline (the repo already has this pattern for a11y) and burn the baseline down.

## Acceptance

- Every story listed above has a description; the new check reports zero missing for those files.
- `brand-ui docs <name>` for each prints the sibling sentence.

## Test / gate

The new description check; `pnpm agent-docs:check`.
