import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import type { DashboardSpec } from "../core/spec";
import type { DashboardStore } from "../core/store";
import { DashboardProvider, DashboardSheet, createPlaceholderTileKind } from "../dashboard-sheet";
import { useDashboardContext } from "../dashboard-sheet/use-dashboard";
import { DashboardToolbar } from "./dashboard-toolbar";
import { useDashboardShortcuts } from "./use-dashboard-shortcuts";

declare global {
  interface Window {
    /** Installed by `StoreProbe` so the plays below can read/drive the real store. */
    __toolbarStore?: DashboardStore;
    /** Specs handed to `onSave`, in call order. */
    __toolbarSaved?: DashboardSpec[];
  }
}

const TILES = ["chart", "text"].map((kind) => createPlaceholderTileKind(kind));

const TOOLBAR_SPEC: DashboardSpec = {
  version: 1,
  id: "toolbar-demo",
  title: "Region mix",
  grid: { mode: "fit", columns: 24, rows: 12, gap: 8 },
  tiles: [
    {
      id: "chart-1",
      kind: "chart",
      title: "Revenue",
      layout: { x: 0, y: 0, w: 8, h: 4 },
      content: {},
    },
    { id: "text-1", kind: "text", title: "Notes", layout: { x: 8, y: 0, w: 8, h: 4 }, content: {} },
  ],
};

function StoreProbe() {
  const { store } = useDashboardContext();
  window.__toolbarStore = store;
  return null;
}

function Harness({ onSave, warnOnUnload }: { onSave?: boolean; warnOnUnload?: boolean }) {
  const handleSave = onSave
    ? (spec: DashboardSpec) => {
        window.__toolbarSaved = [...(window.__toolbarSaved ?? []), spec];
      }
    : undefined;
  return (
    <DashboardProvider spec={TOOLBAR_SPEC} tiles={TILES}>
      <div className="flex h-[420px] flex-col gap-3">
        <DashboardToolbar onSave={handleSave} warnOnUnload={warnOnUnload} />
        <div className="min-h-0 flex-1">
          <DashboardSheet />
        </div>
        <StoreProbe />
      </div>
    </DashboardProvider>
  );
}

function ShortcutsHarness() {
  return (
    <DashboardProvider spec={TOOLBAR_SPEC} tiles={TILES}>
      <ShortcutsHarnessBody />
    </DashboardProvider>
  );
}

function ShortcutsHarnessBody() {
  const containerRef = useDashboardShortcuts({
    onSave: () => {
      window.__toolbarSaved = [
        ...(window.__toolbarSaved ?? []),
        window.__toolbarStore!.getState().spec,
      ];
      window.__toolbarStore!.getState().actions.markSaved();
    },
  });
  return (
    <div ref={containerRef} className="flex h-[420px] flex-col gap-3">
      <DashboardToolbar
        onSave={(spec) => {
          window.__toolbarSaved = [...(window.__toolbarSaved ?? []), spec];
        }}
      />
      <div className="min-h-0 flex-1">
        <DashboardSheet />
      </div>
      <StoreProbe />
    </div>
  );
}

