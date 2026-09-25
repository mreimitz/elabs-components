import type { ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { curveNatural } from "@visx/curve";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { seededRnd } from "../marks/seeded-rnd";
import { SELECTION_EXCLUDED_OPACITY } from "./chart-selection";
import { contrastRgb, paintedSrgb } from "./on-mark-ink.story-measure";
import { AreaChart } from "./area-chart";
import { Area } from "./area";
import { Grid } from "./grid";
import { XAxis } from "./x-axis";
import { YAxis } from "./y-axis";
import { ChartTooltip } from "./tooltip";

const meta = {
  title: "Charts/AreaChart",
  component: AreaChart,
  tags: ["autodocs"],
} satisfies Meta<typeof AreaChart>;

export default meta;
type Story = StoryObj<typeof meta>;

const chartData = [
  { date: new Date("2024-01-01"), desktop: 186, mobile: 80 },
  { date: new Date("2024-02-01"), desktop: 305, mobile: 200 },
  { date: new Date("2024-03-01"), desktop: 237, mobile: 120 },
  { date: new Date("2024-04-01"), desktop: 73, mobile: 190 },
  { date: new Date("2024-05-01"), desktop: 209, mobile: 130 },
  { date: new Date("2024-06-01"), desktop: 214, mobile: 140 },
];

export const Default: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <AreaChart
        data={chartData}
        animationDuration={0}
        aspectRatio={undefined}
        style={{ height: "100%" }}
      >
        <Grid horizontal />
        <Area
          dataKey="desktop"
          curve={curveNatural}
          strokeWidth={2.5}
          fill="var(--chart-1)"
          stroke="var(--chart-1)"
          fillOpacity={0.4}
        />
        <XAxis />
        <ChartTooltip />
      </AreaChart>
    </div>
  ),
};

export const MultiSeries: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <AreaChart
        data={chartData}
        animationDuration={0}
        aspectRatio={undefined}
        style={{ height: "100%" }}
      >
        <Grid horizontal />
        <Area
          dataKey="desktop"
          curve={curveNatural}
          strokeWidth={2}
          fill="var(--chart-1)"
          stroke="var(--chart-1)"
          fillOpacity={0.3}
        />
        <Area
          dataKey="mobile"
          curve={curveNatural}
          strokeWidth={2}
          fill="var(--chart-2)"
          stroke="var(--chart-2)"
          fillOpacity={0.3}
        />
        <XAxis />
        <ChartTooltip />
      </AreaChart>
    </div>
  ),
};

/** Accessible variant — announces label + description to screen readers on focus. */
export const WithAccessibleLabel: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <AreaChart
        data={chartData}
        animationDuration={0}
        aspectRatio={undefined}
        style={{ height: "100%" }}
        accessibleLabel="Desktop vs mobile usage — area chart"
        accessibleDescription="Series: Desktop (73–305), Mobile (80–200). Date range: Jan–Jun 2024."
      >
        <Grid horizontal />
        <Area
          dataKey="desktop"
          curve={curveNatural}
          strokeWidth={2}
          fill="var(--chart-1)"
          stroke="var(--chart-1)"
          fillOpacity={0.3}
        />
        <Area
          dataKey="mobile"
          curve={curveNatural}
          strokeWidth={2}
          fill="var(--chart-2)"
          stroke="var(--chart-2)"
          fillOpacity={0.3}
        />
        <XAxis />
        <ChartTooltip />
      </AreaChart>
    </div>
  ),
};

export const Loading: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <AreaChart
        data={[]}
        status="loading"
        loadingLabel="Loading data…"
        animationDuration={0}
        aspectRatio={undefined}
        style={{ height: "100%" }}
      >
        <Grid horizontal />
        <Area dataKey="desktop" fill="var(--chart-1)" stroke="var(--chart-1)" />
        <XAxis />
      </AreaChart>
    </div>
  ),
};

// #352: a non-temporal ordered x dimension (step index) on an area chart.
// `xScale="band"` keeps the caller's own labels on the axis and in the tooltip.
const categoricalXData = [
  { step: "Ingest", desktop: 186, mobile: 80 },
  { step: "Parse", desktop: 305, mobile: 200 },
  { step: "Embed", desktop: 237, mobile: 120 },
  { step: "Index", desktop: 173, mobile: 190 },
  { step: "Serve", desktop: 209, mobile: 130 },
];

