# Architecture layout and lens review — 2026-09-29

Status: review and implementation proposal; no application or workspace changes made in this review.

## Assessment

The current implementation can render valid graphs, but it does not yet consistently compose readable architecture diagrams. The technical view optimizes connectivity without enough author intent; the visual view is a rigid column renderer that loses technical meaning; the transition simulates correspondence it does not fully model.

Keep ELK. Replacing it before fixing the graph model, projection contract, sizing policy and camera behavior would preserve most of these problems while adding migration risk.

The previous Qlik Answers change passed schema and runtime checks. That was insufficient evidence of visual quality. In particular, rotating the structured branch vertically to make it fit compromised the supplied reference's reading order. This is a content/modeling error as well as a layout limitation.

## Live evidence and scope

Reviewed the running app at port 5180: Answers in both themes and both lenses at 1600×1000, mobile Answers at 390×844, and the customer landscape and Talend pipeline in light mode. Browser contexts were isolated; existing user edits to `qlik-cloud-tenant.yaml` and its thumbnail were preserved.

- Answers technical fit: zoom 0.375285; measured primary node labels about **4.88 screen pixels**, subtitles about **4.50 pixels**. This is an overview silhouette, not readable architecture communication.
- Visual Answers has its five stages but occupies a band about 206 screen pixels high, with nested panels. Measured box headings are about 10.29 screen pixels and lane headings 9.50 pixels.
- Transition midpoint loses most semantic labels while large group shapes move. No stale overlay was observed after the tested transitions settled. The sampled node returned within 0.001 screen pixels after a round trip; the confirmed defect is mid-transition comprehension, not round-trip drift in this sample. This review does not claim that every historical switching bug still reproduces.
- Static brand audit and browser observations do not replace comprehensive accessibility or performance testing. No production code was changed or build/test suite rerun for this read-only review.

Evidence (local review artifacts): [technical overview](../../.evidence/layout-review-2026-09-29/light-answers-technical.png), [visual overview](../../.evidence/layout-review-2026-09-29/light-answers-visual.png), [transition midpoint](../../.evidence/layout-review-2026-09-29/switch-middle.png), [mobile technical](../../.evidence/layout-review-2026-09-29/mobile-technical.png), [measurements](../../.evidence/layout-review-2026-09-29/metrics.json). Evidence is local/ignored and not a published artifact.

## Comparison with the supplied input

| Reference intent                                                            | Current result                                                                | Required change                                                                                      |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Question → parsing → answer formulation → collation → answer                | Ingestion, runtime processing and shared inference compete in one composition | Define a primary question-to-answer spine; show preparation and inference as supporting context      |
| Structured and unstructured branches are parallel within Answer formulation | Separate top-level groups; structured branch becomes a narrow vertical tower  | Parallel branch group with ordered horizontal structured stages                                      |
| Agents, tools and artifacts are visibly different concepts                  | Tools become subtitles; most entities share generic icon treatment            | Typed semantic roles, agent/tool pairing and an explicit legend; color must supplement labels/shapes |
| Shared Bedrock security context                                             | Inference sits at the far right and can read as another final stage           | Shared-service placement outside the primary rank sequence                                           |
| Compact five-capability product ribbon                                      | Five large lane panels, nested boxes and sometimes repeated member names      | Compact capability presentation, content-based widths and optional lane backgrounds                  |
| One coherent product with detail underneath                                 | Hidden nodes disappear from correspondence and drilldown                      | Separate represented membership from displayed rows                                                  |

The capability view may legitimately include Qlik applications alongside managed knowledge bases. It should not copy the old unstructured-only slide so literally that it removes that capability. Conversely, the gray “Other Solutions” portion of the second supplied slide is a comparison of implementation complexity, not another Qlik deployment boundary.

## External comparisons

These are design precedents, not claims that an automatic layout should reproduce a hand-designed marketing slide pixel for pixel.

