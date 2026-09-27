import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { describe, expect, it } from "vitest";

import { A2UI_CATALOG_SCHEMA } from "./catalog.generated";
import { completeJson, parseSurfaceJson } from "./complete-json";
import { buildA2uiSurfaceSchema } from "./schema";
import type { A2uiCatalogSchema } from "./spec";
import { invalidNodePaths, validateA2uiSurface } from "./validate";

const C = A2UI_CATALOG_SCHEMA;

describe("completeJson", () => {
  const cases: [string, string][] = [
    [
      '{"a2ui":"1","root":{"type":"Stack","children":["Hel',
      '{"a2ui":"1","root":{"type":"Stack","children":["Hel"]}}',
    ],
    ['{"a":1,"b"', '{"a":1}'],
    ['{"a":1,', '{"a":1}'],
    ['{"a":', '{"a":null}'],
    ['{"a":"x\\', '{"a":"x"}'],
    ['[{"type":"Button"},{"ty', '[{"type":"Button"},{}]'],
    ['{"type"', "{}"],
    ["", ""],
  ];
  it.each(cases)("closes %j", (input, expected) => {
    expect(completeJson(input)).toBe(expected);
    if (expected) expect(() => JSON.parse(completeJson(input))).not.toThrow();
  });

  it("parseSurfaceJson never throws and completes when asked", () => {
    expect(parseSurfaceJson("nope")).toBeNull();
    expect(parseSurfaceJson('{"a2ui":"1"', true)).toEqual({ a2ui: "1" });
    expect(parseSurfaceJson('{"a2ui":"1"', false)).toBeNull();
  });
});

