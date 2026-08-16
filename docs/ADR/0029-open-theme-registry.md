# ADR 0029 — Theming is open: a theme registry, not a closed union

- **Status:** Accepted
- **Date:** 2026-08-16
- **Extends:** ADR [0003](./0003-theming-model.md) — the `data-theme` + semantic-token
  mechanism is unchanged; what changes is who is allowed to author a theme.

## Context

ADR 0003 established the mechanism: a theme is a `[data-theme="<name>"]` block in
`themes.css` that overrides every semantic token, applied by `ThemeProvider` and
consumed through Tailwind's `@theme inline` map. That part works, and it is not
what this ADR revisits.

What it revisits is that the mechanism was **closed by construction**. Every
piece of the surface hard-coded the set of themes this package happens to ship:

- `ThemeName` was a union derived from a `THEMES` tuple, so a consumer theme was
  not a `ThemeName` at all — it needed a cast at every call site.
- `THEME_META` was a `Record<ThemeName, …>`, so `THEME_META[theme]` was a
  **crash** for any name the package had not heard of. `ThemeProvider` read
  `.decorationLevel` off exactly that expression.
- `ThemeSwitcher` defaulted to a hard-coded `["light","dark"]` pair with literal
  fallbacks — an app that registered its own themes got a switcher that could not
  reach them and that named themes the app may not ship.
- Darkness was a **registry lookup**. Anything that swaps an asset by darkness (a
  Monaco base, a map basemap flavour, an image) resolved an unregistered dark
  theme as _light_, silently.
- All theme blocks lived in one stylesheet inside the package.

So the only supported way to add a theme was to edit this package. That is
acceptable for an internal library with one owner; it is not acceptable for one
whose stated purpose is that every consumer brands it themselves. The two shipped
themes should be a worked **example**, not the menu.

## Decision

**A theme is anything with a `[data-theme]` block that covers the token contract.
The set of themes is a runtime registry owned by the consumer's `ThemeProvider`,
not a compile-time union owned by this package.**

### 1. `ThemeName` is `string`

The union is gone. There is deliberately **no `isThemeName` guard** to replace it
— "is this a string" is not a useful check. Validation is registry-relative:
`useTheme().themes` at runtime, or `isBuiltInThemeName` when you specifically
mean one of the two reference themes.

The old names are renamed rather than widened, so nothing keeps its old meaning
under a new definition: `THEMES` → `BUILT_IN_THEMES`, `THEME_META` →
`BUILT_IN_THEME_META`, `ThemeMeta` → `ThemeDefinition`. `PAUSED_THEMES` is
unchanged and still governs @.claude/rules/paused-surfaces.md.

### 2. The registry is a `ThemeProvider` prop

```tsx
const midnight = defineTheme({ value: "midnight", label: "Midnight", dark: true });

<ThemeProvider themes={[...BUILT_IN_THEME_DEFINITIONS, midnight]} defaultTheme="midnight">
```

- `themes` **replaces** the default registry rather than extending it — so
  "ship none of the reference themes" is expressible. Spread
  `BUILT_IN_THEME_DEFINITIONS` to keep them.
