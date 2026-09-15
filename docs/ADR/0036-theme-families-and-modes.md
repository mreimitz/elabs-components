# ADR 0036 — Theme families and colour schemes: grouping metadata over the open registry

- **Status:** Proposed
- **Date:** 2026-09-15
- **Deciders:** `brand-ui-design-system-architect` (structural / public-API change to
  `@elabs-ai/components-tokens` and `ThemeSwitcher`, per `.claude/rules/quality-gates.md`)
- **Extends:** ADR [0029](./0029-open-theme-registry.md) — the registry stays a flat list of
  `ThemeDefinition`s and `data-theme` stays one name per variant; this ADR adds a grouping
  _derived_ from that list. Nothing in 0029 is reversed.
- **Related:** ADR [0031](./0031-runtime-token-overrides.md) (overrides are orthogonal to which
  variant is active, so they survive a family or scheme change exactly as they survive
  `setTheme`), `.claude/rules/theming.md`, `.claude/rules/component-api.md` § Composition patterns

## Context

Two reference themes ship: `light` and `dark`. They are independent registry entries, linked only
by their `dark` flag. The maintainer wants a repo `themes/` folder of downloadable themes that
people use _instead of_ the defaults, and reframed what a theme is: a **family** (Default, Ocean, …)
with up to two **colour schemes** (light, dark). A family may ship only one scheme, in which case no
scheme switch is offered. The maintainer chose to put this model in the library
(`ThemeProvider` / `ThemeSwitcher`), not only in Storybook.

Constraints that shape the decision:

- Every gate (`theme-parity`, `token-contract`, `roles`, `audit-artifact`), every `[data-theme]`
  selector, `@custom-variant dark`, the storybook-mcp `theme:<slug>` globals and every consumer's
  persisted `brand-ui-theme` value key off a single variant name.
- ADR 0029 forbids deciding anything from a theme's _name_. A family cannot be inferred from
  `ocean-dark` by string convention; it has to be declared.
- Existing consumers already register custom themes with no notion of a family, including pairs
  (`daylight` / `midnight`) that today render as a light/dark toggle.

## Decision

**A family is optional metadata on a `ThemeDefinition`. Families and the active scheme are
derived, never stored. `data-theme`, persistence and `setTheme` are unchanged.**

### 1. Types (`theme-types.ts`)

```ts
export type ThemeScheme = "light" | "dark";

export interface ThemeDefinition {
  // …existing fields unchanged
  /** Family id shared by a theme's light and dark variants. Omitted ⇒ `value` is the family id. */
  family?: string;
  /** Switcher label for the family. First definition in registry order that sets it wins. */
  familyLabel?: string;
}

export interface ThemeFamily {
  id: string;
  /** `familyLabel` ?? (undeclared family: the definition's `label`) ?? `id`. */
  label: string;
  light?: ThemeDefinition;
  dark?: ThemeDefinition;
  /** Schemes present, light first. Length 1 ⇒ single-scheme family (no scheme switch). */
  schemes: readonly ThemeScheme[];
  /** True when at least one member set `family` explicitly. */
  declared: boolean;
}

export function themeSchemeOf(def: Pick<ThemeDefinition, "dark">): ThemeScheme;
export function themeFamilyIdOf(def: Pick<ThemeDefinition, "value" | "family">): string;
export function groupThemeFamilies(defs: readonly ThemeDefinition[]): readonly ThemeFamily[];
export function resolveThemeVariant(
  families: readonly ThemeFamily[],
  familyId: string,
  scheme: ThemeScheme,
): ThemeName | undefined; // the requested scheme, else the family's only/first scheme
```

`BUILT_IN_THEME_META.light` / `.dark` gain `family: "default"`, `familyLabel: "Default"`.
`BUILT_IN_THEMES`, `BuiltInThemeName`, `isBuiltInThemeName` and `resolveThemeIsDark` do not
change. Downloadable themes are **never** added to `BUILT_IN_THEMES`.

