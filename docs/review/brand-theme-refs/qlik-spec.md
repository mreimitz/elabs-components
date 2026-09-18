# Qlik Cloud (2025–2026) visual spec for a CSS theme

Scope: Qlik Cloud Analytics hub (new left-nav "activity center" UI), Qlik Sense app sheet view, Qlik Talend Data Integration home, Administration. Light theme first; dark values from the same token source at the end.

## Sources and confidence labels

- **[token]** = measured from Qlik's own public design tokens, `@qlik/design-tokens@1.4.2` (npm, published 2026-02, last modified 2026-09-14; the built output of the internal _Sprout_ design system, `@qlik-trial/design-tokens`). Files saved here: `sprout-tokens.css`, `sprout-tokens.json`, and the flattened per-theme extracts `light_tokens.txt`, `dark_tokens.txt`, `expressive_light_tokens.txt`. The CSS ships four themes keyed on `[data-qlik-theme=...]`: `qlik-light`, `qlik-dark`, `qlik-expressive-light`, `qlik-expressive-dark`. Everything the product ships today (help screenshots 2024-2025) matches `qlik-light` pixel for pixel, so that is the spec. Variable prefix: `--sprout-*`.
- **[shot]** = read from an official help.qlik.com screenshot with pixel sampling (approximate; pixel-exact for flat colours, ±1 px for sizes after dividing out the capture DPR).
- **[assumed]** = inferred, not verified.

Also checked and NOT available: `@qlik-trial/sprout`, `@qlik/sprout`, `@qlik-oss/leonardo-ui` (404 on npm). `@qlik/sprout-icons@0.14.1` (icon SVGs, public) and `@qlik/sprout-css-modules@6.43.6` (tailwind-like utility classes over the tokens, no component CSS) exist. `leonardo-ui@1.7.1` and `@nebula.js/theme@0.6.0` are the _old_ Sense UI (2017-2020 palette, `#26a0a7` teal) and should not be used for today's look.

---

## 0. What makes it instantly "Qlik" (vs. a generic admin template)

1. **One green, used sparingly.** Brand/primary/selected/success are all the same `#00873d` [token]. It appears only on: the primary button, the 2 px active-nav bar, the 2 px active-tab underline, the selection chips and selected list rows, the notification count badge, toggles. Nothing else is coloured. Links and focus are blue `#005db9`, not green.
2. **Everything else is a warm-neutral grey ramp built on `#404040` text**, not black, and not blue-tinted greys: white surfaces, `#fafafa` page, `#f2f2f2` sheet, `#e6e6e6` strong, borders as black alpha (`rgba(0,0,0,.15)` = `#d9d9d9` on white). Text is `#404040`, secondary text is 76 % alpha of `#404040` (`#737373`-ish), never pure black.
3. **Source Sans Pro everywhere** (UI, headings, chart labels); Source Code Pro for script/tabular numbers. Headings are 600 weight, body 400; there is no 500 or 700 in the system.
4. **Very small radii and hairline borders, almost no shadows.** Cards, inputs, buttons: 4 px radius, 1 px `#d9d9d9` border, flat. Elevation only on popovers/menus (`0 2px 4px rgba(0,0,0,.15)` + a 1 px 5 % ring).
5. **The sheet is grey, the objects are white.** A Sense sheet is `#f2f2f2` with white `#fff` chart objects that have a 1 px `#d9d9d9` border and ~3 px radius, 600-weight 18 px titles in `#404040`, and a huge, light-grey (`#b0afae`) sheet title in the corner.
6. **The associative selection colours** (green selected / white possible / light-grey alternative / darker-grey excluded) and the green selection chips in a `#f2f2f2` selections bar are unique to Qlik.
7. **Icons are 16 px thin monoline glyphs in `#404040`** (Sprout icon set), with a tiny green accent dot/plus on a few "hub" icons (Home, Answers, Analytics).
8. **Layout**: white 48 px top bar with a 1 px bottom rule; 9-dot launcher at far left; grey-charcoal "Qlik" wordmark (`#54565a`) with green dot (`#009845`); 260 px white left nav with 2 px green active bar + `#f2f2f2` wash; content on `#fafafa`.

---

## 1. App shell

### Top bar (hub and app) — `nav_bar.png`, `app_nav_bar.png`, `semantic_search.png`

