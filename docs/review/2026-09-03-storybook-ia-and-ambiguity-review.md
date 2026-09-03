# Storybook IA + ambiguous-component review (2026-09-03)

Scope: the live sidebar at `localhost:6006` (read from `/index.json`, 301 titles in 25 top-level groups), `apps/docs/.storybook/preview.tsx` `storySort`, `docs/STORYBOOK_GUIDELINES.md`, and the source of every component named below. Nothing here is inferred from names alone; each claim was checked against the file.

## 1. Sidebar organisation

### 1.1 Why "Foundation" and "Typography" sit at the very bottom

Two stories use top-level groups that are not in `storySort.order`, so Storybook appends them after `Patterns` in import order:

| Title                           | File                                                                       | Should be                                                                                                        |
| ------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `Foundation/Toolbar` (singular) | `packages/ui/src/components/toolbar/toolbar.stories.tsx:31`                | `Layout/Toolbar` (it is a component, not a token doc; guidelines say base components never go under Foundations) |
| `Typography/MatchHighlight`     | `packages/ui/src/components/match-highlight/match-highlight.stories.tsx:7` | `Display/MatchHighlight` (or `Data/MatchHighlight`, since it is a search-hit highlighter)                        |

This is exactly the failure mode the 2026-06-15 IA review named, and `STORYBOOK_GUIDELINES.md` still says the gate "would make this load-bearing (currently a comment-enforced convention)". It drifted again within three months. Recommendation: add the gate now (`scripts/check-storybook-groups.mjs`: parse `index.json` or the story titles, fail on any top-level segment not in `storySort.order`). It is a 30-line script and the repo already has the pattern (`check-sidebar-drift.mjs`).

### 1.2 Providers: not wrong, but not where anyone looks for them

`Providers` (LocaleProvider, Storybook Theme Harness) is second-to-last by design ("utilities" tier). Your instinct is right for a different reason than position: `ThemeProvider` has no story of its own at all. It appears only inside `Foundations/Theming`, so a reader looking for "how do I set up the app root" finds LocaleProvider in one place and ThemeProvider in another, and neither in the Getting Started path.

Recommendation: fold the group into `Foundations`:

- `Foundations/Theming` keeps ThemeProvider (already there).
- Move `Providers/LocaleProvider` to `Foundations/Localization` (there is a `docs/I18N.md`; the story is the natural home for it).
- Move `Providers/Storybook Theme Harness` to `Docs/Storybook Theme Harness`. It is Storybook tooling, not a shipped component, and it is the only other thing in the group.

Then delete `Providers` from `storySort.order`. Foundations becomes the one place for "things you set up once at the root": tokens, theme, locale, motion.

### 1.3 Blocks "in the middle": within-group order is import order

`storySort` has no `method: "alphabetical"`, so inside every group the order is whatever Vite's import order produced. Visible effects on the live sidebar:

- `Patterns`: Blocks, Templates and Scenarios are interleaved (`Blocks/Terminal Session (mid-turn)`, `Templates/Enterprise Admin Console`, `Templates/Terminal Agent Session`, `Scenarios/Agentic AI Workspace`, `Blocks/AI Composer`, `Templates/AI Assistant`, ... `Blocks/Comparison Table`, `Templates/Object Detail Hub`). This is the "blocks in the middle" you saw.
- `Foundations`: Colors, Elevation, Paper, Spacing & Radius, Theming, Typography, Decoration, Motion. Neither alphabetical nor the reading order the guidelines list.
- `AI`: `ChangeReview` last, `PromptInput` after `PromptInputSlash`, `ApprovalCard` between `Composer` and `ContextPanel`.

Recommendation: `storySort: { method: "alphabetical", order: [...] }` and, for the two groups where reading order matters, list the children explicitly the way `Docs` already does: `"Foundations", ["Colors", "Typography", "Spacing & Radius", "Elevation", "Motion", "Decoration", "Paper", "Theming", "Localization"]` and `"Patterns", ["Templates", "Scenarios", "Blocks"]`.

### 1.4 Ordering fixes worth doing at the same time

