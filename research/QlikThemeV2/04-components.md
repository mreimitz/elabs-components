# 04 · Components (computed values from the live page)

All values read from the rendered light theme. "Control height" is **32px** unless noted.

## Buttons

| Variant                     | bg                          | text         | border                   | radius                                        | height | font         | padding  |
| --------------------------- | --------------------------- | ------------ | ------------------------ | --------------------------------------------- | ------ | ------------ | -------- |
| **Primary** ("Use in")      | **#00873D**                 | #fff         | 1px transparent          | **4px**                                       | 32px   | **14 / 600** | ~0 8px   |
| **Secondary** ("Refresh")   | #fff                        | #404040      | **1px rgba(0,0,0,0.43)** | 4px                                           | 32px   | 14 / 600     | ~0 8px   |
| **Ghost / text**            | transparent                 | #404040      | none                     | 4px                                           | 32px   | 14 / 600     |          |
| **Icon (square)**           | transparent                 | #404040      | none                     | 4px                                           | 32px   |              | square   |
| **Icon (round)**            | transparent                 | #404040      | none                     | **2000px**                                    | 32px   |              | circular |
| **Segmented** (view toggle) | #fff / rgba(255,255,255,.6) | #000/#404040 | 1px rgba(0,0,0,.15)      | **3px** (outer `4px 0 0 4px` / `0 4px 4px 0`) | 32px   | 14 / 600     |          |

Primary = the only filled green; hover darkens. Secondary = white + a **moderate** (43%)
border. Split buttons (Refresh + chevron, Use in + chevron) join two segments sharing a
4px-outer / 0-inner radius. Disabled buttons drop to `rgba(0,0,0,0.1)` fills.

## Tabs

Text buttons in a row (Overview / Profile / Data preview / …); the **active tab is marked by
a green underline** (#00873D) — no pill, no fill. Height ~38px, 12px horizontal padding,
label 14px (600 when active). Inactive text #404040 muted.

## Cards

White surface · **1px `rgba(0,0,0,0.15)` border** · **~8px radius** (large cards; small cards
4px) · **elevation-weak shadow** (`0 1px 2px` + `0 0 0 1px` ring) · generous padding
(~16–24px). Card header = a small **label / caption** (12px, often with a leading icon, e.g.
"Description" with the AI sparkle) over body text. Cards sit either on the page background or
inside a recessed panel.

## Panels (recessed wells)

The **Qlik Trust Score™** block is a **light grey-green rounded well** containing **white
sub-cards**. Each sub-card: a **circular outline icon** (green/teal), a **big percentage**
(e.g. `97%`, data/mono feel), a small **delta chip** (`0.0` neutral grey, or `▼ 12.0` in
**danger pink #D7004B**), a **14/600 label** (Validity / Completeness / …), and a **12px muted
description**. A disabled sub-card (Timeliness) greys out and shows a "Configure" button
(empty state). The hero figure `4.4/5` is a large number beside a teal shield icon.

## Inputs / search

White field · subtle 1px border · **4px radius** · leading **search glyph** (muted) ·
placeholder **#8C8C8C** · height ~32px. Focus = the **2px blue (#5daef1)** ring (not green).
Sprout input bg (dark base) `#ffffff0f`; light renders white.

## Data table (Data preview)

- **Header row:** a selection circle + **column name (14 / 600)** + a **data-type sublabel**
  (muted caption: "Text" / "Integer" / "Last Name (Text)") + a **green type-indicator
  underline** beneath each header.
- **Rows:** row-number (muted) + cell values **#404040 / 14px** (mono for numeric); **~39px
  row height**; **hairline row + column dividers** (`rgba(0,0,0,~0.1)`); white background with
  hover highlight. Dense, quiet, legible.

## Field cards (Profile)

Grid of white cards (subtle border + shadow, 4px radius). Each: a **mini distribution** at
top — horizontal **bars in muted blue-grey ≈#98BCCA** with value labels + counts (or an
**area chart** with an "Avg" marker for numeric, or a text list for high-cardinality) — then
the **field name (14 / 600)** and **"Distinct values: N" / "Null values: N"** (12px muted). A
top toolbar: search field + a **segmented grid/list/data** view toggle.

## Right rail (object metadata)

Stacked **label → value** pairs separated into groups by **hairline dividers**: label **12px
#8C8C8C**, value **14px #404040**. Inline **muted icons** (rocket, person, eye ~16px) and
**circular 20px avatars** (photos) for Owner/Creator. "Space" shows a **rounded-square (4px)
blue app icon** + name. "Dataset ID" pairs a mono value with a **copy icon**.

## Avatars & icons

- **Avatars:** circular (`border-radius: 50%`); photo or coloured initials; ~20px in lists,
  ~32px for the top-bar user. App/space icons are **rounded-square (4px)**, often a brand
  colour fill (blue).
- **Icons:** Qlik's own line-icon set (not Lucide), ~16px, `currentColor` (muted #404040 /
  #8C8C8C), thin stroke. Status/trust icons render in **circular green/teal outlines**.

## Top bar (global chrome)

White bar, **bottom hairline border**, ~48px tall: the **Qlik green logo** (Q + wordmark) +
section name ("Dataset") at left; at right an **app-launcher grid icon**, **search**, an
**"Open Answers"** AI pill button (white, bordered, sparkle glyph), a **help (?)** icon, a
**notification bell with count badges** (small green/red circles, white numerals), and the
**user avatar**. Calm, monochrome except the green logo.

## Status indicators

- Positive / valid: **green** check + green progress fill (#00873D).
- Negative delta: **▼ in danger pink #D7004B**.
- Neutral delta / "0.0": **grey chip**.
- Validation/quality bars: green "valid" segment vs grey "empty/null" segment.
- Badges (notifications): small solid circles (green / red) with white count.
