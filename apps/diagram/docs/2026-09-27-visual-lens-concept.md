# Two lenses on one diagram — visual (marketecture) ⇄ technical

Date: 2026-09-27 · Input: `Qlik_Style_Guide.pptx` (Qlik Talend Data Integration marchitecture master deck, July 2026, 22 slides: 11 diagrams + an 8-rule style guide) · Status: concept for the maintainer's decision · Companion: `2026-09-27-atlas-v2-plan.md`

## 1. Verdict

**Yes — and it is cheaper than it looks, because a marketecture diagram is not a different diagram; it is the same model at a coarser grain under a stricter style contract.** Everything the Qlik guide asks for maps onto things Atlas v2 already plans: capability boxes are composites (DG-27), role lanes are zones with a role, process pills are annotations, solid/dashed connectors are edge kinds, colour-by-ownership is `owner` + a "hero vendor". What is new is (a) a **visual layer** in the YAML that says how technical elements group into marketing boxes and lanes, (b) a **style profile** system that encodes a vendor's guide as tokens, and (c) a **lens switch** with a transition that keeps the reader oriented.

The one thing that will not work is a pure stylesheet swap: rendering the 19-node technical lakehouse in navy and green still gives a technical picture. Marketecture needs _grouping_, _reduction_ and _lane discipline_ — that is data, not CSS.

Proof: `visual-lens-mock.png` beside this file — the v1 `lakehouse-aws.yaml` rendered by hand through the Qlik rules (7 boxes, 3 lanes + control plane, pills, ELT badge, dashed control lines). Not pixel-perfect; it exists to show the grouping rules produce a credible marketecture picture from real technical content.

## 2. What the Qlik guide actually encodes (read as a rendering contract)

| Rule (slide)             | Contract                                                                                                                                                      | Atlas concept it maps to                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1 Colour carries meaning | green = the vendor's managed product/engine/agent; blue = everything else; navy = zone panel, never a component; white outline = sub-component                | `owner`/`provider` → **hero vendor** (green) vs other (blue); zone panel; nested sub-box             |
| 2 Zone system            | navy panel, 4 px accent bar by **role** (control plane/SaaS green · sources grey · customer-managed purple · customer VPC-<cloud> aqua), uppercase grey label | zone **role** (new): `sources · vendor-cloud · customer-managed · customer-vpc · targets`            |
| 3 Process pills          | aqua pills name a _process inside an element_ (LANDING, STORAGE, MIRROR, TRANSFORM), top-right, stacked, fixed vocabulary per product line                    | `processes: [landing, storage]` on a box/node; a vocabulary list in the style profile                |
| 4 Connectors             | solid white = primary data; dashed = control/reference/metadata; ELT badge = vendor-orchestrated process in a 3rd-party platform; elbows; arrowhead at target | flow `kind` data → solid · control/access/network → dashed; `process: elt` badge; orthogonal routing |
| 5 Icons                  | white monoline icons for generic capabilities inside a box; full-colour logos only for named technologies; never mixed for the same purpose                   | catalog entry `generic: true` → mono glyph; named product → `ServiceLogo` brand variant              |
| 6 Typography             | Inter, emphasis by weight; white text, grey only for zone labels                                                                                              | style profile typography tokens                                                                      |
| 7 Layout                 | data flow L→R, control plane spans the top, data plane below; sources left, targets right; grid; **identical positions across generic/AWS/GCP variants**      | lane layout with fixed order (ELK partitions); variants = same visual layer, swapped catalog names   |
| 8 Do/Don't               | never recolour for variety; never zone accents as fills; reuse pill labels; no diagonal/coloured arrows                                                       | the profile _forbids_ — the renderer has no per-node colour in visual lens                           |

The same structure exists in the other vendors' marketecture: AWS (white ground, orange/grey group frames, service icons in tiles, L→R), Azure (light ground, blue dashed groups, icon + label), Google Cloud (white cards with product icons, grey groups, coloured header bands). They differ in tokens and box anatomy, not in the model. So: **one visual layer, N style profiles.**

## 3. The model: a visual layer over the technical graph

