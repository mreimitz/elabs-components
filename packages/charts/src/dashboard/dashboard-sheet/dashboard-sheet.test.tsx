import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import minimal from "../core/__fixtures__/minimal.json";
import salesOverview from "../core/__fixtures__/sales-overview.json";
import { cellRect } from "../core/layout";
import type { DashboardSpec } from "../core/spec";
import type { DashboardActions } from "../core/store";
import {
  DashboardProvider,
  DashboardSheet,
  createPlaceholderTileKind,
  tileDensity,
  useDashboard,
  useDashboardActions,
  type DashboardChangeMeta,
} from "./index";

vi.mock("react-use-measure", () => ({
  default: () => [
    () => {},
    { width: 1200, height: 600, top: 0, left: 0, right: 1200, bottom: 600, x: 0, y: 0 },
  ],
}));

const SALES = salesOverview as unknown as DashboardSpec;
const TILES = ["kpi", "chart", "text"].map((kind) => createPlaceholderTileKind(kind));

let actions: DashboardActions;
function Probe() {
  actions = useDashboardActions();
  return null;
}

function renderSheet(spec: DashboardSpec = SALES, sheetProps = {}) {
  return render(
    <DashboardProvider spec={spec} tiles={TILES}>
      <Probe />
      <DashboardSheet {...sheetProps} />
    </DashboardProvider>,
  );
}

const tileEls = () => Array.from(document.querySelectorAll<HTMLElement>("[data-tile-id]"));

describe("DashboardSheet", () => {
  it("positions one tile per visible tile at its cellRect", () => {
    renderSheet();
    const grid = SALES.grid;
    const cell = (1200 - 23 * 8) / 24;
    const container = { width: 1200, height: 12 * cell + 11 * 8 };
    const visible = SALES.tiles.filter((t) => !t.visibleWhen);
    expect(tileEls().map((el) => el.dataset.tileId)).toEqual(visible.map((t) => t.id));
    for (const tile of visible) {
      const el = document.querySelector<HTMLElement>(`[data-tile-id="${tile.id}"]`)!;
      const rect = cellRect(tile.layout, grid, container);
      expect(parseFloat(el.style.width)).toBeCloseTo(rect.width, 0);
      expect(parseFloat(el.style.height)).toBeCloseTo(rect.height, 0);
      expect(el.style.transform).toBe(`translate(${rect.x}px, ${rect.y}px)`);
      expect(el.dataset.tileKind).toBe(tile.kind);
    }
    expect(screen.getByRole("region", { name: SALES.title })).toBeInTheDocument();
  });

  it("fills a definite host height in fit mode (row height = host height ÷ rows)", () => {
    const original = HTMLElement.prototype.getBoundingClientRect;
    const spy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        if (this.dataset.slot === "dashboard-sheet") return new DOMRect(0, 0, 1200, 600);
        return original.call(this);
      });
    try {
      renderSheet();
      const sheet = screen.getByRole("region", { name: SALES.title });
      expect(sheet).toHaveAttribute("data-fill", "host");
      expect(sheet.style.height).toBe("");
      const tile = SALES.tiles.find((t) => !t.visibleWhen)!;
      const el = document.querySelector<HTMLElement>(`[data-tile-id="${tile.id}"]`)!;
      const rect = cellRect(tile.layout, SALES.grid, { width: 1200, height: 600 });
      expect(parseFloat(el.style.height)).toBeCloseTo(rect.height, 0);
    } finally {
      spy.mockRestore();
    }
  });

  it("falls back to square cells when the host has no definite height", () => {
    renderSheet();
    const sheet = screen.getByRole("region", { name: SALES.title });
    expect(sheet).toHaveAttribute("data-fill", "square");
    expect(sheet.querySelector("[data-slot=dashboard-sheet-spacer]")).not.toBeNull();
  });

  it("toggles a visibleWhen tile through setVariable", () => {
    renderSheet();
    const note = () => document.querySelector('[data-tile-id="detail-note"]');
    expect(note()).toBeNull();
    act(() => actions.select("Region", ["EMEA"]));
    expect(note()).not.toBeNull();
    act(() => actions.setVariable("showDetail", false));
    expect(note()).toBeNull();
    act(() => actions.setVariable("showDetail", true));
    expect(note()).not.toBeNull();
  });

  it("moves focus between tiles with a single tab stop", async () => {
    const user = userEvent.setup();
    renderSheet();
    const tiles = tileEls();
    await user.tab();
    expect(tiles[0]).toHaveFocus();
    expect(tiles.filter((t) => t.tabIndex === 0)).toHaveLength(1);
    await user.keyboard("{ArrowRight}");
    expect(tiles[1]).toHaveFocus();
    await user.keyboard("{End}");
    expect(tiles.at(-1)).toHaveFocus();
    await user.keyboard("{Home}");
    expect(tiles[0]).toHaveFocus();
  });

  it("opens the expand dialog with Enter and returns focus to the tile on Escape", async () => {
    const user = userEvent.setup();
    renderSheet();
    const tile = tileEls()[4]!;
    const expand = within(tile).getByRole("button", { name: "Full screen" });
    expand.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(tile).toHaveFocus());
  });

  it("does not re-render hover subscribers when a tile moves", () => {
    let renders = 0;
    function HoverReader() {
      useDashboard((s) => s.hover);
      renders++;
      return null;
    }
    render(
      <DashboardProvider spec={minimal as unknown as DashboardSpec} tiles={TILES}>
        <Probe />
        <HoverReader />
      </DashboardProvider>,
    );
    const before = renders;
    act(() => {
      expect(actions.moveTile("revenue", { x: 12, y: 6 })).toBe(true);
    });
    expect(renders).toBe(before);
    act(() => actions.setHover({ field: "Region", value: "EMEA", tileId: "revenue" }));
    expect(renders).toBe(before + 1);
  });

  it("renders an unknown kind as a StatePanel naming the kind", () => {
    render(
      <DashboardProvider spec={SALES} tiles={[]}>
        <DashboardSheet />
      </DashboardProvider>,
    );
    expect(screen.getAllByText("No renderer for “kpi”")).toHaveLength(4);
  });
});

