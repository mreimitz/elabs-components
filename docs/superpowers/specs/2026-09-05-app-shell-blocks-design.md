# App shell blocks — design

**Date:** 2026-09-05
**Status:** approved (design); implementation plan not yet written
**Owner decision record:** this document. Where it says "owner chose", that was an
explicit answer during brainstorming, not an inference.

---

## 1. Problem

`Layout/App Shell` in Storybook is the section a person opens to answer _"what
should my app look like?"_. Today it shows four things that do not answer it:

| Story                           | What it actually is                                                                                                                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Layout/App Shell/Basic`        | A 31-line layout primitive (`packages/ui/src/components/app-shell/app-shell.tsx`) with a hand-rolled `<nav>` of four `<button>`s in the story body, and a grey box reading "Main content area." |
| `Layout/App Shell/Dashboard`    | `packages/ui/src/blocks/sidebar-02` — a shadcn/blocks.so port                                                                                                                                   |
| `Layout/App Shell/Mail`         | `packages/ui/src/blocks/sidebar-04` — a shadcn/blocks.so port                                                                                                                                   |
| `Layout/App Shell/Double-Sided` | `packages/ui/src/blocks/sidebar-05` — a shadcn/blocks.so port                                                                                                                                   |

They are primitives and imports, not designs. The owner's ask: these must become
_"the starting point for everyone using this library … well built and well designed
options for how an app shell could look, not just primitives"_, with the baseline
shell matching the design already shipped in the elabs AI Workbench.

## 2. Reference apps (read-only, in other repositories)

Two shipped apps were read as references. **Neither repository is modified by this
work** — see the cross-repo rule in `~/.claude/CLAUDE.md`.

### 2.1 elabs AI Workbench — a sibling web app (path omitted)

> `pnpm machine-paths:check` forbids a machine-specific absolute home path in
> any tracked file, so the checkout location is not recorded here. It sits
> beside this repository under `DEV/elabs/`; every file cited below is relative
> to that repository's root.

`apps/web/src/components/AppShell.tsx` (1,102 lines) and `PageShell.tsx` (254 lines).
Already consumes `@elabs-ai/components-*`. What it carries that this library does not:

- A skip link as the first focusable element, targeting the single `<main>`.
- `ACTIVE_NAV_INDICATOR_CLASS` — an accent left-bar + semibold on the active nav
  item, added **because** the library's own default (`bg-sidebar-accent`) measured
  1.17:1 in light / 1.29:1 in dark with unchanged label ink.
- Collapsed icon-rail repairs: group labels hidden outright (the library's
  `-mt-8 opacity-0` leaves a boxed phantom gap); collapsed-only mirror items for
  sub-items and hover actions, which the library hides with no replacement.
- The sidebar pinned to `data-density="comfortable"` regardless of the app-wide
  density, because collapsed icon buttons scale with `--spacing` and shrink below
  the fixed 3rem icon rail under `compact`.
- `SidebarContent` given explicit `min-h-0 overflow-y-auto` so a sticky footer
  never draws over the last nav items on a ~900px viewport.
- A navigation landmark wrapped in `display: contents` so it stays in the a11y
  tree without becoming a layout box that breaks the content scroll.
- Breadcrumbs rendered only at drill depth ≥ 2, plus a context (`breadcrumb-slot`)
  letting a routed page contribute an interactive trailing crumb.
- A `⌘K` command-palette trigger styled as a search field (label left, `Kbd`
  pinned right, collapsing to the icon alone under `sm`).
- A resizable right-hand assistant dock: `width` transitions between 0 and the
  chosen width (the same mechanic the left rail uses), pointer + arrow-key resize,
  width persisted, re-clamped against the live viewport to keep
  `DOCK_MIN_MAIN_PX = 480` of content, and an overlay `Sheet` below its **own**
  1100px breakpoint rather than the library's 768px mobile one.
- 44×44 minimum tap targets under `@media (pointer: coarse)` only.
- `fullBleed` and `hideChromeForPrint` content modes.
- `SidebarInset` as the single `<main>`, `id="main-content"`, `tabIndex={-1}`.

### 2.2 Answers desktop — a sibling Electron client (path omitted)

> The repository's own name contains the upstream organisation's name, which
> `pnpm debrand:check` forbids in any tracked file of this repo — there is no
> allowlist, by design. It sits beside this checkout under `DEV/`, is a desktop
> answers client, and consumes a sibling fork of this library. Ask the owner for
> the path; every file cited below is relative to that repository's root.

`src/renderer/src/app.tsx` (520 lines), `lib/shell-metrics.ts` (383),
`stores/shell-store.ts` (116), `components/evidence-panel/evidence-rail.tsx` (529). What it adds beyond §2.1:

- **A four-zone shell**: nav rail (48 ↔ 256) · conversations flyout (280) ·
  content · evidence drawer (48 ↔ 320).
- **One `SidebarProvider` per collapsible zone.** The provider holds exactly one
  `open` boolean, so zones sharing a provider collapse together. All are driven
  **controlled** from one store.
- **The right panel collapses to a 48px icon strip that _is_ its section
  switcher** — not to zero. One `SidebarMenu` serves both states: a **row** at
  20rem, a **column** at 3rem, icon + tooltip in both, the label kept in the DOM
  as `sr-only` (it is the button's accessible name), `SidebarMenuBadge` counts.
  Its header records that this replaced a `ContextPanel` from the AI package
  _because_ that component is hardcoded `side: "right"` with a `w-0` collapsed
  state and "there is no icon state in it to reach".
- **A floating inset content surface**: the root paints one continuous
  `bg-sidebar` chrome ground; the content column is inset (`INSET_GAP_PX = 8`) on
  the leading and bottom edges, rounded, bordered, elevated; both rails stay flush
  to the window edge with no radius and no border. `mt-0` is deliberate — a tab
  must touch the page it belongs to.
- **A metrics module as the single declaration of the widths**, republished as CSS
  custom properties on the shell root, so a titlebar row in a _different subtree_
  aligns with the content column — no CSS selector can reach across, and the
  widths are managed inside `Sidebar`.
- **Root state attributes** (`data-nav` / `data-conversations` / `data-evidence`)
  so panel state is readable from CSS and from tests.
- Panel open-state **persisted** and hydrated at boot, optimistically (flip first,
  persist after; a missing bridge is a no-op).

## 3. Decisions taken

| #   | Decision           | Chosen                                                              |
| --- | ------------------ | ------------------------------------------------------------------- |
| D1  | Shell family       | One flagship + three supporting shells, all rebuilt to one standard |
| D2  | Archetypes         | Same three roles as today — dashboard, mail/three-pane, dual-rail   |
| D3  | Depth of fix       | Repair the shared components too, not only the copied shells        |
| D4  | Right-hand panel   | **Both** patterns ship, as two separate pieces                      |
| D5  | Consumption        | Copy-own (registry), not importable shells                          |
| D6  | Content of stories | A believable screen per shell, plus a bare-frame story              |
| D7  | Surface look       | Floating inset content panel, on all four                           |
| D8  | Third zone         | Yes — an optional list column, on by default in the flagship        |

## 4. Design

### 4.1 Layer split

**Layer A — package (`@elabs-ai/components-ui`), imported.** Repairs and new
primitives; every consumer benefits without copying anything.

**Layer B — registry (`registry/blocks/`), copy-own.** The four shells. Duplication
between them is intentional; divergence after `npx shadcn add` is the point.

### 4.2 Placement and naming

| Shell            | Source                        | Registry item                  | Story                           |
| ---------------- | ----------------------------- | ------------------------------ | ------------------------------- |
| Flagship console | `registry/blocks/app-shell/`  | `app-shell` (rebuilt in place) | `Layout/App Shell/Basic`        |
| Dashboard        | `registry/blocks/sidebar-02/` | `sidebar-02`                   | `Layout/App Shell/Dashboard`    |
| Mail             | `registry/blocks/sidebar-04/` | `sidebar-04`                   | `Layout/App Shell/Mail`         |
| Dual-rail        | `registry/blocks/sidebar-05/` | `sidebar-05`                   | `Layout/App Shell/Double-Sided` |

No registry item is renamed, so no existing `npx shadcn add <name>` install path
breaks.

The three supporting shells **move** out of `packages/ui/src/blocks/`. Two reasons:

1. `packages/ui` sits at layer 1 of the one-way dependency graph and may not import
   `@elabs-ai/components-charts` / `-data`, so a believable demo screen cannot be
   built there. `registry/` is a workspace member that already depends on every
   package (`registry/package.json`), which is exactly why cross-layer blocks such
   as `ai-chat-shell`, `flow-builder` and `code-workspace` already live there.
2. It retires the raw-font-size debt that `.claude/rules/styling-and-tokens.md`
   names in `packages/ui/src/blocks/sidebar-04/**`.

Nothing re-exports these blocks from `packages/ui/src/index.ts` (verified), so no
public API breaks. Baselines that name the old paths ratchet **down**.

Stories live in `apps/docs/stories/blocks/` and import through the `@/components/…`
alias that `apps/docs/.storybook/main.ts` maps to `registry/blocks`, so a story
renders byte-for-byte what a consumer installs — the pattern
`apps/docs/stories/blocks/ai-chat-shell.stories.tsx` already documents.

Story **titles** stay under `Layout/App Shell/*` so the section is where people
already look, even though the source moved. `apps/docs/.storybook/preview.tsx`'s
`storySort.order` is unaffected (titles unchanged).

### 4.3 Router-agnostic contract

A copyable block cannot depend on a router. Every shell takes `activePath: string`
and renders plain `<a href>`, with a comment at the nav-item site showing the
`NavLink` / `next/link` swap. Active matching is a small exported pure function
(exact path, or a nested route under it) so a consumer can keep the semantics when
they swap the element.

### 4.4 Layer A — shared repairs

Per `.claude/rules/issue-workflow.md`, each defect is filed via `/file-issue`
(root-cause analysis first) before it is fixed, and each fix ships its locking test.

**R1 — active-section indicator.** `packages/ui/src/components/sidebar/sidebar.tsx:494`
signals the active item with `data-[active=true]:bg-sidebar-accent`,
`font-medium`, and `[&>svg]:text-sidebar-primary`. The wash is ~1.2:1 against the
rail and the only strong cue is icon **hue**. That is colour-as-sole-channel
(`.claude/rules/accessibility.md` §1.4.1) _and_ under the 3:1 non-text indicator
bar (WCAG 1.4.11). Fix: add a token-driven accent rail (`before:` bar on
`--sidebar-primary`, `relative` on the button) plus `font-semibold`, keeping the
wash. Applies to `SidebarMenuButton` **and** `SidebarMenuSubButton`.
Test: a unit test asserting the **non-colour** cue specifically — asserting two
class strings merely differ passes on colour-only code and is not sufficient.

**R2 — collapsed group labels.** `sidebar.tsx:422` collapses `SidebarGroupLabel`
with `group-data-[collapsible=icon]:-mt-8 opacity-0` — invisible but still boxed,
so the icon rail carries unexplained gaps. Fix: `hidden`.

**R3 — `SkipLink`.** New component in `@elabs-ai/components-ui`; none exists
(verified against the barrel). A visually-hidden anchor that becomes a
token-styled pill on focus, with the shared `focus-ring` utility (never a
hand-rolled `focus-visible:ring-2`, per `.claude/rules/theming.md`).

**R4 — `CommandTrigger`.** New. The search-field-shaped `⌘K` button: label left,
`Kbd` pinned right, collapsing to the icon alone under `sm`. `Command` and `Kbd`
already ship; the trigger does not. Platform-correct shortcut hint (`⌘` vs `Ctrl`).

**R5a — `SideDock`.** New. The §2.1 pattern: a **summoned** right panel that
slides fully away. `width` transitions between 0 and the chosen width; pointer +
arrow-key resize; width persisted by the caller (prop-driven, per
`.claude/rules/loading-states.md` — the component never owns storage); re-clamped
against the live viewport to preserve a minimum content width; an overlay `Sheet`
below its own breakpoint, which must be **higher** than the library's 768px
mobile breakpoint (a 400px dock at 768px leaves ~360px of content);
`motion-reduce:transition-none` on both directions. Content stays mounted for the
duration of the closing transition, then unmounts.

**R5b — `ContextRail`.** New. The §2.2 pattern: **permanent furniture** built on
`Sidebar side="right" collapsible="icon"`. One `SidebarMenu` serves both states —
a row when expanded, a column when collapsed to the 48px strip; icon + tooltip in
both; the label kept as `sr-only` so it is the accessible name; `SidebarMenuBadge`
for counts. Sections are data (`{ id, label, icon, count?, content }`).

`ContextRail` goes in `@elabs-ai/components-ui`, not the AI package: an
evidence panel, an inspector, a properties pane and a details drawer are the same
component, and only `ui` is low enough in the dependency graph for all of them to
reach it.

> **Flagged follow-up, deliberately out of scope.** `@elabs-ai/components-ai`'s
> `ContextPanel` hardcodes `side: "right"` and a `w-0` collapsed spacer
> (`packages/ai/src/context-panel.tsx:361,365`), so it cannot express the icon
> state — the same wall the answers desktop app hit. Re-basing it on `ContextRail` is a
> cross-package API change and must be routed through
> `brand-ui-design-system-architect` as its own piece of work.

**R6 — `PageShell` scroll and gutter modes.** Today `PageShell` is padding +
max-width and always scrolls with the body. Add `scroll: "content" | "body" |
"fill"` and a fixed header gutter so a page title lands at identical coordinates
on every route. Additive: the default path must be byte-identical for existing
callers.

**R7 — the `AppShell` primitive is kept**, unchanged, story moved to
`Layout/App Shell/Minimal`. It remains the honest answer for a simple layout, and
freeing `Basic` is what lets the flagship take the name the owner asked for.

**R8 — inset composition.** `sidebar.tsx:135` and `:313` already ship the floating
treatment: `variant="inset"` puts `bg-sidebar` on the wrapper and
`md:peer-data-[variant=inset]:m-2 ms-0 rounded-xl shadow-sm` on `SidebarInset`. So
D7 is largely a **prop**, not a new mechanism. Two gaps, both established by
reading the source rather than by rendering, and both to be **confirmed against a
rendered story before any code is written**:

1. `SidebarInset`'s rule uses Tailwind's `peer-*`, which compiles to the
   subsequent-sibling combinator, and `Sidebar`'s root carries `peer`
   (`sidebar.tsx:217`). A right-hand panel is a **later** sibling of the content,
   so `peer-data-[variant=inset]` cannot match from it — a right-side inset panel
   is expected not to compose. If confirmed, the repair is to drive the inset
   treatment from a state the content can actually see (a wrapper data attribute)
   rather than from sibling order.
2. The gutter sides are hardcoded `m-2 ms-0` — top/right/bottom, none leading.
   §2.2's geometry is the reverse (leading + bottom, none top, none trailing,
   because the right rail is flush). Which sides get a gutter depends on what
   flanks the content, so this becomes a small explicit choice rather than one
   fixed rule.

**R9 — the metrics pattern.** Adopted at **block** level, not as a package
component: a small pure module inside the flagship declaring the zone widths once
and publishing derived offsets as CSS custom properties on the shell root, plus
`data-nav` / `data-list` / `data-context` state attributes. It is a _pattern to
copy_, and it is documented as such in the block's header comment. It stays out of
the package because the widths it declares are an app's decision, not the
library's.

### 4.5 Layer B — the flagship (`Layout/App Shell/Basic`)

Four zones, three collapsible, **one `SidebarProvider` each** (a shared provider
holds one `open` flag and would collapse them together), all controlled:

```
nav rail 48 ↔ 256  │  list column 280 (optional)  │  content (floating inset)  │  ContextRail 48 ↔ 320
```

Chrome:

- Skip link (R3) as the first focusable element, targeting `#main-content`.
- Nav rail: `collapsible="icon"`, pinned `data-density="comfortable"`; brand block
  (mark + product name + org line, hidden when collapsed, ink from the **sidebar**
  token family — page ink is invisible on a dark rail in the light theme);
  grouped nav with labels; collapsed-rail mirror items for sub-items and hover
  actions; the R1 accent active state; footer carrying Settings plus an
  environment meta line.
- `SidebarInset` is the single `<main>`, `id="main-content"`, `tabIndex={-1}`.
- Top bar: sidebar trigger floored at 44×44 under `@media (pointer: coarse)` only;
  breadcrumbs at drill depth ≥ 2 only; right cluster of `CommandTrigger` (R4),
  help, notifications, `ThemeSwitcher`, and the context-rail toggle.
- Right side: `ContextRail` (R5b). `SideDock` (R5a) is demonstrated on the
  AI-facing shell instead, so both patterns have a real home.
- Content frame: `PageShell` in `fill` mode (R6).

Default screen: a console overview — metric row, a runs table with status tone, an
activity timeline.

### 4.6 Layer B — the three supporting shells

- **Dashboard** (`sidebar-02`) — team switcher, collapsible nav groups, inset
  content. Screen: metric grid + chart card + recent activity.
- **Mail** (`sidebar-04`) — becomes a _variation on the flagship's three-zone left
  side_ rather than a separate idea: icon rail + list column + reading pane.
- **Dual-rail** (`sidebar-05`) — slim icon rail opening a contextual second panel.
  Screen: a settings surface with a section list.

All three adopt the floating inset surface (D7) and inherit the flagship's chrome
standards, so the four read as one family.

### 4.7 State grid and stories

Per shell: `Default` (the believable screen) · `Frame` (chrome only, content slot
empty) · `Collapsed` (icon rail) · `Narrow` (mobile / slide-over). Plus, on the
flagship: `ContextRailOpen`, `DockOpen`, and loading + empty states on its screen.

Every story carries a description (the story-description ratchet) and
`tags: ["autodocs"]`.

## 5. Verification (before "done")

Per `.claude/rules/quality-gates.md`, the battery runs **before** integration:

- `pnpm gen:registry` + `pnpm registry:validate` — `registry.json` is generated,
  never hand-edited.
- `pnpm manifest` and the derived-artifact cascade.
- Story interaction + axe tests on every new story
  (`pnpm --filter @elabs-ai/components-docs test-storybook`, or the Storybook MCP
  runner scoped to the touched stories).
- A **dark** headless pass, which CI does not run:
  `cd apps/docs && STORYBOOK_THEME=dark pnpm exec vitest --project storybook run <name>`.
  Cite the theme slug, not "both themes".
- `brand-ui-accessibility-reviewer` and `brand-ui-visual-ux-reviewer` on all four
  shells, cross-theme.
- `brand-ui-design-system-architect` **before** building R5a / R5b / R8 — three
  structural additions to a package's public surface.
- Full-repo `pnpm typecheck` + `pnpm lint` + `pnpm test` + `pnpm build`.
- The ratchets the moves will touch: `scripts/text-scale-baseline.json`,
  `scripts/microcopy-baseline.json`, `scripts/story-description-baseline.json`,
  `scripts/separation-baseline.json`, `scripts/loading-states-baseline.json`,
  `scripts/variant-coverage-baseline.json`, `scripts/data-slot-baseline.json` —
  all must ratchet **down**, never up.

## 6. Open questions and risks

- **R8 is unverified by rendering.** Both gaps in §4.4/R8 were established by
  reading `sidebar.tsx`, not by rendering a right-hand inset panel. Confirm in a
  story first; if `peer-*` does compose after all, R8 shrinks to the gutter-sides
  choice alone.
- **Scale.** Nine package-level changes plus four rebuilt shells is a large piece
  of work. The implementation plan should sequence Layer A (R1–R8) ahead of Layer B
  so the shells are written against repaired primitives rather than carrying
  workarounds that later have to be removed.
- **Naming.** The flagship keeps the story name `Basic`, per the owner's wording,
  though it is the richest of the four. `Console` or `Workbench` would read better;
  changing it is a one-line decision that can be taken at any point.
- **The three supporting shells lose their blocks.so lineage.** They are rebuilt,
  so `scripts/attributions.sources.json` must be re-checked: if nothing recognisable
  from blocks.so survives, the entry is removed (`.claude/rules/attribution.md` —
  deleting the borrowed code is only half the change).
