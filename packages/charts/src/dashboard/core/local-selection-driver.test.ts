import { describe, expect, it, vi } from "vitest";

import { createLocalSelectionDriver } from "./local-selection-driver";

const ROWS = [
  { Region: "EMEA", Product: "Widget", Channel: "Web" },
  { Region: "EMEA", Product: "Gadget", Channel: "Store" },
  { Region: "APAC", Product: "Gizmo", Channel: "Web" },
  { Region: "AMER", Product: "Widget", Channel: "Partner" },
];

function setup() {
  const driver = createLocalSelectionDriver();
  driver.register("chart-a", ROWS, ["Region", "Product"]);
  driver.register("chart-b", ROWS, ["Region", "Channel"]);
  return driver;
}

describe("createLocalSelectionDriver", () => {
  it("computes selected / excluded / associated across tiles sharing a field", () => {
    const driver = setup();
    driver.select("Region", ["EMEA"]);
    const snap = driver.getSnapshot();
    expect(snap.states("Region", "EMEA")).toBe("selected");
    expect(snap.states("Region", "APAC")).toBe("excluded");
    expect(snap.states("Product", "Widget")).toBe("associated");
    expect(snap.states("Product", "Gadget")).toBe("associated");
    expect(snap.states("Product", "Gizmo")).toBe("excluded");
    expect(snap.states("Channel", "Partner")).toBe("excluded");
    expect(snap.states("Channel", "Store")).toBe("associated");
  });

  it("intersects association across tiles that show the same field", () => {
    const driver = createLocalSelectionDriver();
    driver.register("a", ROWS, ["Region", "Product"]);
    driver.register("b", ROWS.slice(0, 1), ["Region", "Product"]);
    driver.select("Region", ["EMEA"]);
    expect(driver.getSnapshot().states("Product", "Widget")).toBe("associated");
    expect(driver.getSnapshot().states("Product", "Gadget")).toBe("excluded");
  });

  it("memoises the snapshot until the next change and notifies subscribers", () => {
    const driver = setup();
    const listener = vi.fn();
    driver.subscribe(listener);
    const first = driver.getSnapshot();
    expect(driver.getSnapshot()).toBe(first);
    driver.select("Region", ["EMEA"]);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(driver.getSnapshot()).not.toBe(first);
    driver.select("Region", ["EMEA"]); // no change
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("walks back and forward through selection history", () => {
    const driver = setup();
    expect(driver.canBack()).toBe(false);
    driver.select("Region", ["EMEA"]);
    driver.select("Product", ["Widget"], { replace: true });
    driver.back();
    expect(driver.getSnapshot().count("Product")).toBe(0);
    driver.back();
    expect(driver.getSnapshot().count()).toBe(0);
    expect(driver.canBack()).toBe(false);
    driver.forward();
    expect(driver.getSnapshot().states("Region", "EMEA")).toBe("selected");
    driver.select("Channel", ["Web"]);
    expect(driver.canForward()).toBe(false);
  });

  it("caps history at historyLimit steps", () => {
    const driver = createLocalSelectionDriver({ historyLimit: 2 });
    driver.select("Region", ["EMEA"], { replace: true });
    driver.select("Region", ["APAC"], { replace: true });
    driver.select("Region", ["AMER"], { replace: true });
    driver.back();
    driver.back();
    expect(driver.canBack()).toBe(false);
    expect(driver.getSnapshot().fields.Region?.values).toEqual(["EMEA"]);
  });

  it("a lock makes select and clear no-ops for that field only", () => {
    const driver = setup();
    driver.select("Region", ["EMEA"]);
    driver.select("Product", ["Widget"]);
    driver.lock("Region", true);
    driver.clear();
    const snap = driver.getSnapshot();
    expect(snap.fields.Region).toEqual({ values: ["EMEA"], locked: true });
    expect(snap.count("Product")).toBe(0);
    driver.clear("Region");
    driver.select("Region", ["APAC"]);
    expect(driver.getSnapshot().fields.Region?.values).toEqual(["EMEA"]);
    driver.lock("Region", false);
    driver.clear("Region");
    expect(driver.getSnapshot().count()).toBe(0);
  });

  it("unregistering a tile drops its constraint", () => {
    const driver = createLocalSelectionDriver();
    const off = driver.register("a", ROWS, ["Region", "Product"]);
    driver.select("Region", ["APAC"]);
    expect(driver.getSnapshot().states("Product", "Widget")).toBe("excluded");
    off();
    expect(driver.getSnapshot().states("Product", "Widget")).toBe("associated");
  });

  it("recomputes 100 k rows × 12 tiles within one frame (16 ms)", () => {
    const regions = ["EMEA", "APAC", "AMER", "LATAM"];
    const fieldNames = ["Region", "Product", "Channel", "Segment", "Quarter", "Owner"];
    const cardinality = [4, 200, 6, 12, 8, 500];
    // Deterministic pseudo-random data (charts-honesty: no Math.random).
    let seed = 42;
    const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
    const tiles = Array.from({ length: 12 }, () =>
      Array.from({ length: 100_000 }, () => {
        const row: Record<string, unknown> = {};
        fieldNames.forEach((field, f) => {
          const v = next() % (cardinality[f] ?? 1);
          row[field] = field === "Region" ? regions[v] : `${field}-${v}`;
        });
        return row;
      }),
    );
    const driver = createLocalSelectionDriver();
    tiles.forEach((rows, i) =>
      driver.register(`tile-${i}`, rows, ["Region", ...fieldNames.slice(1 + (i % 5), 3 + (i % 5))]),
    );
    driver.getSnapshot();

    const samples: number[] = [];
    const selections = [
      ["EMEA"],
      ["EMEA", "APAC"],
      ["AMER", "APAC", "LATAM"],
      ["LATAM"],
      ["EMEA", "APAC", "AMER", "LATAM"],
    ];
    for (let run = 0; run < 3; run++) {
      for (const values of selections) {
        driver.select("Region", values, { replace: true });
        const start = performance.now();
        driver.getSnapshot();
        samples.push(performance.now() - start);
      }
    }
    samples.sort((a, b) => a - b);
    const median = samples[Math.floor(samples.length / 2)] ?? 0;
    const worst = samples[samples.length - 1] ?? 0;
    console.info(
      `[local-selection-driver] 100k rows × 12 tiles: median ${median.toFixed(2)} ms, worst ${worst.toFixed(2)} ms`,
    );
    if (process.env.CI) expect(median).toBeLessThan(16);
  }, 60_000);
});
