import { forwardRef } from "react";
import {
  illustrationSvgProps,
  IllustrationStage,
  type IllustrationProps,
} from "./illustration-base";

/**
 * Permission / access-denied state. A line-art padlock with a `--primary`
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
        <IllustrationStage />
        <path d="M60,74 V56 A20,18 0 0 1 100,56 V74" />
        <rect x="52" y="74" width="56" height="44" rx="8" />
        <circle cx="80" cy="93" r="5" style={{ stroke: "var(--primary)" }} strokeWidth={3} />
        <rect
          x="77"
          y="98"
          width="6"
          height="10"
          rx="2"
          style={{ stroke: "var(--primary)" }}
          strokeWidth={3}
        />
      </svg>
    );
  },
);
NoAccessIllustration.displayName = "NoAccessIllustration";
