import { useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Toaster } from "@elabs-ai/components-ui";

import { useDashboardShortcuts } from "../chrome";
import { compact } from "../core/layout";
import type { DashboardSpec, TileLayout } from "../core/spec";
import type { DashboardStore } from "../core/store";
import {
  DashboardProvider,
  DashboardSheet,
  createPlaceholderTileKind,
  useDashboard,
} from "../dashboard-sheet";
import { useDashboardContext } from "../dashboard-sheet/use-dashboard";
import { DashboardTileContextMenu } from "./tile-context-menu";
import { topLevelLayout } from "./geometry";
import { DashboardMarquee, useDashboardMarquee } from "./marquee";
import { EDIT_FIT_SPEC, EDIT_FLOW_SPEC } from "./edit-specs";

declare global {
  interface Window {
    /** Installed by the edit-layer stories so plays (and validators) read the real store. */
    __dashboardStore?: DashboardStore;
  }
}

const TILES = ["chart", "text"].map((kind) => createPlaceholderTileKind(kind));

/** Installs `window.__dashboardStore` and prints `spec.tiles[].layout` for the plays. */
function StoreProbe() {
  const { store } = useDashboardContext();
  window.__dashboardStore = store;
  const layout = useDashboard((s) =>
    JSON.stringify(s.spec.tiles.map((t) => ({ id: t.id, ...t.layout }))),
  );
  return (
    <pre data-testid="layout" className="mt-2 text-code whitespace-pre-wrap text-muted-foreground">
      {layout}
    </pre>
  );
}

function EditSheet({ spec }: { spec: DashboardSpec }) {
  return (
    <DashboardProvider spec={spec} tiles={TILES} mode="edit">
      <div data-testid="host" className="h-[480px] max-h-[80vh] w-full">
        <DashboardSheet renderAll />
      </div>
      <StoreProbe />
    </DashboardProvider>
  );
}

/**
 * RM-081's tile operations, driven end to end: `useDashboardShortcuts` (Mod+A/C/X/V, Delete
 * with an Undo toast, Shift+F10) wraps the sheet; `useDashboardMarquee` overlays a drag-select
 * rectangle on the same sheet element; `DashboardTileContextMenu` wraps one tile's move handle
 * area to exercise Replace with…/Paste and replace/Bring forward through the real menu. None of
 * this is wired into `DashboardEditLayer`/`DashboardTile` themselves (RM-078/079 files, out of
 * this RM's touches) — a host composes these the same way this story does.
 */
function TileOpsSheet({ spec }: { spec: DashboardSpec }) {
  return (
    <DashboardProvider spec={spec} tiles={TILES} mode="edit">
      <TileOpsBody />
    </DashboardProvider>
  );
}

function TileOpsBody() {
  const containerRef = useDashboardShortcuts();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const liveSpec = useDashboard((s) => s.spec);
  const { rect } = useDashboardMarquee({
    sheetRef,
    grid: liveSpec.grid,
    size,
    layout: topLevelLayout(liveSpec),
    onSelect: (ids, additive) => {
      const actions = window.__dashboardStore!.getState().actions;
      const current = window.__dashboardStore!.getState().focus;
      actions.setFocus(additive ? [...new Set([...current, ...ids])] : ids);
    },
  });

  return (
    <div ref={containerRef}>
      <Toaster />
      <div data-testid="host" className="relative h-[480px] max-h-[80vh] w-full">
        <DashboardSheet
          renderAll
          ref={(node) => {
            sheetRef.current = node;
            if (node) {
              const box = node.getBoundingClientRect();
              if (box.width !== size.width || box.height !== size.height) {
                setSize({ width: box.width, height: box.height });
              }
            }
          }}
        />
        {rect ? <DashboardMarquee rect={rect} data-testid="marquee" /> : null}
      </div>
      <DashboardTileContextMenu tileId="chart-1">
        <button type="button" data-testid="chart-1-menu-trigger" className="mt-2">
          Tile actions: Revenue
        </button>
      </DashboardTileContextMenu>
      <StoreProbe />
    </div>
  );
}

