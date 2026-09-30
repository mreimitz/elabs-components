# Diagram composition and view switching

A technical diagram and its visual overview share one relationship model. Technical view
shows specific endpoints and detail; visual view groups them into capabilities. Switching
views never writes YAML or changes the technical graph.

## Technical grouping

Use `direction` for the flow axis inside a zone. An optional `arrangement` makes the order
of its direct children explicit:

- `sequence` places children in authored order along that axis.
- `parallel` places branches across that axis. Each branch retains its own flow direction.
- `align: start`, together with an explicit arrangement, aligns the leading borders of differently sized branches. Without this
  hint, ELK optimizes placement around connections.

```yaml
zones:
  - id: formulation
    title: Answer formulation
    direction: LR
    arrangement: parallel
    align: start
    children:
      - id: structured
        direction: LR
        arrangement: sequence
        children:
          - { id: search, title: Semantic search }
          - { id: analyze, title: Analyze }
      - id: unstructured
        children:
          - { id: retrieve, title: Retrieve passages }
flows:
  - search -> analyze: Relevant items
```

These are layout constraints, not additional relationships. ELK routes the real edges
against the resulting geometry; layout-only ordering edges never render. Existing diagrams
without these hints retain automatic placement. Manual layouts retain their saved positions.
`layoutRole: secondary` on a flow lowers its direction priority during cycle breaking. It
does not remove the edge or exclude it from layout; all labels, endpoints and metadata remain.

## Visual abstraction

`visual.composition: process` creates a compact stage progression, suitable for Answers'
Connect → Prepare → Ask → Explain → Review journey. The default `deployment` composition
reserves a control-plane band above the data plane.

A visual box may use:

- `summary: true` to show a concise capability title while retaining every `members` entry
  for drill-down and provenance.
- `slot: 0` (a non-negative integer) to keep comparable variants in the same row. Slots align
  across lanes; unoccupied positions are retained.
- `boundary: zone-id` to represent an exact technical zone endpoint. Its members must belong
  to that zone. An empty membership is valid for a boundary-only box.

A connection to a zone never silently targets a majority child. When no authored box
represents its boundary, an explicit boundary proxy is added. Connections retain their source
IDs, direction, kind, labels, protocol, schedule and security metadata. Internal relationships
remain in the lens model even when they do not need a visible connector.

`visual.flows` annotates existing box pairs; it cannot invent a connection. An explicit
annotation can bundle equivalent displayed arrows while retaining their complete source
records. Without an annotation, semantically distinct relationships retain separate labels.
Opposite arrows combine only when their relationship semantics match.

Lane widths use deterministic text estimates and bounded wrapping; spacing is allocated to
the corridors that need it. Process pills reserve space above a box at its top-right edge.
Visual geometry checks cover box, label and route collisions. Dense technical diagrams still
need zooming for their full detail; an overview should use authored summaries rather than
hide unreadably small details inside large boxes.

## Style profiles

The Qlik style guide informs composition: zones describe context, boxes describe components,
and pills describe processes. Its palette, typography and vendor marks belong to
`src/style/profiles/qlik-marketecture.yaml`. Generic engine geometry stays vendor-neutral.
Generic capability icons are monochrome; named vendor/product marks keep their identity.
Contrast-safe profile colors take precedence over reproducing low-contrast slide colors.

## Switching and motion

Technical and visual topologies can differ substantially. The app crossfades the two complete
live drawings in 240 ms (120 ms with reduced motion). Labels and real routed edges remain
present; there are no synthetic centreline paths or moving empty zone rectangles. Both panes
are inert during preparation and transition. Each view retains its own camera and keyboard
focus; rapid reversals and navigation cancel stale preparation.

Validation lives in the visual/core and technical-composition unit tests, `#dev/lens-check`,
and the browser `lens-motion`, `lens-navigation`, `lens-recovery` and `lens-roundtrip` proofs.
