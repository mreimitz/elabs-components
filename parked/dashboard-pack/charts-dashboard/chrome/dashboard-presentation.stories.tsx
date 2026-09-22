import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, fn, waitFor, within } from "storybook/test";

import type { DashboardSpec } from "../core/spec";
import { DashboardProvider, DashboardSheet } from "../dashboard-sheet";
import { textTileKind } from "../tiles/text-tile";
import { DashboardPresentation } from "./dashboard-presentation";

function sheet(id: string, body: string): DashboardSpec {
  return {
    version: 1,
    id,
    grid: { mode: "fit", columns: 12, rows: 6 },
    tiles: [{ id: "note", kind: "text", layout: { x: 0, y: 0, w: 12, h: 6 }, content: { body } }],
  };
}

function sheetView(id: string, body: string) {
  return (
    <DashboardProvider key={id} spec={sheet(id, body)} tiles={[textTileKind]}>
      <DashboardSheet chrome={false} />
    </DashboardProvider>
  );
}

const meta = {
  title: "Dashboard/Chrome/DashboardPresentation",
  component: DashboardPresentation,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof DashboardPresentation>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Three sheets cycling every 300 ms (real time). RM-087 follow-up 1, F4: Storybook's
 * `addon-vitest` browser runner DOES support `vi.useFakeTimers()` inside a `play` function —
 * the blocker isn't availability, it's ORDERING: `render()` mounts the component (starting
 * the real `setInterval`) strictly before `play()` runs, in every Storybook story regardless
 * of test runner, so fake timers installed inside `play` can never intercept an interval
 * already bound to the real clock. A short real interval plus real-time `waitFor`s is the
 * only way to drive this in a genuine Storybook play; `dashboard-presentation.test.tsx`'s
 * jsdom unit tests cover the deterministic fake-timer version (exact `cycleMs` advances,
 * `onRefresh` call counts, stop-on-unmount), where `vi.useFakeTimers()` runs in `beforeEach`,
 * before `render()` ever executes.
 */
export const Presentation: Story = {
  args: {
    sheets: [
      sheetView("sheet-1", "First sheet"),
      sheetView("sheet-2", "Second sheet"),
      sheetView("sheet-3", "Third sheet"),
    ],
    cycleMs: 300,
    refreshMs: 500,
    onExit: fn(),
    onRefresh: fn(),
  },
  render: (args) => (
    <div className="h-[480px]">
      <DashboardPresentation {...args} />
    </div>
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // A tile's body mounts lazily once it intersects (dashboard-sheet.tsx) — a real,
    // browser-native `IntersectionObserver` callback — so every assertion here waits
    // (`findByText`/`waitFor`) rather than asserting synchronously.
    await expect(await canvas.findByText("First sheet")).toBeInTheDocument();
    await expect(await canvas.findByText("Second sheet")).toBeInTheDocument();
    await expect(await canvas.findByText("Third sheet")).toBeInTheDocument();
    // Wraps back to the first sheet (the acceptance text's "wrapping around").
    await expect(await canvas.findByText("First sheet")).toBeInTheDocument();
    await waitFor(() => expect(args.onRefresh).toHaveBeenCalled());

    const root = canvasElement.querySelector('[data-slot="dashboard-presentation"]') as HTMLElement;
    root.focus();
    fireEvent.keyDown(root, { key: "Escape" });
    await waitFor(() => expect(args.onExit).toHaveBeenCalledTimes(1));
  },
};

/** No `sheets`: a single, non-cycling view — no dots, no auto-advance. */
export const SingleSheet: Story = {
  args: { onExit: fn() },
  render: (args) => (
    <div className="h-[480px]">
      <DashboardPresentation {...args}>{sheetView("sheet-1", "Only sheet")}</DashboardPresentation>
    </div>
  ),
};