const meta = {
  title: "Dashboard/Chrome/Toolbar",
  component: DashboardToolbar,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof DashboardToolbar>;
export default meta;
type Story = StoryObj<typeof meta>;

const store = () => window.__toolbarStore as DashboardStore;

/**
 * Toggling Edit mounts the edit layer (resize handles on the focused tile); moving a tile
 * dirties the store and enables Undo, which restores the pre-move layout; Discard opens the
 * confirm and, on confirm, restores the mount snapshot; Save calls `onSave` with the current
 * spec and clears `dirty`.
 */
export const Default: Story = {
  render: () => {
    window.__toolbarSaved = [];
    return <Harness onSave />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toolbar = await canvas.findByRole("toolbar", { name: "Dashboard toolbar" });
    const undo = within(toolbar).getByRole("button", { name: "Undo" });
    const redo = within(toolbar).getByRole("button", { name: "Redo" });
    const save = within(toolbar).getByRole("button", { name: "Save" });
    const discard = within(toolbar).getByRole("button", { name: "Discard" });
    await expect(undo).toBeDisabled();
    await expect(save).toBeDisabled();
    await expect(discard).toBeDisabled();

    // Edit mounts the edit layer once a tile is focused.
    store().getState().actions.setFocus(["chart-1"]);
    await userEvent.click(within(toolbar).getByRole("radio", { name: "Edit" }));
    await waitFor(() => {
      const handles = canvasElement.querySelector('[data-slot="tile-resize-handles"]');
      expect(handles).not.toBeNull();
    });

    // A move dirties the store: Undo enables, restores on click.
    const before = structuredClone(store().getState().spec);
    store().getState().actions.moveTile("chart-1", { x: 2, y: 2 });
    await waitFor(() => expect(undo).not.toBeDisabled());
    await expect(save).not.toBeDisabled();
    await expect(discard).not.toBeDisabled();

    await userEvent.click(undo);
    await waitFor(() => expect(store().getState().spec).toEqual(before));
    await expect(redo).not.toBeDisabled();
    await expect(save).toBeDisabled();

    // Discard: dirty the store again, confirm, and the mount snapshot comes back.
    const mount = structuredClone(store().getState().spec);
    store().getState().actions.moveTile("chart-1", { x: 4, y: 4 });
    await userEvent.click(discard);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(await body.findByRole("button", { name: "Discard changes" }));
    await waitFor(() => expect(store().getState().spec).toEqual(mount));
    await waitFor(() => expect(store().getState().dirty).toBe(false));

    // Save calls onSave with the current spec and clears dirty.
    store().getState().actions.moveTile("chart-1", { x: 6, y: 0 });
    await waitFor(() => expect(save).not.toBeDisabled());
    const current = structuredClone(store().getState().spec);
    await userEvent.click(save);
    await waitFor(() => expect(window.__toolbarSaved?.at(-1)).toEqual(current));
    await waitFor(() => expect(store().getState().dirty).toBe(false));
  },
};

/** Without `onSave`, Save is hidden and leaving edit mode while dirty is never interrupted. */
export const WithoutSave: Story = {
  render: () => <Harness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toolbar = await canvas.findByRole("toolbar", { name: "Dashboard toolbar" });
    await expect(within(toolbar).queryByRole("button", { name: "Save" })).not.toBeInTheDocument();

    await userEvent.click(within(toolbar).getByRole("radio", { name: "Edit" }));
    store().getState().actions.moveTile("chart-1", { x: 2, y: 2 });
    await waitFor(() => expect(store().getState().dirty).toBe(true));

    await userEvent.click(within(toolbar).getByRole("radio", { name: "View" }));
    // No confirm dialog — the edits are simply kept.
    await expect(
      canvasElement.ownerDocument.body.querySelector('[data-slot="confirm-dialog"]'),
    ).toBeNull();
    await expect(store().getState().dirty).toBe(true);
    await expect(store().getState().mode).toBe("view");
  },
};

/**
 * The Grid popover: switching density `wide → medium` doubles every tile's `x, y, w, h`;
 * switching `fit → flow` keeps them and sets `rowHeight` 30; "Extend sheet" adds 6 rows to a
 * 12-row `fit` grid.
 */