describe("lazy render", () => {
  const observed: Element[] = [];
  beforeEach(() => {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe(el: Element) {
          observed.push(el);
        }
        unobserve() {}
        disconnect() {}
      },
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    observed.length = 0;
  });

  it("mounts no body until a tile intersects; renderAll mounts every body", () => {
    const { unmount } = renderSheet();
    expect(tileEls().length).toBe(8);
    expect(document.querySelectorAll("[data-tile-body-mounted]")).toHaveLength(0);
    expect(observed.length).toBe(8);
    unmount();
    renderSheet(SALES, { renderAll: true });
    expect(document.querySelectorAll("[data-tile-body-mounted]")).toHaveLength(8);
  });
});

describe("DashboardProvider re-sync", () => {
  const retitled = { ...SALES, title: "APAC recovered in Q4" };

  it("replaces a clean store's spec when the prop changes", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <DashboardProvider spec={SALES} tiles={TILES} onChange={onChange}>
        <DashboardSheet />
      </DashboardProvider>,
    );
    rerender(
      <DashboardProvider spec={retitled} tiles={TILES} onChange={onChange}>
        <DashboardSheet />
      </DashboardProvider>,
    );
    expect(screen.getByRole("region", { name: retitled.title })).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps a dirty store's edits and reports the conflict", () => {
    const onChange = vi.fn<(spec: DashboardSpec, meta: DashboardChangeMeta) => void>();
    const { rerender } = render(
      <DashboardProvider spec={SALES} tiles={TILES} onChange={onChange}>
        <Probe />
        <DashboardSheet />
      </DashboardProvider>,
    );
    act(() => actions.patchTile("kpi-revenue", { title: "Edited" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.anything(), { conflict: false });
    rerender(
      <DashboardProvider spec={retitled} tiles={TILES} onChange={onChange}>
        <Probe />
        <DashboardSheet />
      </DashboardProvider>,
    );
    expect(screen.getByRole("region", { name: SALES.title })).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith(expect.anything(), {
      conflict: true,
      incoming: retitled,
    });
  });
});

describe("tileDensity", () => {
  it("uses the pixel thresholds", () => {
    expect(tileDensity(199, 300)).toBe("xs");
    expect(tileDensity(300, 150)).toBe("sm");
    expect(tileDensity(799, 500)).toBe("md");
    expect(tileDensity(800, 400)).toBe("lg");
  });
});