describe("validateA2uiSurface", () => {
  it("accepts a well-formed surface", () => {
    const r = validateA2uiSurface(
      {
        a2ui: "1",
        title: "Order 4711",
        root: {
          type: "Card",
          children: [
            { type: "CardHeader", children: [{ type: "CardTitle", children: ["Order 4711"] }] },
            {
              type: "CardContent",
              children: [
                {
                  type: "Grid",
                  props: { columns: 2 },
                  children: [
                    { type: "MetricCard", props: { label: "Total", value: "€ 1,240" } },
                    { type: "StatusBadge", props: { status: "running" } },
                  ],
                },
              ],
            },
            {
              type: "CardFooter",
              children: [
                {
                  type: "Button",
                  props: { variant: "default" },
                  on: { click: { name: "approve", payload: { id: 4711 } } },
                  children: ["Approve"],
                },
              ],
            },
          ],
        },
      },
      C,
    );
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("rejects an unknown type, prop, enum value, event, and children on a leaf", () => {
    const r = validateA2uiSurface(
      {
        a2ui: "1",
        root: {
          type: "Stack",
          children: [
            { type: "Sparkle" },
            { type: "Button", props: { variant: "loud", className: "p-4" } },
            { type: "Badge", on: { hover: { name: "x" } } },
            { type: "Progress", props: { value: 40 }, children: ["no"] },
            { type: "Progress" },
            { type: "Button", on: { click: { payload: 1 } } },
          ],
        },
      },
      C,
    );
    expect(r.ok).toBe(false);
    expect(r.errors.map((e) => `${e.code}@${e.path}`)).toEqual([
      "unknown-type@root.children[0].type",
      "invalid-value@root.children[1].props.variant",
      "unknown-prop@root.children[1].props.className",
      "unknown-event@root.children[2].on.hover",
      "children-not-allowed@root.children[3].children",
      "missing-prop@root.children[4].props.value",
      "invalid-action@root.children[5].on.click",
    ]);
    expect([...invalidNodePaths(r.errors)]).toEqual([
      "root.children[0]",
      "root.children[1]",
      "root.children[2]",
      "root.children[3]",
      "root.children[4]",
      "root.children[5]",
    ]);
  });

  it("validates nested nodes inside `node`-typed props", () => {
    const r = validateA2uiSurface(
      {
        a2ui: "1",
        root: {
          type: "SectionHeader",
          props: {
            title: "Pipeline",
            actions: [{ type: "Button", children: ["Run"] }, { type: "Nope" }],
          },
        },
      },
      C,
    );
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatchObject({
      code: "unknown-type",
      path: "root.props.actions[1].type",
      node: "root.props.actions[1]",
    });
  });

  it("rejects a wrong version, a missing root and a non-object", () => {
    expect(validateA2uiSurface(null, C).errors[0]!.code).toBe("invalid-root");
    const r = validateA2uiSurface({ a2ui: "2" }, C);
    expect(r.errors.map((e) => e.code)).toEqual(["unsupported-version", "invalid-root"]);
  });

  it("builtins refuse the DOM common props; components accept them", () => {
    const bad = validateA2uiSurface(
      { a2ui: "1", root: { type: "Stack", props: { "aria-label": "x" } } },
      C,
    );
    expect(bad.errors[0]!.code).toBe("unknown-prop");
    const ok = validateA2uiSurface(
      { a2ui: "1", root: { type: "Card", props: { "aria-label": "x", id: "c1" } } },
      C,
    );
    expect(ok.ok).toBe(true);
  });
});

describe("anyOf and deprecated props (RM-197 — validator mechanics on a synthetic catalog)", () => {
  // A hand-built catalog, not real chart data: this file can't see the charts package
  // (one-way dep graph), so it exercises the schema SHAPES `anyOf`/`deprecated` add to
  // the validator, independent of any one consumer's real props.
  const catalog: A2uiCatalogSchema = {
    Widget: {
      children: false,
      props: {
        size: {
          type: "number",
          anyOf: [
            { type: "number" },
            {
              type: "object",
              properties: { base: { type: "number" }, narrow: { type: "number" } },
              requiredProperties: ["base"],
            },
          ],
        },
        legacySize: {
          type: "number",
          deprecated: true,
          description: "Deprecated — use `size`.",
        },
      },
      events: {},
      source: "builtin",
      builtin: true,
    },
  };

  it("`anyOf` accepts every listed shape and rejects one that matches none", () => {
    const plain = validateA2uiSurface(
      { a2ui: "1", root: { type: "Widget", props: { size: 320 } } },
      catalog,
    );
    expect(plain.ok).toBe(true);
    expect(plain.errors).toEqual([]);

    const tiered = validateA2uiSurface(
      { a2ui: "1", root: { type: "Widget", props: { size: { base: 320, narrow: 240 } } } },
      catalog,
    );
    expect(tiered.ok).toBe(true);
    expect(tiered.errors).toEqual([]);

    const malformed = validateA2uiSurface(
      { a2ui: "1", root: { type: "Widget", props: { size: "big" } } },
      catalog,
    );
    expect(malformed.ok).toBe(false);
    expect(malformed.errors).toEqual([
      expect.objectContaining({ code: "invalid-value", path: "root.props.size" }),
    ]);
  });

  it("a `deprecated` prop still validates — a warning, never in `errors`", () => {
    const r = validateA2uiSurface(
      { a2ui: "1", root: { type: "Widget", props: { legacySize: 12 } } },
      catalog,
    );
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([
      expect.objectContaining({ code: "deprecated-prop", path: "root.props.legacySize" }),
    ]);
  });

  it("a deprecated-prop warning message names the replacement exactly once", () => {
    const r = validateA2uiSurface(
      { a2ui: "1", root: { type: "Widget", props: { legacySize: 12 } } },
      catalog,
    );
    expect(r.warnings![0]!.message).toBe('"legacySize" is deprecated — use `size`.');
  });

  it("a blocking error still fails `ok` even alongside a deprecated-prop warning", () => {
    const r = validateA2uiSurface(
      {
        a2ui: "1",
        root: { type: "Widget", props: { legacySize: 12, size: "nope" } },
      },
      catalog,
    );
    expect(r.ok).toBe(false);
    expect(r.errors.map((e) => e.code)).toEqual(["invalid-value"]);
    expect(r.warnings!.map((e) => e.code)).toEqual(["deprecated-prop"]);
  });
});

describe("catalog + JSON schema", () => {
  it("every type is a real ui export or a builtin, with the cva axes as enums", () => {
    expect(C.Button!.props.variant!.enum).toContain("destructive");
    expect(C.Button!.events).toEqual({ click: "onClick" });
    expect(C.Stack!.builtin).toBe(true);
    expect(C.Heading!.props.level!.enum).toEqual([1, 2, 3, 4, 5, 6]);
    for (const [type, entry] of Object.entries(C)) {
      expect(entry.source, type).toMatch(/^(builtin|@elabs-ai\/components-ui)$/);
      for (const name of Object.keys(entry.props))
        expect(name, `${type}.${name}`).not.toMatch(/^on[A-Z]/);
    }
  });

  it("builds a draft-2020-12 schema with one $def per type", () => {
    const s = buildA2uiSurfaceSchema(C) as { $defs: Record<string, unknown>; required: string[] };
    expect(s.required).toEqual(["a2ui", "root"]);
    for (const type of Object.keys(C)) expect(s.$defs[type], type).toBeDefined();
    expect(s.$defs.action).toBeDefined();
  });
});

describe("published JSON Schema compiles under ajv (P1-1)", () => {
  // The PUBLISHED artifact, not a schema built in-process: catches a `pnpm gen` drift the
  // in-memory `buildA2uiSurfaceSchema` call above would never see. `anyOf` over an object
  // alternative with real `properties`/`required` must accept EVERY listed shape and reject
  // anything else — the bug the reviewer found with `oneOf` (rejects a value matching more
  // than one overlapping alternative) must not resurface.
  const schemaPath = [
    resolve(process.cwd(), "schemas/a2ui-surface.v1.schema.json"), // cwd = packages/ai
    resolve(process.cwd(), "packages/ai/schemas/a2ui-surface.v1.schema.json"), // cwd = repo root
  ].find((candidate) => existsSync(candidate));
  if (!schemaPath) throw new Error(`a2ui-surface.v1.schema.json not found from ${process.cwd()}`);
  const schema: object = JSON.parse(readFileSync(schemaPath, "utf8"));
  const ajv = new Ajv2020({ strict: false });
  const validate = ajv.compile(schema);

  const autoChart = (plotHeight: unknown) => ({
    a2ui: "1",
    root: {
      type: "Card",
      children: [{ type: "AutoChart", props: { spec: { type: "line", series: [] }, plotHeight } }],
    },
  });

  it.each([
    ["a plain number", 260, true],
    ["{ aspect }", { aspect: 2 }, true],
    ["{ base, narrow }", { base: 260, narrow: 180 }, true],
    ["a bare string", "tall", false],
    ["{ base: <string> }", { base: "tall" }, false],
    ["an unrelated shape", { foo: 1 }, false],
  ])("plotHeight = %s -> valid: %s", (_label, plotHeight, expected) => {
    expect(validate(autoChart(plotHeight))).toBe(expected);
  });
});
