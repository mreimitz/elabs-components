import { forwardRef } from "react";
import {
  illustrationSvgProps,
  illustrationAccent,
  type IllustrationProps,
} from "./illustration-base";

/**
 * Disconnected / no-network state. A line-art cloud crossed by a slash, with a
 * self-contained `--primary-text` "broken link" (two misaligned chain
 * fragments) instead of a dangling tether.
 *
 * Redrawn for #24 fix round 1 (P1-4) — the previous cloud path's closing curve
 * left a visible hook/spur, and the dashed tether + falling node read as a
 * raindrop rather than a severed connection while pulling the ink centre 11.5
 * units below the shared stage centre.
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
        <path d="M44.9,100.4 C44.9,83.6 56.4,72.4 67.9,75.2 C70.2,58.4 86.3,50 97.8,61.2 C111.6,55.6 125.4,69.6 120.8,86.4 C127.7,92 125.4,106 116.2,106 L54.1,106 C49.5,106 44.9,104.6 44.9,100.4 Z" />
        <line x1="36" y1="112" x2="124" y2="36" strokeWidth={4} />
        <rect
          x="56"
          y="104"
          width="16"
          height="9"
          rx="4.5"
          style={{ stroke: illustrationAccent("var(--primary-text)") }}
          strokeWidth={3}
        />
        <rect
          x="84"
          y="113"
          width="16"
          height="10"
          rx="5"
          style={{ stroke: illustrationAccent("var(--primary-text)") }}
          strokeWidth={3}
        />
      </svg>
    );
  },
);
OfflineIllustration.displayName = "OfflineIllustration";
