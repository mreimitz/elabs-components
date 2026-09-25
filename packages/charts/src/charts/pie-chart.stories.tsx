"use client";

import { DecorationProvider } from "@elabs-ai/components-tokens";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ReactNode } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { contrastRgb, paintedSrgb } from "./on-mark-ink.story-measure";
import type { ChartDatapoint } from "./chart-datapoint";
import { ChartLegend } from "./chart-legend";
import { PieChart } from "./pie-chart";
import { PieCenter } from "./pie-center";
import { defaultPieColors } from "./pie-context";
import { pieLegendItems } from "./pie-grouping";
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

/**
 * Asserts the three states read apart AS SEEN (#442, #445, #446), in whatever
 * theme the story runs under: every chart copy has real width; a selected
 * mark’s compound outline clears 3:1 against the chart surface, and its better
 * band clears 3:1 against every series fill and the mark’s own painted fill; an
 * excluded mark is dimmed while its dashed frame paints at full opacity and
 * clears 3:1 against the surface.
 */
async function expectSelectionStates(root: HTMLElement) {
  await waitFor(() =>
    expect(root.querySelectorAll('[data-selection="excluded"]').length).toBeGreaterThan(0),
  );
  expect(root.querySelectorAll('[data-selection="associated"]').length).toBeGreaterThan(0);
  const charts = new Set(
    Array.from(root.querySelectorAll("[data-selection]"), (node) => node.closest("svg")),
  );
  for (const svg of charts) {
    expect(svg?.getBoundingClientRect().width ?? 0).toBeGreaterThan(0);
  }
  const style = getComputedStyle(root.querySelector("[data-selection]") as Element);
  const surface = style.getPropertyValue("--chart-background").trim();
  const ground = paintedSrgb(surface, surface);
  const painted = (paint: string) => paintedSrgb(paint, surface);
  const stroke = (el: Element | null) => {
    expect(el).not.toBeNull();
    return painted(getComputedStyle(el as Element).stroke);
  };
  const palette = Array.from({ length: 12 }, (_, i) =>
    style.getPropertyValue(`--chart-${i + 1}`).trim(),
  ).filter(Boolean);
  expect(palette.length).toBeGreaterThanOrEqual(8);
  for (const node of root.querySelectorAll('[data-selection="selected"]')) {
    const outer = stroke(node.querySelector('[data-slot$="-outline"]'));
    const core = stroke(node.querySelector('[data-slot$="-outline-core"]'));
    expect(contrastRgb(outer, ground)).toBeGreaterThanOrEqual(3);
    const own = Array.from(
      node.querySelectorAll(":not([data-slot*='-outline'])"),
      (el) => getComputedStyle(el).fill,
    ).filter((fill) => /^(rgb|oklch|#)/.test(fill) && !/rgba\(0, 0, 0, 0\)/.test(fill));
    for (const fill of [...palette, ...own]) {
      const mark = painted(fill);
      expect(Math.max(contrastRgb(outer, mark), contrastRgb(core, mark))).toBeGreaterThanOrEqual(3);
    }
  }
  for (const node of root.querySelectorAll('[data-selection="excluded"]')) {
    expect(node.querySelector('[data-slot$="-dim"], [data-slot$="-veil"]')).not.toBeNull();
    const frame = node.querySelector('[data-slot$="-frame"]');
    for (let el = frame; el && el !== root; el = el.parentElement) {
      expect(Number(getComputedStyle(el).opacity)).toBe(1);
    }
    expect(contrastRgb(stroke(frame), ground)).toBeGreaterThanOrEqual(3);
  }
}

/** The chart twice, side by side: as authored, then in greyscale (#445). */
function SelectionProof({ children, className }: { children: ReactNode; className: string }) {
  return (
    <div className="grid w-full gap-6 md:grid-cols-2">
      <figure className="m-0 flex min-w-0 flex-col gap-2">
        <figcaption className="text-caption text-muted-foreground">Colour</figcaption>
        <div className={className}>{children}</div>
      </figure>
      <figure className="m-0 flex min-w-0 flex-col gap-2">
        <figcaption className="text-caption text-muted-foreground">Greyscale</figcaption>
        <div className={className} style={{ filter: "grayscale(1)" }}>
          {children}
        </div>
      </figure>
    </div>
  );
}

/**
 * `selectionStates` paints the host’s tri-state on slices: selected marks carry a
 * compound foreground/background outline, excluded marks dim AND carry a full-opacity dashed frame, so the three
 * states stay distinguishable in greyscale.
 */
const selectionSlices = [
  { label: "EMEA", value: 42 },
  { label: "APAC", value: 31 },
  { label: "AMER", value: 55 },
];

export const SelectionStates: Story = {
  name: "Selection states",
  parameters: { layout: "padded" },
  args: { data: selectionSlices, children: null },
  render: () => (
    <SelectionProof className="w-full max-w-[320px]">
      <PieChart
        accessibleLabel="Revenue share by region with a selection applied"
        data={selectionSlices}
        selectionStates={selectionByRegion}
      >
        {selectionSlices.map((slice, index) => (
          <PieSlice animate={false} index={index} key={slice.label} />
        ))}
      </PieChart>
    </SelectionProof>
  ),
  play: async ({ canvasElement }) => {
    await expectSelectionStates(canvasElement);
  },
};

// ── RM-114: labels, groupSmall, sort, half ─────────────────────────────────

const channelData = [
  { label: "Direct", value: 320 },
  { label: "Organic", value: 280 },
  { label: "Referral", value: 190 },
  { label: "Social", value: 140 },
  { label: "Email", value: 70 },
  { label: "Affiliate", value: 20 },
  { label: "Paid", value: 12 },
  { label: "Other channel", value: 8 },
];

/**
 * Eight channels folded to five + "Other" (`groupSmall={{ max: 5 }}`), with
 * outside labels + leaders and a legend built from the same fold
 * (`pieLegendItems`, RM-114). Resize the canvas: at `narrow` (< 480 px) the
 * label layer's responsive default (`{ base: "outside", narrow: "none" }`)
 * drops out and the legend — six rows, one per folded slice — carries the
 * read instead.
 */
export const GroupedWithOutsideLabels: Story = {
  name: "Grouped with outside labels",
  parameters: { layout: "padded" },
  render: () => {
    const legendItems = pieLegendItems(channelData, {
      groupSmall: { max: 5 },
      getColor: (i) => defaultPieColors[i % defaultPieColors.length] as string,
    });
    return (
      <div className="flex w-full max-w-3xl flex-col gap-4 sm:flex-row">
        <div className="h-80 min-w-0 flex-1">
          <PieChart
            accessibleLabel="Traffic by channel, grouped to five channels plus Other"
            data={channelData}
            groupSmall={{ max: 5 }}
            labels={{ placement: { base: "outside", narrow: "none" }, show: ["label", "percent"] }}
          >
            {null}
          </PieChart>
        </div>
        <ChartLegend
          className="shrink-0"
          items={legendItems}
          showPercentage
          valueFormat="compact"
        />
      </div>
    );
  },
};

/**
 * Inside percentages: painted above `minAngle`, hidden below it (the
 * "Fourpercent" slice — sweep ≈ 0.063 rad, well under the default 0.2).
 */
export const InsidePercentLabels: Story = {
  name: "Inside percent labels",
  render: () => {
    const data = [
      { label: "Fourpercent", value: 1 },
      { label: "A", value: 33 },
      { label: "B", value: 33 },
      { label: "C", value: 33 },
    ];
    return (
      <div className="h-72 w-full max-w-[560px]">
        <PieChart
          accessibleLabel="Four shares, one below the label's minimum angle"
          data={data}
          labels={{ placement: "inside", show: ["percent"] }}
          size={280}
        >
          {data.map((item, i) => (
            <PieSlice animate={false} index={i} key={item.label} />
          ))}
        </PieChart>
      </div>
    );
  },
};

/**
 * Outside labels painted in the slice's own colour (`matchColor: true`,
 * #544) — routed through `seriesLabelInk` so the ink stays legible: measured
 * live against `--chart-background` clears AA (≥4.5:1) in whatever theme the
 * story runs under, not just the raw series colour (which fails 4.5:1 in 17
 * of 18 shipped themes).
 */
export const MatchColorLabels: Story = {
  name: "Match-color labels (#544)",
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <PieChart
        accessibleLabel="Traffic by channel, labels painted in each slice's own colour"
        data={trafficData}
        labels={{ placement: "outside", show: ["label", "percent"], matchColor: true }}
        size={280}
      >
        {trafficData.map((item, i) => (
          <PieSlice animate={false} index={i} key={item.label} />
        ))}
      </PieChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const items = await waitFor(() => {
      const found = canvasElement.querySelectorAll('[data-slot="pie-labels-item"]');
      expect(found.length).toBeGreaterThan(0);
      return found;
    });
    const ground = getComputedStyle(canvasElement.querySelector("svg") as Element)
      .getPropertyValue("--chart-background")
      .trim();
    const groundRgb = paintedSrgb(ground, ground);
    for (const item of Array.from(items)) {
      const ink = paintedSrgb(getComputedStyle(item).fill, ground);
      expect(contrastRgb(ink, groundRgb)).toBeGreaterThanOrEqual(4.5);
    }
  },
};

const electionData = [
  { label: "Party A", value: 48, color: "var(--chart-1)" },
  { label: "Party B", value: 12, color: "var(--chart-3)" },
  { label: "Party C", value: 40, color: "var(--chart-2)" },
];

/**
 * The "election donut" preset — a 180° arc seated in data order (`sort`
 * defaults to `"none"` once `half` is set), centre value below the arc.
 */
export const HalfDonut: Story = {
  name: "Half donut",
  render: () => (
    <div className="h-56 w-full max-w-[560px]">
      <PieChart
        accessibleLabel="Seats by party, half-donut"
        data={electionData}
        half
        innerRadius={90}
        size={280}
      >
        {electionData.map((item, i) => (
          <PieSlice animate={false} index={i} key={item.label} />
        ))}
        <PieCenter defaultLabel="Seats" />
      </PieChart>
    </div>
  ),
};

/**
 * Container legend (RM-118): `legend` mounts `ChartLegend` above the plot,
 * one swatch per slice in data order. Hover only (R3) — hovering or
 * focusing a row reuses Pie's own existing single-slice hover state, the
 * same one a pointer hovering a slice already drives; there is no
 * toggle/hide affordance for Pie yet (an `interactive: "toggle"` request
 * downgrades to `"hover"`). At `narrow` the legend keeps its position but
 * stacks one item per line.
 */
export const LegendHoverOnly: Story = {
  name: "Legend, hover only",
  render: () => (
    <div className="h-72 w-full max-w-[420px]">
      <PieChart data={trafficData} legend size={280}>
        {trafficData.map((item, i) => (
          <PieSlice animate={false} index={i} key={item.label} />
        ))}
      </PieChart>
    </div>
  ),
};
