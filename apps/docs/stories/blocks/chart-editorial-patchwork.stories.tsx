import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { ChartEditorialPatchwork } from "@/components/chart-editorial-patchwork/chart-editorial-patchwork";
import { contrastRatio, expectHouseFocusRing, resolveColour } from "./_chart-editorial-assertions";

const meta = {
  title: "Patterns/Blocks/Chart Editorial — Radial Patchwork",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Events on a 24 h clock face, density shown by overlaid translucent sectors (fill-opacity 0.07–0.16 — the one sanctioned use of transparency in this system), each wedge outlined in `--border-strong` so the mark reaches 3:1 against the card, with rim ticks and a category legend. Adapted from lieflat-charts' 'L10 Radial Patchwork'. Copy-own it: `npx shadcn add chart-editorial-patchwork`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const MARGIN = 2;

async function playPatchwork(canvasElement: HTMLElement, { focus }: { focus: boolean }) {
  const canvas = within(canvasElement);
  const figure = await canvas.findByRole("figure");

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

  // #298 — every wedge is VISIBLE against its real painted ground: its
  // full-opacity outline, resolved in the running theme, reaches 3:1 against
  // the figure's resolved background. Measured on rendered colours, never
  // inferred from token names or opacity numbers.
  const ground = resolveColour(figure, getComputedStyle(figure).backgroundColor);
  for (const sector of sectors) {
    const style = getComputedStyle(sector);
    await expect(Number(style.strokeOpacity)).toBe(1);
    await expect(Number.parseFloat(style.strokeWidth)).toBeGreaterThanOrEqual(1);
    const edge = resolveColour(figure, style.stroke);
    await expect(contrastRatio(edge, ground)).toBeGreaterThanOrEqual(3);
  }

  // Twenty-four rim ticks, one real HairlineFloor per hour.
  const rimTicks = canvasElement.querySelectorAll(
    '[data-slot="chart-editorial-patchwork-rim-tick"]',
  );
  await expect(rimTicks).toHaveLength(24);
  const hairlines = canvasElement.querySelectorAll('[data-slot="hairline-floor"]');
  await expect(hairlines).toHaveLength(24);

  // #303 — every hour label, and every rim tick, lies fully inside the viewBox
  // (real-browser getBBox; jsdom would return zeroes and pass vacuously).
  const svg = figure.querySelector("svg") as SVGSVGElement;
  const { width, height } = svg.viewBox.baseVal;
  const labels = Array.from(
    svg.querySelectorAll<SVGTextElement>('[data-slot="chart-editorial-patchwork-hour-label"]'),
  );
  await expect(labels).toHaveLength(4);
  for (const label of labels) {
    const box = label.getBBox();
    await expect(box.width).toBeGreaterThan(0);
    await expect(box.x).toBeGreaterThanOrEqual(MARGIN);
    await expect(box.y).toBeGreaterThanOrEqual(MARGIN);
    await expect(box.x + box.width).toBeLessThanOrEqual(width - MARGIN);
    await expect(box.y + box.height).toBeLessThanOrEqual(height - MARGIN);
  }
  const svgRect = svg.getBoundingClientRect();
  for (const tick of Array.from(rimTicks)) {
    const rect = tick.getBoundingClientRect();
    await expect(rect.left).toBeGreaterThanOrEqual(svgRect.left);
    await expect(rect.right).toBeLessThanOrEqual(svgRect.right);
    await expect(rect.top).toBeGreaterThanOrEqual(svgRect.top);
    await expect(rect.bottom).toBeLessThanOrEqual(svgRect.bottom);
  }

  // #307 — a deliberate tab stop (documented in the block), with the house ring.
  if (focus) {
    await expect(figure.tabIndex).toBe(0);
    await expectHouseFocusRing(figure);
  }
}

export const Default: Story = {
  render: () => <ChartEditorialPatchwork />,
  play: async ({ canvasElement }) => playPatchwork(canvasElement, { focus: true }),
};

/** The derived label gutter holds at a smaller `size`, not only at the default. */
export const Small: Story = {
  render: () => <ChartEditorialPatchwork size={240} />,
  play: async ({ canvasElement }) => playPatchwork(canvasElement, { focus: false }),
};

/** … and at a larger one. */
export const Large: Story = {
  render: () => <ChartEditorialPatchwork size={480} />,
  play: async ({ canvasElement }) => playPatchwork(canvasElement, { focus: false }),
};
