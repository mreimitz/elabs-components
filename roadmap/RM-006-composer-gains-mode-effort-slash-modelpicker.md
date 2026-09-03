---
id: RM-006
title: Composer becomes actually canonical — mode, effort, slash commands and a real model picker slot
status: planned
priority: P1
effort: M (1 to 2 days)
depends_on: []
blocks: [RM-007, RM-008]
source: docs/review/2026-09-03-storybook-ia-and-ambiguity-review.md §2
---

# RM-006 Composer gains mode / effort / slash / modelPicker

## Finding

`Composer` (`packages/ai/src/composer.tsx`, 202 lines) is built on `PromptInput` (`prompt-input.tsx`, 1,668 lines) and both docblocks name it the canonical chat input ("reach for it instead of hand-rolling a PromptInput footer"). But:

- `PromptInputMode`, `PromptInputEffort` and `PromptInputSlash` exist as siblings of the primitive and their only consumer is `packages/terminal/src/terminal-composer.tsx`. `Composer` exposes none of them. A consumer who needs a mode selector in a chat input must hand-roll `PromptInput`, against the guidance.
- `Composer` defaults `model = "Claude Opus 4"` and renders it as a `PromptInputButton` with a Globe icon that does nothing on click. `Core/ModelPicker` describes itself as "sized to sit in a composer footer" and is not used.
- The `Suggestions` row is baked in; fine, but it is the only composed extra the component has.

## Change

`ComposerProps` additions (all optional, all additive, no existing prop changes meaning):

```ts
/** App-defined operating mode control; renders a PromptInputMode in the tools cluster. */
mode?: Pick<PromptInputModeProps, "modes" | "value" | "defaultValue" | "onValueChange">;
/** Ordered reasoning-effort control; renders a PromptInputEffort in the tools cluster. */
effort?: Pick<PromptInputEffortProps, "levels" | "value" | "defaultValue" | "onValueChange">;
/** Slash-command palette; when set the textarea is a PromptInputSlashTextarea. */
slashCommands?: PromptInputSlashProps["commands"];
onSlashCommand?: PromptInputSlashProps["onSelect"];
/** Replaces the model pill. Pass a <ModelPicker> (or anything). Default: nothing. */
modelPicker?: ReactNode;
```

- Remove the `"Claude Opus 4"` default. Keep `model?: ReactNode` for one release as a deprecated alias that renders the old static pill, per `docs/DEPRECATION.md`, then delete.
- Order in the footer: attach · modelPicker · mode · effort │ voice · send. Mirror `TerminalComposer`'s arrangement so the two skins agree.
- `slashCommands` swaps `PromptInputTextarea` for `PromptInputSlashTextarea` inside the same `PromptInputBody`; nothing else changes.
- Stories: `WithMode`, `WithEffort`, `WithSlashCommands`, `WithModelPicker` (uses `Core/ModelPicker`), `Everything`. Each with a `play` test that opens the control and asserts the callback.
- Tests in `composer.test.tsx` for each slot and for the `disabled` guard still holding when a slash palette is open.
- `packages/ai/README` / docs description: "Composer is the chat input. Every control PromptInput* ships is reachable from a Composer prop; drop to PromptInput only for a bespoke shell."
- Regenerate the manifest (`pnpm agent-docs`) so `brand-ui info Composer` shows the new props.

## Acceptance

- Everything `TerminalComposer` can show (mode, effort, slash, shortcuts aside) a `Composer` can show through props.
- `composer.stories.tsx` renders no hard-coded model name.
- `pnpm audit --strict` on the stories passes; three-theme visual sweep of `Everything` (light, dark, and the density/decoration toolbar) shows the footer wrapping cleanly at 320px.

## Test / gate

`vitest --project storybook run composer`, `pnpm ai:types-only` (no runtime `ai` import added), `pnpm agent-docs:check`.
