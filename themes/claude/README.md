# Claude

A downloadable theme family for brand-ui — light ("Claude Light") and dark ("Claude Dark").

A warm cream canvas with coral actions and stone-grey ink, after Anthropic's Claude product
and marketing surfaces. Every value below names its source and how certain it is:

- **third-party** — read from the [shadcn.io Claude design summary](https://www.shadcn.io/design/claude)
  (values measured from claude.com) through a summarising web fetch, not confirmed against
  Anthropic's own stylesheets.
- **derived** — computed from a third-party value (AA adjustments, hover shades, dark-mode
  lifts, ramps).

"Claude" and its marks are Anthropic's trademarks. This theme ships no logo and is for internal
work and demos.

## What the theme reproduces

| Element                 | Claude (light)                                                                                                               | Token(s)                                        | Certainty   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ----------- |
| Page ground             | cream canvas `#faf9f5`                                                                                                       | `--background`, `--surface`, `--chat-assistant` | third-party |
| Sidebar, muted zones    | surface soft `#f5f0e8`, recessed below the page                                                                              | `--sidebar`, `--muted`, `--canvas`              | third-party |
| Secondary, user bubble  | surface card `#efe9de`                                                                                                       | `--secondary`, `--chat-user`, `--flow-group`    | third-party |
| Hover wash              | surface cream strong `#e8e0d2`                                                                                               | `--accent`, `--sidebar-accent`                  | third-party |
| Cards, popovers         | near-white cream `oklch(0.995 0.003 95)` — the source's `#efe9de` card sits below the page, which the elevation rule forbids | `--card`, `--popover`, `--surface-elevated`     | derived     |
| Ink · body              | ink `#141413` · body `#3d3d3a`                                                                                               | `--foreground`, `--foreground-2`                | third-party |
| Muted text              | `#6c6a64` darkened to `oklch(0.50 0.01 92)` for 4.5:1 on the soft surfaces                                                   | `--muted-foreground`                            | derived     |
| Brand / focus           | coral `#cc785c`                                                                                                              | `--ring`, `--chart-1`                           | third-party |
| Filled button           | coral deepened to `oklch(0.57 0.118 39)` so white ink clears 4.5:1 (the source's white on `#cc785c` is 3.3:1)                | `--primary`, `--primary-foreground`             | derived     |
| Button hover · pressed  | primary active `#a9583e`, then one step darker                                                                               | `--primary-hover`, `--primary-active`           | third-party |
| Links, coloured text    | `#a9583e` nudged to `oklch(0.54 0.113 39)` for 4.5:1 on every surface                                                        | `--primary-text`, `--link`                      | derived     |
| Hairlines · strong rule | hairline `#e6dfd8` · muted soft `#8e8b82` darkened for 3:1                                                                   | `--border`, `--input`, `--border-strong`        | derived     |
| Status                  | error `#c64545`, success `#5db872`, warning `#d4a017` — success and warning darkened to read as marks on cream               | `--destructive`, `--success`, `--warning`       | derived     |
| Radius                  | 8 px base (the source ladders 4 px buttons → 16 px illustrations)                                                            | `--radius-base: 0.5rem`                         | third-party |

Dark: the source's dark product surfaces become the grounds — `#181715` page, `#1f1e1b` surface,
`#252320` card, sidebar recessed to `oklch(0.18 0.004 85)`. Text is on-dark `#faf9f5` with
on-dark soft `#a09d96` for muted text. Coral lifts to `oklch(0.68 0.118 39)` with ink `#141413`
on filled buttons, since white on a lighter coral fails AA. Status colours lift to the source
hexes with dark ink. All dark values beyond the four source surfaces are derived.

## Chart palette

`--chart-1…3` are the brand trio: coral `#cc785c`, accent teal `#5db8a6`, accent amber
`#e8a55a`. `--chart-4` is body `#3d3d3a` (a light stone in dark mode) and `--chart-8` is muted
soft `#8e8b82`. The rest are derived tints and shades of the trio plus one plum for separation.
The sequential ramp is coral; the diverging ramp pairs teal (negative) with coral (positive); the
mono ramp is warm stone.

## Typography

- `--font-sans`: **Styrene B**, then Inter — Claude's UI face. Styrene B is commercial and never
  shipped; it renders only where licensed and installed. Inter (shipped by the token engine) is
  the fallback.
- `--font-display`: **Copernicus**, then Tiempos Headline, then Georgia — Claude's serif display
  face. Both named faces are commercial and never shipped.
- `--font-mono`: **JetBrains Mono**, then Source Code Pro (the engine default). Not shipped.

## Decisions taken

- Filled buttons use a deepened coral with white ink rather than the exact brand coral, so the
  label passes WCAG AA; the exact coral stays on focus rings and the first chart series.
- Cards sit slightly above the cream page instead of the source's darker beige card, to keep
  the recessed-chrome / raised-card order the engine requires.
- No logo: the demo mark stays (`--brand-logo-*: initial`).
- No typeface is vendored.

## Verify before public use

Every third-party value above came through a summarising fetch of one page. Confirm the
surfaces, coral and text colours against claude.ai's own stylesheets before relying on them.

## Sources

| id  | Source                                                                                                                           | Kind                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| s1  | [shadcn.io Claude design summary](https://www.shadcn.io/design/claude) — colour, type and radius values measured from claude.com | third-party, summarised fetch |

## Use it

1. Copy this folder into your app, e.g. `src/themes/claude/`.
2. Import the stylesheet(s) after the token engine:

   ```ts
   import "@elabs-ai/components-tokens/styles.css";
   import "./themes/claude/claude-light.css";
   import "./themes/claude/claude-dark.css";
   ```

3. Register the family:

   ```tsx
   import { ThemeProvider } from "@elabs-ai/components-tokens";
   import { claudeThemes } from "./themes/claude/theme";

   <ThemeProvider themes={claudeThemes} defaultTheme="claude-light">
   ```

   Passing only this family REPLACES the default themes. To offer both, use
   `themes={[...BUILT_IN_THEME_DEFINITIONS, ...claudeThemes]}`.

A dark variant also needs the required `dark:` variant line — see [the themes folder README](../README.md).
