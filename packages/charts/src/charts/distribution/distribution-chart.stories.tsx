import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fireEvent, waitFor, within } from "storybook/test";
import { seededRnd } from "../../marks/seeded-rnd";
import { DistributionChart } from "./distribution-chart";

const meta = {
  title: "Charts/DistributionChart",
  component: DistributionChart,
  tags: ["autodocs"],
} satisfies Meta<typeof DistributionChart>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * ONE dataset behind every story on this page — first-reply time in minutes for
 * three support queues. The four marks below are four readings of exactly these
 * numbers, so switching story is switching `kind`, never switching data.
 *
 * The shape is deliberate and is what makes the comparison worth drawing: reply
 * times are right-skewed (most replies are quick, a few take hours), Billing is
 * BIMODAL (a fast path and a slow escalation path), and Onboarding is tight.
 * A box plot cannot show that second fact at all — the violin can.
 */
function replyTimes(
  n: number,
  seed: number,
  team: string,
  shape: (u: number, i: number) => number,
) {
  return Array.from({ length: n }, (_value, index) => ({
    id: `${team}-${index}`,
    team,
    minutes: Math.round(shape(seededRnd(index, seed), index) * 10) / 10,
  }));
}

const REPLIES = [
  // Right-skewed: squaring a uniform draw piles the mass at the fast end.
  ...replyTimes(140, 3, "Support", (u) => 4 + u * u * 190),
  // Bimodal: a fast path and an escalation path, ~40% of tickets on the slow one.
  ...replyTimes(120, 11, "Billing", (u, i) => (seededRnd(i, 12) < 0.4 ? 95 + u * 70 : 6 + u * 34)),
  // Tight and quick.
  ...replyTimes(90, 23, "Onboarding", (u) => 3 + u * 26),
];

const SUPPORT_ONLY = REPLIES.filter((row) => row.team === "Support");

/** The interaction-budget fixture: one queue, two thousand replies. */
const DENSE = replyTimes(2000, 41, "Support", (u) => 4 + u * u * 190);

/**
 * **F14 — rung histogram.** `unit` turns each bin into COUNTABLE rungs instead of
 * a bar: one rung is five tickets, so the reader can count the tall bin rather
 * than measure it against an axis. The dashed flag is the median.
 *
 * Reach for a histogram when the bin EDGES carry meaning — here the first bucket
 * is "under 15 minutes", which is the queue's actual promise.
 */
export const RungHistogram: Story = {
  name: "F14 · Rung histogram",
  render: () => (
    <div className="h-72 w-[640px]">
      <DistributionChart
        accessibleLabel="First-reply time, Support queue"
        bins={[0, 15, 30, 45, 60, 90, 120, 160, 200]}
        data={SUPPORT_ONLY}
        kind="histogram"
        unit={5}
        valueFormat="number"
        valueKey="minutes"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(
        canvasElement.querySelector('[data-slot="distribution-chart-histogram"]'),
      ).not.toBeNull();
    });
    // Countable, not measured: the bin is drawn as a stack of unit rungs.
    expect(canvasElement.querySelectorAll('[data-slot="unit-stack"]').length).toBeGreaterThan(0);
    expect(canvasElement.querySelector('[data-slot="distribution-chart-median"]')).not.toBeNull();
  },
};

/**
 * **F15 — tick box.** The five-number summary, three queues, one scale. The
 * median is cut through the capsule in the paper colour rather than drawn as a
 * darker line, so it reads at a glance without adding a fourth ink. Marks past
 * 1.5 × IQR are hollow.
 *
 * This is the compact reading: it answers "which queue is slower" in one look —
 * and hides Billing's two populations completely. That is the trade, and it is
 * why the violin below exists.
 */
export const TickBox: Story = {
  name: "F15 · Tick box",
  render: () => (
    <div className="h-72 w-[640px]">
      <DistributionChart
        accessibleLabel="First-reply time by queue"
        data={REPLIES}
        groupKey="team"
        kind="box"
        valueFormat="number"
        valueKey="minutes"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(canvasElement.querySelectorAll('[data-slot="distribution-chart-box"]')).toHaveLength(
        3,
      );
    });
    // One axis for all three queues — the comparison is the whole point.
    expect(canvasElement.querySelectorAll('[data-slot="distribution-chart-axis"]')).toHaveLength(1);
    // The five-number summary reaches assistive tech as text, not only as a shape.
    const figure = within(canvasElement).getByRole("figure", {
      name: "First-reply time by queue",
    });
    expect(figure).toHaveAccessibleDescription(/median/i);
  },
};

/**
 * **G19 — violin.** The same three queues as a mirrored density silhouette.
 * Billing's two bulges are the fact the box plot above cannot show: a fast path
 * and an escalation path, not one slow queue.
 *
 * Each violin is scaled to its own band, so WIDTH is shape, never n — the group
 * label and the text summary carry the record count instead.
 */