```yaml
diagram: "1"
title: Lakehouse on AWS with Databricks and Snowflake
lens: technical                 # default lens when opened; the switch toggles it
zones: …  nodes: …  flows: …    # the technical graph, unchanged

visual:
  # style (profile) and hero are NOT here — they come from the theme and the style cascade (style-system concept §2)
  controlPlane: [qlik-cloud, dbx-workspace]        # spans the top band
  lanes:                        # left → right; a lane is a zone role
    - { id: sources,  role: sources,           title: Data sources }
    - { id: managed,  role: customer-managed,  title: Customer managed env — AWS, of: [aws] }   # derived from technical zones
    - { id: targets,  role: targets,           title: Targets, of: [snowflake] }
  boxes:                        # capability boxes = named groups of technical elements
    - { id: streaming, lane: sources, title: Streaming & Events, members: [msk] }
    - { id: batch,     lane: sources, title: CDC & Batch Sources, members: [postgres-rds, salesforce] }
    - { id: landing,   lane: managed, title: Landing & Storage,   members: [s3-landing, glue, s3-curated], processes: [landing, storage], sub: [s3-landing, s3-curated] }
    - { id: jobs,      lane: managed, title: Databricks jobs,     members: [dbx-jobs], processes: [transform] }
    - { id: network,   lane: managed, title: Network & Access,    members: [nat, iam, vpc], aside: true }
    - { id: snow,      lane: targets, title: Snowflake,           members: [snow-db, snow-wh], processes: [mirror] }
    - { id: analytics, lane: targets, title: Analytics consumers, members: [qlik-cloud] }
  flows:                        # optional overrides; everything else is derived by aggregation
    - { from: landing, to: jobs, process: elt }
  hide: [okta]                  # technical detail that has no marketing meaning here
```

**Derivation rules** (what the renderer does when `visual:` is partial or absent — so every technical diagram has _some_ visual lens on day one):

1. **Lanes** from zone roles: `owner: customer` + `kind: on-prem|datacenter` → `customer-managed`; `owner: customer` + `kind: cloud-account|vnet` → `customer-vpc` (title "Customer VPC — AWS"); `owner: saas` + `provider == hero` → `vendor-cloud` (control plane band); other `saas` → `targets` or `sources` by flow direction (net inflow → source, net outflow → target); nodes outside every zone → `sources` if they only emit, `targets` if they only receive.
2. **Boxes**: nodes in the same lane with the same `kind` and the same parent zone become one box titled by the catalog's _capability name_ (a new catalog field, e.g. `aws/rds → "Relational databases"`, `aws/managed-streaming-for-apache-kafka → "Streaming & Events"`); a node whose catalog entry is a named product keeps its own box (Snowflake, Databricks).
3. **Flows**: technical flows collapse to box→box; `kind: data` → solid, else dashed; two opposite flows → one bidirectional; a flow whose technical `kind` is `data` and whose source is a hero-managed engine inside a third-party box → `process: elt` badge.
4. **Colour**: `provider == hero` → hero fill; else other fill; zones → panel; sub-members → outline.
5. **Pills**: from a `processes` map in the profile keyed by catalog tags (`etl → TRANSFORM`, `object-storage → STORAGE`), overridable.
6. **Hide**: nodes with `kind: access|network` edges only (Okta, IAM, NAT) fold into a "Network & Access" aside box, or are hidden when the profile says `aside: false`.

The derived result is written back into `visual:` on request ("Materialize visual layer") so the author can then hand-tune titles, membership and order — the same text-is-truth rule as everywhere.

**Consistency across variants** (rule 7): a component's `visual:` travels with it; a customer diagram that `use:`s `components/qlik-open-lakehouse` inherits the boxes and lane placement, so "generic → AWS → GCP" are the same visual layer with different catalog names, exactly as the guide demands.

## 4. Style profiles: a vendor guide as data

`profiles/qlik-marketecture.yaml` (app-side; the library gets only the generic seam):

```yaml
profile: qlik-marketecture
version: 2026-07
ground: { fill: "#0E2340" } # the deck's page colour (Qlik guide, slide backgrounds)
zone:
  {
    panel: "#142D4A",
    label: { color: "#A9B3B6", case: upper, tracking: 2 },
    accent: { height: 4 },
    accents:
      {
        vendor-cloud: "#009845",
        sources: "#A9B3B6",
        customer-managed: "#93579C",
        customer-vpc: "#10CFC9",
        targets: "#10CFC9",
      },
  }
box:
  {
    hero: "#009845",
    other: "#1E4E78",
    sub: { stroke: "#FFFFFF" },
    radius: 6,
    title: { weight: 700 },
    items: { icon: mono },
  }
pill:
  {
    fill: "#10CFC9",
    text: "#FFFFFF",
    size: 7,
    case: upper,
    position: top-right,
    stack: true,
    vocabulary: [LANDING, STORAGE, MIRROR, TRANSFORM, ELT, REPLICATION, QUALITY],
  }
flow:
  {
    data: { stroke: "#FFFFFF", dash: none },
    control: { dash: "6 5" },
    badge: { elt: { fill: "#009845" } },
    routing: orthogonal,
    arrow: target-only,
    width: 1,
  }
icons:
  {
    generic: mono-white,
    named: brand-logo,
    heroLogo: { placement: top-left, variant: white-on-green },
  }
type: { family: Inter, emphasis: weight }
layout:
  {
    direction: LR,
    controlPlane: top,
    lanesOrder: [sources, customer-managed, customer-vpc, targets],
    grid: 8,
  }
forbid: [per-node-colour, diagonal-edges, coloured-arrows, accent-as-fill]
```

