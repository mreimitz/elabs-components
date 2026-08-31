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
Data: `--chart-1..12`. Shape: `--radius` (+ derived `--radius-sm/md/lg/xl`).

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
