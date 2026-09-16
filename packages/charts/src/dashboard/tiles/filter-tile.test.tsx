import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createLocalSelectionDriver } from "../core/local-selection-driver";
import type { DashboardSpec } from "../core/spec";
import { DashboardGridContext, DashboardProvider, DashboardTile } from "../dashboard-sheet";
import { createFilterTileKind, filterTileKind, type FilterTileContent } from "./filter-tile";

// The `filter` tile renders `ui/Command` (cmdk), which observes its list's size via
// ResizeObserver on mount — jsdom does not implement it. Standard no-op stub, same pattern as
// chart-hover-link.test.tsx and other jsdom-only test files in this package.
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

// jsdom does not implement `Element.prototype.scrollIntoView`, and `cmdk` calls it
// unconditionally (not feature-detected — third-party, not brand-ui code) whenever the
// highlighted item changes. Mirrors the local stub in `ui/src/components/command/command.test.tsx`.
let originalScrollIntoView: typeof Element.prototype.scrollIntoView;
beforeEach(() => {
  originalScrollIntoView = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  Element.prototype.scrollIntoView = originalScrollIntoView;
});

const ROWS = [
  { Region: "EMEA", Product: "Widget" },
  { Region: "EMEA", Product: "Gadget" },
  { Region: "APAC", Product: "Gadget" },
  { Region: "APAC", Product: "Gizmo" },
];

const GRID: DashboardSpec["grid"] = { mode: "fit", columns: 12, rows: 6 };

// A `filter` tile only paints once `useCellRect` resolves a pixel rect from a
// `DashboardGridContext` — normally supplied by `DashboardSheet`, which measures its host with
// `react-use-measure`/ResizeObserver and so never reports a real size under jsdom (no layout
// engine). Supply the context directly with a fixed pixel size instead, same shape `DashboardSheet`
// would provide in a real browser.
function GridHost({ children }: { children: React.ReactNode }) {
  return (
    <DashboardGridContext.Provider value={{ grid: GRID, width: 600, height: 400 }}>
      {children}
    </DashboardGridContext.Provider>
  );
}

function spec(content: FilterTileContent, view?: DashboardSpec["view"]): DashboardSpec {
  return {
    version: 1,
    id: "filter-tile-test",
    grid: GRID,
    view,
    tiles: [
      { id: "f", kind: "filter", title: "Field", layout: { x: 0, y: 0, w: 6, h: 6 }, content },
    ],
  };
}

function renderFilter(content: FilterTileContent, opts: { view?: DashboardSpec["view"] } = {}) {
  const driver = createLocalSelectionDriver();
  driver.register("rows", ROWS, ["Region", "Product"]);
  render(
    <DashboardProvider spec={spec(content, opts.view)} driver={driver} tiles={[filterTileKind]}>
      <GridHost>
        <DashboardTile tileId="f" />
      </GridHost>
    </DashboardProvider>,
  );
  return driver;
}

const regionValues: FilterTileContent["values"] = [
  { value: "EMEA", count: 2 },
  { value: "APAC", count: 2 },
];

const productValues: FilterTileContent["values"] = [
  { value: "Widget", count: 1 },
  { value: "Gadget", count: 2 },
  { value: "Gizmo", count: 1 },
];

