# DG-05: node primitives the library is missing

Found while building the architecture node catalog (`src/nodes/`: `ServiceNode` in both D5
looks, `ActorNode`, `DatastoreNode`, `QueueNode`, `ExternalNode`, `NoteNode`) on
`FlowNodeCard` + `FlowPort` + `flowToneVariants` + `FlowToneIndicator`, the contract in
`packages/flow/src/custom-nodes/custom-nodes.stories.tsx`. Evidence screenshots are in
`apps/diagram/.evidence/DG-05/` (main checkout, git-ignored). Each gap below is worked around
in the app with a `// P4: library gap` comment at the line named.

The contract held: `FlowNodeCard`, `FlowPort`/`flowPortId`, `resolveFlowTone`,
`flowToneVariants` and `FlowToneIndicator` match `verified-apis.md`. Handle ids came out as
`in:in`, `out:out`, `in:top`, `out:bottom` (read from the DOM). The proxied focus ring
shows on the borderless `icon` look too (`08-keyboard-focus-icon-node-light.png`), because
`focus-ring-static` is a box-shadow ring plus an outline, not a border.

## 1. `FlowNodeCard` has no "bare" look (the D5 `icon` variant)

- **What:** the AWS/Azure look is a mark with a label and no box. `FlowNodeCard` always
  paints `border border-border bg-flow-node shadow-sm`, so the app has to un-paint all
  three through `className`.
- **Where:** `apps/diagram/src/nodes/arch-node-variants.ts:32-34` (the `icon` classes
  `border-0 bg-transparent shadow-none`).
- **Knock-on:** with the border gone, `flowToneVariants` has nothing left to paint. A
  vendored mark is an image, so `data-flow-tone-part="mark"` cannot tint it either. The
  tone survives only as the `FlowToneIndicator` glyph. The app makes the title the tone
  carrier (`data-flow-tone-part="ink"`, `src/nodes/service-node.tsx:79-86`).
- **Proposed API:** `FlowNodeCard variant="card" | "bare"` (default `card`). `bare` drops
  border, fill and shadow, and paints the tone on a part the library owns, for example a
  2 px underline under the label or a ring around the mark slot. Selection and focus rings
  stay as they are, since they already work without a border.

## 2. No `cva` for app-side variants

- **What:** `class-variance-authority` is not an app dependency (the app's `package.json`
  is outside this item's touches, and the item lists no install), and neither ui nor flow
  re-exports `cva`.
- **Where:** `apps/diagram/src/nodes/arch-node-variants.ts:21-26`. The config is written
  in `cva`'s exact shape with a small resolver. It is the same workaround as DG-06's
  `zone-variants.ts`.
- **Proposed API:** either list `class-variance-authority` in the app's dependencies (an
  app decision, not a library one), or have ui re-export `cva` and `VariantProps` next to
  `cn`, as `@elabs-ai/components-ui/lib/cn` already does for `cn`.

## 3. `FlowPort` is always visible

- **What:** four ports per node means 280 dots on the 70-node gallery. In a static
  architecture diagram the ports are noise until someone draws an edge.
- **Where:** `apps/diagram/src/nodes/service-node.tsx:29-31` (`ArchPorts`). Not worked
  around; the dots are drawn.
- **Proposed API:** `FlowPort showOn?: "always" | "hover" | "connect"` (default
  `always`). `hover` shows the dot while the node is hovered, focused or selected;
  `connect` shows it only while a connection drag is in progress. The dot keeps its
  layout box in every mode, so handle measurement (`FLOW_HANDLE_ANCHOR_CLASS`) does not
  change.

## 4. No badge row part

- **What:** the card look ends in a row of badges (`pii`, `prod`). Every custom node
  re-invents the wrap row.
- **Where:** `apps/diagram/src/nodes/service-node.tsx:57-66` (`BadgeRow`: outline `Badge`s
  in a `flex flex-wrap gap-1` row). Note: `Badge` has no `size` prop (the item's
  `Badge size="sm"` does not exist). `variant="outline"` at the badge's own `text-meta`
  size is used as is.
