# Inline diagram references

Automatic layout can draw a resolved `expand: true` reference as a zone containing the
referenced diagram. The compiler keeps the authored AST intact and creates a private drawing
projection. Wrapper origins point to the parent's reference node; imported zones, nodes and
flows have no writable origin in that parent.

## Compiler contract

- `expandInstances(ast, table, expand?, collapse?)` is pure. Imported ids, parents and flow
  endpoints are qualified by instance id. Source styles are namespaced and each child retains
  its own node style and catalog metadata. Positions and notes from referenced files are not
  imported. Repeated references produce separate graph instances.
- `compileArch(ast, table, { expand, collapse })` supports temporary expansion and collapse;
  `collapse` wins. The same sets pass through `compileText` in its sources argument. Authored
  values remain unchanged, and callers keep ownership of their local view state.
- Expanded wrappers carry `component`, `count`, inherited title/icon/description, and their
  surrounding zone's owner. Imported data carries `inner: true`. `view.inner` maps each
  imported graph id to its source file and local id or stable flow key. An authored parent
  flow sharing the same endpoints as an imported flow keeps its own independent origin.
- Exact expanded dotted endpoints connect to their actual inner node. Plain instance
  endpoints attach to the zone boundary. A collapsed nested reference continues to expose
  the existing inner endpoint/port contract.

## Bounds and manual layout

Expansion permits at most eight reference levels and 1,000 imported zones, nodes and flows
per compilation. The expander reserves a complete child diagram's immediate contents before
copying any of them. An instance that exceeds the remaining budget stays collapsed with a
positioned `expand-limit` warning. Its siblings and containing diagram remain complete;
further nested references may also stay collapsed. Cycle and depth guards remain active even
when the caller supplies an unchecked component table.

Manual diagrams keep references collapsed and retain their authored positions. Authored or
temporary expansion produces `expand-ignored` information. Changing the view never writes
positions for imported nodes. Missing or invalid reference behavior remains unchanged.

## Write boundaries

Imported graph nodes cannot drag or delete, and imported edges cannot delete. Imported zones
also suppress resize handles independently of the surrounding Edit mode. Both imported zones
and expanded reference wrappers are excluded from reparent drop targets. The manual writer
rejects attempts to move imported entries or write children into an instance boundary.
`entryOf` returns no parent source entry for imported ids, so inspector/delete writeback
cannot target them. The central text-admission guard also rejects live-view and drill-view
writes to the retained parent document; the drill route itself is supplied by the UI slice.

Live reference resolution can change structure while an earlier layout is running. Layout
results are admitted only if both the synchronous compiled structure and the deferred layout
key still match, preventing a pending reference picture from replacing its expanded graph.

## Verification

Eight focused compiler tests cover origin isolation, nested/shared instances, duplicate flow
keys, catalog/style inheritance, explicit empty overrides, temporary collapse precedence,
manual fallback, immutable inputs, budget/cycle protection and manual-write rejection. Three
additional deterministic fixture rows run on the browser's specification-check page.

`tests/inline-expansion.mjs` creates disposable copies of the shipped customer-landscape
and validates light/dark desktop/phone rendering, read-only inner interactions and manual
fallback. Expected counts come from the current source: 18 nodes/11 flows collapsed and
23 nodes/13 flows expanded. It also checks nested-zone resize protection with an authored-zone
positive control, real MCP validation/create/toggle and inner-write refusal, and byte-identical
original template/component files after cleanup.

The compiler slice does not add composite controls or drill-down navigation. Those belong to
the companion UI slice; the legacy reference-type diagnostic remains until that renderer
can honor the override. Phone editing tests close the existing full-canvas Inspector through
Diagram options before interacting with the canvas; the UI slice owns that overlay's layout.
