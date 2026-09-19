---
"@elabs-ai/components-tokens": minor
"@elabs-ai/components-ui": minor
"@elabs-ai/components-icons": minor
"@elabs-ai/components-data": minor
"@elabs-ai/components-ai": patch
"@elabs-ai/components-charts": patch
"@elabs-ai/components-editor": patch
"@elabs-ai/components-marketing": patch
---

Theme seams for brand fidelity (docs/review/2026-09-18-brand-theme-fidelity-review.md). Every addition is opt-in: each new token defaults to today's rendering, so existing themes look the same.

`@elabs-ai/components-tokens` adds 30 contract tokens, which every `[data-theme]` block now has to define:

- Sidebar active bar: `--sidebar-indicator`, `--sidebar-indicator-width` (`0` = no bar), `--sidebar-indicator-radius`, `--sidebar-indicator-inset`.
- App shell: `--shell-secondary-width`.
- Buttons: `--button-outline-border`, `--secondary-border`, `--secondary-text`.
- Table header: `--table-header-background`, `--table-header-foreground`, `--table-header-size`, `--table-header-transform`, `--table-header-tracking`.
- Surfaces: `--card-shadow`, `--card-border`, `--card-title-leading`, `--popover-shadow`, `--dialog-shadow`.
- Badges: `--badge-radius`, `--badge-appearance` (`auto` | `tint` | `solid` | `outline` | `neutral`).
- Tabs: `--tabs-variant` (`segmented` | `underline`), `--tabs-indicator-width`, `--tabs-active-weight`.
- Focus: `--focus-ring-width`, `--focus-ring-offset` (a negative value pulls the ring inside the edge), `--input-focus-border`.
- Icons: `--icon-fill` (`outline` | `solid`).
- Selection: `--selection`, `--selection-foreground`, `--selection-muted`.

It also adds a `heading-xs` type role (`text-heading-xs`, caption size at 600), the utilities these tokens drive (`bg-sidebar-indicator`, `bg-table-header-background`, `text-table-header`, `shadow-card`, `shadow-popover`, `shadow-dialog`, `rounded-badge`, `font-tabs-active`, `border-input-focus`, `bg-selection`, …), and the `badge-*` and `tabs-underline` custom variants. Keyword tokens are read with container style queries. A browser without style queries renders the default.

`@elabs-ai/components-ui`:

- `AppShell` gains `brandPlacement` (`"sidebar"` | `"topbar"`), `topBar={{ start, center, end }}`, `navigation` (`"sidebar"` | `"topbar"`) and `secondaryPanel`. `TopNav` gains `center`, which keeps its slot truly centred.
- `Badge` and `StatusBadge` gain `appearance` (`"tint"` | `"solid"` | `"outline"` | `"neutral"`); the prop is named `appearance`, not `tone`, because `StatusBadge` already has a `tone`. Leave it unset and `--badge-appearance` decides. A custom-tone `StatusBadge` never goes solid.
- `TabsList` without a `variant` follows `--tabs-variant`, and it no longer renders `data-variant="segmented"` when the prop is unset.
- Sidebar, buttons, cards, menus, dialogs, form fields, tables and trees now read the tokens above.
- `cn()` now recognises the `eyebrow`, `kpi-sm`, `display-lg` and `heading-xs` type roles, the new token utilities, and the `leading-(--x)` / `tracking-(--x)` shorthand. Before this, `cn("text-eyebrow", "text-muted-foreground")` silently dropped the role.

`@elabs-ai/components-icons`: `Icon` gains `variant` (`"outline"` | `"solid"`), and `createIcon(node, name, { solid })` takes an optional filled glyph. Leave `variant` unset and `--icon-fill` picks the glyph. An icon without a solid glyph always draws its outline.

`@elabs-ai/components-data`: `DataTable` headers read the `--table-header-*` tokens, and selected rows read `--selection`.

`@elabs-ai/components-ai`, `-charts`, `-editor`, `-marketing`: hand-rolled uppercase labels now use the `eyebrow` role. Their letter spacing moves to the role's `0.06em`.
