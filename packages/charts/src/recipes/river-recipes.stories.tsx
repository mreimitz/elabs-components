"use client";

/**
 * Charts / Recipes / River (RM-126).
 *
 * Four of River's chart deep-dives, rebuilt from merged
 * `@elabs-ai/components-charts` props — no new
 * component code, no fork. Each recipe ships twice: once composed from the
 * container it is really made of, and once as the `ChartSpec` an agent would
 * emit, so `brand-ui chart-for` and `AutoChart` reach the same picture.
 *
 * Every caption names the props the recipe is made of, and every fixture is
 * seeded (`seededRnd`) and FICTIONAL where the original data is not public
 * domain — the shapes are River's, the numbers are ours.
 *
 * The fifth recipe (a shots heatmap table with a hidden header) needs
 * `DataTable`, which `@elabs-ai/components-charts` must never import; it lives
 * in `apps/docs/stories/recipes/river-heatmap-table.stories.tsx` under the same
 * Storybook group.
 */

import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";

import { AutoChart } from "../auto-chart/auto-chart";
import type { ChartSpec } from "../auto-chart/chart-spec";
import {
  BIKES_ANNOTATIONS,
  BIKES_DATA,
  BIKES_SERIES,
  BIKES_SPEC_ANNOTATIONS,
} from "../charts/annotations/bikes-fixture";
import { Area } from "../charts/area";
import { AreaChart } from "../charts/area-chart";
import { Bar } from "../charts/bar";
import { BarChart } from "../charts/bar-chart";
import { BarXAxis } from "../charts/bar-x-axis";
import { BarYAxis } from "../charts/bar-y-axis";
import { Grid } from "../charts/grid";
import { Line } from "../charts/line";
import { LineChart } from "../charts/line-chart";
import { XAxis } from "../charts/x-axis";
import { YAxis } from "../charts/y-axis";
import {
  ChartMultiples,
  type ChartMultiplesHover,
  type ChartMultiplesPanel,
} from "../multiples/chart-multiples";
import { ATM_LATEST_YEAR, ATM_ROWS, type AtmRow } from "./atms-fixture";
import { CAR_WEIGHTS } from "./car-weights-fixture";
import { MEMORY_PRICES, type MemoryPriceRow } from "./memory-prices-fixture";

const meta = {
  title: "Charts/Recipes/River",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "River’s chart deep-dives, rebuilt from merged props. Each recipe names the props it is made of; the data is seeded and fictional where the original is not public domain.",
      },
    },
  },
  decorators: [
    (Story: () => React.ReactElement) => (
      <div className="w-full max-w-[960px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

// ── 1. Annotated indexed lines (bikes) ───────────────────────────────────────

const BIKES_DESCRIPTION =
  "Monthly cycle traffic in Paris, Berlin, London and New York, indexed against the same month of 2019.";

/**
 * **Annotated indexed lines.** Props: `LineChart annotations` (RM-111) —
 * four series-coloured text notes, the Covid-19 `range` and the ±0
 * `line` — over an indexed value axis (`YAxis valueFormat={{ sign: true,
 * suffix: "%" }}`). Wide, every note paints in place; under 480 px each
 * becomes a numbered marker with a key row under the plot, and the figure
 * description restates all of them at every tier.
 */
export const AnnotatedIndexedLines: Story = {
  render: () => (
    <LineChart
      accessibleDescription={BIKES_DESCRIPTION}
      accessibleLabel="Cycle traffic against 2019"
      // Analytics — RM-138: the four cities' pooled average, as a computed line.
      analytics={[{ kind: "line", value: "mean", of: "all", id: "bikes-average" }]}
      annotations={BIKES_ANNOTATIONS}
      data={BIKES_DATA}
      xDataKey="date"
    >
      <Grid horizontal />
      {BIKES_SERIES.map((s) => (
        <Line dataKey={s.key} key={s.key} name={s.label} stroke={s.color} />
      ))}
      <XAxis />
      <YAxis valueFormat={{ sign: true, suffix: "%" }} />
    </LineChart>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-slot="chart-annotations-line"]')).not.toBeNull(),
    );
    // Analytics — RM-138: the pooled average equals the mean of every city's months.
    const pooled = BIKES_DATA.flatMap((row) => BIKES_SERIES.map((s) => row[s.key] as number));
    const average = canvasElement.querySelector('[data-analytic="bikes-average"]');
    await expect(Number(average?.getAttribute("data-value"))).toBeCloseTo(
      pooled.reduce((a, b) => a + b, 0) / pooled.length,
      8,
    );
    const root = canvasElement.querySelector<HTMLElement>("[data-chart-breakpoint]");
    const tier = root?.dataset.chartBreakpoint;
    const keyRows = canvasElement.querySelectorAll('[data-slot="annotation-key-item"]');
    const markers = canvasElement.querySelectorAll('[data-slot="chart-annotations-marker"]');
    // Narrow moves every text note into the numbered key; wider tiers paint
    // the notes in place and render no key at all.
    if (tier === "narrow") {
      await expect(keyRows.length).toBeGreaterThan(0);
      await expect(keyRows.length).toBe(markers.length);
    } else {
      await expect(keyRows).toHaveLength(0);
    }
  },
};