const meta = {
  title: "Dashboard/Edit",
  component: EditSheet,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  args: { spec: EDIT_FIT_SPEC },
} satisfies Meta<typeof EditSheet>;
export default meta;
type Story = StoryObj<typeof meta>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const store = () => window.__dashboardStore as DashboardStore;
const layoutOf = (id: string) =>
  store()
    .getState()
    .spec.tiles.find((t) => t.id === id)?.layout as Omit<TileLayout, "id">;
const announcer = (root: HTMLElement) =>
  root.querySelector('[data-slot="dashboard-edit-layer-announcer"]') as HTMLElement;

/** Cell size plus gap, measured from the rendered sheet. */
function pitch(sheet: HTMLElement, spec: DashboardSpec) {
  const box = sheet.getBoundingClientRect();
  const gap = spec.grid.gap ?? 8;
  const rows = spec.grid.mode === "fit" ? (spec.grid.rows ?? 12) : 0;
  return {
    width: (box.width + gap) / spec.grid.columns,
    height: rows ? (box.height + gap) / rows : (spec.grid.rowHeight ?? 30) + gap,
  };
}

/** A real pointer drag: pointerdown on `el`, stepped pointermoves, pointerup — dnd-kit's PointerSensor. */
async function pointerDrag(el: HTMLElement, dx: number, dy: number) {
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const init = { bubbles: true, cancelable: true, isPrimary: true, button: 0, pointerId: 1 };
  el.dispatchEvent(
    new PointerEvent("pointerdown", { ...init, pointerType: "mouse", clientX: x, clientY: y }),
  );
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    await sleep(16);
    document.dispatchEvent(
      new PointerEvent("pointermove", {
        ...init,
        pointerType: "mouse",
        clientX: x + (dx * i) / steps,
        clientY: y + (dy * i) / steps,
      }),
    );
  }
  await sleep(16);
  document.dispatchEvent(
    new PointerEvent("pointerup", {
      ...init,
      pointerType: "mouse",
      clientX: x + dx,
      clientY: y + dy,
    }),
  );
  await sleep(16);
}

const reset = async (spec: DashboardSpec) => {
  store().getState().actions.setSpec(spec);
  await sleep(50);
};

