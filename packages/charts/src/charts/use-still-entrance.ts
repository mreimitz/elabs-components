"use client";

import { useReducedMotion } from "@elabs-ai/components-tokens";
import { useState } from "react";

/**
 * Reduced motion for a MOUNT-ONLY entrance (a sweep, fade or stagger that runs
 * once): `true` from the first render in which reduced motion is on, and it
 * stays `true` for the life of the component.
 *
 * Reads the one reduced-motion source (RM-189), the tokens `useReducedMotion`,
 * where the person's own motion setting from the theme wins over the OS.
 *
 * Why latch. An entrance keys its motion element (or its `useMountProgress`
 * replay key) on this flag, so a switch to reduced motion after mount lands the
 * entrance at rest instead of letting it run on. Keyed on the live flag, the
 * switch back to full motion would remount the element and replay the whole
 * entrance from zero. Latched, an entrance already shown stays shown; the
 * person's full-motion setting applies to the next mount.
 */
export function useStillEntrance(): boolean {
  const reduced = useReducedMotion();
  const [latched, setLatched] = useState(reduced);
  // Set during render, React's pattern for keeping information from earlier
  // renders: no effect, so no frame is committed with the wrong value.
  if (reduced && !latched) {
    setLatched(true);
  }
  return reduced || latched;
}
