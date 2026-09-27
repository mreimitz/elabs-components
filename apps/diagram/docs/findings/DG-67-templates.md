# DG-67: Wedge templates findings

Written on 2026-09-27 on `diagram/dg-67-templates`, which branches from `diagram/atlas-integrate`
at `282f6f60`. This item is content only: three YAML files in dialect v1. No app code changed.

## What was written

- `workspace/components/qlik-cloud-tenant.yaml` is the reusable tenant. It holds five nodes:
  `qtdi` (Qlik Talend Data Integration), `qca` (Qlik Cloud Analytics), `answers`, `automate`
  and `catalog`. The `component:` block records two extension points, `sources` on the left and
  `consumers` on the right.
- `workspace/templates/qlik-cloud-customer-landscape.yaml` is template 1. It has the customer
  estate, the Direct Access gateway in the Azure VNet, the tenant as `use:` (id `tenant`),
  Snowflake, the consumers, a 4-step story and a hand-tuned `visual:` block.
- `workspace/templates/qlik-talend-cloud-pipeline.yaml` is template 2. It has Qlik Open
  Lakehouse on AWS as the technical lens (deck slide 9), Qlik Replicate as the capture, the
  Qlik Talend Cloud tenant as the control plane, a 6-step story and a `visual:` block with
  the lanes and boxes of deck slide 4.

The ids the demo script needs are in template 1: `tenant`, `tenant.qtdi` and `erp`. The flow
`erp -> tenant.qtdi` is left out, because step 7 of the script adds it.

Every node has a one-sentence `description`. A `use:` node is the exception: its text comes
from the component (see grammar question 10). `docs` links are set only where the URL is the
product's own documentation landing page.

## Checks

A scratch checker (kept outside the repo) parses each file with the app's `yaml`
(`parseDocument`). It then checks ids, flow endpoints (dotted ids resolved against the
component file), story targets, callouts, every `visual:` reference and every icon. The icons
are checked against `public/icons/index.json` plus the `lucide/*` keys of
`src/icons/lucide-map.ts`. Its output:

```text
workspace/components/qlik-cloud-tenant.yaml
  ok   parse: 0 errors, 0 warnings
  ok   ids: 5 unique (0 zones, 5 nodes)
  ok   icons: 6 references, 5 distinct, all checked against index.json + lucide map
  ok   component: extension points sources(left), consumers(right)
  ok   flows: 2, endpoints resolved (0 with dotted ids into a component)
  => no problems

workspace/templates/qlik-cloud-customer-landscape.yaml
  ok   parse: 0 errors, 0 warnings
  ok   ids: 17 unique (6 zones, 11 nodes)
  ok   use: tenant -> components/qlik-cloud-tenant (resolves)
  ok   icons: 10 references, 9 distinct, all checked against index.json + lucide map
  ok   flows: 10, endpoints resolved (7 with dotted ids into a component)
  ok   story: 4 steps, 8 targets, all resolve
  ok   visual: 4 lanes, 6 boxes, 1 flow overrides, controlPlane [tenant], hide [idp]; all references resolve
  ok   visual: technical nodes in no box and not hidden: none
  => no problems

workspace/templates/qlik-talend-cloud-pipeline.yaml
  ok   parse: 0 errors, 0 warnings
  ok   ids: 28 unique (8 zones, 20 nodes)
  ok   icons: 21 references, 17 distinct, all checked against index.json + lucide map
  ok   flows: 13, endpoints resolved (0 with dotted ids into a component)
  ok   story: 6 steps, 14 targets, all resolve
  ok   visual: 4 lanes, 8 boxes, 3 flow overrides, controlPlane [pipelines, dpm], hide []; all references resolve
  ok   visual: technical nodes in no box and not hidden: none
  => no problems

0 problem(s) in 3 files
```

To show the checker is not blind, it was also run on a broken copy with seven planted faults:
an unknown icon, a dotted id that does not exist, a story target written differently from its
flow, a node in two boxes, a duplicate id, a lane `of` that names a node, and an unknown pill.
It reported all seven.

Prettier, `pnpm exec prettier --check apps/diagram/workspace`:

```text
Checking formatting...
All matched files use Prettier code style!
```

## What the current v0 check reports

The app's own check (`checkArchYaml` with the app's icon set) was run through Vite's module
runner. Each file was checked twice: as written, and with the version line set to `"0"` to see
what v0 says about the rest.

