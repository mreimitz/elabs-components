import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { ChartEditorialHourglass } from "@/components/chart-editorial-hourglass/chart-editorial-hourglass";

const meta = {
  title: "Patterns/Blocks/Chart Editorial — Hourglass Stream",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A funnel redrawn as counted barcode strips with trickle threads narrowing between stages, adapted from lieflat-charts' 'L13 Hourglass Stream'. One-off editorial composition — copy-own it: `npx shadcn add chart-editorial-hourglass`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <ChartEditorialHourglass />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("figure");

    const strips = canvasElement.querySelectorAll('[data-slot="chart-editorial-hourglass-strip"]');
    // Five stages in the default data.
    await expect(strips).toHaveLength(5);

    // The narrowing property: the first (widest) stage draws strictly more
    // ticks than the last (narrowest) stage.
    const firstTicks = strips[0]?.querySelectorAll('[data-slot="unit-stack-unit"]').length ?? 0;
    const lastTicks =
      strips[strips.length - 1]?.querySelectorAll('[data-slot="unit-stack-unit"]').length ?? 0;
    await expect(firstTicks).toBeGreaterThan(lastTicks);

    // Thread density narrows gap over gap, matching the funnel's own order.
    const gaps = Array.from(
      canvasElement.querySelectorAll<SVGGElement>('[data-slot="chart-editorial-hourglass-gap"]'),
    );
    await expect(gaps).toHaveLength(4);
    const counts = gaps.map((gap) => Number(gap.dataset.threadCount));
    for (let i = 1; i < counts.length; i += 1) {
      await expect(counts[i]).toBeLessThanOrEqual(counts[i - 1] as number);
    }
  },
};
