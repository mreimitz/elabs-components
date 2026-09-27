"use client";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ReactNode } from "react";
import { expect, waitFor } from "storybook/test";
import { contrastRgb, paintedSrgb } from "./on-mark-ink.story-measure";
import type { ChartDatapoint } from "./chart-datapoint";
import { Ring } from "./ring";
import { RingCenter } from "./ring-center";
import { RingChart } from "./ring-chart";

const meta = {
  title: "Charts/RingChart",
  component: RingChart,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof RingChart>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Channel breakdown: value + maxValue drive progress per ring (--chart-1..12 tokens). */
const ringData = [
  { label: "Email", value: 42, maxValue: 100 },
  { label: "Social", value: 28, maxValue: 100 },
  { label: "Direct", value: 18, maxValue: 100 },
  { label: "Other", value: 12, maxValue: 100 },
];

export const Default: Story = {
  render: (args) => (
    <div className="h-72 w-[280px]">
      <RingChart {...args}>
        {ringData.map((item, i) => (
          <Ring index={i} key={item.label} />
        ))}
        <RingCenter defaultLabel="Channels" />
      </RingChart>
    </div>
  ),
  args: {
    data: ringData,
    strokeWidth: 14,
  },
};

/** Loading skeleton (RM-183) — shown while `status="loading"`, sized like the real chart. */
export const Loading: Story = {
  render: (args) => (
    <div className="h-72 w-[280px]">
      <RingChart {...args}>
        {ringData.map((item, i) => (
          <Ring index={i} key={item.label} />
        ))}
        <RingCenter defaultLabel="Channels" />
      </RingChart>
    </div>
  ),
  args: {
    data: ringData,
    strokeWidth: 14,
    status: "loading",
  },
  play: async ({ canvas }) => {
    // One `role="status" aria-live="polite"` region while loading, and only
    // one — the RM-183 review flagged loading plays that checked the role
    // but not the live-region contract or region count.
    const statuses = await canvas.findAllByRole("status");
    expect(statuses).toHaveLength(1);
    expect(statuses[0]).toHaveAttribute("aria-live", "polite");
  },
};

/** Fixed pixel size — bypasses ParentSize and uses a concrete dimension. */
export const FixedSize: Story = {
  render: (args) => (
    <RingChart {...args}>
      {ringData.map((item, i) => (
        <Ring index={i} key={item.label} />
      ))}
      <RingCenter defaultLabel="Channels" />
    </RingChart>
  ),
  args: {
    data: ringData,
    size: 280,
    strokeWidth: 14,
  },
};

/** Accessible variant — announces label + description to screen readers on focus. */
export const WithAccessibleLabel: Story = {
  render: (args) => (
    <div className="h-72 w-[280px]">
      <RingChart {...args}>
        {ringData.map((item, i) => (
          <Ring index={i} key={item.label} />
        ))}
        <RingCenter defaultLabel="Channels" />
      </RingChart>
    </div>
  ),
  args: {
    data: ringData,
    strokeWidth: 14,
    accessibleLabel: "Channel performance ring chart",
    accessibleDescription: "Email 42%, Social 28%, Direct 18%, Other 12%.",
  },
};

/** Fewer rings at different fill levels. */
export const PartialFill: Story = {
  render: (args) => (
    <div className="h-72 w-[280px]">
      <RingChart {...args}>
        {(args.data as typeof ringData).map((item, i) => (
          <Ring index={i} key={item.label} />
        ))}
        <RingCenter defaultLabel="Progress" />
      </RingChart>
    </div>
  ),
  args: {
    data: [
      { label: "Tasks done", value: 73, maxValue: 100 },
      { label: "Reviews", value: 40, maxValue: 100 },
      { label: "Deploys", value: 12, maxValue: 100 },
    ],
    strokeWidth: 14,
  },
};

// #349: drill-down on a ring. Same contract as every other family.
function RingDrilldownDemo() {
  const [selected, setSelected] = useState<ChartDatapoint | null>(null);
  return (
    <div className="flex w-[320px] flex-col gap-3">
      <RingChart
        accessibleLabel="Channel breakdown"
        data={ringData}
        onDatapointClick={(point) => setSelected(point)}
        size={280}
      >
        {ringData.map((ring, index) => (
          <Ring index={index} key={ring.label} />
        ))}
      </RingChart>
      <output className="rounded-md border border-border bg-card px-3 py-2 text-body text-card-foreground">
        {selected
          ? `${String(selected.category)} · ${selected.value} (via ${selected.source})`
          : "Select a ring to drill in."}
      </output>
    </div>
  );
}

/** Click a ring — or Tab in and press Enter — to drill into it. */
export const Drilldown: Story = {
  render: () => <RingDrilldownDemo />,
};

// ── TickRing — 100-tick procedural rendering at high decoration (lieflat F4,
// #RM-030) ───────────────────────────────────────────────────────────────
//
// At `data-decoration >= 8` RingChart swaps its smooth concentric arcs for
// one unified ring of exactly 100 radial ticks — "1 tick = 1%" — divided
// among the series by their share of the total, with a dot every 10th tick
// and (via `labels="outside"`) dotted leader lines to outside labels.
// Pinned to decoration 10 via BOTH the story `globals` (Storybook toolbar /
// preview) and an in-render `data-decoration="10"` wrapper (the
// `test-storybook` / addon-vitest runner never applies story `globals`, only
// the rendered DOM attribute — see series-pattern.stories.tsx).

export const TickRing: Story = {
  globals: { decoration: "10" },
  render: (args) => (
    <div className="rounded-lg bg-card p-8" data-decoration="10">
      <div className="h-72 w-[280px]">
        <RingChart {...args}>
          {ringData.map((item, i) => (
            <Ring index={i} key={item.label} />
          ))}
          <RingCenter defaultLabel="Channels" />
        </RingChart>
      </div>
    </div>
  ),
  args: {
    data: ringData,
    strokeWidth: 14,
    labels: "outside",
  },
  play: async ({ canvasElement }) => {
    // Fixed-size-vs-ParentSize timing (#289): the high-decoration signal
    // settles a frame after mount — waitFor asserts the settled render.
    await waitFor(() => {
      const svgEl = canvasElement.querySelector("svg");
      expect(svgEl).not.toBeNull();

      // Exactly 100 ticks around the ring ("1 tick = 1%").
      const ticks = canvasElement.querySelectorAll("[data-tick-ring-tick]");
      expect(ticks.length).toBe(100);

      // A dot every 10th tick.
      expect(canvasElement.querySelectorAll("[data-tick-ring-dot]").length).toBe(10);

      // Every series gets a dotted Leader line + outside label (labels="outside").
      expect(canvasElement.querySelectorAll("[data-tick-ring-leader]").length).toBe(
        ringData.length,
      );

      // ringData's values (42/28/18/12) sum to exactly 100 — segments' tick
      // counts equal round(share) with zero rounding remainder, and the
      // caption states that plainly.
      const caption = canvasElement.querySelector("[data-tick-ring-caption]");
      expect(caption).not.toBeNull();
      expect(caption?.textContent).toBe("100 ticks — segments sum exactly to 100.");

      // Original smooth-arc <Ring> paths are swapped out in tick mode.
      expect(svgEl!.querySelectorAll("path").length).toBe(0);

      // Centre value (RingCenter) is unchanged by tick mode.
      expect(canvasElement.textContent).toContain("Channels");
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
 * `selectionStates` paints the host’s tri-state on rings: selected marks carry a
 * compound foreground/background outline, excluded marks dim AND carry a full-opacity dashed frame, so the three
 * states stay distinguishable in greyscale.
 */
const selectionRings = [
  { label: "EMEA", value: 42, maxValue: 60 },
  { label: "APAC", value: 31, maxValue: 60 },
  { label: "AMER", value: 55, maxValue: 60 },
];

export const SelectionStates: Story = {
  name: "Selection states",
  parameters: { layout: "padded" },
  args: { data: selectionRings, children: null },
  render: () => (
    <SelectionProof className="w-full max-w-[320px]">
      <RingChart
        accessibleLabel="Regional attainment with a selection applied"
        data={selectionRings}
        selectionStates={selectionByRegion}
        size={280}
      >
        {selectionRings.map((ring, index) => (
          <Ring animate={false} index={index} key={ring.label} />
        ))}
      </RingChart>
    </SelectionProof>
  ),
  play: async ({ canvasElement }) => {
    await expectSelectionStates(canvasElement);
  },
};
