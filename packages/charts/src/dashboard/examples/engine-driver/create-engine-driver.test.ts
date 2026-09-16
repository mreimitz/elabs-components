import { describe, expect, it } from "vitest";

import { createDashboardStore } from "../../core/store";
import type { DashboardSpec } from "../../core/spec";
import { createEngineDriver } from "./create-engine-driver";
import { createMockEngine } from "./mock-engine";

const ROWS = [
  { Region: "EMEA", Product: "Widget" },
  { Region: "EMEA", Product: "Gadget" },
  { Region: "APAC", Product: "Gizmo" },
  { Region: "AMER", Product: "Widget" },
];

function setup(latencyMs = 0) {
  const engine = createMockEngine(ROWS, ["Region", "Product"], { latencyMs });
  const driver = createEngineDriver(engine);
  return { engine, driver };
}

const SPEC: DashboardSpec = {
  version: 1,
  id: "engine-driver-test",
  grid: { mode: "fit", columns: 12, rows: 6 },
  tiles: [],
};

describe("createEngineDriver", () => {
  it("select is fire-and-forget: the driver's own snapshot only updates once the engine resolves", () => {
    const { driver } = setup();
    const before = driver.getSnapshot();
    driver.select("Region", ["EMEA"]);
    // Synchronously right after `select`, nothing has changed yet — the engine has not
    // resolved (see the next test for the awaited resolution).
    expect(driver.getSnapshot()).toBe(before);
  });

  it("select -> engine onChange -> driver snapshot updates asynchronously (awaited)", async () => {
    const { engine, driver } = setup();
    let notified = 0;
    driver.subscribe(() => {
      notified++;
    });
    driver.select("Region", ["EMEA"]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(notified).toBeGreaterThan(0);
    expect(driver.getSnapshot().states("Region", "EMEA")).toBe("selected");
    expect(driver.getSnapshot().states("Region", "APAC")).toBe("excluded");
    expect(driver.getSnapshot().states("Product", "Widget")).toBe("associated");
    expect(driver.getSnapshot().states("Product", "Gizmo")).toBe("excluded");
    expect(engine.selected("Region")).toEqual(["EMEA"]);
  });

  it("select -> store.selection updates asynchronously through a real DashboardProvider store", async () => {
    const { driver } = setup();
    const store = createDashboardStore({ spec: SPEC, driver });
    driver.select("Region", ["EMEA"]);
    // Immediately after: the store still mirrors the OLD snapshot (`select` is fire-and-forget).
    expect(store.getState().selection.count("Region")).toBe(0);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.getState().selection.fields.Region?.values).toEqual(["EMEA"]);
  });

  it("back() on the driver restores the engine's prior state and the store mirrors it", async () => {
    const { driver } = setup();
    const store = createDashboardStore({ spec: SPEC, driver });
    driver.select("Region", ["EMEA"]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    driver.select("Region", ["APAC"]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.getState().selection.fields.Region?.values).toEqual(["APAC"]);
    expect(driver.canBack()).toBe(true);
    driver.back();
    expect(store.getState().selection.fields.Region?.values).toEqual(["EMEA"]);
  });

  it("a selection never touches the store's layout/edit history (history.past stays 0)", async () => {
    const { driver } = setup();
    const store = createDashboardStore({ spec: SPEC, driver });
    const before = store.getState().history.past;
    expect(before).toBe(0);
    driver.select("Region", ["EMEA"]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    driver.select("Region", ["APAC"], { toggle: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.getState().history.past).toBe(0);
  });

  it("canBack/canForward mirror the engine's own history, not a fresh count", async () => {
    const { engine, driver } = setup();
    expect(driver.canBack()).toBe(false);
    expect(driver.canForward()).toBe(false);
    driver.select("Region", ["EMEA"]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(driver.canBack()).toBe(true);
    expect(engine.canBack()).toBe(true);
    driver.back();
    expect(driver.canBack()).toBe(false);
    expect(driver.canForward()).toBe(true);
  });

  it("ready resolves once the engine has fired its first onChange", async () => {
    const { driver } = setup();
    let resolved = false;
    void driver.ready.then(() => {
      resolved = true;
    });
    expect(resolved).toBe(false);
    driver.select("Region", ["EMEA"]);
    await driver.ready;
    expect(resolved).toBe(true);
  });

  it("toggle flips a value in and out; the default REPLACES the field (a real engine's shape, not the local driver's add)", async () => {
    const { driver } = setup();
    driver.select("Region", ["EMEA"]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    driver.select("Region", ["APAC"]); // no toggle/replace flag: still REPLACES
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(driver.getSnapshot().fields.Region?.values).toEqual(["APAC"]);
    driver.select("Region", ["APAC"], { toggle: true }); // toggling the only selected value clears it
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(driver.getSnapshot().count("Region")).toBe(0);
  });

  it("register is a no-op that still returns an unregister function", () => {
    const { driver } = setup();
    const unregister = driver.register?.("some-tile", ROWS, ["Region"]);
    expect(typeof unregister).toBe("function");
    expect(() => unregister?.()).not.toThrow();
  });
});
