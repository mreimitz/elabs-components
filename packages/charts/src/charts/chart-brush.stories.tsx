import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Button } from "@elabs-ai/components-ui";
import { AreaChart } from "./area-chart";
import { Area } from "./area";
import { ChartBrush, type ChartBrushSelection } from "./chart-brush";
import { XAxis } from "./x-axis";

const meta = {
  title: "Charts/ChartBrush",
  component: ChartBrush,
  tags: ["autodocs"],
  args: { onSelectionChange: fn() },
} satisfies Meta<typeof ChartBrush>;

export default meta;
type Story = StoryObj<typeof meta>;

const data = [
  { date: new Date("2024-01-01"), visits: 186 },
  { date: new Date("2024-02-01"), visits: 305 },
  { date: new Date("2024-03-01"), visits: 237 },
  { date: new Date("2024-04-01"), visits: 73 },
  { date: new Date("2024-05-01"), visits: 209 },
  { date: new Date("2024-06-01"), visits: 214 },
];

/** Drag across the chart to select a time range; the handles resize it. */
export const Default: Story = {
  args: {
    initialSelection: { start: new Date("2024-02-01"), end: new Date("2024-04-01") },
  },
  render: (args) => (
    <div className="h-72 w-full max-w-[560px]">
      <AreaChart
        data={data}
        animationDuration={0}
        aspectRatio={undefined}
        style={{ height: "100%" }}
      >
        <Area dataKey="visits" fill="var(--chart-1)" stroke="var(--chart-1)" fillOpacity={0.4} />
        <XAxis />
        <ChartBrush {...args} />
      </AreaChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    // The initial selection draws a real window with both resize handles.
    await waitFor(() => {
      const selection = canvasElement.querySelector(".visx-brush-selection");
      expect(selection).not.toBeNull();
      expect(Number(selection!.getAttribute("width"))).toBeGreaterThan(0);
      expect(
        canvasElement.querySelectorAll(".visx-brush-handle-left, .visx-brush-handle-right").length,
      ).toBe(2);
    });
  },
};

const FEB_TO_APR: ChartBrushSelection = {
  start: new Date("2024-02-01"),
  end: new Date("2024-04-01"),
};
const APR_TO_JUN: ChartBrushSelection = {
  start: new Date("2024-04-01"),
  end: new Date("2024-06-01"),
};

function selectionX(canvasElement: HTMLElement): number {
  const selection = canvasElement.querySelector(".visx-brush-selection");
  expect(selection).not.toBeNull();
  expect(Number(selection!.getAttribute("width"))).toBeGreaterThan(0);
  return Number(selection!.getAttribute("x"));
}

/**
 * Controlled: the parent owns the window through `selection` and hands back what
 * `onSelectionChange` reports, so a drag keeps going. The button sets a window of
 * its own, and the brush moves there.
 */
export const Controlled: Story = {
  render: function ControlledBrushStory(args) {
    const [selection, setSelection] = useState<ChartBrushSelection | null>(FEB_TO_APR);
    return (
      <div className="flex w-full max-w-[560px] flex-col gap-3">
        <div>
          <Button onClick={() => setSelection(APR_TO_JUN)} size="sm" variant="outline">
            Show April to June
          </Button>
        </div>
        <div className="h-72 w-full">
          <AreaChart
            data={data}
            animationDuration={0}
            aspectRatio={undefined}
            style={{ height: "100%" }}
          >
            <Area
              dataKey="visits"
              fill="var(--chart-1)"
              stroke="var(--chart-1)"
              fillOpacity={0.4}
            />
            <XAxis />
            <ChartBrush
              {...args}
              onSelectionChange={(next) => {
                args.onSelectionChange?.(next);
                setSelection(next);
              }}
              selection={selection}
            />
          </AreaChart>
        </div>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    // The controlled window is drawn on load…
    const before = await waitFor(() => selectionX(canvasElement));
    const rect = canvasElement.querySelector(".visx-brush-selection") as SVGRectElement;
    const widthBefore = Number(rect.getAttribute("width"));

    // …a drag on the right handle keeps going while the parent echoes each report
    // (the brush stays mounted; its window widens with the pointer)…
    const handle = canvasElement.querySelector(".visx-brush-handle-right") as Element;
    const box = handle.getBoundingClientRect();
    // Whole pixels: a MouseEvent rounds its coordinates, a PointerEvent does not.
    const x = Math.round(box.left + box.width / 2);
    const y = Math.round(box.top + box.height / 2);
    const pause = () => new Promise((resolve) => setTimeout(resolve, 30));
    handle.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: x,
        clientY: y,
        isPrimary: true,
        pointerId: 1,
      }),
    );
    await pause();
    for (const dx of [20, 40]) {
      window.dispatchEvent(
        new MouseEvent("mousemove", { buttons: 1, clientX: x + dx, clientY: y }),
      );
      await pause();
    }
    window.dispatchEvent(new MouseEvent("mouseup", { clientX: x + 40, clientY: y }));
    await waitFor(() => {
      const after = canvasElement.querySelector(".visx-brush-selection");
      expect(after).toBe(rect);
      // A remount per echo would kill the drag after the first move (at most +4 px).
      expect(Number(after!.getAttribute("width"))).toBeGreaterThan(widthBefore + 30);
    });

    // …and it moves when the parent sets a window of its own.
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Show April to June" }),
    );
    await waitFor(() => {
      expect(selectionX(canvasElement)).toBeGreaterThan(before);
    });
  },
};
