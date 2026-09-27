# The Atlas style system — defining the technical and the visual style globally

Date: 2026-09-27 · Status: concept for the maintainer · Builds on `2026-09-27-visual-lens-concept.md` (the two lenses) · Research: §1 (vendor conventions, verified vs not)

## 0. The principle in one line

**Structure travels with the diagram; style comes from the context.** What a diagram _is_ (zones, nodes, flows, and the visual layer that groups them into marketing boxes) lives in the diagram's YAML and in the components it uses. How it _looks_ — in either lens — is a **style profile** resolved from a cascade: app defaults → workspace → folder → diagram. Change the workspace's visual profile from `qlik-marketecture` to `aws-solution` and every diagram in it re-renders in AWS's language without touching a file.

## 1. What the vendors actually publish (research, 2026-09-27)

| Vendor                                          | Ground                | Ownership signal                                             | Containers / zones                                                                                                                                               | Stage labels                                       | Connectors                                          | Codified?                                                                                                         |
| ----------------------------------------------- | --------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Qlik** (the deck)                             | dark navy             | green = Qlik-managed, blue = other                           | navy panels, 4 px role accent, uppercase grey label                                                                                                              | aqua pills (fixed vocabulary)                      | solid data / dashed control, ELT badge, elbows      | **yes — 8 written rules** (the deck)                                                                              |
| **AWS**                                         | white                 | service category colour on the icon tile                     | nested: Cloud `#232F3E` solid · Region `#00A4A6` dashed · AZ dashed · VPC `#8C4FFF` · public subnet `#7AA116` · private `#147EBA`; corner badge + top-left label | none; **numbered step circles**                    | solid directional arrows                            | **yes** for containers + category colours (via awslabs repo + draw.io mirror); typography Amazon Ember unverified |
| **Azure**                                       | white                 | per-service icon tile                                        | "boundary indicators" required, colours **not published**                                                                                                        | none                                               | directional only, no double heads; legend if dashed | process rules yes (Well-Architected); colours **no**                                                              |
| **Google Cloud**                                | white                 | 4-colour core icons vs 2-colour category icons (2025 system) | loose "Project"/"VPC" rectangles, colours **unverified**                                                                                                         | none                                               | plain solid arrows (observed)                       | icons yes; grouping/connectors **no**                                                                             |
| **SAP BTP**                                     | light (Fiori Horizon) | grey-circle icon = SAP service; neutral generic set = other  | governed by `SAP/btp-solution-diagrams` (open source, versioned, editable templates)                                                                             | —                                                  | governed by the repo                                | **yes — the most formal of all**                                                                                  |
| **Salesforce**                                  | light                 | typed shapes (system, integration, user, data)               | "kit of parts" notation, logical vs component diagram types                                                                                                      | pattern-type labels                                | defined in the kit                                  | yes (notation, not marketing look)                                                                                |
| **Databricks / Fabric**                         | light                 | —                                                            | pipeline stage blocks + a governance plane (Unity Catalog / OneLake) spanning                                                                                    | **Bronze / Silver / Gold** (literal metal colours) | —                                                   | pattern yes, colours unverified                                                                                   |
| Snowflake, ClickHouse, Confluent, dbt, Fivetran | light                 | logo presence                                                | layer bands (Snowflake), producers-left/consumers-right (Confluent)                                                                                              | sources→staging→marts (dbt naming)                 | —                                                   | **no public guideline**; brand hexes disagree across sources                                                      |

**Invariants across every vendor that has a contract:** lanes/zones with a role · named capability boxes rather than node graphs · an ownership signal (colour, icon set or badge) · primary vs secondary flows · reading direction left→right with sources left, consumers right · optional stage vocabulary. **What varies is tokens and anatomy only** — ground, panel colour, box anatomy, label case, how ownership is signalled, whether steps are numbered. That is exactly the split the profile schema below makes: an invariant model, a token file per style.

