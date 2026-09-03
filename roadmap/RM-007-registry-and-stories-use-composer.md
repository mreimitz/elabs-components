---
id: RM-007
title: Registry block and docs stories stop hand-rolling PromptInput; audit warns on direct use
status: planned
priority: P1
effort: S (half day)
depends_on: [RM-006]
blocks: []
source: docs/review/2026-09-03-storybook-ia-and-ambiguity-review.md §2.2
---

# RM-007 Registry and stories use Composer

## Finding

`Composer` is called canonical, but the repo's own copyable code does not use it:

- `registry/blocks/ai-chat-shell/ai-chat.tsx` renders `<PromptInput>` directly. This is the block agents scaffold from, so in practice PromptInput is canonical.
- `apps/docs/stories/mention-input-in-composer.stories.tsx` (title `Patterns/Blocks/MentionInput + PromptInput`) hand-rolls the footer too.

Full list of direct `<PromptInput` renders outside `prompt-input*.tsx`: `composer.tsx` (correct), `microcopy.test.tsx` (fine), the two above.

## Change

1. Rewrite `registry/blocks/ai-chat-shell/ai-chat.tsx` on `<Composer>` using the RM-006 slots. Behaviour must be identical: same submit payload, same attachments, same stop handling. Diff the rendered DOM in the block's story before and after; the only allowed differences are the outer frame classes Composer adds.
2. Rewrite `mention-input-in-composer.stories.tsx` on `<Composer>`. If `MentionInput` needs to replace the textarea, add a `textarea?: ReactNode` escape hatch to Composer (documented as "for MentionInput; still inside PromptInputBody"), otherwise leave the hand-rolled version and move the story under `AI/Composer` per RM-008 with a description that says why it hand-rolls.
3. `packages/cli` audit: add a rule `ai/prefer-composer` (warning, not error) that flags a JSX `<PromptInput` in consumer code with the message "Use <Composer>; drop to PromptInput only for a bespoke shell (see AI/Composer docs)". Exempt files that also render `<Composer>` (that is the library itself).
4. Registry manifest / `pnpm inventory` regenerated.

## Acceptance

- `grep -rn "<PromptInput\b" registry apps/docs/stories` returns nothing (or only the documented MentionInput exception).
- `brand-ui audit --strict` on a scaffolded `ai-assistant` archetype reports zero `prefer-composer` warnings.
- The `Patterns/Blocks/AI Composer` story and the `ai-chat-shell` block story render pixel-close to before (visual sweep, three themes).

## Test / gate

`pnpm inventory:check`, `pnpm components:check`, the block's Storybook `play` test, audit rule unit test in `packages/cli`.
