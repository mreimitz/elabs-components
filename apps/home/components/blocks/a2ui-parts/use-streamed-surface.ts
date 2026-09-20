// registry: a2ui-parts — copied 2026-09-19
"use client";

/**
 * Replays a surface the way a model delivers it: as JSON TEXT that grows a few tokens at a time.
 *
 * `A2uiSurface` takes that prefix as it is (`surface={text} isStreaming`), completes the open
 * brackets, prunes the nodes that do not validate YET and paints the rest — so the screen builds
 * up while the agent is still writing. This hook only fakes the network; swap it for your
 * stream and keep the component.
 */
import type { A2uiSurfaceSpec } from "@elabs-ai/components-ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface StreamedSurface {
  /** The JSON received so far — hand it to `<A2uiSurface surface>` as it is. */
  text: string;
  /** The whole document, for a byte counter or a "show all" pane. */
  full: string;
  isStreaming: boolean;
  /** 0–1. */
  progress: number;
  /** Start again from the first byte. */
  replay: () => void;
  /** Jump to the settled surface. */
  finish: () => void;
}

export interface StreamedSurfaceOptions {
  /**
   * Characters per tick. Default: whatever delivers the whole surface in about three seconds
   * (never under 24) — long enough to watch it build, short enough not to wait for it.
   */
  chunk?: number;
  /** Milliseconds between ticks. Default 30. */
  interval?: number;
  /** Start streaming on mount. Default `true`; `false` starts settled. */
  autoStart?: boolean;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function useStreamedSurface(
  spec: A2uiSurfaceSpec,
  { chunk: chunkOption, interval = 30, autoStart = true }: StreamedSurfaceOptions = {},
): StreamedSurface {
  const full = useMemo(() => JSON.stringify(spec, null, 2), [spec]);
  const chunk = chunkOption ?? Math.max(24, Math.ceil(full.length / 100));
  const [length, setLength] = useState(autoStart ? 0 : full.length);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  const start = useCallback(() => {
    stop();
    // A reader who asked for less motion gets the settled surface, not a build-up.
    if (prefersReducedMotion()) {
      setLength(full.length);
      return;
    }
    setLength(0);
    timer.current = setInterval(() => {
      setLength((current) => {
        const next = Math.min(full.length, current + chunk);
        if (next >= full.length) stop();
        return next;
      });
    }, interval);
  }, [chunk, full.length, interval, stop]);

  // A new spec is a new answer: stream it from the top (or settle it, when not auto-starting).
  useEffect(() => {
    if (autoStart) start();
    else setLength(full.length);
    return stop;
  }, [autoStart, full, start, stop]);

  const finish = useCallback(() => {
    stop();
    setLength(full.length);
  }, [full.length, stop]);

  // For one render after a NEW spec arrives, `length` still belongs to the previous one.
  const received = Math.min(length, full.length);
  return {
    text: full.slice(0, received),
    full,
    isStreaming: received < full.length,
    progress: full.length === 0 ? 1 : received / full.length,
    replay: start,
    finish,
  };
}
