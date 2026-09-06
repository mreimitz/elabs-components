# ADR 0035 — `ContextRail` and `SideDock`: two right-hand patterns, two components, both in `@elabs-ai/components-ui`

- **Status:** Accepted
- **Date:** 2026-09-05
- **Deciders:** `brand-ui-design-system-architect` (structural / public-API question, per
  `.claude/rules/quality-gates.md` DoD battery — the row that requires this review
  **before** the code)
- **Context:** `docs/superpowers/specs/2026-09-05-app-shell-blocks-design.md` §2.1, §2.2,
  §4.4 (R5a / R5b / R6 / R8), D4
- **Related:** ADR [0012](./0012-metric-card-canonical-home.md) (a shared need moves
  _down_ into `ui`, never sideways), ADR [0018](./0018-dual-react-flow-canvas-surfaces.md)
  (two canvases on purpose — the precedent for shipping two components rather than one
  with a mode), ADR [0034](./0034-process-package-third-layer.md) (primitives go down,
  compositions go up), `.claude/rules/component-api.md` § Composition patterns,
  `.claude/rules/loading-states.md`

## Context

The app-shell rebuild needs a right-hand panel, and the two reference apps it is drawn
from solve that need in two genuinely different ways.

The **web workbench** (§2.1) has a _summoned_ assistant dock: it is absent until you ask
for it, it animates its width between `0` and a user-chosen value, it is drag-resizable,
its width is persisted, it is re-clamped against the live viewport so the content column
never falls below a floor, and below its own (high) breakpoint it becomes an overlay
sheet rather than a column.

The **answers desktop client** (§2.2) has a _permanent_ evidence rail: it never reaches
zero. It collapses to a 48 px icon strip, and that strip **is** the section switcher —
one menu serves both states, icon plus tooltip in both, the label kept in the DOM as
`sr-only` so it is the switcher button’s accessible name, counts on a badge. Its section
set is data.

Design decision **D4** already settled that both ship. What was left open, and what this
ADR decides, is: their exact public prop surfaces, which package owns them, what happens
to the panel that already exists in `@elabs-ai/components-ai`, and whether the shape the
inset repair is heading for is the right one.

Three facts about the shipped code bound every option below. All three were read out of
the source in this worktree, not inferred:

1. **`@elabs-ai/components-ai`’s `ContextPanel` cannot express an icon state.**
   `packages/ai/src/context-panel.tsx:361` hardcodes `side: "right"` and `:365` gives the
   collapsed state `spacerCollapsedClassName: "group-data-[state=collapsed]:w-0"` — a
   zero-width spacer. Collapsed means gone; there is no 48 px rung in it to reach.
2. **`SidebarProvider` holds exactly one `open` boolean and renders a whole app frame.**
   `packages/ui/src/components/sidebar/sidebar.tsx:111-140` renders
   `<div className="group/sidebar-wrapper flex min-h-svh w-full text-foreground
has-data-[variant=inset]:bg-sidebar">`. Two independently collapsible zones therefore
   need two providers — and two providers as siblings render two stacked full-width app
   frames. Nesting is the only composable arrangement, and nesting today collides three
   ways, not one: the second frame box, a second global `⌘B` listener (`:95`,
   `SIDEBAR_KEYBOARD_SHORTCUT = "b"`), and a second writer of the same
   `sidebar_state` cookie (`:83`).
3. **A right-hand `variant="inset"` sidebar cannot drive the inset treatment.**
   `sidebar.tsx:313` writes the rule with `peer-data-[variant=inset]`, which compiles to
   the subsequent-sibling combinator, so it only matches from a sidebar that precedes
   `SidebarInset`. Measured in Task 1 and filed as issue #342: right + after gives
   `0/0/0/0 px`; right + before and left + before both give `8/8/0/8`. The §4.4 R8
   reading was correct.

## Decision

### 1. Two components, not one with a `mode`

`ContextRail` and `SideDock` ship as two separate components in
`@elabs-ai/components-ui`.

They differ in their **state model**, not in their styling. The rail’s state is _which
section is active_ and it never reaches zero width; the dock’s state is _how wide_ and it
reaches zero and unmounts. A single component with `mode: "rail" | "dock"` would make
roughly half of its props inert in each mode — `sections` / `activeSectionId` mean
nothing to a dock, and `width` / `minWidth` / `maxWidth` / `minContentWidth` /
`resizable` / `overlayBreakpoint` mean nothing to a rail. That is exactly the case
`.claude/rules/component-api.md` § Composition patterns rules on: `cva` is for visual
axes, and a behavioural fork becomes an **explicit variant component**, never a mode
prop. ADR 0018 is the standing precedent — two React Flow canvases ship rather than one
canvas with a switch, for the same reason.

