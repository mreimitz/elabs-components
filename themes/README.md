# Theme families

Downloadable themes for brand-ui. Each folder is one **theme family**. A family has a
light version, a dark version, or both, and you can use it instead of the default themes
or alongside them.

These themes are not published with the npm packages. To use one, copy its folder into
your app.

| Family                      | Modes                              |
| --------------------------- | ---------------------------------- |
| [ClickHouse](./clickhouse/) | light + dark                       |
| [Graphite](./graphite/)     | light + dark                       |
| [Heap](./heap/)             | light + dark                       |
| [Claude](./claude/)         | light + dark                       |
| [Ocean](./ocean/)           | light + dark                       |
| [Qlik](./qlik/)             | light + dark · ships Source Sans 3 |
| [Salesforce](./salesforce/) | light + dark                       |
| [Snowflake](./snowflake/)   | light + dark                       |

## Use a theme

1. **Copy the folder**, e.g. `themes/ocean/` into `src/themes/ocean/` in your app.
2. **Import its stylesheets** after the token engine — a family that ships its own
   typeface has a `<slug>-fonts.css` too; import it first (it only registers the
   `@font-face`s, the scheme files select them):

   ```ts
   import "@elabs-ai/components-tokens/styles.css";
   import "./themes/qlik/qlik-fonts.css"; // only families that ship a face
   import "./themes/ocean/ocean-light.css";
   import "./themes/ocean/ocean-dark.css";
   ```

3. **Register the family** on the provider:

   ```tsx
   import { ThemeProvider } from "@elabs-ai/components-tokens";
   import { oceanThemes } from "./themes/ocean/theme";

   // Only Ocean (replaces the default themes):
   <ThemeProvider themes={oceanThemes} defaultTheme="ocean-light">

   // Default + Ocean — the theme switcher then offers a Theme and a Mode choice:
   <ThemeProvider themes={[...BUILT_IN_THEME_DEFINITIONS, ...oceanThemes]}>
   ```

4. **Required for any dark variant: extend Tailwind's `dark:` variant.** The engine's
   `dark:` variant knows only the built-in `dark` theme, and a few library components
   still use `dark:` classes. Without this line they keep their light styling under
   `ocean-dark`. Add it to your Tailwind CSS entry, after the token engine import:

   ```css
   @custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *, [data-theme="ocean-dark"], [data-theme="ocean-dark"] *));
   ```

   List every dark variant you register. Storybook does this for you (`pnpm gen`).

## Give a theme its own logo

Every `BrandLogo` and `AppIcon` shows a built-in demo mark. A theme replaces it by setting
three tokens in its stylesheet; nothing else changes and no code is needed:

```css
--brand-logo-mark: url("data:image/svg+xml,…"); /* square mark */
--brand-logo-lockup: url("data:image/svg+xml,…"); /* mark + wordmark */
--brand-logo-lockup-aspect: 2.3813; /* lockup width ÷ height — also switches the demo mark off */
```

Set all three together, or all three to `initial` to keep the demo mark. The images carry
their own colours, so give each mode its own colourway (the Qlik family does). Pass
`title="Your product"` to the logo so screen readers announce the right name.

## Ship a typeface with a theme

A family may vendor its own face: put the `.woff2` files under `fonts/<face>/` and register
them in `<slug>-fonts.css` — `@font-face` rules only, `url("./fonts/<face>/…")` paths,
no `[data-theme]` block. The scheme files then name the face in `--font-sans` /
`--font-display`. `pnpm check --rule community-themes` verifies every referenced file exists and
`pnpm gen` wires the fonts file into Storybook. Themes need no entry in `ATTRIBUTION.md`.
See [Qlik](./qlik/).

## Change the shape of controls, not just their colour

Every theme carries these tokens. Their defaults match the built-in look, so change only
the ones your brand needs:

