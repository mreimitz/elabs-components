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

/** Three sheets cycling every 300 ms (real time — the interval is created against the real
 * clock the instant this story mounts, before `play` runs, so fake timers can't step it; a
 * short interval keeps the wait practical); Escape calls `onExit`; `refreshMs` calls
 * `onRefresh` on schedule. The `dashboard-presentation.test.tsx` unit tests cover the same
 * cycling/refresh/unmount behavior against fake timers, engaged before mount. */
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
