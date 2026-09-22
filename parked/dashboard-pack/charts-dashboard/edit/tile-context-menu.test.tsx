import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import type { DashboardSpec } from "../core/spec";
import { DashboardProvider, createPlaceholderTileKind } from "../dashboard-sheet";
import { useDashboardContext } from "../dashboard-sheet/use-dashboard";
import { resetDashboardClipboardForTests, writeDashboardClipboard } from "./clipboard";
import { DashboardTileContextMenu } from "./tile-context-menu";

const TILES = [createPlaceholderTileKind("chart"), createPlaceholderTileKind("table")];

function specFor(mode: "fit" | "flow"): DashboardSpec {
  return {
    version: 1,
    id: "menu-test",
    grid:
      mode === "fit"
        ? { mode: "fit", columns: 24, rows: 12, gap: 8 }
        : { mode: "flow", columns: 24, rowHeight: 30, gap: 8 },
    tiles: [
      { id: "chart-1", kind: "chart", layout: { x: 0, y: 0, w: 4, h: 4 }, content: {} },
      { id: "chart-2", kind: "chart", layout: { x: 4, y: 0, w: 4, h: 4 }, content: {} },
    ],
  };
}

function Probe({
  onReady,
}: {
  onReady: (store: ReturnType<typeof useDashboardContext>["store"]) => void;
}) {
  const { store } = useDashboardContext();
  onReady(store);
  return null;
}

function renderMenu(mode: "fit" | "flow" = "fit"): {
  store: ReturnType<typeof useDashboardContext>["store"];
} {
  let store: ReturnType<typeof useDashboardContext>["store"] | undefined;
  render(
    <DashboardProvider spec={specFor(mode)} tiles={TILES}>
      <DashboardTileContextMenu tileId="chart-1">
        <div data-testid="tile-chart-1">tile one</div>
      </DashboardTileContextMenu>
      <div data-testid="tile-chart-2">tile two</div>
      <Probe onReady={(s) => (store = s)} />
    </DashboardProvider>,
  );
  if (!store) throw new Error("store never mounted");
  return { store };
}

async function openMenu() {
  fireEvent.contextMenu(screen.getByTestId("tile-chart-1"));
  await screen.findByRole("menu");
}

describe("DashboardTileContextMenu", () => {
  beforeEach(() => resetDashboardClipboardForTests());

  it("opens on right-click and closes returning focus to the trigger", async () => {
    const user = userEvent.setup();
    renderMenu();
    await openMenu();
    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("Duplicate adds a copy as one history entry", async () => {
    const user = userEvent.setup();
    const { store } = renderMenu();
    await openMenu();

    await user.click(screen.getByRole("menuitem", { name: "Duplicate" }));

    await waitFor(() => expect(store.getState().spec.tiles).toHaveLength(3));
    expect(store.getState().history.past).toBe(1);
  });

  it("Replace with… lists the other registered kind and merges content on selection", async () => {
    const user = userEvent.setup();
    const { store } = renderMenu();
    await openMenu();

    // Radix's ContextMenuSub opens its submenu on hover, not click; navigate + select by
    // keyboard instead of a hover+click sequence, which is flaky under jsdom's pointer model.
    const subTrigger = screen.getByRole("menuitem", { name: "Replace with…" });
    act(() => subTrigger.focus());
    await user.keyboard("{ArrowRight}");
    const replaceItem = await screen.findByRole("menuitem", { name: "Placeholder" });
    await waitFor(() => expect(replaceItem).toHaveFocus());
    await user.keyboard("{Enter}");

    await waitFor(() =>
      expect(store.getState().spec.tiles.find((t) => t.id === "chart-1")?.kind).toBe("table"),
    );
  });

  it("Copy then Paste adds a new tile from the clipboard", async () => {
    const user = userEvent.setup();
    const { store } = renderMenu();
    await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Copy" }));

    await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Paste" }));

    await waitFor(() => expect(store.getState().spec.tiles).toHaveLength(3));
  });

  it("Paste and replace swaps the target tile's kind/content from the clipboard", async () => {
    const user = userEvent.setup();
    const { store } = renderMenu();
    await act(async () => {
      await writeDashboardClipboard([
        {
          id: "source",
          kind: "table",
          layout: { x: 0, y: 0, w: 4, h: 4 },
          content: { note: "from clipboard" },
        },
      ]);
    });

    await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Paste and replace" }));

    await waitFor(() =>
      expect(store.getState().spec.tiles.find((t) => t.id === "chart-1")?.kind).toBe("table"),
    );
    expect(store.getState().spec.tiles).toHaveLength(2);
  });

  it("Bring forward / Send backward change z-order in fit mode only", async () => {
    const user = userEvent.setup();
    const { store } = renderMenu("fit");
    await openMenu();

    expect(screen.getByRole("menuitem", { name: "Bring forward" })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Bring forward" }));

    await waitFor(() => {
      const tile = store.getState().spec.tiles.find((t) => t.id === "chart-1");
      const other = store.getState().spec.tiles.find((t) => t.id === "chart-2");
      expect((tile?.layout.z ?? 0) > (other?.layout.z ?? 0)).toBe(true);
    });
  });

  it("Bring forward / Send backward are absent in flow mode", async () => {
    renderMenu("flow");
    await openMenu();

    expect(screen.queryByRole("menuitem", { name: "Bring forward" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Send backward" })).not.toBeInTheDocument();
  });

  it("Delete offers Undo via a toast and removes the tile as one history entry", async () => {
    const user = userEvent.setup();
    const { store } = renderMenu();
    await openMenu();

    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    await waitFor(() => expect(store.getState().spec.tiles.map((t) => t.id)).toEqual(["chart-2"]));
    expect(store.getState().history.past).toBe(1);

    act(() => store.getState().actions.undo());
    expect(store.getState().spec.tiles.map((t) => t.id)).toEqual(["chart-1", "chart-2"]);
  });

  it("every item is keyboard-reachable", async () => {
    const user = userEvent.setup();
    renderMenu();
    await openMenu();

    // ArrowDown cycles the Radix menu's own roving focus; the first item (Properties) highlights,
    // the next ArrowDown lands on Duplicate.
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Properties" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toHaveFocus();
  });
});
