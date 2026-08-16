/**
 * `ModelPicker`'s two state decisions, kept OUT of the component on purpose.
 *
 * Both were inline ternaries in the consuming app this component came from, and
 * both survived every mutation thrown at them — because no test could reach an
 * expression buried in JSX. As exported pure functions they are directly
 * testable, which is the whole reason they live in their own module.
 */

/** What the picker knows about the list it was handed. */
export type ModelPickerStatus = "idle" | "loading" | "ready" | "stale" | "error" | "empty";

/** Which of the four mutually-exclusive bodies the popover renders. */
export type ModelPickerBody = "loading" | "list" | "error" | "empty";

/**
 * Pick the body.
 *
 * **A non-empty list always wins.** A failed refresh over usable stale data is an
 * inline strip above a working list (see `showsInlineError`), never a takeover —
 * collapsing "stale list + error" into "error panel" throws away a list the user
 * could still have picked from.
 */
export function modelPickerBody(status: ModelPickerStatus, itemCount: number): ModelPickerBody {
  if (itemCount > 0) return "list";
  if (status === "loading" || status === "idle") return "loading";
  if (status === "error" || status === "stale") return "error";
  return "empty";
}

/**
 * Whether to show the error line ABOVE a list that still works — i.e. the
 * refresh failed but there is stale data worth keeping on screen.
 */
export function showsInlineError(status: ModelPickerStatus, itemCount: number): boolean {
  return itemCount > 0 && (status === "stale" || status === "error");
}

/** One selectable row. */
export interface ModelPickerItem {
  id: string;
  label: string;
  /** Muted second line. */
  description?: string;
  /**
   * Extra strings cmdk should MATCH on without displaying — ids, a space or
   * workspace name. This is what lets a search for "northwind" find a target
   * whose visible label never says it.
   */
  keywords?: string[];
  /**
   * Leading glyph. A ReactNode, never a URL: a renderer with no remote origins
   * cannot fetch a logo, so the caller supplies a bundled node.
   */
  icon?: React.ReactNode;
  /**
   * Trailing muted badges ("not provisioned", "no modes").
   *
   * Deliberately a caller-supplied ARRAY rather than derived from flags. A
   * three-valued flag where absent means "undecided" renders as "not enabled"
   * the moment a component computes the badge from `!flag` — which mislabels
   * every row on a deployment that simply never probed. Keeping this a list the
   * caller builds means the library cannot get that wrong on their behalf.
   */
  meta?: string[];
  /** Disable this row without removing it. */
  disabled?: boolean;
}

/** A titled group of rows. */
export interface ModelPickerGroup {
  key: string;
  /**
   * Rendered verbatim as the group heading. The CALLER derives it (`Apps ·
   * northwind`, `Assistants · personal`) — the library never invents grouping or
   * heading text from the data.
   */
  label: string;
  items: ModelPickerItem[];
}

/** Total rows across all groups. */
export function countItems(groups: readonly ModelPickerGroup[]): number {
  return groups.reduce((n, g) => n + g.items.length, 0);
}
