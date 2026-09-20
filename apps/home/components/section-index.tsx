import { galleryCopy } from "../content/copy";

type IndexLabel = (typeof galleryCopy.index)[number];

/**
 * SectionIndex — the running number above a home section's title: `01 / Templates`, set in the
 * mono face like a sheet number on a drawing. It goes in `SectionHeader`'s `eyebrow`; the number
 * is the label's position in `galleryCopy.index`, so reordering the page renumbers it.
 */
export function SectionIndex({ label }: { label: IndexLabel }) {
  const n = galleryCopy.index.indexOf(label) + 1;
  return (
    <span className="font-mono tabular-nums">
      {String(n).padStart(2, "0")} / {label}
    </span>
  );
}
