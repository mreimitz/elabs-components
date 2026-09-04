"use client";

/**
 * RM-020 — `revealOn="inView"` + `replayOnClick` on `ChartRevealClip`.
 *
 * These demos exercise the RM-020 primitive DIRECTLY. `LineChart` / `AreaChart`
 * / `BarChart` don't yet expose `revealOn`/`replayOnClick` on their public
 * props — wiring the chart shells (`time-series-chart-shell.tsx`,
 * `use-chart-phase-orchestrator.ts`) and `LineChart`/`AreaChart` through to
 * `ChartRevealClip`'s new props is tracked as follow-up work; this story
 * demonstrates the mechanism those shells will delegate to.
 */

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useRef, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ChartRevealClip } from "./chart-reveal-clip";

const meta: Meta = {
  title: "Charts/Reveal/InView",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          'RM-020 — `ChartRevealClip`\'s `revealOn="inView"` (defer the enter reveal until ' +
          "scrolled into view) and its two-part replay affordance — `replayOnClick` (pointer) " +
          "plus `replayCount`, bumped by a real `<button>` rendered outside the chart body " +
          "(keyboard) — demonstrated on the primitive itself. The reveal neutralizes itself " +
          "under `prefers-reduced-motion`: it renders its finished state with no animation, " +
          "without the caller passing anything. Not a chart to render data with — for that, " +
          "see `Charts/LineChart` (this feature isn't wired into `LineChart`'s public props yet).",
      },
    },
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj;

const CHART_WIDTH = 480;
const CHART_HEIGHT = 160;

interface RevealChartProps {
  label: string;
  testId: string;
  replayOnClick?: boolean;
}

/** A minimal chart-shaped surface (line + one "datapoint" bar) wired to `ChartRevealClip`. */
function RevealChart({ label, testId, replayOnClick = false }: RevealChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [playCount, setPlayCount] = useState(0);
  const [barClicks, setBarClicks] = useState(0);
  // The KEYBOARD half of the replay affordance (#176). `replayOnClick` is a
  // pointer-only listener on the container; this counter is what a real,
  // focusable control bumps, and it goes through the same replay epoch inside
  // `ChartRevealClip`.
  const [replays, setReplays] = useState(0);
  const clipId = `reveal-demo-${testId}`;

  return (
    <div className="w-full max-w-xl">
      {/*
        The replay control sits OUTSIDE the chart container, not just outside
        the `<svg>`, for two reasons. (1) A real chart body is
        `aria-hidden="true"`, and a focusable element inside an `aria-hidden`
        subtree is the axe `aria-hidden-focus` violation — the same constraint
        that puts `ChartDatapointLayer`'s targets in a sibling layer. (2) It
        keeps the demo honest: a button inside `containerRef` would replay
        through the pointer listener's own bubbled click, so only a control
        outside it actually exercises `replayCount`. A real `<button>` is
        activated by Enter AND Space for free — no key handling, no `tabIndex`.
      */}
      {replayOnClick ? (
        <button
          className="mb-2 rounded-md border border-input bg-background px-2 py-1 text-meta font-medium text-foreground hover:bg-muted focus-ring"
          data-testid={`${testId}-replay`}
          onClick={() => setReplays((n) => n + 1)}
          type="button"
        >
          Replay reveal
        </button>
      ) : null}
      <div
        className="relative w-full rounded-md border border-border bg-card p-4"
        data-bar-clicks={barClicks}
        data-play-count={playCount}
        data-testid={testId}
        ref={containerRef}
      >
        <div className="mb-2 text-body font-medium text-foreground">{label}</div>
        <svg height={CHART_HEIGHT} width={CHART_WIDTH}>
          <defs>
            <ChartRevealClip
              clipPathId={clipId}
              height={CHART_HEIGHT}
              onEnterPlay={() => setPlayCount((n) => n + 1)}
              replayCount={replays}
              replayOnClick={replayOnClick}
              revealEpoch={0}
              revealOn="inView"
              // A click on the "bar" (stand-in datapoint) must never replay the
              // reveal — mirrors the real requirement that `replayOnClick` must
              // not swallow `onDatapointClick` on a real chart.
              shouldReplayOnClick={(event) =>
                !(event.target instanceof Element && event.target.closest("[data-bar]"))
              }
              targetWidth={CHART_WIDTH}
              viewportRef={containerRef}
            />
          </defs>
          <g clipPath={`url(#${clipId})`}>
            <polyline
              fill="none"
              points="0,120 60,90 120,100 180,40 240,70 300,30 360,60 420,20 480,50"
              stroke="var(--chart-1)"
              strokeWidth={3}
            />
            <rect
              data-bar
              fill="var(--chart-2)"
              height={28}
              onClick={() => setBarClicks((n) => n + 1)}
              width={28}
              x={438}
              y={112}
            />
          </g>
        </svg>
        <p className="mt-2 text-meta text-muted-foreground">
          played {playCount}× · bar clicked {barClicks}×
        </p>
      </div>
    </div>
  );
}