export const CategoricalXScale: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <AreaChart
        animationDuration={0}
        aspectRatio={undefined}
        data={categoricalXData}
        style={{ height: "100%" }}
        xDataKey="step"
        xScale="band"
      >
        <Grid horizontal />
        <Area
          curve={curveNatural}
          dataKey="desktop"
          fill="var(--chart-1)"
          fillOpacity={0.2}
          stroke="var(--chart-1)"
          strokeWidth={2.5}
        />
        <XAxis />
        <ChartTooltip />
      </AreaChart>
    </div>
  ),
};

// ── RM-029: streamgraph offset + hairline decoration ──────────────────────

// F16 lieflat "Stream Ribbon": 2–5 series composition over continuous time
// with a silhouette baseline, each band labelled at its widest point.
const streamData = [
  { date: new Date("2024-01-01"), desktop: 186, tablet: 80, mobile: 40 },
  { date: new Date("2024-02-01"), desktop: 305, tablet: 200, mobile: 60 },
  { date: new Date("2024-03-01"), desktop: 237, tablet: 120, mobile: 90 },
  { date: new Date("2024-04-01"), desktop: 173, tablet: 190, mobile: 110 },
  { date: new Date("2024-05-01"), desktop: 209, tablet: 130, mobile: 70 },
  { date: new Date("2024-06-01"), desktop: 214, tablet: 140, mobile: 100 },
];

/**
 * `AreaChart offset="silhouette"` — three product lines composed into a
 * streamgraph, centered around zero rather than a hard baseline. Band order
 * (bottom → top) follows JSX order: desktop, tablet, mobile.
 */
export const Streamgraph: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <AreaChart
        data={streamData}
        offset="silhouette"
        labelBands
        animationDuration={0}
        aspectRatio={undefined}
        style={{ height: "100%" }}
      >
        <Area curve={curveNatural} dataKey="desktop" fill="var(--chart-1)" fillOpacity={0.85} />
        <Area curve={curveNatural} dataKey="tablet" fill="var(--chart-2)" fillOpacity={0.85} />
        <Area curve={curveNatural} dataKey="mobile" fill="var(--chart-3)" fillOpacity={0.85} />
      </AreaChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const svgEl = canvasElement.querySelector("svg");
      expect(svgEl).not.toBeNull();
      // Three bands, three crest strokes — one closed `<path fill>` shape and
      // one `<path stroke>` per series (band order == JSX order).
      const fillPaths = Array.from(svgEl!.querySelectorAll("path[fill]")).filter(
        (p) => !(p.getAttribute("fill") ?? "").startsWith("url(#area-gradient"),
      );
      expect(fillPaths.length).toBeGreaterThanOrEqual(3);
      // labelBands renders one halo-text label per series.
      const labels = svgEl!.querySelectorAll('[data-slot="halo-text"]');
      expect(labels.length).toBe(3);
      const labelText = Array.from(labels).map((l) => l.textContent);
      expect(labelText).toEqual(["desktop", "tablet", "mobile"]);
    });
  },
};

/**
 * `seams={2}` — a `--chart-background` stroke drawn between bands, the F16
 * "paper seam" that visually separates each ribbon from its neighbour.
 * `seams` IS this package's separator-lines feature for stacked areas
 * (Datawrapper's "separator lines" option) — there is no additional
 * `separatorLines` prop.
 */
export const StreamWithSeams: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <AreaChart
        data={streamData}
        offset="wiggle"
        seams={2}
        labelBands
        animationDuration={0}
        aspectRatio={undefined}
        style={{ height: "100%" }}
      >
        <Area curve={curveNatural} dataKey="desktop" fill="var(--chart-1)" fillOpacity={0.85} />
        <Area curve={curveNatural} dataKey="tablet" fill="var(--chart-2)" fillOpacity={0.85} />
        <Area curve={curveNatural} dataKey="mobile" fill="var(--chart-3)" fillOpacity={0.85} />
        <XAxis />
      </AreaChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const svgEl = canvasElement.querySelector("svg");
      expect(svgEl).not.toBeNull();
      // One `--chart-background`-stroked seam path per band.
      const seamPaths = Array.from(
        svgEl!.querySelectorAll('path[stroke="var(--chart-background)"]'),
      );
      expect(seamPaths.length).toBe(3);
      seamPaths.forEach((p) => {
        expect(p.getAttribute("stroke-width")).toBe("2");
      });
      // #245 — the seam must be the TOPMOST painter of the band's own edge:
      // no later sibling path may carry the same `d` with an equal or
      // greater stroke width (that would repaint over the seam and hide it).
      const allPaths = Array.from(svgEl!.querySelectorAll("path"));
      seamPaths.forEach((seamPath) => {
        const seamIndex = allPaths.indexOf(seamPath as SVGPathElement);
        const seamD = seamPath.getAttribute("d");
        const seamWidth = Number.parseFloat(seamPath.getAttribute("stroke-width") ?? "0");
        const laterCollisions = allPaths.slice(seamIndex + 1).filter((p) => {
          if (p.getAttribute("d") !== seamD) return false;
          const width = Number.parseFloat(p.getAttribute("stroke-width") ?? "0");
          return width >= seamWidth;
        });
        expect(laterCollisions.length).toBe(0);
      });
      // labelBands renders one halo-text label per series, so every band is
      // identifiable even though the seam removes the crest's own color.
      const labels = svgEl!.querySelectorAll('[data-slot="halo-text"]');
      expect(labels.length).toBe(3);
    });
  },
};

