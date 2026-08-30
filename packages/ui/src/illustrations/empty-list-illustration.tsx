import { forwardRef } from "react";
import {
  illustrationSvgProps,
  IllustrationStage,
  type IllustrationProps,
} from "./illustration-base";

/**
 * Empty list / zero-data-yet state. Three line-art rows with a `--primary`
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
        <IllustrationStage />
        <rect x="48" y="58" width="64" height="10" rx="5" />
        <rect x="48" y="76" width="64" height="10" rx="5" />
        <rect x="48" y="94" width="44" height="10" rx="5" />
        <circle cx="118" cy="50" r="10" style={{ stroke: "var(--primary)" }} strokeWidth={3} />
        <line
          x1="118"
          y1="45"
          x2="118"
          y2="55"
          style={{ stroke: "var(--primary)" }}
          strokeWidth={3}
        />
        <line
          x1="113"
          y1="50"
          x2="123"
          y2="50"
          style={{ stroke: "var(--primary)" }}
          strokeWidth={3}
        />
      </svg>
    );
  },
);
EmptyListIllustration.displayName = "EmptyListIllustration";
