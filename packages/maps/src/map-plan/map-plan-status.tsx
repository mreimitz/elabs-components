"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@elabs-ai/components-ui/lib/cn";

/** Nothing is announced more often than this, however fast the data changes. */
const DEFAULT_COALESCE_MS = 2000;

export interface MapPlanStatusProps {
  /**
   * The sentence to announce. Change it when something a person needs to hear
   * changed — a selection, a status transition — never on every tick of a number.
   */
  message: string;
  /** Milliseconds between announcements (default 2000). */
  coalesceMs?: number;
  /** Also show the message (default false: it is an announcement, not chrome). */
  visible?: boolean;
  className?: string;
}

/**
 * ONE live region per plan. A WebGL canvas announces nothing by itself, and a
 * plan that changes — a machine goes down, a room frees up — has to say so
 * without stealing focus.
 *
 * Announcements are coalesced: a live region that re-reads a ticking number is
 * worse than silence, because it talks over everything else the person is doing.
 */
export function MapPlanStatus({
  message,
  coalesceMs = DEFAULT_COALESCE_MS,
  visible = false,
  className,
}: MapPlanStatusProps) {
  const [announced, setAnnounced] = useState(message);
  const lastAtRef = useRef(0);
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (message === announced) return;

    const elapsed = Date.now() - lastAtRef.current;
    if (elapsed >= coalesceMs) {
      lastAtRef.current = Date.now();
      setAnnounced(message);
      return;
    }

    // Inside the quiet window: hold the newest message and say it when the
    // window closes, so a burst of changes becomes one sentence.
    if (pendingRef.current) clearTimeout(pendingRef.current);
    pendingRef.current = setTimeout(() => {
      lastAtRef.current = Date.now();
      pendingRef.current = null;
      setAnnounced(message);
    }, coalesceMs - elapsed);

    return () => {
      if (pendingRef.current) {
        clearTimeout(pendingRef.current);
        pendingRef.current = null;
      }
    };
  }, [message, announced, coalesceMs]);

  return (
    <p
      data-slot="map-plan-status"
      role="status"
      aria-live="polite"
      className={cn(visible ? "text-caption text-muted-foreground" : "sr-only", className)}
    >
      {announced}
    </p>
  );
}
