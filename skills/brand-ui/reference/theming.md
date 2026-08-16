# brand-ui — theming

## Mechanism

- A theme is a `[data-theme="<name>"]` block overriding the full semantic token
  set (surfaces, sidebar, canvas/flow, chat, chart-1..5, radius) — and the set of
  themes is **open**: `ThemeName` is `string`, so a theme can come from this
  package or from your own app (ADR 0029).
- `@elabs-ai/components-tokens/styles.css` is the engine: Tailwind bridge, the
  `:root` neutral light base (a complete palette on its own), the dials.
- The two **reference** themes are opt-in stylesheets —
  `@elabs-ai/components-tokens/themes/light.css` and `.../dark.css`. `styles.css`
  does not import them. `light` is the default; confirm the live set with
  `brand-ui info`.
- `ThemeProvider` (from `@elabs-ai/components-tokens`) writes `data-theme` and persists the
  choice; `useTheme()` reads/sets it and returns `themeDefinitions` for rendering
  a switcher.

## Setup (once, at the app root)

```css
@import "@elabs-ai/components-tokens/styles.css";
@import "@elabs-ai/components-tokens/themes/light.css";
@import "@elabs-ai/components-tokens/themes/dark.css";
```

```tsx
import { ThemeProvider } from "@elabs-ai/components-tokens";

export function App() {
  return <ThemeProvider defaultTheme="light">{/* app */}</ThemeProvider>;
}
```

## Using tokens

Reference tokens through Tailwind utilities — never literals:

`bg-background` `text-foreground` `text-muted-foreground` `bg-card`
`bg-primary text-primary-foreground` `bg-secondary` `bg-accent` `bg-destructive`
`border-border` `ring-ring` `bg-surface` `bg-sidebar` `--chart-1..5` (data viz).

Run `brand-ui info` for the full token list, or read the `:root` block in
`themes.css`.

## Re-branding / a new theme

Re-branding is a **token change, not a component change**. In YOUR app: write a
`[data-theme="acme"]` block that overrides every token (assert coverage against
the exported `THEME_TOKEN_NAMES`), declare `color-scheme: light|dark` on it, and
register it:

```tsx
import { BUILT_IN_THEME_DEFINITIONS, defineTheme, ThemeProvider } from "@elabs-ai/components-tokens";

const acme = defineTheme({ value: "acme", label: "Acme", dark: false });

<ThemeProvider themes={[...BUILT_IN_THEME_DEFINITIONS, acme]} defaultTheme="acme">
```

The `themes` prop **replaces** the registry, so spread the built-ins to keep
them — or omit them to ship only your own. Full recipe: `docs/CONSUMING.md` §5.1.
Shipping a theme FROM the package instead is the maintainer flow — the
`brand-ui-theme` skill / `/new-theme`.

## Radius

Corner rounding is the single `--radius` token (currently `0.25rem`); `rounded-sm/md/lg/xl`
derive from it via `@theme inline`. Squaring or softening the whole system is a
one-token change per theme — don't hardcode `rounded-[Npx]` in components.

## Contrast

Body text must meet WCAG AA (4.5:1), UI 3:1, in **every** theme. The
`brand-ui-audit` skill measures rendered contrast across all themes (oklch-aware).
Watch the brand hue as small text on a light surface, and the `*-foreground` ink
on filled brand plates — verify with the audit rather than assuming.
