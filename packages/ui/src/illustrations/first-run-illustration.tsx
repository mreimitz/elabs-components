import { forwardRef } from "react";
import { illustrationSvgProps, type IllustrationProps } from "./illustration-base";

/**
 * First-run / onboarding state. A line-art planted flag — reads as "start
 * here" on its own silhouette, distinct from `SuccessIllustration`. No
 * accent mark, per the accent-semantics convention in `illustration-base.tsx`
 * (#48 finding 1): a decorative sparkle here would repeat information the
 * flag already supplies, not add any.
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
      </svg>
    );
  },
);
FirstRunIllustration.displayName = "FirstRunIllustration";
