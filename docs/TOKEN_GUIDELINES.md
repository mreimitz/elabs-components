# Token guidelines

Tokens are the brand contract. Components reference tokens; tokens reference
brands. Re-branding is a token change.

## Where tokens live

`packages/tokens/src/themes.css` is the **engine** — shipped as
`@elabs-ai/components-tokens/styles.css` and always imported:

- `:root` — neutral light base/fallback. A complete palette, so an app that
  imports nothing else still renders correctly.
- `@theme inline { --color-*: var(--*) }` — maps tokens to Tailwind utilities.
- the dials (decoration, density, motion), the base layer, the view-transition
  block.

Each **reference theme** is its own opt-in file — `src/themes/light.css`,
`src/themes/dark.css`, exported as `@elabs-ai/components-tokens/themes/<name>.css`.
`styles.css` does **not** import them.

`packages/tokens/src/theme-types.ts` holds the **built-in registry**
(`BUILT_IN_THEMES`, `BUILT_IN_THEME_META`, `BUILT_IN_THEME_DEFINITIONS`,
`DEFAULT_THEME`) plus `defineTheme()` and `THEME_TOKEN_NAMES`. The theme set is
open — `ThemeName` is `string` and a consumer registers their own through
`<ThemeProvider themes={…}>`. See ADR
[0029](./ADR/0029-open-theme-registry.md) and `docs/CONSUMING.md` §5.1.

## Semantic token set

Surfaces & text: `--background`, `--foreground`, `--card(-foreground)`,
`--popover(-foreground)`, `--surface`, `--surface-muted`, `--surface-elevated`.
Brand & intents: `--primary(-foreground)`, `--secondary(-foreground)`,
`--accent(-foreground)`, `--muted(-foreground)`, `--destructive(-foreground)`,
plus `--success/--warning/--info(-foreground)` extensions.
Status TEXT variants: `--success-text`, `--destructive-text` — see "Fill vs. text" below.
Lines & focus: `--border`, `--input`, `--ring`.
App chrome: `--sidebar(-foreground/-border/-accent/-muted-foreground...)`.
Canvas/flow: `--canvas`, `--canvas-grid`, `--flow-node(-foreground)`, `--flow-edge`.
Chat: `--chat-user(-foreground)`, `--chat-assistant(-foreground)`.
Data: `--chart-1..12` (categorical) plus the ordered ramps `--chart-seq-1..7`,
`--chart-div-neg-2..--chart-div-pos-2`, `--chart-mono-1..7` and `--chart-accent`
— see "Chart ramps" below. Shape: `--radius` (+ derived `--radius-sm/md/lg/xl`).

## Ordered neutral ramp (#14)

The semantic slots above give TWO text weights (`--foreground` /
`--muted-foreground`) and TWO divider weights (`--border` / `--border-strong`).
A dense product UI — a table row with a primary value, a secondary label,
tertiary metadata and a disabled action, all in one row — routinely needs more
text/surface rungs than that. `--foreground-1..4`, `--border-1..2` and
`--surface-1..4` are an ADDITIVE, ORDERED view onto the same tokens: every
rung is either a `var()` alias of an existing semantic slot (so retuning that
slot still moves the ramp) or a new literal for the gap the slots skip.
Nothing above changes meaning or value — reach for the ramp only when you
need a rung the slots don't name.

| Rung             | Role                    | Utility             | Relation                                                                                         |
| ---------------- | ----------------------- | ------------------- | ------------------------------------------------------------------------------------------------ |
| `--foreground-1` | primary value           | `text-foreground-1` | `== --foreground`                                                                                |
| `--foreground-2` | secondary label         | `text-foreground-2` | new — between foreground and muted                                                               |
| `--foreground-3` | tertiary / metadata     | `text-foreground-3` | `== --muted-foreground`                                                                          |
| `--foreground-4` | disabled                | `text-foreground-4` | new — lighter than muted-foreground; sub-AA by design (WCAG 1.4.3 exempts inactive-control text) |
| `--border-1`     | subtle (redundant edge) | `border-border-1`   | `== --border`                                                                                    |
| `--border-2`     | strong (sole cue, ≥3:1) | `border-border-2`   | `== --border-strong`                                                                             |
| `--surface-1`    | page ground             | `bg-surface-1`      | `== --background`                                                                                |
| `--surface-2`    | base layer, near ground | `bg-surface-2`      | `== --surface`                                                                                   |
| `--surface-3`    | raised card / panel     | `bg-surface-3`      | `== --card`                                                                                      |
| `--surface-4`    | most elevated / float   | `bg-surface-4`      | `== --surface-elevated`                                                                          |

