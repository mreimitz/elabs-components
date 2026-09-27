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

To be completed after the change (handoff).

## Library gaps met so far

- **`Badge` has no `size` prop** (`packages/ui/src/components/badge/badge.tsx`, `badgeVariants`
  has only `variant`). The item's `Badge size="sm" variant="outline"` for the card badge row
  falls back to `variant="outline"` with tighter padding. Proposed: `size: "sm" | "md"`.
- **Motion tokens differ from the brief.** Tokens ship `--duration-fast` 160 ms,
  `--duration-base` 260 ms, `--duration-slower` 600 ms and `--ease-standard`
  `cubic-bezier(0.2, 0, 0, 1)`; `src/motion.ts` reads those, not the brief's 150 / 250 /
  `cubic-bezier(.2,.8,.2,1)`. `useReducedMotion` ignores `data-motion-pref` (H-51), so
  `motion.ts` reads the attribute itself.
