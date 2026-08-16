---
description: Visually validate brand-ui across both themes (screenshots + UI/UX design critique) via the brand-ui-visual-ux-reviewer agent
argument-hint: [playground | storybook | all] (default all)
allowed-tools: Skill, Task, Read, Write, Bash(pnpm:*), Bash(npx:*), Bash(curl:*), Bash(sleep:*), mcp__storybook__*
---

Run a visual + UX validation pass over brand-ui. Scope: `$ARGUMENTS` (default `all`).

Delegate to the **brand-ui-visual-ux-reviewer** agent (it drives the agent-browser skill
and applies the UI/UX design skills). Before handing off, make sure the dev
servers are reachable:

```bash
curl -sf http://localhost:5173 >/dev/null || (pnpm playground >/tmp/brandui-playground.log 2>&1 &)
curl -sf http://localhost:6006/index.json >/dev/null || (pnpm storybook >/tmp/brandui-storybook.log 2>&1 &)
```

> `pnpm storybook` pins **6006** with `--exact-port`, so it fails loudly if the
> port is taken instead of silently drifting to 6007. If it errors, free the
> stale instance with `lsof -ti tcp:6006 | xargs kill` and retry — Storybook is
> always reachable at 6006 by contract.

Then launch the `brand-ui-visual-ux-reviewer` agent to:

1. Screenshot the playground (Dashboard, Assistant, Pipeline, Landing) and a
   representative set of Storybook stories, in **both themes** (`qlik-bright`, `qlik-dark`). When the Storybook
   dev server is running, enumerate stories with `mcp__storybook__list-all-documentation`
   and get per-theme render URLs with `mcp__storybook__preview-stories`
   (`globals=theme:<slug>`) to cover the library systematically rather than hunting
   manually. See @.claude/rules/storybook-mcp.md.
2. Critique hierarchy, spacing, color/contrast, typography, consistency and
   accessibility using `ux-design:refactoring-ui`, `ux-design:ux-heuristics`,
   `design:design-critique`, `design:accessibility-review` and
   `ux-design:web-typography`.
3. Write a severity-ranked report to `apps/e2e/reports/visual-ux-<date>.md`.

This is a read-only review — it reports issues, it doesn't change components.
Pair it with `/qa-flows` (functional) and `pnpm test:e2e` (deterministic).
