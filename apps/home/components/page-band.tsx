import type { ReactNode } from "react";
import { CategoryArt, type CategoryArtName } from "./art/category-art";

const WIDTH = {
  "4xl": "max-w-4xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
} as const;

/**
 * PageBand — the header band of an inner page: the page's title block on a full-bleed offset
 * fill, structured by the library's corner stripes (`bg-hairline-stripes`), kept slighter here
 * than on the home hero (globals.css shortens their reach). It is the quiet sibling of the
 * hero: same ground language, and — for a catalogue category — a small drawing of its own.
 *
 * `art` names that drawing (`components/art/category-art.tsx`): the hero's isometric language at
 * a fraction of the size, one per category, at the end of the band from `lg` up. The title block
 * keeps clear of it; below `lg` the band is the title alone.
 *
 * Full-bleed on the outside, the page's own column on the inside — pass the same `width` the
 * page body uses so the title lines up with the content under it.
 */
export function PageBand({
  children,
  width = "6xl",
  art,
}: {
  children: ReactNode;
  width?: keyof typeof WIDTH;
  art?: CategoryArtName;
}) {
  return (
    <div data-slot="page-band" className="w-full bg-surface-muted bg-hairline-stripes">
      <div
        className={`relative mx-auto flex w-full items-center gap-10 px-6 pt-10 pb-8 ${WIDTH[width]}`}
      >
        <div className="min-w-0 flex-1">{children}</div>
        {art ? (
          <CategoryArt name={art} className="-my-4 hidden w-56 shrink-0 lg:block xl:w-64" />
        ) : null}
      </div>
    </div>
  );
}