### 2. Both live in `@elabs-ai/components-ui`

An evidence panel, an inspector, a properties pane and a details drawer are the same
component wearing four domain names. Their would-be consumers sit in four different
layer-2 leaves (`ai`, `flow`, `editor`, `data`), and a layer-2 leaf may never import
another leaf. `ui` is the only package low enough for all four to reach, so under ADR
0012’s rule — a shared need moves **down**, never sideways — `ui` owns both.

Nothing new is imported to make this work. `Sidebar`, `Sheet`, `Tooltip`, `Button`,
`StatePanel`, `useCollapsiblePanel`, `useIsMobile` and `lucide-react` are all already in
`packages/ui`. **No new cross-package dependency edge is created, no new package, and no
new subpath export** — both components leave through the existing barrel
(`packages/ui/src/index.ts`), so `.claude/rules/component-api.md` § Subpath exports does
not engage.

### 3. `ContextRail` — the exact public surface

Sections are **data**, not children. The collapsed strip has to render an entry for
_every_ section while mounting only the active one’s body, so a compound-children shape
would force the parent to introspect its children or to collect them through registration
effects — both fragile, and neither agent-legible. A data array makes the switcher a pure
derivation.

```ts
export interface ContextRailSection {
  /** Stable identity; the value carried by `activeSectionId`. */
  id: string;
  /**
   * The section’s name. Rendered `sr-only` inside the switcher button in BOTH
   * states (so it is the button’s accessible name) and visibly as the expanded
   * panel’s heading. The visible switcher affordance is the icon plus a tooltip.
   */
  label: string;
  /** Section glyph (a Lucide element). Rendered `aria-hidden`; `label` names the control. */
  icon: ReactNode;
  /** Optional count. Rendered as a badge, and announced as part of the button’s name. */
  count?: number;
  /** Panel body. Only the ACTIVE section’s content is mounted. */
  content: ReactNode;
  /** Disables this switcher entry. Default `false`. */
  disabled?: boolean;
}

export interface ContextRailProps extends Omit<
  ComponentProps<typeof Sidebar>,
  "side" | "collapsible" | "children"
> {
  /** The sections, in switcher order. */
  sections: ContextRailSection[];

  /** Controlled active section. */
  activeSectionId?: string;
  /** Uncontrolled initial active section. Default: `sections[0]?.id`. */
  defaultActiveSectionId?: string;
  /** Called with the next active section id. */
  onActiveSectionChange?: (sectionId: string) => void;

  /** Controlled expanded state. Collapsed is the 48 px icon strip, never zero. */
  open?: boolean;
  /** Uncontrolled initial expanded state. Default `true`. */
  defaultOpen?: boolean;
  /** Called with the next expanded state. */
  onOpenChange?: (open: boolean) => void;

  /** Expanded width, any CSS length. Default `"20rem"`. */
  width?: string;

  /** Rendered in the body when `sections` is empty. Default: a localized `StatePanel kind="empty"`. */
  empty?: ReactNode;

  /**
   * Viewport width in px below which the EXPANDED panel is presented as an
   * overlay `Sheet` instead of a column. Default `768`. The 48 px icon strip
   * stays in the layout at every width — it is never the thing that goes away.
   * Must be ≥ 768; see “Narrow viewports” below.
   */
  overlayBreakpoint?: number;
}
```

**Narrow viewports — decided, not inherited (Finding 1).** `Sidebar` branches to a
mobile `Sheet` at `isMobile` (`sidebar.tsx:193`) driven by `openMobile`/`setOpenMobile`,
which sit **outside** the `open`/`onOpenChange` seam declared above. Inheriting that
branch would turn “a permanent rail that never reaches zero” into an off-canvas sheet
with no documented opener, and would give the rail two disjoint open seams. So
`ContextRail` **does not mount `Sidebar` at all below `overlayBreakpoint`.** It renders
its own 48 px strip plus a `Sheet side="right"` for the expanded body, both driven by the
same `open` / `onOpenChange`. Consequences, stated so the implementer does not guess:

- `Sidebar`’s `isMobile` branch is unreachable from `ContextRail`, and
  `openMobile` / `setOpenMobile` never participate. One seam, at every width.
