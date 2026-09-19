# Brand theme fidelity review — Qlik, ClickHouse, Salesforce, Snowflake

2026-09-18 · scope: `themes/qlik`, `themes/clickhouse`, `themes/salesforce`, `themes/snowflake`
· reviewed against the real SaaS products, not their marketing sites.

## Summary

The four families rendered as one generic admin template with four colour swaps. Three of
them were also built from the wrong reference: ClickHouse from clickhouse.com and a
third-party summary, Snowflake from snowflake.com's brand page, Salesforce from the SLDS 2
Cosmos theme that almost no org has switched on. Qlik was measured on a real tenant but was
tuned like a shadowed, generic surface (shadow strength 1.5, grey nav indicator, brand-guideline
marketing chart colours).

All four families were rebuilt from **first-party product tokens**, then checked visually in
Storybook (Dashboard, Data App, Enterprise Admin Console templates) and with
`node scripts/check/run.mjs --rule community-themes` (0 findings). The measured references
are kept under `docs/review/brand-theme-refs/`.

| Family     | Reference now                                                                                  | What changed most                                                                                                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Qlik       | `@qlik/design-tokens` 1.4.2 (Sprout `qlik-light`/`qlik-dark`) + help.qlik.com 2025 shell shots | flat cards (no resting shadow), green active-nav bar, `#d9d9d9` text-field edge, Sense Horizon chart series, 600 headings at 24/20/16                                                       |
| ClickHouse | click-ui `variables.light.ts` / `variables.dark.ts` (ClickHouse Cloud console)                 | dark ground `#0a0a0a` → `#1f1f1c`, 8 px → 4 px, 36 px → 32 px controls, charcoal light primary, console chart palette, Inconsolata                                                          |
| Snowflake  | Snowsight's shipped Balto/Stellar CSS (`app.snowflake.com/static`) incl. first-party dark mode | white page + `#f7f7f7` nav (was tinted page + tinted nav), royal-blue `#1a6ce7` primary with white ink (was cyan `#29b5e8` with dark ink), blue-grey neutrals, 6 px controls, blue pill nav |
| Salesforce | SLDS 1 Lightning Blue tokens (`@salesforce-ux/design-system` 2.264.1)                          | Cosmos → Lightning Blue: `#066afe` → `#0176d3`, 8 px → 4 px, 14 px → 13 px body, regular-weight 32 px controls, bold grey table headers, `#1b96ff` nav bar, `#e5e5e5` hairlines             |

## How close is it now, and what still gives it away

Tokens now carry colour, radius, control height/weight, hairlines, elevation, type scale,
table rules and the chart palette. Viewed side by side with the product screenshots, the
remaining differences are all **structural**: a component hard-codes a shape or a layout that
the theme contract has no seam for. None of them is a "Qlik feature" or a "Snowflake feature";
each is a generic customization gap that any brand theme will hit. The products are cited
only as evidence that the gap is real.

## Required library enhancements (component API and token contract)

Principle: **no product-specific code in the library.** Every item below adds a neutral seam —
a contract token with a default equal to today's behaviour, or a component prop — so a theme
can opt in. Defaults keep every existing theme pixel-identical.

### 1. Sidebar active indicator — tokens

`SidebarMenuButton` hard-codes the active row's indicator: a 4 px rounded bar in
`--sidebar-primary`, which is also the active icon colour. A theme cannot change the bar's
width or radius, and cannot remove it without also blanking the icon. Evidence: two of the
four products draw a pill with no bar, one draws a 2 px square bar, one a 4 px inset bar.

Add to the contract: `--sidebar-indicator` (colour, default `var(--sidebar-primary)`),
`--sidebar-indicator-width` (default `4px`; `0` = none), `--sidebar-indicator-radius`
(default `9999px`), `--sidebar-indicator-inset` (default `6px`, the current `inset-y-1.5`).
`sidebar.tsx` reads them in the `before:` layer; the icon keeps `--sidebar-primary`.
Touches `themes.css`, both built-ins, `THEME_TOKEN_NAMES`, the eight community families,
theme-parity tests, manifest token docs.

### 2. App shell composition — props

