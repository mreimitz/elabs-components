---
description: Drive the agent-browser skill to functionally QA the playground + Storybook flows and report pass/fail with screenshots and console errors
argument-hint: [playground | storybook | all] (default all)
allowed-tools: Skill, Read, Write, Bash(pnpm:*), Bash(npx:*), Bash(curl:*), Bash(sleep:*), mcp__storybook__*
---

You are running an automated, browser-driven QA pass over brand-ui using the
**agent-browser** skill. This complements the deterministic Playwright suite
(`pnpm test:e2e`) with exploratory checks: real rendering, console health, visual
sanity, and edge cases. Scope: `$ARGUMENTS` (default `all`).

## 0. Bring up the dev servers (if not already running)

Check the ports; start whatever is missing in the background, then wait until
they respond:

```bash
# Playground (Vite) on 5173
curl -sf http://localhost:5173 >/dev/null || (pnpm playground >/tmp/brandui-playground.log 2>&1 &)
# Storybook on 6006 (only if testing storybook/all)
curl -sf http://localhost:6006/index.json >/dev/null || (pnpm storybook >/tmp/brandui-storybook.log 2>&1 &)
```

Poll each URL (up to ~90s) before driving the browser. If a server won't start,
report that and continue with whatever is up.

`pnpm storybook` pins **6006** with `--exact-port`, so it fails loudly if the
port is busy (rather than drifting to 6007). If it errors, free the stale
instance with `lsof -ti tcp:6006 | xargs kill` and retry — Storybook is always
reachable at 6006 by contract.

## 1. Open the browser

Use the agent-browser skill/tools (prefer them over any other browser
automation). Set a desktop viewport (≥ 1280×800). Capture console + page errors
throughout (use the console/errors tools) and attach a screenshot to each step.

## 2. Playground flows (http://localhost:5173)

Walk and verify each flow; record PASS/FAIL + a screenshot + any console errors:

1. **Load + theme switching** — page loads on the Dashboard; `<html data-theme>`
   is `qlik-bright`. Use the "Theme" selector to switch to `qlik-dark` and
   `blueprint`; confirm `data-theme` updates and the UI re-themes (no unstyled
   flashes, no illegible contrast). Screenshot each theme.
2. **Sidebar navigation** — click Dashboard / Assistant / Pipeline / Landing;
   confirm each page renders (`[data-testid="page-*"]`).
3. **Dashboard data table** — type in "Filter services…" and confirm rows filter;
   open "Environment" facet and select "Dev" (rows narrow); open "Columns" and
   hide "owner" (the Owner header disappears).
4. **AI assistant** — type a message and submit (Enter); confirm it appears and a
   reply follows. Check tool-call card, agent steps and citations render.
5. **Flow canvas** — confirm nodes/edges render; click a node and confirm the
   inspector updates; exercise the zoom controls.
6. **Marketing** — hero, feature grid, stats band and CTA render.

## 3. Storybook smoke (http://localhost:6006)

**Preferred (Storybook MCP — the dev server is up by step 0, so the tools exist):**
enumerate stories programmatically with `mcp__storybook__list-all-documentation`
(`withStoryIds:true`) and batch-detect render/interaction/a11y failures with
`mcp__storybook__run-story-tests` — far more systematic than manual sampling. Use
`mcp__storybook__preview-stories` to open any flagged story. See
@.claude/rules/storybook-mcp.md.

**Fallback (MCP tools unavailable):** fetch `/index.json`, then for a representative
sample of stories (at least one per package/title) open
`iframe.html?id=<id>&globals=theme:<slug>` and confirm the story renders with no
console errors. Flag any blank or erroring story.

Valid theme slugs (three; default `qlik-bright`): `qlik-bright`, `qlik-dark` — always the CSS slug, never a display name.

## 4. Report

Write a concise report to `apps/e2e/reports/qa-flows-<date>.md` containing:

- A results table: flow → PASS/FAIL → notes.
- All console/page errors found (with the flow + theme they occurred in).
- Paths to the screenshots you captured.
- A short "Top issues" list, most severe first.

## 5. File every finding as a GitHub issue (do NOT fix)

You are a **finder**: you report, you never edit product code. For each FAIL or
notable problem, run `/file-issue` (passing the report path or the specific
finding). That pipeline sends it through the `brand-ui-root-cause-analyst` for deep
root-cause analysis and opens an implementation-ready GitHub issue (with dedupe).
Fixes happen separately via `brand-ui-component-builder` / `/review-component`. For a
visual/UX critique, run `/visual-review`.
