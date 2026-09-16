import { describe, expect, it } from "vitest";

import { applySelectionValues, createSelectionSnapshot, EMPTY_SELECTION } from "./selection";

describe("createSelectionSnapshot", () => {
  it("defaults every value to associated when nothing is selected", () => {
    expect(EMPTY_SELECTION.states("Region", "EMEA")).toBe("associated");
    expect(EMPTY_SELECTION.count()).toBe(0);
  });

  it("resolves selected, excluded and associated", () => {
    const snap = createSelectionSnapshot(
      { Region: { values: ["EMEA"] } },
      { Product: new Set(["Widget"]) },
    );
    expect(snap.states("Region", "EMEA")).toBe("selected");
    expect(snap.states("Region", "APAC")).toBe("excluded");
    expect(snap.states("Product", "Widget")).toBe("associated");
    expect(snap.states("Product", "Gadget")).toBe("excluded");
    expect(snap.states("Channel", "Web")).toBe("associated");
    expect(snap.count("Region")).toBe(1);
    expect(snap.count()).toBe(1);
  });

  it("is immutable and does not alias its input", () => {
    const input = { Region: { values: ["EMEA"] as Array<string | number> } };
    const snap = createSelectionSnapshot(input);
    input.Region.values.push("APAC");
    expect(snap.fields.Region?.values).toEqual(["EMEA"]);
    expect(Object.isFrozen(snap.fields)).toBe(true);
    expect(Object.isFrozen(snap.fields.Region?.values)).toBe(true);
  });

  it("a locked field with nothing selected constrains nothing", () => {
    const snap = createSelectionSnapshot({ Region: { values: [], locked: true } });
    expect(snap.fields.Region?.locked).toBe(true);
    expect(snap.states("Region", "EMEA")).toBe("associated");
    expect(snap.count()).toBe(0);
  });
});

describe("applySelectionValues", () => {
  it("adds by default, toggles and replaces on request", () => {
    expect(applySelectionValues(["a"], ["b"])).toEqual(["a", "b"]);
    expect(applySelectionValues(["a", "b"], ["a", "c"], { toggle: true })).toEqual(["b", "c"]);
    expect(applySelectionValues(["a", "b"], ["c", "c"], { replace: true })).toEqual(["c"]);
  });
});
