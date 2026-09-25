/**
 * Acceptance for the definition base: one chart-shaped and one flow-node-shaped
 * definition, each declared from a LOCAL props fixture that mirrors the real
 * component's props (the base never imports charts or flow). Both go through
 * exactly the same helpers — neither needs a special case.
 */

import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  a11yGroup,
  applyAliases,
  assertDefinitionComplete,
  defineComponent,
  field,
  headerGroup,
  normalizeAliases,
  resetWarnOnce,
  resolveProps,
  statusGroup,
  toJsonSchema,
  toSnapshot,
  validateProps,
  warnOnce,
  type A11yGroupProps,
  type AliasRow,
  type DefinitionIsComplete,
  type PropsOf,
  type TargetDescriptor,
  type UnaccountedProps,
} from "./index";
import type { StatusTone } from "../status-tone";

// ── Fixtures ────────────────────────────────────────────────────────────────

/** Stands in for `ReactNode`: the base is React-free, so the fixture is too. */
interface FixtureNode {
  readonly fixtureNode: true;
}

type BarOrientation = "vertical" | "horizontal";
type BarStacked = boolean | "percent" | "diverging";
type PlotHeight = number | { aspect: number };
interface ResponsiveByBreakpoint<T> {
  base: T;
  medium?: T;
  narrow?: T;
}
type Responsive<T> = T | ResponsiveByBreakpoint<T>;
type PaletteName = "categorical" | "sequential" | "diverging";

/** Mirrors the serialisable shape of `BarChartProps` (charts `bar-chart.tsx`). */
interface BarChartFixtureProps extends A11yGroupProps {
  xDataKey?: string;
  barGap?: number;
  stacked?: BarStacked;
  stackGap?: number;
  orientation?: BarOrientation;
  plotHeight?: Responsive<PlotHeight>;
  palette?: PaletteName;
  status?: "loading" | "ready";
  /** @deprecated Use `stackGap`. */
  stackPadding?: number;
  /** @deprecated Use `status`. */
  loading?: boolean;
  children?: FixtureNode;
  onDatapointClick?: (datum: Record<string, unknown>, index: number) => void;
}

/** What context defaults read — in charts, the resolved theme. */
interface FixtureContext {
  readonly compact: boolean;
}

/** Charts' data roles extend the shared target shape. */
interface ChartTarget extends TargetDescriptor {
  readonly role: "dimension" | "measure";
  readonly from: { readonly prop: string } | { readonly part: string; readonly prop: string };
}

const loadingAlias: AliasRow = {
  from: "loading",
  to: "status",
  transform: "loading-to-status",
  since: "5.3.0",
  removeIn: "6.0.0",
};

const BAR_CHART = defineComponent<BarChartFixtureProps, FixtureContext, ChartTarget>()({
  id: "BarChart",
  version: 1,
  label: "Bar chart",
  description: "Compares values across categories.",
  groups: [a11yGroup],
  fields: {
    xDataKey: field.string({ tier: "essential", description: "Category key." }),
    barGap: field.number({ min: 0, max: 1, unit: "fraction" }),
    stacked: field.enum({ values: [false, true, "percent", "diverging"] }),
    stackGap: field.number({
      min: 0,
      unit: "px",
      appliesWhen: { field: "stacked", in: [true, "percent", "diverging"] },
    }),
    orientation: field.enum({ values: ["vertical", "horizontal"] }),
    plotHeight: field.responsive({
      of: field.union({
        of: [
          field.number({ min: 1, unit: "px" }),
          field.object({ fields: { aspect: field.number({ min: 0, required: true }) } }),
        ],
      }),
      breakpoints: ["medium", "narrow"],
      default: (ctx: FixtureContext) => (ctx.compact ? 200 : 260),
    }),
    palette: field.enum({
      values: ["categorical", "sequential", "diverging"],
      default: "categorical",
    }),
    status: field.enum({ values: ["loading", "ready"], tier: "advanced" }),
    stackPadding: field.number({
      default: 4,
      deprecated: { since: "5.2.0", replacement: "stackGap", removeIn: "6.0.0" },
    }),
  },
  codeOnly: ["children", "onDatapointClick"],
  defaults: {
    xDataKey: "name",
    barGap: 0.2,
    orientation: "vertical",
    stacked: false,
    stackGap: 0,
  },
  targets: [
    {
      id: "x",
      label: "Category",
      role: "dimension",
      from: { prop: "xDataKey" },
      min: 1,
      max: 1,
    },
    {
      id: "measure",
      label: "Value",
      role: "measure",
      from: { part: "Bar", prop: "dataKey" },
      min: 1,
      max: null,
    },
  ],
  aliases: [loadingAlias],
  normalize: (props) => props,
});