- **The collapsed icon strip survives at every viewport width**, so the “never reaches
  zero” promise is unconditional rather than desktop-only. Tapping a section still
  opens that section — as a sheet rather than a column.
- `overlayBreakpoint` must be **≥ 768**. Below that the component would mount `Sidebar`
  under the library’s own mobile threshold and re-expose the branch this decision
  removes; a dev-only warning is the guard.
- The asymmetry with `SideDock`’s `1100` is deliberate, not an oversight: a 320 px rail
  whose collapsed cost is 48 px can stay a column right down to the ordinary mobile
  breakpoint, while a 400 px dock at 768 px would leave ~360 px of content.

Inherited from `ComponentProps<typeof Sidebar>` and therefore **not** re-declared:
`className`, `style`, `id` and the rest of the div props, all spread onto the rail’s
container. `side` and `collapsible` are omitted on purpose: pinning them to `"right"` and
`"icon"` is what makes this a pattern rather than a re-export of `Sidebar` with defaults.

**`variant` stays in the type, and it is NOT inert (Finding 3).** The review asked
whether `variant?: "sidebar" | "floating" | "inset"` should be added to the `Omit`,
since decision 4 refinement 3 forbids a `frame="nested"` provider from emitting
`data-variant`. It should not, because the premise does not hold: `Sidebar`’s **own**
root element writes `data-variant={variant}`, and every consequence of the variant that
belongs to the rail is scoped to that element — the gap/container branch is plain JS
(`variant === "floating" || variant === "inset"` selects the `p-2` padding and the
`calc(var(--sidebar-width-icon) + …)` collapsed width), and the inner surface reads
`group-data-[variant=floating]:rounded-lg` / `:border` / `:shadow-sm` from the same
element. So on `ContextRail` the prop still does what it does on any other `Sidebar`.
What refinement 3 withholds is different and belongs to a different element: the
**content column’s** inset geometry, which is a frame-level decision owned by the
`frame="app"` provider. Documented default remains `"sidebar"` (flush), the geometry
§2.2 wants for a rail.

Fixed decisions that are part of the contract and must not become props:

- **Clicking the active section’s switcher toggles `open`.** That is the pattern (the
  activity-bar idiom), not an option.
- **The collapsed strip is `3rem` (48 px)** — the library’s `--sidebar-width-icon`.
  Retuning it is a fork, not a prop.
- **Only the active section’s `content` is mounted.** A consumer who needs an inactive
  section to keep scroll position or transient state hoists that state; brand-ui is a
  presentation layer and does not decide caching for them.
- **No `loading` / `isStreaming` prop.** The body is entirely caller-supplied, so the
  caller renders their own `Skeleton` inside `content`. Adding a not-ready prop here
  would be a third name for something the caller already owns, and would take on a
  `pnpm loading-states:check` obligation for no gain.
- **The count reaches assistive tech through the button’s accessible name**, via a
  localized visually-hidden suffix, because `SidebarMenuBadge` is a `peer` **sibling** of
  the button (`sidebar.tsx:589`) and therefore contributes nothing to the name — and
  because it carries `group-data-[collapsible=icon]:hidden`, so the collapsed strip needs
  its own count affordance. New keys go in
  `packages/ui/src/components/locale-provider/messages.ts` under `ui.contextRail.*`.

`data-slot`: `context-rail` (root/container), `context-rail-switcher`,
`context-rail-switcher-item`, `context-rail-count`, `context-rail-heading`,
`context-rail-body`, `context-rail-empty`. The `Sidebar` group element one level up keeps
its own `data-slot="sidebar"`, so both selectors resolve. `ContextRail` is **not** a
“named preset” in the `UserMessage`/`AgentMessage` sense — it adds an anatomy rather than
changing defaults — so a distinct root slot is correct here.

### 4. `SidebarProvider` gains `frame`, and `ContextRail` owns its own provider

`SidebarMenuButton` reads `useSidebar()` (`sidebar.tsx:537`) for `state` and `isMobile`,
so the rail’s switcher tooltips only appear at the right moment if the surrounding
sidebar context reports the **rail’s** state, not the nav’s. `ContextRail` therefore
renders its own `SidebarProvider` internally, and that provider must not behave like a
second app frame. One additive prop suppresses all three collisions from Context fact 2:

```ts
/** Default `"app"` — today’s behaviour, byte-identical. */
frame?: "app" | "nested";
```

