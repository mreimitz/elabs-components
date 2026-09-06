# Styling & tokens

- Semantic tokens only (Tailwind v4): `bg-background`, `text-foreground`, `border-border`….
- No raw colors in components (hex, `rgb()`, `bg-[#fff]`); they live only in
  `packages/tokens/src/themes.css` and registry `registry:theme` items.
- `cn()` (`clsx` + `tailwind-merge`) merges every class list.
- Spacing/radius: the Tailwind scale; `rounded-*` backed by `--radius`. No ad-hoc values.
- Focus: `focus-ring` on every interactive element (`focus-ring-within`: compound control;
  `focus-ring-inset`: clipped by overflow; `focus-ring-static`: focus proxied by a hidden input
  or `focus-visible:after:`). Never
  `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`. Retarget:
  `focus-ring [--focus-ring-color:var(--sidebar-ring)]`. ADR 0027.
- `border` vs `border-strong` (ADR 0010): `border-border` (default) = redundant boundary
  (fill/elevation/shadow/spacing also mark the edge); `border-border-strong` (≥3:1 vs
  `--card`/`--background`) = the only cue between same-surface regions (row dividers,
  `Separator`, no-fill controls); not guaranteed over `--surface-muted`/`--muted`/`--secondary`
  (there: `border` + a redundant cue). `border-input` = the SUBTLE form-field hairline
  (== `--border`, not strong), a distinct token, on every form control. Test: _"If I deleted
  this line, could a sighted user still tell the two regions apart?"_ Yes → `border`. No →
  `border-strong`.
- Status rung for a MARK: the FILL rung (`bg-<tone>`/`border-<tone>`/`text-<tone>`) is the
  mark, ≥3:1 on `--background`/`--card`/`--muted`/`--surface-muted`/`--secondary` in every
  theme (`themes-contrast.test.ts`); `text-<tone>-foreground` is ONLY ink on a solid `bg-<tone>`
  plate, never on a `/10` wash or bare surface; `text-<tone>-text` is coloured TEXT on an
  ordinary surface (≥4.5:1). Test: _colour behind text I control (`-foreground`), colour OF
  text (`-text`), or colour of a shape (fill)?_
- Shallow DOM: one element owns one job.
- New visual concept = new token: `--foo` in every theme block of `themes.css`,
  `--color-foo: var(--foo)` in `@theme inline`, then `bg-foo`/`text-foo`. Never a literal.
- Add new packages to each app CSS's `@source` directives (Tailwind content scanning).
- `MetricCard` is owned by `@elabs-ai/components-ui`; `-charts`/`-editor` re-export it (ADR 0012).

## Typography

- Type is a role: `text-<role>` (`display`/`title`/`subtitle`/`body`/`caption`/`meta`/`kpi`/
  `code`) or `<Heading>`/`<Text>`, never raw `text-sm`/`text-[17px]` in component source.
  `--text-body == text-sm` by design: raise title/display/kpi for hierarchy, never shrink body.
- Roles bundle size + leading + weight + tracking and stay composable; never re-bundle with
  `@utility`.
- `kpi` + `tabular-nums`; `code` + `font-mono`.
- Font seams: `--font-display` (default `var(--font-sans)`) and `--font-mono`; root-only,
  parity-allowlisted.