/**
 * Mirrors `FlowNodeData` (flow `flow-node.tsx`), as React Flow node data:
 * an index signature plus named props. `tone` becomes the shared `status`
 * group, and the header group brings `description`.
 */
interface FlowNodeFixtureData extends Record<string, unknown> {
  title: string;
  subtitle?: string;
  description?: string;
  kind?: string;
  status?: StatusTone;
  icon?: FixtureNode;
  footer?: FixtureNode;
  onActivate?: () => void;
}

/** Flow's ports extend the shared target shape. */
interface PortTarget extends TargetDescriptor {
  readonly direction: "input" | "output";
  readonly side: "left" | "right" | "top" | "bottom";
  readonly accepts?: readonly string[];
}

const FLOW_NODE = defineComponent<FlowNodeFixtureData, unknown, PortTarget>()({
  id: "flow.brand",
  version: 1,
  label: "Flow node",
  groups: [headerGroup, statusGroup],
  fields: {
    // The node's title is required, so it re-declares the header field with
    // `required: true` — the ordinary own-field override.
    title: field.string({ required: true, tier: "essential", description: "Primary label." }),
    kind: field.string({ tier: "advanced", description: "Short type label shown as an eyebrow." }),
  },
  codeOnly: ["icon", "footer", "onActivate"],
  defaults: { status: "neutral" },
  targets: [
    {
      id: "in",
      label: "Input",
      direction: "input",
      side: "left",
      accepts: ["score"],
      min: 0,
      max: 1,
    },
    { id: "out", label: "Output", direction: "output", side: "right", min: 0, max: null },
  ],
  migrate: (input) => ({ ...input }),
});

// ── Type-level acceptance ───────────────────────────────────────────────────

describe("types", () => {
  it("carries the props type and proves both definitions complete", () => {
    expectTypeOf<PropsOf<typeof BAR_CHART>>().toEqualTypeOf<BarChartFixtureProps>();
    expectTypeOf<PropsOf<typeof FLOW_NODE>>().toEqualTypeOf<FlowNodeFixtureData>();
    expectTypeOf<UnaccountedProps<typeof BAR_CHART>>().toEqualTypeOf<never>();
    expectTypeOf<UnaccountedProps<typeof FLOW_NODE>>().toEqualTypeOf<never>();
    expectTypeOf<DefinitionIsComplete<typeof BAR_CHART>>().toEqualTypeOf<true>();
    expectTypeOf<DefinitionIsComplete<typeof FLOW_NODE>>().toEqualTypeOf<true>();
  });

  it("keeps targets and their kind-specific keys", () => {
    expectTypeOf(BAR_CHART.targets[1].max).toEqualTypeOf<null>();
    expectTypeOf(FLOW_NODE.targets[0].side).toEqualTypeOf<"left">();
  });

  it("types resolved props: defaulted keys become required", () => {
    const resolved = resolveProps(BAR_CHART, {} as BarChartFixtureProps);
    expectTypeOf(resolved.barGap).toEqualTypeOf<number>();
    expectTypeOf(resolved.orientation).toEqualTypeOf<BarOrientation>();
    expectTypeOf(resolved.palette).toEqualTypeOf<PaletteName>();
    expectTypeOf(resolved.status).toEqualTypeOf<"loading" | "ready" | undefined>();
  });
});

// ── resolveProps ────────────────────────────────────────────────────────────

