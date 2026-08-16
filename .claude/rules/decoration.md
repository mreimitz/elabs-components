---
# Path-scoped (Claude Code lazy-loads this only when a matching file is touched) — not
# always-on context. Scoped to the decoration tokens
# (decoration.css/themes.css live in @elabs/components-tokens). See `.claude/rules/quality-gates.md`
# "Enforcement over reminders" and the `rules:scoping:check` gate.
paths:
  - "packages/tokens/**"
---

# Decoration policy (backgrounds only, and never flat)

The **decoration DIAL** (`--decoration`, 0–10) is ORTHOGONAL to color. 0 = a plain
themed UI; 10 = a drafting-sheet ground with squared large radii and no shadows. It
is HUE-INDEPENDENT — the grid ink derives from the active theme's own `--foreground`,
so gentle drafting texture can ride ANY palette, not just a blue one.

## The three rules that govern every decoration change

**1. Decoration paints BACKGROUNDS and CHART FILLS. Nothing else.**
The ambient ground behind the page, an opt-in region ground, and the pattern fills a
chart uses instead of flat colour at high decoration. That is the whole permitted
surface area.

**2. It NEVER reaches inside a control.** No hatch on a button, input, menu item, tab
or link. No "drawn-not-filled" role plates. No texture on a badge, a timeline dot or a
code token. A control renders identically at decoration 10 and at decoration 0, apart
from the shape/elevation dials in §"What high decoration still does". Two reasons, and
both are load-bearing:

- Texture inside an input is noise exactly where someone is reading their own typing.
- Re-inking `bg-primary`/`bg-secondary`/`bg-destructive`/`bg-success`/`bg-warning`/
  `bg-info` to one transparent+hairline appearance **collapsed six semantic roles into
  one** (WCAG 1.4.1), which is why this file used to carry a whole compensating
  non-colour vocabulary — `[data-status]` line types, `[data-polarity]` glyphs,
  per-role weight/underline cues in the calc editor. All of that existed to repair
  damage the dial was doing. Don't paint controls and the problem does not exist.

**3. A background decoration is NEVER flat.** Every ground paints on a masked
`::before` layer so it fades into transparency — a vignette by default, a direction
when the caller picks one. An edge-to-edge uniform texture reads as _printed on_, not
as paper. The mask goes on the LAYER, never on the host: `mask-image` on the surface
itself fades the host's CHILDREN (text, controls) with it.

## The dial (how to set it)

- **Theme default:** a theme block may set `--decoration` (both reference themes ship
  0). See `themes.css` "DECORATION DIAL" + `decoration.css` (overlay rules).
- **Region:** put `data-decoration="N"` on any element (or use
  `<DecorationProvider level={N}>` from `@elabs/components-tokens`) to dial a subtree —
  a diagram, panel, or page — without changing the theme.
- **Document:** `ThemeProvider` / `useDecoration()` persist a document-level override
  (`null` = follow the theme's default).
- **Ramp:** the ground ink is CONTINUOUS — it fades in with the dial and is inert at 0.
  The BINARY axes (shadowless, squared xl/2xl/3xl) switch in only at 8–10. They are
  SHAPE and ELEVATION dials: they remove a gesture rather than paint one, which is why
  they are allowed to reach a control at all.
- A theme's font and chart ramp are **palette-bound**, not dial-bound — a level-6
  region keeps its theme's font and colors.

## The ground

**Painted ONCE, behind the page, faded.** `[data-decoration] body::before` is a fixed,
masked layer carrying `--deco-grid`. Opaque surfaces simply cover it, the way a panel
on a desk covers the paper under it.

**Do not re-rule every surface.** The previous version painted the grid on `body` AND
`.bg-background` AND `.bg-card` AND every `.bg-surface*`, so each panel stacked a
fresh, full-strength, crisply-clipped grid inside itself. That is the single biggest
reason the texture read as aggressive, and it is the first thing to check if someone
reports the decoration being loud again.

**`position: fixed` on the layer, never `background-attachment: fixed` on a surface.**
The fixed layer is what makes the sheet read as one continuous surface the panels are
cut out of; the old attachment did the same job but repainted the viewport on every
scroll frame (the touch-jank source, #29 item 3). `pnpm decoration:check` fails a
`background-attachment: fixed` outside a pointer-device media query.

**Region ground — `data-decoration-fade="top|bottom|edges|center"`.** One region gets
its own faded ground: a hero band, a canvas strip, a section that has to recede under
content. Same mechanism as the ambient sheet. Rules:

- **It spends the region's one focal drafting gesture** (see The budget).
- **Never mask the host itself** — that is the failure `pnpm decoration:check` locks out.
- **Pick the direction by the seam,** not by taste: the edge where the fade reaches FULL
  ink is the edge that meets the surrounding page ground seamlessly; the edge it fades
  out at is the one that must read as open. `top` fades out upward (ink settles at the
  bottom), `bottom` the reverse.
- **For a one-off fade on a single element, use Tailwind's own `mask-t-from-*` /
  `mask-radial-*` utilities** — alpha-based, therefore token-safe, already in the
  framework. Reach for `data-decoration-fade` only for the ambient ground.

**Opt-in paper utilities — `bg-paper` / `bg-dot-grid` / `bg-grid-paper`.** Deliberately
NOT on the dial: you ask for one on one element and you get it at any decoration level.
They obey rule 3 the same way — each paints on a masked `::before` and fades with
`--paper-fade` (default: a vignette; override per element with
`[--paper-fade:var(--deco-fade-top)]`).

## What high decoration still does to a control

Only shape and elevation, and only at 8–10:

- **Shadowless.** One knob — `--shadow-strength: 0` — mixes every stacked shadow layer
  to transparent. The `shadow-ring-*` hairline is deliberately NOT dialled (a drawn
  surface keeps its edge, it just stops being lit) and is re-pointed at the theme's rule
  ink. The rule must stay UNLAYERED and keep its doubled `[data-decoration]`; both are
  enforced by `pnpm elevation:check` and explained in `decoration.css`.
- **Squared large radii.** `--radius-xl/2xl/3xl` go to 0 (the base `--radius` scale is
  a theme decision, not a dial one).

## The budget (the tasteful rule)

- **At most one focal drafting gesture per visual region.** If two compete, drop one.
- **Decoration density goes DOWN as information density goes UP.** A dense `DataTable`
  gets the ambient ground and nothing else.
- **The ambient ground is the only thing that may be "everywhere"** — and only because
  it is faint and faded. Everything else is an exception the content must earn.
- When unsure, **omit**.

## Ink strength

The alphas in `themes.css` are deliberately low (grid minor 0.05, major 0.09 at full
dial). `decoration-ink-contrast.test.ts` locks the resulting composited hairline into a
legible-but-quiet band per theme, so a palette edit cannot silently erase the ground —
or make it shout. Retuning belongs in that token block plus the test's bands, never in
a component.

## Verify (don't self-confirm)

Judge the dial on a **real app scenario** (e.g. `scenarios-agentic-ai-workspace--default`)
under `data-decoration`, not on demos authored to look right. Confirm decoration 0 is
untouched (same screen with no dial — no grid leak), and confirm a button, an input and
a badge look the same at 10 as at 0 — `Foundations/Decoration → ControlsAreUntouched`
is the executable form of that check. See @.claude/rules/styling-and-tokens.md and
@.claude/rules/editor-components.md siblings.
