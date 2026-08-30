import { forwardRef } from "react";
import {
  illustrationSvgProps,
  IllustrationStage,
  type IllustrationProps,
} from "./illustration-base";

/**
 * Recoverable-failure state. A line-art cracked card with a small `--primary`
 * alert badge — distinguishable from `NoAccessIllustration`/`OfflineIllustration`
 * by shape alone, not color, per the WCAG 1.4.1 "never color-only" rule.
 */
export const ErrorIllustration = forwardRef<SVGSVGElement, IllustrationProps>(
  function ErrorIllustration({ size, className, ...props }, ref) {
    return (
      <svg
        ref={ref}
        {...illustrationSvgProps(size, className)}
        data-slot="error-illustration"
        {...props}
      >
        <IllustrationStage />
        <rect x="44" y="40" width="72" height="72" rx="12" />
        <path d="M80,40 L72,64 L88,76 L68,100 L80,112" strokeWidth={3} />
        <path
          d="M104,26 L114,44 L94,44 Z"
          style={{ stroke: "var(--primary)" }}
          strokeWidth={3}
          strokeLinejoin="round"
        />
        <line
          x1="104"
          y1="32"
          x2="104"
          y2="38"
          style={{ stroke: "var(--primary)" }}
          strokeWidth={3}
        />
        <circle cx="104" cy="41.5" r="1.5" style={{ fill: "var(--primary)" }} stroke="none" />
      </svg>
    );
  },
);
ErrorIllustration.displayName = "ErrorIllustration";
