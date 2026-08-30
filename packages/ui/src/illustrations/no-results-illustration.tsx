import { forwardRef } from "react";
import {
  illustrationSvgProps,
  IllustrationStage,
  type IllustrationProps,
} from "./illustration-base";

/**
 * Search / filter with zero matches. A line-art magnifying glass with a
 * `--primary` "×" inside the lens standing in for "nothing matched".
 */
export const NoResultsIllustration = forwardRef<SVGSVGElement, IllustrationProps>(
  function NoResultsIllustration({ size, className, ...props }, ref) {
    return (
      <svg
        ref={ref}
        {...illustrationSvgProps(size, className)}
        data-slot="no-results-illustration"
        {...props}
      >
        <IllustrationStage />
        <circle cx="68" cy="70" r="22" />
        <line x1="84" y1="86" x2="104" y2="106" />
        <line
          x1="58"
          y1="60"
          x2="78"
          y2="80"
          style={{ stroke: "var(--primary)" }}
          strokeWidth={3}
        />
        <line
          x1="78"
          y1="60"
          x2="58"
          y2="80"
          style={{ stroke: "var(--primary)" }}
          strokeWidth={3}
        />
      </svg>
    );
  },
);
NoResultsIllustration.displayName = "NoResultsIllustration";
