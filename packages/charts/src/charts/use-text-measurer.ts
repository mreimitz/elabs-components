"use client";

/**
 * useTextMeasurer — the px width of a chart label string, in the label font as
 * it is ACTUALLY resolved for this chart.
 *
 * Why a probe and not a constant: `--text-meta` is density-scaled (#340) and the
 * font family is a theme seam, so a label's width depends on `data-density` /
 * `data-theme` / the loaded webfont — none of which a hardcoded ratio can know.
 * Same technique, same reason, same precedent as `use-resolved-radius.ts`:
 * append a hidden probe INSIDE the chart container so the theme + density
 * inheritance context applies, read `getComputedStyle`, remove it.
 *
 * Why this is NOT the banned in-render measurement: `.claude/rules/chart-components.md`
 * forbids `getBBox()` / `getBoundingClientRect()` in render because they force a
 * synchronous layout of the SVG on every paint. Canvas `measureText` touches no
 * layout at all — it reads font metrics from the text shaper — and the ONE
 * `getComputedStyle` call happens in a layout effect, once per font change, not
 * per label. Do not "simplify" this into a `getBoundingClientRect` over a real
 * span: that is the thing the rule bans.
 *
 * jsdom has no 2d context, so `measure` falls back to a pure, deterministic
 * per-character estimate. Tests get finite widths instead of a crash, and any
 * test that needs exact numbers injects its own `measure` into
 * `planCategoryAxis` rather than relying on either path.
 */

import { type RefObject, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useChartStable } from "./chart-context";

/** Font descriptor before the probe resolves — matches `text-meta` at rest. */
const DEFAULT_FONT = "500 12px sans-serif";
const DEFAULT_FONT_SIZE_PX = 12;
const DEFAULT_LINE_HEIGHT_PX = 16;

/**
 * The probe's classes when the caller names none: the `text-meta` rung, which
 * is what an axis tick is drawn in. A surface whose labels use a DIFFERENT type
 * role passes its own (`NetworkChart` → `text-chart-source`) — measuring the
 * wrong role under-reserves the space, and `text-chart-source` differs from
 * `text-meta` by 0.07em of tracking, which is ~1px per character.
 */
const DEFAULT_PROBE_CLASS = "text-chart-label text-meta";

/** `line-height: normal` resolves per-font; this is the usual sans-serif ratio. */
const NORMAL_LINE_HEIGHT_RATIO = 1.35;

/**
 * Shaped once per font settle to tell "a webfont replaced the fallback face"
 * from "nothing changed": digits, capitals and lowercase so any face swap moves
 * it.
 */
const FONT_SENTINEL = "Store 0123456789 ABC xyz";

/** Cap on the memo table so a live-updating chart can't grow it without bound. */
const MEASURE_CACHE_LIMIT = 2000;

export interface TextMeasurer {
  /** Rendered width of `text`, in px. */
  measure: (text: string) => number;
  /** Resolved line height of the label font, in px. */
  lineHeightPx: number;
  /** Resolved font size, in px. */
  fontSizePx: number;
  /** Resolved letter spacing of the label font, in px (0 when `normal`). */
  letterSpacingPx: number;
}

export interface TextMeasurerOptions {
  /**
   * Classes the hidden probe carries, i.e. the typography the measured text is
   * ACTUALLY painted in. Defaults to the `text-meta` axis-tick rung. Pass the
   * label's own role when it differs — the reserved width is only honest if the
   * probe and the `<text>` element resolve to the same font AND tracking.
   */
  className?: string;
}

interface FontMetrics {
  font: string;
  fontSizePx: number;
  lineHeightPx: number;
  letterSpacingPx: number;
}

const DEFAULT_METRICS: FontMetrics = {
  font: DEFAULT_FONT,
  fontSizePx: DEFAULT_FONT_SIZE_PX,
  lineHeightPx: DEFAULT_LINE_HEIGHT_PX,
  letterSpacingPx: 0,
};

/** Per-character width ratios for the no-canvas fallback. Deterministic. */
const NARROW_CHARS = new Set([...`ijltfrI.,:;'"!|()[]{}\` `]);
const WIDE_CHARS = new Set([..."MWmw@%&"]);

/** Pure width estimate used when no canvas 2d context exists (jsdom, SSR). */
export function estimateTextWidth(text: string, fontSizePx: number, letterSpacingPx = 0): number {
  let ratio = 0;
  let chars = 0;
  for (const char of text) {
    chars += 1;
    if (NARROW_CHARS.has(char)) {
      ratio += 0.33;
    } else if (WIDE_CHARS.has(char)) {
      ratio += 0.9;
    } else {
      ratio += 0.55;
    }
  }
  return ratio * fontSizePx + chars * letterSpacingPx;
}

