# Theming

- **Mechanism:** themes are applied with the `data-theme` attribute on a root
  element. `:root` is a neutral light base/fallback; each theme is a
  `[data-theme="name"]` block in `packages/tokens/src/themes.css`.
- **Provider:** `ThemeProvider` (from `@elabs/components-tokens`) writes `data-theme` and
  persists the choice; `useTheme()` reads/sets it.
- **Shipped themes:** `light` (default) and `dark` — the ACTIVE set.
  (`blueprint` is paused: kept in `themes.css`, out of `THEMES`; see
  @.claude/rules/paused-surfaces.md.) Keep
  `THEMES` + `THEME_META` in `theme-types.ts` in sync with the CSS blocks. The
  default is set by `DEFAULT_THEME`.
- **Every theme overrides every token.** A theme block must set the full
  semantic set (surfaces, sidebar, canvas/flow, chat, chart-1..5, radius). A
  missing token falls back to `:root` and usually looks wrong. **Enforced** by the
  theme-token-parity gate (`pnpm theme-parity:check`, #89): every theme block must
  define every semantic token the other blocks define — root-only machinery
  (timing/decoration/radius/font) is allowlisted; a missing semantic token fails CI.
- **Shipping a SUBSET of the themes:** pass `allowedThemes` to `ThemeProvider`
  (#355) — never hand-roll the filtering. One prop covers all three paths a
  subset needs: `useTheme().themes` lists only the allowed names (build switchers
  off THAT, not off `THEMES`), a persisted value for a now-hidden theme is
  rejected in the same mount pass that applies the theme (so it can never flash
  on boot), and `setTheme` with a disallowed name is a no-op that warns in dev.
  Omitting it keeps the previous behaviour (every shipped theme). `ThemeSwitcher`
  (`@elabs/components-ui`) automatically narrows to the provider's
  subset when restricting (#384); a non-restricting provider leaves the `themes`
  prop untouched for backward compatibility, so existing 2-theme toggles are
  unchanged.
- **Adding a theme:** use the `/new-theme` command. Add the CSS block, the
  `THEMES`/`THEME_META` entries, and (optionally) a `registry:theme` item.
- **Contrast:** body text must meet WCAG AA (4.5:1) in every theme.
- **Distinct roles, distinct values.** Two semantic tokens must never share one
  literal — a token equal to another token is an undeclared alias, not a token.
  `--success` was byte-identical to `--primary` and `--ring` to `--info` in both
  qlik themes (#334), so success chips read as primary and focus rings as info
  chips. Locked by `themes-contrast.test.ts` (string inequality **and** an OKLab
  ΔE floor, so a cosmetic nudge can't satisfy it).
- **An INTENTIONAL mirror is declared with `var()`, never copy-pasted (#385).**
  When one design decision is expressed across several surfaces —
  `--sidebar-primary` mirroring `--primary`, `--sidebar-ring` mirroring `--ring`,
  `--sidebar-accent-foreground` mirroring `--accent-foreground` — write
  `--sidebar-primary: var(--primary);`, not the literal again. A duplicated
  literal cannot be told apart from an accidental collision, and it silently
  drifts the moment someone retunes one side. The DTCG source carries the alias
  verbatim (`"$value": "var(--primary)"` — `themes-io.mjs isInScope()` accepts
  `oklch()` literals **and** `var(--…)`), so it round-trips through
  `tokens:build` / `pnpm tokens:check` unchanged.
  - **Two things must stay literals.** (1) Anything
    `themes-contrast.test.ts`/`charts-contrast.test.ts` asserts on — their
    `tokenMap` regex only sees `oklch()`, which is why `--input` and blueprint's
    `--border-strong` carry a comment saying so. (2) Roles that merely _coincide_
    (blueprint's `--ring` and `--accent-foreground` are both the one white)
    rather than mirroring: aliasing those would mean retuning the hover ink
    silently moves the focus ring.
- **Roles that co-occur must stay PERCEPTIBLY apart — `pnpm roles:check` (#385).**
  Parity proves a token is _present_; the contrast gate proves it clears a ratio
  against a _surface_. Neither can see two independent roles collapsing onto one
  colour, which is how `:root` shipped `--primary` ≡ `--ring` ≡ `--chart-1`.
  `scripts/check-role-distinctness.mjs` (self-tested, in `gates.yml`) asserts a
  `MUST_DIFFER` pair list per theme at the same 0.05 OKLab ΔE floor, resolving
  `var()` first so an alias can't launder a collision.
  - **Adding an exemption:** scope it to one `(theme, pair)` and cite the
    **theme's own design contract** (blueprint's three ring rows are exempt
    because it is monochrome by contract and its chart ramp is pinned by
    `charts-contrast.test.ts`). If a pair needs an exemption in a _polychrome_
    theme, the pair is the mistake — delete it from `MUST_DIFFER`. That is why
    `(--primary, --chart-1)` is deliberately absent: shipping series 1 as a
    chart-tuned cousin of the brand hue is a convention, not a collision.
  - **This gate is token-level only.** It proves the tokens differ; it cannot
    prove the difference survives to the pixel — `decoration.css` rewrites every
    `.bg-<tone>` under blueprint to one declaration set, so non-aliased status
    roles still render identically (#391 owns that half). Keep both.
- **`--ring` is brand-derived — the focus-indicator contract (`docs/ADR/0027-focus-ring-token-contract.md`, #427).**
  `--ring` had no stated contract, only a negative comment ("distinct from the
  green brand AND `--info`"), which is why #334's fix was free to leave the
  brand palette entirely and land a blue ring in both qlik themes with every
  gate green. A theme's `--ring` must satisfy all of:
  1. **Brand family** — within ~20° of that theme's `--primary` hue, at a
     clearly different lightness/chroma rung (never an alias).
  2. **1.4.11 (≥3:1)** against `--background`, `--card`, `--surface-muted`,
     `--muted` and `--secondary` — a focus ring lands on all five.
  3. **Distinctness (ΔE ≥ 0.05 OKLab)** from `--primary`, `--chart-1`,
     `--accent-foreground` (`MUST_DIFFER`), `--info` (`ROLE_PAIRS`) and
     `--success` (new row, Part C).
  4. **`--sidebar-ring: var(--ring)`** is the sanctioned mirror — an override
     reaches sidebar focus automatically. Never re-declare it with a literal.
  5. **Overriding it is supported**, in a `[data-theme="…"]`-scoped block,
     provided (1)–(3) still hold. Verify with `pnpm roles:check` and
     `pnpm --filter @elabs/components-tokens test`. **Prefer
     forking the theme (`/new-theme`) over patching one token.**
  6. `:root`'s blue ring is **not** an exception — `:root`'s `--primary` is a
     blue (264°) and its ring is the same hue at a distinct rung (ΔE 0.1044).
     It already satisfies this contract.
  - **`(--ring, --info-text)` / `(--ring, --success-text)` / `(--ring, --primary-text)`
    are knowingly declined from `MUST_DIFFER`** — a 2px transient stroke and a
    word of static text are different channels, the same reasoning that drops
    `(--primary, --chart-1)`. Don't "helpfully" add them; see the ADR.
  - **Ordering with #416** (`--success-text` retune): whichever of #416 and
    #427 lands second re-runs `pnpm roles:check` and re-measures
    `(--ring, --success-text)`.
- **Font smoothing** ships in the token stylesheet's `@layer base` `body` rule
  (`-webkit-font-smoothing: antialiased` / `-moz-osx-font-smoothing: grayscale`,
  #345) — consumers must not re-add it locally.
- **`dark:` utilities** exist (wired to `data-theme="dark"`) but components should
  rely on semantic tokens, not `dark:` overrides, so all themes benefit.
- **Brand assets** (logo, icons) should use `currentColor`/tokens so they adapt.
- **Decoration dial (orthogonal to color):** `--decoration` (0–10) adds reprographic
  "blueprint" texture (grid/hatch/drawn-not-filled/squared) to ANY theme, hue-independent.
  Set it per theme (blueprint = 10), per region (`data-decoration="N"` or
  `<DecorationProvider>`), or document-level (`ThemeProvider`/`useDecoration`). Overlay
  rules live in `decoration.css`; policy in @.claude/rules/blueprint-decoration.md.

- **`color-scheme`** — every theme block sets `color-scheme: light|dark` so native
  scrollbars, form controls and page chrome match the active theme (see
  `interaction-guidelines.md`).

## Taste profile (register × density × motion × expressiveness)

The four axes that say what a surface should FEEL like, as one named object —
`TasteProfile` in `@elabs/components-tokens`. ADR
[`0020`](../../docs/ADR/0020-taste-profile.md) is the durable record.

| Axis               | Values                                       | Dial                                                           |
| ------------------ | -------------------------------------------- | -------------------------------------------------------------- |
| **register**       | `product` (default) · `brand`                | none — a judgment setting, `data-register` is a read-only seam |
| **density**        | compact · `comfortable` (default) · spacious | `data-density` / `density.css` — spacing **and** type (#340)   |
| **motion**         | `system` (default) · reduced · (full\*)      | `data-motion-pref` / `--motion-factor`                         |
| **expressiveness** | `0` (default) – 10                           | **the decoration dial** — `data-decoration`                    |

- **`expressiveness` IS `--decoration`. Never mint a second knob.** The decoration
  dial already encodes hue-independent expressiveness (0 = plain, 10 = full
  reprographic); the profile just gives it the taste-vocabulary name. Change it
  with `useDecoration().setDecoration` / `data-decoration` / `<DecorationProvider>`.
- **Defaults are restrained; expressive is opt-in.** `DEFAULT_TASTE_PROFILE` is
  product / comfortable / system / 0 — i.e. every value already in force, so
  adopting the profile changes nothing visually.
- **\*`motion: "full"` is a PERSON's informed consent, never an app/scaffold
  default.** `[data-motion-pref="full"]` is the one state that keeps
  `--motion-factor: 1` under an OS `prefers-reduced-motion: reduce` AND opts out of
  the third-party animation cap (`themes.css`; truth table in
  `docs/MOTION_GUIDELINES.md`). So a profile a _project_ declares (an app-spec's
  `taste.motion`, a scaffold's `defaultMotionPreference`, a `brand-ui.config.json`
  written by a generator) uses `system` or `reduced` only — `system` already gives
  full motion whenever the OS is neutral. `full` is reachable solely from a motion
  control the user operates (`useMotionPreference()`). Enforced: the app-spec
  schema's `taste.motion` enum excludes it and `pnpm app-spec:check` fails a spec
  that sets it.
- **Read it, don't ask for it.** `useTasteProfile()` in React;
  `brand-ui info [--json]` (`taste`) for tooling, resolved from the shipped
  defaults ⊕ an optional project-root `brand-ui.config.json` `taste` key. The
  `brand-ui-audit` skill reads this instead of asking a human to pick a register.
- **`register` picks the BAR, never the styling.** `product` = earned familiarity
  (app UI — the default for `@elabs/components-*`); `brand` =
  distinctiveness (marketing surfaces). `brand-ui audit` softens exactly three
  expressive tells (`over-round`, `side-stripe`, `bounce-easing`) to advisory in
  the brand register — it never softens a banned rule or content slop. No
  component may fork behaviour on the register.