- **Proposed API:** `FlowNodeBadges({ items: string[] | ReactNode, align?: "start" |
"center" })`, with `data-slot="flow-node-badges"`, wrapping outline `Badge`s.

## 5. No icon-name mark for JSON node data

- **What:** `FlowNodeBaseData.icon` is a `ReactNode`, so a node described in JSON (the
  dialect's output, flow review §4.1) cannot name its mark. The library has no resolver
  that maps a `vendor/name` string onto `ServiceLogo` or a Lucide glyph.
- **Where:** `apps/diagram/src/nodes/arch-mark.tsx:27-29` (`ArchMark`).
- **Proposed API:** with the icon-name scheme that DG-04 already proposes for the icons
  package, a `FlowNodeBaseData.iconName?: string` resolved through a registry passed to
  `CanvasShell` (or `defineFlowNodeType`), so custom nodes receive a ready mark.

## 6. A neutral dashed frame cannot take the strong border rung

- **What:** conventions say a dashed or dotted line reads a rung lighter, so it should
  use `border-border-strong`. But any whole-border colour in a node's `className` overrides
  the tone border that `flowToneVariants` paints (`className` merges last). So the
  external node's dashed frame stays `border-border`: 1.44:1 on white, and it is the
  **only** cue for "external" in the `icon` look.
- **Where:** `apps/diagram/src/nodes/arch-node-variants.ts:43-46`.
- **Proposed API:** `flowToneVariants` (or `FlowNodeCard`) reads the neutral border colour
  from a variable, e.g. `--flow-node-border` (default `var(--border)`), so a node sets
  `[--flow-node-border:var(--border-strong)]` and a status tone still wins.

## 7. No striped rail token

- **What:** the item asks for a striped left rail on the queue card. No border-stripe
  token exists. `bg-hairline-stripes` is a masked background decoration, not a border,
  and conventions keep decoration out of controls.
- **Where:** `apps/diagram/src/nodes/arch-node-variants.ts:51-53`. The rail is the
  nearest existing token, a solid `border-s-4 border-s-border-strong`. It stays grey on
  toned cards (measured: `border-inline-start-color` is `--border-strong` on the info
  card).
- **Proposed API:** none needed if the solid rail is accepted. Otherwise a
  `border-s-stripes` utility in tokens.

## 8. Observed in the library, not worked around (for the flow owner)

- **Featured star and featured border fail 3:1 in `light`.** The `emphasis` part is
  `text-primary` (`packages/flow/src/flow-tone/flow-tone.ts:116`) and the neutral featured
  border is `border-primary`. In `light`, `--primary` is `oklch(0.875 0.148 116.5)`, which
  measures **1.42:1** on the white card. The star is the featured state's non-colour
  channel, so it needs 3:1 (WCAG 1.4.11). Seen in `04-nodes-light-greyscale-tone-glyphs-closeup-2.png`.
  Proposal: `text-primary-text` for the star and `border-primary-text` (or a darker fill
  rung) for the frame.
- **Selected and focused look almost the same.** `selected` paints `ring-2 ring-ring`, and
  `focus-ring-static` paints a ring in the same `--ring` colour plus a 1 px contour
  (`packages/flow/src/flow-node-card/flow-node-card.tsx:51-52`). On the lime `light`
  theme, "selected" and "focused" differ only by that contour line
  (`09-keyboard-enter-selected-then-tab-light.png`). Proposal: a distinct selection
  colour or offset, so the two states do not depend on a 1 px line.
- **The info and destructive glyphs are vertical mirrors.** `FlowToneIndicator` draws
  Lucide `Info` for info (`flow-tone-indicator.tsx:18`) and `AlertCircle` for destructive
  (`status-badge.tsx:167`): a circle with a dot and a bar, flipped. In greyscale at
  gallery zoom they are easy to confuse. Proposal: `OctagonAlert` or `XCircle` for
  destructive, so the shape differs as well.
- **The tone is not in the node's accessible name.** `defaultNodeAriaLabel`
  (`packages/flow/src/canvas-shell/node-aria-label.ts:21`) names the node wrapper from
  `data.title` only. The tone and "Featured" are an `sr-only` span inside the node, so they
  are read only when a screen reader walks the node's content. Proposal: append the
  resolved tone name to the default label when it is not neutral ("Order API, Info").

## 9. Not a library gap: DG-04 pack follow-up

`snowflake/snowflake`, `snowflake/warehouse` and `qlik/cloud` are **wordmarks**
(`viewBox` 512×116 and 512×151), so in a 40 px square mark slot they render about 9 px
tall. In `dark` the mono Qlik wordmark is nearly invisible
(`02-nodes-dark-card-rows.png`). The packs want square marks for those names. This is a
DG-04 icon-pack item, not a library gap.

## Wave-1 review additions (2026-09-26)

### 9a. Correction to #9: dark-ink marks vanish in `mono` — a library gap (review M6)

- #9 routed the faint `dark` Qlik wordmark to the DG-04 packs. That is only half right:
  square marks would fix the wordmark's size, but not its colour.
- Where: `packages/icons/src/service-logo.tsx:126` —
  `cx("size-full object-contain", variant === "mono" && "grayscale")`. For a
  `src`-backed mark, `mono` only desaturates. Dark ink stays dark, so it disappears on a
  dark surface. Used by the zone header (`src/nodes/zone-node.tsx:180-185`, `mono`) and
  the legend's provider list (`src/chrome/diagram-legend.tsx:184`, `brand`).
- Evidence: `apps/diagram/.evidence/review-wave1-fixes-zones/10-zones-dark-1440.png` (the
  "Managed AWS account" header mark) and `06-icons-aws-dark-1440.png` (the `aws/aws`
  tile); the wave-1 review's `11-dark-provider-marks-mono.png`, `11a-dark-aws-header.png`,
  `11b-dark-qlik-header.png`.
- No app fix: the review found no clean stopgap.
- Proposed API (icons): `mono` paints the image as a CSS mask over `currentColor`
  (`mask-image: url(src)`, `mask-size: contain`, `bg-current`), so the mark follows the
  surrounding text colour (for example `text-muted-foreground`) in every theme. Add an
  optional `srcDark` for `brand` marks whose own colours fail on dark, picked through
  `resolveThemeIsDark`.

### 10. The node's accessible name has no kind (review m1)

- Where: `packages/flow/src/canvas-shell/node-aria-label.ts:21` — `defaultNodeAriaLabel`
  names the node wrapper from `data.title` only. The wrapper's `aria-label` replaces its
  content as the name, so an `sr-only` kind word inside the node does not reach it (the
  same cause as #8's tone point).
- Workaround: `archNodeAriaLabel(kind, title)` (`src/nodes/service-node.tsx:55-65`,
  `// P4`) builds "<title>, <kind>", and the node producers set it as `node.ariaLabel`
  (`src/galleries/node-gallery-view.tsx`, `src/fixtures/zone-gallery.ts`). The
  `sr-only` kind word stays inside the node for a screen reader walking its content
  (`KindWord`, `src/nodes/service-node.tsx:72`). Every future producer of arch nodes (the
  YAML compiler) must set the label too — easy to forget.
- Evidence (`#nodes`, read back): "Order API, Service", "Business users, Actor",
  "ANALYTICS_WH, Data store", "Order events, Queue", "Payment provider, External system",
  "Orders DB, Data store", "Change stream, Queue".
- Proposed API (flow): a `CanvasShell` `nodeAriaLabel?: (node) => string` prop,
  defaulting to `defaultNodeAriaLabel`, or a label resolver registered per node type next
  to `nodeTypes`. It would also carry #8's tone proposal.

## Wave-2 review additions (2026-09-26)

### 9b. Sharpened #9a: `ServiceLogo` needs a `mono` mask and a `srcDark` (review M6)

- What: a `src`-backed `ServiceLogo` mark cannot follow the theme. `mono` only desaturates
  the image, so dark ink stays dark on a dark surface, and a `brand` mark has no way to
  swap to the vendor's dark-background artwork. The wave-2 review measured the vendor
  marks at 1.1–2.9:1 in `dark` and `qlik-dark` (legend, zone headers, nodes) —
  ClickHouse, Databricks, Qlik (incl. Talend), Snowflake and the AWS/Azure provider marks.
- Where: `packages/icons/src/service-logo.tsx:126` — the `src` branch renders
  `<img className={cx("size-full object-contain", variant === "mono" && "grayscale")}>`;
  `ServiceLogoDefinition` (`service-logo.tsx:25-33`) has `src` and `render` but no dark
  source. The only way in is `render` (called at `service-logo.tsx:119`).
- Workaround (app, `// P4: library gap`): `src/icons/register-packs.ts` registers the
  affected marks with a `render` callback (at the `const render: ServiceLogoRender`
  line) that returns `VendorMark` (`src/icons/theme-aware-mark.tsx`):
  - `mono` → a `span` with `bg-current` and the mark's file as a CSS mask
    (`mask-contain mask-center mask-no-repeat`, the URL in an inline `mask-image`), in
    every theme;
  - `brand` → the unchanged `<img>` while light; in a dark theme, the vendor's own
    dark-background file (`public/icons/<vendor>/dark/`, provenance in
    `THIRD_PARTY_ICONS.md`), or the `mono` mask where none was found (Talend, Microsoft). The
    choice reads `resolveThemeIsDark(el)` on the rendered mark and re-reads it whenever
    `useTheme().theme` changes.
  - Because `ServiceLogo` calls `render` as a plain function inside its own render, the
    callback must return an element (`createElement(VendorMark, …)`) rather than call
    hooks itself — a second, smaller gap: `render` is not a component.
- Evidence: the fix branch's report `review-wave2-fixes-logos.md` (before → after per
  mark, theme and place) and the screenshots in
  `apps/diagram/.evidence/review-wave2-fixes-logos/`.
- Found while measuring (not gaps, recorded so they are not rediscovered):
  - The mask takes the colour of its context, including a node's tone: the card node's
    mark carries `data-flow-tone-part="mark"`, so a toned node's vendor mark now takes the
    tone's mark rung (the Qlik Sense "Central node", `warning`), as its Lucide glyph
    already did. The grayscale image ignored the tone.
  - Wordmarks in a square slot stay size-limited (#9 still stands): the SQL Server and
    Qlik wordmarks in a 20 px card slot are about 4–6 px tall, so antialiasing caps their
    measured contrast at 1.8–4.8:1 in the light themes (SQL Server lowest) although the
    mask colour itself is 5.1–6.0:1 (3.1–3.6:1 for the `warning` tone). The Databricks and Snowflake wordmarks in
    a 16 px zone header are 2.5–3.6 px tall and too thin to measure.
- Proposed API (icons):
  - `mono` for a `src` mark paints the file as a mask over `currentColor`
    (`mask-image: url(src)`, `mask-size: contain`, `mask-position: center`,
    `mask-repeat: no-repeat`, `bg-current`) instead of `grayscale`;
  - `ServiceLogoDefinition.srcDark?: string`, rendered for `brand` when
    `resolveThemeIsDark(el)` is true, re-evaluated on theme change (the icons package
    would take `@elabs-ai/components-tokens` as a peer, or accept a `dark?: boolean`
    prop so the caller decides);
  - optionally `darkFallback?: "mono"` for marks with no published dark artwork.
  - With that, the app registers `{ src, srcDark, label }` and drops `VendorMark` and its
    `render` callbacks, keeping a `// P4:` note until the release lands.