These are **raw colours by design**: a marketecture profile is a vendor's brand, exactly the case the `ServiceLogo` exception already covers ("a mark paints itself with the vendor's colour"). In the app it is allowed outright (the folder ruling). In the library (P4) the seam is generic: a `DiagramStyleProfile` type + a renderer that reads _its_ tokens; the profile files stay app-side, no vendor code in the package.

Other profiles to encode later, from public material: `aws-marketecture` (AWS Architecture Icons deck guidelines: white ground, group frames per service category, icon tiles), `azure-marketecture` (Azure architecture icons + the "solution idea" diagram look), `gcp-marketecture` (Google Cloud solution diagrams: white cards, product icons, grey containers), and a neutral **`atlas-clean`** (our own editorial look) so the visual lens is useful without any vendor.

## 5. The lens switch

- **Top bar:** a segmented `Technical | Visual` control (key `L`); the URL carries `&lens=visual`; export and present honour the active lens; a story step may set `lens:` so a walkthrough can start visual and zoom into technical.
- **Transition (600 ms, `MOTION.camera`):** technical → visual: nodes of a box fly to the box's slot and fade as the box fades in; zones morph into lane panels (same DG-27 expand/collapse machinery in reverse); edges re-route to box edges. Visual → technical: boxes expand into their members in place. Reduced motion → cross-fade.
- **Orientation:** hovering a box in visual lens highlights its members' names in the details card ("contains: Postgres (RDS), Salesforce"); clicking a box with the technical lens armed (⌥-click) switches and zooms to its members. This is the sales conversation: "here's the simple picture — and here's what it really is."
- **Editing:** in visual lens the inspector edits the visual layer (box title, membership via drag between boxes, pills, lane); in technical lens the technical graph. Both write to the same file.

## 6. Grouping quality — the hard part, honestly

Automatic derivation will produce _acceptable_ visual lenses for most technical diagrams and _wrong_ ones for some (a node that belongs in two stories; a box the marketer wants split). Three safeguards:

1. The derived layer is visible and materializable; hand-tuning is one YAML block, with IntelliSense for member ids (DG-28).
2. The catalog gets a `capability` field (the marketing name of a technical thing) — filled through the same MCP `fill-catalog` loop — so boxes get sensible names without human work.
3. The MCP `author-diagram` prompt learns the visual layer, so a Claude session composes both lenses at once.

## 7. Where it lands in the plan

Add one wave to Atlas after composition (it reuses composites, the catalog and the style pass):

| ID    | Wave | Title                                                                                                                                                                                                        | Depends on   |
| ----- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| DG-36 | 3    | Visual layer in the dialect (`visual:` block, zone roles, boxes, lanes, pills, hides), derivation rules, materialize, validation, schema, catalog `capability` field                                         | DG-26, DG-24 |
| DG-37 | 3    | Style profiles: `DiagramStyleProfile` type, profile loader, `qlik-marketecture.yaml` (from this guide) + `atlas-clean`; visual-lens node/zone/edge renderers (box anatomy, panel, pills, mono icons, badges) | DG-36, DG-20 |
| DG-38 | 3    | Lens switch: top-bar control, URL/state, lane layout (ELK partitions, control plane band), morph transition, box hover/⌥-click, inspector in visual lens, export/present honour the lens                     | DG-37, DG-27 |
| DG-39 | 4    | More profiles from public guidelines: `aws-marketecture`, `azure-marketecture`, `gcp-marketecture`; the Qlik deck's 11 diagrams reproduced as workspace examples (fidelity check against the slides)         | DG-38        |
| DG-40 | 4    | PPTX export of the visual lens with editable shapes (`pptxgenjs`, the maintainer's qlik-slides-x pipeline as the consumer) — only if he wants slides editable rather than pictures                           | DG-38        |

Order inside wave 3: DG-36/37 can run beside particles/story; DG-38 after DG-27 and DG-31 (it shares the camera and transition machinery).

## 8. Decisions (maintainer, 2026-09-27) — see `2026-09-27-style-system-concept.md` §6 for the full table

1. **Hero:** app-level, attached to the theme (S1) — `visual.hero` in the YAML is dropped; the diagram's `visual:` layer keeps only structure (boxes, lanes, pills, hides, flow overrides).
2. **Qlik fidelity:** on-brand; DG-39 reproduces the deck's 11 diagrams side by side; opt-in optimisations (light ground, interactivity, second colour channel, numbered steps) off by default (S7).
3. **`capability` catalog field:** MCP loop, English, curated (S8).
4. **PPTX with editable shapes:** yes (S9).
5. **Vendor sources:** public material only; approximate profiles ship with the fidelity badge (S6).
