# Snowsight (app.snowflake.com) — visual spec for a CSS theme

Researched 2026-09-18. Scope: the **product UI** (Snowsight), not snowflake.com marketing.

## 0. Provenance and confidence

Three evidence tiers are used below; every value is tagged.

| Tag            | Meaning                                                                                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **[token]**    | Exact value read from Snowflake's own shipped CSS at `https://app.snowflake.com/static/*.css` (build `main-82973-03de539ab3d0`, fetched 2026-09-18; saved under `css/`). Highest confidence.                  |
| **[sampled]**  | Pixel-sampled from an official screenshot (docs.snowflake.com or snowflake.com/developers quickstart). Colour-managed PNGs drift by a few units from the token value; where a token exists, prefer the token. |
| **[measured]** | Geometry measured from a 1x or 2x screenshot (px).                                                                                                                                                            |
| **[assumed]**  | Not visible/derivable; my best inference.                                                                                                                                                                     |

Key finding: Snowflake's internal design system is reachable in the public bundle. Two generations coexist in the same CSS:

- **Balto** (class prefix `blt-`, `.baltoBaseColor`) — the hex palette (`--base-color-gray-10 … --base-color-violet-90`) plus legacy semantic tokens (`--nav-bg`, `--primary-button-bg`, `--table-*`, `--editor-*`). Marked in the source as "Frozen snapshot of legacy tokens. Do not use in new code."
- **Stellar** (`--stellar-color-*`, `--stellar-elevation-*`) — the current generation, defined in **oklch**, "Auto-generated. Do not edit." Light theme lives on `:root, .lightMode`; dark theme on `.darkMode` (also class `.blt-85wxsx` in the atomic bundle). **Dark mode is real, first-party, and fully tokenised.**

The page font stack is set inline on app.snowflake.com: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif` **[token]**. The login page's inline error styles also hard-code `background-color:#f7f7f7; color:#1e252f; subtitle color:#5d6a85` **[token]**, which are exactly the three colours that dominate every screenshot.

Full token dumps are saved next to this file: `tokens_named.json` (base palette, dimensions, Stellar light/dark, legacy light/dark), `tokens_balto_legacy.json`, `tokens_light_dark.txt`, `tokens_light_resolved.json`.

---

## 1. What makes Snowsight instantly recognisable

1. **A pale-grey left navigation on a white page, not a dark sidebar.** Nav is `#f7f7f7` (gray-10) with a hairline `#d5dae4` right border; page canvas is pure `#ffffff`. The grey/white split at x≈240px is the signature silhouette. There is **no top app bar**; the page title sits directly in the content area.
2. **A cool, blue-tinted grey ramp.** Every grey has a blue cast (`#d5dae4`, `#9fabc1`, `#5d6a85`, `#1e252f`) — hue 260 in oklch. Nothing is neutral grey. Body text is `#1e252f`, secondary text is the very characteristic slate `#5d6a85`.
3. **Product blue is a saturated royal blue (`#1a6ce7`), not the cyan brand blue.** The brand cyan `#29b5e8` appears **only** in the snowflake logo mark (and the "brand" Stellar tokens at hue 228). Primary buttons, links, active states and the SQL keyword colour all use the blue-50/60 ramp (`#1a6ce7` / `#085bd7`).
4. **Selected = pale blue pill with blue text.** Active nav item, active tree node, active icon-rail item and the selected results tab all use `#d6e6ff` (blue-05) fill with `#085bd7` text, 6px radius, 32px tall. This pill is used everywhere and is the strongest single motif.
5. **Uppercase, 12px, letter-spaced column headers** in every list (`NAME ↑  SOURCE  OWNER  CREATED`), sort arrow in blue, and a 41px row pitch with hairline `#d5dae4` rules — no zebra striping.
6. **Inter everywhere, Apercu Mono Pro / Fira Mono for SQL and results.** Headings are Inter 600/700 at 20–28px; UI text is 14px/20px; small labels 12px.
7. **Chips instead of dropdowns** for context: role · warehouse, database · schema live in 32px bordered `#fbfbfb` pills in the toolbar; "PREVIEW" badges in blue-05 pill with tiny caps text.
8. **The blue ▶ split "Run" button** at the top-right of the SQL editor and the **blue/green duration bar** (query duration split into compile/execute, `#3580f2` + `#51caa5`) — small but unmistakable.
9. **Flat surfaces.** Cards are white with a 1px `#d5dae4` border and 8px radius; there are essentially no shadows on the page (elevation shadows only on menus/popovers/dialogs).

---

## 2. Colour primitives (Balto base palette) **[token]**

