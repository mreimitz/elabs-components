import type { LucideIcon } from "lucide-react";
import { Cable, Cog, Key, KeyRound, Lock, Shield } from "lucide-react";
import { MarkerType } from "@elabs-ai/components-flow";
import type { EdgeMarker } from "@xyflow/react";
import type {
  DataFlowEdgeData,
  FlowDirection,
  FlowKind,
  FlowLineStyle,
  FlowSecure,
} from "./data-flow-edge-data";

/**
 * Pure kind → look maps for `DataFlowEdge` (plan D12). React-free apart from the Lucide
 * glyph references, so the DG-10 compiler can import `edgeMarkers`/`edgeAriaLabel`
 * without rendering anything.
 *
 * Colour is never the only channel (WCAG 1.4.1). Per kind, the second channel is:
 * - `data`    — closed arrowhead, solid line
 * - `request` — open arrowhead
 * - `access`  — open arrowhead + a key glyph, always shown, and the strong stroke
 * - `control` — closed arrowhead + dotted line when no style is given + a cog glyph
 * - `network` — no arrowhead at all, `--border-strong` stroke
 */

/** SVG dash pattern per line style. */
export const DASH: Record<FlowLineStyle, string | undefined> = {
  solid: undefined,
  dashed: "6 4",
  dotted: "2 3",
};

/**
 * Dash of an animated SOLID flow — React Flow's own `.react-flow__edge.animated path`
 * value, so the marching pattern matches the engine's. Its period (5) divides the
 * `dashdraw` keyframe's 10-unit offset, so the loop is seamless; so do `dashed` (10)
 * and `dotted` (5).
 */
export const ANIMATED_SOLID_DASH = "5";

/** Arrowhead shape per kind; `network` has none. */
export const MARKER_TYPE: Record<FlowKind, MarkerType | undefined> = {
  data: MarkerType.ArrowClosed,
  request: MarkerType.Arrow,
  access: MarkerType.Arrow,
  control: MarkerType.ArrowClosed,
  network: undefined,
};

/**
 * Stroke paint per kind, as token references. `FlowEdgePath` paints its stroke as an
 * INLINE style (`flow-edge-path.tsx`, the `BaseEdge` `style` prop), so a `stroke-*`
 * utility class on the path is overridden and never shows — the paint has to go
 * through its `stroke` prop. Every token below exists in
 * `packages/tokens/src/themes.css` (`--flow-edge`, `--flow-edge-strong`, `--border-strong`).
 */
export const KIND_STROKE: Record<FlowKind, string> = {
  data: "var(--flow-edge)",
  request: "var(--flow-edge)",
  access: "var(--flow-edge-strong)",
  control: "var(--flow-edge)",
  network: "var(--border-strong)",
};

/** Glyph a kind always shows in its label cluster (its non-colour channel), if any. */
export const KIND_GLYPH: Partial<Record<FlowKind, LucideIcon>> = {
  access: KeyRound,
  control: Cog,
};

/** Glyph per `secure` value; `none` has none. */
export const SECURE_GLYPH: Record<Exclude<FlowSecure, "none">, LucideIcon> = {
  tls: Lock,
  vpn: Shield,
  "private-link": Cable,
  sso: Key,
};

/** Words for the accessible name — the glyphs are `aria-hidden`. */
export const SECURE_WORDS: Record<Exclude<FlowSecure, "none">, string> = {
  tls: "TLS",
  vpn: "VPN",
  "private-link": "Private Link",
  sso: "SSO",
};

/** Effective line style: explicit `style`, else `dotted` for `control`, else `solid`. */
export function resolveLineStyle(kind: FlowKind, style: FlowLineStyle | undefined): FlowLineStyle {
  return style ?? (kind === "control" ? "dotted" : "solid");
}

/** Dash to paint, given the effective style and whether the dashes march. */
export function resolveDash(lineStyle: FlowLineStyle, animated: boolean): string | undefined {
  return DASH[lineStyle] ?? (animated ? ANIMATED_SOLID_DASH : undefined);
}

/**
 * The `markerStart`/`markerEnd` EDGE-OBJECT fields for a flow. React Flow builds the
 * `<marker>` defs — and the `url(#…)` strings `DataFlowEdge` receives as
 * `props.markerStart`/`props.markerEnd` — from these objects, never from the edge
 * component, so the compiler (DG-10) and the gallery fixture both spread this into the
 * edge. The marker `color` is the kind's stroke TOKEN reference: React Flow writes it as
 * an inline `style.stroke`/`style.fill` on the marker's polyline, where `var(--…)`
 * resolves against the theme. Without it React Flow falls back to its
 * `defaultMarkerColor` prop, a literal grey that follows no theme.
 */
export function edgeMarkers(
  kind: FlowKind = "data",
  direction: FlowDirection = "forward",
): { markerStart?: EdgeMarker; markerEnd?: EdgeMarker } {
  const type = MARKER_TYPE[kind];
  if (!type) return {};
  const marker: EdgeMarker = { type, color: KIND_STROKE[kind] };
  return {
    ...(direction !== "back" ? { markerEnd: marker } : null),
    ...(direction !== "forward" ? { markerStart: marker } : null),
  };
}

/**
 * The edge's accessible name, for the edge object's `ariaLabel` (React Flow puts it on
 * the focusable `g.react-flow__edge`). Carries every channel the picture carries —
 * kind, direction, security, protocol, schedule, step — as words.
 */
export function edgeAriaLabel(source: string, target: string, data: DataFlowEdgeData = {}): string {
  const kind = data.kind ?? "data";
  const direction = data.direction ?? "forward";
  const arrow =
    direction === "both"
      ? `between ${source} and ${target}`
      : direction === "back"
        ? `from ${target} to ${source}`
        : `from ${source} to ${target}`;
  const parts = [
    data.step !== undefined ? `Step ${data.step}` : undefined,
    `${kind} flow ${arrow}`,
    data.label,
    data.protocol,
    data.secure && data.secure !== "none" ? `secured by ${SECURE_WORDS[data.secure]}` : undefined,
    data.schedule,
  ];
  return parts.filter(Boolean).join(", ");
}
