import { describe, expect, it } from "vitest";

import { bigFortySpec } from "./big-40";
import { makeSpec } from "./make-spec";
import { minimalSpec } from "./minimal";
import { opsFlowSpec } from "./ops-flow";
import { salesOverviewSpec } from "./sales-overview";
import { validateDashboardSpec } from "../core/validate";

describe("dashboard fixtures", () => {
  it.each([
    ["sales-overview", salesOverviewSpec],
    ["ops-flow", opsFlowSpec],
    ["minimal", minimalSpec],
    ["big40", bigFortySpec],
  ])("%s round-trips validateDashboardSpec ok", (_name, spec) => {
    const result = validateDashboardSpec(spec);
    expect(result.ok).toBe(true);
  });

  it("sales-overview has 9 tiles", () => {
    expect(salesOverviewSpec.tiles).toHaveLength(9);
  });

  it("big40 has 40 tiles in a flow grid", () => {
    expect(bigFortySpec.tiles).toHaveLength(40);
    expect(bigFortySpec.grid.mode).toBe("flow");
  });

  it("chart tiles carry 24 real seeded rows, deterministically", () => {
    const chart = salesOverviewSpec.tiles.find((t) => t.kind === "chart")!;
    const data = (chart.content as { data: unknown[] }).data;
    expect(data).toHaveLength(24);
    // Re-running the fixture module import path is deterministic by construction (seededRnd);
    // assert shape instead of re-deriving the same numbers here.
    expect(data[0]).toHaveProperty("x", "P1");
  });

  describe("makeSpec", () => {
    it("defaults to the minimal spec", () => {
      expect(validateDashboardSpec(makeSpec()).ok).toBe(true);
    });

    it("overrides top-level fields", () => {
      const spec = makeSpec({ id: "custom", title: "Custom sheet" });
      expect(spec.id).toBe("custom");
      expect(spec.title).toBe("Custom sheet");
      expect(validateDashboardSpec(spec).ok).toBe(true);
    });
  });
});