```
gray-00 #fbfbfb   gray-10 #f7f7f7   gray-15 #eceef1   gray-20 #dee3ea   gray-30 #d5dae4
gray-40 #bdc4d5   gray-50 #9fabc1   gray-55 #8a96ad   gray-60 #70819a   gray-70 #5d6a85
gray-80 #293246   gray-85 #1e252f   gray-90 #191e24   gray-95 #0f161e

blue-00 #f1f7ff   blue-05 #d6e6ff   blue-10 #bbd6fe   blue-20 #86b6fc   blue-30 #5999f8
blue-40 #3580f2   blue-50 #1a6ce7   blue-60 #085bd7   blue-70 #004cbe   blue-80 #003e9a   blue-90 #002c6e

green-00 #eafff9  green-10 #bdf8e9  green-20 #97f3cf  green-30 #80e3c1  green-40 #51d9ae
green-50 #51caa5  green-60 #1db588  green-70 #0e9c73  green-80 #087959  green-90 #034237

red-00 #fff5f8    red-10 #ffd1dc    red-20 #f76a86    red-30 #ef405e    red-40 #e32442
red-50 #d3132f    red-60 #bf0822    red-70 #a40319    red-80 #860112    red-90 #66000e

yellow-00 #fff8e6 yellow-10 #ffedcd yellow-20 #fccf54 yellow-30 #f8c52a yellow-40 #f3be0f
yellow-50 #ecb700 yellow-60 #e3a300 yellow-70 #ea9d00 yellow-80 #b67901 yellow-90 #653e03

violet-00 #f7f5fe violet-10 #ded8fd violet-20 #c7bcfb violet-30 #a797f8 violet-40 #7e66f5
violet-50 #7157f4 violet-60 #5d3ff3 violet-70 #5139c7 violet-80 #402d9f violet-90 #281c63

brand cyan (logo only): #29b5e8
```

Stellar (current) oklch primitives that matter, converted to sRGB hex:

| oklch                        | hex            | used for                                                                           |
| ---------------------------- | -------------- | ---------------------------------------------------------------------------------- |
| `oklch(0.27 0.012 260)`      | `#23272c`      | text, icons (Stellar default text is a hair darker/neutraler than Balto `#1e252f`) |
| `oklch(0.53 0.03 260)`       | `#626c7e`      | text-subtle                                                                        |
| `oklch(0.56 0.03 260)`       | `#6a7587`      | icon-subtle, neutral-bold bg                                                       |
| `oklch(0.65 0.025 260)`      | `#86909f`      | border-bold                                                                        |
| `oklch(0.83 0.01 260)`       | `#c3c7ce`      | icon-decorative                                                                    |
| `oklch(0.89 0.01 260)`       | `#d7dbe1`      | surface edge/border                                                                |
| `oklch(0.955 0.003 260)`     | `#eff0f2`      | background-sunken                                                                  |
| `oklch(0.985 0 260)`         | `#fafafa`      | background-gray                                                                    |
| `oklch(0.56 0.19 260)`       | `#276ee1`      | **interactive-bold (primary button) fill**                                         |
| `oklch(0.53 0.18 260)`       | `#2365d1`      | primary hover, link text, selected text/border                                     |
| `oklch(0.44 0.13 260)`       | `#234f99`      | primary active/pressed, link hover                                                 |
| `oklch(0.63 0.2 260)`        | `#3783ff`      | border-focus / border-interactive, info icon                                       |
| `oklch(0.95 0.03 260)`       | `#e3efff`      | background-selected, info bg                                                       |
| `oklch(0.89 0.06 260)`       | `#c4dcff`      | selected-hover, highlighted                                                        |
| `oklch(0.22 0.07 260 / 16%)` | `#05193a` @16% | **border (default) — an alpha border**                                             |
| `oklch(0.22 0.07 260 / 7%)`  | `#05193a` @7%  | neutral bg, row hover, transparent-hover                                           |
| `oklch(0.11 0 0 / 2%)`       | black @2%      | neutral-subtle bg                                                                  |
| `oklch(0.72 0.13 228)`       | `#2cb4e4`      | brand-bold (≈ the logo cyan)                                                       |
| `oklch(0.51 0.1 170)`        | `#04785d`      | success text                                                                       |
| `oklch(0.63 0.16 170)`       | `#00a67a`      | success icon/border                                                                |
| `oklch(0.52 0.11 80)`        | `#8a6000`      | caution text                                                                       |
| `oklch(0.63 0.15 80)`        | `#b87c00`      | caution icon/border                                                                |
| `oklch(0.53 0.18 30)`        | `#be3122`      | critical text                                                                      |
| `oklch(0.63 0.2 30)`         | `#e94937`      | critical icon/border                                                               |

Note the two generations differ slightly on the primary blue: Balto `--primary-button-bg: #1a6ce7`; Stellar `--stellar-color-background-interactive-bold: oklch(0.56 0.19 260)` ≈ `#276ee1`. Screenshots sample `#1a6be7` (2025 Workspaces), `#1861e4` (2024 quickstart), `#356bdf` (2025 docs dialog). **Use `#1a6ce7`** for a theme; hover `#085bd7`; pressed `#004cbe`.

---

## 3. App shell

### 3.1 Top bar

- **None.** Snowsight has no global top bar. The browser chrome sits directly on the nav + page. **[measured — all screenshots]**
- Page-level toolbars (e.g. the worksheet toolbar with role/warehouse chips, Share, Run) are part of the content area, white background, ~56px tall **[measured]**.

### 3.2 Left navigation (expanded, current 2025 IA)

