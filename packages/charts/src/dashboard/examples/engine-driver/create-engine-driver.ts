/**
 * `createEngineDriver` (RM-085, #433; analysis §4 R13, §5.3, Sources) — a `SelectionDriver`
 * (`core/selection.ts`) over a `MockEngine` (`./mock-engine.ts`). This is the proof that the
 * driver seam holds for an engine that is ASYNCHRONOUS and OWNS ITS OWN HISTORY — the two
 * properties a real associative engine (Qlik-shaped) has and the bundled
 * `core/local-selection-driver.ts` does not.
 *
 * REFERENCE IMPLEMENTATION, not shipped API — see `./mock-engine.ts`'s module doc. Nothing in
 * `@elabs-ai/components-charts/dashboard` imports this file; `DashboardProvider` only ever sees
 * the `SelectionDriver` interface, never this adapter or the engine underneath it.
 *
 * - `select` calls `engine.selectValues` and returns IMMEDIATELY — `SelectionDriver.select` is
 *   fire-and-forget by contract, so the engine's own asynchronous resolution reaches the sheet
 *   only through the `onChange` this driver forwards via `subscribe`, exactly like a click and a
 *   later render.
 * - `getSnapshot` reads the engine's own `getStates()` — this driver computes NOTHING itself.
 *   That is the point of the example: the sheet never assumes a driver is local or synchronous.
 * - `back`/`forward`/`canBack`/`canForward` delegate straight to the engine. The store's OWN
 *   history (`core/history.ts`, `DashboardState.history`) is the layout/edit undo stack — a
 *   selection made through this driver never pushes a step onto it (see
 *   `create-engine-driver.test.ts`, "a selection never touches the store's layout history").
 * - `register` is a no-op: an associative engine already knows its own model; the local driver's
 *   `register` exists only to feed ITS OWN row-intersection bookkeeping.
 * - `lock` is a documented gap: the mock engine has no field-lock primitive. A real associative
 *   engine's own lock call (Qlik's `Field.lock()`) belongs here — left as a comment, not silently
 *   swallowed.
 * - `ready` resolves once the engine has fired its first `onChange`. This is RM-083's optional
 *   `SelectionDriver["ready"]` field, not yet declared on `core/selection.ts`'s `SelectionDriver`
 *   as this ships (RM-083 adds it there). Feature-detected here as an extra property on the
 *   returned object, so this example is already a valid, complete `SelectionDriver` before and
 *   after RM-083 merges — a host reading `driver.ready` gets a real promise either way.
 */
import {
  createSelectionSnapshot,
  type SelectionDriver,
  type SelectionFieldState,
  type SelectionSnapshot,
} from "../../core/selection";
import type { MockEngine } from "./mock-engine";

function snapshotFromEngine(engine: MockEngine): SelectionSnapshot {
  const fields: Record<string, SelectionFieldState> = {};
  const associated: Record<string, Set<unknown>> = {};
  const states = engine.getStates();
  for (const field of engine.fields) {
    const selected = engine.selected(field);
    if (selected.length > 0) fields[field] = { values: [...selected] };
    const possible = new Set<unknown>();
    for (const [value, state] of Object.entries(states[field] ?? {})) {
      if (state !== "excluded") possible.add(value);
    }
    associated[field] = possible;
  }
  return createSelectionSnapshot(fields, associated);
}

/** `createEngineDriver`'s return type: a real `SelectionDriver` plus RM-083's `ready`. */
export interface EngineDriver extends SelectionDriver {
  /** Resolves once the engine's first `onChange` has fired. */
  ready: Promise<void>;
}

/** Wrap `engine` as a `SelectionDriver` a `DashboardProvider` can use as-is. */
export function createEngineDriver(engine: MockEngine): EngineDriver {
  let snapshot: SelectionSnapshot | null = null;
  const listeners = new Set<() => void>();
  let resolveReady!: () => void;
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });
  let readyFired = false;

  // Subscribed for the driver's lifetime — this example has no `dispose`, matching
  // `core/local-selection-driver.ts`, which is also never explicitly torn down (a sheet's
  // driver instance lives as long as its `DashboardProvider`).
  engine.onChange(() => {
    snapshot = null;
    if (!readyFired) {
      readyFired = true;
      resolveReady();
    }
    for (const listener of [...listeners]) listener();
  });

  return {
    getSnapshot() {
      if (!snapshot) snapshot = snapshotFromEngine(engine);
      return snapshot;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    select(field, values, opts) {
      // Fire-and-forget (see the module doc): the engine answers later, through `onChange`.
      void engine.selectValues(field, values, opts?.toggle);
    },
    clear(field) {
      void engine.clear(field);
    },
    lock() {
      // Documented gap — see the module doc's `lock` bullet. A real associative engine's own
      // field-lock call goes here.
    },
    back() {
      engine.back();
    },
    forward() {
      engine.forward();
    },
    canBack: () => engine.canBack(),
    canForward: () => engine.canForward(),
    register() {
      return () => {};
    },
    ready,
  };
}