- `Viewer` and `Terminal` are in `storySort.order` but not in the guidelines list (the doc stops at 20 groups; the array has 22). Update the doc or the CI gate will be checking against a stale list.
- `Editor` before `Terminal` before `Viewer` before `Flow` reads oddly. Suggested domain order: Data, Charts, AI, Terminal (it is the AI console skin, see 3.1), Editor, Viewer, Flow, Maps, Marketing.
- `AI/Chat` is not a component; its `component:` is a local `ChatExample` and it composes ChatShell + Conversation + Composer. It belongs under `Patterns/Scenarios/Chat` (there is already `Patterns/Scenarios/Agentic AI Workspace`). As it stands, `AI/Chat`, `AI/ChatShell`, and `AI/Conversation` sit next to each other and a reader cannot tell which one is the thing to import.
- `AI/JSX Preview` breaks the "PascalCase, no spaces" naming rule (`AI/JSXPreview`). `Editor/AI Content Access` breaks it too.
- `Forms/MentionInput/Mirror re-measure` and `Editor/MarkdownEditor/Slash menu` are test-scenario stories promoted to sidebar sub-groups. Either fold them into the parent as named stories or move them to `Patterns/Scenarios`.
- `Charts/MetricCard` is a re-export of `Core/MetricCard` (same component, two sidebar entries). The guidelines accept this as a "signposted duplicate"; the signpost lives only in the docs-page description, so in the sidebar it just looks like two components. Either drop the Charts entry or rename it to make the relationship visible (`Charts/MetricCard (with Sparkline)` would break the no-parentheses rule, so dropping is cleaner).

## 2. PromptInput vs Composer

The premise needs correcting before deciding anything: **Composer is not a competitor of PromptInput; it is built on it.** `composer.tsx` is 202 lines that render `<PromptInput>` with a status strip, an attach button, a model pill, a mic button and a round submit. `prompt-input.tsx` (1,668 lines) is the AI-Elements-derived form primitive: attachments context, paste-to-attach, action menus, select, hover card, tabs, and a cmdk-based command surface. Both are in the flat `init` commit of 2026-08-16, so git cannot tell which came first; the docblocks already agree on the split ("PromptInput is the raw composer FORM primitive Composer is built on"; "Composer is the canonical chat input, reach for it instead of hand-rolling a PromptInput footer").

So there is no duplicate to delete. The ambiguity is real, though, and it comes from four places:

**2.1 The canonical component is the one that lacks the new features.** `PromptInputEffort`, `PromptInputMode` and `PromptInputSlash` were added as siblings of the primitive. The only consumer of all three is `packages/terminal/src/terminal-composer.tsx`. `Composer` has no `mode`, `effort` or slash-command support at all. A consumer who wants a mode selector in a chat input therefore has to ignore the "reach for Composer" guidance and hand-roll PromptInput. The docs point one way and the feature set points the other.

**2.2 Your own code already hand-rolls it.** `registry/blocks/ai-chat-shell/ai-chat.tsx` and `apps/docs/stories/mention-input-in-composer.stories.tsx` render `<PromptInput>` directly instead of `<Composer>`. The registry block is the thing agents copy; if it does not use Composer, Composer is not canonical in practice.

**2.3 Composer's defaults are demo data.** `model = "Claude Opus 4"` is a hard-coded default and the model pill is a `PromptInputButton` with a Globe icon that does nothing on click. Meanwhile `Core/ModelPicker` documents itself as "sized to sit in a composer footer" and `AI/ModelSelector` is its modal sibling. Three model-selection surfaces, and the canonical composer uses none of them.

**2.4 Sidebar presentation.** Under `AI` the reader sees `Composer`, `PromptInput`, `PromptInputEffort`, `PromptInputMode`, `PromptInputSlash`, `MessageForm` (which is unrelated: a model-emitted form inside a message), plus `Patterns/Blocks/AI Composer` and `Patterns/Blocks/MentionInput + PromptInput`, plus `Terminal/TerminalComposer`. Nine entries around "the thing you type into".

### Recommendation

Keep PromptInput as the primitive and Composer as the product. Make the relationship visible and make Composer actually canonical:

