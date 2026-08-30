import { forwardRef } from "react";
import {
  illustrationSvgProps,
  illustrationAccent,
  type IllustrationProps,
} from "./illustration-base";

/**
 * First-run / onboarding state. A line-art planted flag with a `--primary-text`
 * sparkle — reads as "start here", distinct in silhouette from `SuccessIllustration`.
 */
export const FirstRunIllustration = forwardRef<SVGSVGElement, IllustrationProps>(
  function FirstRunIllustration({ size, className, ...props }, ref) {
    return (
      <svg
        ref={ref}
        {...illustrationSvgProps(size, className)}
        data-slot="first-run-illustration"
        {...props}
      >
        <line x1="64" y1="122" x2="64" y2="46" />
        <path d="M64,46 L100,54 L86,64 L100,74 L64,82 Z" strokeLinejoin="round" />
        <line x1="36" y1="122" x2="90" y2="122" />
        <path
          d="M114,32.1 L116.6,40.6 L125.1,44 L116.6,47.4 L114,55.9 L111.5,47.4 L103,44 L111.5,40.6 Z"
          style={{ stroke: illustrationAccent("var(--primary-text)") }}
          strokeWidth={3}
          strokeLinejoin="round"
        />
      </svg>
    );
  },
);
FirstRunIllustration.displayName = "FirstRunIllustration";
