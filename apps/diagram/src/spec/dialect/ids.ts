/** Id grammar and the flow arrow. React-free. */

/** An id: letter or _, then letters, digits, _ or -; never ends in -. */
export const ID_SOURCE = "[A-Za-z_](?:[A-Za-z0-9_-]*[A-Za-z0-9_])?";
export const ID_RE = new RegExp(`^${ID_SOURCE}$`);

/** `a -> b`, `a <- b`, `a <-> b` (spaces optional). Groups: 1 from, 2 arrow, 3 to. */
export const ARROW_PATTERN = `^\\s*(${ID_SOURCE})\\s*(<->|->|<-)\\s*(${ID_SOURCE})\\s*$`;
/** With the `d` flag, so match.indices gives each id's offset inside the text (for line/col). */
export const ARROW_RE = new RegExp(ARROW_PATTERN, "d");

export const ARROW_DIRECTION = {
  "->": "forward",
  "<-": "back",
  "<->": "both",
} as const;