1. Give `Composer` the missing slots: `mode?: PromptInputModeProps`, `effort?: PromptInputEffortProps`, `slashCommands?: PromptInputSlashProps["commands"]`, and replace the dead model pill with a `modelPicker?: ReactNode` slot (default: nothing; the story passes `<ModelPicker>`). Drop the `"Claude Opus 4"` default. TerminalComposer already proves the wiring works.
2. Rewrite `registry/blocks/ai-chat-shell/ai-chat.tsx` on `<Composer>`. Then `audit --strict` can flag a direct `<PromptInput>` in consumer code as a warning ("use Composer unless you need a bespoke shell").
3. In Storybook, nest the primitives under the product: `AI/Composer` (docs page: "the chat input"), `AI/Composer/PromptInput`, `AI/Composer/PromptInputMode`, `AI/Composer/PromptInputEffort`, `AI/Composer/PromptInputSlash`. The guidelines allow a third level "for a real sub-family"; this is one.
4. Move `Patterns/Blocks/AI Composer` and `Patterns/Blocks/MentionInput + PromptInput` into `AI/Composer` as stories (`WithMentions`, `InChatShell`), not separate sidebar entries.

## 3. Ambiguous components across the system

Ranked by how likely an agent or a new developer picks the wrong one. "Intentional" means an ADR or docblock explains the split; the problem in those cases is discoverability, not design.

### 3.1 High: the Terminal family duplicates the AI family (intentional, ADR 0033 / #117)

Eight one-to-one pairs, each a "console skin" of an AI-package component:

| Terminal                                  | AI                                | Notes                                                           |
| ----------------------------------------- | --------------------------------- | --------------------------------------------------------------- |
| TerminalComposer                          | Composer                          | Terminal one has mode/effort/slash; Composer does not (see 2.1) |
| TerminalSlashMenu                         | PromptInputSlash                  | Terminal imports the AI one, so this is a real skin             |
| TerminalStatusBar                         | SessionStatusBar                  | Same props shape (workspace, branch, model, progress)           |
| TerminalToolCall                          | Tool / ToolResultCard             | Terminal "derived from claude-tool-call.tsx"                    |
| TerminalPermission                        | ApprovalCard (`confirmation.tsx`) |                                                                 |
| TerminalTodoList                          | Task / Plan                       |                                                                 |
| TerminalDiffHunk                          | DiffView                          |                                                                 |
| TerminalTranscriptRow / TerminalEventLine | Message / AgentEvent              |                                                                 |

The split is documented in `packages/terminal/references/agent-session-family.md` and the ADR, but nowhere in Storybook. Neither group's docs page says "if you are building a chat, use AI; if you are building a CLI-style agent console, use Terminal". Recommendation: an MDX page `Docs/AI vs Terminal` with that one decision rule and the table above, linked from both groups' first story. Also put `Terminal` directly after `AI` in `storySort.order` so the relationship reads in the sidebar.

### 3.2 High: three model pickers

`Core/ModelPicker` (popover, in-place, "sized to sit in a composer footer"), `AI/ModelSelector` (same Command internals in a Dialog; its story is titled `AI/ModelSelectorLogo`, so the picker itself has no sidebar entry), and the dead pill inside `Composer`. Recommendation: Composer gets a `modelPicker` slot (2.1), `ModelSelector` gets its own story or is folded into ModelPicker as `variant="dialog"`, and one of the two docs pages states the rule (inline pill vs command palette).

### 3.3 High: four toolbars

`Foundation/Toolbar` (the only one with `role="toolbar"` and roving tabindex), `Layout/ViewToolbar` (the row above a list; deliberately no role), `Editor/MarkdownToolbar`, `AI/SelectionToolbar`. The Toolbar docblock explains when not to use it, which is good, but the four entries are in four groups and one is in the orphan group. After the 1.1 fix, `Layout/Toolbar` and `Layout/ViewToolbar` sit together; add one sentence to `ViewToolbar`'s docs description pointing at `Toolbar` (Toolbar already points at ViewToolbar).

### 3.4 Medium: five diff surfaces

