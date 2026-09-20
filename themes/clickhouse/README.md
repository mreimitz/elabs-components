# ClickHouse

A downloadable theme family for brand-ui — light ("ClickHouse Light") and dark ("ClickHouse Dark").

Both schemes reproduce the **ClickHouse Cloud console** (console.clickhouse.cloud), not the
marketing site. Every value is read from ClickHouse's own component library, **click-ui**
(`github.com/ClickHouse/click-ui`, `src/theme/tokens/variables.light.ts` and
`variables.dark.ts` — the `click.*` semantic tokens the console renders with), cloned
byte-for-byte on 2026-09-18 and cross-checked against the SQL-console screenshots on
clickhouse.com/docs. Certainty per value:

- **token** — a click-ui value, converted to `oklch()` unchanged.
- **derived** — computed from token values (contrast lifts, extra chart series, ramps).

ClickHouse's name is its trademark, and this theme ships none of its logo artwork. It is for
internal work and demos; public use needs ClickHouse's permission.

## What makes it ClickHouse

Dark is the console's default: a **warm black `#1f1f1c` ground** (never pure black) with
`#282828` raised panels and `#323232` hairlines, and **one accent — electric yellow `#faff69`**
on the primary button, links and focus, with dark ink. Light flips to a white page, `#f6f7fa`
muted panels and a **charcoal `#302e32` primary button** (yellow is not used on white).
Everything is **4 px**, controls are 32 px, Inter for UI and Inconsolata for code, hairline
borders and no resting shadow; the main navigation is the same colour as the page with a
slightly lighter/darker active row and no coloured indicator.

## What the theme reproduces

