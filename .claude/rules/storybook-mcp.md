---
paths:
  - "**/*.stories.tsx"
  - "**/*.test.tsx"
  - "apps/docs/**"
---

# Storybook MCP

## Two servers

- **`brand-ui`** (persistent; `.mcp.json`, `brand-ui mcp` stdio;
  `mcp__brand-ui__{info,search,docs,tokens,audit}`) — what exists, how to use it: props,
  variants, intent, tokens, search, audit. Works with Storybook down; fresh once
  `pnpm manifest` ran.
- **`storybook`** (`@storybook/addon-mcp`; only while `pnpm storybook` runs, at
  `http://localhost:6006/mcp`) — see it render, test it: previews, interaction + axe tests,
  cross-theme checks.

## Availability

Tools up → use them. Testing/reviewing UI with it down → start it (`pnpm storybook`,
background), drive it, stop it when done — never for non-UI work.

## Tools — `mcp__storybook__<name>`

- **Docs** — `list-all-documentation` (`withStoryIds:true` → exact IDs), `get-documentation`
  (real props/types), `get-documentation-for-story`.
- **Dev** — `get-storybook-story-instructions` (call BEFORE writing a `*.stories.tsx`),
  `preview-stories` (`globals={theme:'<slug>'}`; always surface the URL).
- **Test** — `run-story-tests` (real-browser interaction + axe). Always scope to specific
  stories — never "run all".

## Story IDs

`title` kebab-cased, `/` → `-`, `--` before the export: `title:"Foundation/Button"` →
`foundation-button--default`.

## Themes (two; default `light`)

Slugs `light`, `dark` — never display names. `preview-stories`: `globals={theme:'dark'}`;
URL `/?path=/story/<storyId>&globals=theme:<slug>`. Headless:
`STORYBOOK_THEME=<slug> pnpm exec vitest --project storybook run <name>` (unset = `light`
only). A per-story `parameters.themes.themeOverride` or toolbar global wins.

## Workflow

- **ADD/DEV** — `list-all-documentation` (dedupe first) → `get-documentation`/`-for-story` →
  `get-storybook-story-instructions` → build → `preview-stories`.
- **TEST** — `run-story-tests` on touched stories → fix → re-run until green. Unavailable →
  retry once, then the CLI fallback — never skip the interaction+axe gate.
- **REVIEW** — `run-story-tests` + `preview-stories` in both themes; report story ID + theme
  slug.

## Fallbacks

Discovery → `packages/*/src/index.ts` barrels · props → the `.tsx` + exported types ·
stories → a sibling `*.stories.tsx` · tests → `pnpm --filter @elabs-ai/components-docs
test-storybook` / `pnpm --filter <pkg> test`.

History: `docs/rules-history/storybook-mcp.md`.