| Property                 | Value                                                                                                                                                                                                                                           | Source                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Height                   | 48 px (47 px + 1 px bottom border)                                                                                                                                                                                                              | [shot] (1x capture: 47+1; 1.5x capture: 72+1)               |
| Background               | `#ffffff`                                                                                                                                                                                                                                       | [shot] = `--sprout-common-background-color-default` [token] |
| Bottom border            | 1 px `#d9d9d9` (= `rgba(0,0,0,.15)`, `--sprout-common-border-default`)                                                                                                                                                                          | [shot]+[token]                                              |
| Left cluster             | 9-dot launcher icon (`#404040`, 16 px, 16 px from edge) → Qlik wordmark (charcoal `#54565a`, green dot `#009845`, ~56 px wide, 24 px tall) → activity-center name ("Analytics", "Insights", "Talend Data Integration") in 20 px / 400 `#404040` | [shot]                                                      |
| Centre                   | Global search input, ~600 px wide, 32 px tall, 1 px `#d9d9d9`, 4 px radius, search glyph left, placeholder "Search for content" in `#737373` (weak fg)                                                                                          | [shot]                                                      |
| Right cluster            | Secondary button "Ask Insight Advisor" (sparkle icon, outlined, 32 px) · 1 px vertical divider `#d9d9d9` · help `?` icon · bell icon · 32 px round avatar (initials, white on a per-user colour, e.g. `#ec87bf`, `#3185bc`)                     | [shot]                                                      |
| Icon buttons             | 32 × 32 hit area, 16 px glyph `#404040`, hover wash `rgba(0,0,0,.03)`, pressed `.05`, toggled `.08`                                                                                                                                             | [token]                                                     |
| Count badge on help icon | 16 px circle `#00873d`, white 11 px 600 number, top-right of the icon                                                                                                                                                                           | [shot]                                                      |

App top bar variant (`app_nav_bar.png`): after the wordmark, "Analytics app" label, then a 32 px **outlined select** ("Overview ▾", 1 px `#d9d9d9`, 4 px radius, 240 px wide) that opens the app navigation menu; centred: space breadcrumb ("👤 Personal /"), a 32 px square toggled icon-button (`#f2f2f2` wash) with the app icon, app name in 20 px, "⋯" more menu.

### Launcher (`launcher_menu.png`, `nav_menu.png`)

Clicking the 9-dot icon turns that 48 × 72 px cell **solid green `#00873d` with a white glyph**, and opens a 2-column panel: a 165 px rail of big 24 px icons + 14 px labels (Insights, Analytics, Data Integration, Administration, ─, Recents) with the active one in a `#f2f2f2` wash + 2 px green left bar; then a 390 px column of 16 px-icon + 16 px-label links grouped by 1 px `#d9d9d9` dividers (Home, Create, Favorites, Collections, Catalog / Automations / Alerts, Subscriptions / Getting started). Panel surface white, elevation-default shadow, no radius on the edge that touches the top bar.

### Left nav (hub) — `semantic_search.png` (1x), `hub_home_analytics.png` (1.5x), `di_home.png`

| Property                               | Value                                                                                                                                                                                                                                                        | Source         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| Width                                  | 260 px (259 + 1 px right border `#d9d9d9`)                                                                                                                                                                                                                   | [shot]         |
| Background                             | `#ffffff`                                                                                                                                                                                                                                                    | [shot]         |
| Padding                                | 16 px left/right; first item starts 16 px below the top bar                                                                                                                                                                                                  | [shot]         |
| Item                                   | 40 px tall, 4 px vertical gap (44 px pitch), full width of the padded column (228 px), 4 px radius                                                                                                                                                           | [shot]         |
| Item content                           | 16 px icon at 14 px from item left; 16 px gap; label 14 px / 400 `#404040` (`--sprout-label-font-s`)                                                                                                                                                         | [shot]+[token] |
| Active                                 | wash `#f2f2f2` (`--sprout-common-background-color-moderate`) **plus a 2 px `#00873d` bar on the left edge, full item height** (radius on the bar corners)                                                                                                    | [shot]+[token] |
| Hover                                  | `rgba(0,0,0,.03)` wash (`--sprout-common-background-color-hover`)                                                                                                                                                                                            | [token]        |
| Section dividers                       | 1 px `#d9d9d9`, inset 16 px both sides, 8 px above/below (`Home, Create, Favorites, Collections, Catalog, Data marketplace` ─ `Data products, Data quality` ─ `Analyze, Prepare data, Predict, Assistants, Automations` ─ `Alerts, Subscriptions` ─ `Learn`) | [shot]         |
| Status dot                             | 8 px `#009845` circle at the far right of an item ("Learn" with new content)                                                                                                                                                                                 | [shot]         |
| Collapse control                       | `⇤` icon button pinned to the bottom-left of the nav                                                                                                                                                                                                         | [shot]         |
| DI variant                             | same nav; group headings ("Talend") in 14 px 600                                                                                                                                                                                                             | [shot]         |
| Settings variant (`settings_form.png`) | narrower nav on `#fafafa`, section headings 14 px 600, active item wash `#ededed` + 2 px green bar                                                                                                                                                           | [shot]         |

