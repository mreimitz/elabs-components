import { forwardRef } from "react";
import { illustrationSvgProps, type IllustrationProps } from "./illustration-base";

/**
 * Disconnected / no-network state. A line-art cloud crossed by a slash — the
 * universal "disabled/no signal" idiom — reads as "offline" on its own
 * silhouette. No accent mark, per the accent-semantics convention in
 * `illustration-base.tsx` (#48 finding 1).
 *
 * Redrawn for #24 fix round 1 (P1-4) — the previous cloud path's closing curve
 * left a visible hook/spur, and the dashed tether + falling node read as a
 * raindrop rather than a severed connection while pulling the ink centre 11.5
 * units below the shared stage centre.
 *
 * Redrawn again for #48 finding 4 — the two small rounded-rect "chain link"
 * fragments below the slash read as loose debris/dashes rather than a
 * "broken link" gesture. Removed rather than redrawn: the cloud+slash
 * silhouette already fully conveys "offline" without them (the same
 * reasoning that dropped the decorative accents from `EmptyListIllustration`/
 * `FirstRunIllustration`).
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
      </svg>
    );
  },
);
OfflineIllustration.displayName = "OfflineIllustration";
