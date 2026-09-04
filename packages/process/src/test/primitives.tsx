/**
 * Composition-primitive stand-ins + fixture helper for `@elabs-ai/components-process/test` —
 * RM-053.
 *
 * `@elabs-ai/components-charts/src/test/primitives.tsx` exists because Vitest's `vi.mock`
 * factory proxy throws on ANY omitted export the moment consumer code reads the binding — so
 * every composition primitive a real container renders declaratively (`<Line>`, `<XAxis>`, …)
 * needs an inert stand-in here too, not only the containers themselves. The process package's
 * public barrel (`src/index.ts`) ships no components yet (RM-051/052/054 land the first ones),
 * so there is currently nothing to namespace-complete — this file is the documented,
 * intentionally-near-empty placeholder that keeps the module shape identical to the charts
 * package's, ready for RM-051 onward to append inert stand-ins here as real composition
 * primitives land.
 *
 * What it does ship today is {@link withProcessFixture} — a small assembly helper, not a
 * render stand-in (Testing Library's own `render()` already renders JSX; nothing here needs to
 * wrap it). It takes a raw `EventLog` — typically {@link generateSyntheticLog} or the
 * BPI-2012-shaped fixture generator (`core/fixtures/generate-bpi-2012-subset.ts`) — and derives
 * the graph and variants a story or test usually wants alongside it, once.
 */
import { discoverGraph } from "../core/discover-graph";
import { extractVariants } from "../core/extract-variants";
import type { EventLog, ProcessGraph, Variant } from "../core/types";

/** The derived triple most process stories/tests want from one raw log. */
export interface ProcessFixture {
  log: EventLog;
  graph: ProcessGraph;
  variants: Variant[];
}

/** Derive {@link ProcessFixture} from a raw event log. Pure — no caching, no I/O. */
export function withProcessFixture(log: EventLog): ProcessFixture {
  return { log, graph: discoverGraph(log), variants: extractVariants(log) };
}
