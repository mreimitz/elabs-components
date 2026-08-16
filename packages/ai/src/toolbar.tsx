"use client";

import type { NodeToolbar as FlowNodeToolbar } from "@xyflow/react";
import type { ComponentProps } from "react";
import { Suspense } from "react";

import { lazyFlowPart } from "./_flow-lazy";

export type NodeToolbarProps = ComponentProps<typeof FlowNodeToolbar>;

/** React Flow lives behind a dynamic import — see `_flow-lazy.ts` and ADR 0019. */
const NodeToolbarImpl = lazyFlowPart<NodeToolbarProps>((m) => m.Toolbar);

/**
 * The floating control strip attached to a selected canvas NODE — it portals out
 * of the node and follows it, and it is meaningless outside a `<Canvas>`.
 *
 * Named `NodeToolbar` (after the React Flow primitive it wraps) because
 * `Toolbar` now means the general-purpose WAI-ARIA toolbar in
 * `@elabs/components-ui`: a keyboard row with a roving tabindex.
 * The two solve unrelated problems, and the collision made "use the Toolbar"
 * ambiguous at every call site.
 */
export const NodeToolbar = (props: NodeToolbarProps) => (
  // `NodeToolbar` only ever renders inside a `<Canvas>` (it portals out of the
  // node), so the engine chunk is already in cache; it is wrapped anyway because
  // it is independently barrel-exported.
  <Suspense fallback={null}>
    {/* The strip portals out of the node it belongs to, so it is nowhere near
        that node in the DOM — a stable selector is the only way a consumer or a
        test can find it. Overridable, like every other `data-slot`. */}
    <NodeToolbarImpl data-slot="node-toolbar" {...props} />
  </Suspense>
);

/**
 * @deprecated Renamed to {@link NodeToolbar}. `Toolbar` is now the WAI-ARIA
 * toolbar in `@elabs/components-ui`. This alias will be removed in
 * the next major.
 */
export const Toolbar = NodeToolbar;

/** @deprecated Renamed to {@link NodeToolbarProps}. */
export type ToolbarProps = NodeToolbarProps;
