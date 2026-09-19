import type { Meta, StoryObj } from "@storybook/react-vite";

import { ChartTooltip, Grid, Line, LineChart, XAxis, YAxis } from "../charts";
import {
  ChartMultiples,
  type ChartMultiplesHover,
  type ChartMultiplesPanel,
} from "./chart-multiples";

type PriceRow = { chip: string; month: Date; price: number; average: number };

const CHIPS: Array<{ chip: string; base: number; swing: number; trend: number }> = [
  { chip: "DRAM", base: 2.1, swing: 0.6, trend: 0.18 },
  { chip: "NAND", base: 38, swing: 6, trend: 0.9 },
  { chip: "HDD", base: 310, swing: 22, trend: -1.5 },
  { chip: "SRAM", base: 0.42, swing: 0.05, trend: 0.012 },
];

/** Deterministic monthly prices, Jan 2023 – Dec 2024 (local-time dates). */
const MEMORY_PRICES: PriceRow[] = CHIPS.flatMap(({ chip, base, swing, trend }) =>
  Array.from({ length: 24 }, (_, m) => {
    const price = Number((base + trend * m + swing * Math.sin(m / 2.3)).toFixed(3));
    return { chip, month: new Date(2023, m, 1), price, average: price };
  }),
);

/** Every panel shares one scale: the spread of the four series, indexed to 100. */
const INDEXED: PriceRow[] = CHIPS.flatMap(({ chip, base, swing, trend }) =>
  Array.from({ length: 24 }, (_, m) => {
    const price = base + trend * m + swing * Math.sin(m / 2.3);
    return {
      chip,
      month: new Date(2023, m, 1),
      price: Number(((price / base) * 100).toFixed(1)),
      average: Number((100 + m * 0.8).toFixed(1)),
    };
  }),
);

const percent = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
  style: "percent",
});
const price = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 3 });

/** The River recipe: title, a big delta figure, and the hovered value replacing it. */
function MemoryPanelTitle(
  panel: ChartMultiplesPanel<PriceRow>,
  hovered?: ChartMultiplesHover<PriceRow>,
) {
  const figure =
    hovered?.value != null
      ? `$${price.format(hovered.value)}`
      : percent.format((panel.stats.deltaPercent ?? 0) / 100);
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

function PriceLine(panel: ChartMultiplesPanel<PriceRow>) {
  return (
    <LineChart
      accessibleLabel={`${panel.title} price`}
      animationDuration={0}
      data={panel.data}
      xDataKey="month"
    >
      <Grid horizontal />
      <Line dataKey="price" name={panel.title} />
      <XAxis />
      <YAxis orientation="right" />
      <ChartTooltip />
    </LineChart>
  );
}

const meta = {
  title: "Charts/ChartMultiples",
  component: ChartMultiples,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="w-full max-w-[960px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChartMultiples>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Memory prices (four panels, independent right-hand axes with range rounding,
 * a delta figure per panel, synced hover that swaps the delta for the value).
 * Two columns from 480 px up, one on a phone.
 */
export const MemoryPricesMultiples: Story = {
  args: { children: () => null, dataKeys: ["price"], xDataKey: "month" },
  render: () => (
    <ChartMultiples<PriceRow>
      by="chip"
      columns={{ base: 2, narrow: 1 }}
      data={MEMORY_PRICES}
      dataKeys={["price"]}
      panelTitle={MemoryPanelTitle}
      scales={{ y: "independent", rangeRounding: true }}
      xDataKey="month"
    >
      {PriceLine}
    </ChartMultiples>
  ),
};

/** One shared scale: value labels paint on the first column only. */
export const SharedScaleMultiples: Story = {
  args: { children: () => null, dataKeys: ["price"], xDataKey: "month" },
  render: () => (
    <ChartMultiples<PriceRow>
      by="chip"
      columns={{ base: 2, narrow: 1 }}
      data={INDEXED}
      dataKeys={["price"]}
      xDataKey="month"
    >
      {(panel) => (
        <LineChart
          accessibleLabel={`${panel.title} index`}
          animationDuration={0}
          data={panel.data}
          xDataKey="month"
        >
          <Grid horizontal />
          <Line dataKey="price" name={panel.title} />
          <XAxis />
          <YAxis />
          <ChartTooltip />
        </LineChart>
      )}
    </ChartMultiples>
  ),
};

/** Sorted by % change, with the all-chip average repeated muted behind every panel. */
export const SortedWithBaselineMultiples: Story = {
  args: { children: () => null, dataKeys: ["price"], xDataKey: "month" },
  render: () => (
    <ChartMultiples<PriceRow>
      baseline={{ series: "average" }}
      by="chip"
      columns={{ base: 2, narrow: 1 }}
      data={INDEXED}
      dataKeys={["price"]}
      sort="deltaPercent"
      xDataKey="month"
    >
      {(panel) => (
        <LineChart
          accessibleLabel={`${panel.title} index`}
          animationDuration={0}
          data={panel.data}
          xDataKey="month"
        >
          <Grid horizontal />
          <Line dataKey="price" name={panel.title} />
          <XAxis />
          <YAxis />
          <ChartTooltip />
        </LineChart>
      )}
    </ChartMultiples>
  ),
};

/** The SRAM panel is hidden below 480 px only (`showAt: { base: true, narrow: false }`). */
export const HidePanelOnNarrowMultiples: Story = {
  args: { children: () => null, dataKeys: ["price"], xDataKey: "month" },
  render: () => (
    <ChartMultiples<PriceRow>
      columns={{ base: 2, narrow: 1 }}
      dataKeys={["price"]}
      panels={CHIPS.map(({ chip }) => ({
        key: chip,
        data: MEMORY_PRICES.filter((row) => row.chip === chip),
        showAt: chip === "SRAM" ? { base: true, narrow: false } : undefined,
      }))}
      scales={{ y: "independent", rangeRounding: true }}
      xDataKey="month"
    >
      {PriceLine}
    </ChartMultiples>
  ),
};