describe("resolveProps", () => {
  it("fills in the order user > kind default > group default > context default", () => {
    const resolved = resolveProps(BAR_CHART, { barGap: 0.5 }, { compact: true });
    expect(resolved).toEqual({
      barGap: 0.5, // user
      xDataKey: "name", // kind default
      orientation: "vertical",
      stacked: false,
      stackGap: 0,
      palette: "categorical", // own field default
      plotHeight: 200, // context default
    });
  });

  it("lets a kind default beat a group default", () => {
    const resolved = resolveProps(FLOW_NODE, { title: "Score" });
    expect(resolved).toEqual({ title: "Score", status: "neutral" });
  });

  it("runs context defaults only with a context, and never fills deprecated props", () => {
    const resolved = resolveProps(BAR_CHART, {});
    expect(resolved).not.toHaveProperty("plotHeight");
    expect(resolved).not.toHaveProperty("stackPadding");
    const empty: BarChartFixtureProps = {};
    expect(resolveProps(BAR_CHART, empty, { compact: false }).plotHeight).toBe(260);
  });

  it("returns the same object when nothing needs filling", () => {
    const full = {
      xDataKey: "month",
      barGap: 0.1,
      orientation: "horizontal" as const,
      stacked: true,
      stackGap: 2,
      palette: "sequential" as const,
      plotHeight: 180,
    };
    expect(resolveProps(BAR_CHART, full, { compact: true })).toBe(full);
    const node = { title: "Score", status: "success" as const };
    expect(resolveProps(FLOW_NODE, node)).toBe(node);
  });

  it("does not mutate its input", () => {
    const input = { barGap: 0.3 };
    resolveProps(BAR_CHART, input);
    expect(input).toEqual({ barGap: 0.3 });
  });
});

// ── aliases ─────────────────────────────────────────────────────────────────

describe("applyAliases", () => {
  const rows: AliasRow[] = [
    {
      from: "stackPadding",
      to: "stackGap",
      transform: "identity",
      since: "5.2.0",
      removeIn: "6.0.0",
    },
    {
      from: "numTicks",
      to: "tickCount",
      transform: "identity",
      precedence: "old-wins",
      since: "5.2.0",
      removeIn: "6.0.0",
    },
    {
      from: "loading",
      to: "status",
      transform: "loading-to-status",
      since: "5.3.0",
      removeIn: "6.0.0",
    },
    {
      from: "showValues",
      to: "labels",
      transform: "boolean-to-labels",
      since: "5.3.0",
      removeIn: "6.0.0",
    },
    {
      from: "hideLegend",
      to: "legend",
      transform: "invert-boolean",
      since: "5.3.0",
      removeIn: "6.0.0",
    },
  ];

  it("returns the same object when no old name is present", () => {
    const props = { stackGap: 3, tickCount: 5 };
    expect(applyAliases(rows, props)).toBe(props);
    const withUndefined = { stackPadding: undefined, stackGap: 1 };
    expect(applyAliases(rows, withUndefined)).toBe(withUndefined);
  });

  it("renames, transforms and reports each alias once", () => {
    const onAlias = vi.fn();
    const out = applyAliases(
      rows,
      { stackPadding: 3, loading: true, showValues: false, hideLegend: true },
      onAlias,
    );
    expect(out).toEqual({ stackGap: 3, status: "loading", labels: { show: false }, legend: false });
    expect(onAlias).toHaveBeenCalledTimes(4);
    expect(onAlias.mock.calls.map(([row]) => row.from)).toEqual([
      "stackPadding",
      "loading",
      "showValues",
      "hideLegend",
    ]);
  });

  it("lets the new name win by default when both are passed", () => {
    expect(applyAliases(rows, { stackPadding: 3, stackGap: 7 })).toEqual({ stackGap: 7 });
  });

  it("lets the old name win for an old-wins row", () => {
    expect(applyAliases(rows, { numTicks: 4, tickCount: 9 })).toEqual({ tickCount: 4 });
  });

  it("reads the shorthand as identity, new-wins", () => {
    expect(normalizeAliases({ color: "fill" })).toEqual([
      {
        from: "color",
        to: "fill",
        transform: "identity",
        precedence: "new-wins",
        since: "",
        removeIn: "next major",
      },
    ]);
    expect(applyAliases({ color: "fill" }, { color: "red" })).toEqual({ fill: "red" });
  });

  it("takes a definition as the source", () => {
    expect(applyAliases(BAR_CHART, { loading: false })).toEqual({ status: "ready" });
  });
});