**A prop is required here; CSS alone cannot express it.** Two of the three collisions
are unreachable from a stylesheet: the `document.cookie` write (`sidebar.tsx:83`) and
the `window.addEventListener("keydown", …)` registration are unconditional JavaScript.
The third is reachable but not by a caller: `group/sidebar-wrapper` is a Tailwind group
name, not a `tailwind-merge` conflict group, so a caller-passed `className="contents"`
overrides the display and leaves the group name in place — a nested rail would still be
matched by every `group-data-[…]/sidebar-wrapper:` selector on the page. Hence a prop,
and hence a prop that gates emission rather than merely restyling.

What each value emits:

| Emitted by the provider’s root                          | `frame="app"` (default) | `frame="nested"`             |
| ------------------------------------------------------- | ----------------------- | ---------------------------- |
| Frame box (`flex min-h-svh w-full`) + `text-foreground` | yes                     | **no** — `display: contents` |
| `group/sidebar-wrapper`                                 | yes                     | **no**                       |
| `has-data-[variant=inset]:bg-sidebar` ground            | yes                     | **no**                       |
| `data-variant` (Task 8, decision 8 refinement 1)        | yes                     | **no**                       |
| `data-state` (Task 8, decision 8 refinement 2)          | yes                     | **no**                       |
| `data-slot="sidebar-wrapper"`                           | yes                     | **no** (see below)           |
| Global `⌘B` / `Ctrl+B` listener (`sidebar.tsx:95`)      | yes                     | **no**                       |
| `sidebar_state` cookie write (`sidebar.tsx:83`)         | yes                     | **no**                       |
| `--sidebar-width` / `--sidebar-width-icon`              | yes                     | **yes**                      |
| The `SidebarContext` value (`useSidebar()`)             | yes                     | **yes**                      |

The two custom properties survive `display: contents` because custom properties inherit
down the DOM tree regardless of the box the element generates — which is exactly how
`ContextRail` publishes its `width` to the `Sidebar` beneath it.

**`frame="nested"` emits no `data-slot` either** (the review’s first minor point). A
`display: contents` element that is deliberately not a frame is not a “sidebar wrapper”,
and duplicating that selector in one document is the same collision class as duplicating
the group name — a consumer or test selecting `[data-slot="sidebar-wrapper"]` would match
two elements, one of which has no box. The nested provider is a pure context +
custom-property carrier and is invisible to selectors.

The rail’s public seam stays `open` / `onOpenChange`; the provider is an implementation
detail. A toggle that lives elsewhere in the chrome (the flagship’s top bar) is the
caller’s own button driving the same controlled state — which is what §4.5 already
prescribes (“all controlled”, from one store). Wire it with `aria-expanded={open}` and
`aria-controls` pointing at the `id` passed through the spread.

**Why not a `ContextRailProvider` + `ContextRailTrigger` compound.** The
`state`/`actions`/`meta` provider convention exists to stop prop-drilling and
`useEffect`-syncing between a frame and controls scattered through a subtree. Here there
are exactly two readers — the rail and one toggle — both owned by the same block, and the
design already mandates a single external store for every zone. A provider would re-host
controlled props and buy nothing. Recorded so this is not re-litigated as an oversight.

### 5. `SideDock` — the exact public surface

```ts
export interface SideDockProps extends Omit<ComponentProps<"aside">, "title"> {
  /**
   * The dock’s name. Rendered as its header heading, and as the `SheetTitle`
   * of the overlay presentation. REQUIRED: the overlay cannot be accessible
   * without it, and an optional prop with a generic default would ship a
   * meaningless announced name into real apps.
   */
  title: ReactNode;
  /** Optional longer description; `sr-only` in the overlay presentation. */
  description?: ReactNode;
  /** Optional controls placed in the header row beside the built-in close button. */
  headerActions?: ReactNode;

  /** Controlled open state. Closed means zero width, then unmounted. */
  open?: boolean;
  /** Uncontrolled initial open state. Default `false` — a dock is summoned. */
  defaultOpen?: boolean;
  /** Called with the next open state. */
  onOpenChange?: (open: boolean) => void;

  /** Which edge it docks to. Default `"right"`. */
  side?: "left" | "right";

  /** Controlled width in px. */
  width?: number;
  /** Uncontrolled initial width in px. Default `400`. */
  defaultWidth?: number;
  /** Fires continuously during a resize — drive layout from this. */
  onWidthChange?: (width: number) => void;
  /** Fires once when an interaction ends — PERSIST from this. */
  onWidthCommit?: (width: number) => void;

  /** Lower bound in px. Default `320`. */
  minWidth?: number;
  /** Upper bound in px. Default `640`. */
  maxWidth?: number;
  /** Content width preserved when clamping against the live viewport, px. Default `480`. */
  minContentWidth?: number;
  /** Whether the resize handle renders. Default `true`. */
  resizable?: boolean;

  /**
   * Viewport width in px below which the dock renders as an overlay `Sheet`
   * instead of a column. Default `1100`. Deliberately ABOVE the library’s
   * 768 px mobile breakpoint: a 400 px dock at 768 px leaves ~360 px of content.
   */
  overlayBreakpoint?: number;
}
```

