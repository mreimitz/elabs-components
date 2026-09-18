/**
 * schema.ts — the A2UI surface as a JSON Schema (draft 2020-12), built from the
 * catalog so editors, structured-output modes and JSON-Schema validators see the
 * SAME contract `validateA2uiSurface` enforces. Published as
 * `@elabs-ai/components-ai/a2ui/schema.json` and printed by `brand-ui a2ui schema`.
 */
import {
  A2UI_COMMON_PROPS,
  A2UI_VERSION,
  type A2uiCatalogSchema,
  type A2uiCatalogTypeSchema,
  type A2uiPropSchema,
} from "./spec";

export const A2UI_SURFACE_SCHEMA_ID =
  "https://github.com/mreimitz/elabs-components/packages/ai/schemas/a2ui-surface.v1.schema.json";

type JsonSchema = Record<string, unknown>;

function propSchema(p: A2uiPropSchema): JsonSchema {
  const base: JsonSchema = {};
  if (p.description) base.description = p.description;
  if (p.default !== undefined) base.default = p.default;
  if (p.enum) return { ...base, enum: p.enum };
  switch (p.type) {
    case "string":
    case "number":
    case "boolean":
    case "array":
    case "object":
      return { ...base, type: p.type };
    case "node":
      return {
        ...base,
        anyOf: [
          { type: "string" },
          { type: "number" },
          { $ref: "#/$defs/element" },
          { type: "array", items: { $ref: "#/$defs/node" } },
        ],
      };
    default:
      return base;
  }
}

function elementSchema(type: string, entry: A2uiCatalogTypeSchema): JsonSchema {
  const props = entry.builtin ? entry.props : { ...A2UI_COMMON_PROPS, ...entry.props };
  const required = Object.entries(entry.props)
    .filter(([, p]) => p.required)
    .map(([name]) => name);
  const properties: JsonSchema = {
    type: { const: type },
    id: { type: "string" },
    props: {
      type: "object",
      properties: Object.fromEntries(Object.entries(props).map(([n, p]) => [n, propSchema(p)])),
      ...(required.length ? { required } : {}),
      additionalProperties: false,
    },
    on: {
      type: "object",
      properties: Object.fromEntries(
        Object.keys(entry.events).map((ev) => [ev, { $ref: "#/$defs/action" }]),
      ),
      additionalProperties: false,
    },
  };
  if (entry.children) properties.children = { type: "array", items: { $ref: "#/$defs/node" } };
  return {
    type: "object",
    ...(entry.summary ? { description: entry.summary } : {}),
    properties,
    required: required.length ? ["type", "props"] : ["type"],
    additionalProperties: false,
  };
}

/** Build the JSON Schema document for `catalog`. Deterministic: sorted types. */
export function buildA2uiSurfaceSchema(catalog: A2uiCatalogSchema): JsonSchema {
  const types = Object.keys(catalog).sort();
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: A2UI_SURFACE_SCHEMA_ID,
    title: "A2UI surface v1 (brand-ui)",
    description:
      "An agent-designed screen as data: a tree of brand-ui catalog nodes. Every `type` is a catalog entry, props are checked per type, and `on` binds catalog events to host actions. Text is a plain string child.",
    type: "object",
    properties: {
      a2ui: { const: A2UI_VERSION },
      title: { type: "string", description: "Accessible name of the surface region." },
      root: { $ref: "#/$defs/node" },
    },
    required: ["a2ui", "root"],
    additionalProperties: false,
    $defs: {
      action: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, description: "The host-side verb." },
          payload: { description: "Free JSON attached to the action." },
        },
        required: ["name"],
        additionalProperties: false,
      },
      node: { anyOf: [{ type: "string" }, { $ref: "#/$defs/element" }] },
      element: { oneOf: types.map((t) => ({ $ref: `#/$defs/${t}` })) },
      ...Object.fromEntries(types.map((t) => [t, elementSchema(t, catalog[t]!)])),
    },
  };
}
