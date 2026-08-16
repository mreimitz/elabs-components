---
# Path-scoped (Claude Code lazy-loads this only when a matching file is touched) — not
# always-on context. Scoped to the blueprint package AND the decoration tokens
# (decoration.css/themes.css live in @qlik-coe-emea/qlabs-components-tokens). See `.claude/rules/quality-gates.md`
# "Enforcement over reminders" and the `rules:scoping:check` gate.
paths:
  - "packages/blueprint/**"
  - "packages/tokens/**"
---

# Blueprint decoration policy (decoration follows function)

"Blueprint" is not a blue theme — it is a **decoration DIAL** (`--decoration`, 0–10)
that is ORTHOGONAL to color. 0 = a plain themed UI; 10 = full reprographic drafting
(grid, hatch, drawn-not-filled, squared, shadowless). It is HUE-INDEPENDENT — the
grid/hatch ink derives from the active theme's own `--foreground`, so gentle blueprint
texture can ride ANY palette (green, light paper, navy…), not just blue. The `blueprint`
theme is simply "the navy cyanotype palette at decoration 10."

Its character must read on **real, unmodified screens** — so the **theme/dial** supplies
the ambient look automatically (no per-component edits), and the **drawing furniture**
(`@qlik-coe-emea/qlabs-components-blueprint`) is placed **sparingly, by role** — never as wallpaper. Tasteful
restraint is the point.

## The decoration dial (how to set it)

- **Theme default:** a theme block may set `--decoration` (blueprint = 10; others
  inherit 0). See `themes.css` "DECORATION DIAL" + `decoration.css` (overlay rules).
- **Region:** put `data-decoration="N"` on any element (or use
  `<DecorationProvider level={N}>` from `@qlik-coe-emea/qlabs-components-tokens`) to dial a subtree — a diagram,
  panel, or page — without changing the theme.