| Property                                        | Value                                                                                                                                                                                                                                                                                       | Source               |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | --------- |
| Background                                      | `#f7f7f7` (`--nav-bg`, gray-10)                                                                                                                                                                                                                                                             | [token]              |
| Right border                                    | 1px `#d5dae4` (`--border-color`, gray-30)                                                                                                                                                                                                                                                   | [token]+[measured]   |
| Width                                           | **240px** (2025 IA; 238px measured on 2024 IA)                                                                                                                                                                                                                                              | [measured]           |
| Logo                                            | "snowflake" wordmark + snowflake mark in brand cyan `#29b5e8`, top-left, ~24px tall, 16px inset; collapse-to-rail chevron (`                                                                                                                                                                | ←`) at top-right     | [sampled] |
| Top "segmented" row (2025 IA)                   | three equal 32px cells: 🏠 Home (active = `#d6e6ff` pill), `+` Create, 🔍 Search; hairline rule beneath                                                                                                                                                                                     | [sampled]            |
| Section labels                                  | "Shortcuts", "Work with data", "Horizon Catalog", "Manage" — 12px, weight 600, colour `#5d6a85`, 16px left inset, ~40px above first item                                                                                                                                                    | [sampled]+[measured] |
| Items                                           | 14px Inter 400/500, colour `#1e252f` (`--themed-reusable-text-primary`); 20px Lucide-style line icon at 1.5px stroke in `#1e252f`/`#5d6a85`, 12px gap to label; **32px pitch**, pill inset 8px from nav edges                                                                               | [measured]           |
| Item hover                                      | `#dee3ea` (`--nav-hover-background`, gray-20)                                                                                                                                                                                                                                               | [token]              |
| **Active item**                                 | fill `#d6e6ff` (`--nav-active-background`, blue-05), text+icon `#085bd7` (`--nav-active-color`, blue-60), weight 500/600, **radius 6px**, height 32px. No left bar/indicator — the pill is the indicator.                                                                                   | [token]+[measured]   |
| Sub-items (2024 IA, e.g. Admin › Users & Roles) | indented 36px, 12px text, same pill when active                                                                                                                                                                                                                                             | [sampled]            |
| Bottom                                          | user block pinned to bottom: 32px circular avatar with initials (border 1px `#d5dae4`, bg `#fbfbfb`, text `#5d6a85`), name 14px `#1e252f` + role 12px `#5d6a85` (UPPERCASE as stored), a vertical divider, bell icon with red dot `#d3132f`. Clicking opens the account/role menu (see §9). | [sampled]            |
| Where the account/warehouse picker sits         | **Account + role switcher lives in the bottom user menu** (Switch Role › / Account › with AWS/Azure badge). **Warehouse picker is not in the nav** — it is a chip in the worksheet toolbar (`ACCOUNTADMIN • COMPUTE_WH`).                                                                   | [sampled]            |

### 3.3 Left navigation (collapsed icon rail — used by Worksheets/Workspaces)

- Width **56px** [measured]; bg `#f7f7f7`; snowflake mark only (cyan) at top; 20px icons stacked at 44px pitch, 40×32px `#d6e6ff` pill for the active icon (radius 6px); avatar at the bottom. [sampled]+[measured]

### 3.4 Secondary panels (object tree / file explorer next to the rail)

- Width ~326px [measured]; bg `#fbfbfb` (`--panel-bg`, gray-00) or `#ffffff`; right border 1px `#d5dae4`; panel title 14px 600; search input inside is a filled `#eceef1` field, radius 6px, 32px tall with a leading search icon. [sampled]
- Tree rows 26–30px pitch; chevrons `#9fabc1`; object icons are line icons in `#5d6a85`; selected row = `#d6e6ff` pill, text `#085bd7` 500. [sampled]

### 3.5 Page background

- `#ffffff` for the main content (`--stellar-elevation-surface: oklch(1 0 0)`). [token]
- "Sunken"/secondary areas (results header row, dialog bodies, worksheet panel bg) use `#fbfbfb` (gray-00) — e.g. `--themed-product-areas-worksheets-card-background-regular: #fbfbfb`; the worksheets panel bg is `#f7f7f7`. [token]
- Dialog/scrim overlay: `oklch(0.15 0.01 260 / 40%)` (dark `/70%`). [token]

---

## 4. Typography **[token unless noted]**

