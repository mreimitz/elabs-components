import { readFileSync } from "node:fs";
import { join } from "node:path";

import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import { describe, expect, it } from "vitest";

import { builtInTiles } from "../tiles/built-in-tiles";
import minimalJson from "./__fixtures__/minimal.json";
import opsJson from "./__fixtures__/ops-flow.json";
import salesJson from "./__fixtures__/sales-overview.json";
import { BUILT_IN_TILE_KIND_DEFAULTS, DASHBOARD_SPEC_SCHEMA } from "./schema";
import type { DashboardSpec } from "./spec";
import { validateDashboardSpec } from "./validate";

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile(DASHBOARD_SPEC_SCHEMA);

const sales = () => structuredClone(salesJson as unknown as DashboardSpec);
const ops = () => structuredClone(opsJson as unknown as DashboardSpec);

/** ajv's `/tiles/0/layout/w` (+ `missingProperty`) → the validator's `$.tiles[0].layout.w`. */
function specPath(error: ErrorObject): string {
  const segments = error.instancePath.split("/").slice(1);
  if (error.keyword === "required") segments.push(String(error.params.missingProperty));
  return segments.reduce((path, s) => (/^\d+$/.test(s) ? `${path}[${s}]` : `${path}.${s}`), "$");
}
const ajvPaths = (input: unknown) => (validate(input) ? [] : (validate.errors ?? []).map(specPath));

describe("DASHBOARD_SPEC_SCHEMA", () => {
  it.each([
    ["sales-overview", salesJson],
    ["ops-flow", opsJson],
    ["minimal", minimalJson],
  ])("accepts the %s golden", (_name, spec) => {
    expect(ajvPaths(spec)).toEqual([]);
  });

  // The RM-070 error fixtures (validate.test.ts). Shape errors are rejected by the schema at
  // the validator's path; the semantic ones JSON Schema cannot express stay validator-only.
  const SHAPE_FIXTURES: Array<[string, () => unknown]> = [
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
    ["version", () => ({ ...sales(), version: 2 })],
  ];
  it.each(SHAPE_FIXTURES)("rejects the %s fixture at the validator's path", (_code, make) => {
    const input = JSON.parse(JSON.stringify(make())) as unknown;
    const result = validateDashboardSpec(input);
    expect(result.ok).toBe(false);
    const validatorPaths = result.ok
      ? []
      : result.errors.filter((error) => error.code === _code).map((error) => error.path);
    expect(validatorPaths.length).toBeGreaterThan(0);
    const paths = ajvPaths(input);
    expect(paths.length).toBeGreaterThan(0);
    for (const path of validatorPaths) expect(paths).toContain(path);
  });

  const SEMANTIC_FIXTURES: Array<[string, () => unknown]> = [
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
    [
      "expression",
      () => {
        const spec = sales();
        (spec.tiles[0] as { visibleWhen?: string }).visibleWhen = "(function(){})()";
        return spec;
      },
    ],
  ];
  it.each(SEMANTIC_FIXTURES)(
    "leaves the %s fixture to validateDashboardSpec (shape-valid)",
    (_code, make) => {
      const input = make();
      expect(ajvPaths(input)).toEqual([]);
      expect(validateDashboardSpec(input).ok).toBe(false);
    },
  );

  it("types built-in content by kind", () => {
    const spec = sales();
    (spec.tiles[4] as { content: unknown }).content = { type: "line" };
    expect(ajvPaths(spec)).toContain("$.tiles[4].content.data");
    const unknown = sales();
    (unknown.tiles[0] as { content: unknown }).content = { anything: true };
    expect(ajvPaths(unknown)).toEqual([]);
  });

  it("rejects unknown top-level keys", () => {
    expect(validate({ ...sales(), colour: "red" })).toBe(false);
  });
});

describe("BUILT_IN_TILE_KIND_DEFAULTS", () => {
  it("mirrors builtInTiles (minus container) exactly", () => {
    const fromRegistry = Object.values(builtInTiles)
      .filter((kind) => kind.kind !== "container")
      .map(({ kind, label, defaultSize, minSize, capabilities }) => ({
        kind,
        label,
        defaultSize,
        minSize,
        capabilities,
      }));
    expect([...BUILT_IN_TILE_KIND_DEFAULTS]).toEqual(fromRegistry);
    expect(BUILT_IN_TILE_KIND_DEFAULTS).toHaveLength(9);
  });

  it("is what the schema's x-brand-ui-kind-defaults lists", () => {
    expect(Object.keys(DASHBOARD_SPEC_SCHEMA["x-brand-ui-kind-defaults"] as object)).toEqual(
      BUILT_IN_TILE_KIND_DEFAULTS.map((kind) => kind.kind),
    );
  });
});

describe("sheet-for.md example specs", () => {
  const doc = readFileSync(
    join(__dirname, "../../../../../skills/brand-ui/reference/sheet-for.md"),
    "utf8",
  );
  const examples = [...doc.matchAll(/```json dashboard-spec\n([\s\S]*?)\n```/g)].map(
    (m) => JSON.parse(m[1] as string) as unknown,
  );

  it("has three copyable examples", () => {
    expect(examples).toHaveLength(3);
  });

  it.each([0, 1, 2])("example %i validates with the schema and validateDashboardSpec", (index) => {
    const spec = examples[index];
    expect(ajvPaths(spec)).toEqual([]);
    const result = validateDashboardSpec(spec);
    expect(result.ok ? [] : result.errors).toEqual([]);
  });
});
