import type { Decorator } from "@storybook/react-vite";
import { ChartConfigProvider } from "@elabs-ai/components-charts";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * The website's enlarged view (`apps/home` `StoryExpand`) opens a story with
 * `globals=expand:fill`. A chart story is authored for the Storybook canvas — a
 * `h-72 w-[560px]` box, a fixed `plotHeight`, a 2 : 1 ratio — so in the much
 * larger pane it sat small and centred. This grows the story's charts into the
 * pane: it lifts the story's own size box around each chart (the width to the
 * pane's, the heights to their content) and then sets the charts' height
 * through the host-forced plot height (`ChartConfigProvider value={{ plotHeight }}`,
 * ADR 0039 §3 rung 0) — or, for a chart sized to its parent, through that parent.
 *
 * It measures instead of filling with CSS: `height: 100%` never reaches a plot
 * through an unsized `<div>`. Two probe heights give how far the story's height
 * moves per px of plot height (1 for one chart or a row of charts, n for n
 * stacked ones); the forced height is the one that makes the story as tall as
 * the pane. A story whose height does not follow (a sparkline, a gauge, a chart
 * sized by its rows) is put back exactly as authored. All passes run in layout
 * effects, so only the final size is ever painted.
 */
const PROBES = [240, 440] as const;
/** A chart never grows taller than 3 : 4 of its width — no stretched strips. */
const MAX_HEIGHT_PER_WIDTH = 0.75;
/** Less growth than this is not worth a different layout from the authored one. */
const MIN_GAIN = 24;
/**
 * A fit that still overshoots the pane is corrected this often: text that re-wrapped at the
 * new size, or a part a chart adds after it measured itself (a navigator strip, a legend at
 * a wider tier).
 */
const MAX_CORRECTIONS = 3;
/**
 * A chart whose drawing runs this far past its own box ignores the height it is given (a
 * vertical funnel draws from its width): it stays as authored.
 */
const MAX_ESCAPE = 64;
/** A correction that would leave a plot shorter than this means the fit does not hold. */
const MIN_PLOT_HEIGHT = 120;

type Fit =
  | { step: "natural" }
  | { step: "probe"; natural: number; room: number; heights: number[]; escape: number }
  | { step: "check"; room: number; perPx: number; corrections: number }
  | { step: "settle" }
  | { step: "done" };

/**
 * While measuring, nothing in the story may transition: a theme's reduced-motion rule
 * gives every element a near-zero `transition-duration`, and a height that is still
 * transitioning reads as the old one in the same frame.
 */
const MEASURING_CSS = '[data-expand-fit="measuring"] * { transition-property: none !important; }';

/**
 * Storybook's `padded` and `centered` layouts keep 1rem around the story. Read from the
 * layout, not the body: Storybook puts its layout class on the body only after the first
 * render, when this has already measured.
 */
const LAYOUT_PADDING_PX = 16;

function roomHeight(): number {
  return window.innerHeight - LAYOUT_PADDING_PX * 2;
}

function roomWidth(): number {
  return window.innerWidth - LAYOUT_PADDING_PX * 2;
}

/**
 * The story's own top-level boxes, united. The wrapper is `display: contents` (a box of its
 * own would change how a centred story sizes), so it has no rect — its children do; a
 * `max-w-*` wrapper stays narrow.
 */
function storyBox(el: HTMLElement): { width: number; height: number } {
  const rects = Array.from(el.children)
    .map((child) => child.getBoundingClientRect())
    .filter((rect) => rect.width > 0 || rect.height > 0);
  if (rects.length === 0) return { width: 0, height: 0 };
  return {
    width: Math.max(...rects.map((r) => r.right)) - Math.min(...rects.map((r) => r.left)),
    height: Math.max(...rects.map((r) => r.bottom)) - Math.min(...rects.map((r) => r.top)),
  };
}

/** Every chart container root (`ChartPlotRoot` marks itself) that is not inside another one. */
function chartRoots(host: HTMLElement): HTMLElement[] {
  return Array.from(host.querySelectorAll<HTMLElement>("[data-chart-breakpoint]")).filter(
    (root) => !root.parentElement?.closest("[data-chart-breakpoint]"),
  );
}

/**
 * How far the story runs past the pane: its own boxes, and anything they push past the page
 * end that their rects miss (a margin that collapses through, an overflowing absolute part).
 */
