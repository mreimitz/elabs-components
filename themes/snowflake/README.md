# Snowflake

A downloadable theme family for brand-ui — light ("Snowflake Light") and dark ("Snowflake Dark").

Built from Snowflake's public brand guidelines plus observations of snowflake.com. Snowflake
publishes no dark mode; the dark scheme is derived. Every value below names its source and
how certain it is:

- **guideline** — stated on Snowflake's brand guidelines page.
- **derived** — computed from a guideline value (hover shades, dark-mode lifts, ramps).
- **unverified** — taken from a third-party page or read through a summarising web fetch,
  and not yet confirmed against a raw first-party file. Re-check these before relying on
  them (see [Verify before public use](#verify-before-public-use)).

The logo is Snowflake's trademark. This theme is for internal work and demos; public use
needs Snowflake's permission.

## What the theme reproduces

| Element                 | Snowflake (light)                                                | Token(s)                                     | Certainty  |
| ----------------------- | ---------------------------------------------------------------- | -------------------------------------------- | ---------- |
| Brand / primary         | Snowflake Blue `#29B5E8`                                         | `--primary`, `--ring`, `--chart-1`           | guideline  |
| Ink on primary          | Winter `#24323D` — white on Snowflake Blue is only 2.37:1        | `--primary-foreground`                       | guideline  |
| Hover · pressed         | Snowflake Blue at lightness −0.025 / −0.05 (−0.10 fails the ink) | `--primary-hover`, `--primary-active`        | derived    |
| Body text               | Winter `#24323D`                                                 | `--foreground`, `--sidebar-foreground`       | guideline  |
| Links, coloured text    | Mid Blue `#11567F`                                               | `--link`, `--primary-text`, `--ring-contour` | guideline  |
| Page ground             | white tinted toward the brand hue, `oklch(0.985 0.004 235)`      | `--background`                               | derived    |
| Cards, popovers         | `#FFFFFF`                                                        | `--card`, `--popover`                        | unverified |
| Muted text              | `#535862`                                                        | `--muted-foreground`                         | unverified |
| Sidebar, hover wash     | soft blue-grey `#ECF1F5`, recessed below the page                | `--sidebar`, `--accent`                      | unverified |
| Hairlines · strong rule | brand-tinted greys; Windy City `#8A999E` darkened for 3:1        | `--border`, `--input`, `--border-strong`     | derived    |
| Radius                  | 8 px                                                             | `--radius-base: 0.5rem`                      | unverified |

Dark: navy grounds on the brand hue (`oklch(0.20 / 0.235 / 0.26 0.02 235)`, sidebar
`0.17`), Snowflake Blue stays the primary with navy `#042130` ink (unverified), links and
coloured text `#76D0F1` (unverified), near-white text `oklch(0.96 0.005 235)`.

## Chart palette

`--chart-1…8` follow the guideline palette: Snowflake Blue `#29B5E8`, Valencia Orange
`#FF9F36`, Mid Blue `#11567F`, First Light `#D45B90`, Star Blue `#71D3DC`, Purple Moon
`#7D44CF`, Windy City `#8A999E`, Ruby Sky `#3C0045`. `--chart-9…12` are derived variants of
the same palette (deepened orange and teal, tinted pink and purple).

Dark mode lifts the three series that vanish on navy — Mid Blue, Purple Moon and Ruby Sky —
and re-derives series 9–12. The sequential ramp is Snowflake Blue; the diverging ramp pairs
Snowflake Blue with Valencia Orange; the mono ramp is neutral grey tinted toward the brand
hue. All ramps are derived.

## Typography

- `--font-sans`: **Lato** — Snowflake's body face (guideline). Lato is OFL-licensed but is
  **not shipped** with this theme; it renders where installed, and Inter (shipped by the
  token engine) is the fallback.
- `--font-display`: **Texta**, then Lato — Texta is Snowflake's headline face (guideline). It
  is a commercial typeface and is never shipped; it renders only where licensed and installed.
- `--font-mono`: Source Code Pro (the engine default).

## Logo

`--brand-logo-mark` is the snowflake "bug" from the snowflake.com footer; `--brand-logo-lockup`
is the mark with the wordmark (aspect 4.1818), from Wikimedia Commons. Both are all Snowflake
Blue, so the same image works on light and dark grounds. Both were read through a summarising
web fetch, not downloaded byte-for-byte — **unverified**.

## Decisions taken

- Primary stays Snowflake Blue with dark Winter ink (faithful to the guideline) rather than
  Mid Blue with white ink.
- Controls keep 8 px product corners, not the marketing site's pill buttons.
- Lato is not shipped with the theme.
- The derived navy dark mode ships alongside light.

## Verify before public use

1. Download the official logo files from Snowflake's brand guidelines page and replace both
   logo tokens.
2. Confirm the unverified surface values (`--card`, `--muted-foreground`, `--sidebar`,
   `--accent`, radius, dark `--primary-foreground` and links) against snowflake.com's own
   stylesheets.

## Sources

| id  | Source                                                                                                                | Kind                          |
| --- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| s1  | [snowflake.com home page](https://www.snowflake.com/en/) — fetched without its `<head>`, so no stylesheets            | user link                     |
| s2  | [Snowflake brand guidelines](https://www.snowflake.com/brand-guidelines/) — palette (hex/RGB/CMYK/Pantone), typefaces | guideline                     |
| s3  | Web search for Snowflake brand colours                                                                                | search                        |
| s4  | [shadcn.io Snowflake design summary](https://www.shadcn.io/design/snowflake) — values measured from snowflake.com     | third-party                   |
| s5  | snowflake.com footer logo mark SVG (`nav-icon-snowflake-bug.svg`)                                                     | first-party, summarised fetch |
| s6  | [Wikimedia Commons `Snowflake_Logo.svg`](https://upload.wikimedia.org/wikipedia/commons/f/ff/Snowflake_Logo.svg)      | third-party, summarised fetch |

Tried without result: brandfetch.com (403), logotyp.us and select.dev (no colour values or
SVG), brandcolorcode.com (gave `#00A1D9`, which contradicts the guidelines — ignored).

## Use it

1. Copy this folder into your app, e.g. `src/themes/snowflake/`.
2. Import the stylesheet(s) after the token engine:

   ```ts
   import "@elabs-ai/components-tokens/styles.css";
   import "./themes/snowflake/snowflake-light.css";
   import "./themes/snowflake/snowflake-dark.css";
   ```

3. Register the family:

   ```tsx
   import { ThemeProvider } from "@elabs-ai/components-tokens";
   import { snowflakeThemes } from "./themes/snowflake/theme";

   <ThemeProvider themes={snowflakeThemes} defaultTheme="snowflake-light">
   ```

   Passing only this family REPLACES the default themes. To offer both, use
   `themes={[...BUILT_IN_THEME_DEFINITIONS, ...snowflakeThemes]}`.

A dark variant also needs the required `dark:` variant line — see [the themes folder README](../README.md).