let sharedCanvasContext: CanvasRenderingContext2D | null | undefined;

/**
 * jsdom implements `getContext` as a `jsdomError` on the virtual console rather
 * than a throw, so a `try`/`catch` cannot keep it quiet — every chart test would
 * print "Not implemented: HTMLCanvasElement.prototype.getContext". Detecting the
 * environment up front skips the call entirely and takes the estimate path,
 * which is what tests want anyway (deterministic, font-independent widths).
 */
function hasCanvasSupport(): boolean {
  return !(typeof navigator !== "undefined" && navigator.userAgent.includes("jsdom"));
}

/** Lazily create ONE module-level canvas; `null` means "no 2d context here". */
function getCanvasContext(): CanvasRenderingContext2D | null {
  if (sharedCanvasContext !== undefined) {
    return sharedCanvasContext;
  }
  if (typeof document === "undefined" || !hasCanvasSupport()) {
    sharedCanvasContext = null;
    return null;
  }
  try {
    sharedCanvasContext = document.createElement("canvas").getContext("2d");
  } catch {
    sharedCanvasContext = null;
  }
  return sharedCanvasContext ?? null;
}

/** Read the label font as it resolves inside `host`'s inheritance context. */
function resolveFontMetrics(host: Element | null, probeClass: string): FontMetrics {
  if (!host || typeof window === "undefined" || typeof document === "undefined") {
    return DEFAULT_METRICS;
  }
  const probe = document.createElement("span");
  probe.className = probeClass;
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.whiteSpace = "nowrap";
  probe.textContent = "0";
  host.appendChild(probe);
  const style = window.getComputedStyle(probe);
  const fontSizePx = Number.parseFloat(style.fontSize);
  const rawLineHeight = Number.parseFloat(style.lineHeight);
  // `normal` (and jsdom's empty string) parse to NaN — that IS zero tracking.
  const rawLetterSpacing = Number.parseFloat(style.letterSpacing);
  const family = style.fontFamily || "sans-serif";
  const weight = style.fontWeight || "400";
  const fontStyle = style.fontStyle || "normal";
  probe.remove();

  const size = Number.isFinite(fontSizePx) && fontSizePx > 0 ? fontSizePx : DEFAULT_FONT_SIZE_PX;
  const lineHeightPx =
    Number.isFinite(rawLineHeight) && rawLineHeight > 0
      ? rawLineHeight
      : size * NORMAL_LINE_HEIGHT_RATIO;

  return {
    font: `${fontStyle} ${weight} ${size}px ${family}`,
    fontSizePx: size,
    lineHeightPx,
    letterSpacingPx: Number.isFinite(rawLetterSpacing) ? rawLetterSpacing : 0,
  };
}

/**
 * Reusable core: resolve the label font inside `ref`'s inheritance context and
 * return a memoised measurement function. Re-resolves on theme / density /
 * decoration changes and once the webfonts settle — a font swapping in after
 * first paint changes every width.
 *
 * `BarChart` uses this form because it OWNS the container ref: it must reserve
 * axis space before it can publish a chart context for anything to read.
 */