// ── validateProps ───────────────────────────────────────────────────────────

describe("validateProps", () => {
  it("accepts valid input, codeOnly props and the responsive per-breakpoint form", () => {
    const input = {
      barGap: 0.4,
      stacked: "percent",
      plotHeight: { base: 240, narrow: { aspect: 1.5 } },
      accessibleLabel: "Revenue by month",
      onDatapointClick: () => undefined,
    };
    const result = validateProps(BAR_CHART, input);
    expect(result).toEqual({ ok: true, value: input, issues: [] });
  });

  it("reports kinds, enums, ranges and unknown keys, and never throws", () => {
    const result = validateProps(BAR_CHART, {
      barGap: 1.5,
      orientation: "diagonal",
      stacked: "yes",
      xDataKey: 3,
      plotHeight: { base: 0, wide: 300 },
      bogus: true,
    });
    expect(result.ok).toBe(false);
    expect(result.issues.map(({ path, code }) => `${path}:${code}`).sort()).toEqual([
      "barGap:out-of-range",
      "bogus:unknown-prop",
      "orientation:not-in-enum",
      "plotHeight.base:wrong-type",
      "plotHeight.wide:unknown-prop",
      "stacked:not-in-enum",
      "xDataKey:wrong-type",
    ]);
    expect(validateProps(BAR_CHART, "nope")).toEqual({
      ok: false,
      issues: [
        { path: "", code: "not-an-object", message: "The input must be an object of props." },
      ],
    });
  });

  it("warns on deprecated props and old alias names without failing", () => {
    const result = validateProps(BAR_CHART, { stackPadding: 2, loading: true });
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([
      {
        path: "stackPadding",
        code: "deprecated-prop",
        severity: "warning",
        message:
          '"stackPadding" is deprecated since 5.2.0 and will be removed in 6.0.0. Use "stackGap".',
      },
      {
        path: "loading",
        code: "deprecated-prop",
        severity: "warning",
        message: '"loading" is deprecated since 5.3.0 and will be removed in 6.0.0. Use "status".',
      },
    ]);
  });

  it("requires required props and checks group fields the same way as own fields", () => {
    const result = validateProps(
      FLOW_NODE,
      { status: "loud", subtitle: 4 },
      { path: "nodes[0].data" },
    );
    expect(result.ok).toBe(false);
    expect(result.issues.map(({ path, code }) => `${path}:${code}`)).toEqual([
      "nodes[0].data.status:not-in-enum",
      "nodes[0].data.subtitle:wrong-type",
      "nodes[0].data.title:missing-prop",
    ]);
  });
});

// ── completeness ────────────────────────────────────────────────────────────

describe("assertDefinitionComplete", () => {
  it("passes both definitions with example inputs", () => {
    expect(() =>
      assertDefinitionComplete(BAR_CHART, {
        examples: [
          { xDataKey: "month", stacked: true, stackGap: 2 },
          { plotHeight: { base: 300 } },
        ],
      }),
    ).not.toThrow();
    expect(() =>
      assertDefinitionComplete(FLOW_NODE, { examples: [{ title: "Score", status: "warning" }] }),
    ).not.toThrow();
  });

  it("lists every problem it finds", () => {
    const broken = {
      ...FLOW_NODE,
      defaults: undefined,
      targets: [FLOW_NODE.targets[0], FLOW_NODE.targets[0]],
    };
    expect(() => assertDefinitionComplete(broken, { examples: [{}] })).toThrowError(
      [
        'Definition "flow.brand" is incomplete:',
        "- `defaults` is missing.",
        '- Target "in" is declared twice.',
        '- "examples[0].title" is required.',
      ].join("\n"),
    );
  });
});

