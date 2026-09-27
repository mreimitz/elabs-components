"use client";

/**
 * layout-size.ts — how big a chart's box is, in the box's OWN CSS pixels.
 *
 * A chart draws in its root's coordinate space, so that is the size it must
 * measure. `getBoundingClientRect` answers in VIEWPORT pixels instead: a CSS
 * transform on the root or any ancestor scales it — ChartFrame's entrance
 * `zoom-in-95`, a dialog opening — and a transform ending fires no
 * ResizeObserver, so the scaled size sticks. An SVG drawn from it stops short
 * of its box; a canvas, stretched to the box by CSS, paints its marks off the
 * axes and outlines drawn over it. The offset size is the layout box, which no
 * transform touches.
 */

import { useCallback, useLayoutEffect, useRef, useState } from "react";

/**
 * The one resize wait every chart measurement uses, in ms (RM-189). The first
 * ResizeObserver callback of a burst redraws at once; while the burst lasts the
 * chart redraws at most once per this period, with the newest size, and the
 * final size lands no later than this long after the last callback. A
 * drag-resize or a panel collapse therefore follows the drag without
 * recomputing a whole chart on every tick. In lodash terms:
 * `debounce(fn, 100, { leading: true, maxWait: 100 })`.
 */
export const CHART_RESIZE_DEBOUNCE_MS = 100;

/**
 * A `ResizeObserver` whose callback runs on the FIRST observation of a burst,
 * then at most once per `wait` ms with the newest entries while callbacks keep
 * coming. A period with nothing new ends the burst without a call, so a single
 * observation is never answered twice and the final size is never repeated.
 * `useLayoutMeasure` owns one per measured node; its callback reads the node.
 */
export class ChartResizeObserver implements ResizeObserver {
  private readonly callback: ResizeObserverCallback;
  private readonly wait: number;
  private readonly observer: ResizeObserver | null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pending: ResizeObserverEntry[] | null = null;

  constructor(callback: ResizeObserverCallback, wait: number = CHART_RESIZE_DEBOUNCE_MS) {
    this.callback = callback;
    this.wait = wait;
    // Read at construction, not at import: a server render never constructs one.
    const Native = typeof ResizeObserver === "function" ? ResizeObserver : undefined;
    this.observer = Native ? new Native((entries) => this.notify(entries)) : null;
  }

  private notify(entries: ResizeObserverEntry[]): void {
    if (this.timer === undefined) {
      this.callback(entries, this); // leading: the first callback of a burst
      this.schedule();
    } else {
      this.pending = entries; // folded into the next period's call
    }
  }

  /** One period: call with the newest entries, or end the burst if none came. */
  private schedule(): void {
    this.timer = setTimeout(() => {
      const entries = this.pending;
      this.pending = null;
      if (entries) {
        this.callback(entries, this);
        this.schedule();
      } else {
        this.timer = undefined;
      }
    }, this.wait);
  }

  observe(target: Element, options?: ResizeObserverOptions): void {
    this.observer?.observe(target, options);
  }

  unobserve(target: Element): void {
    this.observer?.unobserve(target);
  }

  disconnect(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.pending = null;
    this.observer?.disconnect();
  }
}

export interface LayoutSize {
  width: number;
  height: number;
}

/**
 * `el`'s layout size. An element with no layout box of its own — an SVG
 * element, or any element under jsdom, where offsets are always 0 — answers
 * with `rect` (default: its bounding rect).
 */
export function layoutSize(el: Element, rect?: LayoutSize): LayoutSize {
  const { offsetWidth, offsetHeight } = el as Partial<HTMLElement>;
  if (
    typeof offsetWidth === "number" &&
    typeof offsetHeight === "number" &&
    (offsetWidth > 0 || offsetHeight > 0)
  ) {
    return usedBorderBox(el) ?? { width: offsetWidth, height: offsetHeight };
  }
  const box = rect ?? el.getBoundingClientRect();
  return { width: box.width, height: box.height };
}

/**
 * The used border box, exact to the sub-pixel. Offsets are the same box rounded
 * to whole pixels: an SVG drawn 0.5px taller than an aspect-ratio root grows the
 * root, and the chart measures again. `null` when the style has no length (jsdom).
 */
function usedBorderBox(el: Element): LayoutSize | null {
  return usedBox(el, "border-box");
}

/**
 * The used content box: inside the padding and border, the box a
 * `ResizeObserver` reports as `contentRect`. Read from the computed style, so
 * it holds for an `<svg>` too, which has no offsets. `null` as above.
 */
