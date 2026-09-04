"use client";

/**
 * network-link — the edge marks of `NetworkChart` (RM-036).
 *
 * `NetworkLink` is a pure, `React.memo`-comparable `<path>`: no context read, no
 * callbacks, only data props. `NetworkLinks` is the one component that reads the
 * provider and maps over the layout, so an emphasis change re-renders one mapper
 * plus only those paths whose `dimmed` flag actually flipped.
 */

import { memo } from "react";
import { cn } from "@elabs-ai/components-ui";
import { useNetworkChart } from "./network-context";
import { isLinkDimmed } from "./network-layout";
import type { NetworkLinkLayout } from "./network-types";

/**
 * Resting / blurred edge opacity, as the Tailwind classes that carry them.
 *
 * Both rungs are CLASSES rather than an `opacity` presentation attribute so the
 * two never fight for the cascade, and so the emphasis transition is a pure
 * compositor job. `0.35` at rest keeps edges as context rather than subject;
 * `0.03` is lieflat B1's blur floor — present, but not competing.
 */
export const NETWORK_LINK_OPACITY_CLASS = "opacity-[0.35]";
export const NETWORK_LINK_DIM_CLASS = "opacity-[0.03]";

export interface NetworkLinkProps {
  link: NetworkLinkLayout;
  /** Blurred because an adjacency emphasis is active elsewhere. */
  dimmed: boolean;
}

/**
 * One edge.
 *
 * The blur is `opacity-[0.03]` — a CLASS, so the browser transitions it on the
 * compositor and no React state is recomputed per frame. `motion-reduce:` drops
 * the transition entirely (the end state is unchanged; only the fade goes).
 */
export const NetworkLink = memo(function NetworkLink({ link, dimmed }: NetworkLinkProps) {
  return (
    <path
      className={cn(
        "transition-opacity duration-fast ease-standard motion-reduce:transition-none",
        dimmed ? NETWORK_LINK_DIM_CLASS : NETWORK_LINK_OPACITY_CLASS,
      )}
      d={link.path}
      data-network-link-id={link.id}
      data-slot="network-link"
      fill="none"
      stroke="var(--chart-grid)"
      strokeLinecap="round"
      strokeWidth={link.width}
    />
  );
});

/** Every edge of the chart, in input order. Reads the provider. */
export function NetworkLinks() {
  const { layout, activeId, emphasis } = useNetworkChart();
  return (
    <g data-slot="network-links">
      {layout.links.map((link) => (
        <NetworkLink dimmed={isLinkDimmed(link, activeId, emphasis)} key={link.id} link={link} />
      ))}
    </g>
  );
}
