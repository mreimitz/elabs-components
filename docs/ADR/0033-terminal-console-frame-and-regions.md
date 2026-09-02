# ADR 0033 — a coding-agent console is ONE frame with regions inside it

- **Status:** Accepted
- **Date:** 2026-09-02
- **Deciders:** `brand-ui-design-system-architect` design pass (structural / public-API
  question, per `.claude/rules/quality-gates.md` DoD battery)
- **Context:** the cross-theme visual sweep of
  `patterns-templates-terminal-agent-session--default` (`light` + `dark`), and a builder's
  independent report of the same defect while assembling that screen
- **Related:** ADR 0020 (the stacked elevation ramp — `docs/ADR/0020-stacked-elevation-ramp.md`),
  ADR 0018 (dual canvas surfaces — the precedent for settling a family's composition once),
  `.claude/rules/terminal-components.md`, `.claude/rules/styling-and-tokens.md`
  (§ Elevation, § Surface separation), `.claude/rules/component-api.md` (§ Composition
  patterns), `docs/decisions/2026-09-01-brainless-adoption-architecture.md` §§ 1–2

## Context

The agent-session family (#117) shipped twelve components that are each structurally
correct and a composed screen that is not. Measured from the DOM on
`patterns-templates-terminal-agent-session--default` in both reference themes:

- `TerminalSurface` (the transcript) draws `rounded-lg border border-terminal-border
bg-terminal-background shadow-sm`.
- `TerminalComposer` roots itself **on `TerminalSurface`**, so it draws the same frame
  again, ~16px below, with a strip of page `--background` showing between them.
- `TerminalStatusBar` is a plain `div` with `border-t border-terminal-border` and no
  radius, no shadow and no outer border, sitting flush under that gap.

`TerminalBanner` and `TerminalPermission` also root on `TerminalSurface`, so a screen that
shows a banner and a permission prompt stacks **five** independently framed boxes.

The result reads as three floating cards and a page footer, not as one console. The visual
reviewer's verdict: the single biggest thing keeping the assembled screen from feeling
finished.

Two rules were already being violated one level up from where they are usually applied:

- **ADR 0020 / § Elevation.** A resting surface pairs a border with `shadow-sm`. That is
  correct for _a_ surface. Three resting surfaces stacked 16px apart, each drawing its own
  edge and its own lift, is the "double edge" the ADR exists to remove — restated at
  composition scale instead of within one element.
- **§ Surface separation.** Each region owns ONE focal separation gesture, and a region
  that already carries a non-default fill or elevation may not also carry a border unless
  the border is the sole structural cue. Inside a console the fill (`--terminal-background`
  against the page) is already the separation from the page; every additional edge, radius
  and shadow on a piece _inside_ that fill is redundant.

The deeper failure is not the pixels. `TerminalStatusBar`'s `border-t`-only root **looks**
designed to sit flush under something, forming one stack. Nothing in the package composes
it that way. No story anywhere demonstrates it. Grepping the package for a composed use of
the status bar returns nothing but the assembled template and two registry blocks, all of
which stack it as a fourth floating box. **The intended composition was implied by one
component's styling and never written down**, so each builder re-derived it and landed
somewhere different. This ADR exists to make that non-derivable.

## Decision

**A console is ONE resting surface.** Exactly one element in a console draws the console's
edge; everything else inside it is a region that draws none.

Three nouns, fixed:

| Noun       | What it is                                                            | What it draws                                                                                                    |
| ---------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **frame**  | the console window — exactly one per console                          | `rounded-lg border border-terminal-border bg-terminal-background shadow-sm`, plus the mono/`text-code` type role |
| **region** | a transcript, a banner, a permission prompt, a composer, a status bar | its own padding and its own content — **never** a radius, a shadow, a ground or an outer border                  |
| **seam**   | the boundary between two adjacent regions                             | a 1px `border-t border-terminal-border`, **owned by the frame**                                                  |

And the three consequences that follow:

1. **There is never a gap of page background inside a console.** Regions are flush; the
   seam is the separation gesture, and it is the only one.
2. **A lone `TerminalSurface` on a page is itself a frame.** Every existing standalone
   story keeps rendering exactly as it does today — this decision is additive to the
   single-region case, not a restyle of it.
3. **`TerminalStatusBar` is a region-only part.** Its `border-t`-only root is now correct
   _by contract_ rather than by accident: it has no standalone frame because it is never
   meant to stand alone. Rendering it outside a frame is the error, and its story must be
   fixed to demonstrate the frame.

### Mechanism — a frame part, plus frame-awareness in `TerminalSurface`

`TerminalConsole` (new, `packages/terminal/src/terminal-console.tsx`) is the frame. It is
deliberately thin: the frame classes, a flex column, the seam rule
(`[&>*+*]:border-t [&>*+*]:border-terminal-border`), `overflow-hidden` so a square region
cannot paint over the frame's rounded corners, and a **static** frame context.

`TerminalSurface` reads that context. With a frame above it, it omits
`rounded-lg border border-terminal-border bg-terminal-background shadow-sm` and adds
`ring-inset`; it keeps the ground ink, the type role, the gutter track, the variant
context, the padding and the loading skeletons. It publishes nothing new.

Four properties make this the right seam, and they are the reason the alternatives below
lost:

- **`TerminalComposer`, `TerminalBanner` and `TerminalPermission` need no edit.** All three
  root on `TerminalSurface`, so all three become regions the moment they are inside a
  frame. The contract lands in two files instead of five, and it does not fight the units
  editing those components.
- **It is the systemic answer, not an opt-in kit.** `conceptual-framing.md` states the bias
  outright: prefer a mechanism every consumer gets for free over parts someone must
  remember to configure. Frame-awareness is inherited from the tree, exactly as `variant`
  already is in this family and as `data-decoration` is repo-wide.
- **It omits rather than negates.** A region drops the frame classes; it does not add
  `rounded-none border-0 shadow-none`. So a caller who genuinely wants a framed region
  inside a frame adds `rounded-lg border shadow-sm` through `className` and `cn()` resolves
  it cleanly — no `!important`, no specificity fight.
- **`ring-inset` is load-bearing, not polish.** The frame clips (`overflow-hidden`), and a
  `ring-*` is an outset box-shadow. Without it, `TerminalComposer`'s
  `focus-within:ring-2` is clipped on three sides — a focus indicator that renders as two
  stray horizontal lines. Region mode inverts the ring once, for every region, in one
  place.

### The context discipline extends, unchanged

`.claude/rules/terminal-components.md` states that nothing may ever be added to the variant
context, because the moment it carries transcript state, expansion state or a clock this
family becomes a provider-shaped compound component and its parallel work units collapse
onto one file. **That prohibition binds the frame context identically.**

The frame context is a separate context, and it publishes one static boolean: "a frame
exists above me". It is not state, nothing writes to it, and no component re-renders
because of it. `TerminalConsole` holds no transcript, runs no timer, owns no scroll
container and publishes no `variant` — a `variant` on the console would be a second
provider for a value `TerminalSurface` already publishes.

## Alternatives rejected

**1. A composition convention only — a recipe in the rule and in the stories, no code.**
Every call site would pass `className="rounded-none border-0 shadow-none"` to each of
three-to-five children. This is the status quo with a document attached: it is unreviewable
(a missing class on one child is invisible in a diff), unenforceable (no gate can see it),
and it fails in exactly the way that produced this ADR — a composition that lives only in
prose is a composition each builder re-derives. Rejected.

**2. A `frame` prop on `TerminalSurface` (`"panel" | "none"`).** Cheaper than a component
but it moves the burden to every call site rather than removing it, and it is
configure-not-compose: `component-api.md` § Composition patterns puts a behavioural fork
behind composition, not behind a prop, and reserves `cva` for genuinely visual axes.
`frame="none"` is not a visual variant a designer picks; it is a statement about where the
element sits, which the tree already knows. Rejected — but note this is the fallback if
frame-awareness ever proves too implicit: it is the same contract with a manual switch.

**3. Make the three cards consistent — give `TerminalStatusBar` a frame too.** The smallest
change, and it is what the status bar's isolated appearance seems to ask for. It answers
the wrong question. Four consistent floating cards still read as four cards; it multiplies
the ADR 0020 double-edge instead of removing it, it keeps a strip of page background inside
what is supposed to be one window, and it contradicts the terminal grammar this family is
ported from, where the transcript, the composer and the status line share one ground.
Rejected.

**4. Nesting-aware `TerminalSurface` with no new component — the outermost surface is the
frame.** Tempting: zero new public API. But the frame's job (edge, radius, elevation, clip,
seams, no padding) and the region's job (ground ink, type role, gutter, padding, gap,
skeletons) are different jobs, and one element owning both — resolved by where it happens
to sit — is harder to read than two elements with one job each. It also forces every call
site to reconfigure the outer surface with `p-0 gap-0 overflow-hidden` and re-add the
padding on an inner scroll `div`, which is alternative 1's class-string incantation wearing
a different hat. Rejected. Frame-awareness is kept; only the "the outer one is also a
surface" half is dropped.

