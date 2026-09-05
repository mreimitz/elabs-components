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
 * compositor job.
 *
 * **The resting rung is FULL opacity, and that is the contract, not a tuning
 * choice.** Edges paint `--chart-grid`, the one furniture ink, which is already
 * tuned to survive being drawn as a sub-pixel stroke. Multiplying it here is
 * what made this chart's edges invisible: at the old `0.35` a 0.6px edge
 * deposited ~21% of the token and measured 1.07:1 against a white card. Chart
 * furniture recedes by being a quiet TOKEN, never by being a fraction of a
 * louder one — see `chart-hairline.ts`.
 *
 * `0.03` is the blur floor, and it is the one sanctioned exception because it is
 * a TRANSIENT emphasis state, not a resting appearance: present, but not
 * competing with the adjacency the user is inspecting.
 */
export const NETWORK_LINK_OPACITY_CLASS = "opacity-100";
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
 *
 * `link.width` scales UP from `CHART_HAIRLINE_WIDTH` with the edge's value: the
 * weight is DATA here, so it is the one furniture stroke allowed to vary. The
 * ink is not — every edge paints the same `--chart-grid` at full opacity.
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
