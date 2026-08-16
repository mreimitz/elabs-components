# Browser support

The floor brand-ui is built and validated against, and what happens below it.

There is deliberately **no `browserslist` config** in this repo: nothing here is
transpiled for older engines. The support floor is a **CSS** question — the
components are plain React and TypeScript compiled to modern ES, while the visual
system is a stylesheet whose newest features decide how far back it renders.

## The floor

| Engine      | Minimum | Why that version                                      |
| ----------- | ------- | ----------------------------------------------------- |
| Chrome/Edge | 119     | relative color syntax — `oklch(from … l c h / α)`     |
| Safari      | 16.4    | relative color syntax, `@property`                    |
| Firefox     | 128     | relative color syntax (`@property` landed in 128 too) |

Below the floor the **color system still works** — every semantic token is a
plain `oklch()` literal, which is Baseline-wide (Chrome 111, Safari 15.4,
Firefox 113) and the same generation as the CSS nesting and `:is()`/`:has()`
Tailwind v4 emits. What degrades is the **decoration dial**, and it degrades to
"off" rather than to something broken (see below).

Tailwind CSS v4 states its own floor as Safari 16.4 / Chrome 111 / Firefox 128,
so brand-ui's floor is Tailwind's floor plus relative color syntax in Chrome.

## What actually depends on the floor

Two features, both in `packages/tokens/src/themes.css`, both belonging to the
`--decoration` dial:

1. **Relative color syntax** — the four decoration inks derive their hue from the
   active theme's `--foreground` and their alpha from the dial:

   ```css
   --bp-grid-ink: oklch(from var(--foreground) l c h / calc(var(--decoration-factor) * 0.1));
   ```

   This is what makes the reprographic texture hue-independent: the grid re-tints
   itself per theme instead of shipping a per-palette ink.

2. **`@property --decoration`** — registering the dial as `<number>` is what lets
   it be `calc()`'d into alphas and lengths. An unregistered custom property is
   substituted as a string and cannot drive a gradient stop.

Everything else — the token themes, `@layer`, `:is()`/`:not()`, `color-scheme`,
the mask-based ground fade, `background-attachment` gating — is older than the
floor.

## Degradation below the floor

A custom property accepts any token stream at parse time, so a browser without
relative color syntax happily stores `oklch(from …)` and only fails later, when
the value is substituted into a gradient. That is "invalid at computed-value
time" — an unpredictable surprise, not a designed fallback.

So the degradation is pinned explicitly in `themes.css`:

```css
@supports not (color: oklch(from red l c h)) {
  :root {
    --bp-grid-ink: transparent;
    /* …the other inks… */
    --bp-grid: none;
    --bp-hatch: none;
    --bp-hatch-strong: none;
  }
}
```

Result below the floor: **no graph paper, no hatch, no ground fade** — the full
themed UI in its own colors, minus the reprographic texture. The blueprint theme
keeps its navy cyanotype palette and loses its drawing texture; the binary
decoration axes (drawn-not-filled controls, squared corners, shadowless surfaces)
are plain selectors and still apply. `@property` failing to register only means
`--decoration` stops interpolating; with the inks already neutralized, nothing
depends on it.

Verified by `pnpm decoration:check` (`scripts/check-decoration-css.mjs`), which
fails if the inks are ever declared without that `@supports` fallback.

## Touch devices

`background-attachment: fixed` — what makes the decoration grid read as one
continuous sheet the panels are cut out of — is applied **only** under
`@media (hover: hover) and (pointer: fine)`. A fixed layer cannot be composited
with scrolled content, so on touch it repaints the viewport every frame (and iOS
Safari ignores it inside scroll containers anyway). Touch devices keep the grid;
it scrolls with the element instead of the viewport. The same gate enforces this.

## Not covered here

- **Node**: see `engines` in the root `package.json` for the build/tooling floor.
- **React**: 18.2 or 19, declared as a peer dependency by every package.
- **Screen readers / assistive tech**: see
  [`.claude/rules/accessibility.md`](../.claude/rules/accessibility.md).
