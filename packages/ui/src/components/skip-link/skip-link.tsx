import { forwardRef, type ComponentProps } from "react";
import { cn } from "../../lib/cn";

export interface SkipLinkProps extends ComponentProps<"a"> {
  /** The id of the landmark to jump to. Defaults to "main-content". */
  targetId?: string;
}

/**
 * The first focusable element of an application: invisible until focused, then a
 * token-styled pill pinned to the top-start corner. Give the target element
 * `id={targetId}` and `tabIndex={-1}` so focus actually lands there.
 */
export const SkipLink = forwardRef<HTMLAnchorElement, SkipLinkProps>(function SkipLink(
  { targetId = "main-content", className, children, ...props },
  ref,
) {
  return (
    <a
      ref={ref}
      data-slot="skip-link"
      href={`#${targetId}`}
      className={cn(
        "sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:start-4 focus-visible:top-4 focus-visible:z-50",
        "focus-visible:rounded-md focus-visible:bg-card focus-visible:px-3 focus-visible:py-2 focus-visible:text-body focus-visible:text-foreground focus-visible:shadow-ring-md",
        "focus-ring",
        className,
      )}
      {...props}
    >
      {children ?? "Skip to main content"}
    </a>
  );
});
