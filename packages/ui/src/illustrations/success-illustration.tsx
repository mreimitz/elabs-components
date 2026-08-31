import { forwardRef } from "react";
import {
  illustrationSvgProps,
  illustrationAccent,
  type IllustrationProps,
} from "./illustration-base";

/**
 * Completed / positive-outcome state. A line-art ring with a `--success-text`
 * checkmark — a ring + check needs no rays. The checkmark is meaning-bearing
 * (per the accent-semantics convention in `illustration-base.tsx`, #48
 * finding 1) — a bare ring alone carries no state at all.
 *
 * Redrawn for #24 fix round 1 (P0-1, P1-4) — the checkmark previously used
 * `--primary` (re-creating the "success chips read as primary" confusion #334
 * removed from the tokens) at `strokeWidth={6}` (off the shared accent-weight
 * rule), and the three radiating ticks straddled the now-removed dashed stage
 * (two crossed it, one didn't), reading as a clock/sun rather than a
 * celebration.
 */
export const SuccessIllustration = forwardRef<SVGSVGElement, IllustrationProps>(
  function SuccessIllustration({ size, className, ...props }, ref) {
    return (
      <svg
        ref={ref}
        {...illustrationSvgProps(size, className)}
        data-slot="success-illustration"
        {...props}
      >
        <circle cx="80" cy="78" r="44" />
        <path
          d="M59,81 L75,96 L103,60"
          style={{ stroke: illustrationAccent("var(--success-text)") }}
          strokeWidth={3}
        />
      </svg>
    );
  },
);
SuccessIllustration.displayName = "SuccessIllustration";
