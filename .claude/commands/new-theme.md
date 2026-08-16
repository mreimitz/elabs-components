---
description: Add a new brand theme using semantic tokens (themes.css + theme-types + optional registry theme)
argument-hint: <theme-name> [brand description or key colors]
allowed-tools: Read, Edit, Write, Grep, Bash(pnpm:*)
---

You are adding a new theme to `@qlik-coe-emea/qlabs-components-tokens`. Read `@.claude/rules/theming.md`
and `docs/TOKEN_GUIDELINES.md` first.

Steps:

1. In `packages/tokens/src/themes.css`, add a `[data-theme="<name>"]` block that
   overrides **every** semantic token defined in `:root`. Do not add new token
   names unless you also map them in the `@theme inline` block.
   - Use `oklch()` values. Keep text/background pairs WCAG AA (4.5:1 body text).
   - Cover the full set: surfaces, sidebar, canvas/flow, chat, chart-1..5, radius.
   - **Any NEW `--token` you introduce must be scaffolded into ALL theme
     blocks** (`:root` + the five `[data-theme="…"]` blocks), not just this one —
     the theme-token-parity gate (`pnpm theme-parity:check`, #89) fails otherwise.
2. In `packages/tokens/src/theme-types.ts`, add `<name>` to `THEMES` and a
   `THEME_META["<name>"]` entry (label, `dark` flag, description).
3. (Optional) Mirror the palette as a `registry:theme` item in
   `registry/registry.json` so other projects can `npx shadcn add <name>-theme`.
4. Verify: switch to the theme in the playground/Storybook and confirm contrast,
   focus rings, and that no component breaks. Run `pnpm --filter @qlik-coe-emea/qlabs-components-tokens typecheck`.

Do NOT hardcode the theme's colors anywhere except `themes.css` (and the
registry theme item). Components must remain brand-agnostic.
