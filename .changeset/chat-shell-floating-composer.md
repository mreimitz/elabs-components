---
"@elabs-ai/components-ai": minor
---

`ChatShell`: the transcript now runs the full height and scrolls behind a floating, padded composer, fading out around it. The composer is centred at `--chat-composer-column` (default `--container-3xl`) and the transcript at `--chat-column` (default `--container-4xl`); `ConversationContent` reads both, and `ConversationScrollButton` sits above the composer. This applies to both variants — `variant` now only decides the frame (`card` border vs `bare`). The root carries `data-slot="chat-shell"`. `ProducedAssetTree` renders its empty note without an empty `role="tree"`.

`Composer`: new `mentions` prop — an @-mention roster (`MentionInput`) on the composer's own field, controlled or uncontrolled, reset after an accepted submit. It is exclusive with `slashCommands` at the type level (`ComposerProps` is now `ComposerBaseProps & ComposerFieldProps`).
