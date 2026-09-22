import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createLocalSelectionDriver, useSelectionDriver } from "./local-selection-driver";
import type { ChartSelectionIntent } from "./types";

describe("createLocalSelectionDriver", () => {
  it("states: selected ∈ selection, excluded when the field has another selection, associated otherwise", () => {
    const driver = createLocalSelectionDriver();
    expect(driver.getSnapshot().states("region", "North")).toBe("associated");
    driver.select("region", ["North", "East"]);
    const snap = driver.getSnapshot();
    expect(snap.states("region", "North")).toBe("selected");
    expect(snap.states("region", "South")).toBe("excluded");
    expect(snap.states("product", "Tea")).toBe("associated");
    expect(snap.fields.region?.values).toEqual(["North", "East"]);
    expect(snap.count("region")).toBe(2);
    expect(snap.count()).toBe(1);
  });

  it("add (no flags), toggle and replace", () => {
    const driver = createLocalSelectionDriver();
    driver.select("region", ["North"]);
    driver.select("region", ["East"]);
    expect(driver.getSnapshot().fields.region?.values).toEqual(["North", "East"]);
    driver.select("region", ["North", "South"], { toggle: true });
    expect(driver.getSnapshot().fields.region?.values).toEqual(["East", "South"]);
    driver.select("region", ["West"], { replace: true });
    expect(driver.getSnapshot().fields.region?.values).toEqual(["West"]);
    driver.select("region", ["West"], { toggle: true });
    expect(driver.getSnapshot().fields.region).toBeUndefined();
  });

  it("compares dates by time", () => {
    const driver = createLocalSelectionDriver();
    driver.select("day", [new Date(2024, 0, 1)]);
    expect(driver.getSnapshot().states("day", new Date(2024, 0, 1))).toBe("selected");
  });

  it("clear one field or all; the snapshot is stable until a change", () => {
    const driver = createLocalSelectionDriver();
    driver.select("region", ["North"]);
    driver.select("product", ["Tea"]);
    const before = driver.getSnapshot();
    expect(driver.getSnapshot()).toBe(before);
    driver.clear("region");
    expect(driver.getSnapshot().fields.region).toBeUndefined();
    expect(driver.getSnapshot().fields.product?.values).toEqual(["Tea"]);
    driver.clear();
    expect(driver.getSnapshot().count()).toBe(0);
  });

  it("subscribe fires on a change only, and unsubscribes", () => {
    const driver = createLocalSelectionDriver();
    const listener = vi.fn();
    const off = driver.subscribe(listener);
    driver.select("region", ["North"]);
    driver.select("region", ["North"]); // no change
    driver.clear("product"); // nothing to clear
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    driver.clear();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("useSelectionDriver", () => {
  const intent = (mode: ChartSelectionIntent["mode"], values: string[]): ChartSelectionIntent => ({
    field: "region",
    values,
    mode,
    gesture: { kind: "click", category: values[0]! },
    datapoints: [],
    source: "pointer",
  });

  it("maps intents onto select() flags and re-renders with the new snapshot", () => {
    const driver = createLocalSelectionDriver();
    const { result } = renderHook(() => useSelectionDriver(driver));
    act(() => result.current.apply(intent("replace", ["North", "East"])));
    expect(result.current.snapshot.fields.region?.values).toEqual(["North", "East"]);
    act(() => result.current.apply(intent("toggle", ["North"])));
    expect(result.current.snapshot.fields.region?.values).toEqual(["East"]);
    act(() => result.current.apply(intent("add", ["West"])));
    expect(result.current.snapshot.fields.region?.values).toEqual(["East", "West"]);
  });

  it("selectionStates reads the row's own field value, falling back to the category", () => {
    const driver = createLocalSelectionDriver();
    const { result } = renderHook(() => useSelectionDriver(driver));
    act(() => result.current.apply(intent("replace", ["East"])));
    const states = result.current.selectionStates;
    expect(states("East")).toBe("selected");
    expect(states("North")).toBe("excluded");
    expect(states(42, "revenue", { region: "East" })).toBe("selected");
    expect(states(42, "revenue", { region: "West" })).toBe("excluded");
  });
});
