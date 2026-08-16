"use client";

import type { Controls as ControlsPrimitive } from "@xyflow/react";
import type { ComponentProps } from "react";
import { Suspense } from "react";

import { lazyFlowPart } from "./_flow-lazy";

export type ControlsProps = ComponentProps<typeof ControlsPrimitive>;

/** React Flow lives behind a dynamic import — see `_flow-lazy.ts` and ADR 0019. */
const ControlsImpl = lazyFlowPart<ControlsProps>((m) => m.Controls);

export const Controls = (props: ControlsProps) => (
  // An overlay inside an already-loaded `<Canvas>`, so there is no box to
  // reserve — the engine chunk it needs is the one the canvas already fetched.
  <Suspense fallback={null}>
    <ControlsImpl {...props} />
  </Suspense>
);