function usedContentBox(el: Element): LayoutSize | null {
  return usedBox(el, "content-box");
}

function usedBox(el: Element, box: "border-box" | "content-box"): LayoutSize | null {
  const style = getComputedStyle(el);
  let width = pxLength(style.width);
  let height = pxLength(style.height);
  if (width === null || height === null) return null;
  // `width`/`height` measure the box `box-sizing` names; step to the one asked for.
  const sized = style.boxSizing === "border-box" ? "border-box" : "content-box";
  if (sized !== box) {
    const px = (name: string) => parseFloat(style.getPropertyValue(name)) || 0;
    const edgesX =
      px("padding-left") + px("padding-right") + px("border-left-width") + px("border-right-width");
    const edgesY =
      px("padding-top") + px("padding-bottom") + px("border-top-width") + px("border-bottom-width");
    const sign = box === "border-box" ? 1 : -1;
    width = Math.max(0, width + sign * edgesX);
    height = Math.max(0, height + sign * edgesY);
  }
  return { width, height };
}

/**
 * A used length in px, or `null` for anything else: jsdom's empty string,
 * `auto`, or the `100%` a node with no box keeps as its computed value.
 */
function pxLength(value: string): number | null {
  if (!value.endsWith("px")) return null;
  const length = parseFloat(value);
  return Number.isFinite(length) ? length : null;
}

/**
 * Which box of its node `useLayoutMeasure` reads:
 * - `"border-box"` (default): the layout box, `layoutSize`.
 * - `"content-box"`: inside the padding and border (Gantt's root; Sparkline's
 *   `fit="fill"` `<svg>`).
 * - `"client"`: `clientWidth` × `clientHeight`, the padding box less any
 *   scrollbar — the viewport of a scroller (TreeChart's pan room).
 */
export type LayoutBox = "border-box" | "content-box" | "client";

/** `el`'s size in `box`. */
export function boxSize(el: Element, box: LayoutBox = "border-box"): LayoutSize {
  if (box === "client") return { width: el.clientWidth, height: el.clientHeight };
  if (box === "content-box") {
    // A node with no box (`display: none`, or inside a hidden parent) keeps its
    // specified size as its computed one, `100%` or even `300px`, yet has no
    // size. Offsets settle this for the border box; an `<svg>` has none.
    if (el.getClientRects().length === 0) return { width: 0, height: 0 };
    return usedContentBox(el) ?? layoutSize(el);
  }
  return layoutSize(el);
}

// ── Window resize and orientation change ────────────────────────────────────
// One pair of listeners for every measured node, not a pair per chart. The
// reads trail the last event by `CHART_RESIZE_DEBOUNCE_MS`, and each goes
// through its hook's same-size dedupe: a window resize that leaves a box as it
// was renders nothing.
const windowResizeReaders = new Set<() => void>();
let windowResizeTimer: ReturnType<typeof setTimeout> | undefined;

function onWindowResize(): void {
  clearTimeout(windowResizeTimer);
  windowResizeTimer = setTimeout(() => {
    windowResizeTimer = undefined;
    for (const read of windowResizeReaders) read();
  }, CHART_RESIZE_DEBOUNCE_MS);
}

/** Calls `read` once a window resize or orientation change settles; returns the unsubscribe. */
function subscribeWindowResize(read: () => void): () => void {
  if (windowResizeReaders.size === 0) {
    window.addEventListener("resize", onWindowResize);
    window.addEventListener("orientationchange", onWindowResize);
  }
  windowResizeReaders.add(read);
  return () => {
    if (!windowResizeReaders.delete(read) || windowResizeReaders.size > 0) return;
    window.removeEventListener("resize", onWindowResize);
    window.removeEventListener("orientationchange", onWindowResize);
    clearTimeout(windowResizeTimer);
    windowResizeTimer = undefined;
  };
}

/** What re-reads one measured node: its paced observer and the window subscription. */
class ResizeTriggers {
  private observer: ChartResizeObserver | null = null;
  private observed: Element | null = null;
  private unsubscribe: (() => void) | null = null;
  private readonly onResize: () => void;

  constructor(onResize: () => void) {
    this.onResize = onResize;
  }

  /** Watches `el` from now on; a no-op when it already does. */
  watch(el: Element): void {
    if (el === this.observed) return;
    this.observer ??= new ChartResizeObserver(this.onResize);
    if (this.observed) this.observer.unobserve(this.observed);
    this.observer.observe(el);
    this.observed = el;
    this.unsubscribe ??= subscribeWindowResize(this.onResize);
  }

