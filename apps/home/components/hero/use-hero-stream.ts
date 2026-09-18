"use client";
/**
 * use-hero-stream.ts — the client hook that drives the hero's one-time stream-in (RM-094).
 * Split from `hero-stream.ts` so the server-rendered hero can import the seed and gate script
 * without pulling React hooks into the server graph.
 */
import { useLayoutEffect, useState, type RefObject } from "react";
import { readMotionFactor } from "@elabs-ai/components-ui";
import {
  STREAM_PENDING_ATTR,
  STREAM_SESSION_KEY,
  STREAM_TOTAL_MS,
  type HeroStream,
} from "./hero-stream";

/** Cubic-bézier y(x) for the `--ease-entrance` token, solved by bisection. */
function easeFromToken(el: Element): (p: number) => number {
  const raw = getComputedStyle(el).getPropertyValue("--ease-entrance");
  const m = raw.match(
    /cubic-bezier\(\s*([\d.]+)\s*,\s*([\d.-]+)\s*,\s*([\d.]+)\s*,\s*([\d.-]+)\s*\)/,
  );
  if (!m) return (p) => 1 - (1 - p) ** 3;
  const [x1, y1, x2, y2] = m.slice(1).map(Number) as [number, number, number, number];
  const bez = (t: number, a: number, b: number) =>
    3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3;
  return (p) => {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i += 1) {
      const mid = (lo + hi) / 2;
      if (bez(mid, x1, x2) < p) lo = mid;
      else hi = mid;
    }
    return bez((lo + hi) / 2, y1, y2);
  };
}

const SETTLED: HeroStream = { elapsed: null, ease: (p) => p };

/**
 * Drives the stream-in. The server HTML carries the FINAL state; the inline gate script (see
 * `streamGateScript`) hides the streaming parts before first paint only when this visit will
 * play, so a return visit or reduced motion shows final values at first paint.
 */
export function useHeroStream(ref: RefObject<HTMLElement | null>): HeroStream {
  const [stream, setStream] = useState<HeroStream>(SETTLED);
  useLayoutEffect(() => {
    const host = ref.current?.closest(`[${STREAM_PENDING_ATTR}]`);
    if (!host) return;
    const factor = Math.min(readMotionFactor(host), 1);
    try {
      sessionStorage.setItem(STREAM_SESSION_KEY, "1");
    } catch {
      // Storage blocked: the stream simply plays again next time.
    }
    if (factor <= 0) {
      host.removeAttribute(STREAM_PENDING_ATTR);
      return;
    }
    const ease = easeFromToken(host);
    setStream({ elapsed: 0, ease });
    host.removeAttribute(STREAM_PENDING_ATTR);
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const elapsed = (now - start) / factor;
      if (elapsed >= STREAM_TOTAL_MS) {
        setStream(SETTLED);
        return;
      }
      setStream({ elapsed, ease });
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [ref]);
  return stream;
}