export const Fit24x12: Story = {
  name: "Fit 24×12",
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const sheet = await canvas.findByRole("region", { name: EDIT_FIT_SPEC.title });
    await waitFor(() => expect(sheet.querySelectorAll("[data-tile-id]").length).toBe(4));
    const p = pitch(sheet, EDIT_FIT_SPEC);

    // a11y surface: one live region per sheet; the drag button has a name.
    await expect(
      sheet.querySelectorAll('[data-slot="dashboard-edit-layer-announcer"]'),
    ).toHaveLength(1);
    const move = canvas.getByRole("button", { name: "Move Revenue" });

    await step("(a) pointer-drag chart-1 from (0,0) to (8,4)", async () => {
      const past = store().getState().history.past;
      await pointerDrag(move, 8 * p.width, 4 * p.height);
      await waitFor(() => expect(layoutOf("chart-1")).toMatchObject({ x: 8, y: 4, w: 6, h: 4 }));
      const tiles = store()
        .getState()
        .spec.tiles.map((t) => ({ id: t.id, ...t.layout }));
      const overlaps = tiles.some((a, i) =>
        tiles
          .slice(i + 1)
          .some((b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h),
      );
      await expect(overlaps).toBe(false);
      // One history entry for the whole gesture, not one per pointer move.
      await expect(store().getState().history.past).toBe(past + 1);
      await expect(canvas.getByTestId("layout")).toHaveTextContent('"id":"chart-1","x":8,"y":4');
    });

    await step("(h) undo restores (0,0)", async () => {
      store().getState().actions.undo();
      await waitFor(() => expect(layoutOf("chart-1")).toMatchObject({ x: 0, y: 0 }));
    });

    await step("(b) a drop onto an occupied cell in fit is rejected", async () => {
      await pointerDrag(canvas.getByRole("button", { name: "Move Revenue" }), 16 * p.width, 0);
      await waitFor(() =>
        expect(announcer(sheet)).toHaveTextContent("Cannot place here — not enough room"),
      );
      await expect(layoutOf("chart-1")).toMatchObject({ x: 0, y: 0, w: 6, h: 4 });
      await expect(layoutOf("chart-2")).toMatchObject({ x: 16, y: 0 });
    });

    await step("(c) drag the bottom-right handle by two cells", async () => {
      const tile = sheet.querySelector<HTMLElement>('[data-tile-id="chart-1"]')!;
      tile.focus();
      const handle = await canvas.findByRole("button", {
        name: "Resize Revenue from bottom-right",
      });
      await pointerDrag(handle, 2 * p.width, 2 * p.height);
      await waitFor(() => expect(layoutOf("chart-1")).toMatchObject({ x: 0, y: 0, w: 8, h: 6 }));
      await reset(EDIT_FIT_SPEC);
    });

    await step("(d) keyboard: focus chart-1, Enter, ArrowRight ×3, Enter", async () => {
      const tile = sheet.querySelector<HTMLElement>('[data-tile-id="chart-1"]')!;
      tile.focus();
      await userEvent.keyboard("{Enter}");
      await sleep(50);
      for (let i = 0; i < 3; i++) {
        await userEvent.keyboard("{ArrowRight}");
        await sleep(30);
      }
      const badge = tile.querySelector('[data-slot="tile-size-badge"]') as HTMLElement;
      await expect(badge).toHaveTextContent("(4,1) ⤢ 6 × 4");
      await expect(announcer(sheet)).toHaveTextContent("Moved to column 4, row 1");
      await userEvent.keyboard("{Enter}");
      await waitFor(() => expect(layoutOf("chart-1")).toMatchObject({ x: 3, y: 0 }));
      await expect(announcer(sheet)).toHaveTextContent(
        "Dropped Revenue at column 4, row 1, size 6 by 4",
      );
      await reset(EDIT_FIT_SPEC);
    });

    await step("(e) focus the right handle, Shift+ArrowRight, Enter → w + 4", async () => {
      sheet.querySelector<HTMLElement>('[data-tile-id="chart-1"]')!.focus();
      const right = await canvas.findByRole("button", { name: "Resize Revenue from right" });
      right.focus();
      await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift}");
      await expect(announcer(sheet)).toHaveTextContent("Resizing Revenue: 10 by 4");
      await userEvent.keyboard("{Enter}");
      await waitFor(() => expect(layoutOf("chart-1")).toMatchObject({ w: 10, h: 4 }));
      await reset(EDIT_FIT_SPEC);
    });

    await step("(f) Escape mid-drag restores the layout", async () => {
      const tile = sheet.querySelector<HTMLElement>('[data-tile-id="chart-1"]')!;
      tile.focus();
      const past = store().getState().history.past;
      await userEvent.keyboard("{Enter}");
      await sleep(50);
      await userEvent.keyboard("{ArrowDown}");
      await sleep(30);
      await userEvent.keyboard("{ArrowDown}");
      await sleep(30);
      await waitFor(() =>
        expect(sheet.querySelector('[data-slot="dashboard-edit-layer-ghost"]')).not.toBeNull(),
      );
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(announcer(sheet)).toHaveTextContent("Cancelled"));
      await expect(layoutOf("chart-1")).toMatchObject({ x: 0, y: 0, w: 6, h: 4 });
      await expect(store().getState().history.past).toBe(past);
      await expect(sheet.querySelector('[data-slot="dashboard-edit-layer-ghost"]')).toBeNull();
    });
  },
};

export const Flow: Story = {
  args: { spec: EDIT_FLOW_SPEC },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const sheet = await canvas.findByRole("region", { name: EDIT_FLOW_SPEC.title });
    await waitFor(() => expect(sheet.querySelectorAll("[data-tile-id]").length).toBe(3));
    const p = pitch(sheet, EDIT_FLOW_SPEC);
    await step(
      "(g) dropping onto a tile pushes the collider down; compact leaves no gaps",
      async () => {
        await pointerDrag(canvas.getByRole("button", { name: "Move Alpha" }), 12 * p.width, 0);
        await waitFor(() => expect(layoutOf("a")).toMatchObject({ x: 12, y: 0 }));
        await expect(layoutOf("b")).toMatchObject({ x: 12, y: 4 });
        await expect(layoutOf("c")).toMatchObject({ x: 0, y: 0 });
        const tiles = store()
          .getState()
          .spec.tiles.map((t) => ({ id: t.id, ...t.layout }));
        await expect(compact(tiles, EDIT_FLOW_SPEC.grid)).toEqual(tiles);
      },
    );
  },
};