/**
 * High decoration (`data-decoration="10"`) on a SINGLE-series `Area`: renders
 * a `HairlineArea` — one 0.55px vertical hairline per sample, a 1.2px crest —
 * instead of the usual pattern fill (lieflat F3 Hairline Area). `labelPeaks`
 * rings the max sample with a filled dot + value label.
 */
export const HairlineDecoration: Story = {
  render: () => (
    <div className="p-4 rounded-lg bg-card" data-decoration="10">
      <div className="h-72 w-[560px]">
        <AreaChart
          data={chartData}
          animationDuration={0}
          aspectRatio={undefined}
          style={{ height: "100%" }}
        >
          <Grid horizontal />
          <Area
            curve={curveNatural}
            dataKey="desktop"
            fill="var(--chart-1)"
            labelPeaks
            strokeWidth={2.5}
          />
          <XAxis />
        </AreaChart>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const svgEl = canvasElement.querySelector("svg");
      expect(svgEl).not.toBeNull();
      const hairlineGroup = svgEl!.querySelector('[data-slot="hairline-area"]');
      expect(hairlineGroup).not.toBeNull();
      expect(hairlineGroup!.querySelectorAll("line").length).toBeGreaterThan(0);
      // No pattern fill — the hairline rendering replaces it entirely.
      expect(svgEl!.querySelectorAll("defs pattern").length).toBe(0);
      // labelPeaks rings the max sample with a filled dot + label.
      expect(svgEl!.querySelector('[data-slot="hairline-area-peak"]')).not.toBeNull();
    });
  },
};

/**
 * `data-decoration="0"` (the default) — the same single-series chart renders
 * its ordinary solid fill, byte-identical to `Default` above; no hairlines.
 */
