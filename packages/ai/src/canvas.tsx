"use client";

import { Skeleton } from "@elabs/components-ui";
import { cn } from "@elabs/components-ui/lib/cn";
import type { ReactFlowProps } from "@xyflow/react";
import type { ReactNode } from "react";
import { Suspense } from "react";

import { lazyFlowPart } from "./_flow-lazy";

export type CanvasProps = ReactFlowProps & {
  children?: ReactNode;
};

/**
 * React Flow — and its stylesheet — is reached through a dynamic import: it
 * declares no `sideEffects`, so a static import would put the whole engine in
 * every consumer's entry chunk, a canvas rendered or not. `ReactFlowProps` above
 * is a TYPE import and erases. See ADR 0019 and `pnpm heavy-deps:check`.
 */
const CanvasImpl = lazyFlowPart<CanvasProps>((m) => m.Canvas);

export const Canvas = ({ className, ...props }: CanvasProps) => (
  // The canvas fills the box its parent gives it, so the skeleton reserves the
  // same space and the engine chunk arrives without a layout shift.
  <Suspense fallback={<Skeleton className={cn("size-full", className)} />}>
    <CanvasImpl className={className} {...props} />
  </Suspense>
);
