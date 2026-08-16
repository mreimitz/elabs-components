---
description: Define-to-build — scaffold a new brand-ui app from a plain-language description (guided interview → app-spec.md → annotated scaffold + starter CLAUDE.md)
argument-hint: "[app description, e.g. 'sales pipeline dashboard, qlik-dark' — or empty for the full interview]"
allowed-tools: Read, Edit, Write, Grep, Glob, AskUserQuestion, Bash(pnpm:*), Bash(npx shadcn@latest *), Bash(npx @qlik-coe-emea/qlabs-components-cli *), mcp__storybook__*
---

You are scaffolding a **new app** for a user who should not need design
expertise or component-name knowledge. The full procedure lives in the skill —
**Read `skills/brand-ui-new-app/SKILL.md` and its `reference/` files now and
follow them.** This command only sets the entry conditions:

Input: `$ARGUMENTS` (a free-form description; may be empty).

1. **Mode** (per the skill's §0): description rich or user asked to spec →
   full 7-stage interview; archetype obvious → quick 3-question mode; user
   said "just scaffold" → quick with zero redundant questions. Never re-ask
   what `$ARGUMENTS` already answers.
2. **Interview** with `AskUserQuestion` (≤4 questions/round), writing every
   answer into `app-spec.md` as you go. Use the visual fidelity ladder for
   theme/archetype choices — prefer real Storybook renders
   (`mcp__storybook__preview-stories`, `globals=theme:<slug>`; start
   `pnpm storybook` in the background if needed and stop it after).
3. **Scaffold from the spec**: start from the generated
   `docs/playbooks/templates/<archetype>.tsx` (derived from its Storybook story)
   - the `docs/playbooks/<archetype>.md` recipe; replace the placeholder data the
     spec answers; leave unanswered fields as `// TODO(spec):`; emit the starter
     `CLAUDE.md` (from `skills/brand-ui-new-app/reference/starter-claude-md.md`)
     and `app-spec.md` at the app root.
4. **Verify honestly**: typecheck the scaffold; render in the chosen theme if
   a render path exists, otherwise state plainly it compiled but was not
   visually verified. List remaining `WIRE:` points as next steps.

Archetype mapping, stage-6 question sets, and per-archetype defaults:
`skills/brand-ui-new-app/reference/archetypes.md`.
