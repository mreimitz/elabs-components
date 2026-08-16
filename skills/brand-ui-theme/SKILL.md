---
name: brand-ui-theme
description: Create or retune a brand-ui theme (token work). Use when adding a new theme, re-branding the system to a customer's palette, adjusting global radius/spacing/surfaces, or fixing token-level contrast across themes. Use when the user says "new theme", "brand it for <customer>", "make corners less rounded", "dark theme", "adjust the tokens", or "our colors". Every change is a token in a theme stylesheet — never a hardcoded value in a component.
user-invocable: true
argument-hint: "<theme-name> [brief]"
allowed-tools:
  - Bash(pnpm brand-ui *)
  - Bash(pnpm --filter *)
---

# brand-ui-theme

Theming is a **token change, not a component change**. This skill is the portable
front door to brand-ui's theming workflow and rules.

## The theme set is OPEN — decide which job you have

`ThemeName` is `string`. A theme is anything with a `[data-theme="…"]` block
covering the token contract, registered on a `ThemeProvider` (ADR 0029). So there
are two different jobs, and only one of them touches this package:

- **A CONSUMER theme** (the common case) — write a `[data-theme]` stylesheet in
  your own app, register it with `<ThemeProvider themes={[...BUILT_IN_THEME_DEFINITIONS,
defineTheme({ value, label, dark })]}>`, and assert coverage against the exported
  `THEME_TOKEN_NAMES` in your own test. No fork, no PR into this repo. Recipe:
  `docs/CONSUMING.md` §5.1.
- **A REFERENCE theme shipped from `@elabs/components-tokens`** — rare. That is
  the "Add a reference theme" section below.

## Where everything lives

`@elabs/components-tokens/styles.css` is the **engine**: `:root` (a complete
neutral light palette — an app importing only this renders correctly), the
`@theme inline` token→utility map, the dials, the base layer.

Each reference theme is its own **opt-in** file, exported as
`@elabs/components-tokens/themes/<name>.css`. `styles.css` does not import them;
a consumer imports the ones they want, or none.

`theme-types.ts` holds the built-in registry — `BUILT_IN_THEMES`,
`BUILT_IN_THEME_META`, `BUILT_IN_THEME_DEFINITIONS`, `DEFAULT_THEME` — plus
`defineTheme()` and `THEME_TOKEN_NAMES`. Run `brand-ui info` for the live theme
list, token set, and current `--radius`.

## Add a reference theme

1. Create `packages/tokens/src/themes/<name>.css` with one `[data-theme="<name>"]`
   block overriding **every** token (a missing token falls back to `:root` and
   usually looks wrong). Use OKLCH. Declare `color-scheme: light|dark` — it is
   load-bearing: `resolveThemeIsDark()` reads it to swap Monaco/basemap/Sonner
   assets for themes it has never heard of.
2. Add the `BUILT_IN_THEMES` + `BUILT_IN_THEME_META` entries; set `DEFAULT_THEME`
   only if it should be the default.
3. Export it: `"./themes/<name>.css"` in `exports` **and** `publishConfig.exports`,
   then `pnpm --filter @elabs/components-tokens tokens:extract` for the DTCG
   round-trip. Import it in `apps/docs/.storybook/preview.css`,
   `fixtures/consumer-smoke`, and the scaffold CSS in `packages/cli/lib/engine.mjs`.
4. Optionally ship a `registry:theme` item (`brand-ui-registry`).
5. Map any new visual concept in the `@theme inline` block so `bg-foo`/`text-foo`
   resolve.

## Re-brand from a customer palette

Derive the brand color → set `--primary` (+ `--ring`, sidebar/chart accents),
compose surfaces/ink around it, keep `--destructive` conventional. Carry warmth via
accent + type, not a tinted near-white body. Preserve an existing committed brand
if one is already in the tokens.

## Global tweaks (radius, spacing, surfaces)

These are single-token edits that cascade. Example: corner rounding is `--radius`
per theme; `rounded-sm/md/lg/xl` derive via `@theme inline`. To square the system,
lower `--radius` in each block — don't touch components.

## Verify (non-negotiable)

- Body text ≥ 4.5:1 / UI ≥ 3:1 in **every** theme. Use the `brand-ui-audit` skill
  (oklch-aware, rendered) — don't eyeball. Watch the brand hue as small text on a
  light surface, and the `*-foreground` ink on filled brand plates.
- Re-render the playground/Storybook in the new theme.
- `pnpm --filter @elabs/components-tokens typecheck` and keep
  `BUILT_IN_THEMES`/`BUILT_IN_THEME_META` in sync with the theme stylesheets.
- **Read the counts the gates print, not just their exit code.** Anything that
  parses theme blocks must read the whole file SET; a parser that quietly reads
  fewer blocks after a rename or a move still exits 0.
