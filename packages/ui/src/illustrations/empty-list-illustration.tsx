import { forwardRef } from "react";
import { illustrationSvgProps, type IllustrationProps } from "./illustration-base";

/**
 * Empty list / zero-data-yet state. Three line-art rows read as "empty list"
 * on their own silhouette — no accent mark, per the accent-semantics
 * convention in `illustration-base.tsx` (#48 finding 1): a floating "add"
 * badge here would repeat information the rows already supply, not add any.
 */
export const EmptyListIllustration = forwardRef<SVGSVGElement, IllustrationProps>(
  function EmptyListIllustration({ size, className, ...props }, ref) {
    return (
      <svg
        ref={ref}
        {...illustrationSvgProps(size, className)}
        data-slot="empty-list-illustration"
        {...props}
      >
        <rect x="36" y="68" width="64" height="10" rx="5" />
        <rect x="36" y="90" width="64" height="10" rx="5" />
        <rect x="36" y="112" width="44" height="10" rx="5" />
      </svg>
    );
  },
);
EmptyListIllustration.displayName = "EmptyListIllustration";