Confidence: Qlik (primary, the deck) and AWS (triangulated) are solid; SAP's repo is the one to mine next; Azure/GCP need their published reference diagrams inspected visually; the smaller vendors need a look at their actual PNGs before any profile claims fidelity. Every profile carries `fidelity: verified | approximate | unverified` and the Styles page shows it.

## 2. The model: lenses × profiles × cascade

```
lens      technical | visual                       what the diagram is shown as (grain + grouping)
profile   a style contract for ONE lens            tokens + rules; a YAML file; vendor or neutral
cascade   theme → workspace → folder → diagram     where the profile for each lens is chosen (the theme supplies the defaults)
hero      the vendor whose story it is             comes from the APP THEME (S1); drives "ours vs theirs" in both lenses
```

A diagram therefore always has **two active profiles**, one per lens, plus a hero. The lens switch (DG-38) flips between them; the profiles decide the look.

### 2.1 The cascade

| Level     | File                                   | Sets                                                                                             | Typical use                                                             |
| --------- | -------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Theme     | `apps/diagram/themes/<slug>/atlas.ts`  | **hero** (not overridable) + the default technical and visual profile for that family            | Qlik theme → hero qlik, `atlas-clean`, `qlik-marketecture`              |
| App       | built-in `profiles/*.yaml` (read-only) | the shipped profiles and the fallback defaults (`atlas-clean`, `atlas-visual`)                   | nothing to do                                                           |
| Workspace | `workspace/atlas.config.yaml`          | `styles.technical`, `styles.visual`, `hero`, `lensOnOpen`, `pillVocabulary`, `export.background` | "In this workspace everything is Qlik-hero, visual = qlik-marketecture" |
| Folder    | `<folder>/.atlas.yaml`                 | any subset of the same keys (never `hero`)                                                       | `customers/contoso-azure/` → `technical: azure-reference`               |
| Diagram   | `style:` block in the YAML             | any subset; plus `visual.profile` legacy alias                                                   | one deck slide that must be AWS-styled                                  |
| Component | —                                      | **never** (a component carries structure and its visual layer, not a style)                      | so a Qlik tenant component looks right in any customer's style          |

Resolution is nearest-wins per key (like `.editorconfig`); the inspector shows the effective value and where it came from ("visual: qlik-marketecture · from workspace"). A folder or diagram may also say `styles.visual: inherit` explicitly.

```yaml
# workspace/atlas.config.yaml
styles:
  technical: inherit # inherit = the theme's default; or aws-reference | azure-reference | gcp-reference | sap-btp
  visual: inherit # or qlik-marketecture | aws-solution | azure-solution | gcp-solution | sap-btp-solution | atlas-visual
lensOnOpen: visual # what a diagram opens in; the switch is always one key away
pillVocabulary: [LANDING, STORAGE, MIRROR, TRANSFORM, ELT, REPLICATION, QUALITY] # workspace-wide, profiles may extend
export: { background: profile } # profile | transparent | theme
```

### 2.2 Profile anatomy (one schema, both lenses)

A profile is data: tokens, mappings and rules. The renderer for each lens reads only its profile; vendor knowledge never enters code.