export const Violin: Story = {
  name: "G19 · Violin",
  render: () => (
    <div className="h-72 w-[640px]">
      <DistributionChart
        accessibleLabel="First-reply time by queue, as a density"
        data={REPLIES}
        groupKey="team"
        kind="violin"
        valueFormat="number"
        valueKey="minutes"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(
        canvasElement.querySelectorAll('[data-slot="distribution-chart-violin"]'),
      ).toHaveLength(3);
    });
    // A silhouette, not a bar: the outline is a smoothed path, not a rect.
    const outline = canvasElement.querySelector('[data-slot="distribution-chart-violin"] path');
    expect(outline?.getAttribute("d")).toContain("Q");
  },
};

/**
 * **G15 — jitter strip.** Every ticket, one dot, jittered off the row's centre
 * line by a SEEDED offset so the same record lands in the same place on every
 * render. Nothing is aggregated away — the two Billing populations are visible
 * as two clouds, and each dot is a real record you can click.
 *
 * Reach for a strip up to roughly 150 records per group; past that the ink
 * saturates and the violin is the honest reading.
 */
export const JitterStrip: Story = {
  name: "G15 · Jitter strip",
  render: function JitterStripStory() {
    const [picked, setPicked] = useState<string | null>(null);
    return (
      <div className="flex w-[640px] flex-col gap-2">
        <div className="h-72">
          <DistributionChart
            accessibleLabel="Every first reply, by queue"
            data={REPLIES}
            datapointLabel={(point) => `${point.label}: ${point.value} minutes`}
            groupKey="team"
            kind="strip"
            onDatapointClick={(point) => setPicked(`${point.label} · ${point.value} min`)}
            valueFormat="number"
            valueKey="minutes"
          />
        </div>
        <p className="text-meta text-muted-foreground">
          {picked ? `Picked ${picked}` : "Pick a reply — click one, or tab in and use the arrows."}
        </p>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(
        canvasElement.querySelectorAll('[data-slot="distribution-chart-record"]').length,
      ).toBeGreaterThan(300);
    });
    // Colour and position are not the only channels: every record is a real
    // button OUTSIDE the aria-hidden svg, so the strip is keyboard-reachable.
    // The layer subscribes to the target store, so it lands one commit after
    // the dots — waited for, not assumed.
    await waitFor(() => {
      expect(
        canvasElement.querySelectorAll('[data-slot="chart-datapoint-layer-target"]').length,
      ).toBe(REPLIES.length);
    });
    const targets = canvasElement.querySelectorAll('[data-slot="chart-datapoint-layer-target"]');
    expect(targets[0]?.tagName).toBe("BUTTON");
    // Exactly one tab stop for the whole strip (roving tabindex).
    expect([...targets].filter((node) => (node as HTMLButtonElement).tabIndex === 0)).toHaveLength(
      1,
    );
  },
};

/**
 * Vertical orientation and a sequential palette: with `palette="sequential"` a
 * box's shade is its MEDIAN RANK, so the ordering is carried by the fill as well
 * as by position — useful when the groups are read out of order.
 */
export const VerticalSequential: Story = {
  render: () => (
    <div className="h-80 w-[560px]">
      <DistributionChart
        accessibleLabel="First-reply time by queue, ranked"
        data={REPLIES}
        groupKey="team"
        kind="box"
        orientation="vertical"
        palette="sequential"
        valueFormat="number"
        valueKey="minutes"
      />
    </div>
  ),
};

/**
 * Two thousand replies, one queue. Past roughly 150 records per group a strip's
 * ink saturates and the violin is the honest reading — this story exists to
 * prove the interaction budget rather than to recommend the picture.
 *
 * The hover is measured in the browser, where 16 ms is a frame: the marks are
 * memoized behind a stable hover callback, so moving the pointer costs one
 * tooltip, never a redraw of two thousand circles.
 */
export const DenseStrip: Story = {
  render: () => (
    <div className="h-72 w-[640px]">
      <DistributionChart
        accessibleLabel="Two thousand replies"
        data={DENSE}
        kind="strip"
        valueFormat="number"
        valueKey="minutes"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(
        canvasElement.querySelectorAll('[data-slot="distribution-chart-record"]'),
      ).toHaveLength(DENSE.length);
    });
    const dots = canvasElement.querySelectorAll('[data-slot="distribution-chart-record"]');
    const dot = dots[1000] as SVGCircleElement;

    // Warm the path once, then measure — the first hover also mounts the
    // tooltip, which is not what the frame budget is about.
    fireEvent.pointerEnter(dot);
    await waitFor(() => {
      expect(canvasElement.textContent).toContain("minutes");
    });
    const start = performance.now();
    fireEvent.pointerEnter(dots[1400] as SVGCircleElement);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(16);

    // The strip itself was not redrawn: same nodes, after the hover.
    expect(canvasElement.querySelectorAll('[data-slot="distribution-chart-record"]')[1000]).toBe(
      dot,
    );
  },
};
