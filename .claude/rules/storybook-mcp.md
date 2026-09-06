# Storybook MCP

## Two servers

- **`brand-ui`** (persistent; `.mcp.json`, `brand-ui mcp` stdio;
  `mcp__brand-ui__{info,search,docs,tokens,audit}`) — _what exists, how to use
  it_: props, variants, intent, tokens, search, audit. Works with Storybook
  DOWN (never block on it for a prop); fresh once `pnpm manifest`
  ran. See `docs/CONCEPT-ai-skills.md` + Storybook "Docs/brand-ui MCP Server".
- **`storybook`** (`@storybook/addon-mcp`; only while `pnpm storybook` runs, at
  `http://localhost:6006/mcp`) — _see it render, test it_: previews,
  interaction + axe tests, cross-theme checks.

## Availability

- Tools up → use them. Testing/reviewing UI with it down → **start it**
  (`pnpm storybook`, background), drive it, **stop it when done**. Never for
  non-UI work. Else: fallbacks.
- Agent `tools:` allowlists use the `mcp__storybook__*` wildcard, never
  enumerated names.

## Tools — `mcp__storybook__<name>`

Server `storybook` in `.mcp.json`; a rename updates every `mcp__storybook__*`
reference (here, `CLAUDE.md`, agent `tools:`, `settings.json`).

- **Docs** — `list-all-documentation` (`withStoryIds:true` → exact IDs),
  `get-documentation` (real props/types), `get-documentation-for-story`.
- **Dev** — `get-storybook-story-instructions` (call **before** writing a
  `*.stories.tsx`), `preview-stories` (`globals={theme:'<slug>'}`; always
  surface the URL to the user).
- **Test** — `run-story-tests` (real-browser interaction + axe). **Always scope
  to specific stories — never "run all".**

## Story IDs

`title` kebab-cased, `/` → `-`, `--` before the export:
`title:"Foundation/Button"` → `foundation-button--default`.

## Themes (two; default `light`)

Slugs `light`, `dark` — never display names. `preview-stories`:
`globals={theme:'dark'}`; URL `/?path=/story/<storyId>&globals=theme:<slug>`.
Headless: `STORYBOOK_THEME=<slug>` pins the run (unset = `light` only):

```
cd apps/docs && STORYBOOK_THEME=dark pnpm exec vitest --project storybook run <name>
```

A per-story `parameters.themes.themeOverride` or toolbar global wins.

## Workflow

- **ADD / DEV** — `list-all-documentation` (dedupe first) →
  `get-documentation`/`-for-story` → `get-storybook-story-instructions` → build
  → `preview-stories`.
- **TEST** — `run-story-tests` on touched stories → fix → re-run until green.
  "Tests are already running"/unavailable → **retry once, then the CLI**; never
  skip the interaction+axe gate or substitute screenshots + contrast math.
- **REVIEW** — `run-story-tests` + `preview-stories` in both themes; report
  **story ID + theme slug**.

## Fallbacks

Discovery → `packages/*/src/index.ts` barrels · props → the `.tsx` + exported
types · stories → a sibling `*.stories.tsx` · tests →
`pnpm --filter @elabs-ai/components-docs test-storybook` / `pnpm --filter <pkg>
test` (also when the MCP runner is busy — a UI change still needs a real
interaction + axe pass).

## Issue handoff

Cite the exact **story ID + theme slug** (+ `preview-stories` URL if any) for
`brand-ui-root-cause-analyst`; see @.claude/rules/issue-workflow.md.

History and measurements: docs/rules-history/storybook-mcp.md