### Page area

| Property                                                     | Value                                                                                                                                                                                                                | Source         |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Page background                                              | `#fafafa` (`--sprout-common-background-color-weak`)                                                                                                                                                                  | [shot]+[token] |
| Content inset                                                | 24 px from the nav; page title baseline ~40 px below the top bar                                                                                                                                                     | [shot]         |
| Page title                                                   | "Catalog", "Browse", "Welcome" — 24 px / 600 / `#404040` (`--sprout-heading-font-l`), line-height 130 %                                                                                                              | [shot]+[token] |
| Sticky sub-header (hub home)                                 | white band holding tabs ("Personal") and right-aligned actions, 1 px `#d9d9d9` bottom rule; content below on `#fafafa`                                                                                               | [shot]         |
| Section heading in page ("Recently used", "Apps to explore") | 20 px / 600 `#404040` (`--sprout-heading-font-m`) with a drag-handle glyph before it and a "⋯" after; row of ‹ › paging icon-buttons and a "View all" text button on the right, separated by a 1 px vertical divider | [shot]         |
| Page scrollbar                                               | native, on the content column only                                                                                                                                                                                   | [shot]         |

---

## 2. Cards / tiles (`semantic_search.png`, `hub_insights_browse.png`, `hub_home_analytics.png`)

| Property       | Value                                                                                                                                                                                                                                    | Source           |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Background     | `#ffffff`                                                                                                                                                                                                                                | [shot]           |
| Border         | 1 px `#e6e6e6`–`#ebebeb` (reads as `--sprout-common-border-weak` = `rgba(0,0,0,.1)` on white)                                                                                                                                            | [shot]+[token]   |
| Radius         | 4 px (`--sprout-common-border-radius-subtle`)                                                                                                                                                                                            | [shot]+[token]   |
| Shadow         | none at rest; hover = none/very faint (assume `--sprout-common-elevation-weak`)                                                                                                                                                          | [shot]/[assumed] |
| Size           | ~290 × 290 px in a 4-up grid, 24 px gutters (hub); 3-up ~430 px in Browse                                                                                                                                                                | [shot]           |
| Thumbnail zone | top ~64 %, white (not grey), with a centred 48 px thin-line illustration; a 1 px `#e6e6e6` rule separates it from the footer                                                                                                             | [shot]           |
| Footer         | 16 px padding; title 14 px 600 `#404040`; below it a 16 px avatar chip + "Updated Jun 24, 2024" 12 px `#737373`; on the right ☆ favourite and ⋯ icon-buttons; a 16 px square grey owner-icon badge sits on the thumbnail/footer boundary | [shot]           |
| Selected/focus | 2 px `#00873d` ring (`--sprout-selected-border-default`) / 2 px `#005db9` (`--sprout-focus-border-default`)                                                                                                                              | [token]          |

Widgets on the DI/Analytics home use a **tinted panel** for the "Learning path" block: `#f2f9f5`-ish very light green tint with 1 px `#d9d9d9` border, 4 px radius [shot, DI home]; inside it the step list uses 48 px rows with a 40 px light `#f2f2f2` icon square, active step in `#f2f2f2` wash + 2 px green bar.

---

## 3. Typography [token unless noted]

Family: `Source Sans Pro` (UI). Mono: `Source Code Pro` (script editor, tabular numbers). No fallback stack is declared in the tokens; use `"Source Sans Pro", "Source Sans 3", system-ui, sans-serif`.

| Role                         | Token                 | Value                                                      |
| ---------------------------- | --------------------- | ---------------------------------------------------------- |
| Heading xxl / xl             | heading-font-xxl / xl | 600 40px/130% · 600 32px/130%                              |
| Page title                   | heading-font-l        | 600 24px/130%                                              |
| Section title / dialog title | heading-font-m        | 600 20px/130%                                              |
| Card title / sub-section     | heading-font-s        | 600 16px/130% (cards actually render at 14 px 600 [shot])  |
| Tiny heading                 | heading-font-xs       | 600 12px/130%                                              |
| Body l / m / s / xs          | body-font-\*          | 400 20 / 16 / 14 / 12 px, line-height 150 %                |
| Label m / s / xs             | label-font-\*         | 400 16px/20px · 14px/16px · 12px/16px; `-emphasized` = 600 |
| Script                       | script-font-m         | 400 16px/150% Source Code Pro                              |
| Tabular data                 | data-font-tabular-s   | 400 14px/150% Source Code Pro                              |