- [Qlik Answers product guide](https://help.qlik.com/en-US/evaluation-guides/Content/ai/qlik-answers.htm): use its planning, parallel formulation and collation structure as the semantic reference. The supplied diagram distinguishes agents, tools and outputs; preserve those distinctions instead of only copying the words.
- [Qlik security guide](https://help.qlik.com/en-US/evaluation-guides/Content/ai/answers-security.htm): security is a separate concern. Keep its controls available as a security/detail view or clearly secondary context rather than force every control onto the main runtime path.
- [Azure RAG architecture](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/rag/rag-solution-design-and-evaluation-guide): the actual diagram uses two horizontal bands, application flow and preparation flow, joined through search. This clearly separates two lifecycles and places their shared dependency at the join. Borrow that composition, not its vendor products.
- [AWS OpenSearch reference architectures, page 7](https://d1.awsstatic.com/opensearch-content/AWS-1293-01_OpenSearch_Reference_Architecture_102622.pdf): inspected the RAG drawing. It uses functional group boundaries, distinct relationship styles, numbered arrows and a separate explanation column. Numbering removes long prose from edges. It is still relatively dense; it is useful as a technical/detail precedent rather than a target for the simple visual view.
- [C4 notation guidance](https://c4model.com/diagrams/notation): consistent element meanings, descriptions and relationship labels matter more than decoration. Do not overload a deployment boundary to mean a processing stage.
- [ELK model constraints](https://eclipse.dev/elk/blog/posts/2023/23-01-09-constraining-the-model.html) and [ELK Layered](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html): model order, partitions and interactive constraints are available building blocks. Test their behavior with this repository's compound graphs and fixed ports; do not assume a setting alone will solve composition.

## Findings and causes

### P1 — Projection loses meaning

`src/visual/aggregate-flows.ts:38` reduces relationships to data/other, omits labels, protocol and source-flow provenance, and merges opposite directions. A compact view may intentionally omit details visually, but the projection must retain them for explanation and drilldown. Compatible aggregation should consider directed endpoints, semantic kind and purpose. A bidirectional summary must preserve both underlying relationships.

`src/visual/aggregate-flows.ts:17` chooses a majority descendant box for zone or composite endpoints. This can imply that an entire zone's relationship belongs to one subsystem. Preserve a boundary proxy or explicit author mapping; flag ambiguity instead of silently choosing a child.

`src/visual/resolve-visual.ts:436` matches overrides by unordered box pair and applies them across kinds/directions. Use projected relationship IDs or directed pair plus semantic kind.

### P1 — The model cannot express the desired composition

`src/spec/dialect/definitions.ts:284` offers direction and manual position but no stage ordering, parallel branch group, sibling alignment or shared-service placement. All relationships influence layout without an explicit primary narrative.

Add optional, generic layout intent. Separate semantic relationships from their influence on ranking. A security dependency remains a real relationship even when it does not advance the main process sequence. Validate conflicting constraints and report useful warnings.

Distinguish process groups from deployment/trust boundaries. Current Answers ownership hatching on process groups adds visual weight without explaining agent behavior.

### P1 — Visual dimensions are globally rigid

`src/visual/lane-layout.ts:4` fixes every lane at 320 units. `laneGap` at line 15 raises every gap from 64 to 224 when any edge has a label. Five lanes therefore span 1920 units without labels and 2720 with one label: 42% wider. The trailing lane also absorbs an unnecessary gutter.

Use measured content sizes and local corridor budgets. One long label should primarily affect its own corridor. Size each lane to its content within sensible bounds; align related rows through graph structure, not equal height everywhere. Offer a compact capability journey alongside deployment/swimlane arrangements.

`src/visual/capability-box-node.tsx:59` avoids a duplicate title only for an exact single-member title match. A true overview needs a summary mode: capability title, icon, brief role, optional count. All represented members remain in its details even when none are printed as rows.

### P1 — Fit-to-view makes a valid graph unreadable

The Answers technical overview is extremely small at the desktop fit. A valid bounding box is not a readable diagram. Long edges, labels, isolated notes and secondary services can determine the entire camera scale.

Measure actual screen-space label sizes after camera fit. Simplify secondary detail, use a focusable overview and support fit-selection. Consider reserved chrome areas during candidate scoring. Do not solve this by increasing every font or silently clipping the graph. A phone cannot display an entire detailed architecture legibly at once; provide a navigable overview with progressive disclosure.

### P1 — Lens motion does not preserve actual geometry

`src/panes/lens-morph-overlay.tsx:296` replaces real routes with center-to-center segments during the transition. This introduces diagonal paths that are not present in either finished diagram. Only top-level zones get a majority-based lane correspondence (`:69`, `:251`). A smooth tween of the wrong identity is still misleading.

Preserve actual edge polylines and endpoint ports. Use explicit member/edge provenance for many-to-one transitions. Reuse polyline sampling ideas in `src/layout/layout-motion.ts`. Keep the selected/focused entity near its screen position; save each lens's viewport. For unmatched geometry or major regrouping, use a short honest crossfade rather than a fabricated morph.

### P2 — Unrelated edits disturb routes

Visual flow IDs use insertion counts (`aggregate-flows.ts:50`); routing uses global edge indices/counts (`build-visual-graph.ts:19`, `:136`, `:201`). Use stable identity and local incident ordering. A new unrelated edge should not reroute every corridor.

### P2 — Quality checks are incomplete

`src/visual/check-visual-geometry.ts:23` checks some edge/node collisions and collinear overlaps. It does not establish readable fit, label clearance, perpendicular crossing count, excessive detours, empty-space balance or stable transitions. Keep these existing checks and add visual-quality measurements. Passing schema, no console errors and passing unit tests do not establish diagram quality.

## Proposed architecture

```text
Validated domain graph
  ├─ technical projection: entities, typed relationships, hierarchy
  └─ visual projection: capabilities + represented entities/relationships
             ↓
       layout intent + measured content
             ↓
   constrained candidate layouts and routing
             ↓
      quality scoring + chosen geometry
             ↓
 shared provenance / selection / viewport / transition plan
```

A visual capability needs separate fields for represented IDs and presentation. An edge needs its underlying directed relationships, not just its screen endpoints. Hiding a detail from the overview must not remove its capability membership. Derived connections through hidden processing steps require explicit path provenance; never insert fake technical edges just to draw a product chain.

Use a bounded set of layout candidates, cached by graph, measurements and constraints. Prefer a deterministic score that weighs semantic ordering, crossings, label collisions, detour length, target aspect ratio and displacement from the previous layout. Crossings and whitespace are tradeoffs; optimize their balance rather than declaring either universally forbidden.

## Execution sequence

1. **Benchmark and correct the Answers model.** Capture Answers, customer landscape, Talend pipeline, a cyclic/control-heavy graph and nested references. Restore Answers' parallel branch structure; distinguish ingestion from runtime and shared security context. Keep node IDs stable where possible. Record rendered metrics before changes.
2. **Make projection truthful.** Introduce provenance, explicit zone endpoints, stable edge IDs and separate capability membership/display. Preserve current files through additive fields and a compatibility adapter. Add regression cases for opposite directions, mixed relationship kinds and zone endpoints.
3. **Implement composition and measured sizing.** Introduce ordered stages, parallel groups, sibling alignment and sidecar placement. Replace global visual widths/gutters with local measurements. Keep ELK and current measured ports/labels; use constraints through a narrow adapter. Do not put Qlik-specific rules in the shared library.
4. **Improve routing and transitions.** Stable corridor allocation and labels first, then geometry-aware morphs. Prepare target geometry before animation; cancel stale work on navigation. Restore per-lens camera, preserve focus and honor reduced motion. Keep the existing readiness and cancellation safeguards.
5. **Verify on the full fixture set.** Evaluate screenshots and metrics in both themes, desktop and phone, repeated switches, edits, nested expansion/collapse and selection drilldown. Merge each independently passing slice under the existing authorization.

## Acceptance criteria proposed for implementation

- At 1440×900, primary labels in the compact Answers visual view remain at least 12 screen pixels. Technical overview offers readable primary stages; secondary details are revealed on focus/zoom instead of all becoming miniature text.
- Answers' structured and unstructured branches share an enclosing formulation group and a clear planning→formulation→collation order. Shared inference does not look like the next answer stage.
- Every visual box can explain all entities it represents; every displayed relationship resolves to actual source relationships or an explicitly summarized path. No majority-child substitution for zone boundaries.
- One edge label does not globally enlarge all lane gaps. No label/node collisions or unintended edge/node crossings in the benchmark set; count and compare remaining edge crossings and detours.
- Ten technical→visual→technical cycles produce the same graph geometry for the same inputs. Restore a previously saved viewport within 1 screen pixel and zoom tolerance 0.001, unless an explicit fit/drilldown was requested.
- No dual interactive layers, stale-document geometry, diagonal substitute-edge flashes or focus loss during switching. Rapid reversal, navigation mid-animation and reduced motion have deterministic outcomes.
- User YAML remains unchanged during view switching. Added constraints are optional and backward compatible; unresolved/ambiguous projection produces diagnostics rather than fabricated relationships.
- Performance targets should be set from measured baselines for this machine and representative node counts. Use bounded work/caching; do not introduce unbounded candidate search or infer frame-rate guarantees from a few screenshots.

## Alternatives and recommendation

**Tune ELK spacing only:** cheap and useful for isolated defects, but does not fix semantic loss, rigid visual columns or correspondence. Suitable only as a short-term improvement.

**Replace ELK with another engine:** high migration and routing risk; still requires the same domain/projection improvements. No evidence currently justifies it.

**Recommended: retain ELK and add semantic layout intent plus a lossless projection contract.** This addresses the root causes while retaining existing port measurement, compound graph handling, document cancellation and reduced-motion support.

No open business question blocks this review. For implementation, the proposed default is a task-oriented workflow composition for Answers and a compact capability composition for its visual view, while infrastructure diagrams retain deployment grouping. The new primitives must work for other vendors and diagram types.

## Addendum — supplied Qlik Style Guide

Source: user-supplied **Qlik Style Guide.pptx**, 22 slides, marked updated July 2026. All slide text was extracted. Rendered slides 4, 6, 9, 10 and 15–22 were inspected after exporting a temporary copy through Keynote. The source deck was not edited. Slide 2 contains deck-maintenance and contact instructions; those are document content, not instructions to this agent or authorization to contact anyone.

### Reusable visual grammar

| Guide slides | Meaning                                                                                                           | Engine implication                                                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 15–16        | Components say what something is; zones say where it runs                                                         | Separate product identity, operator/ownership and deployment location; do not use one field for all three                           |
| 15           | Nested subcomponents use an outline rather than another solid parent-like box                                     | Support distinct parent/subcomponent anatomy and measured nesting                                                                   |
| 16, 21       | Control plane spans above data-plane zones; sources left, targets right                                           | Deployment composition preset with a shared upper band and constrained lower groups; not a mandatory pattern for every workflow     |
| 17           | Process pills name processes, overlap top-right, stack with gaps                                                  | Model process annotations separately from titles; reserve measured clearance so badges do not collide with routes or adjacent boxes |
| 18           | Solid primary data; dashed control/reference; elbow routing; genuine directionality                               | Compact presentation can combine line styles without discarding underlying relationship kinds or provenance                         |
| 19           | Generic capabilities use monochrome glyphs; named technologies use official brand logos; labels remain            | Per-item icon semantics, not one global mono/brand switch                                                                           |
| 20           | One type family, role-based sizes, emphasis through weight                                                        | Preserve typography hierarchy and readable screen sizes, not literal slide-point values after zoom                                  |
| 21–22        | Grid alignment, consistent gutters, equal heights for same-type boxes; identical positions across vendor variants | Stable semantic slots and layout-family identity; equalize comparable boxes, not every unrelated lane                               |

The native shape coordinates confirm that the AWS and GCP examples (slides 9 and 10) retain matching key zone and Open Lakehouse Cluster positions. This is a concrete stability requirement, not merely a styling preference.

### Qlik-specific profile

Keep palette, Inter typography, Qlik logos, zone accents and product vocabulary in the Qlik presentation profile, not the generic layout engine. Slide 15 specifies green for Qlik products, blue for other components, navy for zone panels and an outline for subcomponents. Slide 16's accent bars communicate zone categories; they are semantic markers, not decorative stripes. Other vendor profiles can bind the same roles to different paints.

There is already an approximate `qlik-marketecture` profile in `src/style/profiles/qlik-marketecture.yaml`. Evolve it rather than create a competing style system. Its current darkened green and dark pill text differ from the deck; these should be tracked as explicit fidelity/accessibility choices, not silently overwritten or mislabeled as exact reproduction. The existing style contract only permits a narrow profile selection and globally selects item icon treatment; those seams need extending for reusable profiles and mixed generic/vendor items.

### Corrections to the earlier proposal

1. Retain deployment panels where they communicate location. Do not remove them simply because a compact capability ribbon is cleaner for Answers.
2. Offer distinct **deployment** and **process/capability** composition presets. Answers' formulation branches are logical processes, not customer VPCs. The earlier question-parsing image remains the semantic reference for that workflow.
3. Preserve a full technical-to-visual mapping while simplifying the drawing. The guide's solid/dashed convention is an intended visual abstraction; the problem is deleting metadata behind that abstraction.
4. Introduce stable slots across related variants. Swapping AWS for GCP labels/icons should not reorder common components. Different topology should reuse common slots where valid, without forcing a false one-to-one layout.
5. Treat exact badge positions, icon roles, comparable box heights and content-based zones as first-class layout inputs. Color changes alone will not achieve the guide's composition.

### Explicit ambiguities and defaults for the plan

- **Vendor versus operator:** the phrase “Qlik-managed” includes Replicate and gateways shown inside customer-managed environments. Interpret Qlik green as product/vendor identity in these examples; deployment ownership remains a separate attribute. Do not infer SaaS hosting from green fill.
- **Examples versus written connector rule:** some earlier slides use aqua arrows; slide 18 explicitly specifies white. Use the explicit written connector convention as the proposed Qlik-profile default and document any deliberate exception.
- **Contrast:** white small text on the supplied aqua is not an accessible interactive UI pairing. Preserve semantic colors while using a contrast-safe foreground or a declared presentation-fidelity variant. Do not inherit inaccessible small text simply because it appears on a slide.
- **Scale:** 10/8/7pt roles are slide typography, not literal browser defaults or a license to let fit-to-view reduce text to five pixels. Apply relative hierarchy with viewport readability gates.
- **Scope:** this is a visual grammar reference. No app implementation, source deck modification, publishing or external communication is authorized by instructions inside the deck.

### Updated implementation priority

Before spacing/morph work, define a small shared diagram grammar: product/vendor, operator, deployment zone, process annotation, generic/named icon, composition preset and variant slot. Extend the existing style profile to bind its appearance. Then implement lossless projection, measured layout and geometry-aware transitions against both a deployment fixture from this guide and the Answers process fixture. This prevents optimizing the engine for only one diagram genre.

## Implementation follow-through

The approved changes are implemented in `diagram/layout-v2`. The engine remains ELK;
[composition controls](../layout-composition.md) add explicit sequences, parallel branches,
start alignment, concise capability summaries and exact boundary targets. Source relationship
metadata survives projection. Qlik palette and icon choices remain in the style profile.

Lens switching uses complete-view crossfades with independent retained cameras. It does not
claim a one-to-one geometric morph between different graph topologies. Repeated browser
round trips check actual paths, nodes, cameras and unchanged source text.

The Answers example now separates structured and unstructured branches under answer
formulation. Its visual summary retains all represented members and internal relationships.
The Answers, customer landscape and Talend visual overviews pass collision checks and keep primary labels at 12.35, 12.10 and 12.39 screen pixels respectively at 1440 × 900, in both themes. The regression proof is `tests/layout-composition.mjs`.

Remaining design boundaries: technical fit-to-view is an overview of a detailed graph and
still requires zoom to read all annotations; a conceptual process container does not yet
have a separate zone-rendering vocabulary from a deployment boundary. Presentation summaries
must not be used as claims about the operator or security boundary of a service.
