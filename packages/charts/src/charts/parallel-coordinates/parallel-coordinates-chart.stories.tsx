import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import type { ChartDatapoint } from "../chart-datapoint";
import {
  ParallelCoordinatesChart,
  type ParallelCoordinatesDimension,
} from "./parallel-coordinates-chart";

const meta = {
  title: "Charts/ParallelCoordinatesChart",
  component: ParallelCoordinatesChart,
  tags: ["autodocs"],
} satisfies Meta<typeof ParallelCoordinatesChart>;

export default meta;
type Story = StoryObj<typeof meta>;

// L20 "Twelve products, four dimensions" — the roadmap's own acceptance recreation.
const productDimensions: ParallelCoordinatesDimension[] = [
  { key: "price", label: "Price", format: "currency" },
  { key: "latency", label: "Latency (ms)" },
  { key: "nps", label: "NPS" },
  { key: "uptime", label: "Uptime", domain: [98, 100], format: "percent" },
];

const products = [
  { product: "Atlas", price: 49, latency: 180, nps: 32, uptime: 99.9 },
  { product: "Beacon", price: 79, latency: 140, nps: 41, uptime: 99.95 },
  { product: "Comet", price: 29, latency: 220, nps: 18, uptime: 99.5 },
  { product: "Drift", price: 99, latency: 95, nps: 55, uptime: 99.99 },
  { product: "Ember", price: 59, latency: 165, nps: 37, uptime: 99.8 },
  { product: "Flux", price: 39, latency: 205, nps: 24, uptime: 99.6 },
  { product: "Gale", price: 119, latency: 80, nps: 62, uptime: 99.97 },
  { product: "Halo", price: 69, latency: 150, nps: 44, uptime: 99.88 },
  { product: "Iris", price: 89, latency: 110, nps: 51, uptime: 99.93 },
  { product: "Juno", price: 19, latency: 240, nps: 12, uptime: 99.2 },
  { product: "Karst", price: 109, latency: 100, nps: 58, uptime: 99.96 },
  { product: "Lumen", price: 45, latency: 190, nps: 29, uptime: 99.7 },
];

/** Twelve products across four mixed-unit dimensions — the L20 acceptance
 * recreation. No hero: every hairline draws at its seeded 0.5–0.8 opacity. */
export const Default: Story = {
  render: () => (
    <div className="h-96 w-[640px]">
      <ParallelCoordinatesChart
        accessibleLabel="Twelve products across price, latency, NPS and uptime"
        data={products}
        dimensions={productDimensions}
        entity="product"
      />
    </div>
  ),
};

/** `highlightKey` as a literal entity id promotes ONE line to the 2px hero —
 * drawn last (on top) with a halo label at its final axis point. */
export const HeroLine: Story = {
  render: () => (
    <div className="h-96 w-[640px]">
      <ParallelCoordinatesChart
        accessibleLabel="Twelve products, Gale highlighted as the top performer"
        data={products}
        dimensions={productDimensions}
        entity="product"
        highlightKey="Gale"
      />
    </div>
  ),
};

/** `highlightKey` as a predicate promotes the first row it matches — here,
 * the first product clearing an NPS of 50. */
export const HeroByPredicate: Story = {
  render: () => (
    <div className="h-96 w-[640px]">
      <ParallelCoordinatesChart
        accessibleLabel="Twelve products, first product with NPS above 50 highlighted"
        data={products}
        dimensions={productDimensions}
        entity="product"
        highlightKey={(d) => (d.nps as number) > 50}
      />
    </div>
  ),
};

/** `showExtremes` draws each axis's min/max value at its foot. */
export const ShowExtremes: Story = {
  render: () => (
    <div className="h-96 w-[640px]">
      <ParallelCoordinatesChart
        accessibleLabel="Twelve products with axis extremes labelled"
        data={products}
        dimensions={productDimensions}
        entity="product"
        highlightKey="Gale"
        showExtremes
      />
    </div>
  ),
};

/** `curve="monotone"` draws a smoothed `curveMonotoneX` bézier between axes
 * instead of a straight hairline segment. */
export const MonotoneCurve: Story = {
  render: () => (
    <div className="h-96 w-[640px]">
      <ParallelCoordinatesChart
        accessibleLabel="Twelve products, smoothed line"
        curve="monotone"
        data={products}
        dimensions={productDimensions}
        entity="product"
        highlightKey="Gale"
      />
    </div>
  ),
};

/** Three axes (the minimum) with an explicit `categorical` palette, honoured
 * up to the six-entity soft cap. */
export const CategoricalFewEntities: Story = {
  render: () => (
    <div className="h-96 w-[640px]">
      <ParallelCoordinatesChart
        accessibleLabel="Five products, three dimensions, categorical palette"
        data={products.slice(0, 5)}
        dimensions={productDimensions.slice(0, 3)}
        entity="product"
        palette="categorical"
      />
    </div>
  ),
};

// #349 drill-down — every entity is a keyboard datapoint target, one row of
// arrow-key targets (see waterfall-chart.stories.tsx Drilldown demo).
function DrilldownDemo() {
  const [selected, setSelected] = useState<ChartDatapoint | null>(null);

  return (
    <div className="flex w-[640px] flex-col gap-3">
      <div className="h-96">
        <ParallelCoordinatesChart
          accessibleLabel="Twelve products across price, latency, NPS and uptime"
          data={products}
          dimensions={productDimensions}
          entity="product"
          onDatapointClick={(point) => setSelected(point)}
        />
      </div>
      {selected ? (
        <p data-testid="drill-detail" className="text-body text-muted-foreground">
          Selected {String(selected.datum.product)} via {selected.source}.
        </p>
      ) : (
        <p className="text-body text-muted-foreground">
          Click or tab to an entity and press Enter.
        </p>
      )}
    </div>
  );
}

/** Setting `onDatapointClick` mounts the keyboard/pointer interaction layer —
 * arrow keys cycle through every entity, Enter activates. Verifies the
 * roadmap's "keyboard cycles through entities" acceptance bullet. */
export const KeyboardCycling: Story = {
  render: () => <DrilldownDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = await canvas.findByRole("group", { name: /chart data points/i });
    const targets = within(group).getAllByRole("button");

    // Every entity (all 12 rows) is a keyboard target — one tab stop overall.
    await expect(targets).toHaveLength(products.length);
    await expect(targets.filter((t) => t.getAttribute("tabindex") === "0")).toHaveLength(1);

    (targets[0] as HTMLElement).focus();
    await expect(targets[0]).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(targets[1]).toHaveFocus();
    await userEvent.keyboard("{Enter}");

    await expect(canvas.getByTestId("drill-detail")).toHaveTextContent(/via keyboard/);
  },
};