**The border ramp is deliberately TWO rungs, not three or four.**
`--border`/`--border-strong` is a BINARY WCAG 1.4.11 contract
(`styling-and-tokens.md`'s decision test: _"if I deleted this line, could a
sighted user still tell the two regions apart? Yes → the subtle rung. No →
the ≥3:1 rung."_) — every boundary in the system answers that question one of
exactly two ways, so `--border-1`/`--border-2` alias those two answers and
stop there. **A rung "between" them is never correct for a sole-cue
boundary** — it is too weak to clear ≥3:1, so 1.4.11 still fails — **and it
adds nothing over `--border-1` when the boundary is redundant.** An earlier
draft of this ramp shipped exactly such a rung (`--border-2` at ~2:1, with
`--border-3` as the real strong rung) and it was dropped in review: a token
whose only description is "between the other two" is a naming artifact, not
a design decision, and a numbered 1/2/3 ramp actively invites reaching for
the middle one on a divider that IS the sole cue. If you find yourself
wanting a border weight this table doesn't name, that is a sign the boundary
needs a REDUNDANT cue (fill/elevation/spacing) added alongside `--border-1`,
not a new numbered rung.

**Pick a foreground/surface rung by ROLE, not by "what looks right."** If two
rungs render the same in one theme (e.g. `surface-1`/`surface-2` in `light`,
where `--surface` and `--background` share a value), that is fine — the ramp
still orders correctly in every theme (verified in
`themes-contrast.test.ts`), and a theme that DOES separate them (both
reference `dark` themes do) renders the hierarchy for free. Don't invent a
THIRD naming scheme for the same concept. **`surface-3`/`surface-4` is a
second accepted identical-pair case in `light`** — `--card`, `--popover` and
`--surface-elevated` are all byte-identical pure white there (OKLCH's
lightness ceiling leaves no headroom to separate them once every one of them
wants to be "the lightest surface"; see the comment at their declaration in
`packages/tokens/src/themes/light.css`), so `surface-3` (`== --card`) and
`surface-4` (`== --surface-elevated`) render the same for the same reason
`surface-1`/`surface-2` do. `dark.css` differentiates all of these.

## Chart ramps (RM-018)

**`--chart-1 … --chart-12` answers _which series_. It cannot answer _how much_,
and it must not be asked to.** Twelve categorical colours are, by construction,
mutually distinct and mutually unordered — that is the whole point of them.
Colour a heatmap with `--chart-1 … --chart-7` and a reader has no way to tell
which cell is bigger, because nothing in the palette says one is. So a second,
ORDINAL half exists, and picking between the two halves is the first decision
any chart makes.

**Lightness is data.** Every ordered ramp encodes magnitude as lightness against
the plot ground: quiet at step 1, most intense at step 7. Hue carries _category_;
lightness carries _quantity_. A ramp that varies hue as well is a ramp whose
steps a reader has to memorise rather than see.

| Family                                  | Answers                          | Reach for it in                                                                  |
| --------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------- |
| `--chart-1..12`                         | which series                     | line / bar / area / pie / scatter — anything with a legend of independent things |
| `--chart-seq-1..7`                      | how much (unsigned)              | heatmap, calendar, treemap, matrix, choropleth                                   |
| `--chart-div-neg-2 … --chart-div-pos-2` | how much, and which side of zero | signed bars, correlation matrix, variance-vs-target                              |
| `--chart-mono-1..7`                     | how much, with no hue at all     | the fallback past six categories; the ground of the "wire" look                  |
| `--chart-accent`                        | "this one is the point"          | the one hero series drawn over the mono ladder                                   |

### The rules

- **Ramp DIRECTION belongs to the theme, not to the token names.** Step 7 is the
  most intense in every theme; whether that renders darker (light theme, white
  `--chart-background`) or lighter (dark theme) is a property of that theme's plot
  ground. Never reverse a ramp in a component, and never assume "higher step =
  darker" in code.
- **Six categories is the cap.** Past six, colour has stopped distinguishing
  anything a legend can hold, and the twelve-colour ramp is three hue FAMILIES —
  so series 7+ are near-neighbours of series 1-6 by construction. A categorical
  chart with more than six series falls back to `--chart-mono-1..7` and says so
  once in dev. Group the tail into an "Other" series; that is the fix, not more
  colours. Overriding it is expressible (pass the palette explicitly) but it is a
  choice you have to type.
- **Reach for `resolvePalette()`, not for a step by name.**
  `resolvePalette(palette, n)` in `@elabs-ai/components-charts` returns `n`
  `var(--chart-…)` strings spread evenly across the ramp, ends included, so two
  charts with different bucket counts read on the same scale. Naming
  `--chart-seq-3` by hand in a component is how a ramp silently stops being a
  ramp.
- **The two quiet steps are the ONLY sub-3:1 members.** `--chart-seq-1` and
  `--chart-mono-1` sit below the WCAG 1.4.11 mark bar on purpose — a heatmap's
  lowest bucket should read as a pinprick — but they are held above 1.5:1, so
  "quiet" never becomes "absent". `--chart-div-mid` is deliberately NOT quiet: a
  zero-valued cell in a diverging chart is still a drawn cell.
- **`--chart-accent` is `var(--chart-1)`.** An intentional mirror, declared as a
  `var()` and never as a copied literal (#385), so a re-brand reaches the hero
  colour for free.
- **Retune a ramp with the gates, never by eye.** Three invariants are
  machine-checked and moving one step can break a pair it is not adjacent to:
  contrast against `--chart-background` and strict monotonicity (in OKLab L _and_
  in contrast) live in `packages/tokens/src/charts-contrast.test.ts`; the 0.05
  OKLab ΔE floor on adjacent steps, on all ten diverging pairs, and on
  accent-vs-ladder lives in `scripts/check-role-distinctness.mjs`
  (`pnpm roles:check`).
- **Adding a theme means authoring all four families.** They are per-theme
  semantic tokens, so `pnpm theme-parity:check` requires every block to declare
  every one of them; a missing ramp step falls back to `:root` and renders a
  ladder with a rung from another theme in it.

### What is NOT gated, and why

- **Cross-ramp distinctness.** `--chart-seq-N` and `--chart-mono-N` sit at the
  same lightness rungs and are close in ΔE by design — they are ALTERNATIVE
  palettes, never on screen together. Only `--chart-accent` vs the mono ladder is
  gated, because the "wire" look really does draw those two at once.
- **Non-adjacent steps within a ramp.** Gating step 2 against step 5 at the
  categorical floor would either force the ladder to span more lightness than the
  3:1 bar leaves it, or push chroma in until it stops reading as one hue.
  Neighbour separation plus the monotonicity assertion is the correct pair of
  constraints; either alone is not.

## Rules

1. **Only `themes.css` (and registry `registry:theme` items) may contain raw
   colors.** Everywhere else, use token-backed utilities. **One narrow,
   documented exception:** a mark rendered through `ServiceLogo`
   (`@elabs-ai/components-icons`, issue #25) may paint itself with the
   THIRD-PARTY SERVICE's own brand colour as a raw literal — that colour is
   the service's identity, not ours, so it cannot be tokenized. Scope it to
   the mark itself (never leak the literal onto a token-owned element beside
   it) and mark the line with the component name or a `data-service-logo`
   attribute so `brand-ui audit`'s raw-color rules can tell it apart from an
   ordinary component reaching for a literal — see
   `packages/cli/lib/audit.mjs`'s `SERVICE_LOGO_MARKER` and
   `packages/icons/src/service-logo.tsx`.
2. **Adding a visual concept = adding a token** in _every_ theme block + a
   mapping in `@theme inline`. Then use `bg-foo` / `text-foo`.
3. **Every theme overrides every token.** Missing tokens fall back to `:root`.
   In-repo themes are gated by `pnpm theme-parity:check`; a consumer's theme
   lives where that gate cannot reach, so the contract ships as data —
   `THEME_TOKEN_NAMES`, asserted in the consumer's own test.
4. **Contrast:** body text ≥ 4.5:1 (WCAG AA) in every theme. The
   `packages/tokens/src/themes-contrast.test.ts` Vitest gate enforces this for the
   status-text + muted/sidebar-muted pairings across both themes.
5. **Fill vs. text — don't reuse a fill token as on-surface text.** A status
   token like `--success` / `--destructive` is tuned as a FILL (a colored plate
   with `*-foreground` ink on top), so its lightness is chosen for "white reads on
   this fill," NOT for "this color reads as text on a white card." Rendered as bare
   colored text on `--background`/`--card`/`--surface-muted` it fails AA. Use the
   on-surface TEXT variants instead — `text-success-text` / `text-destructive-text`
   (tuned ≥ 4.5:1 on those surfaces in every theme). Keep `bg-success`/`bg-destructive`
   (badges, alerts, timeline/flow nodes) on the FILL tokens. Likewise, muted SIDEBAR
   nav text uses `text-sidebar-muted-foreground` (a real token, ≥ 4.5:1 vs `--sidebar`),
   never an opacity modifier on `--sidebar-foreground` (which strands dark-on-dark).
6. Use `oklch()` so deriving hover/active and contrast-safe variants is even.

## Replacing placeholder brand assets

- **Colors:** edit token values per theme (start with `--primary`,
  `--background`, `--foreground`, `--accent`, `--ring`).
- **Logo:** replace `packages/icons/src/brand-logo.tsx` (keep the `currentColor`
  - variant API so consumers don't change).
- **Icons:** add brand icons under `packages/icons/src/sample-icons/` using the
  `createIcon` factory. `lucide-react` is the **default** library for generic UI
  glyphs (not a fallback) — see @.claude/rules/icons.md.

Use the `/new-theme` command to add a brand/theme end-to-end.