const BIKES_SPEC: ChartSpec = {
  type: "line",
  title: "Cycle traffic against 2019",
  description: BIKES_DESCRIPTION,
  x: "date",
  data: BIKES_DATA.map((row) => ({
    ...row,
    date: (row.date as Date).toISOString().slice(0, 10),
  })),
  series: BIKES_SERIES.map((s) => ({ key: s.key, label: s.label, color: s.color })),
  annotations: BIKES_SPEC_ANNOTATIONS,
};

/** The same recipe as a `ChartSpec`: `type`, `series[].color` and `annotations`. */
export const AnnotatedIndexedLinesFromSpec: Story = {
  render: () => <AutoChart spec={BIKES_SPEC} />,
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-slot="chart-annotations-range"]')).not.toBeNull(),
    );
  },
};

// ── 2. Column small multiples with the value in the title (ATMs) ─────────────

const atmCount = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function AtmPanelTitle(panel: ChartMultiplesPanel<AtmRow>, hovered?: ChartMultiplesHover<AtmRow>) {
  const value = hovered?.value ?? panel.stats.end;
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-2">
      <span className="truncate text-caption font-medium text-foreground">{panel.title}</span>
      <span
        className="shrink-0 text-subtitle tabular-nums text-foreground"
        data-slot="chart-multiples-panel-value"
      >
        {value == null ? "—" : atmCount.format(value)}
      </span>
    </div>
  );
}

/**
 * **Column small multiples, value in the title.** Props: `ChartMultiples`
 * `by` (one panel per country), `columns={{ base: 3, medium: 2, narrow: 1 }}`,
 * `scales={{ y: "shared" }}` so the six countries are comparable, `sort="end"`
 * and a `panelTitle` that prints the latest count — replaced by the hovered
 * value while a panel is hovered. Fictional, seeded data.
 */
