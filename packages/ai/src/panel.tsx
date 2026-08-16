"use client";

import type { Panel as PanelPrimitive } from "@xyflow/react";
import type { ComponentProps } from "react";
import { Suspense } from "react";

import { lazyFlowPart } from "./_flow-lazy";

export type PanelProps = ComponentProps<typeof PanelPrimitive>;

/** React Flow lives behind a dynamic import — see `_flow-lazy.ts` and ADR 0019. */
const PanelImpl = lazyFlowPart<PanelProps>((m) => m.Panel);

export const Panel = (props: PanelProps) => (
  // An overlay inside an already-loaded `<Canvas>`, so there is no box to
  // reserve — the engine chunk it needs is the one the canvas already fetched.
  <Suspense fallback={null}>
    <PanelImpl {...props} />
  </Suspense>
);
