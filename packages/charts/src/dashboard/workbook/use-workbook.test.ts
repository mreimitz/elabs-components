import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DashboardSpec, WorkbookSpec } from "../core/spec";
import {
  applyCarriedSelection,
  mergeSharedIntoSheet,
  useWorkbook,
  visibleWorkbookSheets,
} from "./use-workbook";

function sheet(id: string, extra: Partial<DashboardSpec> = {}): DashboardSpec {
  return { version: 1, id, grid: { mode: "fit", columns: 12, rows: 6 }, tiles: [], ...extra };
}

const WORKBOOK: WorkbookSpec = {
  version: 1,
  id: "wb",
  sheets: [
    sheet("sheet-1", {
      tiles: [
        {
          id: "filter-1",
          kind: "filter",
          layout: { x: 0, y: 0, w: 4, h: 2 },
          content: { field: "Region" },
          emits: { selection: ["Region"] },
        },
      ],
      interactions: [
        { from: "filter-1", to: "*", effect: { drill: { sheetId: "sheet-2", carry: ["Region"] } } },
      ],
    }),
    sheet("sheet-2"),
    sheet("sheet-3", {
      bookmarks: [{ id: "q3", label: "Q3 EMEA", selection: { Region: ["EMEA"] } }],
    }),
  ],
  shared: {
    bookmarks: [
      { id: "shared-1", label: "Shared", selection: { Region: ["APAC"] }, sheetId: "sheet-3" },
    ],
  },
};

describe("visibleWorkbookSheets", () => {
  it("drops a sheet whose showCondition is false", () => {
    const sheets = [sheet("a"), sheet("b", { showCondition: "false" })];
    expect(visibleWorkbookSheets(sheets).map((s) => s.id)).toEqual(["a"]);
  });

  it("keeps a sheet with no showCondition, or one that fails to compile (fail-open)", () => {
    const sheets = [sheet("a"), sheet("b", { showCondition: "not valid ((" })];
    expect(visibleWorkbookSheets(sheets).map((s) => s.id)).toEqual(["a", "b"]);
  });
});

describe("mergeSharedIntoSheet", () => {
  it("appends a shared bookmark the sheet doesn't already have, by id", () => {
    const merged = mergeSharedIntoSheet(sheet("s"), {
      bookmarks: [{ id: "b1", label: "B1", selection: {} }],
    });
    expect(merged.bookmarks?.map((b) => b.id)).toEqual(["b1"]);
  });

  it("a sheet's own entry wins a name/id clash", () => {
    const own = sheet("s", { bookmarks: [{ id: "b1", label: "Mine", selection: {} }] });
    const merged = mergeSharedIntoSheet(own, {
      bookmarks: [{ id: "b1", label: "Shared", selection: {} }],
    });
    expect(merged.bookmarks).toEqual([{ id: "b1", label: "Mine", selection: {} }]);
  });
});

describe("useWorkbook — RM-087", () => {
  it("a drill switches the active sheet and applies the carried selection to the target's store", () => {
    const { result } = renderHook(() => useWorkbook({ workbook: WORKBOOK }));
    expect(result.current.activeSheetId).toBe("sheet-1");

    act(() => {
      result.current.onNavigate("sheet-2", { carry: { Region: ["EMEA"] } });
    });

    expect(result.current.activeSheetId).toBe("sheet-2");
    const sheet2 = result.current.getStore("sheet-2").getState();
    expect(sheet2.selection.fields.Region?.values).toEqual(["EMEA"]);
  });

  it("applyCarriedSelection writes a global (unrouted) filter", () => {
    const { result } = renderHook(() => useWorkbook({ workbook: WORKBOOK }));
    const store = result.current.getStore("sheet-2");
    act(() => applyCarriedSelection(store, { Region: ["APAC", "LATAM"] }));
    expect(store.getState().selection.fields.Region?.values).toEqual(["APAC", "LATAM"]);
    expect(store.getState().selectionOrigins).toEqual({});
  });

  it("a sheetId-bearing bookmark switches sheets first, then applies", () => {
    const { result } = renderHook(() => useWorkbook({ workbook: WORKBOOK }));
    act(() => {
      result.current.applyWorkbookBookmark({
        id: "shared-1",
        label: "Shared",
        selection: { Region: ["APAC"] },
        sheetId: "sheet-3",
      });
    });
    expect(result.current.activeSheetId).toBe("sheet-3");
    expect(result.current.getStore("sheet-3").getState().selection.fields.Region?.values).toEqual([
      "APAC",
    ]);
  });

  it("dirty aggregates across every visited sheet's store", () => {
    const { result } = renderHook(() => useWorkbook({ workbook: WORKBOOK }));
    expect(result.current.dirty).toBe(false);
    act(() => {
      result.current.getStore("sheet-1").getState().actions.moveTile("filter-1", { x: 1, y: 0 });
    });
    expect(result.current.dirty).toBe(true);
  });
});
