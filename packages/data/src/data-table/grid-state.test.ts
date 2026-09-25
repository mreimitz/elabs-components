import { describe, expect, it } from "vitest";
import {
  GRID_STATE_JSON_SCHEMA,
  GRID_STATE_VERSION,
  parseGridState,
  serializeGridState,
} from "./grid-state";

describe("grid state", () => {
  it("round-trips a view, stamping the version and dropping empty optional slices", () => {
    const saved = serializeGridState({
      sorting: [{ id: "qty", desc: true }],
      columnVisibility: {},
      columnFilters: [{ id: "desk", value: { type: "set", values: ["FX"] } }],
      grouping: [],
      columnPinning: { left: ["id"], right: [] },
    });
    expect(saved.version).toBe(GRID_STATE_VERSION);
    expect("grouping" in saved).toBe(false);
    const json = JSON.stringify(saved);
    const { state, dropped, fromVersion } = parseGridState(json);
    expect(dropped).toEqual([]);
    expect(fromVersion).toBe(1);
    expect(state.sorting).toEqual([{ id: "qty", desc: true }]);
    expect(state.columnPinning).toEqual({ left: ["id"], right: [] });
  });

  it("migrates unversioned snapshots and drops what it cannot trust", () => {
    const { state, dropped, fromVersion } = parseGridState({
      sorting: [{ id: "a", desc: "yes" }],
      columnPinning: { start: ["id"] },
      pagination: { pageIndex: 2, pageSize: 25 },
      expanded: true,
      bogus: 1,
    });
    expect(fromVersion).toBe(0);
    expect(state.columnPinning).toEqual({ left: ["id"], right: [] });
    expect(state.pagination).toEqual({ pageIndex: 2, pageSize: 25 });
    expect(state.expanded).toBe(true);
    expect(state.sorting).toEqual([]);
    expect(dropped.sort()).toEqual(["bogus", "sorting"]);
  });

  it("refuses non-objects and future versions", () => {
    expect(() => parseGridState("[]")).toThrow(TypeError);
    expect(() => parseGridState({ version: 99 })).toThrow(RangeError);
  });

  it("publishes a JSON schema naming every slice", () => {
    expect(Object.keys(GRID_STATE_JSON_SCHEMA.properties)).toEqual(
      expect.arrayContaining(["version", "sorting", "columnFilters", "grouping", "expanded"]),
    );
  });
});