`children` is the body and comes from `ComponentProps<"aside">`, as do `className`,
`style`, `id` and `aria-*`. `title` is omitted from the base props because the DOM
`title` attribute is a `string` and this widens it to `ReactNode`.

Fixed decisions that are part of the contract:

- **The width contract is two callbacks, mirroring Radix `Slider`’s
  `onValueChange`/`onValueCommit`.** The live one keeps the layout under the pointer; the
  commit one is where a caller persists. Persistence stays entirely outside the component
  (`.claude/rules/loading-states.md`’s prop-driven stance, and D5).
- **A close control is always present** in the header — a summoned panel that can only be
  dismissed from outside itself is an overlay trap. It is not a prop.
- **Clamping is unconditional — a controlled `width` is clamped too** (the review’s
  second minor point). `minWidth` / `maxWidth` / `minContentWidth` against the live
  viewport are a **layout invariant**, not a piece of state, so they are not something
  control transfers to the caller: a controlled dock that honoured an out-of-range value
  literally would render over the content it is supposed to sit beside, and the caller
  cannot clamp for itself without duplicating the component’s own viewport arithmetic.
  Control is over the VALUE, not over the geometry. When a controlled `width` falls
  outside the clamp the dock renders the clamped number **and emits `onWidthChange`
  followed by `onWidthCommit` with it, once** — on mount and again on a viewport resize
  that moves the bound — so the caller’s persisted value converges instead of silently
  disagreeing with the pixels. This is not a mode flip (`.claude/rules/component-api.md`
  § Controlled/uncontrolled): the component never becomes the owner of `width`, it
  reports the value it could actually use.
- **`px` numbers here, a CSS-length `string` on `ContextRail`.** Not an inconsistency:
  the dock does arithmetic (clamping against `window.innerWidth`, honouring
  `minContentWidth`), the rail’s width is a static declaration. Recorded so a reviewer
  does not “harmonise” them.
- **The collapse mechanism is `useCollapsiblePanel`**, per `pnpm collapse-fork:check` —
  a second gap-spacer plus fixed-slide tween outside
  `packages/ui/src/components/collapsible-panel/` fails CI. The hook’s `duration-base`
  is the gated `--t-base` token, so reduced motion is honoured without a hand-rolled
  neutralizer; R5a’s `motion-reduce:transition-none` is belt-and-braces on top.
- **Content stays mounted for the closing transition, then unmounts**, and the collapsed
  container is `inert` — the same treatment `ContextPanel` already gives its collapsed
  state.

`useIsMobile` gains an **optional** breakpoint argument —
`useIsMobile(breakpoint = 768)` — so each panel can ask about its own threshold
(`SideDock`’s 1100, `ContextRail`’s `overlayBreakpoint`) without a second hook and
without a new public export. Additive; every existing call site is unchanged. Cost, named: `useIsMobile(1100)` reads oddly, because 1100 px is not
“mobile”. The alternative was a new `useBelowBreakpoint` export, which costs a new public
API plus its registration in every discovery surface; the wart is cheaper than the
surface.

`data-slot`: `side-dock` (root), `side-dock-spacer`, `side-dock-container`,
`side-dock-header`, `side-dock-title`, `side-dock-close`, `side-dock-body`,
`side-dock-resize-handle`.

### 6. `PageShell` — `scroll` and a header gutter, additive

Yes to additive props; no to a new component. The three scroll behaviours are one
axis with three values, which is an enum, not three booleans:

```ts
export type PageShellScroll = "body" | "content" | "fill";

// added to PageShellProps
/**
 * "body" (default) — the page scrolls; byte-identical to today.
 * "content" — the shell fills its parent and its own body scrolls.
 * "fill" — the shell fills its parent and does NOT scroll; the child owns overflow.
 */
scroll?: PageShellScroll;
/**
 * Reserve a constant vertical box for the header row so a page title lands at
 * identical coordinates on every route, whether or not `header` is supplied.
 * Default `false`.
 */
headerGutter?: boolean;
```

