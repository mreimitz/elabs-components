---
description: Add a new brand theme using semantic tokens (theme stylesheet + theme-types + package surface)
argument-hint: <theme-name> [brand description or key colors]
allowed-tools: Read, Edit, Write, Grep, Bash(pnpm:*)
---

You are adding a **reference theme to this repo** — a third built-in, which is
rare. Read `@.claude/rules/theming.md` and `docs/TOKEN_GUIDELINES.md` first.

**Check this is the right job.** Theming is open (ADR
`docs/ADR/0029-open-theme-registry.md`): a CONSUMER writing their own theme needs
none of the steps below. They write a `[data-theme]` stylesheet in their own app,
register it with `<ThemeProvider themes={[...BUILT_IN_THEME_DEFINITIONS,
defineTheme({…})]}>`, and assert coverage against `THEME_TOKEN_NAMES` — the
recipe is `docs/CONSUMING.md` §5.1. Only run this command when the theme should
SHIP from `@elabs/components-tokens`.

Steps:

1. Create `packages/tokens/src/themes/<name>.css` — its own file, a sibling of
   `light.css`/`dark.css`, holding one `[data-theme="<name>"]` block that
   overrides **every** semantic token defined in `:root`. Do not add new token
   names unless you also map them in `themes.css`'s `@theme inline` block.
   - Use `oklch()` values. Keep text/background pairs WCAG AA (4.5:1 body text).
   - Cover the full set: surfaces, sidebar, canvas/flow, chat, chart-1..12, radius.
     `THEME_TOKEN_NAMES` is the machine-readable contract.
   - Declare `color-scheme: light|dark` — it is load-bearing, not decoration:
     `resolveThemeIsDark()` reads it to swap Monaco/basemap/Sonner assets.
   - **Any NEW `--token` you introduce must be scaffolded into ALL theme
     blocks**, not just this one — the theme-token-parity gate
     (`pnpm theme-parity:check`, #89) fails otherwise.
2. In `packages/tokens/src/theme-types.ts`, add `<name>` to `BUILT_IN_THEMES`
   and a `BUILT_IN_THEME_META["<name>"]` entry (label, `dark` flag, description).
3. Wire the new file into the package surface — a stylesheet nobody can import
   is not shipped:
   - `packages/tokens/package.json` — add `"./themes/<name>.css"` to `exports`
     **and** `publishConfig.exports` (source path vs `dist` path).
   - the `build` script copies `src/themes` wholesale (`cp -r src/themes
dist/themes`) — nothing to add, but confirm it still does.
   - the DTCG round-trip: `pnpm --filter @elabs/components-tokens tokens:extract`
     derives the mode list from `BUILT_IN_THEMES` and writes
     `tokens/$themes.json` + `tokens/themes/<name>.tokens.json`. Then
     `pnpm tokens:check` must report the new stylesheet as in sync.
   - the exported contract: `pnpm --filter @elabs/components-tokens tokens:names`
     if you added a token name (`pnpm token-contract:check` gates freshness).
   - import it where the reference themes are actually wanted:
     `apps/docs/.storybook/preview.css`, `fixtures/consumer-smoke/src/index.css`,
     and the scaffold CSS in `packages/cli/lib/engine.mjs`.
4. Do **not** mirror the palette into `registry/registry.json`. A theme ships as
   a stylesheet from `@elabs/components-tokens`, and the registry is blocks-only —
   `registry:theme` items were removed because hand-copied `cssVars` are a second
   home for the same colours and had already drifted from `themes.css`. A consumer
   who wants only the palette imports the stylesheet or follows
   `docs/CONSUMING.md` §5.1. See `@.claude/rules/registry.md`.
5. Verify: switch to the theme in the playground/Storybook and confirm contrast,
   focus rings, and that no component breaks. Run
   `pnpm --filter @elabs/components-tokens typecheck test`, then
   `pnpm theme-parity:check && pnpm roles:check && pnpm tokens:check`.
   **Read the COUNTS these gates print, not just their exit code** — a theme
   parser that silently reads fewer blocks passes green.

Do NOT hardcode the theme's colors anywhere except its own theme stylesheet.
Components must remain brand-agnostic.