- **Document:** `ThemeProvider` / `useDecoration()` persist a document-level override
  (`null` = follow the theme's default).
- **Ramp:** CONTINUOUS axes (grid, hover/active hatch, hairline, radius) fade in with the
  dial and are inert at 0. BINARY axes (drawn-not-filled controls, shadowless, squared
  xl) switch in only at HIGH decoration (8–10) — so 1–7 is a _gentle_ blueprint (texture
  only; fills/shadows/brand font stay), 8–10 is the _full_ reprographic look.
- The mono font + monochrome chart ramp are **palette-bound** (they belong to the navy
  preset), not dial-bound — a level-6 region in another theme keeps its brand font/colors.

## The three tiers

**① GROUND — ambient, automatic, subtle.** A thin graph-paper grid + soft white
hairline borders. Supplied by the _theme_ (`themes.css`): the grid is laid under the
**drawing field** (content surfaces — `.bg-background/.bg-card/.bg-surface*/.bg-canvas`)
via `@layer base`, NOT under **chrome** (`.bg-sidebar`) or **overlays** (`.bg-popover`,
dialogs/tooltips) — those stay clean so they read as margins / pop above the page.
The ground never competes for attention. Components do nothing to get this.

On pointer devices the grid is pinned (`background-attachment: fixed`) so panels read
as windows cut out of ONE sheet; on touch it scrolls with the element instead
(`@media (hover: hover) and (pointer: fine)` — a fixed layer repaints the viewport on
every scroll frame, which is the touch-jank source, #29).

**GROUND FADE — opt-in, at most one per region.** `data-decoration-fade="top|bottom|edges|center"`
on any region fades the ground out across it instead of ruling it edge to edge (#257):
a hero that shouldn't end on a hard grid edge, a canvas band, a section that has to
recede under content. It is **not** a second background — it paints the SAME `--bp-grid`
on a decorative `::before` layer and masks that, so the ink still rides the dial and is
inert at decoration 0, and the host **and its descendants** are excluded from the
plain-grid rule so the region is never ruled twice. Shipped example: the hero band of
`Patterns/Templates/Marketing` carries `data-decoration-fade="top"` — the sheet fades in
behind the headline and reaches full strength at the band's foot, so it meets the page
grid below with no seam. Rules:

- **It spends the region's one focal drafting gesture** (see The budget) — a faded region
  does not also get a hatch band or a dimension line.
- **Never mask the host itself.** `mask-image` on the surface fades its CHILDREN (text,
  controls) with the grid; that is the failure mode `pnpm decoration:check` locks out.
- **The fade OWNS the region's ground.** Descendants of a faded region don't paint the
  grid either — a nested `.bg-card` that kept ruling itself would punch a crisp,
  full-strength rectangle into the field the fade just faded out. Also gated.
- **Pick the direction by the seam,** not by taste: the edge where the fade reaches FULL
  ink is the edge that meets the surrounding page grid seamlessly; the edge it fades out
  at is the one that must read as open. `top` fades out upward (ink settles at the
  bottom), `bottom` the reverse.
- **For a one-off fade on a single element, use Tailwind's own `mask-t-from-*` /
  `mask-radial-*` utilities** — they are alpha-based, therefore token-safe, and already
  in the framework. Reach for `data-decoration-fade` only for the ambient ground.

**② FRAME — structural, exactly once per sheet.** Corner registration ticks + a
title block (+ optional registration mark) on the **outer sheet only**. Use a single
`<BlueprintSheet>` at the page root to own this. **Inner panels never repeat the
frame** — one drawing, one frame, one title block.

**③ ANNOTATION — semantic, sparse, author-placed.** Drawing furniture is added only
where the content's _meaning_ earns it:

| Content role                    | Furniture                                          | NOT on              |
| ------------------------------- | -------------------------------------------------- | ------------------- |
| image / media slot              | `PlaceholderBox` (✕) + `FigAnnotation`             | every card          |
| a measurement / spec / quantity | `DimensionLine`                                    | arbitrary elements  |
| explaining specific parts       | numbered `Callout` + leader                        | list rows           |
| hero / emphasis / active range  | `bg-hatch` band                                    | general backgrounds |
| the sheet identity / metadata   | `TitleBlock` + corner ticks (via `BlueprintSheet`) | inner panels        |

## The budget (the tasteful rule)

- **At most one focal drafting gesture per visual region.** If two compete, drop one.
- **Decoration density goes DOWN as information density goes UP.** A dense `DataTable`
  gets only the grid + ruled cell borders — no callouts, no hatch, no ticks. A spacious
  hero / figure / empty-state can carry one dimension line or a hatch band.
- **Grid is the only thing that may be "everywhere"** — and only because it's faint.
  Everything else is an exception that must be justified by the content.
- When unsure, **omit**. The grid + hairline borders already say "blueprint."

## Interaction states (supplied by the theme)

The theme — not each component — speaks the interaction language, so it works on any
screen without per-component edits (in `themes.css`, scoped to `[data-theme="blueprint"]`):

- **Interactive = hatch, not a flat wash.** Hovering any interactive element
  (`button`, `[role=button|menuitem|tab|option|link]`, `a`, `summary`) lays a gentle
  half-transparent diagonal hatch (`--bp-hatch`) over its background. Active / selected
  / current states (`[data-active]`, `[aria-selected]`, `[aria-current]`,
  `[data-state=active|on]`) carry a slightly stronger persistent hatch (`--bp-hatch-strong`).
- **Filled controls are DRAWN, never solid plates.** `bg-primary` / `bg-secondary` /
  status fills (`bg-destructive|success|warning|info`) are reduced to: transparent
  ground + white hairline border + faint hatch + white ink. A primary button reads like
  a wireframe button (outline + hatch), not a white block. (`text-*-foreground` is
  overridden to the white ink so labels stay legible on the transparent ground.)
  - **The override only re-inks the element that ITSELF carries the `bg-*` class**
    (`decoration.css`'s selector is class-scoped, not a descendant rule). A
    `-foreground` companion-token utility (`text-primary-foreground`, …) is only
    guaranteed theme-correct on that SAME element; a descendant that needs the
    same ink must INHERIT `color`, never re-declare its own `text-*-foreground`
    (especially not an alpha-faded `/N` variant) — doing so silently steps
    outside the override and renders illegibly in blueprint (#393, fixed in
    `CTASection`: the description `<p>` now inherits from the `.bg-primary`
    section root exactly like the heading does).
  - **The six role fills collapse to ONE identical drawn appearance on purpose**
    (hue-independent, "drawn not filled" above) — so `bg-<status>` alone cannot
    carry status meaning in blueprint, on either idiom: the opaque fill (this
    override) or the sanctioned `bg-<status>/10` wash (`styling-and-tokens.md`
    Surface separation), whose own low-chroma, lightness-only palette measures
    ΔE ≈0.012 between adjacent status roles. A status rendered in blueprint MUST
    also carry the `[data-status]` non-colour line-type channel below (#391) —
    color is never sufficient there.
- The focus ring (white) is untouched and still the strongest interaction signal.
- **Status = line type, not colour, at high decoration.** `[data-status="…"]`
  (already emitted by `StatusBadge`/`Timeline`/`StatusIcon`) picks a
  `border-style`/`border-width` per the canonical 7-state vocabulary
  (`pending` dotted · `running` dashed · `complete` solid · `awaiting-approval`
  solid+2px · `failed` double · `denied`/`skipped` dotted, deliberately sharing
  one step) — the same theme-supplied, zero-component-change pattern as
  `[data-polarity]`'s glyph above. It rides the SAME `[data-theme="blueprint"],
[data-decoration="8|9|10"]` scope and layers AFTER the drawn-controls override
  so the two compose (transparent/hatch/ink from the fill rule, line type from
  this one). See `packages/tokens/src/decoration.css` and
  `pnpm decoration-collapse:check` (#391), which fails if a role-fill collapse
  ever ships again without a compensating non-colour rule in the same scope.

## How to apply

1. Wrap the screen once in `<BlueprintSheet titleBlock={<TitleBlock … />}>` — that is
   the frame. Do not add `BlueprintFrame`/ticks to every panel.
2. Let ordinary panels (`Card`, `Sidebar`, tables) render normally — the theme grids
   the field and draws hairline borders for free.
3. Add an annotation **only** when a specific element matches a row in the table above.
4. Reserve `BlueprintFrame` for a genuinely _featured_ drawing region (a diagram, a
   spec callout) — not as a default panel wrapper.

## Verify (don't self-confirm)

Judge the theme on a **real app scenario** (e.g. `scenarios-agentic-ai-workspace--default`)
under `globals=theme:blueprint`, not on demos authored to look right. Confirm the other
themes are untouched (same screen under `qlik-bright`/`dark` — no grid leak). See
@.claude/rules/styling-and-tokens.md and @.claude/rules/editor-components.md siblings,
and the `@qlik-coe-emea/qlabs-components-blueprint` package.