| File       | As written                            | With `diagram: "0"`                                                           |
| ---------- | ------------------------------------- | ----------------------------------------------------------------------------- |
| component  | `unsupported-version` (error), no AST | `unknown-prop` ×2 (warning)                                                   |
| template 1 | `unsupported-version` (error), no AST | `bad-flow` ×7 (error), `unknown-prop` ×8 (warning), `zone-endpoint` ×1 (info) |
| template 2 | `unsupported-version` (error), no AST | `unknown-prop` ×10 (warning), `zone-endpoint` ×5 (info)                       |

What the codes mean here:

- `unsupported-version`: v0 reads dialect `"0"` only and stops. This is expected.
- `bad-flow` ×7: the seven flows with a dotted id such as `tenant.qtdi`. v0 ids cannot contain
  a dot. DG-26 makes them valid through a `use:` node.
- `unknown-prop`: the v1 keys `component`, `docs`, `use`, `expand`, `story` and `visual`.
  `description` passes, because v0 already has it.
- `zone-endpoint`: flows that start or end at a zone. This is information only, and it is
  intended.

One v0 warning was fixed on the way: the pipeline's "SaaS applications" node was
`type: external` inside a zone (`external-in-zone`). It is now a plain service, with a comment.

## Icon substitutions

The icon index was not changed. Each substitution has a YAML comment with the intended icon.

| File       | Node         | Intended icon                                          | Used                                                    |
| ---------- | ------------ | ------------------------------------------------------ | ------------------------------------------------------- |
| component  | `catalog`    | a Qlik catalog icon (none)                             | `lucide/layers`                                         |
| template 1 | `sharepoint` | `microsoft/sharepoint` (none)                          | `lucide/file`                                           |
| template 1 | `erp`        | PostgreSQL, in the swap comment only (no generic icon) | `azure/database-postgresql-server` or `lucide/database` |
| template 2 | `replicate`  | a Qlik Replicate icon (none)                           | `qlik/qlik`                                             |
| template 2 | `kafka`      | an Apache Kafka icon (none)                            | `lucide/activity`                                       |

For Kafka, `aws/managed-streaming-for-apache-kafka` exists, but it stands for Amazon MSK, so a
generic glyph was used. Entra ID uses `azure/active-directory`, the service's former name.

## Grammar questions

Each question names the reading this item chose. The item for the grammar is in brackets.

1. **`controlPlane` and a `vendor-cloud` lane** (DG-36). The concept example lists technical
   ids in `controlPlane` and has no vendor-cloud lane. DG-36 lists `vendor-cloud` as a lane
   role, and the item names QLIK CLOUD as a lane. Chosen: both. A `vendor-cloud` lane holds the
   control-plane boxes, and `controlPlane` lists the same technical ids. The concept example
   also puts `qlik-cloud` both in `controlPlane` and in a box of the targets lane.
2. **A `use:` node as a box member** (DG-36). Template 1's `analytics` box has the member
   `tenant`. Flows to `tenant.qca` or `tenant.answers` must then aggregate onto that box.
3. **Story targets for flows written with `<-`** (DG-31). Chosen: write the target exactly as
   the flow is written, for example `"tenant.qca <- users"`. The engine could also accept the
   reading direction, `users -> tenant.qca`.
4. **Flows that start at a zone, in the visual lens** (DG-36). `onprem -> gateway` starts at a
   zone whose nodes sit in two boxes. Chosen: an explicit line in `visual.flows`. This reads
   `visual.flows` as able to add a line, not only to restyle a derived one.
5. **Pill case** (DG-36). The concept example writes `processes: [landing, storage]` in lower
   case; the profile vocabulary is upper case. Chosen: lower case.
6. **A hero signal on a node** (DG-36, DG-37). The deck draws Qlik software on customer
   machines in the hero green: the Data Gateway, Replicate, the Network Integration Agent and
   the Open Lakehouse Cluster. The rule `provider == hero` cannot say this, because those
   nodes sit in `azure` or `aws` zones.
7. **A box outside every lane** (DG-36). Slide 4 draws "Qlik Data Products" right of the
   targets lane. Chosen: the targets lane with `aside: true`.
8. **Box items that are not nodes** (DG-36, DG-39). Slide 4 lists items inside boxes, such as
   "Iceberg Processing", "Adaptive Optimizer" and "Zero-Copy Mirroring". They are features, not
   services. Chosen: they go in subtitles and descriptions, not in new nodes.
