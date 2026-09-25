import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@elabs-ai/components-ui/lib/cn";

/** One verifiable fact and the page that proves it. */
export interface TrustFact {
  /** Stable key. */
  id: string;
  /** The fact as shown, e.g. "13 packages" — pass generated values, never hand-typed numbers. */
  label: ReactNode;
  /**
   * Where the fact is proven (npm, the repository, a Storybook page). An http(s) href opens in a
   * new tab.
   */
  href: string;
}

export interface TrustStripProps extends HTMLAttributes<HTMLDivElement> {
  /** The facts, in reading order. */
  facts: TrustFact[];
  /**
   * Optional live counters (stars, downloads). Rendered only when passed, so a page can keep
   * them off until someone decides to show them; the host owns fetching and formatting.
   */
  counters?: ReactNode;
}

/**
 * A quiet row of checkable facts — version, package count, licence, test coverage — each a
 * link to its proof. Server-safe: no state, no effects; counters arrive through a slot.
 */
export const TrustStrip = forwardRef<HTMLDivElement, TrustStripProps>(function TrustStrip(
  { facts, counters, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      data-slot="trust-strip"
      className={cn("flex flex-wrap items-center gap-x-4 gap-y-2", className)}
      {...props}
    >
      <ul data-slot="trust-strip-facts" className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {facts.map((fact) => (
          <li key={fact.id} data-slot="trust-strip-fact">
            <a
              href={fact.href}
              {...(/^https?:\/\//.test(fact.href)
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
              className="rounded-sm text-meta text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-ring"
            >
              {fact.label}
            </a>
          </li>
        ))}
      </ul>
      {counters ? (
        <div data-slot="trust-strip-counters" className="flex items-center gap-x-4 text-meta">
          {counters}
        </div>
      ) : null}
    </div>
  );
});