function overshoot(el: HTMLElement, room: number): number {
  return Math.max(storyBox(el).height - room, scrolledPast());
}

function scrolledPast(): number {
  return document.documentElement.scrollHeight - window.innerHeight;
}

/** The widest chart's width — what the 3 : 4 cap is taken from. */
function chartWidth(host: HTMLElement): number {
  return Math.max(0, ...chartRoots(host).map((root) => root.getBoundingClientRect().width));
}

/** Inline `style` attributes as they were before `liftStoryBox`, to put back. */
type Lifted = { el: HTMLElement; style: string | null }[];

/**
 * Lift the story's own size box between the story and each chart: the top-level box takes
 * the pane's width, every box on the way loses its fixed height (`h-72`, `aspect-*`,
 * `max-h-*`) and width cap, and one in normal flow fills its parent's width. The chart roots
 * themselves are left alone — their size is the forced plot height's to set.
 */
function liftStoryBox(host: HTMLElement): Lifted {
  const lifted: Lifted = [];
  const seen = new Set<HTMLElement>();
  for (const root of chartRoots(host)) {
    for (let el = root.parentElement; el && el !== host; el = el.parentElement) {
      if (seen.has(el)) continue;
      seen.add(el);
      const parent = el.parentElement;
      const parentStyle = parent ? getComputedStyle(parent) : undefined;
      const fillsParent =
        parentStyle?.display === "block" ||
        parentStyle?.display === "flow-root" ||
        (parentStyle?.display.endsWith("flex") === true &&
          parentStyle.flexDirection.startsWith("column"));
      lifted.push({ el, style: el.getAttribute("style") });
      el.style.height = "auto";
      el.style.minHeight = "0";
      el.style.maxHeight = "none";
      el.style.aspectRatio = "auto";
      el.style.maxWidth = "none";
      if (parent === host) el.style.width = `${roomWidth()}px`;
      else if (fillsParent) el.style.width = "100%";
    }
  }
  return lifted;
}

/**
 * A chart sized by its caller to its parent's height (`style={{ height: "100%" }}` wins over
 * the forced plot height) or sized by its own root as a fill: its parent takes the plot
 * height instead. Kept only where the chart then follows exactly — a sparkline or a
 * data-sized chart does not, and its parent is left as lifted.
 */
function adoptFollowers(host: HTMLElement, plotHeight: number): HTMLElement[] {
  const followers: HTMLElement[] = [];
  const obeys = (root: HTMLElement) =>
    Math.abs(root.getBoundingClientRect().height - plotHeight) <= 1;
  for (const root of chartRoots(host)) {
    const parent = root.parentElement;
    if (!parent || parent === host || obeys(root)) continue;
    const before = parent.style.height;
    parent.style.height = `${plotHeight}px`;
    if (obeys(root)) followers.push(parent);
    else parent.style.height = before;
  }
  return followers;
}

function restoreStoryBox(lifted: Lifted) {
  for (const { el, style } of lifted) {
    if (style === null) el.removeAttribute("style");
    else el.setAttribute("style", style);
  }
}