  /** Stops watching: nothing calls back until the next `watch`, which starts a new observer. */
  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.observed = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}

export interface LayoutMeasureOptions {
  /**
   * `false`: a node is not read when it attaches; its first size comes from
   * the observer's first callback, one frame later — what visx `ParentSize`
   * did before RM-189. Keeps chart renders out of the hydration task. Under
   * `<StrictMode>` (dev only) the effect double-invoke reads the node in the
   * mount commit anyway; production defers.
   */
  measureOnAttach?: boolean;
  /** Which box of the node to read. Default `"border-box"`. Fixed for the hook's life. */
  box?: LayoutBox;
}

const NO_SIZE: LayoutSize = { width: 0, height: 0 };

/**
 * The one measurement path for the chart families (RM-189), answering with
 * the layout size (or the `box` asked for). It owns its triggers: a
 * `ChartResizeObserver` on the node (leading, then at most once per
 * `CHART_RESIZE_DEBOUNCE_MS` while a burst lasts) and a window resize or
 * orientation change, which trails by the same constant. Each trigger reads
 * the node itself and hands on only a changed size, so none re-renders a
 * chart at the size it already has; nothing walks the node's ancestors.
 */
export function useLayoutMeasure(
  options?: LayoutMeasureOptions,
): [(el: HTMLElement | SVGElement | null) => void, LayoutSize] {
  const { measureOnAttach = true, box = "border-box" } = options ?? {};
  const [size, setSize] = useState<LayoutSize>(NO_SIZE);
  // The size last handed to `setSize`. An unchanged size is not handed on at
  // all: React may still run the component once for a same-value update, and
  // for a family that measures its own node that run is the whole chart.
  const sizeRef = useRef(size);
  const update = useCallback((next: LayoutSize) => {
    const prev = sizeRef.current;
    if (prev.width === next.width && prev.height === next.height) return;
    sizeRef.current = { width: next.width, height: next.height };
    setSize(sizeRef.current);
  }, []);
  const elRef = useRef<HTMLElement | SVGElement | null>(null);
  const read = useCallback(() => {
    const el = elRef.current;
    if (el) update(boxSize(el, box));
  }, [update, box]);
  // The triggers call the newest `read` through this; the ref callback sets it.
  const readRef = useRef(read);
  const [triggers] = useState(() => new ResizeTriggers(() => readRef.current()));
  // The last node measured on attach: a ref callback React re-runs with the
  // same node (or `null` first) does not measure again.
  const attachedRef = useRef<HTMLElement | SVGElement | null>(null);
  // Set when a new node attached in the current commit (whether or not it was
  // read); cleared by the last layout effect below, so it never outlives that
  // commit.
  const attachedThisCommitRef = useRef(false);
  const ref = useCallback(
    (el: HTMLElement | SVGElement | null) => {
      elRef.current = el;
      readRef.current = read;
      if (el === null) return;
      triggers.watch(el);
      // A node that mounts (at first, or later after a loading branch) is
      // measured now, so its first painted frame has its size: the observer
      // answers only after layout. With `measureOnAttach: false` the
      // observer's first callback sizes it instead.
      if (el === attachedRef.current) return;
      attachedRef.current = el;
      attachedThisCommitRef.current = true;
      if (!measureOnAttach) return;
      const next = boxSize(el, box);
      // Nothing laid out yet (0 × 0): leave it to the observer.
      if (next.width === 0 && next.height === 0) return;
      update(next);
    },
    [triggers, read, box, update, measureOnAttach],
  );
  useLayoutEffect(() => {
    // In the commit a node attaches in, the ref callback above has handled it
    // — read it, or (`measureOnAttach: false`) left it to the observer — so it
    // is not read again here. A re-run in a later commit reads it: a subtree
    // shown again (`<Activity>`, Suspense) keeps its node, so the ref callback
    // does not measure it, and the box may have changed while it was hidden.
    const el = elRef.current;
    if (el) {
      triggers.watch(el);
      if (!attachedThisCommitRef.current) read();
    }
    return () => triggers.stop();
  }, [triggers, read]);
  useLayoutEffect(() => {
    attachedThisCommitRef.current = false;
    // The caller stopped handing the node this ref (it did not unmount the
    // hook): a later attach, even of the same node, is measured and observed
    // afresh.
    if (elRef.current === null && attachedRef.current !== null) {
      attachedRef.current = null;
      triggers.stop();
    }
  });
  return [ref, size];
}