The gutter’s **height** is a local CSS custom property, `--page-shell-header-gutter`,
declared by the component and retunable per surface through the root `className`
(`[--page-shell-header-gutter:--spacing(16)]`). This is the seam idiom the repo already
uses for `--focus-ring-color` and `--shadow-ring-color`, and it is a **component-local
variable in the `--sidebar-width` / `--context-panel-width` family** — deliberately not a
theme token, so `pnpm theme-parity:check` is not engaged.

**Its default is `--spacing(12)` — `3rem`, 48 px at a 16 px root** (Tailwind spacing step
12, i.e. `h-12`). Chosen to match the height a one-line page title with the toolbar
header’s existing `py-3` padding already occupies, so switching `headerGutter` on for a
route that _has_ a header changes nothing and switching it on for a route that does not
lands the content where the header would have ended. It is applied as
`min-h-(--page-shell-header-gutter)` on a header row that renders **even when `header` is
absent** — that empty row is the whole mechanism, and it is what `headerGutter: false`
must not produce.

Two hard requirements on the implementation, both to be locked by tests:

- **`scroll: "body"` with `headerGutter: false` must produce a byte-identical class string
  AND a byte-identical DOM to today**, for every combination of the existing `header` /
  `headerVariant` / `width` props — no `min-h-*` class anywhere, and no empty header row.
  The gutter is expressible only through props that default off, so “unset” is literally
  today’s render, not an approximation of it.
- While the file is open, `PageShell` is brought onto the component-API baseline it
  currently misses: `forwardRef`, `...props` spread, and `data-slot="page-shell"` on the
  root (plus `page-shell-content`, `page-shell-header`; the existing
  `page-shell-toolbar-header` stays). All three are additive.

Neither `ContextRail` nor `SideDock` needs `cva`: each has a single visual axis and the
rail delegates its axis to `Sidebar`. `PageShell`’s `scroll` × `headerGutter` map is a
reasonable `cva` candidate and is left to the implementing task.

### 7. `@elabs-ai/components-ai`’s `ContextPanel` — deferred, and the divergence is recorded

`ContextPanel` is **kept, not deprecated, and not re-based in this wave.**

- It is not the same component. It carries a chat-context domain vocabulary —
  `ContextAsset`, `AssetPreviewRenderer`, a `view: "root" | "detail"` drill-down with its
  own focus management — across a public surface of two providers, two hooks, six parts
  and ten exported types. `ContextRail` is a section switcher. Re-basing is a redesign,
  not a swap.
- It is not blocked by anything structural: `ai` is layer 2 and may already import `ui`.
  Deferring costs no dependency debt.
- The mechanism is already shared. Both go through `useCollapsiblePanel`, and
  `pnpm collapse-fork:check` keeps it that way, so the deferral does not fork the
  collapse tween — which is the expensive kind of duplication.

**What it costs, plainly.** Two right-hand panels ship with different vocabularies, and
one of them (`ContextPanel`) still cannot express an icon state. Anyone building a chat
context panel that needs a permanent icon strip will find `ContextPanel` unable to do it
and will have to reach for `ContextRail` instead. That is a routing problem, so the
mitigation ships **now, with the components**: a routing line in
`.claude/rules/ai-chat-components.md` and in the D3 package table saying that a
right-hand panel with a permanent icon strip is `ContextRail`
(`@elabs-ai/components-ui`), while a chat asset/context panel with a detail drill-down
stays `ContextPanel` (`@elabs-ai/components-ai`).

**The shape of the follow-up, so it is not left vague.** When it is taken, `ContextPanel`
becomes a composition **over** `ContextRail`: its provider maps assets and views onto
sections, and every one of its current exports is preserved. No public export of
`@elabs-ai/components-ai` is removed without a migration note. It is its own piece of
work and gets its own architect review.

### 8. Endorsement of the inset repair (Task 8)

**Endorsed**, with four refinements.

1. **`variant` on `SidebarProvider`, written as `data-variant` on the frame wrapper — yes.**
   It is the smallest change and it is consistent with what is already there: the wrapper
   at `sidebar.tsx:135` already reads the variant from a **descendant** via
   `has-data-[variant=inset]`. The wrapper also already declares `group/sidebar-wrapper`,
   so `SidebarInset`’s rule moves from `peer-data-[variant=inset]:` to an ancestor-scoped
   match with **no new group class**.
