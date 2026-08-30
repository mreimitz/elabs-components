import { forwardRef } from "react";
import {
  illustrationSvgProps,
  illustrationAccent,
  type IllustrationProps,
} from "./illustration-base";

/**
 * Empty list / zero-data-yet state. Three line-art rows with a `--primary-text`
 * "add" badge floating over the top row — invites the first item rather than
 * just showing absence.
 */
export const EmptyListIllustration = forwardRef<SVGSVGElement, IllustrationProps>(
  function EmptyListIllustration({ size, className, ...props }, ref) {
    return (
      <svg
        ref={ref}
        {...illustrationSvgProps(size, className)}
        data-slot="empty-list-illustration"
        {...props}
      >
        <rect x="36" y="68" width="64" height="10" rx="5" />
        <rect x="36" y="90" width="64" height="10" rx="5" />
        <rect x="36" y="112" width="44" height="10" rx="5" />
        <circle
          cx="112"
          cy="46"
          r="12"
          style={{ stroke: illustrationAccent("var(--primary-text)") }}
          strokeWidth={3}
        />
        <line
          x1="112"
          y1="40"
          x2="112"
          y2="52"
          style={{ stroke: illustrationAccent("var(--primary-text)") }}
          strokeWidth={3}
        />
        <line
          x1="106"
          y1="46"
          x2="118"
          y2="46"
          style={{ stroke: illustrationAccent("var(--primary-text)") }}
          strokeWidth={3}
        />
      </svg>
    );
  },
);
EmptyListIllustration.displayName = "EmptyListIllustration";