- Density scales type: `--type-factor` (`density.css`) multiplies every role's size and
  line-height: compact 0.9375 / comfortable 1 (= unchanged) / spacious 1.0625; weight and
  tracking never rescale. Floor: body ≥ 13px, no role < 11px. The dial reaches role-typed text
  only (never claim it scales a screen's type; close the gap via the ratchet). `text-xs` →
  `text-meta` also adds `letter-spacing: 0.01em` + `font-weight: 500`. Mechanism: rem literals
  in `themes.css` § TYPE SCALE BASE → `@theme` `--text-*` roles → per `[data-density]`
  `calc(base × var(--type-factor))`; edit the base layer, never a component.
- Gate: `pnpm text-scale:check`, per-file ratchet vs `scripts/text-scale-baseline.json` (down
  only; `--update` after cleanups); covers `*.stories.tsx` + `apps/docs/stories/**` (a real
  type-scale demo: baseline + inline ESLint disable with a reason); only `*.test.*` exempt;
  registry warns only.
- `*Description` parts: full width by default; `measure?: boolean` (caller-set, never inferred)
  opts into `max-w-prose`; `text-balance` is unconditional. Test: short label → no `measure`;
  real prose → `measure`. No third variant or bespoke prop.

## Surface separation

- One focal gesture per region, by role:
  - fill/zone: `bg-surface-muted` (neutral), `bg-chat-user`, `bg-<status>/10` wash (attention;
    never mint `-subtle` tokens; in a low-chroma palette two washes read alike: add a
    non-colour channel, @.claude/rules/accessibility.md);
  - accent rail: `border-s-2` (quiet) / `border-s-4` (emphatic) + `border-s-<role>`: `primary`
    answer/completed, `info` in-progress, `muted` technical, `border-strong` structural attention;
  - elevation: ground offset always, shadow light-only; raised `bg-card` (+ `shadow-md` when
    floating), recessed field under a card `bg-background`. A `bg-surface-muted` well is
    LIGHT-ONLY (inverts on dark): raise the focus pane with `card`;
  - divider/space: `gap-*`, or one `border-t`/`Separator` (`border-strong` when sole cue).
- No redundant border on a region with a non-default fill, rail or elevation unless it is the
  SOLE structural cue; complementary combos are fine; a border that is sole-cue under decoration
  (shadow zeroed) stays (`Artifact`).
- No generic `<Surface>`/`<Panel>`: `Card` is the one generic surface and keeps its border.
- Chrome < canvas < raised: `bg-sidebar` < canvas `bg-background` (`SidebarInset`) < `bg-card`.
  Every theme keeps `L(--background) − L(--sidebar) ≥ 0.02`; fix flatness in `--sidebar`, never
  in components.
- Gates: `pnpm separation:check` (ratchet vs `scripts/separation-baseline.json`) and
  `pnpm surface-elevation:check`.

## Elevation (`docs/ADR/0020-stacked-elevation-ramp.md`)

- Never hand-roll a shadow (`box-shadow`, `boxShadow`, `shadow-[0_4px_…]`). One ramp in
  `themes.css` § ELEVATION RAMP: `shadow-2xs`/`xs`/`sm`/`md`/`lg`/`xl`/`2xl`.
- Floating surface = `shadow-ring-*`, no border: dialogs, sheets, popovers, menus, selects,
  palettes, toasts, tooltip panels, map popups, canvas furniture. `border shadow-md` →
  `shadow-ring-md`; never `border`/`ring-*` beside `shadow-ring-*`.
- Resting surface keeps its border (`Card`, `Artifact`, composer well, form fields, flow nodes)
  with `shadow-sm`/`xs`; `hover:shadow-md` on a card is a fine lift.
- High-contrast chip (`Tooltip`, map label tooltips, pill tickers) = plain `shadow-*`, no ring,
  no `border`.
- `shadow-hairline`: bare 1px edge, no lift/layout box; retint via
  `[--shadow-ring-color:var(--token)]`; replaces `shadow-[0_0_0_1px_…]`.
- Reach by role, not size: a knob or marker dot takes `xs`/`sm`, never `lg`.
- Retune in the THEME only: `--shadow-color` (ink), `--shadow-strength` (alpha multiplier,
  `0` = shadowless), `--shadow-ring-color` (hairline, outside the strength dial).
- The ring is a redundant boundary, not a 1.4.11 cue; a sole cue still takes
  `border-border-strong`.
- Gate: `pnpm elevation:check` (`registry/` warn-only).

History and measurements: docs/rules-history/styling-and-tokens.md
