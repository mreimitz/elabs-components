import type { ReactNode } from "react";

/** The page column the rails hug — the same `max-w-*` the content inside the band uses. */
export type BandWidth = "4xl" | "6xl" | "7xl";

/**
 * Band — one full-bleed row of a page, framed by the library's hairline rails
 * (`hairline-rails`, `@elabs-ai/components-tokens`): a dashed rail down each edge of the content
 * column and a dashed rule where two bands meet, inked only near the corners, with a
 * registration cross on each. The sections themselves stay centred columns; the band is the
 * full-width box the rails need. Consecutive bands rule their shared seam once.
 *
 * `width` names the column inside (`7xl` = the 80rem default; globals.css maps the others onto
 * `--hairline-rail-width`), so the rails land on the column's edges on every page.
 */
export function Band({ children, width = "7xl" }: { children: ReactNode; width?: BandWidth }) {
  return (
    <div data-slot="band" data-width={width} className="hairline-rails">
      {children}
    </div>
  );
}
