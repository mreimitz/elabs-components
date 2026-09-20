/**
 * A data key as it may appear inside an SVG `id` / `url(#…)` reference.
 *
 * Data keys are free text ("On time", "Cost per parcel, €"); an id with a space or a
 * bracket breaks the `url(#id)` lookup and the fill silently paints black. Every character
 * outside `[A-Za-z0-9_-]` becomes `_`, so a plain key stays byte-identical.
 */
export function svgIdPart(dataKey: string): string {
  return dataKey.replace(/[^\w-]/g, "_");
}