2. **The wrapper must expose `data-state` as well as `data-variant`.** `SidebarInset`’s
   current rule also reads `peer-data-[state=collapsed]` for its `ms-2` case; if only the
   variant moves to an ancestor source, that clause is left on the broken combinator and
   the bug half-survives.
3. **`data-variant`, `data-state` and `group/sidebar-wrapper` belong to the
   `frame="app"` provider only.** A `frame="nested"` provider must omit all three.
   Otherwise two ancestors carry the same group name and a descendant matches if _either_
   satisfies the condition — a nested rail’s state would silently drive the content
   column’s geometry. Inset geometry is a frame-level decision; the nested provider only
   supplies a second `open` boolean.
4. **The frame’s ground must read the frame’s OWN `variant`, not any descendant’s.** The
   wrapper class at `sidebar.tsx:135` carries `has-data-[variant=inset]:bg-sidebar`, and
   `:has()` is descendant-scoped with no depth limit — it does not stop at a
   `frame="nested"` boundary, because that boundary exists in the provider’s emission
   logic, not in the selector. So a `ContextRail` rendered with `variant="inset"` would
   repaint the whole app frame’s chrome ground from three levels down, which is the same
   class of bug as issue #342 read in the opposite direction. When Task 8 adds `variant`
   to `SidebarProvider`, the ground condition moves onto that prop. Keep the descendant
   `:has()` as the fallback for when the prop is unset, so every existing caller — who
   sets the variant on `Sidebar` and nothing else — renders exactly as today.

**`gutter` on `SidebarInset` — endorsed as an explicit prop, and it should be a named
geometry rather than a boolean**, because the two shells want opposite gutters: today’s
rule is `m-2 ms-0` (top, trailing, bottom) while §2.2’s is leading plus bottom, none top,
none trailing, because the trailing edge is a flush rail. The recommended shape, which
Task 8 owns and may refine:

```ts
gutter?: "auto" | "none" | { top?: boolean; bottom?: boolean; start?: boolean; end?: boolean };
```

`"auto"` is the default and reproduces today’s rule exactly, including the
collapsed-state `ms-2`. The object form is preferred over inventing names such as
`"leading-bottom"` because it reads correctly at the call site without a lookup, and
because which sides get a gutter genuinely depends on what flanks the content — the same
decision test the `border` / `border-strong` rule uses.

## Options considered

| #   | Option                                                                           | Verdict    |
| --- | -------------------------------------------------------------------------------- | ---------- |
| 1   | Two components in `ui`; `ContextPanel` deferred; `PageShell` extended additively | **Chosen** |
| 2   | Re-base `ContextPanel` onto `ContextRail` now                                    | Rejected   |
| 3   | One component with `mode: "rail" \| "dock"`                                      | Rejected   |
| 4   | Put `ContextRail` in `@elabs-ai/components-ai` beside `ContextPanel`             | Rejected   |

**Option 2 — re-base `ContextPanel` immediately. Rejected.** It converts a bounded
addition into a cross-package redesign of a surface with ~20 public exports and its own
focus-management and test suite, inside a wave that already carries nine package-level
changes and four rebuilt shells (§6, “Scale”). It also risks exactly what this task is
constrained against — breaking existing public exports — for a benefit that is
deduplication of vocabulary, not of mechanism (the mechanism is already shared through
`useCollapsiblePanel`). Deferring is cheap because the dependency direction already
permits it later; doing it now would sequence the shells behind it.

**Option 3 — one component with a `mode` prop. Rejected.** The two patterns share a
screen edge and nothing else. Their state models are disjoint, so a `mode` prop produces
a type whose validity depends on another prop’s value — the impossible-combination
explosion `component-api.md` § Composition patterns names, and the reason ADR 0018
already ships two canvases instead of one. The user-visible affordances differ too: one
never disappears and switches sections, the other disappears entirely and resizes. A
consumer choosing between them is choosing a pattern, and the API should make them say
which.

**Option 4 — `ContextRail` in `ai`. Rejected** on the one-way dependency rule: `flow`’s
inspector, `editor`’s properties pane and `data`’s details drawer are all layer-2 leaves
that may not import `ai`, and `ui` may not import it either. ADR 0012’s rule sends a
shared need down, not sideways.

## Consequences

- `@elabs-ai/components-ui` gains two components (`ContextRail`, `SideDock`), four
  exported types (`ContextRailProps`, `ContextRailSection`, `SideDockProps`,
  `PageShellScroll`), one additive `SidebarProvider` prop (`frame`), one additive
  `SidebarInset` prop (`gutter`), two additive `PageShell` props (`scroll`,
  `headerGutter`), and one optional argument on `useIsMobile`. **Nothing is removed or
  renamed**, so no migration note is owed.