| Role                 | Value                                                                                                                                                                                                                                                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Body / UI family     | `Inter, Roboto, "Helvetica Neue", "Arial Nova", "Nimbus Sans", Arial, sans-serif` (`--themed-font-family-body`, also `-heading`, `-editorial`). Inter is self-hosted (`inter-bold.woff2` preloaded on docs; `'Inter'` @font-face in styles.css).                                                                  |
| Monospace            | `"Apercu Mono Pro", ui-monospace, Menlo, Monaco, "Cascadia Mono", "Segoe UI Mono", "Roboto Mono", …, monospace` (`--themed-font-family-mono`). The atomic bundle's newer mono token is `"Fira Mono", ui-monospace, …`. Apercu Mono Pro is commercial — **use Fira Mono / JetBrains Mono as the open substitute.** |
| Weights              | 400 regular, 500 medium, 600 semi-bold, 700 bold (Stellar also defines **550**)                                                                                                                                                                                                                                   |
| Sizes                | small **12px** · regular **14px** · large **16px** · xlarge **20px** · xxlarge **28px** · xxxlarge **40px** (Stellar adds 10/18/24/32/36/44/48/52/60/68)                                                                                                                                                          |
| Line heights         | 14px small single-line · 16px regular single-line · 18px small body · **20px regular body** · 20px sub-header · 24px page-header · 34px large editorial · 48px larger editorial                                                                                                                                   |
| Letter-spacing       | 0 default; `-0.25px` / `-0.5px` / `-1.25px` for large headings; `0.02em` for small caps labels (column headers, "PREVIEW")                                                                                                                                                                                        |
| Page title           | 20px / 24px, weight 600–700, `#1e252f` ("Databases", "Home", "Users Roles") [sampled]                                                                                                                                                                                                                             |
| Section/card heading | 16px 600 [sampled]                                                                                                                                                                                                                                                                                                |
| Body / rows          | 14px 400 `#1e252f`; secondary `#5d6a85` [token]                                                                                                                                                                                                                                                                   |
| Column headers       | 12px 500–600 UPPERCASE, `#5d6a85`, tracking ~0.02em; sorted column and its arrow in `#1a6ce7` (`--table-header-sort-color`) [token]+[sampled]                                                                                                                                                                     |
| Results grid cells   | 13–14px **monospace** for data; numbers right-aligned; header cells sans (Inter) with a type glyph (`A`, `#`, calendar) [sampled]                                                                                                                                                                                 |
| Editor               | 13–14px mono, 20–21px line height, line numbers `#5d6a85` (active `#191e24`) [token]+[sampled]                                                                                                                                                                                                                    |

---

## 5. Cards / panels / elevation

| Property                              | Value                                                                                                                                    | Source             |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Card bg                               | `#ffffff` on the page; `#fbfbfb` in dialogs/side panels; `#f2f2f2`/`#eceef1` for dashboard tile thumbnails                               | [token]+[sampled]  |
| Card border                           | 1px `#d5dae4` (Balto) / `oklch(0.22 0.07 260 / 16%)` alpha (Stellar)                                                                     | [token]            |
| Card radius                           | **8px** (`--base-dimension-radius-medium`); quick-action cards on Home and the schema-detail cards both measure 8px                      | [token]+[measured] |
| Card padding                          | 16–24px; Home quick-action cards 16px with 20px blue icon top-left                                                                       | [measured]         |
| Card shadow                           | none at rest (`--level1-box-shadow-base: none`); hover elevation-1                                                                       | [token]            |
| Elevation 1 (raised: menus, popovers) | `0 0 1px rgba(0,0,0,.1), 0 2px 8px rgba(0,0,0,.1)`                                                                                       | [token]            |
| Elevation 2/overlay (dialogs)         | `0 0 1px rgba(0,0,0,.1), 0 8px 16px rgba(0,0,0,.1)`                                                                                      | [token]            |
| Overflow shadow (sticky edges)        | `0 0 4px 4px rgba(0,0,0,.06)`                                                                                                            | [token]            |
| Radii scale                           | xsmall 4 · small 6 · medium 8 · large 16 · pill 9999                                                                                     | [token]            |
| Spacing scale                         | 2 · 4 · 6 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64                                                                                    | [token]            |
| Breakpoints                           | 480 · 720 · 1024 · 1360 · 1680                                                                                                           | [token]            |
| Dashboard tile                        | white, 1px `#d5dae4`, radius 8–12px, 16px padding; title 16px 600 left, "⚙ ⋯" icon buttons right; hairline rule under title; chart below | [sampled]          |
| Query-profile node                    | white, 1px `#d5dae4`, radius 12px, shadow elevation-1, bold label + `[n]` + `0%` right; progress bar `#dee3ea` track                     | [sampled]          |

---

## 6. Buttons **[token unless noted]**

Geometry (all sizes measured at 1x): **height 32px**, **radius 6px**, padding 0 12px (icon+label 0 12px 0 10px), font 14px weight **500**, icon 16px with 6–8px gap. Small/chip variant 24px tall, 12px text. Split buttons share a 1px divider (`#5999f8` on primary, `#d5dae4` on secondary).

| Variant                                                                         | Background                                                               | Text      | Border        | Hover                          | Pressed                        | Disabled                                               |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------- | ------------- | ------------------------------ | ------------------------------ | ------------------------------------------------------ |
| **Primary** ("Run", "+ Database", "Create", "Close")                            | `#1a6ce7` (`--primary-button-bg`, blue-50) — **not** the cyan brand blue | `#fbfbfb` | none          | `#085bd7`                      | `#004cbe`                      | bg `#bbd6fe`, text `#fbfbfb` (Stellar: text `#5999f8`) |
| **Secondary / default** ("Share", "Manage Grants", "Search" chip, "Source All") | `#fbfbfb` (`--button-bg`)                                                | `#1e252f` | 1px `#d5dae4` | bg `#fbfbfb`, border `#9fabc1` | bg `#dee3ea`, border `#d5dae4` | bg `#fff`, text `#9fabc1`, border `#dee3ea`            |
| **Text / ghost** (icon buttons, "⋯")                                            | transparent                                                              | `#5d6a85` | none          | bg `#d5dae4`, text `#1e252f`   | bg `#bdc4d5`                   | text `#9fabc1`                                         |
| **Destructive** ("Delete")                                                      | `#d3132f` (red-50)                                                       | `#fbfbfb` | none          | `#bf0822`                      | `#a40319`                      | bg `#ffd1dc`                                           |
| Focus ring                                                                      | 2px `oklch(0.63 0.2 260)` ≈ `#3783ff`                                    |           |               |                                |                                |                                                        |

