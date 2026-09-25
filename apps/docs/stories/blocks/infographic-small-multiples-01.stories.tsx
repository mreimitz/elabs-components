import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import { InfographicSmallMultiples } from "@/components/infographic-small-multiples-01/infographic-small-multiples";
import { onTimeByRegionPositiveOutlier } from "@/components/infographic-small-multiples-01/data/region-on-time";

/**
 * Renders the SHIPPED registry block, not a copy of it. `@/components/…` is the
 * consumer-side alias `npx shadcn add` writes against; `apps/docs/.storybook/main.ts`
 * maps it to `registry/blocks`, so what you see here is byte-for-byte what a
 * consumer installs. See `.claude/rules/registry.md`.
 */
const meta = {
  title: "Patterns/Blocks/Infographics/Small Multiples",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "Which one is the outlier?",
      description: {
        component:
          'Answers “which region is the outlier?” — twelve depots in a `ChartMultiples` grid, one 13-week line per panel, every panel on the SAME y-axis so height compares directly. Every panel carries the SAME `analytics` line (`{ kind: "line", value: <network mean>, label: "none" }`), named once in the “how to read” copy rather than per panel. Each panel title carries its depot’s latest reading, replaced by the hovered week’s reading while any panel is hovered, so one hover reads the same week across all twelve. The outlier is ringed, thicker and glyphed, never coloured alone. Semantic tokens only; reads in both themes.\n\nCopy-own it: `npx shadcn add infographic-small-multiples-01` (pulls `kpi-card-parts`).',
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof InfographicSmallMultiples>;

export default meta;
type Story = StoryObj<typeof meta>;

type Box = { left: number; top: number; right: number; bottom: number };

const TOOLTIP_BOX = '[data-slot="chart-tooltip-box"]';

function overlaps(a: Box, b: Box) {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** The mouse cursor's ink around its hotspot (the charts' own cursor keep-out). */
function cursorBox(x: number, y: number): Box {
  return { left: x - 12, top: y - 12, right: x + 16, bottom: y + 20 };
}

/** Moves the mouse to a viewport point, the way a real move reaches the chart under it. */
async function moveMouse(doc: Document, clientX: number, clientY: number) {
  const win = doc.defaultView as Window;
  const target = doc.elementFromPoint(clientX, clientY) ?? doc.body;
  const init: MouseEventInit = { bubbles: true, cancelable: true, clientX, clientY, view: win };
  target.dispatchEvent(new PointerEvent("pointermove", { ...init, pointerType: "mouse" }));
  target.dispatchEvent(new MouseEvent("mousemove", init));
  for (let frame = 0; frame < 4; frame += 1) {
    await new Promise((resolve) => win.requestAnimationFrame(resolve));
  }
}

/**
 * Hovering a panel reads that week in a box BESIDE the panel: never over the
 * hovered panel's chart or the cursor (it may sit over a neighbour panel).
 */
export const Default: Story = {
  render: () => <InfographicSmallMultiples />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const charts = Array.from(
      canvasElement.querySelectorAll<HTMLElement>(
        '[data-slot="chart-multiples-panel"] [data-chart-breakpoint]',
      ),
    );
    await expect(charts.length).toBe(12);
    // First, last of the first row, and the first of the last row.
    const firstRowTop = charts[0]?.getBoundingClientRect().top;
    const firstRow = charts.filter((chart) => chart.getBoundingClientRect().top === firstRowTop);
    const panels = [
      charts[0],
      firstRow.at(-1),
      charts.at(-1 - ((charts.length - 1) % firstRow.length)),
    ];

    for (const chart of panels) {
      const frame = (chart as HTMLElement).getBoundingClientRect();
      const y = frame.top + frame.height / 2;
      // A chart answers hover once its entrance has settled.
      await waitFor(
        async () => {
          await moveMouse(doc, frame.left + 10, y);
          await expect(doc.querySelector(TOOLTIP_BOX)).not.toBeNull();
        },
        { timeout: 5000 },
      );
      for (let x = frame.left + 10; x < frame.right - 6; x += 16) {
        await moveMouse(doc, x, y);
        const box = doc.querySelector<HTMLElement>(TOOLTIP_BOX);
        await expect(box).not.toBeNull();
        const rect = (box as HTMLElement).getBoundingClientRect();
        await expect(overlaps(rect, cursorBox(x, y)), `box covers the cursor at ${x},${y}`).toBe(
          false,
        );
        await expect(overlaps(rect, frame), `box covers the hovered panel at ${x},${y}`).toBe(
          false,
        );
        await expect(box).toHaveTextContent(/Week \d+/);
        await expect(box).toHaveTextContent(/%/);
      }
    }
  },
};

/** Same twelve-depot network, a different quarter's story: one depot pulls dramatically ahead instead of one falling behind. */
export const PositiveOutlier: Story = {
  render: () => <InfographicSmallMultiples regions={onTimeByRegionPositiveOutlier} />,
};

export const Loading: Story = { render: () => <InfographicSmallMultiples loading /> };

export const Compact: Story = {
  render: () => (
    <div className="w-[320px]">
      <InfographicSmallMultiples />
    </div>
  ),
};