| Element                           | click-ui light · dark                                                                                                                                                                                         | Token(s)                                                                   | Certainty       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------- |
| Page, cards                       | `#ffffff` · `#1f1f1c`                                                                                                                                                                                         | `--background`, `--card`, `--chat-assistant`                               | token           |
| Muted panels, popovers            | `#f6f7fa` (slate-50) · `#282828`                                                                                                                                                                              | `--muted`, `--secondary`, `--surface-muted`, `--popover`                   | token           |
| Hover wash                        | `#f6f7fa` · `lch(19 0 0)` ≈ `#2d2d2d`                                                                                                                                                                         | `--accent`                                                                 | token           |
| Text · muted text                 | `#161517` · `#696e79` — `#ffffff` · `#b3b6bd`                                                                                                                                                                 | `--foreground`, `--muted-foreground`                                       | token           |
| Field text · disabled             | `#302e32` · `#9a9ea7` — `#e6e7e9` · `#808080`                                                                                                                                                                 | `--foreground-2`, `--foreground-4`                                         | token           |
| Hairline · strong rule            | `#e6e7e9` · `#808691` (slate-500, lifted for 3:1) — `#323232` · `#606060`                                                                                                                                     | `--border`, `--rule` · `--border-strong`                                   | token · derived |
| Text field                        | `#fbfcff` ground, `#e6e7e9` edge, flat — `#2d2d2d` ground, `#3c3c3c` edge                                                                                                                                     | `--input-background`, `--input`, `--input-shadow: none`                    | token           |
| Primary button                    | `#302e32` → hover `lch(29.5 4.2 267)` → pressed `#161517`, white ink — `#faff69` → `#fbff96` → `#e7ec61`, `#1f1f1c` ink                                                                                       | `--primary`, `--primary-hover`, `--primary-active`, `--primary-foreground` | token           |
| Links                             | `#104ec6` (info-600; click-ui's `#437eef` is under AA on white) · `#faff69`                                                                                                                                   | `--link`                                                                   | derived · token |
| Focus                             | `#437eef` · `#faff69`                                                                                                                                                                                         | `--ring`                                                                   | token           |
| Danger · success · warning · info | `#c10000` · `#008a0b` · `#d64f00` (text `#a33c00`) · `#104ec6` — dark: solid-badge fills `#ff9898` · `#99ffa1` · `#ff9457` · `#a1bef7` with `#1f1f1c` ink, text `#ffbaba` · `#ccffd0` · `#ffb88f` · `#d0dffb` | `--destructive*`, `--success*`, `--warning*`, `--info*`                    | token           |
| Match highlight                   | `#feffba` · `#faff69`, dark ink                                                                                                                                                                               | `--highlight*`                                                             | token           |
| Sidebar (main nav)                | white, `#e6e7e9` active row, ink stays dark — `#1f1f1c`, `lch(27.5 0 0 / .6)` ≈ `#363636` active row                                                                                                          | `--sidebar*`                                                               | token           |
| Radius                            | 4 px everywhere (dialogs 8 px are not reproduced)                                                                                                                                                             | `--radius-base: 0.25rem`, `--control-radius: var(--radius)`                | token           |
| Controls                          | 32 px, 500 labels                                                                                                                                                                                             | `--control-size: 8`, `--control-weight: 500`                               | token           |
| Tables                            | 600 header, no zebra, 1 px `#e6e7e9` / `#323232` row rule, blue-tint row hover                                                                                                                                | `--table-*`                                                                | token           |
| Elevation                         | `0 4px 6px -1px lch(6.8 0 0 / .15)` menus, flat cards — dark 60 %                                                                                                                                             | `--shadow-strength: 0.6` · `2`, `--shadow-ring-color`                      | derived         |
| Curtain                           | `lch(6.8 0 0 / .75)`, no blur                                                                                                                                                                                 | `--overlay`, `--overlay-blur: 0px`                                         | token           |
| Icons                             | 16 px, 1.5 px stroke                                                                                                                                                                                          | `--icon-stroke: 1.5`                                                       | token           |
| Logo                              | none — the library mark shows, inked by the theme                                                                                                                                                             | `--brand-logo-*: initial`                                                  | token           |

## Chart palette

click-ui `chart.color.default`, in the order the console's dashboards draw them: blue `#437eef`,
sunrise `#ffc300`, orange `#ff7729`, teal `#089b83` (dark `#6df8e1`), violet `#bb33ff`,
fuchsia `#fb32c9` (dark `#fb64d6`), baby blue `#00cbeb`, red `#ff2323`, then info-600
`#104ec6` (dark: brand `#faff69`), success `#00bd10` (dark `#33ff44`), slate `#9a9ea7` and a
derived twelfth (`#c66b00` · `#a1bef7`). Sequential: the info ramp (light) / the brand ramp
`#3c4601 → #feffc2` (dark). Diverging: danger ↔ info. Mono: the slate / neutral ladders.
Gridlines `#e6e7e9` · `#323232`, axis labels `#696e79` · `#b3b6bd`.

## Typography

- `--font-sans` / `--font-display`: **Inter** (click-ui `typography.font.families.regular`),
  shipped by the token engine. Product titles are 600 at 12–16 px and 700 at 18–20 px with
  line-height 1.5 and no tracking: `--type-*-display` 24/32 600, `--type-*-title` 18/26 700,
  `--type-*-subtitle` 16/24 600.
- `--font-mono`: **Inconsolata** (click-ui `families.mono`), OFL but **not shipped**; JetBrains
  Mono and the system stack follow.

## Decisions taken

- Light primary is the charcoal button click-ui ships, not yellow; yellow survives as the
  match highlight.
- Dark ground is `#1f1f1c` (click-ui `neutral-750`), replacing the earlier `#0a0a0a` taken
  from a third-party summary of clickhouse.com.
- 4 px corners replace the earlier 8 px; dialogs' 8 px are not reproduced.
- Links on white use info-600 `#104ec6` (AA) instead of info-400 `#437eef`.
- The console's main-navigation active row has no coloured indicator; brand-ui's sidebar
  always draws one in `--sidebar-primary`, so it is set to the ink colour (see the
  enhancement list in `docs/review/2026-09-18-brand-theme-fidelity-review.md`).

## Sources

| id  | Source                                                                                                                                        | Kind                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| s1  | [ClickHouse/click-ui](https://github.com/ClickHouse/click-ui) `src/theme/tokens/variables.light.ts` / `variables.dark.ts` (clone, 2026-09-18) | first-party tokens      |
| s2  | [ClickHouse Cloud SQL console docs](https://clickhouse.com/docs/cloud/get-started/sql-console) — console screenshots (dark)                   | first-party screenshots |

## Use it

1. Copy this folder into your app, e.g. `src/themes/clickhouse/`.
2. Import the stylesheets after the token engine:

   ```ts
   import "@elabs-ai/components-tokens/styles.css";
   import "./themes/clickhouse/clickhouse-light.css";
   import "./themes/clickhouse/clickhouse-dark.css";
   ```

3. Register the family:

   ```tsx
   import { ThemeProvider } from "@elabs-ai/components-tokens";
   import { clickhouseThemes } from "./themes/clickhouse/theme";

   <ThemeProvider themes={clickhouseThemes} defaultTheme="clickhouse-dark">
   ```

   Passing only this family REPLACES the default themes. To offer both, use
   `themes={[...BUILT_IN_THEME_DEFINITIONS, ...clickhouseThemes]}`.

A dark variant also needs the required `dark:` variant line — see [the themes folder README](../README.md).
