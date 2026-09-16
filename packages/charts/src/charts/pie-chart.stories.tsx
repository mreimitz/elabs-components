"use client";

import { DecorationProvider } from "@elabs-ai/components-tokens";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { ChartDatapoint } from "./chart-datapoint";
import { PieChart } from "./pie-chart";
import { PieCenter } from "./pie-center";
import { PieSlice } from "./pie-slice";

const meta = {
  title: "Charts/PieChart",
  component: PieChart,
  tags: ["autodocs"],
} satisfies Meta<typeof PieChart>;

export default meta;
type Story = StoryObj<typeof meta>;

const trafficData = [
  { label: "Direct", value: 320 },
  { label: "Organic", value: 280 },
  { label: "Referral", value: 190 },
  { label: "Social", value: 140 },
  { label: "Other", value: 70 },
];

/** Solid pie with token-driven slice colors (--chart-1..12) */
export const Default: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <PieChart data={trafficData} size={280}>
        {trafficData.map((item, i) => (
          <PieSlice index={i} key={item.label} />
        ))}
      </PieChart>
    </div>
  ),
};

/** Donut with a center label showing total / hovered slice value */
export const Donut: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <PieChart data={trafficData} innerRadius={80} size={280}>
        {trafficData.map((item, i) => (
          <PieSlice index={i} key={item.label} />
        ))}
        <PieCenter defaultLabel="Traffic" />
      </PieChart>
    </div>
  ),
};

/** Donut with rounded corners and a gap between slices */
export const RoundedGap: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <PieChart cornerRadius={6} data={trafficData} innerRadius={70} padAngle={0.03} size={280}>
        {trafficData.map((item, i) => (
          <PieSlice index={i} key={item.label} />
        ))}
        <PieCenter defaultLabel="Traffic" />
      </PieChart>
    </div>
  ),
};

/** Accessible variant — announces label + description to screen readers on focus. */
export const WithAccessibleLabel: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <PieChart
        data={trafficData}
        innerRadius={80}
        size={280}
        accessibleLabel="Website traffic by channel — pie chart"
        accessibleDescription="Direct 320, Organic 280, Referral 190, Social 140, Other 70."
      >
        {trafficData.map((item, i) => (
          <PieSlice index={i} key={item.label} />
        ))}
        <PieCenter defaultLabel="Traffic" />
      </PieChart>
    </div>
  ),
};

// #349: drill-down. The slice carries the pointer click; the keyboard targets
// are real <button>s in a sibling layer outside the aria-hidden SVG.
function PieDrilldownDemo() {
  const [selected, setSelected] = useState<ChartDatapoint | null>(null);
  return (
    <div className="flex w-[320px] flex-col gap-3">
      <PieChart
        accessibleLabel="Traffic by source"
        data={trafficData}
        onDatapointClick={(point) => setSelected(point)}
        size={280}
      >
        {trafficData.map((slice, index) => (
          <PieSlice index={index} key={slice.label} />
        ))}
      </PieChart>
      <output className="rounded-md border border-border bg-card px-3 py-2 text-body text-card-foreground">
        {selected
          ? `${String(selected.category)} · ${selected.value} (via ${selected.source})`
          : "Select a slice to drill in."}
      </output>
    </div>
  );
}

/** Click a slice — or Tab in and press Enter — to drill into it. */
export const Drilldown: Story = {
  render: () => <PieDrilldownDemo />,
};

// ── BigSlice — radiusKey / referenceRings / seams (lieflat G13, #RM-030) ────
//
// Angle = share of meetings (`value`), radius = average minutes/day
// (`radiusKey="minutes"`) — a second measure double-encoded onto the same
// slices, area-honest via `sqrt(v / max)`. Dashed reference rings mark
// 15/30/45 minute levels; `seams` draws a 3px paper-seam stroke between
// slices. Hovering a slice swaps the donut's center label (`PieCenter`'s
// render-prop) from the chart total to that slice's BOTH measures — the
// "tooltip" the acceptance criterion asks for.

const meetingsData = [
  { label: "Standups", value: 8, minutes: 10 },
  { label: "1:1s", value: 6, minutes: 25 },
  { label: "Planning", value: 4, minutes: 60 },
  { label: "Deep work review", value: 3, minutes: 90 },
  { label: "All-hands", value: 2, minutes: 45 },
];

/**
 * Slice radius encodes a SECOND measure (average minutes/day), proportional
 * to `sqrt(minutes / maxMinutes)` so equal-AREA differences read as equal
 * magnitude differences. "Deep work review" (90 min) renders at the chart's
 * full outer radius; every other slice shrinks under it. Hover a slice to see
 * both measures (count + minutes) in the center label.
 */