A family's scheme comes from the registry `dark` flag, which ADR 0029 §3 already designates as the
switcher-facing fact. Asset swaps keep calling `resolveThemeIsDark` (the CSS fact).

### 2. Grouping rules (`groupThemeFamilies`)

- Order = first appearance of each family id in registry order (so Default stays first when the
  built-ins are spread first).
- **Undeclared definition** ⇒ family id = its `value`. It therefore joins a declared family of the
  same id if one exists; otherwise it is a single-scheme family.
- **Two members with the same scheme** ⇒ the first in registry order fills the slot; the later one
  is still registered and reachable via `setTheme`, but not via `setFamily`/`setColorScheme`. Dev
  warning from the provider.
- **Conflicting `familyLabel`s** ⇒ first wins; dev warning.
- Grouping runs over whatever list it is given. The provider groups its **narrowed**
  `themeDefinitions` (after `allowedThemes`); `ThemeSwitcher` groups its own `offered` list (after
  its `themes` prop). An `allowedThemes` that drops `ocean-dark` makes Ocean single-scheme there.

### 3. `ThemeProvider` context (additive)

```ts
interface ThemeContextValue {
  // …existing fields unchanged (theme, themes, themeDefinitions, setTheme, …)
  families: readonly ThemeFamily[];
  /** Family id of the active theme; `theme` itself while the active theme is unregistered. */
  family: string;
  /** Scheme of the active theme; `undefined` only while the active theme is unregistered. */
  colorScheme: ThemeScheme | undefined;
  /** Switch family, keeping the intended scheme when the family has it. Unknown id: dev-warn no-op. */
  setFamily: (familyId: string) => void;
  /** Switch scheme within the active family. Scheme absent in the family: dev-warn no-op. */
  setColorScheme: (scheme: ThemeScheme) => void;
}
```

- Both setters resolve a variant and delegate to `setTheme`, so allow-list validation, persistence
  and the `data-theme` write stay in exactly one code path.
- **Intended scheme.** The provider keeps the last scheme chosen through `setTheme` or
  `setColorScheme` in memory. `setFamily` resolves against it, so Default-dark → a light-only
  family → Ocean lands on `ocean-dark`, not `ocean-light`. It is not persisted; after a reload the
  intended scheme is the persisted variant's scheme.
- `registryKey` must include `family` and `familyLabel`, or an inline registry that only changes
  grouping would not recompute.
- **No new props.** No `defaultFamily` (use `defaultTheme="ocean-light"`), no new storage key.

### 4. Persistence and SSR

Unchanged by construction. The persisted value is still one variant name under `brand-ui-theme`;
the mount-pass rejection of an unregistered name still happens before any `data-theme` write.
`family` and `colorScheme` are pure derivations of `theme`, which the server and the first client
render both initialise from `defaultTheme`, so the family UI cannot cause a hydration mismatch.
The existing first-paint flash for a persisted non-default theme (the hydrate-in-`useEffect`
behaviour) is neither fixed nor worsened.

A persisted variant that is no longer registered falls back to `defaultTheme`, **not** to a sibling
in "its" family: an unregistered name has no definition, so its family is unknowable without
parsing the name, which ADR 0029 rules out.

### 5. `ThemeSwitcher`

- **Layout selection under `mode="auto"`:** the family layout is used only when the offered list
  groups into **two or more declared families**. Otherwise the current flat toggle (≤2) /
  dropdown (>2) behaviour is kept byte-for-byte. `mode="toggle"` and `mode="dropdown"` still force
  the flat layouts. No new prop and no new `mode` value.
- **Family layout:** one trigger button (the ref target), one menu: a `DropdownMenuRadioGroup` of
  families and, when the active family has two schemes, a second radio group of Light / Dark /
  System. Single-scheme family ⇒ the scheme group is not rendered.
- **System is scoped to the active family.** `pickByDarkness` runs over the active family's members;
  on a family change while System is active the switcher re-resolves with `prefersDark()` instead of
  waiting for the next OS `change` event. A single-scheme family ignores System (it has one answer).
