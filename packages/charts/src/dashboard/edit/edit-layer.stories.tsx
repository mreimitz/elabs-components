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
import { EDIT_FIT_SPEC, EDIT_FLOW_SPEC } from "./edit-specs";

declare global {
  interface Window {
    /** Installed by the edit-layer stories so plays (and validators) read the real store. */
    __dashboardStore?: DashboardStore;
  }
}

// "metric" is registered only for the paste-and-replace play below (`PASTE_REPLACE_SPEC`).
const TILES = ["chart", "text", "metric"].map((kind) => createPlaceholderTileKind(kind));

/**
 * A diagonal-staggered 3-tile layout (same geometry as `core/store.test.ts`'s `tileOpsSpec`,
 * minus its 4th tile) — one row per tile, distinct x, so aligning/grouping them never collides.
 * Local to this file: `edit-specs.ts` is outside this RM's write-set.
 */
const ALIGN_SPEC: DashboardSpec = {
  ...EDIT_FIT_SPEC,
  id: "edit-align",
  tiles: [
    {
      id: "chart-1",
      kind: "chart",
      title: "Revenue",
      layout: { x: 0, y: 0, w: 6, h: 4 },
      content: {},
    },
    {
      id: "chart-2",
      kind: "chart",
      title: "Orders",
      layout: { x: 10, y: 4, w: 6, h: 4 },
      content: {},
    },
    {
      id: "chart-3",
      kind: "chart",
      title: "Margin",
      layout: { x: 14, y: 8, w: 6, h: 4 },
      content: {},
    },
  ],
};

/**
 * Two overlapping `fit`-mode tiles (RM-081 follow-up 2, F1): chart-1 covers cells (0,0)–(8,8),
 * chart-2 (4,4)–(12,12) — an 4×4-cell overlap the Bring forward/Send backward play below reads
 * paint order from.
 */
const Z_ORDER_SPEC: DashboardSpec = {
  ...EDIT_FIT_SPEC,
  id: "edit-z-order",
  tiles: [
    {
      id: "chart-1",
      kind: "chart",
      title: "Revenue",
      layout: { x: 0, y: 0, w: 8, h: 8 },
      content: {},
    },
    {
      id: "chart-2",
      kind: "chart",
      title: "Orders",
      layout: { x: 4, y: 4, w: 8, h: 8 },
      content: {},
    },
  ],
};

/**
 * chart-1 (kind `chart`) + metric-1 (kind `metric`, RM-081 follow-up 2, F2) — drives the
 * "Paste and replace" acceptance bullet through the real context menu, not just the jsdom
 * unit test `tile-context-menu.test.tsx` already covers.
 */