Colours: default `#404040`; weak `rgba(64,64,64,.76)`; disabled `rgba(64,64,64,.55)`; inverse `#ffffff`; link `#005db9`; placeholder text ≈ `#737373` [shot]. Product-wide observed sizes: nav items 14 px, top-bar centre name 20 px 400, chart titles 18 px 600 [shot], chart axis labels 12–13 px `#595959` [shot], sheet title 28 px 400 `#b0afae` [shot].

---

## 4. Buttons (`semantic_search.png`, `settings_form.png`, `admin_users_table.png`, `selection_tool.png`)

| Variant                                                                                    | Spec                                                                                                                                                                                                                                                                                                                                                                      | Source         |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Primary ("Create new", "Assign", "Create new sheet")                                       | fill `#00873d`; text white 14 px 600; height 32 px; padding 0 16 px; radius 4 px; no border/shadow; hover `#006c31` (`rgb(0 42.353% 19.137%)`); pressed `#004b22`; focus ring 2 px `#005db9`; disabled fill `rgba(0,0,0,.15)` white text                                                                                                                                  | [shot]+[token] |
| Secondary / outlined ("Ask Insight Advisor", "Clear", "User Default", "Unassign", "Reset") | white fill; 1 px border `rgba(0,0,0,.43)` ≈ `#919191` (`--sprout-common-border-moderate`; measured `#949494`); text `#404040` 14 px 600; 32 px; 4 px radius; hover wash `rgba(0,0,0,.03)`                                                                                                                                                                                 | [shot]+[token] |
| Toolbar/top-bar outlined button ("Ask Insight Advisor")                                    | as secondary but border is the lighter `#d9d9d9`                                                                                                                                                                                                                                                                                                                          | [shot]         |
| Tertiary / text button ("View all", "Clear all", "Show more results")                      | no fill, `#404040` 14 px 600, hover wash                                                                                                                                                                                                                                                                                                                                  | [shot]         |
| Icon button                                                                                | 32 px square, 16 px glyph `#404040`, 4 px radius, toggled state `#f2f2f2`/`rgba(0,0,0,.08)` fill (see grid/list view toggle: toggled cell is `#e5e5e5` with black glyph)                                                                                                                                                                                                  | [shot]+[token] |
| Danger                                                                                     | `#d7004b`, hover `#ac003c`, pressed `#780029`                                                                                                                                                                                                                                                                                                                             | [token]        |
| AI-flavoured ("Generate insights" in Associative Insights)                                 | fill `#655dc6` violet, white text, 32 px, 4 px radius (older screenshot). Tokens now define an _AI_ colour set: `--sprout-ai-color-default #94579c`, hover `#76467d`, badge bg `#fad7ff`, border `#cc74d8`, fg `#764780`, gradient `linear-gradient(180deg, rgba(204,116,216,0) 64%, rgba(204,116,216,.3) 100%)` — use those for anything Insight-Advisor/Answers related | [shot]/[token] |
| Split/menu button                                                                          | primary with a "▾" chevron after the label, 8 px gap                                                                                                                                                                                                                                                                                                                      | [shot]         |
| "Edit sheet" (app toolbar, edit mode)                                                      | full-height (48 px) dark block `#4d4d4d`, white pencil + label; in view mode it is a plain text button                                                                                                                                                                                                                                                                    | [shot]         |

---

## 5. Inputs, selects, chips, toggles (`settings_form.png`, `semantic_search.png`)