function ExpandFit({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const fit = useRef<Fit>({ step: "natural" });
  const lifted = useRef<Lifted>([]);
  const followers = useRef<HTMLElement[]>([]);
  /** Set once a fitted size is in place, for corrections after the fit. */
  const fitted = useRef<{ room: number; perPx: number; corrections: number } | null>(null);
  const [plotHeight, setPlotHeight] = useState<number | undefined>(undefined);
  const [measuring, setMeasuring] = useState(true);
  const [epoch, setEpoch] = useState(0);

  /** Put the story back exactly as authored. */
  const revert = () => {
    restoreStoryBox(lifted.current);
    lifted.current = [];
    followers.current = [];
    fitted.current = null;
    setPlotHeight(undefined);
  };

  // The pane follows the browser window: start over at the new size.
  useEffect(() => {
    const restart = () => {
      revert();
      fit.current = { step: "natural" };
      setMeasuring(true);
      setEpoch((n) => n + 1);
    };
    window.addEventListener("resize", restart);
    return () => window.removeEventListener("resize", restart);
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    const state = fit.current;
    if (plotHeight !== undefined) {
      for (const parent of followers.current) parent.style.height = `${plotHeight}px`;
    }
    if (!el || state.step === "done") return;
    const finish = () => {
      fit.current = { step: "done" };
      setMeasuring(false);
    };
    // A fit that overshoots the pane steps down; one that cannot is put back as authored.
    const check = (current: number, room: number, perPx: number, n: number) => {
      fitted.current = { room, perPx, corrections: n };
      const over = overshoot(el, room);
      if (over <= 0.5 || n >= MAX_CORRECTIONS) return finish();
      const next = current - Math.ceil(over / perPx);
      fit.current =
        next < MIN_PLOT_HEIGHT
          ? { step: "settle" }
          : { step: "check", room, perPx, corrections: n + 1 };
      if (next < MIN_PLOT_HEIGHT) revert();
      else setPlotHeight(next);
    };
    if (state.step === "settle") return finish();
    if (state.step === "probe" && state.heights.length === 0 && plotHeight !== undefined) {
      followers.current = adoptFollowers(el, plotHeight);
    }
    const { height } = storyBox(el);
    if (state.step === "natural") {
      const room = roomHeight();
      if (height === 0 || height >= room - MIN_GAIN) return finish();
      lifted.current = liftStoryBox(el);
      fit.current = { step: "probe", natural: height, room, heights: [], escape: 0 };
      setPlotHeight(PROBES[0]);
      return;
    }
    if (state.step === "check") {
      return check(plotHeight ?? 0, state.room, state.perPx, state.corrections);
    }
    state.heights.push(height);
    state.escape = Math.max(state.escape, scrolledPast() - Math.max(0, height - state.room));
    if (state.heights.length < PROBES.length) {
      setPlotHeight(PROBES[state.heights.length]);
      return;
    }
    const [low = 0, high = 0] = state.heights;
    const perPx = (high - low) / (PROBES[1] - PROBES[0]);
    let next: number | undefined;
    if (perPx >= 0.5 && state.escape <= MAX_ESCAPE) {
      const rest = low - perPx * PROBES[0];
      const fill = Math.floor((state.room - rest) / perPx);
      const capped = Math.min(fill, Math.floor(chartWidth(el) * MAX_HEIGHT_PER_WIDTH));
      if (rest + perPx * capped >= state.natural + MIN_GAIN) next = capped;
    }
    if (next === undefined) {
      // Not worth it, or the story does not follow: put it back as authored. Lift the
      // transition guard only once that size has committed.
      fit.current = { step: "settle" };
      revert();
      return;
    }
    if (next === plotHeight) return check(next, state.room, perPx, 0);
    fit.current = { step: "check", room: state.room, perPx, corrections: 0 };
    setPlotHeight(next);
  }, [plotHeight, epoch]);

  // A chart can add a part after the fit measured it — its width tier and the navigator
  // strip are measured by a ResizeObserver of its own. Step down if the story then runs
  // past the pane.
  useEffect(() => {
    const el = ref.current;
    if (measuring || !el || !fitted.current) return;
    const observer = new ResizeObserver(() => {
      const state = fitted.current;
      if (!state || state.corrections >= MAX_CORRECTIONS) return;
      const over = overshoot(el, state.room);
      if (over <= 0.5) return;
      state.corrections += 1;
      setPlotHeight((current) => {
        if (current === undefined) return current;
        const next = current - Math.ceil(over / state.perPx);
        return next < MIN_PLOT_HEIGHT ? current : next;
      });
    });
    for (const child of Array.from(el.children)) observer.observe(child);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, [measuring, epoch]);

  return (
    <div
      ref={ref}
      data-expand-fit={measuring ? "measuring" : "done"}
      style={{ display: "contents" }}
    >
      <style>{MEASURING_CSS}</style>
      <ChartConfigProvider value={plotHeight === undefined ? undefined : { plotHeight }}>
        {children}
      </ChartConfigProvider>
    </div>
  );
}

/**
 * Active only for a chart story opened by the website's enlarged view
 * (`globals=expand:fill`); everywhere else the story renders untouched. A
 * `fullscreen` story already takes the whole frame.
 */
export const withExpandFit: Decorator = (Story, context) => {
  const active =
    context.globals.expand === "fill" &&
    context.viewMode === "story" &&
    context.title.startsWith("Charts/") &&
    context.parameters.layout !== "fullscreen";
  if (!active) return <Story />;
  return (
    <ExpandFit>
      <Story />
    </ExpandFit>
  );
};