```yaml
# workspace/styles/qlik-marketecture.yaml   (built-in copy, editable)
profile: qlik-marketecture
lens: visual
extends: atlas-visual # only overrides below
vendor: qlik
version: 2026-07
source: "Qlik Talend Data Integration — Architecture Diagrams style guide, July 2026 (internal deck)"
fidelity: verified # verified | approximate | unverified — shown in the UI

ground: { fill: "#0E2340", followTheme: false } # Qlik decks are dark; atlas-* profiles set followTheme: true
typography: { family: Inter, emphasis: weight, text: "#FFFFFF", muted: "#A9B3B6" }

roles: # semantic → colour; every renderer paints by ROLE, never by node
  hero: { fill: "#009845", text: "#FFFFFF" } # the hero vendor's managed things
  other: { fill: "#1E4E78", text: "#FFFFFF" } # everything else
  generic: { fill: "#1E4E78", text: "#FFFFFF" } # generic capability items (icons mono)
  sub: { stroke: "#FFFFFF", fill: none } # nested sub-boxes
  zone: { fill: "#142D4A", label: "#A9B3B6" }

zones:
  panel: { radius: 6, accentHeight: 4, label: { case: upper, tracking: 2, position: top-center } }
  accents:
    {
      vendor-cloud: "#009845",
      sources: "#A9B3B6",
      customer-managed: "#93579C",
      customer-vpc: "#10CFC9",
      targets: "#10CFC9",
    }
  labels: { customer-vpc: "CUSTOMER VPC - {cloud}" } # templates per role

boxes:
  anatomy: capability-list # capability-list | icon-tile | typed-shape (Salesforce) | product-card (GCP)
  title: { weight: 700, align: center }
  items: { icon: mono, bullet: ring }
  heroLogo: { placement: top-left, variant: white-on-green }

pills:
  enabled: true
  style: { fill: "#10CFC9", text: "#FFFFFF", size: 7, case: upper, radius: full }
  placement: { corner: top-right, overlap: true, stack: true }
  vocabulary: [LANDING, STORAGE, MIRROR, TRANSFORM, ELT, REPLICATION, QUALITY]
  fromTags: { object-storage: STORAGE, etl: TRANSFORM, cdc: REPLICATION } # catalog tag → pill (derivation)

flows:
  data: { stroke: "#FFFFFF", width: 1, dash: none, marker: arrow }
  control: { stroke: "#FFFFFF", width: 1, dash: "6 5", marker: arrow }
  access: { as: control }
  network: { as: control }
  badges: { elt: { fill: "#009845", text: "ELT" } }
  routing: orthogonal
  arrowheads: target-only # target-only | both-when-bidirectional | none
  steps: none # none | circles (AWS) | inline

icons: { generic: mono-white, named: brand-logo, mixRule: never-same-purpose }

layout:
  direction: LR
  controlPlane: top
  lanes: [sources, customer-managed, customer-vpc, targets]
  grid: 8
  variantsKeepPositions: true # rule 7 of the deck

forbid: [per-node-colour, accent-as-fill, diagonal-edges, coloured-arrows, new-pill-labels]
```

```yaml
# workspace/styles/aws-solution.yaml (sketch — verified container/category hexes, anatomy from observed AWS solution diagrams)
profile: aws-solution
lens: visual
extends: atlas-visual
vendor: aws
fidelity: approximate
ground: { fill: "#FFFFFF" }
typography: { family: "Amazon Ember, Inter", text: "#16191F" }
roles:
  {
    hero: { fill: "#232F3E", text: "#FFFFFF" },
    other: { fill: "#F2F3F3", text: "#16191F" },
    zone: { fill: none, label: "#232F3E" },
  }
zones:
  panel:
    {
      radius: 0,
      border: { width: 1 },
      label: { case: title, position: top-left, cornerIcon: true },
    }
  accents:
    {
      vendor-cloud: "#232F3E",
      region: "#00A4A6",
      customer-vpc: "#8C4FFF",
      public-subnet: "#7AA116",
      private-subnet: "#147EBA",
    }
  borders: { region: dashed, availability-zone: dashed, default: solid }
boxes:
  {
    anatomy: icon-tile,
    tile:
      {
        size: 48,
        byCategory:
          {
            compute: "#ED7100",
            storage: "#7AA116",
            database: "#C925D1",
            analytics: "#8C4FFF",
            security: "#DD344C",
            integration: "#E7157B",
            ai: "#01A88D",
          },
      },
    label: below,
  }
pills: { enabled: false }
flows:
  {
    data: { stroke: "#232F3E", dash: none },
    control: { dash: "4 4" },
    steps: circles,
    arrowheads: target-only,
  }
layout: { direction: LR, controlPlane: none, lanes: [sources, customer-vpc, targets] }
```

