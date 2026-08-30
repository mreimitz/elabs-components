import { forwardRef } from "react";
import {
  illustrationSvgProps,
  IllustrationStage,
  type IllustrationProps,
} from "./illustration-base";

/**
 * Completed / positive-outcome state. A line-art ring with a `--primary`
 * checkmark and three small radiating ticks for a light celebratory read.
 */
export const SuccessIllustration = forwardRef<SVGSVGElement, IllustrationProps>(
  function SuccessIllustration({ size, className, ...props }, ref) {
    return (
      <svg
        ref={ref}
        {...illustrationSvgProps(size, className)}
        data-slot="success-illustration"
        {...props}
      >
        <IllustrationStage />
        <circle cx="80" cy="78" r="34" />
        <path d="M64,80 L76,92 L98,64" style={{ stroke: "var(--primary)" }} strokeWidth={6} />
        <line x1="80" y1="38" x2="80" y2="30" strokeWidth={3} />
        <line x1="112" y1="44" x2="118" y2="38" strokeWidth={3} />
        <line x1="48" y1="44" x2="42" y2="38" strokeWidth={3} />
      </svg>
    );
  },
);
SuccessIllustration.displayName = "SuccessIllustration";
