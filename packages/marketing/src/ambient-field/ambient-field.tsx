import * as React from "react";
import { cn } from "@elabs-ai/components-ui";
import "./ambient-field.css";

/** Colour-role tokens an ambient stop or tint may reference (always `var(--<token>)`). */
export type AmbientToken =
  | "primary"
  | "accent"
  | `chart-${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12}`
  | "surface-1"
  | "surface-2"
  | "surface-3"
  | "info"
  | "success"
  | "warning"
  | "destructive";

/** Default mesh: the brand colour, the second chart hue, and the deepest surface. */
export const AMBIENT_DEFAULT_STOPS: readonly AmbientToken[] = ["primary", "chart-2", "surface-3"];

/** The ceiling for the mesh alpha — an ambient ground stays under content, never competes. */
export const AMBIENT_MAX_ALPHA = 0.18;

export interface AmbientFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Two or three colour tokens for the mesh; extra entries are ignored. */
  stops?: readonly AmbientToken[];
  /** Mesh alpha, clamped to 0…{@link AMBIENT_MAX_ALPHA}. Default 0.14. */
  alpha?: number;
  /** Run the slow 20 s drift (paused whenever the motion gate is at its floor). Default `true`. */
  drift?: boolean;
  /** Shift the first stop to this token (crossfades over `--t-base`); sets `data-ambient-tint`. */
  tint?: AmbientToken;
}

/**
 * A decorative ambient ground: a blurred radial mesh of token colours on a masked `::before`
 * layer, absolutely positioned under its container's content. Put it first inside a positioned,
 * `isolate` container. Pure CSS — renders the same on the server, animates only `transform`.
 */
export const AmbientField = React.forwardRef<HTMLDivElement, AmbientFieldProps>(
  (
    { stops = AMBIENT_DEFAULT_STOPS, alpha = 0.14, drift = true, tint, className, style, ...props },
    ref,
  ) => {
    const [a, b, c] = stops;
    const fieldStyle = {
      "--ambient-alpha": String(Math.min(AMBIENT_MAX_ALPHA, Math.max(0, alpha))),
      "--ambient-a": a ? `var(--${a})` : undefined,
      "--ambient-b": b ? `var(--${b})` : undefined,
      "--ambient-c": c ? `var(--${c})` : undefined,
      "--ambient-tint": tint ? `var(--${tint})` : undefined,
      ...style,
    } as React.CSSProperties;

    return (
      <div
        ref={ref}
        aria-hidden="true"
        data-slot="ambient-field"
        data-drift={drift ? "" : undefined}
        data-ambient-tint={tint}
        className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}
        style={fieldStyle}
        {...props}
      />
    );
  },
);
AmbientField.displayName = "AmbientField";