Distinctive uses: the **Run** button is a 32px primary split button (▶ | ⌄) at the far right of the worksheet toolbar; the **Results** toggle is a fully rounded 28px primary pill ("↳ Results") next to a ghost "Chart" tab; "Table | Chart" in Workspaces is a segmented control with the active cell filled `#d5dae4` and text `#1e252f`.

---

## 7. Inputs / form controls **[token unless noted]**

| Property                  | Value                                                                                                                                                                                                     |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Height                    | 32px; radius 6px; font 14px                                                                                                                                                                               |
| Background                | `#ffffff` (`--stellar-color-background-input`); **filled variant** `#eceef1` used for panel search fields (radius 6px, no border) [sampled]                                                               |
| Border                    | 1px `oklch(0.22 0.07 260 / 16%)` (`#d5dae4` equivalent); hover `/24%` (`#9fabc1`-ish); active/focus 1px `#2365d1` + focus ring `#3783ff`                                                                  |
| Placeholder               | `#9fabc1`; helper text `#626c7e`; label 12–14px 500 `#1e252f`                                                                                                                                             |
| Disabled                  | bg `#eceef1`, border `#dee3ea`, text `#9fabc1`                                                                                                                                                            |
| Validation                | error border `#e94937`, helper `#be3122`; caution `#b87c00` / `#8a6000`; success `#00a67a` / `#04785d`                                                                                                    |
| Checkbox / radio / switch | unselected bg `#d5dae4`; selected `#276ee1` (hover `#2365d1`); knob `#fbfbfb`; switch 44×24px, knob 20px [sampled: dialog toggle `#356bdf`, 35×17 css]                                                    |
| Select / context chips    | 32px `#fbfbfb` bordered chip with icon + text + `▾`, e.g. `🗄 PUBLIC_DATA ▾  PUBLIC ▾`, `ACCOUNTADMIN • COMPUTE_WH` [sampled]                                                                             |
| Dropdown menu             | white, radius 8px, elevation-1 shadow, 1px `#d5dae4`; items 32px, 14px `#1e252f`; hover `oklch(0.22 0.07 260 / 7%)`; section labels 12px `#5d6a85`; submenu chevron `›`; "PREVIEW" badge inline [sampled] |
| Range slider              | track `oklch(0.22 0.07 260 / 7%)`, range `#276ee1`, thumb white with `#3783ff` border                                                                                                                     |
| Scrollbar thumb           | `oklch(0.56 0.03 260)` `#6a7587`                                                                                                                                                                          |

---

## 8. Tables and the results grid

### 8.1 Object/list tables (Databases, Users, Recently viewed)

| Property      | Value                                                                                                                                                        | Source            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| Header        | bg `#ffffff` (no fill), 12px UPPERCASE 500–600 `#5d6a85`, tracking 0.02em; sorted column + arrow `#1a6ce7`; header height 32–40px; 1px `#d5dae4` bottom rule | [sampled]+[token] |
| Rows          | **41px pitch** (40px + 1px rule `#d5dae4`); no zebra; 14px `#1e252f`; leading 16px object icon (`#5d6a85`); first column bold-ish (500)                      | [measured]        |
| Row hover     | `oklch(0.22 0.07 260 / 7%)` (`--themed-reusable-background-row-hover`)                                                                                       | [token]           |
| Selected row  | `rgba(214,230,255,.5)`; hover `#bbd6fe`; border `#1a6ce7`                                                                                                    | [token]           |
| Row actions   | trailing "⋯" ghost button and comment icon in `#5d6a85`, appear right-aligned                                                                                | [sampled]         |
| Count caption | "2 Databases" 16px 600 above the table, with right-aligned chips: `🔍 Search`, `Source All`, `⟳` (24px tall chips)                                           | [sampled]         |

### 8.2 Query results grid (worksheet / Workspaces)

| Property                      | Value                                                                                                                                                                                                              | Source               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| Frame                         | 1px `#d5dae4` grid lines (vertical + horizontal); the newer grid is Glide Data Grid (`--gdg-*` vars present)                                                                                                       | [token]+[sampled]    |
| Header row                    | bg `#fbfbfb`, 14px 500 sans, cells show a type glyph (`A` text, `#` number, clock for date) at left and a `⋯` menu on hover; first (row-number) column header holds a chart icon in a `#e6f0ff` pill; header ~36px | [sampled]            |
| Body                          | bg `#ffffff` (older classic worksheet: `#fafafa`), 13–14px **mono**, rows ~26px (Workspaces) / 26px (classic); row numbers `#9fabc1`; numbers right-aligned                                                        | [sampled]+[measured] |
| Results tab bar               | "Results (just now)" tab text `#085bd7` with 2px blue underline; toolbar with Table/Chart segmented control, search, columns, download icons, "1 row ⓘ 294ms" and the **duration bar**                             | [sampled]            |
| Duration bar                  | 40×8px, two segments `#3580f2` (compile) + `#51caa5` (execute), radius 2px                                                                                                                                         | [sampled]            |
| Query details panel (classic) | right column cards on `#fafafa`: "Query duration 1.4s", "Rows 469", "Query ID" mono link, per-column histogram in `#1861e3`                                                                                        | [sampled]            |
| Query history rows            | leading 8px status dot `#6ec4ab` (success) / red `#d3132f` (fail), mono query text                                                                                                                                 | [sampled]            |

