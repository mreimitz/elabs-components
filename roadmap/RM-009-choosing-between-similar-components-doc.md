---
id: RM-009
title: Docs page "Choosing between similar components" plus cross-links on every affected story
status: planned
priority: P1
effort: S (half day)
depends_on: []
blocks: []
source: docs/review/2026-09-03-storybook-ia-and-ambiguity-review.md §3.1, §3.3, §3.4, §3.5, §3.6
---

# RM-009 "Choosing between similar components" docs page

## Finding

Most of the overlaps found in the review are intentional and explained somewhere (an ADR, a docblock, `packages/terminal/references/agent-session-family.md`), but never in Storybook, which is what a developer or an agent (`brand-ui docs`, the Storybook MCP) actually reads. The biggest case: the Terminal package is a deliberate one-to-one "console skin" of eight AI components (ADR 0033, #117) and neither group's pages say when to use which.

## Change

New MDX `apps/docs/stories/Choosing-Between-Similar-Components.mdx`, title `Docs/Choosing between similar components`, added to the Docs child order (RM-003). One decision rule per family, then a table. Content, all verified against source on 2026-09-03:

**Chat vs console (AI vs Terminal).** Rule: building a chat or assistant surface → `AI/*`; building a CLI-style coding-agent console → `Terminal/*`. Terminal components import the AI primitives where they can (TerminalSlashMenu wraps PromptInputSlash) and re-skin the rest.

| Terminal | AI counterpart |
|---|---|
| TerminalComposer | Composer |
| TerminalSlashMenu | PromptInputSlash |
| TerminalStatusBar | SessionStatusBar |
| TerminalToolCall | Tool / ToolResultCard |
| TerminalPermission | ApprovalCard |
| TerminalTodoList | Task / Plan |
| TerminalDiffHunk | DiffView |
| TerminalTranscriptRow / TerminalEventLine | Message / AgentEvent |
| Terminal (read-only ANSI log) | — ; InteractiveTerminal is xterm.js, a separate thing |

**Model selection.** Inline pill in a composer footer → `Core/ModelPicker`; full command palette in a dialog → `AI/ModelSelector`. (RM-010 decides whether they merge.)

**Toolbars.** Dense secondary control row with one tab stop and arrow-key roving → `Layout/Toolbar` (the only `role="toolbar"`); the row above a list/table/board → `Layout/ViewToolbar`; formatting chrome for the markdown source pane → `Editor/MarkdownToolbar`; floating over a text selection → `AI/SelectionToolbar`.

**Diffs.** Read-only lines from a `DiffLine[]` → `AI/DiffView`; accept/reject per hunk → `AI/ChangeReview` (renders through DiffView after RM-011); editable side-by-side → `Editor/DiffEditor` (Monaco); console dress → `Terminal/TerminalDiffHunk`; two answers side by side (not a diff) → `AI/MessageCompare`.

**Markdown.** Read-only document in chat or a rail → `AI/MarkdownView`; editor preview with the `:::card` / `:::callout` / `::metric` / `:::timeline` directive dialect → `Editor/MarkdownPreview`; the typographic primitives both map onto → `Editor/Prose`; streaming inside a message → `Message` (MessageResponse). (RM-012 unifies the first two.)

**Slash menus.** In a chat composer → `PromptInputSlash`; in the console → `TerminalSlashMenu` (wraps the former); inside the Milkdown markdown editor → the editor's own slash menu, separate by the one-way dependency rule in `docs/decisions/2026-09-01-brainless-adoption-architecture.md` §5.

**Tables, timelines, sidebars, split panes, badges, inputs.** One line each (Table vs DataTable; Timeline vs AgentTimeline vs RevisionTimeline; Sidebar vs AppSidebar; Resizable vs SplitPanel; Badge vs StatusBadge; Input vs SearchInput; CodeBlock vs Snippet vs Sandbox vs CodeEditor).

Then, on every story named above, the first sentence of `parameters.docs.description.component` links to the page and names the sibling ("Not the row above a table; that is ViewToolbar."). RM-016 tracks the stories that have no description at all.

Also add the page to `llms.txt` / the context bundle (`pnpm llms`, `pnpm context`) so the CLI and MCP surface it.

## Acceptance

- The page exists, renders in Storybook, and every component it names links to an existing story id.
- `brand-ui docs Composer` (and the other named components) output includes the sibling pointer.
- `pnpm agent-docs:check` passes.

## Test / gate

`pnpm llms:check`, `pnpm context:check`; a link-check over the MDX (`scripts/` has a docs link checker; if not, a 20-line one).
