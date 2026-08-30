import { forwardRef } from "react";
import {
  illustrationSvgProps,
  illustrationAccent,
  type IllustrationProps,
} from "./illustration-base";

/**
 * Recoverable-failure state. A line-art document split into two halves with a
 * visible gap between them — distinguishable from `NoAccessIllustration`/
 * `OfflineIllustration` by silhouette alone (a split document reads as
 * "broken" even in greyscale), per the WCAG 1.4.1 "never color-only" rule. A
 * bold `--destructive` mark sits in the gap as a supplemental (not load-bearing)
 * cue.
 *
 * Redrawn for #24 fix round 1 (P1-3) — the previous cracked-card + tiny alert
 * triangle read as a lightning bolt or a broken-image placeholder and the
 * triangle's exclamation collapsed to an illegible blob at 4rem.
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
        <path d="M36,32 L83.06,32 L71.29,55.16 L92.47,69.06 L66.59,92.24 L76,120 L36,120 Z" />
        <path d="M124,36 L124,124 L84,124 L74.59,96.24 L100.47,73.06 L79.29,59.16 L91.06,36 Z" />
        <rect
          x="76"
          y="54"
          width="8"
          height="26"
          rx="4"
          style={{ fill: illustrationAccent("var(--destructive)") }}
          stroke="none"
        />
        <circle
          cx="80"
          cy="90"
          r="5"
          style={{ fill: illustrationAccent("var(--destructive)") }}
          stroke="none"
        />
      </svg>
    );
  },
);
ErrorIllustration.displayName = "ErrorIllustration";