// ── generators ──────────────────────────────────────────────────────────────

describe("toJsonSchema", () => {
  it("describes the serialisable props of the chart", () => {
    expect(toJsonSchema(BAR_CHART)).toMatchInlineSnapshot(`
      {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "additionalProperties": false,
        "description": "Compares values across categories.",
        "properties": {
          "accessibleDescription": {
            "description": "Accessible description read after the name.",
            "type": "string",
          },
          "accessibleLabel": {
            "description": "Accessible name, when the visible title is missing or not enough.",
            "type": "string",
          },
          "barGap": {
            "default": 0.2,
            "maximum": 1,
            "minimum": 0,
            "type": "number",
          },
          "loading": {
            "deprecated": true,
            "description": "Deprecated: use "status".",
            "type": "boolean",
          },
          "orientation": {
            "default": "vertical",
            "enum": [
              "vertical",
              "horizontal",
            ],
          },
          "palette": {
            "default": "categorical",
            "enum": [
              "categorical",
              "sequential",
              "diverging",
            ],
          },
          "plotHeight": {
            "anyOf": [
              {
                "anyOf": [
                  {
                    "minimum": 1,
                    "type": "number",
                  },
                  {
                    "additionalProperties": false,
                    "properties": {
                      "aspect": {
                        "minimum": 0,
                        "type": "number",
                      },
                    },
                    "required": [
                      "aspect",
                    ],
                    "type": "object",
                  },
                ],
              },
              {
                "additionalProperties": false,
                "properties": {
                  "base": {
                    "anyOf": [
                      {
                        "minimum": 1,
                        "type": "number",
                      },
                      {
                        "additionalProperties": false,
                        "properties": {
                          "aspect": {
                            "minimum": 0,
                            "type": "number",
                          },
                        },
                        "required": [
                          "aspect",
                        ],
                        "type": "object",
                      },
                    ],
                  },
                  "medium": {
                    "anyOf": [
                      {
                        "minimum": 1,
                        "type": "number",
                      },
                      {
                        "additionalProperties": false,
                        "properties": {
                          "aspect": {
                            "minimum": 0,
                            "type": "number",
                          },
                        },
                        "required": [
                          "aspect",
                        ],
                        "type": "object",
                      },
                    ],
                  },
                  "narrow": {
                    "anyOf": [
                      {
                        "minimum": 1,
                        "type": "number",
                      },
                      {
                        "additionalProperties": false,
                        "properties": {
                          "aspect": {
                            "minimum": 0,
                            "type": "number",
                          },
                        },
                        "required": [
                          "aspect",
                        ],
                        "type": "object",
                      },
                    ],
                  },
                },
                "required": [
                  "base",
                ],
                "type": "object",
              },
            ],
          },
          "stackGap": {
            "default": 0,
            "minimum": 0,
            "type": "number",
          },
          "stackPadding": {
            "deprecated": true,
            "type": "number",
          },
          "stacked": {
            "default": false,
            "enum": [
              false,
              true,
              "percent",
              "diverging",
            ],
          },
          "status": {
            "enum": [
              "loading",
              "ready",
            ],
          },
          "xDataKey": {
            "default": "name",
            "description": "Category key.",
            "type": "string",
          },
        },
        "title": "Bar chart",
        "type": "object",
      }
    `);
  });

  it("describes the flow node, with required props and group fields", () => {
    expect(toJsonSchema(FLOW_NODE)).toMatchInlineSnapshot(`
      {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "additionalProperties": false,
        "properties": {
          "description": {
            "description": "Longer supporting text.",
            "type": "string",
          },
          "kind": {
            "description": "Short type label shown as an eyebrow.",
            "type": "string",
          },
          "status": {
            "default": "neutral",
            "description": "Tone of the component's current state.",
            "enum": [
              "neutral",
              "info",
              "success",
              "warning",
              "destructive",
            ],
          },
          "subtitle": {
            "description": "Secondary line under the title.",
            "type": "string",
          },
          "title": {
            "description": "Primary label.",
            "type": "string",
          },
        },
        "required": [
          "title",
        ],
        "title": "Flow node",
        "type": "object",
      }
    `);
  });
});

