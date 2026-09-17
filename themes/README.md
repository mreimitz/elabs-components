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

| Token                                                                                    | What it changes                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--control-size`                                                                         | Button, input, select and toggle height, counted in spacing steps (`9` = 36 px, `8` = 32 px) so the density setting still shrinks them. Small and large sizes are one step either side. |
| `--control-radius`, `--control-weight`                                                   | Corner radius and label weight of those controls and of tab labels.                                                                                                                     |
| `--input-background`, `--input-shadow`                                                   | The ground and resting shadow of text fields and select triggers (`none` for flat fields).                                                                                              |
| `--primary-hover`, `--primary-active` (and `--destructive-*`)                            | Filled-button hover and pressed colours. Set solid colours to darken on interaction.                                                                                                    |
| `--link`                                                                                 | Hyperlink colour, when links should not use the brand colour.                                                                                                                           |
| `--overlay`, `--overlay-blur`                                                            | The curtain behind dialogs and sheets.                                                                                                                                                  |
| `--table-header-weight`, `--table-stripe`, `--table-row-hover`, `--table-row-rule-width` | Data table header weight, zebra stripe, row hover, and a row hairline. To swap stripes for lines, set the stripe to `transparent` and the rule width to `1px`.                          |
| `--icon-stroke`                                                                          | Line-icon stroke width.                                                                                                                                                                 |
| `--header-size`                                                                          | Top bar height in spacing steps (`14` = 56 px).                                                                                                                                         |

A theme may also redeclare the type scale — `--type-size-<role>`, `--type-leading-<role>`,
`--type-weight-<role>`, `--type-tracking-<role>` for any role the engine defines — to retune
headings for its typeface. The density setting still scales sizes from your values.

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
```

This copies the current default themes into `themes/<slug>/`. It renames the selectors and
tints the brand and neutral colours toward `--hue`, leaving status colours alone. Then:

1. Edit the colour values in the `.css` files (`oklch()`).
2. `pnpm check --rule community-themes` — every token must be present, and body text must be
   readable (WCAG AA 4.5:1) in each mode.
3. `pnpm gen` — adds the family to the Storybook theme picker so you can preview it on
   real components.
4. Add a row to the table above.

Folders starting with `_` or `.` are ignored.
