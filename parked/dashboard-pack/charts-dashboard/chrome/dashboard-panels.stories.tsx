import type { Meta, StoryObj } from "@storybook/react-vite";
import { Toaster } from "@elabs-ai/components-ui";
import { expect, userEvent, waitFor, within } from "storybook/test";

import type { DashboardSpec } from "../core/spec";
import type { DashboardStore } from "../core/store";
import { DashboardProvider, DashboardSheet, useDashboard } from "../dashboard-sheet";
import { useDashboardContext } from "../dashboard-sheet/use-dashboard";
import { builtInTiles } from "../tiles";
import { DashboardAssetPanel } from "./dashboard-asset-panel";
import { DashboardPropertiesPanel } from "./dashboard-properties-panel";

declare global {
  interface Window {
    /** Installed by the dashboard stories so plays read the real store. */
    __dashboardStore?: DashboardStore;
  }
}

const PANELS_SPEC: DashboardSpec = {
  version: 1,
  id: "panels",
  title: "Revenue review",
  grid: { mode: "fit", columns: 24, rows: 12, gap: 8 },
  tiles: [
    {
      id: "chart-1",
      kind: "chart",
      title: "Revenue by month",
      layout: { x: 0, y: 0, w: 8, h: 9 },
      content: {
        type: "bar",
        x: "month",
        series: ["revenue"],
        data: [
          { month: "Jan", revenue: 12 },
          { month: "Feb", revenue: 18 },
          { month: "Mar", revenue: 15 },
        ],
      },
    },
  ],
  library: [
    {
      id: "lib-note",
      kind: "text",
      label: "Definitions note",
      title: "Definitions",
      content: { body: "Revenue is recognised on delivery." },
    },
  ],
  bookmarks: [{ id: "q1", label: "Q1 only", selection: { month: ["Jan", "Feb", "Mar"] } }],
};

const FULL_SPEC: DashboardSpec = {
  ...PANELS_SPEC,
  tiles: [{ ...PANELS_SPEC.tiles[0]!, layout: { x: 0, y: 0, w: 24, h: 12 } }],
};

function StoreProbe() {
  window.__dashboardStore = useDashboardContext().store;
  const tiles = useDashboard((s) =>
    JSON.stringify(s.spec.tiles.map((t) => ({ id: t.id, kind: t.kind, ...t.layout }))),
  );
  return (
    <pre data-testid="tiles" className="text-code whitespace-pre-wrap text-muted-foreground">
      {tiles}
    </pre>
  );
}

function Panels({ spec }: { spec: DashboardSpec }) {
  return (
    <DashboardProvider spec={spec} tiles={builtInTiles} mode="edit">
      <div className="flex h-[640px] w-full min-w-0">
        <DashboardAssetPanel defaultOpen minWidth={280} defaultWidth={280} minContentWidth={400} />
        <main className="min-w-0 flex-1 p-2">
          {/* responsive layout — RM-084 follow-up 2 (F1): two 280px docks otherwise squeeze this
           * host below the new `sm` (640px) container-query threshold in the real-browser test
           * runner (measured 624px), force-dropping the story's explicit `mode="edit"` to view —
           * the edit layer never mounts, so the drag-drop play adds nothing. `min-w-*` (not a
           * fixed `w-[…]`) keeps the sheet genuinely ≥ `sm` without pinning an upper bound
           * (`no-fixed-story-wrapper`). */}
          <div data-testid="host" className="h-[480px] w-full min-w-[680px]">
            <DashboardSheet renderAll />
          </div>
          <StoreProbe />
        </main>
        <DashboardPropertiesPanel
          defaultOpen
          minWidth={280}
          defaultWidth={280}
          minContentWidth={400}
        />
      </div>
      <Toaster />
    </DashboardProvider>
  );
}

const meta = {
  title: "Dashboard/Chrome/Panels",
  component: Panels,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The dashboard editor's side panels: the asset library to drag new tiles from and the properties panel that edits the selected tile.",
      },
    },
  },
  tags: ["autodocs"],
  args: { spec: PANELS_SPEC },
} satisfies Meta<typeof Panels>;
export default meta;
type Story = StoryObj<typeof meta>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const store = () => window.__dashboardStore as DashboardStore;
const specTiles = () =>
  store()
    .getState()
    .spec.tiles.map((t) => ({ kind: t.kind, ...t.layout }));
const propertiesDock = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('[data-dashboard-panel="properties"]')!;
const tileOf = (kind: string) =>
  store()
    .getState()
    .spec.tiles.find((t) => t.kind === kind);

/** A real pointer drag from `el` to a viewport point — dnd-kit's PointerSensor. */
async function pointerDragTo(el: HTMLElement, to: { x: number; y: number }) {
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const init = { bubbles: true, cancelable: true, isPrimary: true, button: 0, pointerId: 1 };
  el.dispatchEvent(
    new PointerEvent("pointerdown", { ...init, pointerType: "mouse", clientX: x, clientY: y }),
  );
  const steps = 10;
  for (let i = 1; i <= steps; i++) {
    await sleep(16);
    document.dispatchEvent(
      new PointerEvent("pointermove", {
        ...init,
        pointerType: "mouse",
        clientX: x + ((to.x - x) * i) / steps,
        clientY: y + ((to.y - y) * i) / steps,
      }),
    );
  }
  await sleep(16);
  document.dispatchEvent(
    new PointerEvent("pointerup", { ...init, pointerType: "mouse", clientX: to.x, clientY: to.y }),
  );
  await sleep(50);
}