| Control                                 | Spec                                                                                                                                                                                                              | Source           |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Text input / search                     | height 32 px; white bg (`--sprout-input-background-color-default`); 1 px `#d9d9d9` (`rgba(0,0,0,.15)`); radius 4 px; padding 0 8 px (36 px left when a leading icon); text 14 px `#404040`; placeholder weak grey | [shot]+[token]   |
| Focus                                   | border becomes 2 px `#005db9` (`--sprout-focus-border-default`; measured `#0275d9` in the search box, i.e. the 2 px ring is drawn inside the box, no glow)                                                        | [shot]+[token]   |
| Select / dropdown                       | same box as input, chevron `#404040` at right, 256 px typical width; menu = white, elevation-default, 4 px radius, 32 px rows, hover wash                                                                         | [shot]+[token]   |
| Filter chip ("Owned by you ✕")          | 34 px tall, `#f2f2f2` fill, 1 px `#cecece` border, 4 px radius, 14 px `#404040`, ✕ icon after                                                                                                                     | [shot]           |
| Filter select button ("Spaces [All] ▾") | outlined 32 px button whose value is a small **green-outlined count pill** (`#00873d` 1 px border, green text)                                                                                                    | [shot]           |
| Toggle switch                           | 28 × 16, on = `#00873d` track with white ✓ knob; off = `#e6e6e6` track                                                                                                                                            | [shot]/[assumed] |
| Checkbox                                | 16 px, 1 px `#919191` border, 2 px radius; checked = `#00873d` fill, white check                                                                                                                                  | [shot]/[assumed] |
| Label above field                       | 16 px 400 `#404040`, 8 px below; field groups 24 px apart                                                                                                                                                         | [shot]           |
| Info banner                             | bg `#e5f3fd`, 1 px `#005db9` border, 4 px radius, info icon `#176dc0`, text `#01385e`, right-aligned outlined action; 56 px tall                                                                                  | [shot]           |
| Placeholder/dashed drop zone            | 1 px dashed `rgba(0,0,0,.43)`                                                                                                                                                                                     | [token]          |
| Dividers                                | `rgba(0,0,0,.08)` solid 1 px (default), `.04` weak, `.2` strong, 2 px `.43` extra-strong                                                                                                                          | [token]          |

---

## 6. Tables (`admin_users_table.png`, `table_viz.png`)

Hub/admin data grid:
| Property | Value | Source |
|---|---|---|
| Header | bg `#fafafa`, 40 px tall, text 14 px 600 `#404040`, sort ▲▼ glyph right, column-resize `||` handle, 1 px `#d9d9d9` bottom rule | [shot] |
| Rows | white, 48 px tall (49 px pitch), 1 px `#d9d9d9` rule between rows, 16 px cell padding | [shot] |
| Hover | `rgba(0,0,0,.03)`; selected `rgba(0,0,0,.05)` (`--sprout-selected-background-color-default`) | [token] |
| Expanded detail row | `#fafafa` band containing a nested tab bar + nested grid | [shot] |
| Selection column | 16 px checkbox, 90 px column | [shot] |
| Inline badges ("Built-in", "Admin") | 24 px, white, 1 px `#d9d9d9`, 4 px radius, 12 px `#404040`, 4 px gap | [shot] |
| Row avatar | 24 px circle, initials 10 px 600 white on `#0080cc` / `#83aeda` / grey | [shot] |
| Footer | "Rows per page: 5 ▾ 1-4 of 4 ‹ ›", 40 px, 14 px `#404040`, 1 px top rule | [shot] |

Sense **table visualization** (in an app): header white, 14 px 600, 1 px `#bebebe` header rule; "Totals" row 600 with 1 px `#929292` rule; body rows 22 px tall with 1 px `#efefef` rules, 13 px text `#404040`, numbers right-aligned in a tabular font; no zebra by default (hovered row ≈ `#f9f9f9`).

---

## 7. Tabs

Text tabs 14 px 600 `#404040`, 40 px tall, 24 px horizontal padding, **active = 2 px `#00873d` underline** sitting on a 1 px `#d9d9d9` full-width rule; inactive text same colour (no grey-out), no background. [shot: `admin_users_table.png`, `hub_home_analytics.png`, `app_nav_menu.png` — "Sheets / Bookmarks / Stories" tab strip in the app overview uses icon + label.]

---

## 8. Badges / status colours [token]

| Semantic                        | Default                                                         | Weak (bg tint 5 %)    |
| ------------------------------- | --------------------------------------------------------------- | --------------------- |
| Success                         | `#00873d`                                                       | `rgba(0,135,61,.05)`  |
| Warning                         | `#ef6d00`                                                       | `rgba(239,109,0,.05)` |
| Danger/error                    | `#d7004b`                                                       | `rgba(215,0,75,.05)`  |
| Info / link / focus / favourite | `#005db9`                                                       | `rgba(0,93,185,.05)`  |
| AI                              | `#94579c` (badge bg `#fad7ff`, border `#cc74d8`, fg `#764780`)  | —                     |
| Search-hit highlight            | bg `#fff266`, active hit `#ffb84d`, marker `#ffe600`, fg `#000` |                       |
| Count badge (notifications)     | `#00873d` circle, white number                                  | [shot]                |

Neutral badge/tag: white, 1 px `#d9d9d9`, 4 px radius, `#404040` text [shot].