- The controlled `preference` / `onPreferenceChange` contract (#366) is unchanged: a preference is a
  variant name or `"system"`.

### 6. Why this preserves existing apps

| Existing setup                              | Before                    | After                                            |
| ------------------------------------------- | ------------------------- | ------------------------------------------------ |
| Default provider                            | light/dark/System toggle  | identical (one declared family)                  |
| `[...BUILT_IN_THEME_DEFINITIONS, midnight]` | flat dropdown of three    | identical (one declared family + one undeclared) |
| `[daylight, midnight]`, no `family`         | light/dark toggle         | identical (zero declared families)               |
| Two or more families with `family` set      | n/a (field did not exist) | family layout                                    |

## Alternatives considered

| Option                                                                                                                   | Why not                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`data-theme="ocean"` + `data-scheme="dark"` (two attributes)**                                                         | Rewrites every theme block selector, `@custom-variant dark`, every gate, every persisted value and the Storybook `theme:<slug>` contract. Large break for a grouping that metadata expresses.                                                                        |
| **A `ThemeFamilyDefinition { id, label, light?, dark? }` registry replacing `ThemeDefinition[]`**                        | Cleaner shape, but a second registry type means `themes` either changes type (break) or accepts a union (every internal path branches). Flat definitions + a derived `ThemeFamily` gives the same shape to readers without changing the input.                       |
| **Infer family from a `<slug>-light` / `<slug>-dark` naming convention**                                                 | A name lookup, which ADR 0029 exists to remove; breaks silently for `daylight` / `midnight`.                                                                                                                                                                         |
| **Missing `family` ⇒ every undeclared theme is its own family, family layout whenever families > 1** (the original plan) | Turns an existing `[daylight, midnight]` toggle into a two-family menu with no scheme switch and a broken System. Breaks existing apps.                                                                                                                              |
| **Context fields named `mode` / `setMode`**                                                                              | `ThemeSwitcherProps.mode` already means toggle-vs-dropdown. Two meanings of `mode` one import apart is exactly the ambiguity an agent guesses wrong. `colorScheme` names the CSS property that already defines darkness (ADR 0029 §3). UI copy may still say "Mode". |
| **Persist family and scheme separately**                                                                                 | Two keys that can disagree with the one that renders, and a new flash surface. The variant name already encodes both.                                                                                                                                                |

## Consequences

**Better.** A downloaded theme is a `theme.ts` with `family` set plus one or two CSS files; the
switcher offers family + scheme with no consumer code. Single-scheme families are first-class.
Every existing gate, selector, persisted value and consumer keeps working.

**Worse.** Family and scheme are only as correct as the `family` and `dark` fields: a
`theme.ts` whose `dark` disagrees with its CSS `color-scheme` groups wrongly. The downloadable
themes' gate must assert that agreement. Same-scheme duplicates are reachable only by `setTheme`.

**Watch for.**

- **`dark:` utilities still do not follow a downloaded dark theme** (ADR 0029, Watch for). The
  `themes/` README must repeat the `@custom-variant dark` redeclaration.
- **A name-based family lookup creeping in** (for fallback, Storybook back-compat, or the gate).
  Family comes from a definition, never a string split.
- **The switcher grouping the provider's `families` instead of its own `offered` list** — it would
  ignore the `themes` prop narrowing.
- **The family layout firing for an undeclared registry** — lock the three "identical" rows of §6
  in `theme-switcher.test.tsx`.

## References

- ADR [0029](./0029-open-theme-registry.md) · ADR [0031](./0031-runtime-token-overrides.md)
- `packages/tokens/src/theme-types.ts` · `packages/tokens/src/theme-provider.tsx`
- `packages/ui/src/components/theme-switcher/theme-switcher.tsx`
- `docs/CONSUMING.md` §5.1 · `.claude/rules/theming.md`
