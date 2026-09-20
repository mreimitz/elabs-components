import type { ReactNode } from "react";

const WIDTH = {
  "4xl": "max-w-4xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
} as const;

/**
 * PageBand — the header band of an inner page: the page's title block on a full-bleed offset
 * fill, structured by the library's corner stripes (`bg-hairline-stripes`), kept slighter here
 * than on the home hero (globals.css shortens their reach). It is the quiet sibling of the
 * hero: same ground language, no illustration.
 *
 * Full-bleed on the outside, the page's own column on the inside — pass the same `width` the
 * page body uses so the title lines up with the content under it.
 */
export function PageBand({
  children,
  width = "6xl",
}: {
  children: ReactNode;
  width?: keyof typeof WIDTH;
}) {
  return (
    <div data-slot="page-band" className="w-full bg-surface-muted bg-hairline-stripes">
      <div className={`mx-auto w-full px-6 pt-10 pb-8 ${WIDTH[width]}`}>{children}</div>
    </div>
  );
}
