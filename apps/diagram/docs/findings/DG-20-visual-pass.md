# DG-20 — Visual pass: findings

## §1 Audit of v1 (before any change)

Shot at 1920 × 1080, canvas only (editor collapsed), fresh load per shot, on `db023d96`.
Files (not in Git, the review scratchpad): `before/<example>-<theme>.png` for
`lakehouse-aws`, `qlik-sense-enterprise-onprem`, `clickhouse-cloud-stack` × `light`, `dark`,
`qlik-light`. Regions are given as `x,y` in those shots; crops are still to be cut (handoff).

1. **Title block is a label, not a title.** A lone `subtitle`-rung heading in a small floating
   card, the same size as the top bar's title; no description, no source line
   (lakehouse-light 64,70 – 475,120). Weak top of the hierarchy.
2. **Zone owner word is stranded.** The owner badge sits at the far right of a full-width
   44 px header band, 1 000 px from the title it qualifies (onprem-dark "CUSTOMER MANAGED"
   at 1 565,251; lakehouse "CUSTOMER MANAGED" at 1 125,348).
3. **Frames are heavy and all the same weight.** Every owner uses the strong rung and
   cloud accounts / on-prem use 2 px, so frames out-shout the content; AWS account ⊃
   eu-central-1 reads as a double frame (clickhouse-qlik-light 1 143,65 – 1 680,512).
4. **Nesting depth has no surface cue.** A nested zone repeats its parent's fill
   (VPC ⊃ Private subnet in lakehouse; eu-central-1 in clickhouse), so only the line separates
   levels.
5. **SaaS hatch is barely there** at fit zoom (Snowflake / Databricks zones, lakehouse-light
   1 385,460 – 1 686,599): customer vs SaaS rides almost only on the owner word.
6. **Icon marks have no common ground.** Coloured vendor tiles (AWS), bare line glyphs
   (Grafana, Superset, Okta key) and full-bleed logos (ClickHouse bars) sit side by side at
   40 px with nothing unifying them (clickhouse-qlik-light, top zone).
7. **Kind shape cues read as selection.** Datastore / queue / actor cues are 2 px
   `border-current` outlines round the mark (Orders DB box, Kafka topics circle), which look
   like a focus or selection state.
8. **Card nodes are flat and repetitive.** On dark the card fill is within a hair of the zone
   fill; every card repeats a tiny "Service" eyebrow; the badge ("Tier 1") is a filled chip
   heavier than the title (onprem-dark 802,485).
9. **Edge label clusters crowd each other.** Onprem's fan-out row: "Repository ·
   PostgreSQL 4432" runs into "Reload · SAP RFC nightly 02:00" (onprem-dark 900 – 1 085,
   726 – 741); protocol chips on `bg-muted` read as code snippets, not captions.
10. **Step numbers shout.** Step badges take the primary fill, so in `qlik-light` five bright
    green dots out-rank every node title (clickhouse-qlik-light 1 176,557; 1 541,313).
11. **All edge kinds draw the same stroke.** Data, request, control and network differ in
    dash and head only; access is merely a darker ink. Arrowheads are small at fit zoom
    (harvest H-91).
12. **Legend is heavy.** Open by default with 3 sections and 12 – 16 rows on a full floating
    card, taking the bottom-left corner (onprem-dark 64,790 – 240,1 065).
13. **Ports and group handles add stray dots.** Every connected end shows an open circle, and
    zones show group handles mid-edge (lakehouse AWS account 297,588; ClickHouse Cloud
    1 068,971).
14. **Collapse chevrons at rest.** Every zone header carries a ghost chevron button, chrome
    noise in a picture meant for reading.
15. **External nodes are boxed.** Icon-look externals get a dashed 1 px box (Salesforce,
    Okta) that no sibling has, so they look like a different drawing style.
