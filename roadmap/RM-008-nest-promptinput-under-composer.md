---
id: RM-008
title: Sidebar — nest the PromptInput family under AI/Composer and fold the composer blocks into it
status: planned
priority: P2
effort: S (half day)
depends_on: [RM-003, RM-006]
blocks: []
source: docs/review/2026-09-03-storybook-ia-and-ambiguity-review.md §2.4
---

# RM-008 Nest PromptInput under AI/Composer

## Finding

Around "the thing you type into" the sidebar shows nine entries in three groups: `AI/Composer`, `AI/PromptInput`, `AI/PromptInputEffort`, `AI/PromptInputMode`, `AI/PromptInputSlash`, `AI/MessageForm` (unrelated: a model-emitted form inside a message, but it reads like a sibling), `Patterns/Blocks/AI Composer`, `Patterns/Blocks/MentionInput + PromptInput`, `Terminal/TerminalComposer`. Nothing in the sidebar shows that four of them are parts of one.

The guidelines allow a third title level "only for a real sub-family". This is one.

## Change

| File | Title today | Title after |
|---|---|---|
| `packages/ai/src/composer.stories.tsx` | `AI/Composer` | `AI/Composer` (unchanged; docs page becomes the family overview) |
| `packages/ai/src/prompt-input.stories.tsx` | `AI/PromptInput` | `AI/Composer/PromptInput` |
| `packages/ai/src/prompt-input-mode.stories.tsx` | `AI/PromptInputMode` | `AI/Composer/PromptInputMode` |
| `packages/ai/src/prompt-input-effort.stories.tsx` | `AI/PromptInputEffort` | `AI/Composer/PromptInputEffort` |
| `packages/ai/src/prompt-input-slash.stories.tsx` | `AI/PromptInputSlash` | `AI/Composer/PromptInputSlash` |
| `packages/ai/src/blocks-ai-composer.stories.tsx` | `Patterns/Blocks/AI Composer` | delete; its render becomes the `InChatShell` story in `composer.stories.tsx` |
| `apps/docs/stories/mention-input-in-composer.stories.tsx` | `Patterns/Blocks/MentionInput + PromptInput` | `AI/Composer/WithMentionInput` (or a `WithMentions` story in `composer.stories.tsx` if RM-007 adds the `textarea` slot) |

- `composer.stories.tsx` docs description gains a short "Anatomy" paragraph: Composer = PromptInput + status strip + tools; the four sub-pages are the parts; TerminalComposer is the console skin (link).
- `message-form.stories.tsx` description gains its first sentence: "Not a chat input. A model-emitted form rendered inside a message."
- Registry block ids (`ai-composer`) are unaffected; only story titles move. Update `apps/docs/stories/Storybook-MCP-for-Agents.mdx` if it cites any of the old ids.

## Acceptance

- Under `AI`, the sidebar shows `Composer` as one expandable node with four children plus its own stories.
- `Patterns/Blocks` no longer contains a composer entry.
- MCP story ids in docs resolve.

## Test / gate

RM-002 gate; baselines updated for the renamed ids; `pnpm agent-docs:check`.
