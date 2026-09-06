---
# Path-scoped (Claude Code lazy-loads this only when a matching file is touched) — not
# always-on context. Scoped to the decoration tokens
# (decoration.css/themes.css live in @elabs-ai/components-tokens). See `.claude/rules/quality-gates.md`
# "Enforcement over reminders" and the `rules:scoping:check` gate.
paths:
  - "packages/tokens/**"
---

# Decoration (backgrounds only, never flat)

`--decoration` (0–10) is ORTHOGONAL to color and HUE-INDEPENDENT (grid ink = the theme's
`--foreground`): 0 = plain themed UI; 10 = drafting-sheet ground, squared large radii, no
shadows.

## Rules

1. **BACKGROUNDS and CHART FILLS only** — the ambient ground, an opt-in region ground, a
   chart's pattern fills at high decoration.
2. **NEVER inside a control** — no hatch on a button/input/menu item/tab/link, no
   "drawn-not-filled" role plates, no texture on a badge/timeline dot/code token; a control
   is identical at 10 and 0 bar the shape/elevation dials below. Re-inking role fills to one
   appearance collapses them (WCAG 1.4.1); `pnpm decoration-collapse:check` guards it.
3. **NEVER flat** — every ground paints on a masked `::before` layer that fades (vignette by
   default, or a caller-picked direction). Mask the LAYER, never the host (it would fade the
   host's children).

## Dial

- **Theme:** a theme block may set `--decoration` (both reference themes ship 0);
  `themes.css` "DECORATION DIAL", `decoration.css`.
- **Region:** `data-decoration="N"` or `<DecorationProvider level={N}>`
  (`@elabs-ai/components-tokens`) dials a subtree, theme unchanged.
- **Document:** `ThemeProvider`/`useDecoration()` persist an override (`null` = theme
  default).
- **Ramp:** ground ink is CONTINUOUS (inert at 0); the BINARY axes (shadowless, squared
  xl/2xl/3xl) switch in only at 8–10.
- Font and chart ramp are **palette-bound**, not dial-bound.

## Ground

- **Painted ONCE, behind the page, faded:** `[data-decoration] body::before`, a fixed masked
  layer carrying `--deco-grid`; opaque surfaces cover it. Never re-rule every surface —
  `.bg-background`/`.bg-card`/`.bg-surface*` get no grid of their own.
- **`position: fixed` on the layer, never `background-attachment: fixed` on a surface**
  (#29 item 3); `pnpm decoration:check` fails one outside a pointer-device media query.
- **`data-decoration-fade="top|bottom|edges|center"`** gives ONE region its own ground: it
  spends that region's focal gesture; never mask the host itself (`pnpm decoration:check`);
  pick the direction by the SEAM — full ink where it meets the page ground, fade-out where
  it must read as open (`top` fades out upward, ink settles at the bottom; `bottom` the
  reverse).
- **One-off fade on one element:** Tailwind `mask-t-from-*`/`mask-radial-*`;
  `data-decoration-fade` is for the ambient ground only.
- **Opt-in paper `bg-paper`/`bg-dot-grid`/`bg-grid-paper`:** NOT on the dial (any level);
  a masked `::before` fading with `--paper-fade` (vignette default; override
  `[--paper-fade:var(--deco-fade-top)]`).

## 8–10: shape and elevation only

- **Shadowless:** `--shadow-strength: 0` zeroes every stacked shadow layer; the
  `shadow-ring-*` hairline is NOT dialled, only re-pointed at the theme's rule ink, and that
  rule stays UNLAYERED with its doubled `[data-decoration]` — `pnpm elevation:check`
  enforces both (`decoration.css`, `docs/ADR/0020-stacked-elevation-ramp.md`).
- **Squared large radii:** `--radius-xl/2xl/3xl` → 0; the base `--radius` scale is a theme
  decision.

## Budget

- At most ONE focal drafting gesture per visual region; if two compete, drop one.
- Density goes DOWN as information density goes UP — a dense `DataTable` gets the ambient
  ground and nothing else; only the ambient ground may be "everywhere" (faint, faded),
  everything else the content must earn. When unsure, **omit**.
- **Ink strength:** `themes.css` alphas are deliberately low;
  `decoration-ink-contrast.test.ts` locks the composited hairline into a legible-but-quiet
  band per theme — retune there plus the test's bands, never in a component.

## Verify

Judge on a **real app scenario** (e.g. `patterns-scenarios-agentic-ai-workspace--default`)
under `data-decoration`, not on self-authored demos: decoration 0 untouched (no grid leak);
a button, an input and a badge identical at 10 and 0 —
`Foundations/Decoration → ControlsAreUntouched` is the executable form.

History and measurements: docs/rules-history/decoration.md
