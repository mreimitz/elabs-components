"use client";

import type { EdgeProps } from "@xyflow/react";
import { Suspense } from "react";

import { lazyFlowPart } from "./_flow-lazy";

/**
 * React Flow lives behind a dynamic import — see `_flow-lazy.ts` and ADR 0019.
 * `EdgeProps` above is a TYPE import and erases.
 */
const AnimatedImpl = lazyFlowPart<EdgeProps>((m) => m.EdgeAnimated);
const TemporaryImpl = lazyFlowPart<EdgeProps>((m) => m.EdgeTemporary);

// Edges render inside React Flow's `<svg>`, so the fallback must be `null` —
// there is no box to reserve, and the engine chunk is the one the surrounding
// `<Canvas>` already fetched.
const Animated = (props: EdgeProps) => (
  <Suspense fallback={null}>
    <AnimatedImpl {...props} />
  </Suspense>
);

const Temporary = (props: EdgeProps) => (
  <Suspense fallback={null}>
    <TemporaryImpl {...props} />
  </Suspense>
);

export const Edge = {
  Animated,
  Temporary,
};