/** The viewport centre of cell (x, y) on the rendered sheet. */
function cellCentre(sheet: HTMLElement, spec: DashboardSpec, x: number, y: number) {
  const box = sheet.getBoundingClientRect();
  const gap = spec.grid.gap ?? 8;
  const w = (box.width + gap) / spec.grid.columns;
  const h = (box.height + gap) / (spec.grid.rows ?? 12);
  return { x: box.left + (x + 0.5) * w, y: box.top + (y + 0.5) * h };
}

export const Default: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const sheet = await canvas.findByRole("region", { name: "Revenue review" });
    await waitFor(() => expect(sheet.getBoundingClientRect().width).toBeGreaterThan(0));

    await step("both docks are open side by side without overlap", async () => {
      const docks = canvasElement.querySelectorAll<HTMLElement>(
        '[data-slot="side-dock-container"]',
      );
      await expect(docks).toHaveLength(2);
      const [left, right] = [...docks].map((d) => d.getBoundingClientRect());
      await expect(left!.right).toBeLessThanOrEqual(right!.left);
    });

    await step("drag Metric onto cell (8,0) creates a metric tile there", async () => {
      const row = canvas.getByRole("option", { name: "Metric" });
      await pointerDragTo(row, cellCentre(sheet, PANELS_SPEC, 8, 0));
      await waitFor(() => expect(store().getState().spec.tiles).toHaveLength(2));
      const tiles = specTiles();
      await expect(tiles).toEqual([
        { kind: "chart", x: 0, y: 0, w: 8, h: 9 },
        { kind: "metric", x: 8, y: 0, w: 4, h: 2 },
      ]);
    });

    await step("keyboard: search Text + Enter places it, announces it, keeps focus", async () => {
      const search = canvas.getAllByRole("combobox", { name: "Tiles" })[0]!;
      await userEvent.click(search);
      await userEvent.keyboard("Text{Enter}");
      await waitFor(() => expect(store().getState().spec.tiles).toHaveLength(3));
      const tiles = specTiles();
      await expect(tiles[2]).toEqual({ kind: "text", x: 12, y: 0, w: 6, h: 3 });
      const status = canvasElement.querySelector('[data-slot="dashboard-asset-panel-status"]');
      await waitFor(() => expect(status).toHaveTextContent("Text added at column 13, row 1."));
      // Focus stays in the search box so the next asset can be placed straight away.
      await expect(document.activeElement).toBe(search);
    });

    await step("the sheet form's Title renames the sheet region", async () => {
      store().getState().actions.setFocus([]);
      const dock = within(propertiesDock(canvasElement));
      await dock.findByText("Sheet properties");
      const title = dock.getByRole("textbox", { name: "Title" });
      await waitFor(() => expect(title).toHaveValue("Revenue review"));
      await userEvent.clear(title);
      await userEvent.type(title, "Revenue, Q1");
      await userEvent.tab();
      await canvas.findByRole("region", { name: "Revenue, Q1" });
    });

    await step("tile Title edit commits once on blur", async () => {
      store().getState().actions.setFocus(["chart-1"]);
      const dock = within(propertiesDock(canvasElement));
      const title = await dock.findByDisplayValue("Revenue by month");
      await expect(title).toHaveAccessibleName("Title");
      const before = store().getState().history.past;
      await userEvent.clear(title);
      await userEvent.type(title, "Revenue peaked in February");
      await userEvent.tab();
      await waitFor(() => expect(tileOf("chart")?.title).toBe("Revenue peaked in February"));
      const after = store().getState().history.past;
      await expect(after).toBe(before + 1);
      await within(sheet).findByText("Revenue peaked in February");
    });

    await step("a visibleWhen syntax error shows and does not commit", async () => {
      const field = within(propertiesDock(canvasElement)).getByRole("textbox", {
        name: "Show when",
      });
      await userEvent.type(field, "variables.x &&");
      await userEvent.tab();
      await canvas.findByRole("alert");
      await expect(tileOf("chart")?.visibleWhen).toBeUndefined();
    });

    await step("applying a bookmark announces it (#429)", async () => {
      await userEvent.click(canvas.getByRole("tab", { name: "Bookmarks" }));
      await userEvent.click(await canvas.findByRole("option", { name: "Q1 only" }));
      await waitFor(() =>
        expect(store().getState().selection.fields.month?.values).toEqual(["Jan", "Feb", "Mar"]),
      );
      // Reuses the asset panel's own `place` live region (one region, per the brief).
      const status = canvasElement.querySelector('[data-slot="dashboard-asset-panel-status"]');
      await waitFor(() => expect(status).toHaveTextContent("Bookmark “Q1 only” applied."));
    });
  },
};

export const Library: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const sheet = await canvas.findByRole("region", { name: "Revenue review" });
    await userEvent.click(canvas.getByRole("tab", { name: "Library" }));
    await userEvent.click(await canvas.findByRole("option", { name: "Definitions note" }));
    await waitFor(() =>
      expect(
        store()
          .getState()
          .spec.tiles.find((t) => t.ref === "lib-note"),
      ).toBeDefined(),
    );
    // The placed tile is focused, so the properties panel also shows its body in a textarea;
    // the tile itself renders the body once, inside the sheet.
    await within(sheet).findByText("Revenue is recognised on delivery.");
  },
};

export const NoRoom: Story = {
  args: { spec: FULL_SPEC },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("region", { name: "Revenue review" });
    await userEvent.click(canvas.getByRole("option", { name: "Text" }));
    await within(document.body).findByText("There is no room on the sheet for this tile.");
    await expect(store().getState().spec.tiles).toHaveLength(1);
  },
};
