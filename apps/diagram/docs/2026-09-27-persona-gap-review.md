# Atlas through the eyes of its users — gap review

Date: 2026-09-27 · Method: walk five people through a real week with the product as currently planned (v1 done, Atlas v2 plan, visual-lens + style-system concepts, DG-20…42) and write down where they get stuck · Status: findings + candidate items, for the maintainer's call

## 1. The people

| Persona                                                           | What they do with diagrams                                                                                                                                                                                                                                       | What they are not                                                    | Their success moment                                                                                               |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Microsoft presales** (technical specialist, Data & AI)          | Draws a customer's _current_ and _target_ state in the week between discovery and proposal; compares Fabric vs Databricks options; answers security/network questions from the customer's architects; hands pictures to the account team and into a proposal doc | Not the diagram owner for long; moves to the next deal               | The customer's architect says "yes, that is our landscape" and the CIO understands the target picture in one slide |
| **ClickHouse sales** (AE, commercially strong, technically light) | Needs a "before ClickHouse / after ClickHouse" picture for a first call, in the customer's cloud, in 20 minutes, without writing YAML; presents from a laptop or an iPad in a meeting room                                                                       | Not going to run Claude Code, not going to learn a dialect           | Picture on screen before the coffee is cold; customer asks "can you send me that?"                                 |
| **Qlik product manager** (owns the marketecture master deck)      | Keeps 11+ diagrams on-brand and in sync across generic/AWS/GCP variants; approves what the field may use; renames products; ships assets to web, docs and decks; fields requests for "one more variant"                                                          | Not a designer, not an engineer                                      | A field request for "the GCP one with Replicate" takes minutes and cannot go off-brand                             |
| **Customer architect / SI partner**                               | Gets the picture from the vendor, needs it in _their_ landscape (their names, their zones, their IaC), reviews it with colleagues, keeps it as documentation                                                                                                     | Not on the vendor's machine; may be offline in a data-centre meeting | The diagram becomes theirs and stays correct as the project moves                                                  |
| **Presales manager / enablement**                                 | Wants the team to reuse approved components and stories, see what is being used, and onboard new hires with the "story" of each product                                                                                                                          | —                                                                    | New SE presents the standard story on day three                                                                    |

## 2. Where they get stuck — the gaps, ranked

Ranked by how many personas hit them and how hard.

### G1 · Nothing leaves the laptop (all five) — **highest**