A **technical-lens** profile uses the same schema with `lens: technical`; `atlas-clean` maps to the tokens DG-20 sets (theme-following ground, owner border styles, tone rungs), while `aws-reference` gives the technical lens AWS's official nested-container colours and dashes — useful when a customer lives in AWS docs all day.

### 2.3 What is invariant (code) and what is a profile (data)

| Concern                                   | Code (renderer, one per lens)                                                                   | Profile (data)                                  |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| grouping into boxes, lanes, control plane | derivation rules + `visual:` layer                                                              | lane order, which roles exist, label templates  |
| "ours vs theirs"                          | `provider == hero` → role `hero`                                                                | the colours of `hero`, `other`, `generic`       |
| box anatomy                               | four anatomies implemented once (`capability-list`, `icon-tile`, `typed-shape`, `product-card`) | which one, sizes, label placement               |
| pills / stage labels                      | placement engine                                                                                | on/off, style, vocabulary, tag mapping          |
| flows                                     | kinds, routing engine, badge/step renderers                                                     | strokes, dashes, markers, badge look, numbering |
| icons                                     | mono vs brand rendering (`ServiceLogo` variants)                                                | which mode for generic vs named                 |
| forbids                                   | a linter that reports profile violations as diagram issues                                      | the list                                        |

## 3. How a user defines it — the UX

1. **Settings → Styles** (rail → Settings): two columns, _Technical_ and _Visual_. Each lists the available profiles as cards (name, vendor mark, fidelity badge, "built-in" or "workspace", used-by count) with the workspace default marked. Actions: **Set as workspace default**, **Duplicate** (built-in → editable copy in `workspace/styles/`), **Edit**, **Import** (a `.yaml`), **Export**.
2. **Profile editor**: a `SchemaForm` from the profile JSON Schema on the left (grouped: Ground & type · Roles · Zones · Boxes · Pills · Flows · Icons · Layout · Forbids), a **live preview** on the right — one fixed sample diagram (the lakehouse) rendered in that lens with the profile, updating on every field; a "Compare with…" toggle to see two profiles side by side; colour fields accept hex (this is the one place raw colours are legitimate, as with `ServiceLogo`). Save writes the YAML through the workspace service; the editor also offers "Open YAML" for hand edits.
3. **Folder settings**: right-click a folder → _Styles for this folder_ → same two pickers + hero; writes `.atlas.yaml`.
4. **Per diagram**: the inspector's _Diagram_ section shows lens-on-open, hero, technical profile, visual profile, each with the inherited value greyed and a "from workspace/folder" hint; overriding writes `style:` into the YAML.
5. **Top bar**: the lens switch (`Technical | Visual`) sits beside a **profile chip** showing the active profile; clicking the chip lists the profiles for that lens for a quick swap ("show this in AWS style") — a _view-only_ swap by default, with "Apply to diagram / folder / workspace" as explicit actions so a demo never silently rewrites files.
6. **Home health tile**: profiles with `fidelity: unverified` in use; diagrams overriding the workspace default.
7. **MCP**: `style.list`, `style.get`, `style.set { scope: workspace|folder|diagram, lens, profile }`, `style.validate <yaml>` — so a Claude session can say "switch the Contoso folder to Azure style".
8. **Language service**: completions for `style.technical/visual` and `hero` from the workspace's profiles.

## 4. Built-in profiles to ship