const PASTE_REPLACE_SPEC: DashboardSpec = {
  ...EDIT_FIT_SPEC,
  id: "edit-paste-replace",
  tiles: [
    {
      id: "chart-1",
      kind: "chart",
      title: "Revenue",
      layout: { x: 0, y: 0, w: 6, h: 4 },
      content: { note: "chart-1-content" },
    },
    {
      id: "metric-1",
      kind: "metric",
      title: "Active users",
      layout: { x: 10, y: 0, w: 4, h: 3 },
      content: { note: "metric-1-content" },
    },
  ],
};

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
 * RM-081's tile operations, driven end to end through the BUILT-IN surface only: the tile
 * context menu (right-click, header kebab, Shift+F10), the empty-area marquee, shift-click and
 * Mod+A/Escape are wired into `DashboardSheet`/`DashboardEditLayer`/`DashboardTile` themselves
 * (RM-081 follow-up 1) — this story composes nothing beyond `useDashboardShortcuts`, whose ref
 * must wrap the toolbar + sheet subtree the keyboard listener scopes to (its own long-standing
 * contract, unrelated to the marquee/menu wiring).
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
  return (
    <div ref={containerRef}>
      <Toaster />
      <div data-testid="host" className="relative h-[480px] max-h-[80vh] w-full">
        <DashboardSheet renderAll />
      </div>
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

/** Radix menus hide background content (`aria-hidden`) while open and only restore it once the
 * close animation's unmount finishes — wait for that so a later step/the a11y scan never sees a
 * stale `aria-hidden` on a live tile. */
const waitForMenuClosed = async (body: ReturnType<typeof within>) => {
  await waitFor(() => expect(body.queryByRole("menu")).toBeNull());
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

    await step(
      "In flow mode, the tile's context menu offers no Bring forward / Send backward (fit-mode only)",
      async () => {
        const tile = sheet.querySelector<HTMLElement>('[data-tile-id="a"]')!;
        await userEvent.pointer({ keys: "[MouseRight]", target: tile });
        const body = within(canvasElement.ownerDocument.body);
        await body.findByRole("menuitem", { name: "Duplicate" });
        expect(body.queryByRole("menuitem", { name: "Bring forward" })).toBeNull();
        expect(body.queryByRole("menuitem", { name: "Send backward" })).toBeNull();
        await userEvent.keyboard("{Escape}");
        await waitForMenuClosed(body);
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
      "Bring forward / Send backward (via the tile's own context menu, built into DashboardTile) " +
        "reorders an overlapping fit-mode pair's PAINT order — never their DOM order",
      async () => {
        await reset(Z_ORDER_SPEC);
        const p2 = pitch(sheet, Z_ORDER_SPEC);
        const box = sheet.getBoundingClientRect();
        // A point inside the overlap (cells 4–8 on both axes): the centre of cell (6, 6).
        const overlapPoint = { x: box.left + 6.5 * p2.width, y: box.top + 6.5 * p2.height };
        const bodyDoc = canvasElement.ownerDocument;
        const tileA = sheet.querySelector<HTMLElement>('[data-tile-id="chart-1"]')!;
        const tileB = sheet.querySelector<HTMLElement>('[data-tile-id="chart-2"]')!;
        const domOrder = () =>
          Array.from(sheet.querySelectorAll<HTMLElement>("[data-tile-id]")).map(
            (el) => el.dataset.tileId,
          );
        const topTileAt = (point: { x: number; y: number }) =>
          bodyDoc.elementFromPoint(point.x, point.y)?.closest("[data-tile-id]");

        // A real right-click sequence (Radix's `ContextMenuTrigger` listens for the native
        // `contextmenu` event a browser fires from it) — matches the recipe Shift+F10 itself
        // uses in `useDashboardShortcuts`. `DashboardTile` wraps itself in
        // `DashboardTileContextMenu` in edit mode (RM-081 follow-up 1) — no host composition.
        const chooseMenuItem = async (trigger: HTMLElement, name: string) => {
          await userEvent.pointer({ keys: "[MouseRight]", target: trigger });
          // `ContextMenuContent` portals to `document.body`, outside `canvasElement`.
          const body = within(bodyDoc.body);
          await userEvent.click(await body.findByRole("menuitem", { name }));
          await waitForMenuClosed(body);
          // Radix returns focus to the trigger (the tile root) on close, which — via
          // `DashboardTile`'s own `onFocus` handler — makes it the sole multi-select focus.
          // A focused tile is deliberately RAISED above `TILE_CHROME_Z`'s ordinary band (so its
          // own resize handles can never be covered), which would otherwise mask the very z-order
          // change this play asserts. Clear it the same way "Escape clears focus" does elsewhere
          // in this file, so what remains is exactly `layout.z`'s own paint order.
          store().getState().actions.setFocus([]);
        };

        expect(domOrder()).toEqual(["chart-1", "chart-2"]);

        const pastBeforeForward = store().getState().history.past;
        await chooseMenuItem(tileA, "Bring forward");
        await waitFor(() =>
          expect(Number(getComputedStyle(tileB).zIndex))
            // z-order — RM-081 follow-up 2 (F1): a REAL computed-style/paint-order check, not a
            // readback of the store field `bringForward` itself just wrote.
            .toBeLessThan(Number(getComputedStyle(tileA).zIndex)),
        );
        expect(domOrder()).toEqual(["chart-1", "chart-2"]); // reading order never reorders
        expect(topTileAt(overlapPoint)).toBe(tileA);
        expect(store().getState().history.past).toBe(pastBeforeForward + 1);

        const pastBeforeBackward = store().getState().history.past;
        await chooseMenuItem(tileA, "Send backward");
        await waitFor(() =>
          expect(Number(getComputedStyle(tileA).zIndex)).toBeLessThan(
            Number(getComputedStyle(tileB).zIndex),
          ),
        );
        expect(domOrder()).toEqual(["chart-1", "chart-2"]);
        expect(topTileAt(overlapPoint)).toBe(tileB);
        expect(store().getState().history.past).toBe(pastBeforeBackward + 1);
      },
    );

    await step(
      "The header kebab's “Tile actions…” entry opens the SAME context menu (Shift+F10 recipe)",
      async () => {
        const tile = sheet.querySelector<HTMLElement>('[data-tile-id="chart-1"]')!;
        const kebab = within(tile).getByRole("button", { name: "More actions" });
        await userEvent.click(kebab);
        const body = within(canvasElement.ownerDocument.body);
        const openTileMenu = await body.findByRole("menuitem", { name: "Tile actions…" });
        await userEvent.click(openTileMenu);
        const duplicate = await body.findByRole("menuitem", { name: "Duplicate" });
        expect(duplicate).toBeInTheDocument();
        await userEvent.keyboard("{Escape}");
        await waitForMenuClosed(body);
      },
    );

    await step(
      "A marquee-selected group drags together as ONE history entry (built-in, no host wiring)",
      async () => {
        await reset(ALIGN_SPEC);
        const past = store().getState().history.past;
        // Drag from an empty cell (col 20, row 0) down-left: intersects chart-1 (rows 0–4) and
        // chart-2 (rows 4–8), not chart-3 (rows 8–12).
        await dragRect(sheet, { x: 20 * p.width, y: 0 }, { x: 0, y: 8 * p.height });
        await waitFor(() =>
          expect(store().getState().focus).toEqual(expect.arrayContaining(["chart-1", "chart-2"])),
        );
        expect(store().getState().focus).toHaveLength(2);
        const moveChart1Grouped = within(
          sheet.querySelector<HTMLElement>('[data-tile-id="chart-1"]')!,
        ).getByRole("button", { name: "Move Revenue" });
        await pointerDrag(moveChart1Grouped, 4 * p.width, 0);
        await waitFor(() => expect(layoutOf("chart-1")).toMatchObject({ x: 4, y: 0 }));
        expect(layoutOf("chart-2")).toMatchObject({ x: 14, y: 4 });
        expect(layoutOf("chart-3")).toMatchObject({ x: 14, y: 8 });
        expect(store().getState().history.past).toBe(past + 1);
      },
    );

    await step(
      "Marquee-selecting 3 tiles shows a floating align toolbar; its real button aligns them",
      async () => {
        await reset(ALIGN_SPEC);
        const past = store().getState().history.past;
        await dragRect(sheet, { x: 20 * p.width, y: 0 }, { x: 0, y: 12 * p.height });
        await waitFor(() => expect(store().getState().focus).toHaveLength(3));
        const alignLeft = await canvas.findByRole("button", { name: "Align left edges" });
        await userEvent.click(alignLeft);
        await waitFor(() => expect(layoutOf("chart-1")).toMatchObject({ x: 0 }));
        expect(layoutOf("chart-2")).toMatchObject({ x: 0 });
        expect(layoutOf("chart-3")).toMatchObject({ x: 0 });
        expect(store().getState().history.past).toBe(past + 1);
      },
    );

    await step(
      // RM-081 follow-up 2 (F2): the acceptance text's own "Paste and replace" sub-bullet,
      // as a real driven-browser play — the prior jsdom-only coverage (tile-context-menu.test.tsx)
      // stays, but this is the literal play the Acceptance text names.
      "Copy chart-1, then “Paste and replace” on metric-1 swaps its kind/content and keeps its own layout",
      async () => {
        await reset(PASTE_REPLACE_SPEC);
        const past = store().getState().history.past;
        const body = within(canvasElement.ownerDocument.body);

        const chart1 = sheet.querySelector<HTMLElement>('[data-tile-id="chart-1"]')!;
        await userEvent.pointer({ keys: "[MouseRight]", target: chart1 });
        await userEvent.click(await body.findByRole("menuitem", { name: "Copy" }));
        await waitForMenuClosed(body);

        const metric1LayoutBefore = { ...layoutOf("metric-1") };
        const metric1 = sheet.querySelector<HTMLElement>('[data-tile-id="metric-1"]')!;
        await userEvent.pointer({ keys: "[MouseRight]", target: metric1 });
        await userEvent.click(await body.findByRole("menuitem", { name: "Paste and replace" }));
        await waitForMenuClosed(body);

        await waitFor(() =>
          expect(
            store()
              .getState()
              .spec.tiles.find((t) => t.id === "metric-1"),
          ).toMatchObject({ id: "metric-1", kind: "chart", content: { note: "chart-1-content" } }),
        );
        expect(layoutOf("metric-1")).toMatchObject(metric1LayoutBefore);
        expect(store().getState().history.past).toBe(past + 1);
      },
    );
  },
};