### 8.3 SQL editor syntax colours **[token]** (light | dark)

```
text            #191e24 | #f7f7f7
keyword         #085bd7 | #86b6fc      (SELECT, FROM, JOIN, CREATE OR REPLACE)
function        #087959 | #97f3cf      (system functions; also type names: string, variant)
type            #653e03 | #fccf54
string          #860112 | #f76a86
comment         #5d6a85 | #70819a
line number     #5d6a85 | #bdc4d5   (active #191e24 | #fbfbfb)
executed line bg #d6e6ff | #002c6e
error bg        #ffd1dc | #66000e   (older token: #f76a86)
search match bg #ffedcd | #653e03   (focused #ffc49a | #dd5f04)
python keyword  #9712e8 | #cb7efa ; py variable #002c6e | #5999f8 ; py number #087959 | #97f3cf
```

Editor background is white; gutter has no fill; the caret line is not highlighted. **[sampled]**

---

## 9. Tabs, menus, badges, status

| Element                                                                                    | Spec                                                                                                                                                                                                                                                                                          | Source                                                        |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Page tabs ("All projects · Files · Notebooks", "Graph · Table", "Schema Details · Tables") | 14px 500, inactive `#5d6a85`, active `#085bd7` with **2px underline `#085bd7`** flush to a 1px `#d5dae4` baseline; 16px gap between tabs; ~36px tall                                                                                                                                          | [sampled]                                                     |
| Editor file tabs (Workspaces)                                                              | tab strip bg `#fbfbfb`, inactive tab text `#1e252f`, **active tab bg `#ffffff` with text `#085bd7`** and a leading SQL-file icon; `+` to add; tabs 36px                                                                                                                                       | [sampled]+[token] (`--themed-product-areas-worksheets-tab-*`) |
| Classic worksheet tabs                                                                     | top strip `#eceef1` inactive / `#f7f7f7` active tab with `#d5dae4` border                                                                                                                                                                                                                     | [token]                                                       |
| Preview badge                                                                              | text 10–11px 600 UPPERCASE `#1e252f`… in practice rendered as `#d6e6ff` pill with `#2e5085`-ish text ("PREVIEW"); hover bg `/16%`                                                                                                                                                             | [token]+[sampled]                                             |
| Count badge                                                                                | bg `#fccf54`, text `#1e252f`                                                                                                                                                                                                                                                                  | [token]                                                       |
| Status pill (active)                                                                       | bg `#6a7587`, white text                                                                                                                                                                                                                                                                      | [token]                                                       |
| Status colours (text / bg / ui)                                                            | info `#2365d1` / `#e3efff` / `#3783ff` · success `#04785d` / `oklch(.95 .05 170)` / `#00a67a` · caution `#8a6000` / `oklch(.95 .05 80)` / `#b87c00` · critical `#be3122` / `#ffe8e3` / `#e94937` · neutral `#1e252f` / `oklch(.22 .07 260 / 7%)`                                              | [token]                                                       |
| Status dots                                                                                | success `#51caa5`/`#6ec4ab`, running blue `#3580f2`, failed `#d3132f`, queued `#f3be0f`                                                                                                                                                                                                       | [sampled]+[assumed]                                           |
| Account menu                                                                               | 32px avatar circle; sections separated by 1px `#d5dae4`; "Switch Role", "Account" labels 12px `#5d6a85`; items 14px `#1e252f` with 20px line icons, external-link glyphs right; submenu shows org name bold caps, account name in `#1a6ce7`, checkmark `#1a6ce7`, "View account details" link | [sampled]                                                     |
| Tooltips                                                                                   | dark `#1e252f` bg, white 12px text, radius 4px                                                                                                                                                                                                                                                | [assumed]                                                     |
| Toasts / banners                                                                           | left icon in status ui colour, bg status-background, 1px status border, radius 8px                                                                                                                                                                                                            | [assumed from tokens]                                         |

---

## 10. Charts **[token]**

Default categorical palette (Balto `--themed-chart-1…8`, light | dark):

```
1 #1a6ce7 | #5999f8   (blue)
2 #ecb700 | #f8c52a   (yellow)
3 #51caa5 | #80e3c1   (green)
4 #d3132f | #ef405e   (red)
5 #7157f4 | #a797f8   (violet)
6 #ff7c1d | #ffc59c   (orange)
7 #70ddff | #9ce7ff   (cyan)
8 #d45cff | #e59cff   (magenta)
dim: #c6dbfd #f5d791 #b0e5d1 #fccfcc #d6d7ff #ffd1b5 #96e5ff #f3cdff
```

