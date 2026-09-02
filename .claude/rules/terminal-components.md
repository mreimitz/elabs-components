---
# Path-scoped (Claude Code lazy-loads this only when a matching file is touched) — not
# always-on context. See `.claude/rules/quality-gates.md` "Enforcement over reminders" and
# the `rules:scoping:check` gate (scripts/check-rule-scoping.mjs).
paths:
  - "packages/terminal/**"
---

# Terminal components (`@elabs-ai/components-terminal`)

Two kinds of thing live here and they must not be confused:

1. **Real terminals** — `Terminal` (a read-only ANSI log) and `InteractiveTerminal`
   (a live xterm.js surface). They render output a process actually produced.
2. **The agent-session family** (#117) — a coding-agent CLI _look-alike_
   built from ordinary React and semantic tokens. It renders a model an app
   supplies. It is not a terminal emulator and must never become one.

If a consumer wants a real terminal they already have one. A pixel-faithful
look-alike would be a strictly worse `Terminal`, which is why the family's
fidelity axis is settled below rather than left to each builder.

## The mechanism: console as a SURFACE

Console-ness is **a ground, a type role, and a two-column grid** — not twelve
components each restating them. `TerminalSurface` establishes all three once and
publishes exactly one value, `variant`, through a minimal context. Every row is
an independent component that renders a `TerminalRow` grid, reads `variant` from
that context, and accepts a `variant` prop that overrides it.

- **Coherence comes from the cascade plus one grid primitive** — systemically,
  the bias `conceptual-framing.md` states outright. `data-decoration` /
  `DecorationProvider` is the same pattern already in the repo.
- **A row dropped outside a surface still renders.** `useTerminalVariant()`
  falls back to `marker`. A surface is not a required provider.
- **Nothing else may ever be added to that context.** The moment it carries
  transcript state, expansion state or a clock, this family becomes a provider-
  shaped compound component, every work unit touches one file, and the parallel
  dispatch collapses. Row expansion is per-row Radix `Collapsible` state;
  elapsed time is a caller-supplied `elapsedMs` prop (the precedent is
  `@elabs-ai/components-ai`'s `TurnStatus`, which takes `elapsedMs` rather than
  running a timer). Neither belongs in context. **This is the single rule most
  likely to be eroded by a well-meaning refactor.**

### Alignment lives on the surface, not in the rows

`TerminalRow` is `grid-cols-[var(--terminal-gutter)_minmax(0,1fr)]`.

- **`--terminal-gutter` is a LOCAL custom property** written by `TerminalSurface`,
  **not a theme token.** It does not vary by theme and no other package needs it;
  "adding a visual concept = adding a token" in `styling-and-tokens.md` governs
  visual concepts expressed as _colour_, not layout constants. Do not add it to
  `themes.css`. A caller's own `style` overrides it.
- **`minmax(0, 1fr)` is load-bearing.** A bare `1fr` has an `auto` minimum, so it
  refuses to shrink below its content and a long path blows the row out of the
  surface instead of wrapping. `min-w-0` on the content cell is the same fix one
  level down — it is the silent culprit behind most "why won't this truncate?"
  bugs (`interaction-guidelines.md` § Content handling).
- Because the gutter is a grid _track_, a wrapped continuation line aligns under
  the content column for free. **That is why no `ch`-unit arithmetic is needed
  anywhere in this package** — and `ch` alignment is banned precisely because a
  grid does the job without breaking at a font fallback.

### The variant axis, named without a vendor

| `variant`            | Grammar                                           | Reads as               |
| -------------------- | ------------------------------------------------- | ---------------------- |
| `marker` _(default)_ | a glyph in the gutter cell                        | bullet-transcript CLIs |
| `rail`               | a vertical rule down the gutter, glyph suppressed | bar-prefixed CLIs      |
| `boxed`              | a square `border-terminal-border` per block       | frame-drawing CLIs     |

One axis, three values. **No vendor name, no vendor logo, and no vendor
mode/effort union in any public type** — an acceptance criterion of #117, not a
preference. A component named after a product, or a `type Mode = "auto" |
"accept-edits" | "plan"`, is a review failure.

## The console is ONE frame (ADR 0033 — settled, do not re-derive)

The family's twelve components were each correct and the assembled screen was not:
the transcript, the composer, the banner and the permission prompt all root on
`TerminalSurface`, so each drew its own `rounded-lg border … shadow-sm` with a
strip of page background between them, and `TerminalStatusBar` — a `border-t` and
nothing else — hung underneath like a page footer. The stack was **implied by one
component's styling and written down nowhere**, so every builder re-derived it.
`docs/ADR/0033-terminal-console-frame-and-regions.md` is the durable record.

Three nouns, fixed:

- **frame** — the console window. Exactly one per console. Draws
  `rounded-lg border border-terminal-border bg-terminal-background shadow-sm` plus
  the mono/`text-code` role. `TerminalConsole` is the frame; **a lone
  `TerminalSurface` on a page is also a frame**, so every standalone story is
  unchanged.
- **region** — transcript, banner, permission prompt, composer, status bar. Draws
  its own padding and content and **never** a radius, a shadow, a ground or an
  outer border.
- **seam** — the boundary between two adjacent regions: one
  `border-t border-terminal-border`, **owned by the frame**
  (`[&>*+*]:border-t`), never a gap of page background.

What this means when you compose or review:

- **Never stack two framed pieces.** Inside a `TerminalConsole` there is no page
  background, no second radius and no second shadow. Three resting surfaces 16px
  apart is ADR 0020's double edge restated at composition scale.
- **`TerminalStatusBar` is region-only.** It has no standalone frame _by
  contract_. A story or block that renders it outside a frame is the bug.
- **Frame-awareness is inherited, never passed.** `TerminalSurface` reads a
  second, static frame context and omits its frame classes when one is above it
  (and adds `ring-inset`, because the frame clips and an outset ring would be cut
  on three sides). It **omits rather than negates**, so a caller who really wants
  a framed region adds the classes back through `className` and `cn()` resolves it.
- **The frame context is bound by the same prohibition as the variant context**
  above: one static boolean, forever. `TerminalConsole` holds no transcript, runs
  no timer, owns no scroll container and publishes no `variant`.
- **A region that needs more presence gets a ground, a seam or spacing — never a
  border.** Re-boxing the composer inside the frame is the repair that was
  rejected; a recessed fill is the sanctioned one, and it is a token decision that
  routes through `brand-ui-design-system-architect`.

## The fidelity axis (settled — do not re-litigate per component)

**Terminal-_flavoured_, web-native: faithful information design, web-native
mechanics.** Reproduce the _grammar_ at high fidelity; reproduce the _mechanics_
as web.

|              | NOT this                             | THIS                                     |
| ------------ | ------------------------------------ | ---------------------------------------- |
| Borders      | box-drawing characters `╭─╮` as text | `border-terminal-border`, square corners |
| Alignment    | `ch` units, fixed grid               | CSS grid, elastic content column         |
| Caret        | hand-drawn block caret               | native caret + `--terminal-cursor`       |
| Disclosure   | native `<details>` / ANSI redraw     | Radix `Collapsible`                      |
| Focus        | a hand-rolled index walk             | real `focus-visible:ring-ring`           |
| Overlays     | full-screen redraw                   | Radix `Dialog`                           |
| Long content | truncate at the column               | wrap, clamp, `Collapsible` "show more"   |

Box-drawing characters as borders are a genuine accessibility defect: a screen
reader reads them aloud, and they collapse at any monospace-font fallback. The
`boxed` variant uses a real `border`, which reads as box-drawing at monospace
scale without shipping a single `╭`.

## The gutter glyph is never the only channel

`TerminalRow` hides a bare `gutter` glyph from assistive tech (a screen reader
announcing "black medium square" is noise). When the glyph carries MEANING —
a status, a diff polarity, a todo state — pass **`gutterLabel`** and the row
emits an `sr-only` word beside it, **in every variant, including `rail`, which
suppresses the glyph but never the meaning**.

Colour and glyph are both _visual_ channels. `gutterLabel` is the third one WCAG
1.4.1 asks for. Because it lives on the primitive, ten sibling components
inherit it instead of each re-deriving it — and a smoke test that asserts the
announced words is the assertion the quality gates require. **Asserting that two
class strings differ passes on colour-only code and proves nothing.**

## This package owns no scroll container

`TerminalSurface` deliberately does not scroll. A transcript over ~50 rows must
be virtualized by the caller (`interaction-guidelines.md` § Performance), and a
scroll container in here would fight the caller's virtualizer. Rows are plain
elements; the caller supplies the viewport.

**When that caller-owned viewport bottom-anchors, use `mt-auto` on the first
child — never `justify-end` (measured, 2026-09-02).** A console transcript wants
its newest line just above the composer, the way a real terminal's cursor sits,
rather than floating at the top of a surface stretched to the viewport. Both
utilities do that. Only one of them stays scrollable: `justify-content: flex-end`
strands overflow at the **start** of a scroll container — Chrome reports
`scrollHeight === clientHeight`, so the earliest rows render above the box with
no scroll range that reaches them. Measured on
`patterns-templates-terminal-agent-session--default` at 1440×900: `justify-end`
left **190px of transcript unreachable** with a zero scroll range;
`[&>*:first-child]:mt-auto` anchors identically and reports `scrollHeight` 824
against `clientHeight` 622 with a 202px scroll range.

- **It is invisible to every gate we have.** jsdom lays out nothing, so a unit
  test cannot see it; the story still renders, still passes axe, and still
  passes its play function, because the visible content is correct — it is the
  content you _cannot_ reach that is missing. It surfaced only from probing
  `scrollHeight`/`clientHeight` in a real browser. Probe those two numbers on any
  bottom-anchored region rather than trusting the screenshot.
- **Whether `TerminalSurface` should default to this is open** — it appeared
  independently in three compositions, which argues for a default, but changing
  a shipped component's layout behaviour is an architect decision, not a
  composition-level one.

## Reuse means PROMOTION, never a sideways import

`@elabs-ai/components-terminal` and `@elabs-ai/components-ai` are **siblings**:
`scripts/check-dep-direction.mjs` gives `terminal` `[tokens, icons, ui]` and
gives `ai` no edge to `terminal`. Neither may import the other.

So a model or helper shared by both moves **UP** into
`@elabs-ai/components-ui/src/lib/*` and is barrel-exported. Already promoted and
therefore **never to be re-declared here**: `SlashCommand` /
`defaultSlashCommandFilter` / `stepIndex` · `ApprovalScope` / `ApprovalOption` /
`APPROVAL_SCOPE_DESCRIPTION_KEYS` · `DiffLine` / `DiffLineType` /
`diffLineMarker` / `diffLineAccessibleLabel` · `collapseDiffRows` /
`useDiffRows` · `OperatingMode` / `EffortLevel` / `effortRungForIndex` ·
`AgentEventPhase` / `AgentEventOutcome` / `agentEventOutcomeStatus` ·
`SessionCapability` / `SessionWhatsNewItem` / `SessionQuickAction`.

Also already in `ui` and equally off-limits to re-implement: `formatElapsed`,
`CheckResult`/`CheckSummary`, `findTriggerQuery`/`replaceTriggerRun`,
`Status`/`StatusIcon`, `TimelineStatus`, `Skeleton`, `EmptyState`,
`KeyboardShortcuts`, `Collapsible`, `RadioGroup`, `Dialog`, `Kbd`, `Textarea`,
`useLocale`, `cn`.

**The promotion test — all three must hold**, or it stays where it is: (1)
AI-SDK-free (no Vercel `ai` type in the signature — `ui` must never gain that
dependency); (2) headless (a type, a pure function or a hook — never a
component, which would fatten the foundation every package peer-depends on);
(3) two real consumers exist _today_, not "might be shared later".

A duplicated model is not a shortcut — two types that structurally agree today
drift tomorrow, which this wave already had to repair once.

## Colour comes from the terminal token group, and nowhere else

The `--terminal-*` / `--terminal-ansi-*` group (#115) is defined in every theme.
`bg-terminal-background`, `text-terminal-foreground`, `text-terminal-muted`,
`border-terminal-border`, `text-terminal-ansi-bright-green` and their siblings
are real utilities.

- **No hex, no `rgb()`/`hsl()`, no arbitrary colour value, no raw Tailwind
  palette utility (`text-zinc-400`), no inline `<style>` block.** Enforced by
  `packages/terminal/src/no-raw-color.test.ts`, which strips comments before
  scanning (issue references are hex-shaped) and carries an explicitly
  enumerated allowance for `InteractiveTerminal`'s xterm fallbacks — xterm
  paints on a canvas and cannot read a CSS custom property. A new raw colour
  cannot hide behind that allowance.
- **The console ground is NOT a page surface, so the app's status INK tokens do
  not hold here (measured, #117 T4).** `text-<tone>-text` is authored to clear
  4.5:1 against `--background` / `--card`; `--terminal-background` is a
  different, darker ground it was never measured against. A real axe run in
  Chromium put `text-destructive-text` on `--terminal-background` at **2.57:1**
  — a genuine WCAG failure that every unit test in the package passed straight
  over, because jsdom computes no contrast. So:
  - **Text on the console ground takes `text-terminal-foreground` /
    `text-terminal-muted`, or an ANSI ink.** The `--terminal-ansi-*` group is
    authored to clear ≥4.5:1 against `--terminal-background` (that invariant is
    documented and re-derived at runtime by `readableInk()` in
    `interactive-terminal.tsx`, which clamps any revalued token back to AA).
  - **A status tone may still tint a GLYPH**, which is a non-text mark and is
    judged at 3:1, not 4.5:1 — `text-terminal-ansi-bright-red` on the icon,
    `text-terminal-foreground` on the word beside it. That is the shape of the
    fix that landed in `terminal-status-bar.tsx`, and it keeps the colour as a
    redundant cue rather than the carrier.
  - **Corollary: a unit test cannot clear a component of this.** The browser
    pass (`cd apps/docs && pnpm exec vitest --project storybook run <name>`,
    then again with `STORYBOOK_THEME=dark`) is where it surfaces, which is why
    it is not optional for a component that paints ink on this ground.
- **The INVERSE also bites: a generic `ui` component nested inside the console
  inherits the console's ink and repaints its own box the wrong colour
  (measured, #117 T10).** `TerminalSurface` sets `text-terminal-foreground` on
  its root, and that inherits down the whole subtree. A `ui` primitive that
  paints its **own opaque surface** — `Textarea`, `Input`, `Select`, a `Card`,
  anything carrying `bg-background`/`bg-card` — is an ordinary app box sitting
  _inside_ the console, not a patch of console ground. It keeps its own `bg-*`
  but inherits the console's light ink, so it renders light-on-light. Axe
  measured **1.2:1** on exactly this: the deny-reason `Textarea` in
  `terminal-permission.tsx`.
  - **Fix: restore the app ink on that one instance** — `text-foreground`
    alongside its own `bg-*` — and say in a comment why, so the next reader does
    not "tidy" it back out as a redundant token. `terminal-permission.tsx` is
    the worked example.
  - **The two halves are one question asked from either side:** _which ground is
    this text actually painted on?_ Console ground takes console ink; an opaque
    app box takes app ink. Neither bullet is a special case of the other, and
    both are invisible to jsdom.
- **A THIRD ground: `bg-terminal-selection` is not `bg-terminal-background`, and
  console muted ink does not clear AA on it (measured, #117 T12).**
  `--terminal-muted` is authored against the console ground; the selection band
  is a different, lighter one. Axe measured `text-terminal-muted` on
  `bg-terminal-selection` at **3.61:1** — a genuine 1.4.3 failure, again invisible
  to jsdom.
  - **The token says so itself.** `--terminal-selection`'s comment in `themes.css`
    enumerates exactly which inks it was sized for: `--terminal-foreground`
    (9.80:1 on `:root`, 7.82:1 on `light`) and `--terminal-ansi-white` (6.09:1 /
    5.45:1). Muted ink is not in that list and never was. **Read a ground token's
    own comment before painting text on it** — the guarantee is scoped, and the
    scope is written down.
  - **Fix: the selected/active row's secondary text upgrades to
    `text-terminal-foreground`; resting rows keep `text-terminal-muted`.**
    `terminal-slash-menu.tsx` is the worked example. Do not fix it by loudening
    the band — that trades legible text for a visible highlight, which is the
    trade the token comment already refused.
- **Type is a role.** `text-code` (which pairs with `font-mono`), `text-body`,
  `text-meta` — never a raw `text-sm`/`text-xs`. `pnpm text-scale:check` is a
  ratchet.
- **Elevation:** a console is a _resting_ surface — `border` plus `shadow-sm`,
  which is a lift. `shadow-ring-*` is for things that float (dialogs, popovers).
  Never hand-roll a shadow. **The FRAME carries that pairing, once** — a region
  inside a frame draws neither (§ The console is ONE frame, ADR 0033).

## Every builder in this package also owes

1. Radix `Collapsible` for every disclosure; Radix `RadioGroup`/`Dialog` for
   choice and overlay. **No `parentElement.children[i]` focus management,
   anywhere, ever** — that is the upstream anti-pattern this family exists to
   improve on.
2. Every state readable in greyscale **and** by a screen reader: glyph + text.
3. Every animated indicator: tokened `duration-*`/`ease-*` utilities plus a
   `motion-reduce:` branch. Under reduced motion a spinner becomes a static
   glyph and the state is carried by the live-region text that is already there.
4. `forwardRef`, spread `...props`, `className` merged via `cn()` last,
   `data-slot="terminal-<name>[-<part>]"` on the root **and every part**, `cva`
   for a variant axis, all public types exported.
5. A co-located story rendering **every** `cva` value in a rendered position
   (`variants:check` — a value mentioned only in `argTypes.options` does not
   count) and every not-ready state (`loading-states:check`).
6. One `INTENT` entry in `packages/cli/lib/intent.mjs`; every user-visible
   string through `t()` from `useLocale()` (reuse a generic key such as
   `loading` before minting `terminal.*`); one `CHANGELOG.md` `## Unreleased`
   line per unit.
7. Microtypography: `…` never `...`, curly quotes. The ellipsis half is hard-
   gated.

## Not-ready states

`loading` and `isStreaming` are the only two names (`loading-states.md`); do not
mint a third. `TerminalSurface` owns the `loading` rung for the whole family and
renders its skeletons through the **real** `TerminalRow`, so the placeholder
cannot drift from the grid it stands in for. Exactly **one**
`role="status" aria-live="polite"` per not-ready region, never one per box.
Errors are suppressed while streaming — a half-arrived diff hunk is not an error
(`role="alert"` is for settled, terminal failures only).

## Provenance (the practice worth stealing)

The upstream this family learns from committed real captured terminal frames
beside its components and named the CLI version each was measured against. Do
the same in `packages/terminal/references/*.md`: what real surface a component's
grammar came from, which version, what was checked, and **where we deliberately
diverged** (Radix over `<details>`, a real border over box-drawing, a
`motion-reduce` branch upstream does not have). It is cheap and it stops "what
did we base this on?" drift.