- Registration duties, per `.claude/rules/quality-gates.md`: barrel export from
  `packages/ui/src/index.ts`, `pnpm manifest` and the derived-artifact cascade,
  co-located stories with `tags: ["autodocs"]` and a description, co-located tests. No
  new package and no new subpath export, so the heavier registration path does not apply.
- Gate impact, stated up front so the implementing tasks are not surprised:
  `pnpm collapse-fork:check` requires both new panels to reference `useCollapsiblePanel`;
  `pnpm data-slot:check` ratchets **down** as the new slots land, and `PageShell`’s new
  root slot ratchets it down again; `pnpm loading-states:check` is not engaged because
  neither component takes a not-ready prop; `pnpm variants:check` is not engaged because
  neither uses `cva`; `pnpm text-scale:check` and `pnpm microtypography:check` apply as
  usual (type is a role, `…` not `...`).
- The flagship shell becomes expressible: nav rail in the `frame="app"` provider, content
  in `SidebarInset` with an explicit `gutter`, `ContextRail` carrying its own
  `frame="nested"` provider on the trailing edge, and `SideDock` demonstrated on the
  AI-facing shell so both patterns have a real home.
- One follow-up is created and deliberately left open: re-basing `ContextPanel` onto
  `ContextRail` (§7), with its own architect review.

## Watch for

- **A second `frame="app"` provider anywhere in one document.** The cookie key
  `sidebar_state` is a module constant, so two app-frame providers would fight over one
  persisted value and both would answer `⌘B`. `frame="nested"` fixes the nested case;
  the sibling case is still unguarded, and a `cookieName` prop is the shape to reach for
  if it ever comes up.
- **`display: contents` and the accessibility tree.** Older engines dropped
  `display: contents` elements from the a11y tree. The `frame="nested"` wrapper is a
  semantically empty `div`, so nothing is lost here — but do not extend the mode to an
  element that carries a role or a name.
- **`SidebarMenuBadge` is hidden in the icon state** (`group-data-[collapsible=icon]:hidden`)
  and is a `peer` sibling, so it contributes nothing to the switcher’s accessible name.
  A `ContextRail` implementation that simply drops the badge in will silently lose counts
  in the collapsed strip — the exact state the pattern exists for.
- **The rail is colour-plus-icon, and the icon must not be the only channel.** The active
  section needs a non-colour cue that survives greyscale (`.claude/rules/accessibility.md`
  § 1.4.1), and it must reach AT as `aria-current` or a pressed state — not only as a
  `data-*` attribute.
- **`overlayBreakpoint` below 768 is wrong on both components, for different reasons.**
  On `SideDock` it inverts the presentation (a column where the library already shows a
  sheet); on `ContextRail` it re-exposes `Sidebar`’s own `isMobile` branch and with it
  the second `openMobile` seam decision 3 exists to remove. Both take a number, not an
  enum, so nothing stops a caller — a dev-only warning is the cheap guard on each.
- **The two `overlayBreakpoint` defaults differ on purpose (768 rail, 1100 dock).** A
  later “harmonisation” that gives them one value breaks one of the two patterns: at 768
  the dock leaves ~360 px of content, and at 1100 the rail becomes a sheet on an ordinary
  laptop where a 48 px strip plus a 320 px panel fits comfortably.
- **`scroll: "content"` and `"fill"` both require a bounded parent.** Inside a
  body-scrolling page they collapse to nothing visible. This is the caller’s contract,
  and the story set should show it in a real shell rather than in isolation.

## References

- `docs/superpowers/specs/2026-09-05-app-shell-blocks-design.md` §2.1, §2.2, §4.4, §4.5
- `packages/ui/src/components/sidebar/sidebar.tsx` (`:83`, `:95`, `:135`, `:313`, `:537`, `:589`)
- `packages/ui/src/components/collapsible-panel/use-collapsible-panel.ts`
- `packages/ai/src/context-panel.tsx` (`:361`, `:365`)
- `packages/ui/src/components/page-shell/page-shell.tsx`
- Issue #342 — right-hand `variant="inset"` cannot drive the inset treatment
- `.claude/rules/component-api.md`, `.claude/rules/loading-states.md`,
  `.claude/rules/accessibility.md`, `.claude/rules/quality-gates.md`