describe("toSnapshot", () => {
  it("is deterministic and JSON-serialisable", () => {
    const first = JSON.stringify(toSnapshot(BAR_CHART));
    const reordered = {
      ...BAR_CHART,
      fields: Object.fromEntries(Object.entries(BAR_CHART.fields).reverse()),
    };
    expect(JSON.stringify(toSnapshot(reordered))).toBe(first);
    expect(JSON.parse(first)).toEqual(toSnapshot(BAR_CHART));
  });

  it("flattens group fields with provenance and marks context defaults", () => {
    const snapshot = toSnapshot(BAR_CHART) as {
      fields: Record<string, Record<string, unknown>>;
      normalize?: boolean;
      codeOnly: string[];
    };
    expect(snapshot.fields.accessibleLabel?.group).toBe("a11y");
    expect(snapshot.fields.barGap).toMatchObject({ group: null, default: 0.2, unit: "fraction" });
    expect(snapshot.fields.plotHeight?.default).toEqual({ defaultFrom: "context" });
    expect(snapshot.normalize).toBe(true);
    expect(snapshot.codeOnly).toEqual(["children", "onDatapointClick"]);
  });

  it("records an own field that overrides a group field", () => {
    expect(toSnapshot(FLOW_NODE)).toMatchInlineSnapshot(`
      {
        "aliases": [],
        "codeOnly": [
          "footer",
          "icon",
          "onActivate",
        ],
        "fields": {
          "description": {
            "description": "Longer supporting text.",
            "group": "header",
            "kind": "string",
            "tier": "advanced",
          },
          "kind": {
            "description": "Short type label shown as an eyebrow.",
            "group": null,
            "kind": "string",
            "tier": "advanced",
          },
          "status": {
            "default": "neutral",
            "description": "Tone of the component's current state.",
            "group": "status",
            "kind": "enum",
            "tier": "essential",
            "values": [
              "neutral",
              "info",
              "success",
              "warning",
              "destructive",
            ],
          },
          "subtitle": {
            "description": "Secondary line under the title.",
            "group": "header",
            "kind": "string",
            "tier": "advanced",
          },
          "title": {
            "description": "Primary label.",
            "group": null,
            "kind": "string",
            "overrides": "header",
            "required": true,
            "tier": "essential",
          },
        },
        "groups": [
          "header",
          "status",
        ],
        "id": "flow.brand",
        "label": "Flow node",
        "migrate": true,
        "targets": [
          {
            "accepts": [
              "score",
            ],
            "direction": "input",
            "id": "in",
            "label": "Input",
            "max": 1,
            "min": 0,
            "side": "left",
          },
          {
            "direction": "output",
            "id": "out",
            "label": "Output",
            "max": null,
            "min": 0,
            "side": "right",
          },
        ],
        "version": 1,
      }
    `);
  });
});

// ── warnOnce ────────────────────────────────────────────────────────────────

describe("warnOnce", () => {
  afterEach(() => {
    resetWarnOnce();
    vi.restoreAllMocks();
  });

  it("warns once per key", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    warnOnce("BarChart.loading", "[BarChart] loading is deprecated.");
    warnOnce("BarChart.loading", "[BarChart] loading is deprecated.");
    warnOnce("BarChart.numTicks", "[BarChart] numTicks is deprecated.");
    expect(warn).toHaveBeenCalledTimes(2);
    resetWarnOnce();
    warnOnce("BarChart.loading", "[BarChart] loading is deprecated.");
    expect(warn).toHaveBeenCalledTimes(3);
  });

  it("is silent in production", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubEnv("NODE_ENV", "production");
    try {
      warnOnce("prod", "never shown");
    } finally {
      vi.unstubAllEnvs();
    }
    expect(warn).not.toHaveBeenCalled();
  });
});
