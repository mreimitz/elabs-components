import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { ChartEditorialPatchwork } from "@/components/chart-editorial-patchwork/chart-editorial-patchwork";

const meta = {
  title: "Patterns/Blocks/Chart Editorial — Radial Patchwork",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Events on a 24 h clock face, density shown by overlaid translucent sectors (fill-opacity 0.07–0.16 — the one sanctioned use of transparency in this system) with rim ticks and a category legend. Adapted from lieflat-charts' 'L10 Radial Patchwork'. Copy-own it: `npx shadcn add chart-editorial-patchwork`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <ChartEditorialPatchwork />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("figure");

    // Every sector's fill-opacity must stay inside the sanctioned
    // transparency range — the whole point of the block's own contract.
    const sectors = Array.from(
      canvasElement.querySelectorAll<SVGPathElement>(
        '[data-slot="chart-editorial-patchwork-sector"]',
      ),
    );
    await expect(sectors.length).toBeGreaterThan(0);
    for (const sector of sectors) {
      const opacity = Number(sector.getAttribute("fill-opacity"));
      await expect(opacity).toBeGreaterThanOrEqual(0.07);
      await expect(opacity).toBeLessThanOrEqual(0.16);
    }

    // Twenty-four rim ticks, one real HairlineFloor per hour.
    const rimTicks = canvasElement.querySelectorAll(
      '[data-slot="chart-editorial-patchwork-rim-tick"]',
    );
    await expect(rimTicks).toHaveLength(24);
    const hairlines = canvasElement.querySelectorAll('[data-slot="hairline-floor"]');
    await expect(hairlines).toHaveLength(24);
  },
};