export const HairlineDecorationOff: Story = {
  render: () => (
    <div className="p-4 rounded-lg bg-card" data-decoration="0">
      <div className="h-72 w-[560px]">
        <AreaChart
          data={chartData}
          animationDuration={0}
          aspectRatio={undefined}
          style={{ height: "100%" }}
        >
          <Grid horizontal />
          <Area curve={curveNatural} dataKey="desktop" fill="var(--chart-1)" strokeWidth={2.5} />
          <XAxis />
        </AreaChart>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const decorationLevel = Number.parseFloat(
      window.getComputedStyle(canvasElement).getPropertyValue("--decoration") || "0",
    );
    if (decorationLevel >= 8) {
      // A theme may set --decoration ≥ 8 at the document level — see
      // series-pattern.stories.tsx's NoPatternOutsideHighDecoration for why
      // this guard exists.
      return;
    }
    await waitFor(() => {
      const svgEl = canvasElement.querySelector("svg");
      expect(svgEl).not.toBeNull();
      expect(svgEl!.querySelector('[data-slot="hairline-area"]')).toBeNull();
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

// nulls — a null at index 3 (not an edge), matching `Line`'s identical fixture.
const nullsData = [
  { date: new Date(2024, 0, 1), value: 10 },
  { date: new Date(2024, 0, 2), value: 18 },
  { date: new Date(2024, 0, 3), value: 14 },
  { date: new Date(2024, 0, 4), value: null },
  { date: new Date(2024, 0, 5), value: 22 },
  { date: new Date(2024, 0, 6), value: 19 },
];

/**
 * `nulls` (RM-112). `"gap"` (the default) breaks the fill/crest at a
 * non-numeric sample; `"connect"` bridges straight across it; `"zero"` (the
 * pre-RM-112 default) reads it as 0 — same three modes, same resolution, as
 * `Line`'s `nulls`.
 */
export const Nulls: Story = {
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <AreaChart animationDuration={0} aspectRatio={undefined} data={nullsData}>
        <Grid horizontal />
        <Area dataKey="value" fill="var(--chart-1)" nulls="gap" stroke="var(--chart-1)" />
        <XAxis />
      </AreaChart>
    </div>
  ),
};

/**
 * `symbols` (RM-112) — the same shared `resolveSeriesSymbols` rule as
 * `Line symbols`: unset placement on a ≤12-point series defaults to hollow
 * markers at the first/last point only.
 */
export const Symbols: Story = {
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <AreaChart animationDuration={0} aspectRatio={undefined} data={chartData}>
        <Grid horizontal />
        <Area
          dataKey="desktop"
          fill="var(--chart-1)"
          stroke="var(--chart-1)"
          symbols={{ style: "hollow" }}
        />
        <XAxis />
      </AreaChart>
    </div>
  ),
};

const focusHoverData = [
  { date: new Date(2024, 0, 1), a: 10, b: 30, c: 20 },
  { date: new Date(2024, 0, 2), a: 20, b: 25, c: 15 },
  { date: new Date(2024, 0, 3), a: 15, b: 28, c: 24 },
  { date: new Date(2024, 0, 4), a: 26, b: 18, c: 12 },
];

/**
 * `focusOnHover` (RM-112) dims every OTHER series to `SELECTION_EXCLUDED_OPACITY`
 * while the pointer is over one — same behaviour, same wide invisible
 * hit-stroke, as `Line`'s `focusOnHover`. No `legend` here (the chart's own
 * default configuration): `SeriesFocusTargets` (issue 545) still gives a
 * keyboard user the identical spotlight — Tab lands on one of its
 * invisible-until-focused targets, and focusing it drives the same dim.
 */
export const FocusHover: Story = {
  name: "Focus on hover",
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <AreaChart animationDuration={0} aspectRatio={undefined} data={focusHoverData} focusOnHover>
        <Grid horizontal />
        <Area dataKey="a" fill="var(--chart-1)" fillOpacity={0.2} stroke="var(--chart-1)" />
        <Area dataKey="b" fill="var(--chart-2)" fillOpacity={0.2} stroke="var(--chart-2)" />
        <Area dataKey="c" fill="var(--chart-3)" fillOpacity={0.2} stroke="var(--chart-3)" />
        <XAxis />
        <ChartTooltip />
      </AreaChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(canvasElement.querySelectorAll("path.visx-area-closed")).toHaveLength(3);
    });
    const areas = [...canvasElement.querySelectorAll("path.visx-area-closed")];
    const groupFor = (i: number) => areas[i]?.closest("g");

    // issue 545: Tab reaches a keyboard target with NO `legend` set — the
    // chart's own default configuration (`SeriesFocusTargets`, mounted
    // whenever no container legend is actually painting).
    const focusTargets = canvasElement.querySelectorAll('[data-slot="series-focus-target"]');
    await waitFor(() => expect(focusTargets.length).toBe(3));

    const seriesB = focusTargets[1] as HTMLButtonElement;
    seriesB.focus();
    await waitFor(() => {
      expect(groupFor(1)?.getAttribute("opacity")).toBe("1");
      expect(groupFor(0)?.getAttribute("opacity")).toBe(String(SELECTION_EXCLUDED_OPACITY));
      expect(groupFor(2)?.getAttribute("opacity")).toBe(String(SELECTION_EXCLUDED_OPACITY));
    });

    seriesB.blur();
    await waitFor(() => {
      expect(groupFor(0)?.getAttribute("opacity")).toBe("1");
      expect(groupFor(1)?.getAttribute("opacity")).toBe("1");
      expect(groupFor(2)?.getAttribute("opacity")).toBe("1");
    });
  },
};

const selectionRegionData = [
  { region: "EMEA", step: 1, revenue: 42, target: 50 },
  { region: "APAC", step: 2, revenue: 31, target: 36 },
  { region: "AMER", step: 3, revenue: 55, target: 48 },
];

/**
 * `selectionStates` paints the host’s tri-state on each category’s column: selected marks carry a
 * compound foreground/background outline, excluded marks dim AND carry a full-opacity dashed frame, so the three
 * states stay distinguishable in greyscale.
 */