export const Touch: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const sheet = await canvas.findByRole("region", { name: EDIT_FIT_SPEC.title });
    await waitFor(() => expect(sheet.querySelectorAll("[data-tile-id]").length).toBe(4));
    const p = pitch(sheet, EDIT_FIT_SPEC);
    const el = canvas.getByRole("button", { name: "Move Revenue" });
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    // The Storybook Chromium context has no `hasTouch` (so no `Touch` constructor): dispatch
    // touch-typed events carrying `touches` and viewport coordinates, which is what the
    // TouchSensor reads.
    const fire = (type: string, target: EventTarget, cx: number, cy: number) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      const point = { identifier: 1, target, clientX: cx, clientY: cy };
      Object.defineProperties(event, {
        touches: { value: type === "touchend" ? [] : [point] },
        changedTouches: { value: [point] },
        clientX: { value: cx },
        clientY: { value: cy },
      });
      target.dispatchEvent(event);
    };
    fire("touchstart", el, x, y);
    // Long-press: the TouchSensor lifts after 150 ms.
    await sleep(250);
    for (let i = 1; i <= 6; i++) {
      fire("touchmove", el, x + (8 * p.width * i) / 6, y);
      await sleep(16);
    }
    fire("touchend", el, x + 8 * p.width, y);
    await waitFor(() => expect(layoutOf("chart-1")).toMatchObject({ x: 8, y: 0 }));
  },
};

export const ReducedMotion: Story = {
  globals: { motionPref: "reduced" },
  play: async ({ canvasElement }) => {
    const sheet = await within(canvasElement).findByRole("region", { name: EDIT_FIT_SPEC.title });
    await waitFor(() => expect(sheet.querySelectorAll("[data-tile-id]").length).toBe(4));
    const tile = sheet.querySelector<HTMLElement>('[data-tile-id="chart-1"]')!;
    await waitFor(() => {
      const durations = getComputedStyle(tile)
        .transitionDuration.split(",")
        .map((d) => parseFloat(d) * (d.trim().endsWith("ms") ? 1 : 1000));
      // `--motion-factor` collapses every transition to (effectively) zero: the ghost snaps.
      expect(Math.max(...durations)).toBeLessThanOrEqual(1);
    });
  },
};

/** A real pointer drag between two absolute points in `sheet`'s own coordinate space — the
 * marquee's own drag, as opposed to `pointerDrag`'s drag-a-tile-by-an-offset. */
async function dragRect(
  sheet: HTMLElement,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const box = sheet.getBoundingClientRect();
  const init = { bubbles: true, cancelable: true, isPrimary: true, button: 0, pointerId: 2 };
  sheet.dispatchEvent(
    new PointerEvent("pointerdown", {
      ...init,
      pointerType: "mouse",
      clientX: box.left + from.x,
      clientY: box.top + from.y,
    }),
  );
  const steps = 6;
  for (let i = 1; i <= steps; i++) {
    await sleep(16);
    document.dispatchEvent(
      new PointerEvent("pointermove", {
        ...init,
        pointerType: "mouse",
        clientX: box.left + from.x + ((to.x - from.x) * i) / steps,
        clientY: box.top + from.y + ((to.y - from.y) * i) / steps,
      }),
    );
  }
  await sleep(16);
  document.dispatchEvent(
    new PointerEvent("pointerup", {
      ...init,
      pointerType: "mouse",
      clientX: box.left + to.x,
      clientY: box.top + to.y,
    }),
  );
  await sleep(16);
}

