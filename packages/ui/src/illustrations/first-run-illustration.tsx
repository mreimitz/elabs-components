import { forwardRef } from "react";
import {
  illustrationSvgProps,
  IllustrationStage,
  type IllustrationProps,
} from "./illustration-base";

/**
 * First-run / onboarding state. A line-art planted flag with a `--primary`
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
        <IllustrationStage />
        <line x1="64" y1="112" x2="64" y2="46" />
        <path d="M64,46 L100,54 L86,64 L100,74 L64,82 Z" strokeLinejoin="round" />
        <line x1="46" y1="112" x2="90" y2="112" />
        <path
          d="M116,26 L119,36 L129,40 L119,44 L116,54 L113,44 L103,40 L113,36 Z"
          style={{ stroke: "var(--primary)" }}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
      </svg>
    );
  },
);
FirstRunIllustration.displayName = "FirstRunIllustration";
