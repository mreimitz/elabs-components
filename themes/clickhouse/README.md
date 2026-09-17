# ClickHouse

A downloadable theme family for brand-ui — light ("ClickHouse Light") and dark ("ClickHouse Dark").

The dark scheme comes from a third-party design summary of clickhouse.com. The light scheme and
the logo come from ClickHouse's own docs repository (`ClickHouse/clickhouse-docs`): its colour
tokens and its logo SVGs. Every value names its source and how certain it is:

- **source** — a value stated in a source, converted to `oklch()` unchanged.
- **derived** — computed from a source value (ramps, lifts for contrast, extra chart series).
- **unverified** — every source here was read through a summarising web fetch, because raw
  downloads were blocked in the session that built the theme. Treat "source" values and the
  logo paths as unverified until they are checked against the raw files (see
  [Verify before public use](#verify-before-public-use)).

ClickHouse's name and logo are its trademarks. This theme is for internal work and demos;
public use needs ClickHouse's permission.

## What the theme reproduces — dark

| Element               | ClickHouse (s1)                                                       | Token(s)                                              | Certainty        |
| --------------------- | --------------------------------------------------------------------- | ----------------------------------------------------- | ---------------- |
| Brand / primary       | electric yellow `#FAFF69` — the only brand colour                     | `--primary`, `--primary-text`, `--link`, `--ring`     | source           |
| Ink on primary        | canvas black `#0A0A0A`                                                | `--primary-foreground`                                | source           |
| Pressed · hover       | Primary Active `#E6EB52`; hover halfway between                       | `--primary-active`, `--primary-hover`                 | source · derived |
| Page ground           | Canvas `#0A0A0A`                                                      | `--background`                                        | source           |
| Soft surface          | Surface Soft `#121212`                                                | `--surface`, `--chat-assistant`, `--flow-group`       | source           |
| Cards                 | Surface Card `#1A1A1A`                                                | `--card`, `--muted`, `--flow-node`                    | source           |
| Popovers, hover wash  | Surface Elevated `#242424`                                            | `--popover`, `--accent`, `--secondary`, `--chat-user` | source           |
| Text                  | Ink `#FFFFFF`, body `#CCCCCC`                                         | `--foreground`, `--foreground-2`                      | source           |
| Muted text            | Muted `#888888`, lifted to `oklch(0.66 0 0)` for 4.5:1 on cards       | `--muted-foreground`                                  | derived          |
| Hairline · field edge | Hairline `#2A2A2A`, Hairline Strong `#3A3A3A`                         | `--border`, `--input`                                 | source           |
| Strong rule           | `#3A3A3A` is under 3:1 on cards, so lifted to `oklch(0.55 0 0)`       | `--border-strong`                                     | derived          |
| Sidebar               | recessed below the canvas, `oklch(0.115 0 0)`                         | `--sidebar`, `--canvas`                               | derived          |
| Status                | Success `#22C55E`, Warning `#F59E0B`, Error `#EF4444`, blue `#3B82F6` | `--success`, `--warning`, `--destructive`, `--info`   | source           |
| Radius                | 8 px                                                                  | `--radius-base: 0.5rem`                               | source           |
| Logo                  | white bars mark + wordmark (s5, s6)                                   | `--brand-logo-mark`, `--brand-logo-lockup`            | source           |

All dark greys are untinted (chroma 0), matching ClickHouse's pure neutral ramp.

## What the theme reproduces — light

Names in parentheses are the docs' own palette steps (s2).

| Element                 | ClickHouse docs, light                                                             | Token(s)                                              | Certainty        |
| ----------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------- |
| Primary button          | `#373439` (slate_750) with white text — the docs' light button is dark, not yellow | `--primary`, `--primary-text`, `--primary-foreground` | source           |
| Pressed · hover         | `#161517` (slate_900); hover halfway between                                       | `--primary-active`, `--primary-hover`                 | source · derived |
| Page, cards, popovers   | `#FFFFFF`                                                                          | `--background`, `--card`, `--popover`                 | source           |
| Text · muted text       | `#161517` (slate_900) · `#696E79` (slate_600)                                      | `--foreground`, `--muted-foreground`                  | source           |
| Muted fill, hover wash  | `#F6F7FA` (slate_50)                                                               | `--muted`, `--secondary`, `--accent`, `--chat-user`   | source           |
| Sidebar, canvas         | `#F6F7FA` — docs nav is white; recessed one step below the page                    | `--sidebar`, `--canvas`, `--flow-group`               | derived          |
| Active sidebar item     | `#E6E7E9` (slate_100)                                                              | `--sidebar-accent`                                    | source           |
| Hairline · field edge   | `#E6E7E9` (slate_100) · `#CCCFD3` (slate_200)                                      | `--border`, `--sidebar-border` · `--input`            | source           |
| Strong rule             | `#808691` (slate_500) — the stroke is under 3:1 on white                           | `--border-strong`                                     | derived          |
| Links                   | `#135BE6` (info_400)                                                               | `--link`, `--info`, `--info-text`                     | source           |
| Brand yellow            | `#FEFFBA` (brand_100) with `#151515` ink — yellow survives as the match highlight  | `--highlight`, `--highlight-foreground`               | source           |
| Error                   | `#C10000` (danger_600) — white on `#F10000` is under 4.5:1                         | `--destructive`, `--destructive-text`                 | source           |
| Success                 | `#1C8439` (success_600) fill, `#15632B` (success_700) text                         | `--success`, `--success-text`                         | source           |
| Warning                 | `#ED8000` (warning_500) fill with dark ink, `#9E5600` (warning_700) text           | `--warning`, `--warning-foreground`, `--warning-text` | source           |
| Tables                  | no zebra stripe, 1 px row rule (s3)                                                | `--table-stripe`, `--table-row-rule-width`            | source           |
| Focus contour           | page background, as in dark                                                        | `--ring-contour`                                      | derived          |
| Radius, type, mono face | 8 px, Inter, JetBrains Mono, tight headlines — same as dark                        | `--radius-base`, `--font-*`, `--type-*`               | source (s1, s3)  |
| Logo                    | `#151515` bars mark + wordmark (s4, s6)                                            | `--brand-logo-mark`, `--brand-logo-lockup`            | source           |

Tokens not listed keep the built-in light theme's values; its slate neutrals (hue 257) sit
close to ClickHouse's slate ramp (hue 262–266).

## Chart palette

**Dark:** the brand yellow first, then the s1 accents — emerald `#22C55E`, blue `#3B82F6`
(lifted), rose `#EF4444` (lifted), amber `#F59E0B` — then derived series (light grey, dim
yellow, teal, violet, mid grey, light blue, light green). Sequential ramp: Primary Disabled
`#3A3A1F` to the brand yellow; diverging: blue ↔ yellow; mono: neutral grey. Ramps and series
6–12 are derived.

**Light:** all from the docs palette (s2) — blue `#135BE6`, orange `#FF9416` (the docs'
accent), green `#1C8439`, red `#F10000`, slate `#373439`, light blue `#6C9AF3`, dark orange
`#C66B00`, light green `#41D76B`, light red `#FF7575`, grey `#808691`, deep blue `#0E44AD`,
and a derived olive yellow `oklch(0.66 0.14 110)` (brand yellow is invisible on white).
Sequential ramp: info_50 → info_600; diverging: danger_600 ↔ info_500 around slate_200;
mono: slate_100 → slate_700.

## Typography

- `--font-sans` / `--font-display`: **Inter** (s1, s3), shipped by the token engine.
  Headlines are weight 700 with tight tracking (`-0.035em` display, `-0.03em` title), from s1's
  −2.5 px at 72 px and −1 px at 32 px.
- `--font-mono`: **JetBrains Mono** (s1). OFL-licensed but **not shipped**; it renders where
  installed, with the system monospace stack as fallback.

## Logo

Both modes carry ClickHouse's current logo: five rounded bars (the fifth a short stub) as the
mark, and the bars with the "ClickHouse" wordmark as the lockup (aspect 3.375). Light uses the
docs' `#151515` artwork (s4), dark the white artwork (s5). The mark is built from
`clickhouse-logo-mark.svg` (s6), with its `prefers-color-scheme` style block replaced by a
fixed fill per mode (the theme, not the OS, decides the mode).

## Decisions taken

- Light primary follows the docs: dark charcoal button, yellow kept for the highlight.
- The dark scheme keeps the s1 values; the docs' own dark tokens (warmer `#1F1F1C` ground,
  4 px radius) were not adopted.
- Both modes use 8 px corners, although the docs use 4 px.
- No typeface is shipped.

## Verify before public use

1. Download the raw SVGs (s4–s6) byte-for-byte and replace the logo tokens — the paths were
   copied through a summarising fetch.
2. Confirm the light values against the raw `colors.scss` (s2) and the dark values against
   clickhouse.com's own stylesheets.

## Sources

| id  | Source                                                                                                                                                           | Kind                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| s1  | [shadcn.io ClickHouse design summary](https://www.shadcn.io/design/clickhouse) — dark palette, type, radius                                                      | third-party, summarised fetch         |
| s2  | [clickhouse-docs `src/css/colors.scss`](https://github.com/ClickHouse/clickhouse-docs/blob/main/src/css/colors.scss) — palette, light/dark tokens                | first-party design tokens, summarised |
| s3  | [clickhouse-docs `src/css/default.scss`](https://github.com/ClickHouse/clickhouse-docs/blob/main/src/css/default.scss) — Inter, tables, 4 px radius              | first-party, summarised fetch         |
| s4  | [clickhouse-docs `static/img/ch_logo_docs.svg`](https://github.com/ClickHouse/clickhouse-docs/blob/main/static/img/ch_logo_docs.svg) — dark-ink lockup           | first-party SVG, summarised fetch     |
| s5  | [clickhouse-docs `static/img/ch_logo_docs_dark.svg`](https://github.com/ClickHouse/clickhouse-docs/blob/main/static/img/ch_logo_docs_dark.svg) — white lockup    | first-party SVG, summarised fetch     |
| s6  | [clickhouse-docs `static/img/clickhouse-logo-mark.svg`](https://github.com/ClickHouse/clickhouse-docs/blob/main/static/img/clickhouse-logo-mark.svg) — bars mark | first-party SVG, summarised fetch     |
| s7  | [clickhouse.com/docs](https://clickhouse.com/docs) — no stylesheet links survived the fetch                                                                      | live site, summarised fetch           |

Tried without result: raw `curl` downloads of clickhouse.com and GitHub (blocked in the
session), `src/css/_colors.scss` and `_default.scss` (404 — the files have no underscore).

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

   <ThemeProvider themes={clickhouseThemes} defaultTheme="clickhouse-light">
   ```

   Passing only this family REPLACES the default themes. To offer both, use
   `themes={[...BUILT_IN_THEME_DEFINITIONS, ...clickhouseThemes]}`.

A dark variant also needs the required `dark:` variant line — see [the themes folder README](../README.md).
