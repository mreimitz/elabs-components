import type { ForwardedRef } from "react";

/**
 * Combine a `forwardRef`-forwarded ref with one or more locally-owned refs so
 * both end up pointing at the same DOM node. Returns a stable callback ref
 * wrapper — memoize the result (`useMemo`) keyed on the forwarded ref so it
 * doesn't detach/reattach on every render.
 */
export function mergeRefs<T>(...refs: Array<ForwardedRef<T> | undefined>) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === "function") ref(node);
      else ref.current = node;
    }
  };
}