export const SelectionStates: Story = {
  name: "Selection states",
  parameters: { layout: "padded" },
  args: { data: selectionRegionData, children: null },
  render: () => (
    <SelectionProof className="h-72 w-full max-w-[560px]">
      <AreaChart
        accessibleLabel="Revenue by region with a selection applied"
        animationDuration={0}
        data={selectionRegionData}
        selectionStates={selectionByRegion}
        xDataKey="region"
        xScale="band"
      >
        <Grid horizontal />
        <Area animate={false} dataKey="revenue" />
        <XAxis />
      </AreaChart>
    </SelectionProof>
  ),
  play: async ({ canvasElement }) => {
    await expectSelectionStates(canvasElement);
  },
};

/**
 * Container legend (RM-118): `legend={{ interactive: "toggle" }}` mounts
 * `ChartLegend` above the plot with real `aria-pressed` buttons — click, or
 * Tab then Enter, hides a series and the y-domain re-tweens around what is
 * left visible. `focusOnHover` reuses the same fade a pointer-hovered area
 * already had for a keyboard-focused legend item (issue 545).
 */
export const LegendToggle: Story = {
  name: "Legend toggle",
  render: () => (
    <div className="h-72 w-full max-w-[560px]">
      <AreaChart
        animationDuration={0}
        aspectRatio={undefined}
        data={chartData}
        focusOnHover
        legend={{ interactive: "toggle" }}
        onDatapointClick={() => {}}
        style={{ height: "100%" }}
        yDomainTweenDuration={0}
      >
        <Grid horizontal />
        <Area
          curve={curveNatural}
          dataKey="desktop"
          fill="var(--chart-1)"
          fillOpacity={0.4}
          name="Desktop"
          stroke="var(--chart-1)"
          strokeWidth={2.5}
        />
        <Area
          curve={curveNatural}
          dataKey="mobile"
          fill="var(--chart-2)"
          fillOpacity={0.4}
          name="Mobile"
          stroke="var(--chart-2)"
          strokeWidth={2.5}
        />
        <XAxis />
        <YAxis />
        <ChartTooltip />
      </AreaChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    // Narrow hides the value axis entirely (RM-118 addendum) — read the tier
    // before relying on any y-axis tick to be there.
    const tier = canvasElement
      .querySelector("[data-chart-breakpoint]")
      ?.getAttribute("data-chart-breakpoint");
    const yTicks = () =>
      [...canvasElement.querySelectorAll('[data-slot="y-axis"] span')].map(
        (node) => node.textContent ?? "",
      );
    // Datapoint drill-down targets ALSO carry an aria-label starting with
    // the series key (`desktop, Jan 1, 2024…`), so a plain accessible-name
    // query matches those too — scope to the legend's own toggle buttons.
    const legendToggle = (label: RegExp) =>
      [...canvasElement.querySelectorAll("button[aria-pressed]")].find((button) =>
        label.test(button.textContent ?? ""),
      ) as HTMLButtonElement | undefined;
    // The y-axis ticks render before the legend does — wait for the button
    // itself, not just the ticks, so a fast `animationDuration={0}` mount
    // never races `.focus()` against an undefined lookup.
    await waitFor(() => expect(legendToggle(/desktop/i)).toBeTruthy());

    if (tier === "narrow") {
      // No y-axis to read a moved tick from — the toggle itself, and the
      // axis staying absent throughout, are what narrow correctly shows.
      await expect(yTicks()).toEqual([]);
      const desktopToggleNarrow = legendToggle(/desktop/i) as HTMLButtonElement;
      desktopToggleNarrow.focus();
      await userEvent.keyboard("{Enter}");
      await waitFor(() => expect(desktopToggleNarrow).toHaveAttribute("aria-pressed", "false"));
      await expect(yTicks()).toEqual([]);
      desktopToggleNarrow.focus();
      await userEvent.keyboard("{Enter}");
      await waitFor(() => expect(desktopToggleNarrow).toHaveAttribute("aria-pressed", "true"));
      await expect(yTicks()).toEqual([]);
      desktopToggleNarrow.blur();
      return;
    }

    // Ticks compact ("300"/"150") — kept as a numeric parse for symmetry
    // with Line/ComposedChart's play functions (their ticks DO compact to
    // "4K" etc., where `Number(...)` alone would be `NaN`).
    const parseTick = (text: string): number => {
      const match = /^(-?[\d.]+)([KM]?)$/.exec(text.trim().replace(/,/g, ""));
      if (!match) return Number.NaN;
      const [, digits, suffix] = match;
      const n = Number(digits);
      return suffix === "K" ? n * 1_000 : suffix === "M" ? n * 1_000_000 : n;
    };

    // "desktop" (peak 305) is the max series in this fixture — "mobile"
    // peaks at 200, below desktop at every point, so hiding desktop is the
    // toggle that actually moves the domain. Keyboard operated (RM-118,
    // validator FAIL 1a).
    await waitFor(() => expect(yTicks().length).toBeGreaterThan(0));
    const before = yTicks();

    const desktopToggle = legendToggle(/desktop/i) as HTMLButtonElement;
    desktopToggle.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(desktopToggle).toHaveAttribute("aria-pressed", "false"));
    await waitFor(() => expect(yTicks()).not.toEqual(before));
    const afterHide = yTicks();
    await expect(parseTick(afterHide.at(-1) ?? "")).toBeLessThan(parseTick(before.at(-1) ?? ""));

    desktopToggle.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(desktopToggle).toHaveAttribute("aria-pressed", "true"));
    await waitFor(() => expect(yTicks()).toEqual(before));
    // Settle focus back to the body — otherwise the interaction ends with
    // `focusOnHover`'s fade still applied to the neighbouring item, which
    // the a11y gate correctly flags on ITS OWN contrast (unrelated to this
    // story; not this sitting's fix to make).
    desktopToggle.blur();
  },
};