---

## 9. Menus, popovers, dialogs, tooltips

- **Popover/menu** (`options_menu.png`, `app_nav_menu.png`): white, `0 2px 4px rgba(0,0,0,.15), 0 0 0 1px rgba(0,0,0,.05)` (`--sprout-common-elevation-default`), 4 px radius, 8 px padding; items 32 px (40 px in the app-nav menu) with 16 px icon + 14 px label, submenu chevron `›` right, keyboard shortcut in 12 px weak grey right-aligned; group headings 14 px 600 with 8 px spacing; active item `#f2f2f2` wash + 2 px green left bar [shot].
- **Dialog**: white, elevation-strong `0 6px 20px rgba(0,0,0,.15)` + 1 px ring, 4 px radius, curtain `rgba(0,0,0,.6)` (`--sprout-curtain-background-color-default`); title 20 px 600; footer buttons right-aligned, primary rightmost, 8 px gap [token + assumed layout — no clean 2025 dialog screenshot found; the "Sheet properties" side panel in `sheet_edit.png` shows the same 1 px `#d9d9d9` inputs, 16 px labels and an orange `fx` expression-editor icon `#f8981d`].
- **Tooltip** (`dialog_subscription.png`): `#404040` (`--sprout-inverse-background-color-default`) bg, white 12 px text, 4 px radius, 8 px padding, no arrow.
- **Overlay/loading scrim**: `rgba(255,255,255,.8)` [token].
- z-index scale [token]: stacked 1000, floating 1100, overlay 1300, context 1350, time-sensitive (toasts) 1400, cursor (tooltips) 1500.

---

## 10. Sense app: sheet view, toolbar, selections bar (`sheet_view_analysis.png`, `sheet_edit.png`, `selections_bar.png`, `selections_popup.png`, `selection_tool.png`)

| Property                          | Value                                                                                                                                                                                                                                                                                                                                                                                                        | Source         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| App toolbar (below top bar)       | 48 px (52 in the 2024 capture), bg `#fafafa`, 1 px `#d5d5d5` bottom rule; left: "Assets / Sheets / Bookmarks" 14 px text+icon buttons (toggled = `#ededed` block), 1 px vertical dividers; centre: Insight Advisor lamp icon, selection-tool icon, then the **selections bar**; right: "Edit sheet"                                                                                                          | [shot]         |
| Selections bar                    | inline in the toolbar; four 32 px icon buttons (step back / forward / clear all / lock) in disabled grey `#b3b3b3` when nothing is selected, then "No selections applied" 14 px `#717171`; when active, **chips**                                                                                                                                                                                            | [shot]         |
| Selection chip                    | `#00873d` fill, white text, 180 px wide, 32 px tall (fills the bar), **3 px gap between chips, square corners**, two lines: field name 12 px 600 (ellipsised) and value 12 px 400; ✕ at right; the whole bar sits on `#f2f2f2`                                                                                                                                                                               | [shot]         |
| Chip popup                        | white, elevation, 4 px radius; header repeats the chip; a row of lock / ⋯ / clear / ✕ / ✓ icon buttons; menu items "Select all / possible / alternative / excluded" 40 px with 16 px icons                                                                                                                                                                                                                   | [shot]         |
| Sheet canvas                      | bg `#f2f2f2`; sheet title top-left 28 px 400 `#b0afae`; ‹ › sheet paging icons top-right                                                                                                                                                                                                                                                                                                                     | [shot]         |
| Sheet object (chart)              | white `#ffffff`; 1 px `#d9d9d9` border; ~3 px radius; no shadow; 12 px inner padding; title 18 px 600 `#404040` top-left; objects separated by 12 px gutters ("Wide" grid spacing)                                                                                                                                                                                                                           | [shot]         |
| Filter pane                       | white object; each field a 40 px header row 14 px 600 with 1 px `#d9d9d9` rule; list rows 36 px, 13 px text, 1 px `#e0e0e0` rules                                                                                                                                                                                                                                                                            | [shot]         |
| Selection states (list rows)      | selected `#00873d` fill + white text + ✓ · possible white · alternative `#e6e6e6` (`--sprout-alternative-color-default`; old shot `#e0e0e0`) · excluded `#b3b3b3` (`--sprout-excluded-color-default`; old shot `#bebebe`) · selected-excluded dark grey, all with `#404040` text (`-inverse`)                                                                                                                | [token]+[shot] |
| Edit mode                         | left 100 px icon rail on `#fafafa` (24 px icon + 12 px label, active = `#ededed` block + 2 px green bar), 316 px white asset list panel, canvas shows a dotted `#f2f2f2` grid, right 300 px white properties panel with 16 px labels, 32 px inputs, orange `fx` `#f8981d`, section headers with a 2 px green left bar, toolbar gains cut/copy/paste/delete/undo/redo and a dark `#4d4d4d` "Edit sheet" block | [shot]         |
| Assets panel search + "All (4) ▾" | 32 px input + select stacked, 8 px gap                                                                                                                                                                                                                                                                                                                                                                       | [shot]         |

