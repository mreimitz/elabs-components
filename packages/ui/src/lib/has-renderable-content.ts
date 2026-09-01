import { Children, type ReactNode } from "react";

/**
 * Whether `node` has any renderable content. `{condition && "message"}` is
 * the ordinary React idiom for optional content, and `condition === false`
 * must render nothing — a `false`/`0`/`""`/`null`/`undefined` value is "no
 * content", not an empty paragraph/alert. `Boolean(node)` alone is not
 * enough: an array is always truthy, so `{errors.map(...)}` on an empty list
 * (or `[a && "x", b && "y"]` with both false) would still count as content.
 * `Children.toArray` drops `null`/`undefined`/booleans from an array but
 * KEEPS `""` (and `0`), so an array like `["", ""]` would still slip through
 * as "content" without the trailing `.filter(Boolean)` — filtering after
 * `toArray` is what makes this match the scalar check for every array shape,
 * not just the ones `toArray` already prunes.
 *
 * Shared by `FieldDescription`/`FieldError` (`../components/field/field.tsx`)
 * and `FieldRow` (`../components/field-row/field-row.tsx`) — extracted so a
 * fix to the predicate reaches every caller instead of drifting between
 * hand-duplicated copies, which is exactly how `FieldRow` ended up with the
 * weaker, bare-truthiness version of this check for two rounds of `Field*`
 * fixes (#93).
 *
 * **Known limit:** a `node` that is itself a component returning `null` (or
 * an empty fragment) is not knowable from the element before render — a
 * React element is always truthy, whatever the component it names will
 * return, so this function reports `true` for it. That limit is documented
 * on `FieldDescription`/`FieldError`/`FieldRow`'s own JSDoc; it is not, and
 * cannot be, fixed here.
 */
export function hasRenderableContent(node: ReactNode): boolean {
  return Boolean(node) && Children.toArray(node).filter(Boolean).length > 0;
}