/**
 * Three stacked charts, each ~700px below the fold except the first. Only
 * the chart that has actually scrolled into view (30% visible) plays its
 * enter reveal — `chart-reveal-clip.test.tsx` covers the gating decision
 * itself with a fake `IntersectionObserver`; this story is the real-browser
 * proof that scrolling a genuine `IntersectionObserver` triggers it.
 */
export const InView: Story = {
  render: () => (
    <div
      aria-label="Reveal demo charts"
      className="h-[420px] w-full overflow-y-auto bg-background"
      data-testid="reveal-scroll-viewport"
      role="region"
      tabIndex={0}
    >
      <div className="flex flex-col items-start gap-6 p-6">
        <RevealChart label="Chart 1 — visible on mount" testId="reveal-chart-1" />
        <div aria-hidden="true" style={{ height: 700 }} />
        <RevealChart label="Chart 2 — below the fold" testId="reveal-chart-2" />
        <div aria-hidden="true" style={{ height: 700 }} />
        <RevealChart label="Chart 3 — further below the fold" testId="reveal-chart-3" />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chart1 = canvas.getByTestId("reveal-chart-1");
    const chart2 = canvas.getByTestId("reveal-chart-2");

    // Chart 1 is already in view on mount — plays immediately.
    await waitFor(() => expect(Number(chart1.dataset.playCount)).toBeGreaterThan(0));

    // Chart 2 starts below the fold — held at width 0, not yet played.
    expect(chart2.dataset.playCount).toBe("0");

    chart2.scrollIntoView({ block: "center" });

    // The second chart's reveal only plays AFTER it actually scrolls into
    // view — never before.
    await waitFor(() => expect(Number(chart2.dataset.playCount)).toBeGreaterThan(0), {
      timeout: 5000,
    });
  },
};

/**
 * The replay affordance, both halves — the reference wiring for `replayOnClick`.
 *
 * - **Pointer:** clicking the chart body replays the reveal; clicking the "bar"
 *   datapoint fires its own handler and does NOT replay (`shouldReplayOnClick`).
 * - **Keyboard (#176):** a real `<button>` rendered OUTSIDE the chart body bumps
 *   `replayCount`, which goes through the same replay epoch as a click. Tab to
 *   it, press Enter or Space, and the reveal replays. `replayOnClick` alone is a
 *   mouse-only enhancement — a listener on an element chosen for intersection
 *   observation has no role, no name and no tab stop — so never ship it without
 *   a control like this one.
 */
export const ReplayOnClick: Story = {
  render: () => (
    <div className="p-6">
      <RevealChart label="Click the chart to replay" replayOnClick testId="reveal-chart-replay" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chart = canvas.getByTestId("reveal-chart-replay");

    await waitFor(() => expect(Number(chart.dataset.playCount)).toBeGreaterThan(0));
    const initialPlays = Number(chart.dataset.playCount);

    const bar = chart.querySelector<SVGRectElement>("rect[data-bar]");
    if (!bar) {
      throw new Error("bar datapoint not found");
    }

    // Clicking the bar fires its own handler…
    await userEvent.click(bar);
    await waitFor(() => expect(chart.dataset.barClicks).toBe("1"));
    // …and must NOT replay the reveal.
    expect(Number(chart.dataset.playCount)).toBe(initialPlays);

    // Clicking anywhere else on the chart body DOES replay.
    await userEvent.click(chart);
    await waitFor(() => expect(Number(chart.dataset.playCount)).toBeGreaterThan(initialPlays));

    // --- keyboard path (#176) ------------------------------------------------
    // The control is a real button with an accessible name that says what it
    // does, and it is NOT inside an `aria-hidden` subtree (which is what makes
    // the axe `aria-hidden-focus` rule stay clean on a real chart, whose body
    // is `aria-hidden="true"`).
    const replayButton = canvas.getByRole("button", { name: "Replay reveal" });
    expect(replayButton.closest('[aria-hidden="true"]')).toBeNull();

    // Reachable by Tab alone — no pointer involved from here on.
    await userEvent.tab();
    expect(replayButton).toHaveFocus();

    const beforeEnter = Number(chart.dataset.playCount);
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(Number(chart.dataset.playCount)).toBeGreaterThan(beforeEnter));

    const beforeSpace = Number(chart.dataset.playCount);
    await userEvent.keyboard(" ");
    await waitFor(() => expect(Number(chart.dataset.playCount)).toBeGreaterThan(beforeSpace));
  },
};