export const ColumnMultiplesValueInTitle: Story = {
  render: () => (
    // a-9: the six numbers in the panel titles are the LATEST year's count,
    // not each country's maximum — without a grid title naming the quantity,
    // the unit and the year, "Ostmark 1,104" beside a 1.2K-tall column reads
    // as that column's value. The spec sibling below carries the same title.
    <section aria-labelledby="atm-multiples-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-subtitle font-medium text-foreground" id="atm-multiples-title">
          Cash machines per country, {ATM_LATEST_YEAR}
        </h3>
        <p className="text-caption text-muted-foreground">
          Each panel prints its {ATM_LATEST_YEAR} count; hover a year to read that year instead.
        </p>
      </div>
      <ChartMultiples<AtmRow>
        by="country"
        columns={{ base: 3, medium: 2, narrow: 1 }}
        data={ATM_ROWS}
        dataKeys={["atms"]}
        panelHeight={140}
        panelTitle={AtmPanelTitle}
        scales={{ y: "shared" }}
        sort="end"
        xDataKey="year"
      >
        {(panel) => (
          <BarChart
            // a-9: the auto summary named each country's PEAK ("Ostmark peaks at
            // 1.2K in 2020"), a different quantity from the number printed in
            // the panel title — a screen-reader user heard one and a sighted
            // reader saw the other.
            accessibleDescription={`${
              panel.stats.end == null ? "No" : atmCount.format(panel.stats.end)
            } cash machines in ${ATM_LATEST_YEAR}, the number printed in this panel’s title.`}
            accessibleLabel={`Cash machines in ${panel.title}`}
            data={panel.data}
            xDataKey="year"
          >
            <Grid horizontal />
            <Bar dataKey="atms" name={panel.title} />
            <BarXAxis />
            <YAxis />
          </BarChart>
        )}
      </ChartMultiples>
    </section>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(
        canvasElement.querySelectorAll('[data-slot="chart-multiples-panel"]').length,
      ).toBeGreaterThan(0),
    );
    const values = canvasElement.querySelectorAll('[data-slot="chart-multiples-panel-value"]');
    // The value in the title is the recipe's whole point: one per panel.
    await expect(values.length).toBe(
      canvasElement.querySelectorAll('[data-slot="chart-multiples-panel"]').length,
    );
    await expect(values[0]?.textContent).not.toBe("—");
    // a-9: the grid says what the six numbers are, and the sr-only
    // restatement names the printed value rather than the peak.
    await expect(canvasElement.querySelector("#atm-multiples-title")?.textContent).toBe(
      `Cash machines per country, ${ATM_LATEST_YEAR}`,
    );
    const firstPanel = canvasElement.querySelector('[data-slot="chart-multiples-panel"]');
    const printed = firstPanel?.querySelector(
      '[data-slot="chart-multiples-panel-value"]',
    )?.textContent;
    const figure = firstPanel?.querySelector('[role="figure"]');
    const describedBy = figure?.getAttribute("aria-describedby");
    const description = describedBy
      ? canvasElement.ownerDocument.getElementById(describedBy)?.textContent
      : null;
    await expect(printed).toBeTruthy();
    await expect(description).toContain(printed as string);
  },
};

/** The same grid as a `ChartSpec`: `facet.by` + `facet.columns` on a bar spec. */
export const ColumnMultiplesFromSpec: Story = {
  render: () => (
    <AutoChart
      spec={{
        type: "bar",
        title: `Cash machines per country, ${ATM_LATEST_YEAR}`,
        data: ATM_ROWS,
        x: "year",
        series: ["atms"],
        facet: { by: "country", columns: { base: 3, narrow: 1 }, panelHeight: 140 },
      }}
    />
  ),
};

// ── 3. Grouped range bars with overlays (car weights) ────────────────────────

/**
 * **Grouped range bars with overlays.** Props: `BarChart groupBy="class"`
 * (a bold header per class), `orientation="horizontal"`, and three
 * `overlays` — a light `range` for the middle 90 %, a dark `range` for the
 * middle 50 %, and a `value` tick for the average. Three overlays, three
 * group headers. Fictional, seeded weights.
 */
export const GroupedRangeBars: Story = {
  render: () => (
    <div className="h-96 w-full">
      <BarChart
        accessibleDescription="Light span: middle 90 percent of the registered cars; dark span: middle 50 percent; tick: the average kerb weight."
        accessibleLabel="Kerb weight per model, grouped by class"
        // Analytics — RM-138: the median of the model averages, across every class.
        analytics={[{ kind: "line", value: "median", of: "avg", id: "median-weight" }]}
        data={CAR_WEIGHTS}
        groupBy="class"
        orientation="horizontal"
        overlays={[
          { kind: "range", label: "90 % of cars", lowKey: "lo90", highKey: "hi90" },
          { kind: "range", label: "50 % of cars", lowKey: "lo50", highKey: "hi50" },
          { kind: "value", key: "avg", label: "Average", marker: "tick" },
        ]}
        xDataKey="model"
      >
        <Grid vertical />
        <BarYAxis />
      </BarChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelectorAll('[data-slot="bar-chart-overlay"]')).toHaveLength(3);
        expect(canvasElement.querySelector('[data-analytic="median-weight"]')).not.toBeNull();
        expect(canvasElement.querySelectorAll('[data-slot="bar-chart-group-header"]')).toHaveLength(
          3,
        );
      },
      { timeout: 5000 },
    );
    const averages = CAR_WEIGHTS.map((row) => row.avg).sort((a, b) => a - b);
    const mid = averages.length / 2;
    const expected =
      averages.length % 2
        ? (averages[Math.floor(mid)] as number)
        : ((averages[mid - 1] as number) + (averages[mid] as number)) / 2;
    const median = canvasElement.querySelector('[data-analytic="median-weight"]');
    await expect(Number(median?.getAttribute("data-value"))).toBeCloseTo(expected, 8);
  },
};