| Lens      | Profile                                              | Fidelity    | Source                                                                    |
| --------- | ---------------------------------------------------- | ----------- | ------------------------------------------------------------------------- |
| technical | `atlas-clean`                                        | —           | DG-20's look; follows the app theme                                       |
| technical | `aws-reference`                                      | verified    | container + category hexes (awslabs repo, draw.io mirror)                 |
| technical | `azure-reference`                                    | approximate | Well-Architected rules; colours from published reference diagrams         |
| technical | `gcp-reference`                                      | approximate | 2025 icon system; grouping from reference diagrams                        |
| technical | `sap-btp`                                            | verified    | `SAP/btp-solution-diagrams` (to be mined)                                 |
| visual    | `atlas-visual`                                       | —           | our neutral marketecture (editorial, light, follows theme)                |
| visual    | `qlik-marketecture`                                  | verified    | the deck (8 rules)                                                        |
| visual    | `aws-solution`                                       | approximate | observed AWS solution overviews + verified colours                        |
| visual    | `azure-solution`, `gcp-solution`, `sap-btp-solution` | approximate | as above                                                                  |
| visual    | `databricks-medallion`                               | approximate | Bronze/Silver/Gold stage vocabulary as a _pill set_ usable in any profile |

Vendor hexes that disagree across sources stay out until checked against the brand portal; the profile says so.

## 5. Where it lands in the roadmap

- **DG-37 becomes "Style system + first profiles"**: profile schema + loader + cascade resolution (`workspace/atlas.config.yaml`, `.atlas.yaml`, `style:`), `atlas-clean` re-expressed as a technical profile, `atlas-visual` + `qlik-marketecture` visual profiles, the four box anatomies, the profile linter.
- **DG-38** (lens switch) adds the profile chip and view-only swap.
- **New DG-41 — Styles page + profile editor** (wave 3, after DG-37): the Settings UI in §3, folder settings, inspector section, MCP `style.*`, language-service completions.
- **New DG-42 — Theme bindings + new families**: `atlas.ts` per family (S1), AWS/Azure/GCP theme families app-side (S2), the theme menu wording, neutral-theme owner colouring (S3).
- **DG-40** (PPTX editable shapes) is confirmed (S9).
- **DG-39** fills the vendor profiles (AWS/Azure/GCP/SAP technical + visual, Databricks pill set), each with its fidelity check against real vendor diagrams; SAP first because its repo is machine-readable.
- The Atlas plan's V15 "visual bar" and DG-20 stay as they are — DG-20 _is_ `atlas-clean`.

## 6. Decisions (maintainer, 2026-09-27)

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | **The hero is app-level and attached to the theme.** Choosing the Qlik theme _is_ choosing whose story it is. A theme family binds `hero` + default profiles for both lenses (`qlik` → hero qlik · technical `atlas-clean` · visual `qlik-marketecture`). Workspace/folder/diagram may override the **profiles**, never the hero. §2.1's cascade loses the `hero` key; `atlas.config.yaml` keeps `styles.*`, `lensOnOpen`, `pillVocabulary`, `export`.         |
| S2  | **Themes on day one:** Qlik; Snowflake, ClickHouse, Salesforce (existing families, hero = the vendor, approximate visual profiles); Neutral light/dark (no hero); **AWS, Azure, GCP as new theme families** — built app-side first under `apps/diagram/themes/<slug>/` (the app already copies families; these are new ones) and promoted to the repo's `themes/` later as a normal brand-theme item, with the same fidelity review the existing families had. |
| S3  | **No hero (neutral theme):** the visual lens colours by **owner** (customer / SaaS / hosted / partner get distinct fills); nobody is "ours".                                                                                                                                                                                                                                                                                                                   |
| S4  | **Ground:** the profile decides; `atlas-*` profiles follow the theme's light/dark; vendor profiles fix their contract's ground (Qlik navy).                                                                                                                                                                                                                                                                                                                    |
| S5  | **Profile chip swap is view-only**; "Apply to diagram / folder / workspace" writes.                                                                                                                                                                                                                                                                                                                                                                            |
| S6  | **Vendor profiles ship `approximate` with the badge**, from **public material only**; promotion to `verified` after a side-by-side with real vendor diagrams. SAP's open repo is mined first.                                                                                                                                                                                                                                                                  |
| S7  | **Qlik profile: on-brand**, DG-39 reproduces the deck's 11 diagrams for a side-by-side; optimisations allowed as **opt-in toggles, off by default**: a light-ground variant, hover/step interactivity (pills and boxes as story targets, member lists on hover), a second channel for hero colour (small mark on hero boxes so green/blue survives greyscale), AWS-style numbered flow steps.                                                                  |
| S8  | **Catalog `capability` names** are filled through the MCP `fill-catalog` loop, English, curated.                                                                                                                                                                                                                                                                                                                                                               |
| S10 | **The lens switch is a smooth animated transition, never a swap** (maintainer, 2026-09-27). Choreography in §7; acceptance is measured (frame time, no layout pop), not judged.                                                                                                                                                                                                                                                                                |
| S9  | **PPTX export with editable shapes** (DG-40) is in: `pptxgenjs`, one slide per diagram or story step, shapes editable in PowerPoint; the one allowed new dependency for it.                                                                                                                                                                                                                                                                                    |