Stellar categorical (current): `oklch(.56 .19 260)` `#276ee1`, `oklch(.83 .13 80)` `#f3bd5c`, `oklch(.74 .15 170)` `#00c89c`, `oklch(.56 .18 30)` `#c83b2c`, `oklch(.56 .2 290)` `#7855df`, `oklch(.69 .2 55)` `#f46f00`, `oklch(.83 .11 228)` `#73d5ff`, `oklch(.69 .2 320)` `#d06ae7`; "other" `#c3c7ce`.
Sequential: 10-step blue ramp `#e3efff → #c4dcff → #a5c9ff → #71aaff → #5498ff → #3783ff → #276ee1 → #2365d1 → #234f99 → #223f6f`. Diverging: blue ↔ `#fafafa` ↔ red. Warm: yellow→orange→red.
Reference line `#23272c`, reference dot `#e94937`, reference band `oklch(.22 .07 260 / 7%)`, forecast `#c3c7ce`. AI gradient: `#3783ff → #00abdf`.
Worksheet line/area charts: 2px line `#3580f2`-ish, area fill vertical gradient from `#7cd3ff`/`#c5dcff` to transparent; axis labels 12–13px `#5d6a85`; no gridlines except a bottom axis rule `#d5dae4`. **[sampled]**

---

## 11. Dark mode **[token]** — first-party, complete

Enabled via avatar menu › **Appearance** › Light / Dark / System (preview announced Summit, June 2024; GA since). Applied with the `.darkMode` class (Stellar) — not `prefers-color-scheme`. Core mappings (light → dark):

| Role                           | Light                             | Dark                                                                                                       |
| ------------------------------ | --------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Nav bg (`--nav-bg`)            | `#f7f7f7`                         | `#191e24`                                                                                                  |
| Page surface                   | `#ffffff` (`oklch(1 0 0)`)        | `oklch(0.21 0.01 260)` ≈ `#16181d`                                                                         |
| Raised surface (cards/menus)   | `#ffffff`                         | `oklch(0.24 0.01 260)` `#1c1f24`; overlay `oklch(0.27 0.012 260)` `#23272c`                                |
| Panel bg (`--panel-bg`)        | `#fbfbfb`                         | `#1e252f`                                                                                                  |
| Sunken / code bg               | `#eff0f2`                         | `oklch(0.18 0.01 260)` `#0f1216`                                                                           |
| Text                           | `#23272c` / `#1e252f`             | `oklch(0.89 0.01 260)` `#d7dbe1`                                                                           |
| Text subtle                    | `#626c7e` / `#5d6a85`             | `#979fab` / `#bdc4d5`                                                                                      |
| Border                         | `#d5dae4` / alpha 16%             | `#293246` / `oklch(0.85 0.04 260 / 17%)`                                                                   |
| Nav active bg / text           | `#d6e6ff` / `#085bd7`             | `#1f2c4a` / `#bdc4d5` (Stellar selected: `oklch(.33 .06 260)` `#233554` / `#71aaff`)                       |
| Primary button                 | `#1a6ce7` → hover `#085bd7`       | `#3580f2` → hover `#5999f8` (Stellar: `#2365d1` → `#234f99`), **text `#0f161e`** on the legacy dark button |
| Secondary button               | `#fbfbfb` / `#d5dae4` border      | `#1e252f` / `#293246` border, text `#9fabc1`                                                               |
| Link                           | `#2365d1`                         | `#71aaff`                                                                                                  |
| Focus                          | `#3783ff`                         | `#5498ff`                                                                                                  |
| Shadows                        | 10% black                         | 40% black                                                                                                  |
| Scrim                          | 40%                               | 70%                                                                                                        |
| Editor keyword/function/string | `#085bd7` / `#087959` / `#860112` | `#86b6fc` / `#97f3cf` / `#f76a86`                                                                          |
| Chart 1–8                      | see §10                           | lighter tints (see §10)                                                                                    |

No official dark-mode screenshot was found (community threads and a LinkedIn post confirm the toggle in the profile menu), so the dark values above are **from the shipped CSS tokens**, not sampled.

---

## 12. Layout numbers at a glance **[measured]**

```
nav width (expanded)         240px      nav item pitch          32px
icon rail width               56px      rail icon pitch         44px
secondary panel width        326px      panel search field       32px tall, #eceef1
page title block              64px      page side padding        24–32px
button height                 32px      chip/small button        24px
radius: button/pill/input      6px      card                      8px
table row pitch               41px      results grid row        ~26px
results header                36px      editor line height      ~21px
worksheet toolbar             56px      file-tab strip           36px
avatar                        32px      nav logo height         ~24px
```

---

## 13. Screenshot inventory (all in the review session's `refs/snowflake/` (not kept in the repo))

