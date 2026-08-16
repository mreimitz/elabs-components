"use client";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import type { ComponentProps } from "react";
import { Suspense } from "react";

import { lazyFlowPart } from "./_flow-lazy";

export type NodeProps = ComponentProps<typeof Card> & {
  handles: {
    target: boolean;
    source: boolean;
  };
};

/**
 * React Flow lives behind a dynamic import — see `_flow-lazy.ts` and ADR 0019.
 * The WHOLE node (card + handles) is behind the boundary rather than just the
 * two `<Handle>`s: React Flow re-reads a node's handle bounds when its measured
 * box changes, so handles appearing inside an already-measured card could leave
 * the bounds stale. Going 0 → full size guarantees the re-measure.
 */
const NodeImpl = lazyFlowPart<NodeProps>((m) => m.Node);

export const Node = (props: NodeProps) => (
  <Suspense fallback={null}>
    <NodeImpl {...props} />
  </Suspense>
);

export type NodeHeaderProps = ComponentProps<typeof CardHeader>;

export const NodeHeader = ({ className, ...props }: NodeHeaderProps) => (
  <CardHeader
    className={cn("gap-0.5 rounded-t-md border-b bg-secondary p-3!", className)}
    {...props}
  />
);

export type NodeTitleProps = ComponentProps<typeof CardTitle>;

export const NodeTitle = (props: NodeTitleProps) => <CardTitle {...props} />;

export type NodeDescriptionProps = ComponentProps<typeof CardDescription>;

export const NodeDescription = (props: NodeDescriptionProps) => <CardDescription {...props} />;

export type NodeActionProps = ComponentProps<typeof CardAction>;

export const NodeAction = (props: NodeActionProps) => <CardAction {...props} />;

export type NodeContentProps = ComponentProps<typeof CardContent>;

export const NodeContent = ({ className, ...props }: NodeContentProps) => (
  <CardContent className={cn("p-3", className)} {...props} />
);

export type NodeFooterProps = ComponentProps<typeof CardFooter>;

export const NodeFooter = ({ className, ...props }: NodeFooterProps) => (
  <CardFooter className={cn("rounded-b-md border-t bg-secondary p-3!", className)} {...props} />
);
