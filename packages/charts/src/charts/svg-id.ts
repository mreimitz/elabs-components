import { useId } from "react";

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

/**
 * A per-instance id safe to use inside an SVG `id` / `url(#…)` reference — React's
 * `useId()` with its colons stripped (`:r0:` breaks a `url(#…)` lookup the same way a
 * space does). One hook for every chart mark that scopes a `<pattern>`/`<clipPath>` id
 * to its own instance, so two of the same chart on one page never collide.
 */
export function useSvgId(): string {
  return useId().replace(/:/g, "");
}