| File                                                                                                                      | Shows                                                                                                                                                                    | Source                                                            |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `docs_snowflake-homepage.png` (2880×2048, 2x)                                                                             | **Home page, 2025 left nav** (Shortcuts / Work with data / Horizon Catalog / Manage), quick-action cards, "Recently viewed" tabs + table; wireframe-style official image | docs.snowflake.com/en/user-guide/ui-snowsight-homepage            |
| `docs_ui-snowsight-old-new-ia.png` (2460×4494)                                                                            | Side-by-side of 2024 nav vs 2025 nav, at high res — best reference for nav item style, section labels, avatar block, bell                                                | docs …/ui-snowsight-navigation                                    |
| `docs_ui-snowsight-workspaces.png` (2880×2048)                                                                            | **Workspaces**: icon rail, file explorer, SQL editor with split Run button, results grid, query history; wireframe style                                                 | docs …/ui-snowsight/workspaces                                    |
| `docs_workspaces-default-editor.png` (1300×555, 2x)                                                                       | **Dialog/form**: "User preferences" dialog with bordered card, toggle, footer rule and primary "Close" button                                                            | same                                                              |
| `docs_snowsight-gs-account-selector.png`, `docs_snowsight-gs-user-menu.png`                                               | Account/role **menu** from the avatar (Switch Role, Account, Appearance ›, external links, Sign Out)                                                                     | docs …/ui-snowsight-gs                                            |
| `docs_snowsight-data-database-object-explorer.png`                                                                        | Object explorer tree (selected DB pill, schema groups, table/view/stage/pipe icons)                                                                                      | docs …/ui-snowsight-data-databases                                |
| `docs_snowsight-dashboards-tile.png`, `docs_snowsight-dashboards-add-tile.png`, `docs_snowsight-visualizations-chart.png` | **Dashboard tile**, add-tile drawer, worksheet area chart                                                                                                                | docs …/ui-snowsight-dashboards, …-visualizations                  |
| `docs_snowsight-activity-query-execution-plan.png`                                                                        | Query profile nodes (card style)                                                                                                                                         | docs …/ui-snowsight-activity                                      |
| `qs_3UIStory_4.png` (1715×1289, 1x)                                                                                       | **Real classic worksheet**: rail, Databases/Worksheets panel, SQL with syntax colours, Results pill, results grid, query details, "Ask Copilot"                          | snowflake.com/en/developers/guides/getting-started-with-snowflake |
| `qs_4PreLoad_5_new.png` (3250×1716, 2x)                                                                                   | **Real Workspaces editor** (2025): file tabs, Run split button `#1a6be7`, Table/Chart segmented control, duration bar                                                    | same                                                              |
| `qs_3UIStory_6.png` (1719×748, 1x)                                                                                        | **Databases listing page** with 2024 nav: "+ Database" primary, chips, uppercase table header, 41px rows                                                                 | same                                                              |
| `qs_4PreLoad_8_new.png` (2x)                                                                                              | Schema detail page: cards, breadcrumb title, Create split-button dropdown with PREVIEW badge, nested submenu                                                             | same                                                              |
| `qs_3UIStory_12.png` (1x)                                                                                                 | Users & Roles: nav with sub-items, Graph/Table tabs, role graph, details side panel, secondary button                                                                    | same                                                              |
| `qs_4PreLoad_3.png`                                                                                                       | Empty classic worksheet with Databases panel                                                                                                                             | same                                                              |
| `li_darkmode.jpg`                                                                                                         | 2023 nav bottom showing the Snowflake/light/dark appearance switch (historic)                                                                                            | LinkedIn post                                                     |
| `css/*.css`, `tokens_*.json`                                                                                              | Shipped Snowsight CSS and extracted tokens                                                                                                                               | app.snowflake.com/static                                          |

---

## 14. Minimal token set for a `brand-ui` theme (light / dark)

```css
/* Snowsight-like theme — values from Snowflake's shipped tokens */
--bg-page: #ffffff / #16181d;
--bg-nav: #f7f7f7 / #191e24;
--bg-panel: #fbfbfb / #1e252f;
--bg-sunken: #eff0f2 / #0f1216;
--bg-input-filled: #eceef1 / #293246;
--bg-selected: #d6e6ff / #233554;
--bg-hover: rgba(5, 25, 58, 0.07) / rgba(191, 207, 233, 0.07);
--border: #d5dae4 / #293246;
--border-strong: #9fabc1 / #5d6a85;
--text: #1e252f / #d7dbe1;
--text-subtle: #5d6a85 / #bdc4d5;
--text-disabled: #9fabc1 / #5d6a85;
--primary: #1a6ce7 / #3580f2;
--primary-hover: #085bd7 / #5999f8;
--primary-active: #004cbe / #1a6ce7;
--on-primary: #fbfbfb / #0f161e;
--link: #2365d1 / #71aaff;
--accent-text: #085bd7 / #86b6fc; /* active nav/tab text */
--focus: #3783ff / #5498ff;
--success: #00a67a;
--success-text: #04785d;
--success-bg: #cefae9;
--caution: #b87c00;
--caution-text: #8a6000;
--caution-bg: #ffecc9;
--critical: #e94937;
--critical-text: #be3122;
--critical-bg: #ffe8e3;
--brand-cyan: #29b5e8; /* logo only */
--font-sans: Inter, Roboto, "Helvetica Neue", Arial, sans-serif;
--font-mono: "Fira Mono", ui-monospace, Menlo, monospace; /* Apercu Mono Pro is proprietary */
--radius-sm: 6px;
--radius-md: 8px;
--radius-lg: 16px;
--control-h: 32px;
--row-h: 40px;
--nav-w: 240px;
--rail-w: 56px;
--shadow-raised: 0 0 1px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.1);
--shadow-overlay: 0 0 1px rgba(0, 0, 0, 0.1), 0 8px 16px rgba(0, 0, 0, 0.1);
--chart: #1a6ce7 #ecb700 #51caa5 #d3132f #7157f4 #ff7c1d #70ddff #d45cff;
```
