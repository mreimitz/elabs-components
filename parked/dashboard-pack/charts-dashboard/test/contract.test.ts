import { describe, expect, it } from "vitest";

import { DashboardSpecError, assertDashboardSpec } from "./contract";
import { salesOverviewSpec } from "../fixtures/sales-overview";

describe("assertDashboardSpec", () => {
  it("returns the spec when it is valid", () => {
    expect(assertDashboardSpec(salesOverviewSpec)).toBe(salesOverviewSpec);
  });

  it("throws DashboardSpecError on a duplicate id", () => {
    const broken = {
      ...salesOverviewSpec,
      tiles: [
        salesOverviewSpec.tiles[0],
        { ...salesOverviewSpec.tiles[1], id: salesOverviewSpec.tiles[0]!.id },
      ],
    };
    let error: unknown;
    try {
      assertDashboardSpec(broken);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(DashboardSpecError);
    expect((error as InstanceType<typeof DashboardSpecError>).code).toBe("duplicate-id");
  });

  it("throws DashboardSpecError on a nested container", () => {
    const broken = {
      version: 1 as const,
      id: "nested",
      grid: { mode: "fit" as const, columns: 24, rows: 12 },
      tiles: [] as never[],
      containers: [
        {
          id: "outer",
          kind: "tabs" as const,
          layout: { x: 0, y: 0, w: 6, h: 4 },
          children: ["inner"],
        },
        {
          id: "inner",
          kind: "tabs" as const,
          layout: { x: 0, y: 4, w: 6, h: 4 },
          children: [],
        },
      ],
    };
    let error: unknown;
    try {
      assertDashboardSpec(broken);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(DashboardSpecError);
    expect(
      (error as InstanceType<typeof DashboardSpecError>).errors.some(
        (e) => e.code === "nested-container",
      ),
    ).toBe(true);
  });
});
