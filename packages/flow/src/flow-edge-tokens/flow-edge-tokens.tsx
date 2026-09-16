"use client";

import { forwardRef, useMemo, type SVGProps } from "react";
import { useReducedMotion } from "@elabs-ai/components-tokens";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { createEdgePathSampler } from "./edge-path-sampler";

/** Default token radius, in px. */
export const DEFAULT_EDGE_TOKEN_RADIUS = 4;

export interface FlowEdgeToken {
  /** Stable identity (e.g. a case id). Keys the rendered marker, so a token keeps its element — and its transition — as it moves. */
  id: string;
  /** Position along the path's arc length: `0` = source end, `1` = target end. Clamped; a non-finite value sits at `0`. */
  progress: number;
  /** Marker radius in px — e.g. scaled by congestion. @default 4 */
  radius?: number;
}

export interface FlowEdgeTokensProps extends Omit<SVGProps<SVGGElement>, "ref" | "children"> {
  /** SVG path `d` the tokens travel along — the same string the edge draws. */
  path: string;
  /** Tokens to place. The parent owns `progress`; this part keeps no clock. */
  tokens: readonly FlowEdgeToken[];
}

/**
 * Markers ("tokens") placed along an edge's path — the presentational primitive
 * behind process replay. Each token is a circle at `progress` (0..1) of the
 * path's arc length.
 *
 * **Parent-driven, no internal clock.** Nothing here animates on its own: the
 * parent re-renders with new `progress` values (from a slider, a playback loop,
 * a play function). Position is a pure function of `(path, progress)` — see
 * `createEdgePathSampler` — so every render is deterministic and identical in
 * jsdom, on the server and in the browser.
 *
 * Between two renders a token glides with a short `duration-fast` transform
 * transition, so a parent stepping at a coarse rate still reads as motion. Under
 * reduced motion (`useReducedMotion()`: the ThemeProvider preference, else the
 * OS setting) the transition class is not rendered at all and a token jumps
 * straight to its new position; the `duration-fast` token also collapses to
 * `--motion-min` through the global motion gate (`data-motion-pref`).
 *
 * **Decorative to assistive technology.** The group is `aria-hidden` and ignores
 * pointer events: a moving dot has no stable meaning to announce. The consumer
 * owns the text alternative (a live case count, a summary). Colour is the one
 * `--primary` fill for every token, with a `--background` halo so a token stays
 * distinct from the edge stroke beneath it.
 *
 * Existing brand edges render this for you from `data.tokens`
 * (`FlowWeightedEdge`, `FlowSelfLoopEdge`); a custom edge renders it after its
 * `FlowEdgePath` with the same `path` string.
 */
export const FlowEdgeTokens = forwardRef<SVGGElement, FlowEdgeTokensProps>(function FlowEdgeTokens(
  { path, tokens, className, ...props },
  ref,
) {
  const reducedMotion = useReducedMotion();
  const sampler = useMemo(() => createEdgePathSampler(path), [path]);

  return (
    <g
      ref={ref}
      aria-hidden="true"
      data-slot="flow-edge-tokens"
      data-motion={reducedMotion ? "reduced" : "animated"}
      className={cn("pointer-events-none", className)}
      {...props}
    >
      {sampler
        ? tokens.map((token) => {
            const { x, y } = sampler.pointAt(token.progress);
            return (
              <circle
                key={token.id}
                data-slot="flow-edge-tokens-token"
                data-token-id={token.id}
                cx={0}
                cy={0}
                r={token.radius ?? DEFAULT_EDGE_TOKEN_RADIUS}
                strokeWidth={1.5}
                className={cn(
                  "fill-primary stroke-background",
                  !reducedMotion && "transition-transform duration-fast ease-standard",
                )}
                style={{ transform: `translate(${x}px, ${y}px)` }}
              />
            );
          })
        : null}
    </g>
  );
});
