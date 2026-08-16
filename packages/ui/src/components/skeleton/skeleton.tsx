import { type HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export type SkeletonProps = HTMLAttributes<HTMLDivElement>;

/** Loading placeholder. Compose with width/height utilities, e.g. `h-4 w-32`. */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      aria-hidden="true"
      {...props}
    />
  );
}
