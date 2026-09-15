# Theme families

Downloadable themes for brand-ui. Each folder is one **theme family**. A family has a
light version, a dark version, or both, and you can use it instead of the default themes
or alongside them.

These themes are not published with the npm packages. To use one, copy its folder into
your app.

| Family            | Modes        |
| ----------------- | ------------ |
| [Ocean](./ocean/) | light + dark |
| [Qlik](./qlik/)   | light + dark |

## Use a theme

1. **Copy the folder**, e.g. `themes/ocean/` into `src/themes/ocean/` in your app.
2. **Import its stylesheets** after the token engine:

   ```ts
   import "@elabs-ai/components-tokens/styles.css";
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
2. `pnpm community-themes:check` — every token must be present, and body text must be
   readable (WCAG AA 4.5:1) in each mode.
3. `pnpm gen` — adds the family to the Storybook theme picker so you can preview it on
   real components.
4. Add a row to the table above.

Folders starting with `_` or `.` are ignored.
