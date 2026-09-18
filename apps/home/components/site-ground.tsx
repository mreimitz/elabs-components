"use client";

import { useSyncExternalStore } from "react";
import { AmbientField, type AmbientToken } from "@elabs-ai/components-marketing";

/*
 * The page ground (concept §5a "Ground"): three layers behind every section.
 *   1. base      — the theme's canvas (`bg-background` on <body>).
 *   2. ambient   — this component: one fixed AmbientField for the whole page. globals.css names
 *                  it the `ground` view-transition group.
 *   3. drafting  — the tokens' decoration ground, `[data-decoration] body::before` (masked
 *                  layer, fixed), which appears whenever the decoration dial is ≥ 1.
 * Sections never paint their own ambient layer; they tint this one with `setAmbientTint`.
 */

let tint: AmbientToken | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Shift the page's ambient field toward a token (crossfades over `--t-base`); `undefined` resets. */
export function setAmbientTint(token: AmbientToken | undefined) {
  if (token === tint) return;
  tint = token;
  for (const listener of listeners) listener();
}

export function SiteGround() {
  const current = useSyncExternalStore(
    subscribe,
    () => tint,
    () => undefined,
  );
  return (
    <div
      data-slot="site-ground"
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10"
    >
      <AmbientField tint={current} />
    </div>
  );
}