`AppShell` fixes where the brand lives (sidebar header), that the sidebar is the primary
navigation, and what the top bar can hold. Products differ on all three (brand in the top bar
with a centred search; no top bar at all; horizontal primary navigation; a second resource
panel beside the nav). Add to the `AppShell` API, all optional: `brandPlacement:
"sidebar" | "topbar"`, `topBar={{ start, center, end }}` slots, `navigation: "sidebar" |
"topbar"` (renders `TopNav` as the primary nav and hides the sidebar), and a `secondaryPanel`
slot with `--shell-secondary-width`. `Flagship` already has the top bar; this generalises it.

### 3. Button edges — tokens

`secondary` is a borderless tinted plate; `outline` takes its edge from `--input`, so a theme
that wants a different edge on buttons and on text fields cannot have it, and no theme can
give the neutral button an edge without switching variants in every consumer. Add
`--button-outline-border` (default `var(--input)`), `--secondary-border` (default
`transparent`) and `--secondary-text` (default `var(--secondary-foreground)`). Evidence:
every product's most common button is bordered, one with a coloured label.

### 4. Table header styling — tokens

`DataTable` exposes only `--table-header-weight`. Add `--table-header-background` (default
`transparent`), `--table-header-foreground` (default `var(--foreground)`),
`--table-header-size` (default `var(--type-size-body)`), `--table-header-transform`
(default `none`), `--table-header-tracking` (default `0`). Evidence: three products fill the
header row; one sets it in small caps with tracking.

### 5. Card elevation vs edge — tokens

`Card` composes `border` + `shadow-sm`; the only dial is the global `--shadow-strength`,
which also flattens menus and dialogs. Add `--card-shadow` (default `var(--shadow-sm)`) and
`--card-border` (default `var(--border)`), and equivalents for the other resting surfaces that
currently share the global dial (`--popover-shadow`, `--dialog-shadow`). Evidence: all four
products draw flat hairline cards but elevated menus.

### 6. Badge shape and tone — tokens + prop

`Badge`/`StatusBadge` hard-code `rounded-full` and a tinted status plate. Add
`--badge-radius` (default `9999px`) and a `tone: "tint" | "solid" | "outline" | "neutral"`
prop with a `--badge-tone` token default, reading `--*-text` for tinted ink. Evidence: square
hairline chips and grey pills exist alongside tinted pills.

### 7. Tabs style — token default for an existing prop

`Tabs` already has `segmented` and `underline` variants but the consumer picks. Add
`--tabs-variant` (default `segmented`) as the variant's default, plus
`--tabs-indicator-width` (default `2px`) and `--tabs-active-weight`. Evidence: all four
products use underline tabs, so a theme must be able to make it the default.

### 8. Focus ring geometry — tokens

`focus-ring` draws one outer ring in `--ring`. Add `--focus-ring-width` (default `2px`),
`--focus-ring-offset` (default `0`; negative = inside the field) and `--input-focus-border`
(default `var(--ring)`) so a theme can choose an inset ring, an edge swap, or a glow.

### 9. Icon weight and fill — token + prop

`--icon-stroke` covers line width. Add `--icon-fill: "outline" | "solid"` with an `Icon`
prop of the same name, mapped to the two Lucide-compatible sets the package already bundles
where available, falling back to outline. Evidence: one product uses filled utility icons.

### 10. Selection-state tokens for data components — tokens

`DataTable` row selection, `Tree`, filter lists and the planned dashboard-surface tiles
colour "selected" with `--accent`/`--sidebar-accent`. Add a generic trio the data components
read: `--selection`, `--selection-foreground`, `--selection-muted` (default to today's
values). Evidence: analytics products distinguish selected / alternative / excluded states
with their own colours, and there is currently no seam for a selected row colour at all.

### 11. Type roles on components — consistency

`CardTitle` forces `leading-none`, table headers and card eyebrows do not use the `eyebrow`
role, and `subtitle` weight is ignored by several components. Make every component read its
role's size/leading/weight/tracking from the `--type-*` tokens (which themes may override)
and add a `--type-*-heading-xs` role for small semibold labels. Evidence: two products set
titles at line-height 1.5, one sets 12 px tracked caps labels.

### 12. Theme tooling and docs

- `pnpm theme:new --preset flat`: a starting point with hairline cards, 4 px corners, 32 px
  controls and no resting shadow — every SaaS product studied is flatter and denser than the
  default, so the scaffold should offer that shape without hand-editing 30 tokens.
