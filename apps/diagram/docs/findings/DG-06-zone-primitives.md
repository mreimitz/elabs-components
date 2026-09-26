# DG-06 — ZoneNode on `FlowGroupNode`'s shape: what flow lacks for zones

Built: `src/nodes/zone-data.ts`, `zone-variants.ts`, `zone-node.tsx`, `use-zone-autofit.ts`,
`node-types.ts`, `src/fixtures/zone-gallery.ts`, the `#zones` route in `src/app.tsx`.
Driven at 1440×900 on the dev server; screenshots in `apps/diagram/.evidence/DG-06/`
(repo-root-relative, git-ignored).

The zone is `FlowGroupNode`'s shape — `FlowNodeCard` frame, header with a live child count
and a collapse toggle, `NodeResizer`, two group ports — plus the plan's D3 boundary
vocabulary: `owner` (fill + border style), `kind` (radius + border weight + glyph),
`provider` (header mark + rail). Everything below is what had to be copied, mirrored or
worked around in the app, with the library API that would remove the workaround.

## Proposal in one paragraph

Generalise `FlowGroupNode` rather than add a second group: (1) a `flowBoundaryVariants`
`cva` with `owner`-like **style** and `kind`-like **shape** axes, neutral by default;
(2) header **parts** (`FlowGroupHeader`, `FlowGroupTitle`, `FlowGroupCount`,
`FlowGroupToggle`, a leading `mark` slot) so a consumer composes a provider mark and an
owner badge without copying the node; (3) exported group **geometry** that `layoutFlowElk`,
`groupNodes`, the collapse chip and the header all read from one place; (4) an **auto-fit**
operation in `useFlowGroups` (pure `fitGroups` + a hook); (5) `useFlowGroups` made
**type-agnostic end to end** (it almost is) and able to collapse from data.

## Findings

### 1. Boundary variants — no boundary `cva` in flow, and `cva` is not an app dependency

- Where: `src/nodes/zone-variants.ts:19` (`// P4`).
- What: flow ships one group look (`--flow-group` fill + `--flow-group-border`,
  `flow-group-node.tsx:109-113`); nothing expresses "whose boundary is this" (owner) or
  "what kind of boundary" (kind). The app cannot write its own `cva`:
  `class-variance-authority` is not in `apps/diagram/package.json` (and not resolvable —
  `ls node_modules/class-variance-authority` at the repo root: no such file), the item
  lists no install, and `package.json` is outside DG-06's touches.
- Worked around: the `cva` config is written out as data (`ZONE_VARIANTS`: `base`,
  `variants.owner`, `variants.kind`, `compoundVariants`, `defaultVariants`) with a
  10-line resolver of the same call signature — `zoneVariants({ owner, kind })`. Swapping
  in `cva(ZONE_VARIANTS.base, ZONE_VARIANTS)` is mechanical once the dependency exists or
  flow exports the variants.
- Proposed API (flow): `flowBoundaryVariants({ line: "solid" | "dotted" | "dashed",
weight: "hairline" | "bold", shape: "square" | "rounded" | "pill", surface: "muted" |
"raised" | "ground" })` + `FlowGroupNode` props `boundary?: …` forwarding to it. The
  architecture vocabulary (`owner`/`kind`) maps onto those neutral axes in
  `flow/architecture` (D8), so the base package stays vendor- and domain-free.

### 2. Hatch vs fill in `cn()` — tailwind-merge drops the fill