16. **Minimap competes.** Top-right it is a white card with dark-grey blocks, the
    highest-contrast object on the light canvas (outside this item's touches; noted only).

## §2 Before / after

Shot the same way as §1 (1920 × 1080, canvas only, fresh load per shot) into the review
scratchpad `after/`: the nine `<example>-<theme>.png`, plus `composite-mock-{light,dark}`
(full canvas) and `composite-mock-zoom-{light,dark}` (900 × 600 at 200 % on the composite),
`greyscale-{clickhouse-cloud-stack,qlik-sense-enterprise-onprem}`, `decoration-6-lakehouse-aws`,
`nodes-gallery-{light,dark}` (two nodes carry `data-glow`), `edges-gallery-light`,
`focus-{icon,card}` (focus moved by Tab only, no click: `:focus-visible` true, node not
selected, so the ring is the focus ring) and `state-loading-{light,dark}`.

### Canvas states

- **Loading** (`state-loading-{light,dark}`): the real first-layout skeleton from a fresh page
  load. The layout finishes in well under a second, so for the shot the "ready" switch was held
  back by a temporary dev-only `?hold-loading` query flag in `canvas-pane.tsx`; the flag was
  removed afterwards and never committed.
- **Empty and error cannot be reached from a fresh load, so there is no shot of either.** The
  store starts from the lakehouse example (`initialState(lakehouseYaml)` in `diagram-store.ts`)
  and `compileNow` only replaces the drawn graph when a compile yields one: clearing the text or
  typing something that is not a diagram keeps the last diagram on screen with the "Showing the
  last valid diagram" badge. The new `EmptyState` / `StatePanel kind="error"` branches in
  `canvas-pane.tsx` are therefore only reachable once the store can start blank or drop the
  drawn graph. Follow-up outside this item: `diagram-store.ts`.

### Per example

- **lakehouse-aws** — the AWS account reads as one muted estate with the VPC a raised rung
  inside it and the private subnet capped on the strong line; Snowflake / Databricks sit on
  the raised card under their hatch with "SAAS" in the corner chip beside the title. Marks
  share one tile, so AWS tiles, Snowflake and the Salesforce / Okta externals read as one
  family; the externals lost their box (dashed tile instead). With `?composite-mock` the
  "Semantic layer" composite sits between S3 — curated and Snowflake.
- **qlik-sense-enterprise-onprem** — the data centre, DMZ and Qlik Sense site now step
  down one fill rung per level instead of repeating one fill; the DMZ trust boundary is the
  one 2 px dashed frame; the partner zone keeps its 1 px dash. Protocols moved into the
  label pills, so each fan-out label is one line (plus the schedule) instead of two, and the
  "Repository · PostgreSQL 4432" / "Reload · SAP RFC" run-in is gone (onprem-dark 830 – 1 160,
  745 – 765). In dark the nested zones' raised rung is DARKER than the muted estate (the
  theme's card sits below its muted surface), still one distinct rung per level; a card node
  on a nested zone is close to the zone fill there (defect 8, partly).
- **clickhouse-cloud-stack** — "AWS account ⊃ eu-central-1" is no longer a double 2 px
  frame: a muted estate with a raised region inside it. The five step markers are outline
  circles, so in `qlik-light` they no longer out-rank the node titles.

### The 16 defects

| #   | Defect                                  | Status    | How / why not                                                                                                                                                                                                           |
| --- | --------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Title block is a label                  | Fixed     | `display` rung on a canvas patch with a hairline rule, prose-width description, source line "Atlas · N nodes · M flows" (folder and date come with the workspace service).                                              |
| 2   | Owner word stranded                     | Fixed     | Corner label chip: mark, title, subtitle and owner word together.                                                                                                                                                       |
| 3   | Frames heavy, one weight                | Fixed     | 1 px everywhere; the quiet rung where a fill carries the edge; dotted/dashed stay strong; only a trust boundary is 2 px.                                                                                                |
| 4   | No depth cue                            | Fixed     | Fill ladder canvas → muted → raised per level (`zoneFill`); past the last rung the line goes strong (`capped`).                                                                                                         |
| 5   | SaaS hatch faint                        | Partly    | The hatch utility is unchanged (a token texture); SaaS now also differs by FILL (raised card vs the customer's muted) and by the owner word in the chip, which is what separates it in greyscale.                       |
| 6   | Marks without common ground             | Fixed     | 48 px `bg-card` tile with `shadow-xs` under every mark.                                                                                                                                                                 |
| 7   | Kind cues read as selection             | Fixed     | The shape moved to the tile (actor circle, datastore rounded-bottom, queue pill, external dashed); no outline round the mark.                                                                                           |
| 8   | Cards flat and repetitive               | Partly    | `shadow-xs` lift (hover `shadow-sm`), uppercase eyebrow, quiet outline badges. The eyebrow still says "Service" when no provider is set — the brief asks for provider/kind there.                                       |
| 9   | Label clusters crowd                    | Fixed     | One pill per flow (label ∣ secure glyph + protocol), schedule below; the ELK label probe follows it. Checked on the three examples: no label has a bend of its own path inside it, and none is crossed by another path. |
| 10  | Step numbers shout                      | Fixed     | Outline circles; the primary fill only while the step is lit (`data-lit`).                                                                                                                                              |
| 11  | Same stroke for every kind, small heads | Fixed     | Width rungs network 1 / flow 1.5 / access 2 px (`KIND_STROKE_WIDTH`, legend swatch too); heads 8 px in user space.                                                                                                      |
| 12  | Legend heavy                            | Fixed     | `shadow-ring-xs`, `p-2.5`, `gap-0.5` rows, 16 px owner swatches; closed at first above 8 rows unless the session kept a choice.                                                                                         |
| 13  | Stray port / handle dots                | Not fixed | The dots are connected ports, shown by design since the ports-only-when-connected quick fix (`port-visibility.ts`); hiding them further is a separate decision.                                                         |
| 14  | Collapse chevrons at rest               | Fixed     | The chevron shows on hover, keyboard focus or when the zone is collapsed.                                                                                                                                               |
| 15  | Externals boxed                         | Fixed     | No node box; the dashed strong outline is on the tile.                                                                                                                                                                  |
| 16  | Minimap competes                        | Not fixed | Outside this item's files (noted in §1).                                                                                                                                                                                |

### Checks

- `typecheck:local`: 0 errors. `lint:local`: 12 warnings, all `conventions/i18n-strings`, none
  in a touched file (the baseline). `pnpm brand-ui audit --strict apps/diagram/src`: exit 0
  (0 style, 0 content-slop).
- Zone headers: on all three examples no zone title or owner word truncates at the laid-out
  width (the probe now mirrors the chip; a spacer element had cost one 8 px gap it did not
  measure — replaced by `me-auto`).
- Greyscale: customer (muted fill, solid quiet line), SaaS (raised fill + hatch), hosted
  (dotted strong), partner (dashed strong), plus the owner word in every top-level chip.

### Deviations from the brief (deliberate)

- **Dimming.** DG-18's `DIM_CLASS` already fades marks to 0.25 and keeps TEXT at full opacity
  (measured 4.5:1); it lives outside this item. A second 0.35 opacity on the tile would stack
  on the mark's, so a dimmed tile or card instead loses its lift (`shadow-none`); no text is
  faded. The 0.25 vs 0.35 rung is the maintainer's call.
- **Motion.** The token values (160 / 260 / 600 ms, `--ease-standard`) replace the brief's
  150 / 250 / `cubic-bezier(.2,.8,.2,1)`; every transition added here uses `MOTION_CLASS`.
- **Mark size.** A 32 px mark on a 48 px tile, not a 48 px mark on a tile: at fit zoom a
  64 px tile per node crowded every row.
- **Label chip rises 5 px, not a full straddle.** ELK routes edges 10 px off a zone
  (`spacing.edgeNode` default) and does not know the chip exists; a 14 px rise sat on passing
  lines (clickhouse: ClickHouse Cloud, Confluent). Follow-up outside this item: give zones
  `elk.spacing.edgeNode` ≥ 16 in `run-elk.ts`, then the chip can straddle fully.
- **Trust boundary is dashed again** (the brief), which wave-1 review M8 had removed because
  it read as partner. It is told apart from partner by weight (2 px vs 1 px) and the Shield
  in the chip, and the owner word still names its owner.
- **SaaS top-level zones sit on the raised fill**, not the canvas, so customer and SaaS differ
  by fill as well as by hatch.
- **Composite mock ports are the standard `in`/`out` pair** with "tables" / "marts" labels:
  the layout's port picker (`followZoneDirection`, layout-from-spec.ts) rewrites every arch
  node's handles to the definition's port names, so a named `in:tables` handle lost its edge.
  The labels sit INSIDE the node, beside their port dot on the port line (the box is `w-40`
  so they clear the tile), where no edge runs; outside the node they sat on the edge line.
  The stack behind the tile steps its sheets in 7 px a side and rises 6 px per sheet, so two
  separate sheet edges read above the tile at 100 % (`composite-mock-zoom-*`).
- **Legend edge samples stay 28 × 12**: a line sample needs length to show dash and head; the
  owner swatches are 16 px.

## Library gaps met so far

- **`Badge` has no `size` prop** (`packages/ui/src/components/badge/badge.tsx`, `badgeVariants`
  has only `variant`). The item's `Badge size="sm" variant="outline"` for the card badge row
  falls back to `variant="outline"` with tighter padding. Proposed: `size: "sm" | "md"`.
- **Motion tokens differ from the brief.** Tokens ship `--duration-fast` 160 ms,
  `--duration-base` 260 ms, `--duration-slower` 600 ms and `--ease-standard`
  `cubic-bezier(0.2, 0, 0, 1)`; `src/motion.ts` reads those, not the brief's 150 / 250 /
  `cubic-bezier(.2,.8,.2,1)`. `useReducedMotion` ignores `data-motion-pref` (H-51), so
  `motion.ts` reads the attribute itself.
- **`hairline-ticks-x` owns `position: relative`** (tokens themes.css), so the ruler cannot be
  the absolutely placed element itself; the zone nests the tick span inside a placed, masked
  span. A positioning-neutral variant (or a note in the utility's doc) would save the wrapper.
- **No named ports in the layout's port picker.** `followZoneDirection` only knows the arch
  definition's port names; DG-22's composites need per-instance ports there.
- **ELK does not know about content drawn outside a zone box** (the corner chip); see the
  straddle deviation above.
- **`hairline-stack` insets by a percentage** (`--hairline-stack-inset: 4%`), about 2 px on a
  48 px tile, which reads as one thicker top line rather than stacked cards. The composite mock
  sets a fixed 7 px; a pixel default (or a size-aware one) would suit small surfaces.