### 6.1 Theme binding — what it looks like

```ts
// apps/diagram/themes/<slug>/atlas.ts (beside the family's theme.ts)
export const qlikAtlas: AtlasThemeBinding = {
  family: "qlik",
  hero: "qlik",
  profiles: { technical: "atlas-clean", visual: "qlik-marketecture" },
};
```

The theme menu therefore reads "Qlik · hero Qlik · visual: Qlik marketecture"; switching the theme switches hero and default profiles together; the profile chip still allows a view-only swap; the inspector's Diagram section shows "hero: qlik · from theme" (read-only) and the two profiles with their source.

## 7. The lens transition (S10) — choreography

The switch is the product's signature move: the customer sees the simple picture _become_ the real one. Specification:

**Phases (technical → visual, 700 ms total, `MOTION.ease`; reverse plays the same phases backwards):**

| t (ms)  | What moves                                                                                                                                                                                                                                                                                                                                                                                   |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–120   | **Settle:** particles fade out; edge labels and node subtitles fade; the camera starts easing toward the visual lens' bounds (computed up-front from the lane layout).                                                                                                                                                                                                                       |
| 120–450 | **Gather:** each technical node translates along a straight path to its box's slot (members of one box converge, scale 1 → 0.85, opacity → 0 in the last 30 %); the box rectangle grows from the centroid of its members (scale 0.6 → 1, opacity 0 → 1); zones morph into lane panels (corner radius, fill and accent bar interpolate; header text cross-fades to the uppercase lane label). |
| 300–600 | **Wire:** technical edges retract toward their endpoints and disappear; aggregated box→box flows draw in (`stroke-dashoffset` from full length to 0), dashed ones keep their dash; badges and step circles pop in last (scale 0.8 → 1).                                                                                                                                                      |
| 500–700 | **Dress:** pills slide in from the box's top-right corner; the control-plane band's contents fade in; the title block re-flows; particles resume on the new flows.                                                                                                                                                                                                                           |

**Rules**

- One continuous camera move for the whole transition (no re-fit at the end).
- Every element that exists in both lenses keeps its identity (same DOM node / same React key) so the browser interpolates; only elements unique to one lens fade.
- Layout for the target lens is computed **before** the animation starts (ELK for technical, lane layout for visual) so nothing pops after the motion ends.
- 60 fps target at 100 technical nodes: transforms and opacity only (compositor-friendly), no layout-affecting properties mid-flight; `will-change` set for the duration, cleared after.
- Reduced motion (`data-motion-pref="reduced"` or OS): a 200 ms cross-fade with the same final layout; no movement.
- Interrupting: a second switch mid-flight reverses from the current progress (the transition is a single tween with a scrubbable `t`), so rapid toggling never jumps.
- Drill-down (DG-27), box ⌥-click and story steps that change the lens reuse the same tween, with the camera targeting the members/box.

**Acceptance (DG-38)**

- Recorded at 1440×900 on the lakehouse and the largest Qlik reproduction: no visible pop at the end; frame time ≤ 16 ms for ≥ 95 % of frames (Performance panel export attached); reversing mid-flight is continuous; reduced motion honoured.
