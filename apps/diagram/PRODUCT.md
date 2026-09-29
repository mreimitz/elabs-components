# Atlas — product plan

Working name: **Atlas** (the deployment shows the vendor's own product name; see policy N1). Status: the 20-item R1 engineering scope is delivered; [verification, recordings and remaining acceptance boundaries](docs/releases/R1-tour.md) are recorded in the R1 handoff. Owner: Manuel. Last updated: 2026-09-29.

This file is the single entry point. Concept documents in `docs/` carry the reasoning and the decision logs; roadmap items in `roadmap/` carry the work; this file carries the product: what ships when, under which policies, with which gates.

---

## 1. Vision

> A workspace of architecture diagrams, built from a catalog of primitives and reusable, protected components, written in YAML with real IntelliSense or composed by an LLM session through MCP, seen through two lenses — technical and marketecture — that morph into each other, alive with data flowing through it, walked as a story, and published as an interactive picture the customer can open.

Deployed **centrally per vendor** (Qlik, Snowflake, ClickHouse, Microsoft, …): the deployment is the vendor's story (theme = hero), users come from the vendor's identity provider, product managers own protected components, presales compose customer stories from them, customers receive published pictures.

## 2. Personas and their success moments

| Persona                                         | Success moment                                                                                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Product manager (owns a product's architecture) | A field request for "the GCP variant with Replicate" takes minutes and cannot go off-brand; changes reach every story when _they_ publish              |
| Presales / solution architect                   | The customer's architect says "yes, that is our landscape"; the CIO gets the target picture in one slide; the story is walked live and sent afterwards |
| Sales (non-technical)                           | A before/after picture in the customer's cloud before the coffee is cold, without writing YAML                                                         |
| Customer architect                              | The picture becomes theirs — their names, their zones — and stays correct                                                                              |
| Presales manager / enablement                   | New hires present the standard story on day three; the team reuses approved components                                                                 |

Full walk-through and gaps: `docs/2026-09-27-persona-gap-review.md`.

## 3. Releases (rethought 2026-09-27 — `docs/2026-09-27-success-plan.md`)

**Success, phase A = the maintainer uses Atlas for ≥ 3 real deals in 8 weeks and keeps coming back; phase B (when he decides) = three colleagues do the same via a shared Git workspace.** Cohorts are gates: the platform is built for C2 only after phase B's metric is met.

| Release                          | For                                         | Content                                                                                                                                                                           | Exit                                                                                                        |
| -------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **R0 — MVP** (done)              | maintainer                                  | DG-01…19                                                                                                                                                                          | done                                                                                                        |
| **R1 — the wedge** (8 weeks)     | C0 the maintainer; C1 later by his decision | DG-20, 21, 22, **67**, 24, 35, 25, 26, 27, 28, 23, 31, **30**, 36, 37, 38, 43 (+ **66** in phase B) — each slimmed as in the success plan §3.3; `docs/demo-script.md` is the spec | week 4: a real deal drawn in Atlas; week 8: ≥ 3 real diagrams, ≥ 3 stories sent, used in weeks 7–8 unforced |
| **R2 — platform for C2** (gated) | one PM + the SE team                        | DG-57, 56, 58, protected components, DG-61, 64, 59, 30, 32, 41, 60 — ordered by C1's pulls                                                                                        | second user via Entra composes from a locked component; protected write refused server-side                 |
| **R3 — pulled**                  | cohorts                                     | everything else stays specified and unfiled until a real user pulls it                                                                                                            | —                                                                                                           |

Working rhythm: maintainer time ≤ 2 h/week (Monday review, Friday decision); ship every fortnight to the app's `main` with a 2-minute demo and a changelog line; the demo script run in the browser each fortnight; kill criteria at week 4 and week 8.

## 4. Tracks

| Track                             | Items                                            | Concept                                                                             |
| --------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| MVP                               | DG-01…19                                         | `docs/2026-09-26-plan.md`                                                           |
| Atlas v2                          | DG-20…35                                         | `docs/2026-09-27-atlas-v2-plan.md`                                                  |
| Two lenses + style system         | DG-36…42                                         | `docs/2026-09-27-visual-lens-concept.md`, `docs/2026-09-27-style-system-concept.md` |
| Persona gaps                      | DG-43…55                                         | `docs/2026-09-27-persona-gap-review.md`                                             |
| Platform                          | DG-56…58                                         | `docs/2026-09-27-platform-and-security-concept.md`                                  |
| Product hygiene                   | DG-59…65                                         | `docs/2026-09-27-attention-points.md`                                               |
| Success plan, cohorts, onboarding | DG-66, `docs/demo-script.md`, `docs/releases/`   | `docs/2026-09-27-success-plan.md`                                                   |
| Library harvest (P4)              | repo `roadmap/` track, seeded by DG-19 and DG-63 | `docs/2026-09-27-harvest-inventory.md`                                              |

Item format, waves and protocol: `roadmap/README.md`, `roadmap/ORCHESTRATOR-PROMPT-ATLAS.md`.

## 5. Policies (in force from R1 unless stated)

| #                                                    | Policy                                                                                                                                                                                                                                                                                                                              | Enforced by                               |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **N1 Naming**                                        | "Atlas" is the working name; a deployment shows the vendor's product name (`ATLAS_PRODUCT_NAME`); the name is checked for conflicts before any external use                                                                                                                                                                         | DG-22 (title from config), DG-59          |
| **N2 Local mode invariant**                          | `pnpm --filter @elabs-ai/diagram dev` works from a clean checkout with no server, login or network; files on disk; one mode switch; a local-mode smoke ends every wave gate                                                                                                                                                         | Orchestrator rule 8; every platform item  |
| **N3 Dialect compatibility**                         | Every file carries `diagram: "<major>"`; within a major only additive keys; deprecations warn one release before removal; an upgrader exists for every major step; `spec.validate` reports deprecated usage                                                                                                                         | DG-60                                     |
| **N4 Performance budgets**                           | Particles ≤ 4 ms/frame at 60 edges; layout < 500 ms at 200 nodes; lens transition ≥ 95 % frames ≤ 16 ms; Home first paint < 1 s at 2,000 diagrams (paged); thumbnails rendered on save                                                                                                                                              | DG-62 harness; numbers in item acceptance |
| **N5 Content safety**                                | Markdown rendered without raw HTML; uploaded SVG sanitised; YAML size limits; the MCP skill states that document text is data, not instructions; server-side validation is the only trusted guard                                                                                                                                   | DG-64                                     |
| **N6 Brand and third-party terms (deployment lens)** | Icon packs are _used_ in diagrams (permitted by every vendor) and never re-distributed as packs; a served third-party notices page lists sources and terms per pack; no vendor fonts bundled (Inter only); `ATTRIBUTION.md` in the repo stays untouched by the app (maintainer ruling) while the deployment carries its own notices | DG-59                                     |
| **N7 Catalog quality**                               | Every LLM-filled entry is `curated: false` until a person reviews it; the UI shows the badge; docs links are HEAD-checked; "report wrong description" exists                                                                                                                                                                        | DG-24, DG-41                              |
| **N8 Data classification & retention** (R2)          | Customer folders default to `confidential`; trash with restore and a retention period; exports respect classification; a written description of what the server stores (DPA-ready); no analytics on document content                                                                                                                | DG-65                                     |
| **N9 Gates for a shipped product** (R2)              | The app and server get their own CI workflow (typecheck, lint, contract tests, local-mode smoke, browser tests on the showcases); the library's gates stay untouched and the app never joins `pnpm test`                                                                                                                            | DG-61                                     |
| **N10 Library first**                                | Every wave's findings feed the harvest inventory; DG-63 remains deferred until the maintainer opens that track                                                                                                                                                                                                                      | DG-63                                     |
| **N11 Accessibility**                                | Library a11y rules apply to every surface; colour never the only channel (greyscale check per item); keyboard path per item; WCAG 2.1 AA check on the viewer before R3                                                                                                                                                              | Item acceptance; R3 exit                  |
| **N12 Rendering parity**                             | App canvas, PNG/SVG, PPTX and published HTML render through one path and are compared on the three showcases                                                                                                                                                                                                                        | DG-17, DG-40, DG-43                       |

## 6. Gates (definition of done)

- **Item:** every Acceptance line proven in a real browser (screenshots/recordings), local gates green, audit clean, findings filed. Static checks alone are never done.
- **Wave:** root gates prove the app is absent from the library's `typecheck`/`lint`; the app's gates; reviewer lane; local-mode smoke; performance numbers where the wave touches them.
- **Release:** the exit criterion in §3, accepted by the owner in writing; the tour recording stored in `docs/releases/`.

## 7. Decision log (index)

| Set    | Where                                                      | Scope                                     |
| ------ | ---------------------------------------------------------- | ----------------------------------------- |
| D1–D14 | `docs/2026-09-26-plan.md` §2                               | MVP                                       |
| V1–V15 | `docs/2026-09-27-atlas-v2-plan.md` §2, §11, §12            | Atlas v2, MCP                             |
| S1–S10 | `docs/2026-09-27-style-system-concept.md` §6–§7            | lenses, styles, theme binding, transition |
| P1–P9  | `docs/2026-09-27-platform-and-security-concept.md` §7a, §8 | platform, security, local mode            |
| N1–N12 | this file §5                                               | product policies                          |

## 8. Open risks (owner's attention)

Scope discipline (the R1 cut) · vendor terms once deployed (N6) · customer data (N8) · the library harvest not being crowded out (N10). Details and guards: `docs/2026-09-27-attention-points.md`.
