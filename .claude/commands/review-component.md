---
description: Review a component against the brand-ui quality gates and accessibility rules
argument-hint: <path/to/component.tsx>
allowed-tools: Read, Grep, Glob, Bash(pnpm:*), mcp__storybook__*
---

Review the component at `$ARGUMENTS` (or the most recently changed component if
no path is given). This is a read/verify task — propose fixes, don't silently
rewrite unless asked.

Check against `@.claude/rules/quality-gates.md`, `@.claude/rules/component-api.md`,
`@.claude/rules/styling-and-tokens.md`, and `@.claude/rules/accessibility.md`:

- [ ] Exports its public types; props are documented where non-obvious
- [ ] `forwardRef` where a DOM ref is meaningful; spreads `...props`; merges `className` via `cn()`
- [ ] Variants via `cva` (no ad-hoc conditional class soup)
- [ ] Semantic tokens only — no raw hex / arbitrary colors
- [ ] Works in both themes (`light`, `dark`)
- [ ] Keyboard accessible, visible focus ring, correct roles/labels, no div-as-button
- [ ] Controlled/uncontrolled behavior is correct and predictable
- [ ] Has a Storybook story and at least a smoke test
- [ ] Exported from the package barrel
- [ ] No paid dependencies; app vs. marketing concerns not mixed

**Verify in Storybook (when the dev server is running).** Use
`mcp__storybook__get-documentation` to confirm the documented prop surface matches
the code; run `mcp__storybook__run-story-tests` scoped to this component (interaction

- axe a11y) and report failures with their story IDs; use
  `mcp__storybook__preview-stories` with `globals=theme:<slug>` to confirm it renders
  in both themes. If the server is unavailable, fall back to
  `pnpm --filter @elabs-ai/components-docs test-storybook` and reading the story/source. See
  @.claude/rules/storybook-mcp.md.

Output a short report: ✅ passes, ⚠️ issues (with file:line and a concrete fix),
and any recommended follow-ups. Run `pnpm --filter <pkg> typecheck test` to back
up your findings.

## Interaction pass

After the component gates, run the interaction / front-end-hygiene checklist —
`/review-interface <path>` against `.claude/rules/interaction-guidelines.md`
(forms, micro-typography, content truncation, overscroll/touch, images/CLS,
hover/destructive). It complements this review; it doesn't replace it.