`AI/DiffView` (presentational `DiffLine[]`), `AI/ChangeReview` (accept/reject gate, lives in `ui`), `Editor/DiffEditor` (Monaco, editable), `Terminal/TerminalDiffHunk` (console skin), and `MessageCompare` (side-by-side responses, not a diff but named like one). The 2026-09-01 decision doc binds DiffView and ChangeReview together, yet `change-review.tsx` imports nothing from DiffView: it renders its own hunk lines (Button, Badge, StatePanel, StatusIcon only). So the repo has two hand-written line renderers for the same `+`/`-` rows, in two packages. Recommendation: make `ChangeReview` render its hunks through `DiffView` (the decision doc's seam, now actually used), and the DiffView docs page should carry the four-way rule: read-only lines = DiffView; approve/reject = ChangeReview; editable = DiffEditor; console = TerminalDiffHunk.

### 3.5 Medium: three markdown renderers plus one wrapper

`AI/MarkdownView` (read-only, streamdown onto `Prose*`), `Editor/MarkdownPreview` (streamdown onto brand components plus the `:::card` / `:::callout` directive dialect), `Editor/Prose` (the primitives both map onto), and the streaming `MessageResponse` inside `AI/Message`. MarkdownView's own docblock says it exists to be "one source-owned prose set for chat answers, the editor preview and this view", which implies MarkdownPreview should be built on it or vice versa; today they are two `components` maps over the same engine. Recommendation: pick one as the renderer and make the other a thin configuration of it (MarkdownPreview = MarkdownView + directive plugins), then state the rule on both docs pages.

### 3.6 Medium: three slash menus

`AI/PromptInputSlash`, `Terminal/TerminalSlashMenu` (imports the AI one: fine), `Editor/MarkdownEditor/Slash menu` (Milkdown-scoped: separate by ADR because of the one-way dependency graph). Only the sidebar makes them look like three unrelated things. The 2.1 nesting fix and a sentence in the editor story resolve it.

### 3.7 Medium: naming collisions and unshared implementations

- `AI/Context` (a token-usage ring: input/output/reasoning/cache) vs `AI/ContextPanel` (the right-hand rail). Unrelated components, adjacent names. Rename `Context` to `TokenUsage` / `ContextWindow`; it is the AI-Elements name, but nothing forces you to keep it.
- `AI/Chat` (a demo) vs `AI/ChatShell` (the layout) vs `AI/Conversation` (the scrolling transcript). See 1.4.
- `Core/Timeline` (the rail spine), `AI/AgentTimeline` (built on it), `Data/RevisionTimeline` (git history, presentational). AgentTimeline and Timeline docblocks explain their relationship. `RevisionTimeline` does not import `Timeline` at all; it draws its own rail with `cva` and lucide icons, even though Timeline's docblock calls itself "THE rail/node/connector spine". Rebase it on Timeline or document why it cannot be.
- `Layout/Sidebar` (the shadcn primitive set) vs `Layout/AppSidebar` (the parameterised shell over it). AppSidebar's docblock explains it; Sidebar's story has no description. Add one.
- `Layout/Resizable` vs `Layout/SplitPanel`. These are two independent implementations: `split-panel.tsx` imports only `cva` and `cn` (a static two-pane layout with the tone system), and does not wrap `Resizable` (the `react-resizable-panels` primitive). Neither story has a description. Either SplitPanel gains a `resizable` prop that swaps in the Resizable primitives, or both docs pages state "fixed split = SplitPanel, draggable = Resizable".
- `Data/Table` vs `Data/DataTable`: already signposted in the guidelines and both descriptions. Fine.
- `Core/MetricCard` vs `Charts/MetricCard`: same component (1.4).
- `AI/CodeBlock` vs `AI/Snippet` vs `AI/Sandbox` vs `Editor/CodeEditor`: Snippet's story has no description. It should say what it is for that CodeBlock is not.

### 3.8 Low: things that only look ambiguous

`Core/Badge` vs `Core/StatusBadge` (StatusBadge is the closed 7-state execution vocabulary; documented), `Core/Input` vs `Data/SearchInput` (documented), `AI/Tool` vs `AI/ToolResultCard` (call vs produced artifact; documented), `Terminal/Terminal` vs `Terminal/InteractiveTerminal` (read-only ANSI log vs xterm; documented in the docblock but not in the story descriptions, add them).

## 4. Suggested order of work

1. Fix the two orphan titles and add the top-level-group CI gate (half a day, closes the recurring finding).
2. `storySort` alphabetical + explicit child order for Foundations and Patterns; fold Providers into Foundations; move `AI/Chat` to Scenarios (half a day).
3. Composer gets mode/effort/slash/modelPicker slots; registry `ai-chat-shell` moves onto Composer; PromptInput family nests under `AI/Composer` (one to two days, the only change with real code in it).
4. One `Docs/Choosing between similar components` MDX page carrying the tables in section 3, linked from each affected story's description. Cheap, and it is what an agent querying `brand-ui docs` will actually read.
5. Rename `AI/Context`; add the missing story descriptions listed in 3.7 and 3.8.