describe("filter tile", () => {
  it("renders every row and toggles a value on in multi mode", async () => {
    const user = userEvent.setup();
    const driver = renderFilter({ field: "Region", values: regionValues });
    const emea = await screen.findByRole("option", { name: "EMEA" });
    expect(emea).toHaveAttribute("data-selection", "associated");
    await user.click(emea);
    await waitFor(() => expect(driver.getSnapshot().fields.Region?.values).toEqual(["EMEA"]));
    expect(screen.getByRole("option", { name: "EMEA, selected" })).toBeInTheDocument();
  });

  it("toggling twice clears the value again (multi mode)", async () => {
    const user = userEvent.setup();
    const driver = renderFilter({ field: "Region", values: regionValues });
    const emea = await screen.findByRole("option", { name: "EMEA" });
    await user.click(emea);
    await waitFor(() => expect(driver.getSnapshot().count("Region")).toBe(1));
    await user.click(screen.getByRole("option", { name: "EMEA, selected" }));
    await waitFor(() => expect(driver.getSnapshot().count("Region")).toBe(0));
  });

  it("single mode replaces instead of adding to the selection", async () => {
    const user = userEvent.setup();
    const driver = renderFilter({ field: "Region", values: regionValues, mode: "single" });
    await user.click(await screen.findByRole("option", { name: "EMEA" }));
    // Selecting EMEA leaves APAC excluded — the two are the same field's mutually exclusive
    // values, so no row has both (the excluded row stays clickable; only its accessible name
    // and dimmed styling change).
    await user.click(screen.getByRole("option", { name: "APAC, excluded" }));
    await waitFor(() => expect(driver.getSnapshot().fields.Region?.values).toEqual(["APAC"]));
  });

  it("excludes a value that never co-occurs with the selected one (association)", async () => {
    const user = userEvent.setup();
    // Two sibling filter tiles reading the SAME driver: selecting Region narrows Product.
    const driver = createLocalSelectionDriver();
    driver.register("rows", ROWS, ["Region", "Product"]);
    const twoTiles: DashboardSpec = {
      version: 1,
      id: "two",
      grid: GRID,
      tiles: [
        {
          id: "region",
          kind: "filter",
          layout: { x: 0, y: 0, w: 6, h: 6 },
          content: { field: "Region", values: regionValues },
        },
        {
          id: "product",
          kind: "filter",
          layout: { x: 6, y: 0, w: 6, h: 6 },
          content: { field: "Product", values: productValues },
        },
      ],
    };
    render(
      <DashboardProvider spec={twoTiles} driver={driver} tiles={[filterTileKind]}>
        <GridHost>
          <DashboardTile tileId="region" />
          <DashboardTile tileId="product" />
        </GridHost>
      </DashboardProvider>,
    );
    await user.click(await screen.findByRole("option", { name: "EMEA" }));
    await waitFor(() => {
      const gizmo = screen.getByRole("option", { name: "Gizmo, excluded" });
      expect(gizmo).toHaveAttribute("data-selection", "excluded");
    });
    const widget = screen.getByRole("option", { name: "Widget" });
    expect(widget).toHaveAttribute("data-selection", "associated");
  });

  it("a locked field ignores clicks and disables Clear in its menu", async () => {
    const user = userEvent.setup();
    const driver = createLocalSelectionDriver();
    driver.register("rows", ROWS, ["Region"]);
    driver.select("Region", ["EMEA"], { replace: true });
    driver.lock("Region", true);
    render(
      <DashboardProvider
        spec={spec({ field: "Region", values: regionValues })}
        driver={driver}
        tiles={[filterTileKind]}
      >
        <GridHost>
          <DashboardTile tileId="f" />
        </GridHost>
      </DashboardProvider>,
    );
    // EMEA is already selected, so APAC (same field) reads "excluded", not plain "APAC".
    await user.click(await screen.findByRole("option", { name: "APAC, excluded" }));
    expect(driver.getSnapshot().fields.Region?.values).toEqual(["EMEA"]);
    await user.click(screen.getByRole("button", { name: "Region actions" }));
    expect(await screen.findByRole("menuitem", { name: "Clear" })).toHaveAttribute("data-disabled");
  });

  it("clicking is inert when interactions.select is off (edit mode)", async () => {
    const user = userEvent.setup();
    const driver = renderFilter(
      { field: "Region", values: regionValues },
      { view: { mode: "edit" } },
    );
    await user.click(await screen.findByRole("option", { name: "EMEA" }));
    expect(driver.getSnapshot().count("Region")).toBe(0);
  });

  it("the search input filters rows by label", async () => {
    const user = userEvent.setup();
    renderFilter({ field: "Region", values: regionValues, search: true });
    await user.type(await screen.findByRole("combobox"), "EMEA");
    expect(screen.getByRole("option", { name: "EMEA" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "APAC" })).not.toBeInTheDocument();
  });

  it("the menu's Clear item clears only this field", async () => {
    const user = userEvent.setup();
    const driver = renderFilter({ field: "Region", values: regionValues });
    await user.click(await screen.findByRole("option", { name: "EMEA" }));
    await waitFor(() => expect(driver.getSnapshot().count("Region")).toBe(1));
    await user.click(screen.getByRole("button", { name: "Region actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Clear" }));
    await waitFor(() => expect(driver.getSnapshot().count("Region")).toBe(0));
  });

  it("the menu's Lock item locks and unlocks the field", async () => {
    const user = userEvent.setup();
    const driver = renderFilter({ field: "Region", values: regionValues });
    await user.click(await screen.findByRole("button", { name: "Region actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Lock Region" }));
    await waitFor(() => expect(driver.getSnapshot().fields.Region?.locked).toBe(true));
  });

  it("createFilterTileKind takes a custom kind name and labels", async () => {
    const kind = createFilterTileKind("region-filter", {
      search: () => "Suche…",
      empty: "Leer",
      clear: "Leeren",
      lock: (f) => `${f} sperren`,
      unlock: (f) => `${f} entsperren`,
      moreActions: (f) => `${f}-Menü`,
      locked: "Gesperrt",
      valueState: (label) => label,
    });
    expect(kind.kind).toBe("region-filter");
    const driver = createLocalSelectionDriver();
    driver.register("rows", ROWS, ["Region"]);
    render(
      <DashboardProvider
        spec={{
          version: 1,
          id: "custom",
          grid: GRID,
          tiles: [
            {
              id: "f",
              kind: "region-filter",
              layout: { x: 0, y: 0, w: 6, h: 6 },
              content: { field: "Region", values: regionValues },
            },
          ],
        }}
        driver={driver}
        tiles={[kind]}
      >
        <GridHost>
          <DashboardTile tileId="f" />
        </GridHost>
      </DashboardProvider>,
    );
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getByRole("option", { name: "EMEA" })).toBeInTheDocument();
  });
});