export const TileOperations: Story = {
  name: "Tile operations (RM-081)",
  render: () => <TileOpsSheet spec={EDIT_FIT_SPEC} />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const sheet = await canvas.findByRole("region", { name: EDIT_FIT_SPEC.title });
    await waitFor(() => expect(sheet.querySelectorAll("[data-tile-id]").length).toBe(4));
    const p = pitch(sheet, EDIT_FIT_SPEC);
    // Scoped to chart-1's own tile root: Copy/Paste below adds a SECOND tile also titled
    // "Revenue" (a copy), so a plain `getByRole(..., { name: "Move Revenue" })` off the whole
    // canvas would stop resolving to one element.
    const moveChart1 = () =>
      within(sheet.querySelector<HTMLElement>('[data-tile-id="chart-1"]')!).getByRole("button", {
        name: "Move Revenue",
      });
    // The shortcuts listener is scoped to its container ref (never `window`-global); keep
    // focus somewhere inside it so the keydowns below actually bubble to the listener.
    moveChart1().focus();

    await step("Mod+A selects every top-level tile", async () => {
      await userEvent.keyboard("{Meta>}a{/Meta}");
      await waitFor(() => expect(store().getState().focus).toHaveLength(4));
    });

    await step(
      "Escape clears focus; a marquee drag over the left column selects chart-1 + text-1",
      async () => {
        await userEvent.keyboard("{Escape}");
        await waitFor(() => expect(store().getState().focus).toEqual([]));
        // The 6–16 column gap between chart-1/text-1 (x0–12) and chart-2/chart-3 (x16–24)
        // is empty at every row — a safe place to start the drag (never on a tile).
        await dragRect(
          sheet,
          { x: 10 * p.width, y: 11 * p.height },
          { x: 0.5 * p.width, y: 0.5 * p.height },
        );
        await waitFor(() =>
          expect(store().getState().focus).toEqual(expect.arrayContaining(["chart-1", "text-1"])),
        );
        expect(store().getState().focus).toHaveLength(2);
      },
    );

    await step(
      "Mod+C copies the 2 focused tiles; Mod+V pastes them as ONE new history entry",
      async () => {
        const before = store().getState().spec.tiles.length;
        const past = store().getState().history.past;
        await userEvent.keyboard("{Meta>}c{/Meta}");
        await userEvent.keyboard("{Escape}");
        await userEvent.keyboard("{Meta>}v{/Meta}");
        await waitFor(() => expect(store().getState().spec.tiles).toHaveLength(before + 2));
        expect(store().getState().history.past).toBe(past + 1);
      },
    );

    await step("Delete offers Undo via a toast; Undo restores the tile", async () => {
      store().getState().actions.setFocus(["chart-2"]);
      moveChart1().focus();
      await userEvent.keyboard("{Delete}");
      await waitFor(() =>
        expect(
          store()
            .getState()
            .spec.tiles.find((t) => t.id === "chart-2"),
        ).toBeUndefined(),
      );
      const undoButton = await canvas.findByRole("button", { name: "Undo" });
      await userEvent.click(undoButton);
      await waitFor(() =>
        expect(
          store()
            .getState()
            .spec.tiles.find((t) => t.id === "chart-2"),
        ).toBeDefined(),
      );
    });

    await step(
      "Bring forward (via the tile's context menu) raises chart-1 above chart-2",
      async () => {
        const before = layoutOf("chart-1").z ?? 0;
        const trigger = canvas.getByTestId("chart-1-menu-trigger");
        // A real right-click sequence (Radix's `ContextMenuTrigger` listens for the native
        // `contextmenu` event a browser fires from it) — matches the recipe Shift+F10 itself
        // uses in `useDashboardShortcuts`.
        await userEvent.pointer({ keys: "[MouseRight]", target: trigger });
        // `ContextMenuContent` portals to `document.body`, outside `canvasElement`.
        const body = within(canvasElement.ownerDocument.body);
        const bringForward = await body.findByRole("menuitem", { name: "Bring forward" });
        await userEvent.click(bringForward);
        await waitFor(() => expect(layoutOf("chart-1").z ?? 0).toBeGreaterThan(before));
        const otherZ = layoutOf("chart-2").z ?? layoutOf("chart-3").z ?? 0;
        expect((layoutOf("chart-1").z ?? 0) > otherZ).toBe(true);
      },
    );
  },
};
