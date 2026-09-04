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
          "scrolled into view) and `replayOnClick` (click to replay), demonstrated on the " +
          "primitive itself. Not a chart to render data with — for that, see `Charts/LineChart` " +
          "(this feature isn't wired into `LineChart`'s public props yet).",
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
  const clipId = `reveal-demo-${testId}`;

  return (
    <div
      className="relative w-full max-w-xl rounded-md border border-border bg-card p-4"
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

/** `replayOnClick`: clicking the chart body replays the reveal; clicking the
 * "bar" datapoint fires its own handler and does NOT replay. */
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
  },
};
