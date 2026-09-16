import { describe, expect, it } from "vitest";

import minimalJson from "./__fixtures__/minimal.json";
import opsJson from "./__fixtures__/ops-flow.json";
import salesJson from "./__fixtures__/sales-overview.json";
import { collides } from "./layout";
import type { DashboardSpec, DashboardSpecErrorCode, TileLayout } from "./spec";
import { normalizeDashboardSpec, validateDashboardSpec } from "./validate";

const GOLDEN: Array<[string, DashboardSpec]> = [
  ["sales-overview", salesJson as unknown as DashboardSpec],
  ["ops-flow", opsJson as unknown as DashboardSpec],
  ["minimal", minimalJson as unknown as DashboardSpec],
];

const clone = (spec: DashboardSpec): DashboardSpec => structuredClone(spec);
const sales = () => clone(salesJson as unknown as DashboardSpec);
const ops = () => clone(opsJson as unknown as DashboardSpec);

describe("golden specs", () => {
  it.each(GOLDEN)("%s validates", (_name, spec) => {
    const result = validateDashboardSpec(spec);
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  it.each(GOLDEN)("%s normalises idempotently", (_name, spec) => {
    const once = normalizeDashboardSpec(spec);
    const twice = normalizeDashboardSpec(once.spec);
    expect(twice.spec).toEqual(once.spec);
    expect(twice.warnings).toEqual([]);
    expect(validateDashboardSpec(once.spec).ok).toBe(true);
  });

  it("has the promised shapes", () => {
    expect(sales().tiles).toHaveLength(9);
    expect(ops().tiles).toHaveLength(14);
    expect(ops().containers).toHaveLength(1);
  });
});

const ERROR_FIXTURES: Array<[DashboardSpecErrorCode, () => unknown]> = [
  ["missing", () => ({ ...sales(), id: undefined })],
  ["type", () => ({ ...sales(), tiles: "nope" })],
  [
    "range",
    () => {
      const spec = sales();
      (spec.tiles[0] as { layout: { w: number } }).layout.w = 0;
      return spec;
    },
  ],
  [
    "duplicate-id",
    () => {
      const spec = sales();
      (spec.tiles[1] as { id: string }).id = spec.tiles[0]?.id as string;
      return spec;
    },
  ],
  ["unknown-ref", () => ({ ...sales(), tiles: [{ ...sales().tiles[0], ref: "nowhere" }] })],
  [
    "overlap",
    () => {
      const spec = sales();
      (spec.tiles[1] as { layout: { x: number } }).layout.x = 2;
      return spec;
    },
  ],
  [
    "nested-container",
    () => {
      const spec = ops();
      spec.containers?.push({
        id: "outer",
        kind: "stack",
        layout: { x: 0, y: 40, w: 4, h: 4 },
        children: ["drilldown"],
      });
      return spec;
    },
  ],
  ["version", () => ({ ...sales(), version: 2 })],
  [
    "expression",
    () => {
      const spec = sales();
      (spec.tiles[0] as { visibleWhen?: string }).visibleWhen = "(function(){})()";
      return spec;
    },
  ],
];

describe("validateDashboardSpec errors", () => {
  it.each(ERROR_FIXTURES)("reports %s", (code, make) => {
    const result = validateDashboardSpec(make());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.map((error) => error.code)).toContain(code);
  });

  it("rejects a non-object", () => {
    expect(validateDashboardSpec(null)).toMatchObject({ ok: false, errors: [{ code: "type" }] });
  });

  it("allows flow-mode overlaps (repaired by normalize)", () => {
    const spec = ops();
    (spec.tiles[1] as { layout: { x: number } }).layout.x = 2;
    expect(validateDashboardSpec(spec).ok).toBe(true);
  });
});

describe("normalizeDashboardSpec", () => {
  it("fills grid defaults", () => {
    const { spec } = normalizeDashboardSpec({
      version: 1,
      id: "bare",
      grid: {} as DashboardSpec["grid"],
      tiles: [],
    });
    expect(spec.grid).toEqual({ mode: "fit", columns: 24, rows: 12, gap: 8 });
    const flow = normalizeDashboardSpec({ ...spec, grid: { mode: "flow", columns: 24 } });
    expect(flow.spec.grid).toEqual({ mode: "flow", columns: 24, rowHeight: 30, gap: 8 });
  });

  it("assigns ids, clamps layouts and warns on unknown kinds", () => {
    const { spec, warnings } = normalizeDashboardSpec(
      {
        version: 1,
        id: "x",
        grid: { mode: "fit", columns: 24, rows: 12 },
        tiles: [
          { id: "", kind: "chart", layout: { x: 30, y: 0, w: 4, h: 2 }, content: null },
          { id: "tile-1", kind: "sparkle", layout: { x: 0, y: 0, w: 4, h: 2 }, content: null },
        ],
      },
      { kinds: ["chart"] },
    );
    expect(spec.tiles[0]?.id).toBe("tile-2");
    expect(spec.tiles[0]?.layout.x).toBe(20);
    expect(warnings.map((warning) => warning.code).sort()).toEqual([
      "clamped",
      "id-assigned",
      "unknown-kind",
    ]);
  });

  it("repairs flow overlaps with compact and a warning", () => {
    const spec = ops();
    (spec.tiles[1] as { layout: { x: number } }).layout.x = 2;
    const { spec: fixed, warnings } = normalizeDashboardSpec(spec);
    expect(warnings.map((warning) => warning.code)).toContain("overlap-repaired");
    const top: TileLayout[] = [
      ...fixed.tiles.filter((t) => !t.container).map((t) => ({ ...t.layout, id: t.id })),
      ...(fixed.containers ?? []).map((c) => ({ ...c.layout, id: c.id })),
    ];
    expect(top.every((a, i) => top.slice(i + 1).every((b) => !collides(a, b)))).toBe(true);
  });
});