**5. Keep the composer's box inside the frame** (a box-on-the-ground, faithful to the CLI,
where the composer is a drawn rectangle in the terminal window). Declined for now. It
requires editing `terminal-composer.tsx` for a per-component exception, and it re-stacks an
edge inside an edge for a component whose input affordance is already carried by a
placeholder, a caret and a focus ring — the same trade `terminal-components.md` § fidelity
already made when it chose a real border over box-drawing characters. If a later sweep
finds the composer needs more presence, **the sanctioned repair is a recessed ground on
that region, not a second border** — a fill is a different separation gesture and does not
restack edges. That is a token decision and routes through the architect.

## Consequences

- **Public API delta is one component.** `TerminalConsole` + `TerminalConsoleProps`, added
  to the barrel. No existing export is removed, renamed or given a new prop, so there is no
  migration note to write. A console assembled the old way still renders — it just still
  reads as three cards, which is what the updated stories and blocks fix.
- **The registration cost is the standard one** (`.claude/rules/quality-gates.md`,
  "Adding a new package or a public subpath export", and the terminal rule's per-builder
  list): barrel export, co-located story and test, one `INTENT` entry in
  `packages/cli/lib/intent.mjs`, `pnpm manifest`, `pnpm data-slot:check -- --update` to
  ratchet the new module in, and one `CHANGELOG.md` `## Unreleased` line.