export const GridSettings: Story = {
  render: () => <Harness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toolbar = await canvas.findByRole("toolbar", { name: "Dashboard toolbar" });
    const body = within(canvasElement.ownerDocument.body);

    store().getState().actions.setGrid({ density: "wide" }); // 24×12 (the demo spec's own size)
    const before = structuredClone(store().getState().spec.tiles[0]!.layout);

    async function chooseOption(comboboxName: string, optionName: string) {
      await userEvent.click(body.getByRole("combobox", { name: comboboxName }));
      await userEvent.click(await body.findByRole("option", { name: optionName }));
    }

    await userEvent.click(within(toolbar).getByRole("button", { name: "Grid" }));
    await chooseOption("Density", "Medium");
    await waitFor(() =>
      expect(store().getState().spec.grid).toMatchObject({ columns: 48, rows: 24 }),
    );
    const afterDensity = store().getState().spec.tiles[0]!.layout;
    await expect(afterDensity).toMatchObject({
      x: before.x * 2,
      y: before.y * 2,
      w: before.w * 2,
      h: before.h * 2,
    });

    const beforeFlow = structuredClone(store().getState().spec.tiles[0]!.layout);
    await chooseOption("Layout mode", "Flow");
    await waitFor(() =>
      expect(store().getState().spec.grid).toMatchObject({ mode: "flow", rowHeight: 30 }),
    );
    await expect(store().getState().spec.tiles[0]!.layout).toEqual(beforeFlow);

    // Back to fit + wide (12 rows) to test "Extend sheet".
    await chooseOption("Layout mode", "Fit to screen");
    await chooseOption("Density", "Wide");
    await waitFor(() => expect(store().getState().spec.grid).toMatchObject({ rows: 12 }));
    const extend = body.getByRole("checkbox", { name: "Extend sheet" });
    await userEvent.click(extend);
    await waitFor(() =>
      expect(store().getState().spec.grid).toMatchObject({ rows: 18, extendable: true }),
    );
  },
};

/**
 * `Mod+Z` after a move restores; `E` toggles edit; keys inside a text input are ignored; the
 * shortcuts sheet lists all seven.
 */
export const Shortcuts: Story = {
  render: () => <ShortcutsHarness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toolbar = await canvas.findByRole("toolbar", { name: "Dashboard toolbar" });
    const mod = navigator.platform.toLowerCase().includes("mac") ? "{Meta>}" : "{Control>}";
    const modUp = navigator.platform.toLowerCase().includes("mac") ? "{/Meta}" : "{/Control}";
    const viewToggle = within(toolbar).getByRole("radio", { name: "View" });
    await expect(viewToggle).toHaveAttribute("aria-checked", "true");

    // Focus lands inside the shortcuts' container (a descendant of the ref'd wrapper) so the
    // keydown listener, scoped to that subtree, actually sees the events below. `E` toggles
    // edit UNMODIFIED — `useDashboardShortcuts` only matches it under `!mod`.
    viewToggle.focus();
    await userEvent.keyboard("e");
    await waitFor(() => expect(store().getState().mode).toBe("edit"));

    const before = structuredClone(store().getState().spec);
    store().getState().actions.moveTile("chart-1", { x: 2, y: 2 });
    await waitFor(() => expect(store().getState().dirty).toBe(true));
    await userEvent.keyboard(`${mod}z${modUp}`);
    await waitFor(() => expect(store().getState().spec).toEqual(before));

    // Ignored inside a text input: typing "e" in the grid-settings' Gap field never toggles.
    await userEvent.click(within(toolbar).getByRole("button", { name: "Grid" }));
    const body = within(canvasElement.ownerDocument.body);
    const gapInput = await body.findByLabelText("Gap");
    await userEvent.click(gapInput);
    await userEvent.type(gapInput, "e");
    await expect(store().getState().mode).toBe("edit");
    // Close the popover via its own trigger (not Escape — Escape's job here was only to prove
    // the text-entry guard, above) so the next step starts from a clean toolbar.
    await userEvent.click(within(toolbar).getByRole("button", { name: "Grid" }));
    await waitFor(() => expect(body.queryByLabelText("Gap")).not.toBeInTheDocument());

    // The shortcuts sheet lists all seven.
    await userEvent.click(within(toolbar).getByRole("button", { name: "Keyboard shortcuts" }));
    const dialog = await body.findByRole("dialog", { name: "Keyboard shortcuts" });
    await waitFor(() => expect(within(dialog).getAllByRole("listitem")).toHaveLength(7));
  },
};