---

## 11. Charts [token unless noted]

Default (Sense Horizon / `qlik-light`) categorical palette `--sprout-data-color-categorical-0-*`:
`#0047ad`, `#6694a8`, `#8bc5f5`, `#00b5aa`, `#00873d`, `#ffb84d`, `#ffcd80`, `#870063`, `#f15a81`, `#e74096`, `#ae006d`, `#d92686`.
Sequential 0 (orange): `#611100 #8e2200 #bf3900 #e65200 #ef6d00 #ff9800 #ffb84d #ffcd80`. Sequential 1 (blue): `#002d6d #003a8f #0047ad #005db9 #0275d9 #379def #8bc5f5 #b8dbf9`. Diverging: `#8e2200 #bf3900 #f57d00 #ff9800 #edf7fc #8bc5f5 #379def #0275d9 #0047ad`. Others `#a6a6a6`, null `#d9d9d9`, support `#b3b3b3`, support-weak `#e6e6e6`.

App-level default chart colouring seen in the help screenshots (the _Sense Horizon_ app theme, which is what a new app renders with) [shot]: single-colour measure `#006580` (deep teal); multi-series `#006580`, `#10cfc9`, `#87205d` (teal / aqua / plum); tonal donut `#006580 → #5694a8 → #9ebbc9 → #c9d7de`; positive KPI delta `#00873d`-ish green, negative `#f93f17`; gauge fill `#87205d`/`#006580`. Axis lines `#cccccc`, tick/axis labels 12 px `#595959`, gridlines near-white `#f2f2f2`, legend text `#595959`, chart title 18 px 600 `#404040`, bar value labels white 12 px inside bars. No drop shadows, square bar corners, 1 px lines with 4 px dots.

Script editor colours [token]: text `#404040`, comment `#808080`, function `#225a94`, keyword `#006480`, bracket-match `#8e2200`, variable/table `#ae006d`, field `#e65200`, string `#009844`, measure `#3d38a3`.

---

## 12. Sizing, spacing, radii, elevation [token]

- Spacing: xs 2 · s 4 · m 8 · l 12 · xl 16 · xxl 24 · 3xl 32. Sizing (control heights): s 4 · m 8 · l 12 · xl 16 · xxl 24 · 3xl 32 · 4xl 40 · 5xl 48 · 6xl 56 · 7xl 64. Observed: controls 32, nav/menu rows 40, top bar 48, table rows 48.
- Container widths: 128 · 256 · 320 · 400 · 512 · 640 · 768 · 960 · 1024 · 1280. Breakpoints: s 640, m 1024, l 1600.
- Radii: subtle 4 (buttons, inputs, cards, chips, menus), soft 8, cushiony 16, round 2000 (avatars). Nested radii are tokenised (e.g. soft-inside-subtle = 2). The product uses 4 px almost everywhere; only the Answers chat surface uses pill/16+ px shapes.
- Elevation: weak `0 1px 2px rgba(0,0,0,.15)`, default `0 2px 4px`, moderate `0 4px 10px`, strong `0 6px 20px` — each plus `0 0 0 1px rgba(0,0,0,.05)`.
- Borders: default `rgba(0,0,0,.15)` (`#d9d9d9` on white), weak `.10` (`#e6e6e6`), moderate `.43` (`#919191`), strong `.60`, extra-strong `.75`; focus 2 px `#005db9`; selected 2 px `#00873d`; placeholder 1 px dashed `.43`.
- Backgrounds: default `#ffffff`, weak `#fafafa`, moderate `#f2f2f2`, strong `#e6e6e6`, floating `#ffffff`, hover `rgba(0,0,0,.03)`, pressed `.05`, toggled `.08`, disabled `.03`; inverse bg `#404040`.

---

## 13. Dark theme (`qlik-dark`) [token]