- **No dependency edge moves.** `TerminalConsole` imports `cn` from
  `@elabs-ai/components-ui` and React. `@elabs-ai/components-terminal` stays a layer-2 leaf,
  `pnpm dep-direction:check` is unaffected, and nothing in `@elabs-ai/components-ai` learns
  about it.
- **`TerminalStatusBar`'s own `border-t` becomes idempotent.** The frame draws the same
  edge on the same element with the same token, so the two do not double. Removing it is
  optional cleanup, explicitly not required by this ADR, and must not be attempted while
  another unit holds that file.
- **The demonstration is the deliverable.** The failure this ADR closes was a contract with
  no story. `TerminalConsole`'s story and the status bar's story both render the full stack
  inside a frame, and the assembled template and both registry blocks adopt it — so the
  composition is visible in Storybook, reachable through the Storybook MCP tools, and
  checked by the blocking interaction + axe job in both themes.

## Watch for

- **A second value creeping into the frame context.** It publishes one static boolean. A
  scroll position, a busy flag or an active-region id in there turns this family into the
  provider-shaped compound component the terminal rule already refused once.
- **A region re-acquiring an edge to "make it stand out".** The answer is a ground, a seam
  or spacing — never a border. Three of the four rejected alternatives above are variations
  on giving a region its edge back.
- **A frame inside a frame.** A console is not a region of another console. If a real case
  appears (a split view of two sessions), it is two consoles side by side in a layout, not
  nesting.