/** The same bars as a `ChartSpec`: `groupBy`, `orientation` and `overlays`. */
export const GroupedRangeBarsFromSpec: Story = {
  render: () => (
    <AutoChart
      spec={{
        type: "bar",
        title: "Kerb weight per model",
        data: CAR_WEIGHTS,
        x: "model",
        series: ["avg"],
        groupBy: "class",
        orientation: "horizontal",
        overlays: [
          { kind: "range", label: "90 % of cars", lowKey: "lo90", highKey: "hi90" },
          { kind: "range", label: "50 % of cars", lowKey: "lo50", highKey: "hi50" },
        ],
      }}
    />
  ),
};

// ── 4. Area small multiples with delta figures (memory prices) ───────────────

const dollarsPerTb = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 0,
  style: "currency",
});
const changePercent = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
  style: "percent",
});

function MemoryPanelTitle(
  panel: ChartMultiplesPanel<MemoryPriceRow>,
  hovered?: ChartMultiplesHover<MemoryPriceRow>,
) {
  const figure =
    hovered?.value != null
      ? dollarsPerTb.format(hovered.value)
      : changePercent.format((panel.stats.deltaPercent ?? 0) / 100);
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-2">
      <span className="truncate text-caption font-medium text-foreground">{panel.title}</span>
      <span
        className="shrink-0 text-subtitle tabular-nums text-foreground"
        data-slot="chart-multiples-panel-value"
      >
        {figure}
      </span>
    </div>
  );
}

/**
 * **Area small multiples with a delta figure.** Props: `ChartMultiples`
 * `by="tech"`, `scales={{ y: "independent", rangeRounding: true }}` (each
 * technology has its own order of magnitude), `sort="deltaPercent"` and a
 * `panelTitle` showing the three-year change — swapped for the hovered price
 * while `syncHover` is tracking. Fictional, seeded prices.
 */
export const AreaMultiplesDeltaFigures: Story = {
  render: () => (
    <ChartMultiples<MemoryPriceRow>
      by="tech"
      columns={{ base: 2, narrow: 1 }}
      data={MEMORY_PRICES}
      dataKeys={["price"]}
      panelTitle={MemoryPanelTitle}
      scales={{ y: "independent", rangeRounding: true }}
      sort="deltaPercent"
      xDataKey="month"
    >
      {(panel) => (
        <AreaChart
          accessibleLabel={`${panel.title} price per terabyte`}
          data={panel.data}
          xDataKey="month"
        >
          <Grid horizontal />
          <Area dataKey="price" name={panel.title} />
          <XAxis />
          <YAxis orientation="right" />
        </AreaChart>
      )}
    </ChartMultiples>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(canvasElement.querySelectorAll('[data-slot="chart-multiples-panel"]')).toHaveLength(4),
    );
    const figures = canvasElement.querySelectorAll('[data-slot="chart-multiples-panel-value"]');
    await expect(figures).toHaveLength(4);
    // Every panel states its own change; a delta figure is what makes the grid
    // readable when each panel owns its scale.
    for (const figure of figures) await expect(figure.textContent).toMatch(/%/);
  },
};

/** The same grid as a `ChartSpec`: `facet.by`, `facet.scales` and `facet.sort`. */
export const AreaMultiplesFromSpec: Story = {
  render: () => (
    <AutoChart
      spec={{
        type: "area",
        title: "Storage price per terabyte",
        data: MEMORY_PRICES,
        x: "month",
        series: ["price"],
        facet: {
          by: "tech",
          columns: { base: 2, narrow: 1 },
          scales: { y: "independent", rangeRounding: true },
          sort: "deltaPercent",
        },
      }}
    />
  ),
};