fg `#ffffff` / weak 76 % / disabled 55 %; bg default `#333333`, weak `#262626`, moderate `#1a1a1a`, strong `#0e0e0e`, floating `#3c3c3c`; hover `rgba(255,255,255,.2)`; input bg `rgba(255,255,255,.06)`; borders `rgba(255,255,255,.15/.10/…)`; primary `#4ec574`; danger `#f15a81`; link `#5daef1`; categorical-0 starts `#5daef1, #6694a8, #8bc5f5, #00b5aa, #00873d …`; inverse bg `#ffffff` / fg `#333333`; elevation unchanged. Full list in `dark_tokens.txt`.

## 14. Emerging "expressive" variant (`qlik-expressive-light`) [token, not yet seen in product screenshots]

Same system with: primary `#006580` (teal, matching the Horizon chart colour) with hover `#00516a`; text `#262626`; page bg `#F3F6F7`, moderate `#EAF1F3`, strong `#E4EBED` (cool-tinted greys); toggled wash `rgba(4,172,217,.2)`; radii subtle 6 / soft 12 / cushiony 24; everything else identical. Worth exposing as a second preset. Full diff in `expressive_light_tokens.txt`.

---

## Screenshot inventory (all official, help.qlik.com unless noted; saved in the review session's `refs/qlik/` (not kept in the repo))

| File                                                                                        | Shows                                                                                                                                                                           | Capture scale                |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `hub_home_analytics.png`                                                                    | Analytics activity center **Home** with new left nav, top bar, "Personal" tab, widget rows of app cards                                                                         | 1.5x (2298×1310)             |
| `semantic_search.png`                                                                       | **Catalog** grid (2025, XLSX/CSV/QVD tiles), filter chips, "Create new" primary button, open semantic-search dropdown with focused search field                                 | 1x (1715×876)                |
| `hub_insights_browse.png`                                                                   | Insights activity center **Browse** (catalog with Spaces/Types/All filters, grid/list toggle, 3-up cards)                                                                       | 1x (2013×1318, large window) |
| `hub_insights.png`                                                                          | Insights **Home**                                                                                                                                                               | 1.5x                         |
| `launcher_menu.png`                                                                         | The **launcher** open (green 9-dot cell, activity-center rail + link column) over "Getting started" home                                                                        | 1x                           |
| `nav_menu.png`                                                                              | Launcher panel crop                                                                                                                                                             | 1x                           |
| `nav_bar.png`, `app_nav_bar.png`                                                            | Hub top bar; **app top bar** with "Overview ▾" select, space breadcrumb, app name                                                                                               | 1.5x                         |
| `app_nav_menu.png`                                                                          | App navigation **dropdown menu** (Home/Analyze/Narrate/Prepare/Business logic groups, shortcuts) over the app overview with Sheets/Bookmarks/Stories tabs                       | 1x                           |
| `sheet_view_analysis.png`                                                                   | **App sheet, view mode** (Horizon theme): toolbar with selections bar, grey sheet, white chart objects, filter pane, KPI, donut, bars, lines                                    | 1x                           |
| `sheet_edit.png`                                                                            | Same sheet in **edit mode**: full app chrome, asset rail, sheet list, properties panel, dark Edit-sheet block                                                                   | 1x                           |
| `selections_bar.png`, `selections_popup.png`, `selections_pinned.png`, `selection_tool.png` | Green **selection chips**; chip popup menu; pinned selection; the **Selections tool** overlay with selected/alternative/excluded rows and the violet "Generate insights" button | 1x                           |
| `table_viz.png`                                                                             | Sense **straight table** visualization (header, totals, rows)                                                                                                                   | 1x                           |
| `admin_users_table.png`                                                                     | Administration **data grid** (tabs, header, expandable row, nested tabs, checkboxes, badges, pagination)                                                                        | 1x                           |
| `settings_form.png`                                                                         | Profile **settings form**: info banner, labels, 32 px selects, outlined button, toggle, link                                                                                    | 1x                           |
| `dialog_subscription.png`                                                                   | Tooltip + section headings in a details dialog                                                                                                                                  | 1x                           |
| `di_home.png`                                                                               | **Talend Data Integration** activity-center home (nav, Welcome, tinted Learning-path panel)                                                                                     | 1.25x                        |
| `answers_chat.png`                                                                          | Qlik **Answers** chat panel (pill inputs, suggestion chips, "Close Answers" toggled button)                                                                                     | 1x                           |
| `options_menu.png`, `assets_panel.png`, `add_widgets.png`                                   | Chart context menu; edit-mode assets panel; "Add widgets" dialog list                                                                                                           | 1x                           |
| `old2024_app_overview.png`                                                                  | community.qlik.com blog, mid-2024 app overview (pre-left-nav) — for contrast only                                                                                               | ~0.5x                        |