- Document `--shadow-ring-color`, `--rule`, `--rule-strong`, `--chart-grid`,
  `--chart-foreground-muted` in the themes README "shape" table — they were the most
  effective dials in this review and are undocumented.
- `Foundations/Theming → Shipped themes`: render one generic product screen (top bar, nav,
  table, form, chart) per registered family instead of swatches, so any theme's fidelity can
  be judged in one view; `pnpm gen` should wire it for community families automatically.

## Verification

- `node scripts/check/run.mjs --rule community-themes` → 0 findings after the rebuild (four
  AA pairs were retuned: ClickHouse `--sidebar-muted-foreground` → slate-700, Qlik dark
  `--sidebar-accent` made opaque, Salesforce `--secondary-foreground` → `#0b5cab`, Snowflake
  `--sidebar-muted-foreground` → `#525f7a`).
- Storybook (`iframe.html?globals=theme:<slug>`): Dashboard, Data App and Enterprise Admin
  Console templates viewed at 1440×900 in `qlik-light`, `clickhouse-dark`,
  `snowflake-light`, `salesforce-light` against the reference screenshots.
- `node scripts/gen-community-themes.mjs --check` unchanged (no new family).

## Implementation status

All twelve items shipped on 2026-09-18 (changeset `brand-theme-fidelity-seams`). The four families
opt in where their specs call for it: flat cards, underline tabs, header fills, bar shapes, the
tinted badge and the input focus edge. Where the shipped seam differs from the proposal above:

- **Defaults follow today's rendering, not the proposal.** `--table-header-foreground` is
  `var(--muted-foreground)`, `--input-focus-border` is `var(--input)`, `--table-header-size`
  is `1em` (so density still scales it) and `--table-header-tracking` is
  `var(--type-tracking-body)`. Sidebar lengths are in rem (`0.25rem`, `0.375rem`).
- **Names.** The badge prop is `appearance` and its token `--badge-appearance`, because
  `StatusBadge` already has a `tone`. The icon prop is `variant`, because `fill` is an SVG
  attribute.
- **Additions.** `--card-title-leading` (item 11) and `--shell-secondary-width` (item 2) are
  contract tokens. Keyword tokens (`--badge-appearance`, `--tabs-variant`, `--icon-fill`) are read with
  container style queries. Browsers without them render the default.
- **Only the sample bookmark icon has a solid glyph so far.** Lucide icons stay outlined.
- **Status badge contrast.** The new badge stories draw every appearance in every theme, and axe
  found status badges under 4.5:1. The `community-themes` rule checks only the core ink pairs, so
  these had never been flagged. Each was retuned to the smallest passing value (ink on the solid
  plate, or `-text` on the 10% wash):

  | Theme            | Token                      | Was                        | Now                        |
  | ---------------- | -------------------------- | -------------------------- | -------------------------- |
  | clickhouse-light | `--success-text`           | `oklch(0.549 0.184 143)`   | `oklch(0.493 0.184 143)`   |
  | clickhouse-light | `--warning`                | `oklch(0.603 0.183 41.6)`  | `oklch(0.581 0.183 41.6)`  |
  | salesforce-light | `--success-text`           | `oklch(0.547 0.121 150.9)` | `oklch(0.495 0.121 150.9)` |
  | qlik-dark        | `--destructive-text`       | `oklch(0.729 0.151 5.3)`   | `oklch(0.835 0.151 5.3)`   |
  | qlik-dark        | `--destructive-foreground` | `oklch(0.321 0 0)`         | `oklch(0.269 0 0)`         |
  | qlik-light       | `--warning-foreground`     | `oklch(1 0 0)`             | `oklch(0.286 0 0)`         |
  | snowflake-light  | `--warning-foreground`     | `oklch(0.262 0.021 257.3)` | `oklch(0.242 0.021 257.3)` |

  Qlik light, Qlik dark and Snowflake light already drew their failing solid plate in the default
  `StatusBadge`. Qlik light's warning ink switched from white to dark, because white passes only
  if the brand orange darkens to about `oklch(0.577 …)`.

## References kept in the repo

`docs/review/brand-theme-refs/` — `qlik-spec.md`, `clickhouse-spec.md`, `snowflake-spec.md`,
`salesforce-spec.md`: the measured specs (hex, px, sources, screenshot inventory) each family
was rebuilt from. The raw screenshots and token dumps (~60 files) stayed in the review
session; the specs cite their URLs.
