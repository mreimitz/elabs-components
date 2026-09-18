/**
 * Marketing tour surface (RM-098, concept §4.2 "the page you are on, as a template"). Renders
 * the site's OWN `Hero` (RM-094, `components/hero/hero.tsx` — which already composes the trust
 * strip) at its real desktop width, scaled down to fit the frame with a CSS `transform`. No
 * duplicate nav: this is a miniature of the real section, not a second copy of its markup.
 *
 * Server-safe (no hooks) — the frame's `ssr: true` render path in `tour.tsx` imports this
 * directly, same as every other server tab.
 */
import { Hero } from "../../hero/hero";
import { tourSurfaceCopy } from "../../../content/copy";

export function MarketingSurface() {
  return (
    <div className="flex h-full flex-col" aria-label={tourSurfaceCopy.marketing.demoLabel}>
      <div className="min-h-0 flex-1 overflow-hidden bg-background">
        {/* Locks the real desktop layout (`Hero`'s own `max-w-7xl`) regardless of the frame's
            actual width, then shrinks it visually — so mobile widths still show the full
            marketing composition rather than its stacked mobile layout. */}
        <div className="h-full w-[1280px] origin-top-left scale-50">
          <Hero />
        </div>
      </div>
      <p className="border-t p-4 text-center text-body text-muted-foreground">
        {tourSurfaceCopy.marketing.caption}
      </p>
    </div>
  );
}
