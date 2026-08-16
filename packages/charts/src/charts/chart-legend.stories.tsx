import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { ChartLegend, type LegendItem } from "./chart-legend";

const meta = {
  title: "Charts/ChartLegend",
  component: ChartLegend,
  tags: ["autodocs"],
} satisfies Meta<typeof ChartLegend>;

export default meta;
type Story = StoryObj<typeof meta>;

const items: LegendItem[] = [
  { color: "var(--chart-1)", label: "Revenue", seriesIndex: 0, value: 21200 },
  { color: "var(--chart-2)", label: "Profit", seriesIndex: 1, value: 8800 },
  { color: "var(--chart-3)", label: "Costs", seriesIndex: 2, value: 12400 },
];

/** Default, non-interactive: items are plain text rows. */
export const Default: Story = {
  args: { items, title: "Series" },
};

/** With progress bars and percentages. */
export const WithProgress: Story = {
  args: {
    items: items.map((item) => ({ ...item, maxValue: 25000 })),
    showProgress: true,
    title: "Share of target",
  },
};

// #349: an interactive legend. `onItemClick` turns each row into a REAL
// <button> — keyboard operable, named by its label — rather than a div with a
// click handler. Without the prop the legend is unchanged.
function InteractiveLegendDemo() {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="flex w-[280px] flex-col gap-3">
      <ChartLegend items={items} onItemClick={(item) => setSelected(item.label)} title="Series" />
      <output
        className="rounded-md border border-border bg-card px-3 py-2 text-body text-card-foreground"
        data-testid="legend-detail"
      >
        {selected ? `Filtered to ${selected}` : "Select a series."}
      </output>
    </div>
  );
}

/** Click (or Tab + Enter) a legend entry to filter. */
export const Interactive: Story = {
  args: { items },
  render: () => <InteractiveLegendDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: /Profit/ });
    await userEvent.tab();
    await userEvent.click(button);
    await expect(canvas.getByTestId("legend-detail")).toHaveTextContent("Filtered to Profit");
  },
};

/**
 * #394: the percentage span reads the `text-meta` ROLE (was the raw `text‑xs`
 * utility, which `data-density`/#340 cannot reach). Two columns pin
 * `data-density` on a plain wrapping div — NOT `<ThemeProvider>`, which writes
 * `data-density` to `document.documentElement` and would race two columns —
 * mirroring `Foundations/Typography → Density scale`'s pattern. Must match
 * `Gantt`'s already-density-aware timescale tick (11.25px compact / 12px
 * comfortable / 12.75px spacious, styling-and-tokens.md).
 */
export const DensityComparison: Story = {
  name: "Density comparison (#394)",
  parameters: {
    docs: {
      description: {
        story:
          "The percentage now reads the `text-meta` role instead of the raw " +
          "`text‑xs` utility, so it scales with `data-density`. `comfortable` " +
          "(middle) is pixel-identical to a pre-#394 build (12px); `compact` " +
          "(left) is 6.25% smaller (11.25px) and `spacious` (right) 6.25% " +
          "larger (12.75px).",
      },
    },
  },
  render: () => (
    <div className="flex gap-8">
      {(["compact", "comfortable", "spacious"] as const).map((mode) => (
        <div className="w-56" data-density={mode} data-testid={`density-${mode}`} key={mode}>
          <p className="mb-2 text-caption text-muted-foreground">{mode}</p>
          <ChartLegend
            items={items.map((item) => ({ ...item, maxValue: 25000 }))}
            showProgress
            title="Share of target"
          />
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const px = (el: Element) => parseFloat(getComputedStyle(el).fontSize);
    const compact = canvasElement.querySelector('[data-testid="density-compact"]');
    const comfortable = canvasElement.querySelector('[data-testid="density-comfortable"]');
    const spacious = canvasElement.querySelector('[data-testid="density-spacious"]');
    expect(compact).not.toBeNull();
    expect(comfortable).not.toBeNull();
    expect(spacious).not.toBeNull();
    const compactPct = compact?.querySelector("span.col-start-3");
    const comfortablePct = comfortable?.querySelector("span.col-start-3");
    const spaciousPct = spacious?.querySelector("span.col-start-3");
    expect(compactPct).not.toBeNull();
    expect(comfortablePct).not.toBeNull();
    expect(spaciousPct).not.toBeNull();
    expect(px(comfortablePct as Element)).toBe(12);
    expect(px(compactPct as Element)).toBe(11.25);
    expect(px(spaciousPct as Element)).toBe(12.75);
    expect(px(compactPct as Element)).toBeLessThan(px(comfortablePct as Element));
    expect(px(spaciousPct as Element)).toBeGreaterThan(px(comfortablePct as Element));
  },
};
