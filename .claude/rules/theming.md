# Theming

Theming is OPEN (`docs/ADR/0029-open-theme-registry.md`): `ThemeName` is `string`; any
`[data-theme="name"]` block covering the token contract, registered on `ThemeProvider`, is a
theme. `:root` is the complete light fallback.

- CSS: `packages/tokens/src/themes.css` is the engine; reference themes are opt-in
  `src/themes/light.css` / `dark.css` → `@elabs-ai/components-tokens/themes/<name>.css`
  (`styles.css` imports none). Anything parsing theme blocks reads the SET, never one file:
  `readThemesCss()` (`scripts/lib/theme-sources.mjs`), `readThemeCss()`
  (`packages/tokens/src/_theme-css-source.ts`), `themeSourcePaths()`
  (`packages/tokens/scripts/lib/themes-io.mjs`).
- All three are GENERATED from the DTCG source (`packages/tokens/tokens/`): author values there,
  run `tokens:build` (`packages/tokens`); `pnpm tokens:check` fails a hand-edited CSS value;
  `var()` aliases round-trip (`isInScope()` in `themes-io.mjs` takes `oklch()` and `var(--…)`).
- `ThemeProvider` writes + persists `data-theme`; `useTheme()` reads/sets it. Reference themes
  `light` (default), `dark`: `BUILT_IN_THEMES` / `BUILT_IN_THEME_META` /
  `BUILT_IN_THEME_DEFINITIONS` / `DEFAULT_THEME` in `theme-types.ts`.
- Consumer theme: `<ThemeProvider themes={[...BUILT_IN_THEME_DEFINITIONS, defineTheme({…})]}>`
  — the prop REPLACES the registry; spread the built-ins to keep them. See
  `docs/CONSUMING.md` §5.1.
- Every theme overrides every token (`pnpm theme-parity:check`); the contract ships as
  `THEME_TOKEN_NAMES` (`pnpm token-contract:check`) for a consumer's own test.
- `color-scheme: light|dark` in every theme block is load-bearing: `resolveThemeIsDark(el)` reads
  it; anything swapping an asset by darkness calls it — never a registry lookup.
- Subset: `allowedThemes` on `ThemeProvider`, never hand-rolled; build switchers off
  `useTheme().themes` (`ThemeSwitcher` does). `themes` = what exists,
  `allowedThemes` = what is exposed.
- `/new-theme` adds a repo theme. Body text: WCAG AA 4.5:1 in every theme.
- Distinct roles, distinct values: two semantic tokens never share one literal
  (`themes-contrast.test.ts`). An INTENTIONAL mirror is `var()` — `--sidebar-primary: var(--primary)`,
  `--chart-1: var(--primary)`. Must stay literals: anything the contrast tests assert on, and
  roles that merely coincide.
- `pnpm roles:check`: `MUST_DIFFER` pairs per theme at 0.05 ΔE, `var()` resolved first;
  token-level only (pixels: `pnpm decoration-collapse:check`). Exemption: one `(theme, pair)`
  citing that theme's design contract; a polychrome theme needing one → delete the pair.
  `(--primary, --chart-1)` is deliberately absent.
- Chart ramp 1.4.11 exemption (`light`, series only; `:root` and
  `--chart-foreground`/`-label`/`-foreground-muted` stay gated): fix = darken
  `--chart-background`, never lighten the palette. `CHART_1411_EXEMPT` lives in
  `packages/tokens/src/charts-contrast.test.ts` AND `scripts/check-audit-artifact.mjs`.
  `--chart-accent` (`var(--chart-1)`) inherits it — add no gate for a bar it knowingly misses.
  Evidence `apps/e2e/reports/theme-aa-audit.md` (`renderArtifact`): `pnpm audit-artifact`
  regenerates it; `pnpm audit-artifact:check` fails on drift.
- Focus indicator is COMPOUND (`docs/ADR/0027-focus-ring-token-contract.md`): `--ring`
  (reference themes alias `var(--primary)`) + `--ring-contour` (1px `outline`; in `:root` and
  every theme). Never hand-roll one; never write `focus-visible:ring-2 focus-visible:ring-ring`.
  Utilities (in `themes.css`): `focus-ring` · `focus-ring-within` (wrapper frame) ·
  `focus-ring-inset` (overflow-clipped) · `focus-ring-static` (proxied focus; never resting).
  Retarget ONE variable, never re-stack: `focus-ring [--focus-ring-color:var(--sidebar-ring)]`;
  contour not retargetable. `ring-2 ring-ring` meaning "selected" is not focus — leave it.
  Contract (1 and 3 relaxed in the reference themes — Amendment 1):
  1. Brand family: within ~20° of the theme's `--primary` hue.
  2. `max(contrast(--ring,S), contrast(--ring-contour,S)) ≥ 3:1` for `S` ∈ `--background`,
     `--card`, `--surface-muted`, `--muted`, `--secondary`, `--primary` (`themes-contrast.test.ts`).
  3. ΔE ≥ 0.05 from `--accent-foreground`, `--info`, `--success`; no `(--ring,--primary)` /
     `(--ring,--chart-1)` rows. `--ring-contour`: dark ink where the ring is faint;
     `var(--background)` where it already clears (`dark`) — don't "improve" that.
  4. `--sidebar-ring: var(--ring)` — never a literal.
  5. Build-time value → a `[data-theme]` block keeping 1–3 (`pnpm roles:check`; prefer a
     `/new-theme` fork over patching one token). Runtime value → `ThemeProvider`
     `tokenOverrides={{ "--ring": … }}` (`docs/ADR/0031-runtime-token-overrides.md`).
  6. `:root`'s ring stays un-aliased — leave it. Knowingly NOT in `MUST_DIFFER`:
     `(--ring, --info-text | --success-text | --primary-text)`.
- A region scoping its own tokens (`attributeTarget`, or by hand) paints its own ground
  (`bg-background` / `bg-card`).
- Font smoothing lives in the token `@layer base` `body` rule — never re-add it.
- Use semantic tokens, not `dark:` — `@custom-variant dark` covers only the themes shipped
  HERE. Brand assets use `currentColor` / tokens.
- Decoration dial `--decoration` 0–10 paints backgrounds only, never inside a control:
  `data-decoration` / `<DecorationProvider>` / `useDecoration`. Policy: @.claude/rules/decoration.md.

## Taste profile

`TasteProfile` (`@elabs-ai/components-tokens`, `docs/ADR/0020-taste-profile.md`). Read it, never
ask: `useTasteProfile()` or `brand-ui info --json` (`DEFAULT_TASTE_PROFILE` ⊕
`brand-ui.config.json` `taste`). Axes, default first → dial: register `product` · `brand` → none
(`data-register` read-only); density `comfortable` · compact · spacious → `data-density`; motion
`system` · reduced · full\* → `data-motion-pref`; expressiveness `0` – 10 → `data-decoration`.

- `expressiveness` IS `--decoration`; never mint a second knob.
- \*`motion: "full"` is a PERSON's consent, never an app/scaffold default
  (`docs/MOTION_GUIDELINES.md`): project profiles use `system`/`reduced`; only
  `useMotionPreference()` reaches it; `pnpm app-spec:check` rejects it.
- `register` picks the BAR, never the styling: `brand-ui audit` softens only
  `over-round`/`side-stripe`/`bounce-easing` to advisory in `brand`; no component forks on it.

History and measurements: docs/rules-history/theming.md
