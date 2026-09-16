import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { ChartEditorialHourglass } from "@/components/chart-editorial-hourglass/chart-editorial-hourglass";
import { expectHouseFocusRing } from "./_chart-editorial-assertions";

const meta = {
  title: "Patterns/Blocks/Chart Editorial — Hourglass Stream",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A funnel redrawn as counted barcode strips with trickle threads narrowing between stages, adapted from lieflat-charts' 'L13 Hourglass Stream'. Every tick is worth the stated unit; what does not fill a whole tick is named beside the strip. One-off editorial composition — copy-own it: `npx shadcn add chart-editorial-hourglass`.",
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
    const figure = await canvas.findByRole("figure");

    const strips = Array.from(
      canvasElement.querySelectorAll<SVGGElement>('[data-slot="chart-editorial-hourglass-strip"]'),
    );
    // Five stages in the default data.
    await expect(strips).toHaveLength(5);

    // The narrowing property: the first (widest) stage draws strictly more
    // ticks than the last (narrowest) stage.
    const ticksOf = (strip: SVGGElement | undefined) =>
      strip?.querySelectorAll('[data-slot="unit-stack-unit"]').length ?? 0;
    await expect(ticksOf(strips[0])).toBeGreaterThan(ticksOf(strips[strips.length - 1]));

    // Thread density narrows gap over gap, matching the funnel's own order.
    const gaps = Array.from(
      canvasElement.querySelectorAll<SVGGElement>('[data-slot="chart-editorial-hourglass-gap"]'),
    );
    await expect(gaps).toHaveLength(4);
    const counts = gaps.map((gap) => Number(gap.dataset.threadCount));
    for (let i = 1; i < counts.length; i += 1) {
      await expect(counts[i]).toBeLessThanOrEqual(counts[i - 1] as number);
    }

    // #300 — the unit is stated visibly, and every tick is worth exactly that
    // unit: measured off the RENDERED tick count, drawn ticks × unit plus the
    // stated remainder equals the value, and the remainder never reaches a
    // whole tick (so nothing was rounded up or silently dropped).
    const caption = canvasElement.querySelector('[data-slot="chart-editorial-hourglass-caption"]');
    const stated = /1 tick = ([\d,.]+)/.exec(caption?.textContent ?? "")?.[1];
    await expect(stated).toBeDefined();
    const unit = Number(stated?.replaceAll(",", ""));
    await expect(unit).toBe(Number(figure.dataset.unit));
    for (const strip of strips) {
      const value = Number(strip.dataset.value);
      const remainder = Number(strip.dataset.remainder);
      await expect(ticksOf(strip) * unit + remainder).toBeCloseTo(value, 6);
      await expect(remainder).toBeGreaterThanOrEqual(0);
      await expect(remainder).toBeLessThan(unit);
      if (remainder > 0) {
        await expect(strip.textContent).toMatch(/rounded away/);
      }
    }

    // #301 — one percentage model. Every visible gap percentage has a stated
    // baseline (the caption names it), and the screen-reader summary quotes the
    // SAME number for that baseline.
    await expect(caption?.textContent).toMatch(/% of the previous stage/);
    const summary = canvasElement.querySelector(
      '[data-slot="chart-editorial-hourglass-summary"]',
    )?.textContent;
    await expect(summary).toMatch(/1 tick = [\d,.]+/);
    for (const [i, gap] of gaps.entries()) {
      const visible = /(\d+)%/.exec(gap.textContent ?? "")?.[1];
      const next = strips[i + 1]?.dataset.stage ?? "";
      const previous = strips[i]?.dataset.stage ?? "";
      const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const spoken = new RegExp(
        `${escape(next)}: [^—]+— (\\d+)% of previous stage \\(${escape(previous)}\\)`,
      ).exec(summary ?? "")?.[1];
      await expect(visible).toBeDefined();
      await expect(spoken).toBe(visible);
    }

    // #307 — a scroll container at narrow widths, so it stays a tab stop, with
    // the house focus ring.
    await expect(figure.tabIndex).toBe(0);
    await expectHouseFocusRing(figure);
  },
};
