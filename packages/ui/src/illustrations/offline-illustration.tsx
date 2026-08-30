import { forwardRef } from "react";
import {
  illustrationSvgProps,
  IllustrationStage,
  type IllustrationProps,
} from "./illustration-base";

/**
 * Disconnected / no-network state. A line-art cloud crossed by a slash, with a
 * `--primary` dashed tether to a disconnected node below it.
 */
export const OfflineIllustration = forwardRef<SVGSVGElement, IllustrationProps>(
  function OfflineIllustration({ size, className, ...props }, ref) {
    return (
      <svg
        ref={ref}
        {...illustrationSvgProps(size, className)}
        data-slot="offline-illustration"
        {...props}
      >
        <IllustrationStage />
        <path d="M46,86 C46,74 56,66 66,68 C68,56 82,50 92,58 C104,54 116,64 112,76 C118,80 116,90 108,90 H54 C48,90 44,90 46,86 Z" />
        <line x1="40" y1="100" x2="120" y2="52" strokeWidth={4} />
        <line
          x1="80"
          y1="100"
          x2="80"
          y2="116"
          style={{ stroke: "var(--primary)" }}
          strokeWidth={3}
          strokeDasharray="2 6"
        />
        <circle cx="80" cy="122" r="5" style={{ fill: "var(--primary)" }} stroke="none" />
      </svg>
    );
  },
);
OfflineIllustration.displayName = "OfflineIllustration";