export const BigSlice: Story = {
  render: () => (
    <div className="h-80 w-[560px]">
      <PieChart
        data={meetingsData}
        innerRadius={70}
        radiusKey="minutes"
        referenceRings={[15, 30, 45]}
        seams={3}
        size={320}
      >
        {meetingsData.map((item, i) => (
          <PieSlice index={i} key={item.label} />
        ))}
        <PieCenter defaultLabel="Meeting types">
          {({ label, data, value }) => {
            const minutes = (data as unknown as { minutes?: number }).minutes;
            return (
              <div className="flex flex-col items-center gap-0.5 text-center">
                <span className="text-caption text-muted-foreground">{label}</span>
                <span className="text-title tabular-nums text-card-foreground">
                  {value}&nbsp;/&nbsp;day
                </span>
                {typeof minutes === "number" ? (
                  <span className="text-meta tabular-nums text-muted-foreground">
                    {minutes}&nbsp;min/day
                  </span>
                ) : null}
              </div>
            );
          }}
        </PieCenter>
      </PieChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Slice radius double-encoding: the max-minutes slice ("Deep work review",
    // index 3) renders at the chart's full outer radius; a smaller-minutes
    // slice (index 0, "Standups", the smallest) must shrink under it — the
    // scaled slice's hitbox path differs from what it would be at full radius.
    const hitboxes = canvasElement.querySelectorAll('path[fill="transparent"]');
    expect(hitboxes.length).toBe(meetingsData.length);

    // Hover the smallest-minutes slice — the center label should swap from
    // the chart total to that slice's own label, count AND minutes (both
    // measures — the acceptance criterion).
    const firstHitbox = hitboxes[0];
    if (firstHitbox) {
      await userEvent.hover(firstHitbox);
    }

    await waitFor(() => {
      expect(canvas.getByText("Standups")).toBeInTheDocument();
      expect(canvas.getByText("8 / day")).toBeInTheDocument();
      expect(canvas.getByText("10 min/day")).toBeInTheDocument();
    });

    // Resting state (#246): the story used to end mid-hover, so every
    // screenshot and visual review judged the DIMMED render — one slice
    // glowing, the other four stuck at opacity 0.4, with the reference rings
    // bleeding through them. A synthetic `hover` never fires the matching
    // `mouseleave`, so releasing it explicitly is required for the chart to
    // ever reach the state a real visitor sees once the pointer moves on.
    if (firstHitbox) {
      await userEvent.unhover(firstHitbox);
    }

    await waitFor(() => {
      expect(canvas.getByText("Meeting types")).toBeInTheDocument();
    });

    await waitFor(() => {
      const visiblePaths = Array.from(
        canvasElement.querySelectorAll("g > path:not([fill='transparent'])"),
      );
      expect(visiblePaths.length).toBe(meetingsData.length);
      for (const path of visiblePaths) {
        expect(getComputedStyle(path).opacity).toBe("1");
      }
    });
  },
};

/**
 * The pie at decoration 10 (#255). Every palette slice gains a series-pattern
 * fill, so `PieChart` renders its `<pattern>` defs from a `.map()` — the path a
 * missing list identity used to warn on. Pinned with `DecorationProvider`
 * rather than a toolbar global so a headless run reaches the branch too.
 */
export const Decorated: Story = {
  render: () => (
    <DecorationProvider className="h-72 w-full max-w-[560px]" level={10}>
      <PieChart data={trafficData} size={280}>
        {trafficData.map((item, i) => (
          <PieSlice index={i} key={item.label} />
        ))}
      </PieChart>
    </DecorationProvider>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const ids = Array.from(canvasElement.querySelectorAll('pattern[id^="bp-series-"]')).map(
        (p) => p.id,
      );
      // The multi-pattern array path really executed (one def per slice)…
      expect(ids.length).toBe(trafficData.length);
      expect(new Set(ids).size).toBe(ids.length);
      // …and every slice paints with one of those defs.
      const refs = Array.from(canvasElement.querySelectorAll('path[fill^="url(#bp-series-"]')).map(
        (p) => (p.getAttribute("fill") ?? "").slice("url(#".length, -1),
      );
      expect(new Set(refs)).toEqual(new Set(ids));
    });
  },
};

// Selection states — RM-073
type SelectionStateName = "selected" | "associated" | "excluded";
const SELECTION_BY_REGION: Record<string, SelectionStateName> = {
  EMEA: "selected",
  APAC: "associated",
  AMER: "excluded",
};
const selectionByRegion = (category: string | number | Date): SelectionStateName =>
  SELECTION_BY_REGION[String(category)] ?? "associated";

/** Asserts the three states read apart without hue: outline, plain, dim + pattern. */
async function expectSelectionStates(root: HTMLElement) {
  await waitFor(() =>
    expect(root.querySelectorAll('[data-selection="excluded"]').length).toBeGreaterThan(0),
  );
  expect(root.querySelectorAll('[data-selection="associated"]').length).toBeGreaterThan(0);
  for (const node of root.querySelectorAll('[data-selection="selected"]')) {
    expect(node.querySelector('[data-slot$="-outline"]')).not.toBeNull();
  }
  for (const node of root.querySelectorAll<SVGElement>('[data-selection="excluded"]')) {
    const dimmed =
      Number(getComputedStyle(node).opacity) < 1 ||
      node.querySelector('[data-slot$="-veil"]') !== null;
    expect(dimmed).toBe(true);
    expect(
      node.querySelector('[data-slot$="-hatch"], [data-slot$="-dash"], [data-slot$="-hollow"]'),
    ).not.toBeNull();
  }
}

/**
 * `selectionStates` paints the host’s tri-state on slices: selected marks carry a
 * `--ring` outline, excluded marks dim AND carry a non-hue channel, so the three
 * states stay distinguishable in greyscale.
 */
const selectionSlices = [
  { label: "EMEA", value: 42 },
  { label: "APAC", value: 31 },
  { label: "AMER", value: 55 },
];

export const SelectionStates: Story = {
  name: "Selection states",
  args: { data: selectionSlices, children: null },
  render: () => (
    <div className="w-full max-w-[320px]" style={{ filter: "grayscale(1)" }}>
      <PieChart
        accessibleLabel="Revenue share by region with a selection applied"
        data={selectionSlices}
        selectionStates={selectionByRegion}
      >
        {selectionSlices.map((slice, index) => (
          <PieSlice animate={false} index={index} key={slice.label} />
        ))}
      </PieChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expectSelectionStates(canvasElement);
  },
};
