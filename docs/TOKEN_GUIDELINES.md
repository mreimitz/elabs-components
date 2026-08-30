# Token guidelines

Tokens are the brand contract. Components reference tokens; tokens reference
brands. Re-branding is a token change.

## Where tokens live

`packages/tokens/src/themes.css` is the **engine** — shipped as
`@elabs-ai/components-tokens/styles.css` and always imported:

- `:root` — neutral light base/fallback. A complete palette, so an app that
  imports nothing else still renders correctly.
- `@theme inline { --color-*: var(--*) }` — maps tokens to Tailwind utilities.
- the dials (decoration, density, motion), the base layer, the view-transition
  block. (A paused theme's block stays in the file but is not shipped — see
  `.claude/rules/paused-surfaces.md`.)

Each **reference theme** is its own opt-in file — `src/themes/light.css`,
`src/themes/dark.css`, exported as `@elabs-ai/components-tokens/themes/<name>.css`.
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

## Ordered neutral ramp (#14)

The semantic slots above give TWO text weights (`--foreground` /
`--muted-foreground`) and TWO divider weights (`--border` / `--border-strong`).
A dense product UI — a table row with a primary value, a secondary label,
tertiary metadata and a disabled action, all in one row — routinely needs more
rungs than that. `--foreground-1..4`, `--border-1..3` and `--surface-1..4` are
an ADDITIVE, ORDERED view onto the same tokens: every rung is either a `var()`
alias of an existing semantic slot (so retuning that slot still moves the
ramp) or a new literal for the gap the slots skip. Nothing above changes
meaning or value — reach for the ramp only when you need a rung the slots
don't name.

| Rung             | Role                    | Utility             | Relation                                                                                         |
| ---------------- | ----------------------- | ------------------- | ------------------------------------------------------------------------------------------------ |
| `--foreground-1` | primary value           | `text-foreground-1` | `== --foreground`                                                                                |
| `--foreground-2` | secondary label         | `text-foreground-2` | new — between foreground and muted                                                               |
| `--foreground-3` | tertiary / metadata     | `text-foreground-3` | `== --muted-foreground`                                                                          |
| `--foreground-4` | disabled                | `text-foreground-4` | new — lighter than muted-foreground; sub-AA by design (WCAG 1.4.3 exempts inactive-control text) |
| `--border-1`     | subtle (redundant edge) | `border-border-1`   | `== --border`                                                                                    |
| `--border-2`     | mid divider             | `border-border-2`   | new — more presence than `-1`, NOT 1.4.11-gated                                                  |
| `--border-3`     | strong (sole cue, ≥3:1) | `border-border-3`   | `== --border-strong`                                                                             |
| `--surface-1`    | page ground             | `bg-surface-1`      | `== --background`                                                                                |
| `--surface-2`    | base layer, near ground | `bg-surface-2`      | `== --surface`                                                                                   |
| `--surface-3`    | raised card / panel     | `bg-surface-3`      | `== --card`                                                                                      |
| `--surface-4`    | most elevated / float   | `bg-surface-4`      | `== --surface-elevated`                                                                          |

**Pick the rung by ROLE, not by "what looks right."** If two rungs render the
same in one theme (e.g. `surface-1`/`surface-2` in `light`, where `--surface`
and `--background` share a value), that is fine — the ramp still orders
correctly in every theme (verified in `themes-contrast.test.ts`), and a theme
that DOES separate them (both reference `dark` themes do) renders the
hierarchy for free. Don't invent a THIRD naming scheme for the same concept —
the existing `border` vs `border-strong` 1.4.11 decision test
(`styling-and-tokens.md`) still governs whether a divider needs `-3`.

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
