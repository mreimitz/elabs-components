import { forwardRef } from "react";
import {
  illustrationSvgProps,
  illustrationAccent,
  type IllustrationProps,
} from "./illustration-base";

/**
 * Permission / access-denied state. A line-art padlock with a `--primary-text`
 * keyhole — reads as "restricted", not "broken".
 */
export const NoAccessIllustration = forwardRef<SVGSVGElement, IllustrationProps>(
  function NoAccessIllustration({ size, className, ...props }, ref) {
    return (
      <svg
        ref={ref}
        {...illustrationSvgProps(size, className)}
        data-slot="no-access-illustration"
        {...props}
      >
        <path d="M50,72 V52 A30,20 0 0 1 110,52 V72" />
        <rect x="36" y="72" width="88" height="48" rx="10" />
        <circle
          cx="80"
          cy="92"
          r="6"
          style={{ stroke: illustrationAccent("var(--primary-text)") }}
          strokeWidth={3}
        />
        <rect
          x="77"
          y="98"
          width="6"
          height="12"
          rx="2"
          style={{ stroke: illustrationAccent("var(--primary-text)") }}
          strokeWidth={3}
        />
      </svg>
    );
  },
);
NoAccessIllustration.displayName = "NoAccessIllustration";