Atlas runs on `localhost`. Sharing today = a URL hash (works only on the author's machine), PNG/SVG, and (planned) PPTX. The Microsoft presales cannot send the account team the _interactive_ story; the ClickHouse AE cannot "send you that"; the customer architect cannot open it; the PM cannot publish to the web team.
**Missing:** **Publish as a self-contained interactive HTML file** (one file: canvas, both lenses, story, particles, catalog descriptions, icons inlined; read-only; opens from disk, mail or SharePoint; embeddable `<iframe>`), plus **Publish a folder as a static site** (a customer portal: index, thumbnails, the interactive diagrams). This is the single feature that turns Atlas from a tool into a deliverable. The library angle is good too: the viewer is a subset of the app built from the same components.

### G2 · As-is / to-be, options, and what changed (Microsoft presales, ClickHouse sales, customer architect)

Every sales conversation is a _delta_: current state → proposed state, option A vs option B. We have `phase: now|next|later` (a slider) and `status: planned` (ghosting), which covers a roadmap but not a **comparison**.
**Missing:** (a) **Variants** — one diagram with named variants (`variants: { fabric: …, databricks: … }` overriding nodes/flows) shown as tabs or a toggle, with the same layout so the eye compares; (b) **Diff view** — two diagrams or two versions of one diagram rendered as one picture with added/removed/changed marked (green/red/amber + glyphs), and a written change list; (c) the story engine gets a `compare` step type that animates from one variant to the other (reusing the lens-transition tween).

### G3 · A no-code way in (ClickHouse sales, presales manager)

The plan assumes YAML + IntelliSense or an LLM session. An AE has neither.
**Missing:** (a) **Parameterised templates/components** — a component declares `params` (`cloud: aws|azure|gcp`, `region`, `sources[]`, `consumers[]`) and a template becomes a **guided builder**: three screens of choices → a diagram, editable afterwards in the inspector, never touching YAML; (b) **"Describe it" for non-developers** — the MCP server is right for engineers, but an AE needs a text box in the app. Decision V14 keeps the app model-free; the honest bridge is a **Claude Desktop recipe** (one-click config + a prompt that starts "make me the ClickHouse before/after for…") shipped in Home's "Connect an LLM"; (c) the **catalog panel drag-drop and ⌘K** (DG-29) are already the no-code editing path — they need to be the _default_ edit surface for this persona, with the YAML editor collapsed.

### G4 · Customer-ready framing (Microsoft presales, ClickHouse sales, PM)

A picture in a deal carries the customer's name and logo, a confidentiality line, a version/date, sometimes a "DRAFT" watermark; on the web it needs an exact pixel size.
**Missing:** **Slide frame + document metadata**: `meta: { customer, logo, confidentiality, version, owner, date, status }` rendered by the title block/footer per profile; **customer logo upload** into the workspace (a `logos/` folder, used by `ServiceLogo`); **export presets** (slide 16:9 @2×, web hero 1600×900, A4 print, transparent) with file naming conventions; **draft/approved watermark** from status.

### G5 · Overlays — the questions architects actually ask (Microsoft presales, customer architect)

"Where is data encrypted? Which flows cross the internet? Where does PII sit? What's in EU?" Today `secure`, `kind: network`, badges and zones carry that data, but it competes with everything else in one picture.
**Missing:** **Layers** you toggle in view mode — Security (encryption, auth, trust boundaries lit; the rest dimmed), Network (egress, private links, ports), Data (classification tags `pii`, `phi`, residency by region), Ownership (customer/SaaS/partner), Cost (optional `cost` annotations). Each layer = a filter + emphasis rule + its own legend; a story step can activate a layer. Small dialect addition: `tags:` on nodes/flows, `classification:`, `residency:`.

### G6 · Governance for the owner (Qlik PM, presales manager)

The PM's deck says "DO NOT MODIFY … ask the PMM". Atlas has Git and a linter, no workflow.
**Missing:** `status: draft | review | approved | deprecated` + `owner` on diagrams and components; **locked** components (read-only reference with a "request change" that opens a note); a **brand-compliance report** across the workspace (profile-linter violations, unapproved components in use, stale references, diagrams overriding the default style); a **rename refactoring** across the workspace when a product changes name (catalog alias + "used in"); a **changelog per diagram** from Git with a human summary line.

### G7 · Review and comments (all)

Feedback today happens in Slack over a PNG. Note nodes are content, not review.
**Missing:** a **comments layer** — pins on nodes/zones/flows, threads, resolve; stored beside the diagram (`<name>.comments.yaml`) so Git carries them; visible in the published HTML (read-only) so a customer architect can point at things; export a comment list.

### G8 · Bring what exists (customer architect, Microsoft presales)

Nobody starts from nothing: there is a draw.io, a Visio, a Mermaid block, a screenshot of the old picture, a Terraform repo.
**Missing:** **Import**: draw.io XML (`mxGraph` — nodes/edges/containers map well), Mermaid `architecture-beta`/flowchart, D2; **from image** via an LLM session (the MCP `author-diagram` prompt accepts an image — Claude reads it) documented as a recipe; later **from cloud/IaC** (Terraform state, AWS/Azure resource lists) — this is Cloudcraft/Hava territory and a strong differentiator for the customer-architect persona, but it needs credentials handling that the app avoids; it belongs to the MCP session side.

### G9 · Presenting in the room (ClickHouse sales, Microsoft presales)

View mode exists; present mode with speaker notes is planned. In the room the AE has an iPad, a projector, no network, and a customer who wants to "see that part".
**Missing:** **touch and tablet** (pinch/zoom, tap to reveal details, story swipe); **offline** (already local — the published HTML makes it truly portable); a **spotlight/laser** (hold a key to dim everything but the pointer's neighbourhood); **phone as remote** for the story (QR → a controller page over the local network — optional); **hide sensitive** (a "customer safe" toggle that hides notes/metrics marked internal).

### G10 · Words, not only pictures (Microsoft presales, customer architect, PM)

Proposals and RFP answers need the architecture _described_. The diagram already knows every node, flow, owner and description.
**Missing:** **Architecture narrative export** — Markdown/DOCX: sections per zone, tables of components (name, description, owner, docs link), flows (from, to, protocol, schedule), security summary, generated from the model; the story's narration becomes the walkthrough section. Also an **"explain this diagram" prompt** in the MCP prompt set.

### G11 · Language and reach (ClickHouse sales in DACH, PM for global assets)

UI and catalog are English; German customers get English labels on a German slide.
**Missing:** **per-diagram label translations** (`labels: { de: { erp: "SAP-System" } }` or a `lang:` switch on export), UI i18n via the library's `LocaleProvider` (already exists in `ui`), a translation prompt for the MCP session.

### G12 · Finding and reusing (presales manager, PM)

Home has folders, recents, components, health. The manager wants "what does the team use", the SE wants "the standard Qlik Cloud story".
**Missing:** **favourites/pins**, **tags on diagrams** (industry, product, use case) with tag browsing, **usage counts** (opened/presented/exported — local, honest), **"stories" as a first-class list** on Home (every diagram with a `story:` shows as a playable card), **onboarding path** ("start with these five stories").

### G13 · Smaller but sharp

- **Custom parts in-app** (a customer's internal system with its own logo) without touching YAML → the catalog page's "New part" form (DG-24 has edit, not create).
- **Search by capability** ("streaming", "CDC") across the catalog, not only by vendor/name.
- **Undo across lens switches and inspector edits** must feel like one history (DG-16 is text-based — good; make sure visual-layer edits are included).
- **Keyboard-only diagram building** for power users (add node, connect, move to zone) — the ⌘K insert covers add; connect-by-keyboard is missing.
- **Empty-state teaching**: a new workspace should open with a guided first diagram, not an empty tree.
- **Accessibility in present mode**: captions for colour meaning (already via legend), focus order for the story bar, high-contrast profile variant.

## 3. What this changes in the concept

Three principles the review adds to the plan:

1. **The deliverable is the published interactive file, not the app.** Everything the app renders must be exportable as a self-contained page (G1). This also gives the library a "viewer" surface worth harvesting.
2. **Every diagram is a conversation about change.** Variants, diff and layers (G2, G5) are first-class, not add-ons; the story engine speaks them.
3. **Two front doors.** YAML/MCP for engineers; guided builder + inspector + drag-drop for everyone else (G3). Neither is a fallback.

## 4. Candidate items (not filed yet — your call on which and when)

| ID    | Title                                                                                                                                                                                        | For | Depends on   | Size |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------------ | ---- |
| DG-43 | **Publish**: self-contained interactive HTML (viewer bundle, both lenses, story, particles, comments read-only) + folder → static site + `<iframe>` embed                                    | G1  | DG-38, DG-32 | L    |
| DG-44 | **Variants + diff**: `variants:` block with per-variant overrides and shared layout; two-diagram/two-version diff view with change list; story `compare` step                                | G2  | DG-26, DG-38 | L    |
| DG-45 | **Guided builder**: parameterised templates/components (`params`), a 3-screen wizard, inspector-first edit surface with the YAML editor collapsed; Claude Desktop recipe in "Connect an LLM" | G3  | DG-26, DG-29 | L    |
| DG-46 | **Framing + export presets**: `meta:` (customer, logo, confidentiality, version, owner, status), `logos/` folder, watermark, presets and naming                                              | G4  | DG-17, DG-21 | M    |
| DG-47 | **Layers**: security / network / data / ownership / cost overlays, `tags` / `classification` / `residency` in the dialect, per-layer legend, story steps activate layers                     | G5  | DG-26, DG-33 | M    |
| DG-48 | **Governance**: status/owner, locked components + request-change, brand-compliance report, workspace rename refactoring, per-diagram changelog                                               | G6  | DG-21, DG-37 | M    |
| DG-49 | **Comments layer**: pins, threads, resolve, `*.comments.yaml`, shown in published HTML, export list                                                                                          | G7  | DG-21, DG-43 | M    |
| DG-50 | **Import**: draw.io XML, Mermaid, D2; image → diagram recipe via MCP prompt                                                                                                                  | G8  | DG-26, DG-35 | M    |
| DG-51 | **In the room**: touch/tablet, spotlight, customer-safe toggle, optional phone remote                                                                                                        | G9  | DG-32        | M    |
| DG-52 | **Narrative export**: Markdown/DOCX architecture description from the model + story; `explain-diagram` prompt                                                                                | G10 | DG-26, DG-31 | S–M  |
| DG-53 | **Language**: per-diagram label translations, UI i18n via `LocaleProvider`, translate prompt                                                                                                 | G11 | DG-26        | M    |
| DG-54 | **Find & reuse**: favourites, tags, stories list on Home, usage counts, onboarding path                                                                                                      | G12 | DG-23        | S–M  |
| DG-55 | **Sharp small things**: new part in-app, capability search, keyboard connect, first-run guided diagram, high-contrast variant                                                                | G13 | DG-24, DG-29 | S    |

Suggested order if all are wanted: DG-43 first (it changes what "done" means for everything after), then DG-44/45 (the two front doors and the delta story), then DG-46/47, the rest by demand.

## 5. Status (2026-09-27)

G1, G6 and G7 are absorbed by the platform track (`2026-09-27-platform-and-security-concept.md`, DG-56…58); the remaining candidates (DG-44…55) stay unfiled until the maintainer picks them.

## 5a. Questions this raises for you

1. Is **publishing a self-contained interactive HTML** the deliverable you want (it likely is — it is how the customer sees the story), and should a hosted read-only viewer (a static site per folder) come with it?
2. **Variants vs separate diagrams**: keep as-is/to-be as one file with variants (shared layout, diffable) or as two files linked (`compareWith:`)? I lean to variants in one file, with diff available across files too.
3. **Guided builder scope**: parameterised _templates_ only (a few curated flows: "lakehouse on {cloud}", "Qlik Cloud + gateway", "before/after ClickHouse") or generic parameters on any component?
4. **Comments**: file-based beside the diagram (Git-visible, works offline) is what fits the workspace model — agree?
5. Which personas matter most for the next wave: presales (G1, G2, G4, G5) or the PM/owner (G6, G7, G12)?