| Token                                                                                                                                  | What it changes                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--control-size`                                                                                                                       | Button, input, select and toggle height, counted in spacing steps (`9` = 36 px, `8` = 32 px) so the density setting still shrinks them. Small and large sizes are one step either side.                                                                                                           |
| `--control-radius`, `--control-weight`                                                                                                 | Corner radius and label weight of those controls and of tab labels.                                                                                                                                                                                                                               |
| `--input-background`, `--input-shadow`                                                                                                 | The ground and resting shadow of text fields and select triggers (`none` for flat fields).                                                                                                                                                                                                        |
| `--primary-hover`, `--primary-active` (and `--destructive-*`)                                                                          | Filled-button hover and pressed colours. Set solid colours to darken on interaction.                                                                                                                                                                                                              |
| `--link`                                                                                                                               | Hyperlink colour, when links should not use the brand colour.                                                                                                                                                                                                                                     |
| `--overlay`, `--overlay-blur`                                                                                                          | The curtain behind dialogs and sheets.                                                                                                                                                                                                                                                            |
| `--table-header-weight`, `--table-stripe`, `--table-row-hover`, `--table-row-rule-width`                                               | Data table header weight, zebra stripe, row hover, and a row hairline. To swap stripes for lines, set the stripe to `transparent` and the rule width to `1px`.                                                                                                                                    |
| `--icon-stroke`                                                                                                                        | Line-icon stroke width.                                                                                                                                                                                                                                                                           |
| `--header-size`                                                                                                                        | Top bar height in spacing steps (`14` = 56 px).                                                                                                                                                                                                                                                   |
| `--shadow-color`, `--shadow-strength`                                                                                                  | The ink every shadow is mixed from, and how strong it is (default `1` light, `2.2` dark; `0` = no shadows). Around `0.4` gives flat UI where menus still float.                                                                                                                                   |
| `--shadow-ring-color`                                                                                                                  | The 1 px edge that menus, popovers and dialogs draw instead of a border. Shadow strength does not dim it, so a shadowless theme keeps its edges. It paints over the page behind, so dark themes need a higher alpha: default `oklch(0 0 0 / 0.05)` light, `oklch(1 0 0 / 0.18)` dark.             |
| `--rule`, `--rule-strong`                                                                                                              | Drawn-line ink for `border-rule` / `border-rule-strong`, and the edge floating surfaces keep when decoration is 8–10 and shadows switch off. Default: quiet neutrals (`--rule` equals `--border` in the light theme).                                                                             |
| `--chart-grid`                                                                                                                         | Chart furniture: grid lines, axis rules, drop lines, network edges, tree links. Keep it its own colour, never `var(--border)`: these lines are thinner than 1 px, so they need more contrast than a UI hairline (the light theme's is about 2.3:1 on white).                                      |
| `--chart-foreground-muted`                                                                                                             | Secondary chart ink: category labels, a chart card's source line, zero baselines, leader lines and comparison series. Default `var(--muted-foreground)`.                                                                                                                                          |
| `--sidebar-indicator`, `--sidebar-indicator-width`, `--sidebar-indicator-radius`, `--sidebar-indicator-inset`                          | The bar on the active nav row: colour (`var(--sidebar-primary)`), width (`0.25rem`; `0` = no bar, pill only), corners (`9999px`; `0` = square) and top/bottom inset (`0.375rem`). The active icon keeps `--sidebar-primary` either way.                                                           |
| `--shell-secondary-width`                                                                                                              | Width of the app shell's second panel beside the nav (default `16rem`).                                                                                                                                                                                                                           |
| `--button-outline-border`, `--secondary-border`, `--secondary-text`                                                                    | Button edges: the outline button's border (`var(--input)`, now separate from text fields), the secondary button's edge (`transparent`; e.g. `var(--border)` for a bordered neutral button) and its label colour (`var(--secondary-foreground)`; e.g. `var(--primary-text)`).                      |
| `--table-header-background`, `--table-header-foreground`, `--table-header-size`, `--table-header-transform`, `--table-header-tracking` | Table header row: fill (`transparent`), ink (`var(--muted-foreground)`), size (`1em` = the table's body size), case (`none`; `uppercase` for caps labels) and letter spacing (`var(--type-tracking-body)`; e.g. `0.04em` with caps).                                                              |
| `--card-shadow`, `--card-border`                                                                                                       | A card's resting shadow (`var(--shadow-sm)`; `none` for flat hairline cards) and edge (`var(--border)`). Separate from menus and dialogs, so cards can go flat while menus still float.                                                                                                           |
| `--card-title-leading`                                                                                                                 | Card title line height, without a unit (default `1`; e.g. `1.5`).                                                                                                                                                                                                                                 |
| `--popover-shadow`, `--dialog-shadow`                                                                                                  | Elevation of menus and popovers (`var(--shadow-ring-md)`) and of dialogs (`var(--shadow-ring-lg)`). Pick a `shadow-ring-*` rung so the edge stays.                                                                                                                                                |
| `--badge-radius`, `--badge-appearance`                                                                                                 | Badge corners (`9999px`; e.g. `var(--radius)` for square chips) and the look a badge takes when the code sets none: `auto` (default, each variant's own), `tint`, `solid`, `outline` or `neutral`. Set it in the theme block or on a region, never on the badge itself.                           |
| `--tabs-variant`, `--tabs-indicator-width`, `--tabs-active-weight`                                                                     | Tab style when the code sets none (`segmented` default, or `underline`), the underline's thickness (`2px`) and the active tab's weight (`var(--control-weight)`; e.g. `600`).                                                                                                                     |
| `--focus-ring-width`, `--focus-ring-offset`, `--input-focus-border`                                                                    | Focus ring width (`2px`) and offset (`0px`; positive opens a gap, negative pulls the ring inside the edge, down to minus the width for a fully inset ring — always give a unit), and a text field's border on focus (`var(--input)` = unchanged; `var(--ring)` = the edge takes the ring colour). |
| `--icon-fill`                                                                                                                          | Icon glyph set: `outline` (default) or `solid`. `solid` swaps in a filled glyph where a brand icon has one; Lucide icons stay outlined.                                                                                                                                                           |
| `--selection`, `--selection-foreground`, `--selection-muted`                                                                           | Selected rows in the data table, table and tree: fill (`var(--accent)`) and ink (`var(--accent-foreground)`; the tree paints it, table rows keep their own). `--selection-muted` (`--accent` at 50%) is reserved for a quieter related state; no component paints it yet.                         |

A theme may also redeclare the type scale — `--type-size-<role>`, `--type-leading-<role>`,
`--type-weight-<role>`, `--type-tracking-<role>` for any role the engine defines, including
`heading-xs` for small semibold labels — to retune headings for its typeface. The density
setting still scales sizes from your values.

## Families and modes

`theme.ts` gives every variant the same `family` and its own `dark` flag:

```ts
defineTheme({ value: "ocean-dark", label: "Ocean Dark", dark: true, family: "ocean" });
```

Nothing is inferred from the file or theme name. When two or more families are registered,
`ThemeSwitcher` shows a **Theme** group and, if the active family has both modes, a
**Mode** group (Light / Dark / System). A family with only one mode shows no mode choice.
In code, use `useTheme()`: `families`, `family`, `colorScheme`, `setFamily`, `setColorScheme`.

## Create a theme (contributors)

```sh
pnpm theme:new forest --label "Forest" --hue 150      # light + dark
pnpm theme:new dusk --label "Dusk" --only dark        # one mode only
pnpm theme:new slate --label "Slate" --preset flat    # flatter, denser shape
```

This copies the current default themes into `themes/<slug>/`. It renames the selectors and
tints the brand and neutral colours toward `--hue`, leaving status colours alone.

`--preset flat` starts from the shape most business apps share, which is flatter and denser
than the default. It changes shape tokens only, never colours:

| Token                                      | Flat value                          |
| ------------------------------------------ | ----------------------------------- |
| `--card-shadow` (`--card-border` stays)    | `none`                              |
| `--radius-base`, `--control-radius`        | `0.25rem`, `var(--radius)` (4 px)   |
| `--control-size`                           | `8` (32 px)                         |
| `--header-size`                            | `12` (48 px)                        |
| `--input-shadow`                           | `none`                              |
| `--table-stripe`, `--table-row-rule-width` | `transparent`, `1px` (row lines)    |
| `--tabs-variant`                           | `underline`                         |
| `--icon-stroke`                            | `1.5`                               |
| `--shadow-strength`                        | `0.4` light, `1` dark (menus float) |

Then:

1. Edit the colour values in the `.css` files (`oklch()`).
2. `pnpm check --rule community-themes` — every token must be present, and body text must be
   readable (WCAG AA 4.5:1) in each mode.
3. `pnpm gen` — adds the family to the Storybook theme picker so you can preview it on
   real components.
4. Add a row to the family table at the top of this file.

Folders starting with `_` or `.` are ignored.