- `allowedThemes` (#355) still works, now as a **filter over the registry**. It is
  the narrower of the two knobs and stays for the case it was built for: one
  registry, several products, each exposing a subset.
- Persisted-value validation, `setTheme`, and `defaultTheme` all resolve against
  the provider's registry. A persisted name that is no longer registered is
  rejected in the same mount pass that applies the theme, so it cannot flash.
- `effectiveDecoration` reads `decorationLevel` off the **active registry entry**,
  with an optional chain that is load-bearing rather than defensive: with an open
  registry the active theme can legitimately be absent from the registry for a
  render (a registry swap), and the old `THEME_META[theme].decorationLevel` threw
  there.
- `useTheme()` returns `themeDefinitions` alongside `themes`, so a switcher renders
  labels and darkness icons without importing anything module-level.
  `ThemeSwitcher` now renders from that context and has no hard-coded pair.

### 3. Darkness is a CSS fact, not a registry fact

```ts
resolveThemeIsDark(el?: Element | null): boolean;
```

Every theme block declares `color-scheme: light|dark`, and the property inherits.
So the resolution order is: **the computed `color-scheme`** on the element → the
built-in registry keyed off the nearest `data-theme` → `prefers-color-scheme` →
`false`.

Step 1 is what makes this work for a theme this package has never seen, and it is
also what lets a consumer **override** a built-in theme's darkness — CSS wins over
the table, because CSS is what renders. Step 2 exists because jsdom computes `""`
for `color-scheme` (no stylesheet applied), which correctly falls through instead
of reporting "light".

Every asset-swapping component calls this. A registry lookup is a hard-coded guess
about a name; the computed `color-scheme` is what the theme itself says.

### 4. The token contract is exported as data

"Every theme overrides every token" is the rule that makes an open registry safe —
a theme missing a token falls back to `:root` and usually renders wrong.
`pnpm theme-parity:check` enforces it for the themes in _this_ repo. A consumer's
theme lives in _their_ repo, where our gates cannot reach.

So the contract ships as data:

```ts
import { THEME_TOKEN_NAMES } from "@elabs/components-tokens";
```

`packages/tokens/scripts/gen-theme-token-names.mjs` derives it from the active
`[data-theme]` blocks in `themes.css` (root-only machinery excluded — the same
union `check-theme-parity.mjs` holds every block to) and writes
`src/theme-token-names.generated.ts`. `pnpm token-contract:check` fails CI when
that file is stale.

**Validating your theme** is then a test in the consumer's own repo: parse your
stylesheet, assert it declares every name in `THEME_TOKEN_NAMES`. No CSS parsing
in this package, and no copy of our list to go stale in yours.

`defineTheme` is an identity helper — author-time typing only. It deliberately
does **not** check that the CSS block exists or that the contract is covered:
that is a build-time property of a stylesheet, not a runtime property of an
object literal, and pretending otherwise would be the more dangerous half of a
half-guarantee.

## Alternatives considered

| Option                                                          | Why not                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Keep the union, add a `CustomThemeName` escape hatch**        | Every consumer theme still needs a cast, and `THEME_META[theme]` still throws. Half-open is the worst of both: the types claim a closure the runtime does not have.                                                                                                 |
| **Widen `ThemeName` but keep the registry lookup for darkness** | Passes typecheck, passes every switcher test, and still renders a light Monaco/basemap/toast inside a consumer's dark theme. This is the regression the `resolveThemeIsDark` tests are written to catch specifically.                                               |
| **A `registerTheme()` global side-effect registry**             | Order-dependent, invisible to React, impossible to scope to a region, and untestable in parallel. A prop is scoped, explicit and already how `allowedThemes` works.                                                                                                 |
| **A separate `@elabs/components-themes` package**               | The reference themes are two CSS blocks and two descriptors. A package boundary for that adds a version to keep in lockstep and a dependency edge, for no consumer benefit. Subpath exports of the tokens package cover it (ADR [0006](./0006-subpath-exports.md)). |
| **Runtime validation of the token contract in `defineTheme`**   | Would need computed styles for every token at mount, in every environment including SSR and jsdom. Exporting the contract lets the consumer assert it once, statically, where it is cheap.                                                                          |

## Consequences

**Better.** A consumer authors a theme in their own repo, registers it with one
prop, and every component in every package themes correctly — including asset
swaps, which now read the theme's own `color-scheme`. Shipping zero built-in
themes is expressible. The switcher can no longer name a theme the app does not
ship.

**Worse.** `ThemeName = string` means typos are no longer compile errors. That is
the direct, intended cost of openness; the mitigation is that the _registry_ is
still typed and every runtime path validates against it (`setTheme` with an
unregistered name is a warn-and-no-op in dev, not a silent apply).

**Watch for.**

- **A registry lookup creeping back in.** Anything that decides light-vs-dark by
  comparing a name against a list is the bug this ADR exists to remove. Call
  `resolveThemeIsDark`.
- **A vacuous contract.** If the block extraction ever matches nothing,
  `THEME_TOKEN_NAMES` would be empty and _every_ consumer's coverage assertion
  would pass against it. The generator refuses to write an empty contract, and
  both its self-test and `theme-registry.test.ts` assert the list is substantial.
  Keep both halves.
- **`dark:` utilities do NOT follow a consumer theme.** `themes.css` declares
  `@custom-variant dark` against a literal selector list of the themes shipped
  here. Tailwind compiles that list at build time, so — unlike
  `resolveThemeIsDark`, which reads a runtime CSS fact — it cannot open. A
  consumer's dark theme therefore gets correct semantic tokens but no `dark:`
  overrides; their fix is to redeclare `@custom-variant dark` in their own CSS
  with their theme added. This is the concrete reason component source must
  reach for semantic tokens rather than `dark:`.
- **`attributeTarget` with a callback ref.** `ThemeProvider` applies the theme in
  a mount-once effect, and a callback ref is `null` on the first render — so a
  region-scoped provider whose target comes from `ref={setTarget}` never receives
  the theme, and it lands on `<html>` instead. The documented workaround is a
  two-pass render (`{target ? <ThemeProvider … /> : null}`), used by the
  **Bring your own theme** story. This is a real sharp edge in the library, not a
  property of the open registry; it predates this ADR and is unfixed.

## References

- ADR [0003](./0003-theming-model.md) — the `data-theme` + semantic-token mechanism
- ADR [0006](./0006-subpath-exports.md) — the gate a reference-theme subpath clears
- ADR [0027](./0027-focus-ring-token-contract.md) — what a theme's `--ring` must satisfy
- @.claude/rules/theming.md · @.claude/rules/paused-surfaces.md
- `packages/tokens/src/theme-types.ts` · `theme-provider.tsx` ·
  `scripts/gen-theme-token-names.mjs`
- Tests: `theme-registry.test.ts` · `theme-provider.test.tsx` ·
  `gen-theme-token-names.test.mjs` ·
  `packages/ui/src/components/theme-switcher/theme-switcher.test.tsx`
- Story: `Foundations/Theming → Bring your own theme`