export function useTextMeasurerOf(
  ref: RefObject<Element | null>,
  options?: TextMeasurerOptions,
): TextMeasurer {
  const containerRef = ref;
  // A string, not the options object: callers pass an inline literal, and a
  // fresh object identity every render would re-run the probe effect forever.
  const probeClass = options?.className ?? DEFAULT_PROBE_CLASS;
  const [metrics, setMetrics] = useState<FontMetrics>(DEFAULT_METRICS);
  // Bumped when a webfont finishes loading. The descriptor string does not
  // change when `Inter` swaps in for the fallback face it was shaped with, so
  // the epoch is what invalidates the widths — and the `measure` identity that
  // every plan memo depends on.
  const [fontsEpoch, setFontsEpoch] = useState(0);
  const sentinelRef = useRef<number | null>(null);
  const cacheRef = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    let raf = 0;
    let cancelled = false;

    const apply = (next: FontMetrics) => {
      if (cancelled) return;
      // Guard the setState: the observer fires on unrelated attribute writes,
      // and re-setting an equal descriptor would loop the effect forever.
      setMetrics((prev) =>
        prev.font === next.font &&
        prev.fontSizePx === next.fontSizePx &&
        prev.lineHeightPx === next.lineHeightPx &&
        prev.letterSpacingPx === next.letterSpacingPx
          ? prev
          : next,
      );
    };

    const update = () => {
      const element = containerRef.current;
      if (!element) {
        // Parent callback refs populate AFTER child effects — retry next frame
        // until attached. Mirrors `useResolvedRadiusOf`.
        raf = requestAnimationFrame(update);
        return;
      }
      apply(resolveFontMetrics(element, probeClass));
    };

    update();

    const observer = new MutationObserver(() => {
      const element = containerRef.current;
      if (element) apply(resolveFontMetrics(element, probeClass));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-density", "data-decoration", "class", "style"],
    });

    // A webfont that lands AFTER the first plan changes every width without
    // changing the descriptor: `measureText` shaped the labels with the
    // fallback face, the DOM then paints them in the real one, and a gutter
    // reserved for the narrower run re-cuts labels that "fit". `ready` covers
    // fonts already in flight; `loadingdone` covers a face the axis itself
    // only pulled in by painting (the plan ran before anything used it).
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    const onFontsSettled = () => {
      if (cancelled) return;
      const element = containerRef.current;
      if (!element) return;
      const next = resolveFontMetrics(element, probeClass);
      apply(next);
      // Bump only when the shaped width actually moved: `ready` also resolves
      // at once when nothing is loading, and a chart should not re-plan its
      // axis for a font that was there all along.
      const context = getCanvasContext();
      if (!context) return;
      context.font = next.font;
      const shaped = context.measureText(FONT_SENTINEL).width;
      // `null`: nothing has been measured yet, so nothing can be stale.
      const moved = sentinelRef.current !== null && shaped !== sentinelRef.current;
      sentinelRef.current = shaped;
      if (moved) {
        cacheRef.current = new Map();
        setFontsEpoch((epoch) => epoch + 1);
      }
    };
    void fonts?.ready.then(onFontsSettled);
    fonts?.addEventListener?.("loadingdone", onFontsSettled);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      fonts?.removeEventListener?.("loadingdone", onFontsSettled);
    };
  }, [containerRef, probeClass]);

  // A new font invalidates every cached width, so the table is keyed to the
  // descriptor by being rebuilt with it.
  useLayoutEffect(() => {
    cacheRef.current = new Map();
  }, []);

  const { font, fontSizePx, lineHeightPx, letterSpacingPx } = metrics;

  const measure = useCallback(
    (text: string): number => {
      const cache = cacheRef.current;
      const key = `${font}/${letterSpacingPx}/${fontsEpoch}\u0000${text}`;
      const hit = cache.get(key);
      if (hit !== undefined) {
        return hit;
      }
      const context = getCanvasContext();
      let width: number;
      if (context) {
        context.font = font;
        if (sentinelRef.current === null) {
          sentinelRef.current = context.measureText(FONT_SENTINEL).width;
        }
        width = context.measureText(text).width;
        if (!Number.isFinite(width) || width === 0) {
          // jsdom's canvas shim answers 0 for everything — treat as no context.
          width = estimateTextWidth(text, fontSizePx, letterSpacingPx);
        } else if (letterSpacingPx !== 0) {
          // `measureText` shapes the run with the font's own advances and knows
          // nothing about CSS `letter-spacing` (canvas has its own
          // `ctx.letterSpacing`, default `0px`, unevenly supported). CSS adds
          // tracking after EVERY character, so the painted run is that much
          // wider than the shaped one — without this the measurer under-reserves
          // by ~1px per character on the 0.08em `text-chart-source` rung and a
          // long label still spills past the gutter reserved for it.
          width += [...text].length * letterSpacingPx;
        }
      } else {
        width = estimateTextWidth(text, fontSizePx, letterSpacingPx);
      }
      if (cache.size >= MEASURE_CACHE_LIMIT) {
        cache.clear();
      }
      cache.set(key, width);
      return width;
    },
    [font, fontSizePx, fontsEpoch, letterSpacingPx],
  );

  return useMemo(
    () => ({ measure, lineHeightPx, fontSizePx, letterSpacingPx }),
    [measure, lineHeightPx, fontSizePx, letterSpacingPx],
  );
}

/** Chart-context variant: measures in the chart container's own context. */
export function useTextMeasurer(options?: TextMeasurerOptions): TextMeasurer {
  const { containerRef } = useChartStable();
  return useTextMeasurerOf(containerRef, options);
}
