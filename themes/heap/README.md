# Heap

A downloadable theme family for brand-ui — light ("Heap Light") and dark ("Heap Dark").

Built from the Heap design-token extraction published on shadcn.io. That source documents
a **light-only** system, so the dark scheme here is a derivation, not Heap's own. Every value
below names how certain it is:

- **measured** — a hex value stated by the source, converted to `oklch()`.
- **derived** — computed from a measured value (hover and pressed steps, ramps, the dark scheme).
- **inferred** — no source states it; chosen to fit (the chart series, status colours other than error).

Heap is a trademark of its owner. This theme is for internal work and demos.

## What the theme reproduces

| Element                | Heap token (hex)                                      | Token(s)                                      | Certainty          |
| ---------------------- | ----------------------------------------------------- | --------------------------------------------- | ------------------ |
| Brand / primary        | Primary `#31D891` (mint)                              | `--primary`, `--sidebar-primary`, `--chart-1` | measured           |
| Ink on primary         | Ink `#111111` (≈10:1 on mint)                         | `--primary-foreground`                        | measured           |
| Hover · pressed        | Primary Muted `#31A679` · one step darker             | `--primary-hover`, `--primary-active`         | measured · derived |
| Links, coloured text   | Primary Dark `#31715F`                                | `--link`, `--primary-text`, `--ring`          | measured           |
| Focus ring contour     | Primary Link Hover `#1B4438`                          | `--ring-contour`                              | measured           |
| Page · cards           | Canvas `#FFFFFF`, faintly tinted page ground          | `--card`, `--popover`, `--background`         | measured · derived |
| Tint wash              | Surface Tint `#EFEFFF`                                | `--accent`, `--secondary`, `--chat-user`      | measured           |
| Deep navy              | Surface Dim `#100841`                                 | `--sidebar`, `--terminal-background`          | measured           |
| Body · muted text      | Ink `#111111`; Ink Muted `#4F525D`                    | `--foreground`, `--muted-foreground`          | measured           |
| Dim text               | Ink Dim `#868C95`                                     | `--foreground-4`                              | measured           |
| Hairline               | Hairline `#DFDFDF`                                    | `--border`, `--input`                         | measured           |
| Strong rule            | Ink Dim darkened to 3:1 on white                      | `--border-strong`                             | derived            |
| Error                  | Error `#DF0134` · Error Dark `#A80125`                | `--destructive`, `--destructive-text`         | measured           |
| Success, warning, info | not in source — scaffold defaults on the cool neutral | `--success`, `--warning`, `--info`            | inferred           |
| Radius                 | 4 px cards; 70 px pill buttons                        | `--radius-base: 0.25rem`, `--control-radius`  | measured           |

## Dark scheme

Derived from Surface Dim: the page is a lifted navy (`oklch(0.18 0.05 280)`), cards and
popovers step up from it, the sidebar sits below it so chrome stays recessed. Mint stays the
brand fill with ink on it; mint also carries links and the focus ring. Error keeps
`#DF0134` as its fill (white ink stays AA) and lightens only for coloured text.

## Chart palette

The source publishes no data-visualisation palette. `--chart-1` is mint; `--chart-2…12` alternate
hue and lightness so neighbours stay apart: navy-indigo, coral, amber, sky, magenta, Primary
Dark teal, lavender, orange, blue, olive, neutral. The sequential ramp runs mint → Primary Dark
(reversed in dark); the diverging ramp pairs indigo with mint around a neutral mid.

## Typography

- `--font-display`: Circular Std (Heap's display and heading face), then the system UI stack.
- `--font-sans`: Lettera Text (Heap's body face), then the system UI stack.
- Both faces are commercial and **not shipped**; without them installed the system stack renders.
- `--font-mono`: the system monospace stack.

## Decisions taken

- Controls (buttons, inputs, selects, tab labels) take Heap's pill shape via
  `--control-radius: 9999px`; cards keep the 4 px radius.
- Heap's primary button is ink with a mint border, inverting on hover. brand-ui has no border
  token for filled buttons, so the theme uses the mint fill with ink text instead.
- The light sidebar uses Heap's deep navy block, which keeps app chrome visually recessed.
- No logo: `--brand-logo-*` stay `initial`, so brand-ui’s own mark shows.

## Sources

| id  | Source                                                  | Kind                   |
| --- | ------------------------------------------------------- | ---------------------- |
| s1  | [Heap design tokens](https://www.shadcn.io/design/heap) | third-party extraction |

## Use it

1. Copy this folder into your app, e.g. `src/themes/heap/`.
2. Import the stylesheet(s) after the token engine:

   ```ts
   import "@elabs-ai/components-tokens/styles.css";
   import "./themes/heap/heap-light.css";
   import "./themes/heap/heap-dark.css";
   ```

3. Register the family:

   ```tsx
   import { ThemeProvider } from "@elabs-ai/components-tokens";
   import { heapThemes } from "./themes/heap/theme";

   <ThemeProvider themes={heapThemes} defaultTheme="heap-light">
   ```

   Passing only this family REPLACES the default themes. To offer both, use
   `themes={[...BUILT_IN_THEME_DEFINITIONS, ...heapThemes]}`.

A dark variant also needs the required `dark:` variant line — see [the themes folder README](../README.md).
