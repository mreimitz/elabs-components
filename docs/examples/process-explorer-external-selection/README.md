# External-selection example

How to drive `ProcessMap` (`@elabs-ai/components-process`) from a host application's own
associative selection engine, instead of this package's own `useProcessExplorer` hook.
`external-selection.tsx` is the worked file; this README explains the two ideas it puts
together.

## Two inputs, one component

`ProcessMap` accepts either a raw event log (the component discovers the graph itself,
via `discoverGraph`) **or** an already-discovered `ProcessGraph` plus a `Variant[]`,
computed by whatever aggregation the host platform's own engine already runs — activity
counts, next-activity counts, transition counts, median durations. Pass the second shape
and `ProcessMap` never calls `discoverGraph`/`useProcessExplorer` at all: there is no local
computation to skip, because none ran.

That is the whole point of this example. A host platform that already has its own
aggregation engine feeds `ProcessMap` the graph it already computed, rather than handing
over a raw log and paying for a second, redundant discovery pass.

## The tri-state selection contract

`ProcessMap` never assumes it owns selection. Two props carry it:

- **`selectionStates`** (`ProcessSelectionStates`) — sparse, per-id records for
  `activities`/`transitions`/`variants`, each value one of `"selected"` / `"associated"` /
  `"excluded"`. An id with no entry defaults to `"associated"`. This is how a filter (or,
  here, an external engine's selection) re-inks the map — dimming excluded elements — without
  ever removing a node or an edge.
- **`onFilterIntent`** — fires when the reader picks an item from the map's own filter
  menu (`with`/`without`/`startsWith`/`endsWith`, one activity each).

Locally, `useProcessExplorer` owns both: it turns `onFilterIntent` into a recomputed graph
and derives `selectionStates` from which elements its own filter excluded. An external
selection engine takes over both jobs instead — same two props, same component, a
different source of truth behind them. That symmetry is the reason this package can sit
inside a standalone prototype and inside a host platform's own mashup with no component
change.

## The interface this example assumes

`external-selection.tsx` invents a minimal, generic stand-in for "a host's associative
selection engine" — nothing here is a real SDK, and nothing in
`@elabs-ai/components-process` knows this interface exists:

```ts
interface SelectionEngine {
  state(field: string): Record<string, "S" | "O" | "X">; // Selected / Optional-associated / eXcluded
  select(field: string, values: string[]): void;
}
```

`"S"` / `"O"` / `"X"` are exactly `ProcessSelectionState`'s three values under different
letters — the mapping is 1:1, not lossy.

## Mapping `SelectionEngine` → `ProcessMap`

**Engine state → `selectionStates`** (`mapEngineStateToSelectionStates`): for each
namespace (`"activity"`, `"transition"`, `"variant"`), read the engine's state for that
field and translate `"S"` → `"selected"`, `"X"` → `"excluded"`, and drop `"O"` entries
entirely — an absent key already means `"associated"`, so writing it out would only bloat
the object. States are narrowed to the ids the _current_ graph/variant list actually
contains, so a value the engine still remembers from before an abstraction or a filter
change never gets forwarded for an element that is no longer drawn.

**`onFilterIntent` → engine `select`** (`intentToEngineSelect`): every intent
`ProcessMap`'s own filter menu emits — `with`, `without`, `startsWith`, `endsWith` — names
exactly one field (`"activity"`) and one activity. The example packs that into
`select("activity", [activity])`. This is deliberately the simplest possible translation:
a real associative engine usually has separate include/exclude primitives, and a fuller
adapter would branch on the intent's kind and call the engine's own equivalent of
`without`/`startsWith`/`endsWith` instead of a bare re-select. What this example
demonstrates is the _shape_ of the translation, not an exhaustive one — adapt the branch to
whatever primitives your own engine actually exposes.

## What this package never does

`@elabs-ai/components-process` never imports, calls, or knows about any selection engine,
associative or otherwise (D5 — brand-ui is a presentation layer, not a runtime; see
`docs/DECISIONS.md`). Every line that understands `SelectionEngine` lives in this example
file, in your application. Swap the engine, and only `mapEngineStateToSelectionStates` /
`intentToEngineSelect` change — `ProcessMap` does not.

## Related

- `packages/process/README.md` — the package's own peer-dependency, styling and
  pre-aggregated-input notes.
- `docs/CONSUMING.md` §6 — the "process" per-package extras entry.
