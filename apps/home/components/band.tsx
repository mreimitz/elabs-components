import type { ReactNode } from "react";

/**
 * Band — one full-bleed row of the home page, framed by the library's hairline rails
 * (`hairline-rails`, `@elabs-ai/components-tokens`): a dashed rail down each edge of the 80rem
 * content column and a dashed rule across the viewport where two bands meet. The sections
 * themselves stay centred `max-w-7xl` columns; the band is the full-width box the rails need.
 * Consecutive bands rule their shared seam once (the utility drops a following band's top rule).
 */
export function Band({ children }: { children: ReactNode }) {
  return (
    <div data-slot="band" className="hairline-rails">
      {children}
    </div>
  );
}