// ── Lived-in: a grid operator's daily demand ────────────────────────────────

/** Two years of daily demand in MWh: a weekly rhythm, a summer peak, noise. */
const dailyDemand = Array.from({ length: 730 }, (_, i) => {
  const date = new Date(Date.UTC(2024, 0, 1 + i));
  const weekly = date.getUTCDay() === 0 || date.getUTCDay() === 6 ? 0.82 : 1;
  const yearly = 1 + 0.18 * Math.sin(((i % 365) / 365) * Math.PI * 2 - Math.PI / 2);
  const noise = 1 + (seededRnd(i, 17) - 0.5) * 0.12;
  return { date, demand: Math.round(4_200 * weekly * yearly * noise) };
});

/**
 * A grid operator's demand view: two years of daily readings, a 7-day
 * rolling mean drawn over the raw fill, a one-standard-deviation band for
 * the usual corridor, and a fortnight's forecast with a weekly season
 * appended at the end. The navigator's axis reaches the forecast horizon, so
 * the default window opens on the last quarter AND the projection; the value
 * axis keeps the full data's domain so a moved window never re-scales the
 * picture.
 */
export const DemandDesk: Story = {
  name: "Lived-in: demand desk (rolling mean, σ band, forecast, navigator)",
  parameters: { layout: "padded" },
  render: () => (
    <div className="w-full max-w-[760px]">
      <AreaChart
        accessibleLabel="Daily demand with its seven-day mean, usual corridor and a two-week forecast"
        analytics={[
          { kind: "window", k: 7, reduce: "mean", label: "7-day average", id: "smooth" },
          { kind: "band", spread: { stddev: 1 }, label: "computation", id: "corridor" },
          { kind: "forecast", horizon: 14, season: 7, interval: 0.8, id: "forecast" },
        ]}
        data={dailyDemand}
        defaultWindow={{
          kind: "time",
          start: dailyDemand[640]!.date,
          end: new Date(dailyDemand[729]!.date.getTime() + 14 * 86_400_000),
        }}
        legend
        plotHeight={{ base: 260, narrow: { aspect: 1.25 } }}
        scrollbar="miniChart"
      >
        <Grid horizontal />
        <Area
          dataKey="demand"
          fill="var(--chart-1)"
          fillOpacity={0.25}
          name="Demand (MWh)"
          stroke="var(--chart-1)"
        />
        <XAxis />
        <YAxis />
        <ChartTooltip />
      </AreaChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getAllByRole("slider")).toHaveLength(2));
    await expect(canvas.getByText("Demand (MWh)")).toBeInTheDocument();
    await expect(canvas.getByText("7-day average")).toBeInTheDocument();
    await expect(canvas.getByText(/^Forecast/)).toBeInTheDocument();
    // The window reaches the forecast horizon: the projection is painted, not clipped.
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-analytic="forecast"]')).not.toBeNull(),
    );
  },
};
