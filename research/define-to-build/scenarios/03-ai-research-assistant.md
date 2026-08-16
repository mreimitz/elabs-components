# Scenario 03 — AI Research Assistant

**Archetype:** AI Assistant
**User type:** AI product developer or presales engineer building a chat-first app

---

## What's needed

A conversational AI interface where an agent answers questions by using tools
(web search, code execution, document retrieval), shows its reasoning process,
and cites sources. The developer has a streaming AI SDK endpoint already wired
up and wants a polished chat surface that shows all the rich structure of the
agent's output — not just plain text.

**Components required:**

- `AppShell` + `Sidebar` — conversation history nav, model selector
- `ChatShell` — outermost chat container
- `Conversation` + `ConversationContent` — scrollable message transcript
- `ConversationEmptyState` — welcome screen / suggested prompts
- `Message from="user|assistant"` + `MessageContent`
- `MessageResponse` — streaming markdown renderer (Streamdown)
- `Reasoning` + `ReasoningTrigger` + `ReasoningContent` — collapsible think-aloud
- `Tool` + `ToolHeader` + `ToolInput` + `ToolOutput` — per-tool-call card
- `Sources` + `SourcesTrigger` + `Source` — cited source list
- `InlineCitation` — numbered citation markers inside message text
- `PromptInput` + `PromptInputTextarea` + `PromptInputSubmit` — composer form
- `CodeBlock` — syntax-highlighted code in assistant messages
- `Suggestion` / `Suggestions` — suggested follow-up prompts
- `Shimmer` — loading placeholder while first token streams
- `ConversationScrollButton` — auto-scroll to bottom toggle

---

## How the user would define requirements

Ideal intake:

> "Build an AI research assistant. The left sidebar shows conversation history
> (previous sessions, grouped by date) and a model selector at the bottom.
>
> The main area has a scrollable chat transcript. Each assistant message shows:
>
> - The text response rendered as markdown (with code blocks highlighted)
> - If the model reasoned, a collapsible 'Thinking...' section that auto-opens while
>   streaming and shows duration when done
> - Tool call cards for each tool the agent used: show the tool name, input params
>   (collapsed by default), and the output (or an error state)
> - Citations as numbered superscripts in the text, with a 'N sources' button at the
>   bottom that expands a source list
>
> The composer at the bottom: a textarea (Enter submits, Shift+Enter newline),
> a submit button that shows a spinner while streaming, a stop button while streaming.
> When the conversation is empty, show suggested prompts as clickable chips.
>
> Use qlik-bright theme. Wire to my useChat hook from the Vercel AI SDK."

**Key decisions the user SHOULD be asked:**

- Whether reasoning / tool calls / citations are needed (not all chat apps need all three)
- Sidebar structure (conversation history vs. just a settings drawer vs. no sidebar)
- Suggested prompts on the empty state (text + icon per prompt)
- Theme

**Key decisions the user SHOULD NOT need to make:**

- Which AI elements to import for each feature
- How to pass `UIMessage[]` to `Conversation`
- How `PromptInput`'s `onSubmit` signature maps to their `useChat.append()`
- Whether `Reasoning` auto-opens from stream state or requires manual control
- How to compose `Tool` + `ToolHeader` + `ToolInput` + `ToolOutput`
- The difference between `MessageResponse` (streaming markdown) and `MessageContent`

---

## What's currently missing

### In the plugin

| Gap                      | Status                    | Covers                                                                                                |
| ------------------------ | ------------------------- | ----------------------------------------------------------------------------------------------------- |
| `new-app` skill          | **Not built** — #122, #55 | Guided intake of the chat surface description                                                         |
| AI assistant scaffold    | **Not built** — #123, #55 | Generating the correct composition + useChat wiring stubs                                             |
| AI assistant playbook    | **Not built** — #83, #66  | "AI App = ChatShell + Conversation + Message + PromptInput, wired like this"                          |
| AI SDK wiring bridge     | **Not tracked**           | The scaffold should emit a stub that maps `useChat` → `Conversation` + `Message` components correctly |
| Visual archetype preview | **Not built** — #57       | Showing what the chat surface looks like before scaffold                                              |

### In the library / templates

| Gap                                                                             | Status           | Detail                                                                                                                                                 |
| ------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AI assistant template doesn't show tool call / reasoning / citation composition | **Not tracked**  | `registry/templates/ai-assistant/page.tsx` has a basic `Conversation` + `PromptInput` — none of the rich structure (Tool, Reasoning, Sources) is shown |
| `useChat` → brand-ui wiring not documented                                      | **Not tracked**  | New users must figure out how to map `UIMessage[]` + tool parts to the correct brand-ui components                                                     |
| `PromptInput` form vs. textarea confusion                                       | **Not tracked**  | `PromptInput` is a form (`onSubmit`), not a controlled textarea — this trips up users who learned the older pattern; the template doesn't clarify      |
| Streaming state → component state not shown                                     | **Not tracked**  | When `status === "streaming"`, the submit button should show a spinner and a stop button should appear; this wiring is non-obvious                     |
| No visual diff between user/assistant/system message styles                     | **In Storybook** | Template doesn't demonstrate the `from` prop variants or how system messages differ                                                                    |

### Structural gaps being addressed by open issues

| Gap                                                     | Issue       | Detail                                                                                                 |
| ------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------ |
| Agentic UI message/approval/KPI grammar                 | **#191**    | Extends message types for richer agent outputs — needed for approval cards, evidence cards, KPI embeds |
| Execution trace grammar (AgentTimeline, ToolResultCard) | **#192 P0** | The `Tool` component doesn't yet cover the full execution trace needed for an agentic assistant        |
| ContextPanel + drill-in + produced-asset suite          | **#193**    | Right-rail context panel for documents/artifacts the agent produced                                    |
| Reduce border noise (outline-subtle + suggestion pills) | **#194**    | Visual quality of the suggestion chips and composer border                                             |

### Blocking GitHub issues for this scenario end-to-end

- **#55 VP-02** — new-app skill + AI assistant scaffold
- **#83 Playbooks** — AI assistant composition recipe
- **#66 WP-09** — playbooks as agent skills
- **#192 P0** — execution trace grammar (blocks rich tool call display)
- **#191** — message grammar for approval/evidence (needed for agentic use cases)
- **#193** — ContextPanel suite (needed for produced-asset display)
- **#57 VP-04** — visual archetype preview
