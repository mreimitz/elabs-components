# Styling & tokens

- **Tailwind v4 + semantic tokens only.** Use utilities backed by tokens:
  `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`,
  `bg-primary`, `ring-ring`, `bg-surface`, `bg-card`, etc.
- **No raw colors in components.** No hex, `rgb()`, or arbitrary color values
  (`bg-[#fff]`). The ONLY place raw colors live is `packages/tokens/src/themes.css`
  (and registry `registry:theme` items). The boundary hook warns on violations.
- **`cn()` everywhere.** Merge classes with the `cn` helper
  (`clsx` + `tailwind-merge`) so later utilities win predictably.
- **Spacing & radius:** use the standard Tailwind scale and the `rounded-*`
  utilities backed by `--radius`. Don't invent ad-hoc spacing.
- **Focus:** every interactive element gets a visible ring:
  `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`.
- **`border` vs `border-strong` (WCAG 1.4.11, non-text 3:1).** Two divider rungs
  (ADR `docs/ADR/0010-border-strong-token.md`, issue #172):
  - **`border-border` (subtle, the default base border-color)** — a **redundant**
    boundary: the edge is _also_ signalled by a fill/elevation/shadow/spacing change
    (a `Card` on a different surface, a popover, a section gap). 1.4.11 exempts
    redundant boundaries, so the subtle hairline is compliant. Stays the default.
  - **`border-border-strong` (≥3:1 vs `--card`/`--background`)** — a boundary that is
    the **only** structural cue between two same-surface regions: a divider between
    rows/cells with no fill change, a standalone structural `Separator`, the outline
    of a no-fill control (segmented control, outline button, same-tone gridlines).
  - **`border-input` is the SUBTLE form-field hairline** (== base `--border`,
    aesthetic-aligned — **not** the strong rung). Use it on form controls (Input,
    Textarea, Select, Combobox, date pickers, Checkbox, Radio, OTP, Toggle). Per the
    ADR 0010 Amendment (2026-06-20 — `docs/ADR/0010-border-strong-token.md`) `--input`
    was returned to the subtle rung so controls read on-theme; field identifiability
    rests on the recessed fill + focus-visible ring + control glyphs + hover, not the
    resting border (accepted <3:1 tradeoff). It stays a **distinct token** (a brand may
    re-separate it from `--border`), so keep reaching for `border-input` on form fields.
  - **Decision test:** _"If I deleted this line, could a sighted user still tell the
    two regions apart?"_ Yes → `border`. No → `border-strong`.
  - `border-strong` is contrast-guaranteed only vs `--card`/`--background`. Do **not**
    rely on it over `--surface-muted`/`--muted`/`--secondary` (same-tone) — add a
    redundant cue and keep `border` there.
- **Which status rung a graphical MARK reaches for (#381).** A status tone ships three
  rungs; pick by what the colour is doing, not by which name reads best:
  - **`bg-<tone>` / `border-<tone>` / `text-<tone>` — the FILL rung — is the mark.**
    A status dot, a node stroke, a rating star, a `Progress` indicator, a swatch: the
    hue is the only carrier of the state, so the rung is guaranteed **≥3:1 against
    `--background`, `--card`, `--muted`, `--surface-muted` and `--secondary` in every
    theme** (locked by `themes-contrast.test.ts` — "≥ 3:1 on every mark surface").
    Reach for it freely for colour-only graphics. It is a **deep** colour in the light
    themes precisely so it can do this; `--warning` used to be a light amber that
    cleared 3:1 against nothing at all (2.07:1 at best), which is what #381 fixed.
  - **`text-<tone>-foreground` is ONLY the ink on a solid `bg-<tone>` plate.** It is
    light in the light themes because the plate is dark. Putting it on a `/10` wash or
    a bare surface paints near-white text on near-white ground — the exact regression
    #381 had to repair in `@elabs/components-editor`'s entity chip.
  - **`text-<tone>-text` is coloured TEXT on an ordinary surface** (≥4.5:1 — a wash
    chip's label, an inline status word). Not a fill, not plate ink.
  - **Decision test:** _is the colour behind text I control (`-foreground`), the colour
    OF text on the page (`-text`), or the colour of a shape (the fill rung)?_
  - **A filled plate that also carries a label** (`Badge variant="warning"`,
    `StatusBadge`) is a redundant boundary and 1.4.11-exempt — but it uses the same
    token, so the token still has to clear the mark bar. That is why the invariant
    lives on the token, not on each call site.
- **Don't fight the cascade:** avoid deep wrapper nesting; one element should own
  one job. Keep DOM shallow.
- **Adding a visual concept = adding a token.** Define `--foo` in every theme
  block in `themes.css`, map `--color-foo: var(--foo)` in `@theme inline`, then
  use `bg-foo`/`text-foo`. Never short-circuit with a literal.
- **Tailwind content scanning:** workspace packages are scanned via `@source`
  directives in each app's CSS — add new packages there.
- **KPI tile ownership:** the canonical KPI tile (`MetricCard`) is owned by `@elabs/components-ui`; `@elabs/components-charts` and `@elabs/components-editor` re-export it (ADR 0012).

## Typography scale (#187)

- **Type is a role, not a size.** Reach for a role — the `text-<role>` utility
  (`display` / `title` / `subtitle` / `body` / `caption` / `meta` / `kpi` /
  `code`) or, once they land (#188), the `<Heading>`/`<Text>` primitives —
  never a raw `text-sm`/`text-xl`/`text-[17px]` in component source.
  `--text-body == text-sm` **by design** (identical size AND line-height), so
  `text-sm` → `text-body` is a visual no-op; hierarchy comes from raising the
  title/display/kpi rungs, never shrinking body.
- **The roles bundle all four dimensions** (size + leading + weight + tracking,
  native Tailwind `--text-*` companion keys) and stay composable —
  `text-body leading-loose` still works. Do NOT re-bundle with `@utility`
  (flat declarations would break `leading-*`/`font-*` overrides).
- **`kpi` pairs with `tabular-nums`; `code` pairs with `font-mono`.**
- **Theme seams:** `--font-display` (identity-default `var(--font-sans)`) lets a
  brand re-skin headlines without touching components; `--font-mono` is the
  explicit mono seam (blueprint overrides it). Both are root-only `font-`
  machinery (parity-allowlisted).
- **Type IS density-aware (#340, 2026-08-02 — reverses the earlier stance).**
  `data-density` scales the type scale as well as the spacing, so a compact
  surface tightens as a whole instead of squeezing tight rows around unchanged
  text. One knob — `--type-factor` in `density.css` — multiplies every role's
  SIZE and LINE-HEIGHT: **compact 0.9375 (15/16, −6.25%) · comfortable 1
  (identity) · spacious 1.0625 (17/16, +6.25%)**. Weight and tracking are never
  rescaled (weight is a semantic rung; tracking is authored in `em`, so it
  follows the size on its own).
  - **Type moves at ~half spacing's rate, on purpose.** Spacing moves ~11–12%
    per step; whitespace can be cut hard before a layout breaks, text cannot.
    The binding constraint is a **legibility floor: body never renders below
    13px** (compact body = 13.125px at a 16px root) and no role below 11px
    (`meta`, the smallest rung, lands at 11.25px). That floor is what caps the
    compact factor — don't "tidy" it toward spacing's −11%.
  - **`comfortable` / no attribute is the EXACT pre-#340 scale**, so a screen
    that never sets density is unchanged. Screens already using
    `data-density="compact"` DO render smaller text — that is the intended
    behaviour change.
  - **The dial reaches ROLE-TYPED TEXT ONLY — that is the known gap, and it is
    still large.** `--type-factor` rewrites the `--text-<role>` keys; a raw
    `text-sm`/`text-xs` reads Tailwind's own `--text-sm`/`--text-xs`, which the
    dial does not touch. So density coverage on a real screen == role adoption
    on that screen, and adoption is partial: `pnpm text-scale:check` still
    counts **309 raw font-size uses across 111 files** — 112 in
    `@elabs/components-ui` (mostly `src/blocks/**` copy-own
    blocks, `context-menu`, `menubar`), 109 in
    `@elabs/components-ai`, 50 in
    `@elabs/components-charts`. Every one of those is a string of
    text a compact surface will NOT tighten. Measured on real screens after the
    Sidebar/Button/Badge/Table/DataTable migration (elements whose computed
    `font-size` actually changes between comfortable and compact, story root,
    1440×900): `data-datatable--with-toolbar` **10/11**,
    `patterns-templates-data-app--default` **27/31**,
    `patterns-templates-enterprise-admin-console--default` **47/52**, but
    `layout-app-shell-mail--default` only **10/49** — its remaining 39 are raw
    utilities inside `packages/ui/src/blocks/sidebar-04/**`. **Do not describe
    the dial as scaling "the type on a screen"; it scales the type that reaches
    for a role.** Closing the gap is ordinary text-scale ratchet work, not a
    change to the dial.
  - **Migrating a raw utility to its role is a size/leading no-op, NOT a
    byte-identical one.** `text-sm` → `text-body` changes nothing (`--text-body`
    is `text-sm`'s size AND line-height AND `letter-spacing: 0em`). `text-xs` →
    `text-meta` keeps size and line-height but ALSO adopts the `meta` role's
    `letter-spacing: 0.01em` (+0.12px at 12px) and `font-weight: 500` — that is
    the roles-bundle-all-four-dimensions rule working as designed, so budget for
    a sub-pixel tracking shift on `text-xs` sites and check any that relied on
    weight 400.
  - **Mechanism:** the scale's rem literals live in `themes.css`
    § TYPE SCALE BASE (`--type-size-*` / `--type-leading-*`) and the `@theme`
    `--text-*` roles alias them; each `[data-density]` block redeclares the
    roles as `calc(base × var(--type-factor))`. The base layer is separate
    because `ThemeProvider` writes `data-density` on the document element, so
    scaling `--text-*` from itself would be a custom-property cycle. Change the
    scale in the base layer, never in a component.
  - Locked by `packages/tokens/src/density-type-scale.test.ts` (identity,
    direction, floor, and that weight/tracking stay out of it) and shown by
    `Foundations/Typography → Density scale`.
- **Enforced:** new raw font-size utilities fail `pnpm text-scale:check` (a
  per-file ratchet vs `scripts/text-scale-baseline.json`; baseline only goes
  down — `--update` after cleanups). **Scope includes `*.stories.tsx`** (and
  `apps/docs/stories/**`) — reference/scenario/template stories are exemplar +
  copy-own surfaces, so type-as-a-role holds there too; a genuine type-scale
  demo carries its raw uses in the baseline and disables the ESLint rule inline
  with a reason. Only `*.test.*` are exempt. Registry blocks warn only
  (copy-own).

### "Prose" vs "label-like" description text (#339)

A `*Description` sub-part (`CardDescription`, `AlertDescription`, and future
siblings) can carry either a short subtitle-style label OR genuine multi-line
prose — the two want different line-length treatment, so the convention is a
single opt-in prop rather than a per-component judgment call:

- **Default (no prop) → full width, unbalanced.** Most descriptions are
  short, label-like text (a card subtitle, an alert's one-line explanation)
  that should run edge to edge inside its container. Capping these makes
  short text wrap unnecessarily.
- **`measure?: boolean` (opt-in) → `max-w-prose` (~65ch).** Set it when the
  slot will genuinely hold multiple sentences of prose in a wide container —
  a long line with no natural place for the eye to return to the start of
  the next line hurts reading speed/comprehension. The caller (who knows
  their content length and container width) opts in; the component never
  guesses from content length.
- **Line balancing (`text-balance`) is a DIFFERENT, unconditional concern.**
  A description also carries `text-balance` (not gated by `measure`) so a
  short heading-adjacent line wraps evenly instead of leaving a single
  orphan word — this applies even to the default, unmeasured case.
- **Decision test:** _will this slot typically hold one short label line, or
  multiple sentences of real prose?_ Label → leave `measure` off. Prose →
  set `measure`. Don't invent a third variant; extend this same `measure`
  convention to any future `*Description` part instead of a bespoke prop.

## Surface separation (#187)

- **Each region owns ONE focal separation gesture**, picked by semantic role:
  - **fill / zone** — `bg-surface-muted` (neutral), `bg-chat-user` (user
    message), `bg-<status>/10` wash (attention; escapes the blueprint
    drawn-not-filled _override_ by token inequality — `bg-success/10` is a
    different Tailwind class than `bg-success`, so `decoration.css`'s
    class-scoped selector never matches it — do NOT mint `-subtle` tokens).
    **Escaping the override is not the same as delivering separation in
    blueprint**: blueprint's status tokens are near-white, low-chroma and
    separated by lightness only, so at 10% alpha two adjacent statuses measure
    ΔE ≈0.012 — indistinguishable by colour alone (#391). A status rendered
    with this wash in blueprint/high decoration MUST also carry the
    `[data-status]` non-colour line-type attribute (see
    `.claude/rules/blueprint-decoration.md` "Status = line type, not colour")
    for the separation to actually read;
  - **accent rail** — `border-s-2` (quiet) / `border-s-4` (emphatic) +
    `border-s-<role>`: `primary` = the answer/completed, `info` = in-progress,
    `muted` = technical/neutral, `border-strong` = structural attention;
  - **elevation** — ground offset (always) + shadow (light-only enhancement):
    raised content = `bg-card` (+ `shadow-md` when it must read as floating),
    recessed field below a card = `bg-background`. NOTE `bg-surface-muted` as
    a "well" is LIGHT-ONLY — it inverts on dark themes (muted is lighter than
    card there); prefer raising the focus pane with `card`;
  - **divider / space** — `gap-*`, or a single `border-t` / `Separator`
    (`border-strong` when it is the sole cue).
- **No redundant border:** don't stack a bare `border` on a region that already
  has a non-default fill, a rail, or elevation — unless the border is the SOLE
  structural cue (the existing `border` vs `border-strong` decision test).
  Complementary combos are fine (a rail labels a filled zone; a divider
  segments within one); the rule forbids the redundant border, not every combo.
  A border that is redundant on light but sole-cue under decoration (shadow
  zeroed) is KEPT — e.g. `Artifact`.
- **No generic `<Surface>`/`<Panel>` primitive** — the channel lives in the
  semantic grammar components (`Card` stays the one generic surface and keeps
  its border).
- **Surface elevation across the app frame (chrome < canvas < raised).** App
  chrome (`bg-sidebar` — nav/sidebar) is the **most recessed** surface; the
  content canvas (`bg-background`, painted by `SidebarInset`) reads **brighter /
  more elevated**, and raised content (`bg-card`) sits above the canvas. This is
  what stops an app shell from going flat (a past regression set
  `--sidebar` == `--background`). The hierarchy is a **token** property: every
  theme must keep `L(--background) − L(--sidebar) ≥ 0.02` (canvas lighter than
  chrome — holds in light AND dark, since elevated == lighter in both). Don't fix
  flatness in components; fix the theme's `--sidebar` lightness.
- **Enforced (narrow + honest):** same-class-string `border` + non-default-fill
  co-occurrence fails `pnpm separation:check` (ratchet vs
  `scripts/separation-baseline.json`); cross-element and "sole cue" judgments
  belong to the visual reviewer, not the regex. The chrome→canvas elevation
  invariant above is enforced by `pnpm surface-elevation:check` (self-tested) —
  a theme that collapses nav≈content fails CI.

## Elevation (ADR 0020 — one stacked ramp, edge inside the shadow)

- **Never hand-roll a shadow.** No `box-shadow` / `boxShadow`, no
  `shadow-[0_4px_…]`. Every shadow in the system is a rung of ONE ramp declared in
  `themes.css` § ELEVATION RAMP: `shadow-2xs` · `xs` · `sm` · `md` · `lg` · `xl` ·
  `2xl`, each a **stack** of 2–5 layers at 1–7% alpha whose offset and blur halve
  on the way down (technique borrowed from
  [`flornkm/shadow-plugin`](https://github.com/flornkm/shadow-plugin), MIT).
- **A floating surface uses `shadow-ring-*` and NO border.** The ring rungs bake a
  1px hairline in as the shadow's final layer, so the edge morphs into the shadow
  instead of standing beside it as a second, crisp stroke (the "double edge" —
  what makes an overlay read washed and heavy). Applies to dialogs, sheets,
  popovers, dropdowns, context/menubar menus, selects, command palettes, toasts,
  floating tooltip PANELS, map popups and canvas furniture (minimap, zoom
  controls, legend). `border shadow-md` → `shadow-ring-md`. Never keep a
  `border`/`ring-*` on an element that already has `shadow-ring-*`.
- **A resting surface keeps its border.** `Card` (the one generic surface),
  `Artifact`, the composer well, form fields (`border-input`), flow nodes (border
  carries tone) — they pair `border` with `shadow-sm`/`xs`, which is a lift, not a
  float. That is why the gate only flags `border` + an **unprefixed** `md`-and-up
  rung; `hover:shadow-md` on a bordered card is a legitimate hover lift.
- **A high-contrast chip gets a plain rung, no ring.** `Tooltip`, map label
  tooltips and the pill tickers are already max-contrast against the page — a
  hairline adds nothing. Plain `shadow-*` is the "no edge stroke at all" answer;
  a `border` is not.
- **`shadow-hairline` is the bare 1px edge** (ring layer alone, no lift), for a
  control that must not gain a border's layout box. Retint it per element with
  `[--shadow-ring-color:var(--some-token)]` — see the sidebar `outline` menu
  button. This is the sanctioned replacement for `shadow-[0_0_0_1px_…]`.
- **Reach by ROLE, not by size.** The ramp is calibrated for surfaces: `lg` is a
  25px-offset / 50px-blur stack. A 16px switch knob or a marker dot wants
  `xs`/`sm`; putting `shadow-lg` on one smears it.
- **Retune elevation in the THEME, never in a component.** Three knobs per theme
  block: `--shadow-color` (the ink), `--shadow-strength` (multiplier on every
  layer's alpha — `0` = shadowless), `--shadow-ring-color` (the hairline). The
  hairline is deliberately **outside** the strength dial, so a shadowless surface
  keeps its drawn edge: that is how blueprint (and `data-decoration="8|9|10"`)
  goes shadowless with one declaration instead of a list of shadow classes.
- **The ring is a redundant boundary, not a 1.4.11 cue.** At 5%/18% it is as
  quiet as the `border-border` it replaces, and legitimate for the same reason
  (fill + elevation also signal the edge). A boundary that is the **sole**
  structural cue still takes `border-border-strong` — `shadow-ring-*` is not a
  substitute for it.
- **Enforced:** `pnpm elevation:check` (self-tested, blocking) — ring rung ≡ plain
  rung + hairline, every layer's ink tokened, the shadowless dial's cascade
  intact, and no raw / arbitrary / double-edged shadow in component source
  (`registry/` warn-only, copy-own).
