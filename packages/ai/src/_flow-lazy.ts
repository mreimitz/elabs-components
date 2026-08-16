/**
 * The one dynamic-import seam every React-Flow-backed component in
 * `@elabs-ai/components-ai` goes through.
 *
 * `@xyflow/react` declares no `sideEffects`, so a static import from any of the
 * six public modules (`canvas`, `controls`, `edge`, `node`, `panel`, `toolbar`)
 * put the whole engine into the entry chunk of every consumer. They all reach it
 * through **one** boundary module — `_flow-boundary.tsx` — rather than six, so
 * the engine lands in exactly one chunk: six boundaries would mean six chunks
 * each pulling the same engine, and a `<Node>` rendered inside an already-loaded
 * `<Canvas>` would fetch a second copy.
 *
 * Because every part resolves from the same specifier, the parts _inside_ a
 * canvas resolve from the module cache the canvas already populated.
 *
 * This module is deliberately NOT itself a lazy boundary (it carries no such
 * docblock tag, and `pnpm heavy-deps:check` would fail the six static imports
 * below if it did): it holds no engine import of its own, only the `import()`
 * call, so the public modules may import it statically. See ADR 0019.
 */
import { lazy } from "react";
import type { ComponentType, LazyExoticComponent } from "react";

type FlowBoundaryModule = typeof import("./_flow-boundary");

/**
 * Wrap one implementation from the React Flow boundary in a `lazy()` component.
 *
 * @param pick Selects the implementation from the boundary module.
 */
export const lazyFlowPart = <P>(
  pick: (module: FlowBoundaryModule) => ComponentType<P>,
): LazyExoticComponent<ComponentType<P>> =>
  lazy(() => import("./_flow-boundary").then((m) => ({ default: pick(m) })));
