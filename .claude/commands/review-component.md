---
description: Review a component or screen against the brand-ui quality gates, interaction hygiene, accessibility and both themes
argument-hint: <path/to/component.tsx | screen path | story title>
allowed-tools: Task, Read, Grep, Glob, Bash(pnpm:*), mcp__storybook__*
---

Review `$ARGUMENTS` (or the most recently changed component if none is given). This is a
read/verify task — report fixes, don't rewrite unless asked.

## 1. Component gates

Check against `@.claude/rules/quality-gates.md`, `@.claude/rules/component-api.md`,
`@.claude/rules/styling-and-tokens.md` and `@.claude/rules/accessibility.md`:

- [ ] Public types exported; exported from the package barrel
- [ ] `forwardRef` where a DOM ref is meaningful; spreads `...props`; `className` via `cn()`
- [ ] Variants via `cva` (no ad-hoc conditional class soup); `data-slot` on root and parts
- [ ] Semantic tokens and type roles only — no raw hex, no `text-sm`/`text-[17px]`
- [ ] Keyboard accessible, visible `focus-ring`, correct roles/labels, no div-as-button
- [ ] Controlled/uncontrolled behaviour predictable
- [ ] Default story (`tags: ["autodocs"]`) covering variants + states; a smoke test

## 2. Interaction hygiene (static, terse `file:line`)

Per `@.claude/rules/interaction-guidelines.md`: `transition: all` · `outline-none` without a
focus-ring replacement · `<div onClick>` · icon button without `aria-label` · `<img>` without
dimensions · input without label · hardcoded date/number format (use `Intl.*`) · `...`
instead of `…` · truncating flex child without `min-w-0` · no real empty/loading/error state
· destructive action without confirm/undo · `overscroll-behavior: contain` missing on
overlays.

## 3. Render it — both themes

With Storybook up (start `pnpm storybook` in the background if needed; stop it after):

- `mcp__storybook__get-documentation` — documented props match the code.
- `mcp__storybook__run-story-tests` scoped to this component's stories (interaction + axe);
  report failures by story ID. Runner unavailable → `pnpm --filter
@elabs-ai/components-docs test-storybook`.
- `mcp__storybook__preview-stories` with `globals={theme:'light'}` and `{theme:'dark'}`;
  surface the URLs. Check contrast, focus rings and states in each.

For a whole screen, a cross-theme visual sweep, or an exploratory QA pass over an app flow
(load, theme switch, navigation, filters, console errors), dispatch the
**`brand-ui-reviewer`** agent (sections 1–3) instead of doing it inline.

## 4. Back it up

`pnpm --filter <pkg> typecheck`, `pnpm --filter <pkg> lint`, `pnpm --filter <pkg> test`
(three separate invocations).

## Output

A short report: ✅ passes, ⚠️ issues (`file:line` + concrete token-referenced fix), story IDs

- theme slugs you actually rendered, and what you did not verify. Small in-scope fixes can be
  applied if the user asks; anything left behind goes to `/file-issue`.
