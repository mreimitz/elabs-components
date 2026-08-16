# Token guidelines

Tokens are the brand contract. Components reference tokens; tokens reference
brands. Re-branding is a token change.

## Where tokens live

`packages/tokens/src/themes.css` is the **engine** — shipped as
`@elabs/components-tokens/styles.css` and always imported:

- `:root` — neutral light base/fallback. A complete palette, so an app that
  imports nothing else still renders correctly.
- `@theme inline { --color-*: var(--*) }` — maps tokens to Tailwind utilities.
- the dials (decoration, density, motion), the base layer, the view-transition
  block. (A paused theme's block stays in the file but is not shipped — see
  `.claude/rules/paused-surfaces.md`.)

Each **reference theme** is its own opt-in file — `src/themes/light.css`,
`src/themes/dark.css`, exported as `@elabs/components-tokens/themes/<name>.css`.
`styles.css` does **not** import them.

`packages/tokens/src/theme-types.ts` holds the **built-in registry**
(`BUILT_IN_THEMES`, `BUILT_IN_THEME_META`, `BUILT_IN_THEME_DEFINITIONS`,
`DEFAULT_THEME`) plus `defineTheme()` and `THEME_TOKEN_NAMES`. The theme set is
open — `ThemeName` is `string` and a consumer registers their own through
`<ThemeProvider themes={…}>`. See ADR
[0029](./ADR/0029-open-theme-registry.md) and `docs/CONSUMING.md` §5.1.

## Semantic token set

Surfaces & text: `--background`, `--foreground`, `--card(-foreground)`,
`--popover(-foreground)`, `--surface`, `--surface-muted`, `--surface-elevated`.
Brand & intents: `--primary(-foreground)`, `--secondary(-foreground)`,
`--accent(-foreground)`, `--muted(-foreground)`, `--destructive(-foreground)`,
plus `--success/--warning/--info(-foreground)` extensions.
Status TEXT variants: `--success-text`, `--destructive-text` — see "Fill vs. text" below.
Lines & focus: `--border`, `--input`, `--ring`.
App chrome: `--sidebar(-foreground/-border/-accent/-muted-foreground...)`.
Canvas/flow: `--canvas`, `--canvas-grid`, `--flow-node(-foreground)`, `--flow-edge`.
Chat: `--chat-user(-foreground)`, `--chat-assistant(-foreground)`.
Data: `--chart-1..12`. Shape: `--radius` (+ derived `--radius-sm/md/lg/xl`).

## Rules

1. **Only `themes.css` (and registry `registry:theme` items) may contain raw
   colors.** Everywhere else, use token-backed utilities.
2. **Adding a visual concept = adding a token** in _every_ theme block + a
   mapping in `@theme inline`. Then use `bg-foo` / `text-foo`.
3. **Every theme overrides every token.** Missing tokens fall back to `:root`.
   In-repo themes are gated by `pnpm theme-parity:check`; a consumer's theme
   lives where that gate cannot reach, so the contract ships as data —
   `THEME_TOKEN_NAMES`, asserted in the consumer's own test.
4. **Contrast:** body text ≥ 4.5:1 (WCAG AA) in every theme. The
   `packages/tokens/src/themes-contrast.test.ts` Vitest gate enforces this for the
   status-text + muted/sidebar-muted pairings across both themes.
5. **Fill vs. text — don't reuse a fill token as on-surface text.** A status
   token like `--success` / `--destructive` is tuned as a FILL (a colored plate
   with `*-foreground` ink on top), so its lightness is chosen for "white reads on
   this fill," NOT for "this color reads as text on a white card." Rendered as bare
   colored text on `--background`/`--card`/`--surface-muted` it fails AA. Use the
   on-surface TEXT variants instead — `text-success-text` / `text-destructive-text`
   (tuned ≥ 4.5:1 on those surfaces in every theme). Keep `bg-success`/`bg-destructive`
   (badges, alerts, timeline/flow nodes) on the FILL tokens. Likewise, muted SIDEBAR
   nav text uses `text-sidebar-muted-foreground` (a real token, ≥ 4.5:1 vs `--sidebar`),
   never an opacity modifier on `--sidebar-foreground` (which strands dark-on-dark).
6. Use `oklch()` so deriving hover/active and contrast-safe variants is even.

## Replacing placeholder brand assets

- **Colors:** edit token values per theme (start with `--primary`,
  `--background`, `--foreground`, `--accent`, `--ring`).
- **Logo:** replace `packages/icons/src/brand-logo.tsx` (keep the `currentColor`
  - variant API so consumers don't change).
- **Icons:** add brand icons under `packages/icons/src/sample-icons/` using the
  `createIcon` factory. `lucide-react` is the **default** library for generic UI
  glyphs (not a fallback) — see @.claude/rules/icons.md.

Use the `/new-theme` command to add a brand/theme end-to-end.