9. **A step that frames the whole picture** (DG-31). Chosen: the last pipeline step targets
   every top-level zone. A `targets: all` or a camera key would say this more clearly.
10. **`description` and `docs` on a `use:` node** (DG-26). The item asks for them on every
    node, but plan V2 lets an instance override only `title`, `expand` and position. Chosen:
    none on the instance; the component supplies them.
11. **"Zone `qlik` as a `use:`"** (DG-26). In plan §4.2 a `use:` is a node, and a node cannot
    carry `owner` or `provider`. Chosen: the zone `qlik` (owner saas, provider qlik) holds the
    node `tenant`, which is the `use:`.
12. **Extension points and dotted flows** (DG-26, R2). The points are recorded as in the
    platform concept §3.3, with no `protection` key. There is no syntax yet to attach a flow at
    an extension point, so the templates draw flows straight to inner ids such as
    `tenant.qtdi`. Under `locked` protection those flows would be rejected.
13. **The diagram's `theme:` key** (DG-26, DG-37). Kept as `theme: qlik`, because v1 is a
    superset of v0. The style concept (S1) ties the hero to the app theme. It is open whether
    the file's `theme:` still chooses the hero.
14. **The schema modeline** (DG-26). The files point at `schema/arch-diagram.v1.schema.json`,
    which does not exist until DG-26 creates it. Editors show a missing-schema notice until then.
15. **Visual ids and technical ids** (DG-36). Chosen: lane and box ids never repeat a technical
    id, and the checker enforces this. Then `visual.flows` endpoints are never ambiguous.

## Deferred

- **Registration for "New from template".** The templates are not added to
  `src/examples/index.ts`. The v0 compiler cannot compile a v1 file: it stops at
  `unsupported-version` with no AST. "New from template" belongs to DG-23, and compiling v1
  belongs to DG-26.
- **Visual fidelity against the deck.** This item matches slide 4's structure only: lanes,
  boxes, pills and the ELT badge. The side-by-side check is DG-39's job.
- **The item's acceptance** ("validate with zero errors, render in the technical lens",
  browser screenshots) needs DG-26 first. Nothing was rendered.
- **Docs links were not opened.** A link check was not allowed in this session, so each URL
  was chosen from knowledge only. Each one is a product's documentation landing page.
- **Until DG-26 lands, the app cannot open these files.** The workspace tree lists every
  `.yaml` file, so the new `templates/` folder and the component appear there. Opening one
  gives the `unsupported-version` error. This follows from the code; it was not tried in the
  browser.

## For the maintainer

- **Postgres or SQL Server.** Demo script step 6 renames a node called "Postgres". The item
  says SQL Server, and the template follows the item. Either the script says "SQL Server", or
  the node becomes PostgreSQL (the icon swap is in a comment).
- **Two SAP nodes after step 6.** Step 6 renames `erp` to "Contoso ERP (SAP)" with the
  `sap/s4hana` icon. Template 1 already has an SAP S/4HANA node, so the canvas then shows two.
- **Direct Access or Data Movement.** The item names the Direct Access gateway. The DG-13
  review found that Direct Access serves analytics connections, and the Data Movement gateway
  serves Talend change capture. Yet the gateway box carries the REPLICATION pill, and demo
  step 7 adds a CDC flow to Talend. One of the two probably needs to change.
- **SharePoint route.** Does on-premises SharePoint reach Qlik Answers through the gateway, or
  is it SharePoint Online reached directly? The template draws the flow with no route.
- **Replicate and the gateway.** Template 2 draws Replicate landing data straight in S3, in
  the place slide 4 gives the Data Movement Gateway (as slide 12 does). There is no separate
  gateway node. Should both appear?
- **The LANDING pill.** Slide 9 puts it on the gateway; slide 12 and the item put it on object
  storage. The template follows the item.
- **Replication Targets.** Slide 4 has a "Replication Targets" box. The item does not, so it is
  not drawn.
- **The warehouse box title.** Slide 4 says "DWH Targets"; the item and slide 9 say "DWH
  Platform". The template uses "DWH Platform".
- **The ELT badge.** It sits on the line from object storage into the warehouse platform,
  where the deck draws it. In the technical lens, the transform is a control flow from the
  tenant.