- Where: `src/nodes/zone-variants.ts:80` (`// P4`).
- What: the tokens ship the hatch (`@utility bg-hairline-hatch`, masked `::before`,
  `packages/tokens/src/themes.css:2670`), so "hatch utility needed" is **not** a gap. But
  `cn()`'s tailwind-merge (`packages/ui/src/lib/cn.ts:44-60`) classifies
  `bg-hairline-hatch` as a background COLOUR and drops the fill it sits beside. Evidence
  (run against the ui package's `tailwind-merge`):
  `twMerge("… bg-flow-node … bg-card border-solid bg-hairline-hatch …")` →
  `"relative shadow-sm bg-hairline-hatch rounded-xl …"` — `bg-card` is gone.
- Worked around: the hatch goes on a separate `arch-zone-body` element
  (`zoneBodyVariants({ owner })`), never merged with the frame's fill. Visible in
  `05-closeup-saas-partner-light.png` (SaaS body hatched, fading to the edges).
- Proposed API (ui): a `bg-texture` class group in `cn.ts`'s `extendTailwindMerge`
  listing the texture utilities (`bg-hairline-hatch`, `bg-hairline-stripes`,
  `bg-dot-grid`, the `bg-paper*` family) so they merge independently of `bg-<colour>`.

### 3. Header slots — the header is closed, and its count hook is private

- Where: `src/nodes/zone-node.tsx:85` (`useDirectChildCount` copy, `// P4`).
- What: `FlowGroupNode`'s header is fixed — toggle, `icon`, title, tone indicator, count
  (`flow-group-node.tsx:129-180`). A zone needs a provider mark, a subtitle, an owner
  badge and a kind name for AT, so the whole node had to be recomposed from
  `FlowNodeCard`. `useDirectChildCount` (`flow-group-node.tsx:65`) is not exported, so
  its `parentLookup` selector was copied verbatim (the item's stop condition did not
  trigger — the helper was unchanged and copyable).
- Also measured: the header's content width is unknown to layout. On the first gallery
  run every nested zone repeated "CUSTOMER MANAGED" and the DMZ subnet's title rendered
  at 0 px (`title` shrank to nothing beside a `shrink-0` badge in a 183 px-wide zone).
  The app now shows the owner word only where ownership changes (top-level zones, or a
  nested zone whose owner differs from its parent's; the others carry it `sr-only`),
  and the subtitle gives way before the title (`shrink-3`). See finding 7 for the layout
  side.
- Proposed API (flow): export `useFlowGroupChildCount(id)`; split the header into parts
  (`FlowGroupHeader` with `mark`/`title`/`meta`/`actions` regions, `FlowGroupCount`,
  `FlowGroupToggle`) that `FlowGroupNode` itself composes.

### 4. Shared group geometry — three private constants that must agree

- Where: `src/nodes/zone-data.ts:60` (`// P4`).
- What: `layoutFlowElk` reserves `[top=60,left=16,bottom=16,right=16]` inside every group
  (`GROUP_PADDING`, `layout-flow-elk.ts:104`, a private string); `groupNodes` reserves a
  44 px header (`GROUP_HEADER_OFFSET`, `group-operations.ts:19`); the collapse chip is a
  fixed 220×48 (`OVERVIEW_WIDTH`/`HEIGHT`, `group-operations.ts:21-22`). None is exported
  or configurable, and `FlowGroupNode`'s header has no fixed height at all (`py-2`).
- Worked around: `ZONE_HEADER_HEIGHT = 44` (the header is `h-11`) and `ZONE_PADDING = 16`
  mirror ELK's 60 = 44 + 16, so ELK's output is a fixed point of the auto-fit. Measured
  after ELK (console, `[DG-06] layoutFlowElk engine=elk`): every child sits at `y = 60`
  (≥ 44 — headers uncovered, 3 zone levels deep), `x = 16` or `21`.
- Also measured: ELK is not an exact fixed point where a hierarchy-crossing edge leaves a
  zone — it adds a few px on that side. `hosted-aws` 478→468 and `prod-vpc` 441→436 wide
  after the auto-fit (both exited by `workers → siem`); `pci`/`eu-region` sit at `x = 21`.
  The auto-fit only tightens (never enlarges) these, so nothing overlaps.
- Proposed API (flow): `export const FLOW_GROUP_GEOMETRY = { header: 44, padding: 16,
collapsed: { width: 220, height: 48 } }`, read by `layoutFlowElk`, `groupNodes`,
  `collapseGroup` and a fixed-height `FlowGroupHeader`; `layoutFlowElk` option
  `groupPadding?: { top, right, bottom, left }`.

### 5. Auto-fit — React Flow never fits a parent to its children

- Where: `src/nodes/use-zone-autofit.ts:158` (`// P4`), `:38` (`getNodesBounds`).
- What: nothing in flow or React Flow keeps a group wrapped around its children.
  React Flow's `expandParent` grows only the direct parent, only to the child's edge (no
  header, no padding), and never shrinks. `useFlowGroups` has no fit operation.
- Built: `fitZones(nodes, padding, header)` — pure, deepest zone first, grows/shrinks
  right and bottom, moves a zone by any left/top deficit and moves its children by the
  opposite amount (nothing jumps on screen), skips `sizing: "manual"`, collapsed, hidden
  and empty zones, returns the same array when nothing changes (the loop guard);
  `useZoneAutofit` runs it after geometry changes (a hash) and holds while anything is
  `dragging`/`resizing`, so zones grow on drop. Resizing a zone by hand switches it to
  `sizing: "manual"` (`onResizeEnd`); its parent keeps fitting around it.
- Evidence (flow units, one `[DG-06] auto-fit: …` console line per drop, no loop, no
  React warning):
  - drag `workers` past `eks`'s right/bottom edge: `eks` 404×114 → 451×208,
    `prod-vpc` 436×190 → 483×284, `hosted-aws` 468×266 → 515×360
    (`07-drag-1-before.png`, `07-drag-2-mid-drag.png`, `07-drag-3-dropped.png`);
  - drag `ingest` past `eks`'s left edge and into its header band: `eks` moved
    (488,462) → (432,443) and grew to 508×227, both ancestors followed, `workers` kept its
    absolute position (747,616) (`07-drag-4-dropped-left-top.png`);
  - resize `prod-vpc` by hand: 540×303 → 580×351 kept, `hosted-aws` refit to 612×427
    (`08-resize-to-manual.png`).
- Side gap: `getNodesBounds` (from `@xyflow/react`) warns in development on every call
  without a `nodeLookup`, even for siblings of one parent where relative positions are
  exactly right; the hook passes a lookup of plain nodes (one documented cast).
- Proposed API (flow): `fitGroups(nodes, { padding, header, isGroup })` in
  `group-operations.ts` + `useFlowGroups().fitGroup(id)` and an opt-in
  `useFlowGroupAutofit({ isGroup })`, reading `FLOW_GROUP_GEOMETRY`.

### 6. `layoutFlowElk` forces `extent: "parent"`

- Where: `src/app.tsx:135` (`// P4`).
- What: every placed child gets `extent = "parent"` (`layout-flow-elk.ts:359`), which
  clamps a drag at the zone edge — the drag-to-grow gesture cannot happen. The gallery
  strips `extent` after layout.
- Proposed API (flow): `layoutFlowElk` option `childExtent?: "parent" | "none"` (default
  `"parent"`, today's behaviour).

### 7. ELK does not know a group's header needs width

- Where: header crowding in `zone-node.tsx` (finding 3); gallery fixture widened with a
  second leaf in `dmz` and a `siem → vault` edge so the narrowest zones are not
  title-only.
- What: `toElkGraph` sizes a group purely from children + `GROUP_PADDING`; a group with
  one narrow child is narrower than its own header. Growing it afterwards (in the
  auto-fit) would overlap its siblings, so the app does not.
- Proposed API (flow): `groups: { id, children, minWidth?, minHeight? }[]` →
  `elk.nodeSize.minimum` + `elk.nodeSize.constraints: "MINIMUM_SIZE"` on that compound
  node; the header part can report its intrinsic width.

### 8. Collapse — type-agnostic already; cannot start collapsed

- Where: `src/app.tsx:98` (`// P4`).
- Step 7's question: `collapseGroup` / `expandGroup` / `toggleGroupCollapsed`
  (`group-operations.ts`) never read `node.type`, so `useFlowGroups().toggleCollapse`
  works on `arch/zone` nodes as they are — the "register under both `arch/zone` and
  `group`" workaround was **not** needed. The type string is only baked into
  `groupNodes` (`FLOW_GROUP_NODE_TYPE = "group"`, `group-operations.ts:14`).
- Driven by keyboard: focus the zone toggle, Enter — `Expand Azure subscription`
  (collapsed chip) expands, edges restored, `aria-expanded` true
  (`06-collapse-kbd-2-expanded.png`); `Collapse Vienna data center` folds to a 220×48 chip,
  its subtree hidden, `erp → gateway` rerouted to the chip
  (`06-collapse-kbd-3-collapsed-vienna.png`). Focus ring visible on the toggle after the
  key press.
- Gap: a group whose `data.collapsed` is `true` from the start cannot be expanded —
  `expandGroup` returns unchanged without the snapshot `collapseGroup` stashes
  (`group-operations.ts:315`). A YAML `collapsed: true` (D3) is exactly that case. The
  gallery renders the zone expanded, lays out, then folds it with `collapseGroup`.
- Proposed API (flow): `groupNodes({ type })`; `expandGroup` falls back to un-hiding the
  subtree when there is no snapshot; `collapseGroups(nodes, edges, ids)` for load time.

### 9. `CanvasShell` `fitViewKey` pins a correctly fitted graph off-screen

- Where: `src/app.tsx:162` (`// P4`).
- What: after the re-fit, `anchorToStartWhenClamped` decides "overflow" with
  `padX = width * padding` per side (`canvas-shell.tsx:244-245`), while React Flow's
  `fitView` turns a numeric padding into `floor((W - W/(1+p)) / 2)` per side (xyflow
  `parsePadding`) — about half. Every width-limited fit therefore looks "overflowing"
  and is pinned to the left edge. Measured on the gallery: pane 1184 px, content 1450
  flow-px wide, zoom 0.7434 (React Flow's correct fit), translate-x 109.5 px (CanvasShell's
  pin) instead of ≈ 44.6 px — the right-hand zones ran ~100 px off-screen
  (`debug-fit-after-fix.png` is after the workaround).
- Worked around: the gallery calls `useReactFlow().fitView({ padding: 0.1 })` itself
  after layout, not `fitViewKey`.
- Proposed fix (flow): compute overflow with React Flow's own padding resolution (or pin
  only when the applied zoom equals `minZoom`, i.e. the fit really was clamped).
  DG-03's gap 5 ("doesn't fit at minZoom") may be partly this; worth re-measuring there.

### 10. Provider accent token

- Where: `src/nodes/zone-node.tsx:164` (`// P4`).
- What: there is no per-provider accent (`border-s-<provider>`), and there must not be a
  vendor hue in a package. The header rail is `border-s-2 border-s-border-strong` and the
  provider mark carries the identity. Proposed: a neutral `--flow-group-accent` token
  (default = `--border-strong`) a consumer theme or a zone `style` can retint.

### 11. Zone border rung ≥3:1 vs nested fill

- Where: `src/nodes/zone-variants.ts:9-14` (owner classes); tokens `--border-strong`,
  `--surface-muted`, `--card`, `--background`.
- What: the zone surfaces sit within 1.00–1.29:1 of each other and of the canvas, so a
  zone's LINE is the only cue around it — for a nested zone with its parent's fill
  (customer ⊃ on-prem ⊃ subnet) and equally for a top-level zone on the canvas. Every
  owner therefore takes `border-border-strong` (the first cut had customer and SaaS on
  `border-border`: 1.32 / 1.35 / 1.48:1 vs the canvas in light / qlik-light / dark).
  Even the strong rung misses 3:1 against the muted fill.
- Evidence: computed colours on the gallery, `getComputedStyle` border colour composited
  over the canvas ground and every ancestor zone's fill on a 1×1 canvas, WCAG ratio. The
  colours carry no alpha (`--border-strong` is an opaque `oklch`), so the only
  approximation is 8-bit rounding and ignoring the SaaS body's faded hatch lines.

  | border-strong against                                                            | light    | qlik-light | dark     |
  | -------------------------------------------------------------------------------- | -------- | ---------- | -------- |
  | parent `bg-surface-muted` (customer ⊃ customer: `vienna-dc`, `dmz`, `azure-sub`) | **2.89** | **2.82**   | **2.89** |
  | canvas ground (top-level zones, all owners)                                      | **2.97** | 3.02       | 3.72     |
  | parent `bg-card` (SaaS ⊃ SaaS: `eu-region`)                                      | 3.24     | 3.15       | 3.17     |
  | parent `bg-background` (hosted/partner nested: `prod-vpc`, `eks`, `pci`)         | 3.11     | 3.02       | 3.49     |

  Ground: light `oklch(0.97 0.002 257)`, qlik-light `oklch(0.985 0 0)`, dark
  `oklch(0.18 0.012 257)`; `--border-strong`: `oklch(0.65 0.008 257)`, `oklch(0.657 0 0)`,
  `oklch(0.54 0.014 257)`.

- Not invented: no app token. Non-colour channels carry the owner regardless — border
  STYLE (solid / dotted / dashed), border WEIGHT per kind, the owner word (badge where
  ownership changes, `sr-only` otherwise) and the SaaS hatch (`04-zones-light-greyscale.png`).
- Proposed (tokens): a boundary rung that clears 3:1 against `--surface-muted` in every
  theme (a `--border-boundary`, or `--border-strong` darkened ~0.03 L in light/qlik-light
  and lightened in dark), or `--surface-muted` lifted toward `--background` so the
  existing rung clears it. Same gap as the wave-0 review's nested-group measurement
  (`--flow-group-border` 2.73–2.87:1 light, 2.82:1 qlik-light, per the orchestrator).

## Deviations from the item

- **No `cva` import** (finding 1). Same config shape, table-driven resolver.
- **Header geometry**: `h-11` (44 px) and auto-fit defaults `padding = 16, header = 44`
  instead of the item's `h-10` / `24` / `40` — so the zone agrees with ELK's reserved
  60 px and ELK's output does not move on load (finding 4).
- **Header**: a `div`, not `<header>` (a `<header>` outside sectioning content is a
  `banner` landmark — one per zone); `IconButton` takes `label` + `icon` (its props omit
  `aria-label` and `children`, `icon-button.tsx:17-32`) with `size="icon-sm"`; the label
  names the zone (`Collapse Customer estate`) so eleven toggles are distinguishable; the
  owner badge shows where ownership changes (finding 3); kind and owner are in `sr-only`
  text for AT.
- **Hatch** on a body element, not the frame (finding 2).
- **Border rung**: every owner on `border-border-strong` (the item allowed either rung);
  the fill never separates a zone (finding 11).
- **Gallery**: leaves are `FlowNode` (`type: "brand"`) — DG-05's `arch/service` is not on
  this branch; the header glyph is a local `KIND_GLYPH` map of Lucide components — DG-04's
  `LucideByName` is not on this branch; provider marks are `ServiceLogo` monograms (no
  DG-04 icon index registered). Rendered inside the dashboard shell so the theme switch
  is the real one.
- **Resize → manual**: `onResizeEnd` sets `sizing: "manual"` so a hand-sized zone is not
  snapped back by the next fit.

## Screenshots (`apps/diagram/.evidence/DG-06/`)

| File                                                        | What                                                                                                                        |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `01-zones-light.png`                                        | `#zones`, light, 1440×900 — four owners, 3-deep nesting, one collapsed zone                                                 |
| `02-zones-dark.png`                                         | dark                                                                                                                        |
| `03-zones-qlik-light.png`                                   | Qlik Bright (`qlik-light`)                                                                                                  |
| `04-zones-light-greyscale.png`                              | light under `grayscale(1)` — owners by fill/hatch + border style + owner word                                               |
| `05-closeup-saas-partner-light.png`                         | zoomed: provider rail + monogram, SaaS hatch, dotted/dashed borders (taken before finding 11: SaaS line on `border-border`) |
| `06-collapse-kbd-1-focused.png` … `-3-collapsed-vienna.png` | keyboard expand/collapse (programmatic focus shows no ring in step 1; the ring shows after the key press)                   |
| `07-drag-1-before.png` … `-4-dropped-left-top.png`          | drag-to-grow sequence (right/bottom, then left/top deficit)                                                                 |
| `08-resize-to-manual.png`                                   | hand-resized nested zone keeps its size, parent refits                                                                      |
| `debug-*.png`                                               | pre-layout frame, post-reload state, the fit after the re-fit workaround                                                    |

`01`–`04` were retaken after the border-rung change (finding 11); `05`–`08` and `debug-*`
predate it — customer and SaaS lines show on `border-border` there. Layout, header and
behaviour are unchanged by it.
