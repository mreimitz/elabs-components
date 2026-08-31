import { forwardRef } from "react";
import {
  illustrationSvgProps,
  illustrationAccent,
  type IllustrationProps,
} from "./illustration-base";

/**
 * Search / filter with zero matches. A line-art magnifying glass with a
 * `--primary-text` "×" inside the lens standing in for "nothing matched".
 * The "×" is meaning-bearing (per the accent-semantics convention in
 * `illustration-base.tsx`, #48 finding 1) — a bare magnifying glass alone
 * reads as "search", not "no results".
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
        <circle cx="68" cy="66" r="30" />
        <line x1="89.2" y1="87.2" x2="124" y2="122" />
        <line
          x1="56"
          y1="54"
          x2="80"
          y2="78"
          style={{ stroke: illustrationAccent("var(--primary-text)") }}
          strokeWidth={3}
        />
        <line
          x1="80"
          y1="54"
          x2="56"
          y2="78"
          style={{ stroke: illustrationAccent("var(--primary-text)") }}
          strokeWidth={3}
        />
      </svg>
    );
  },
);
NoResultsIllustration.displayName = "NoResultsIllustration";
