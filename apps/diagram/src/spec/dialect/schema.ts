/**
 * JSON Schema (draft 2020-12) for the dialect's authoring form. Entity
 * fragments come from the ui definition base (toJsonSchema); recursion, the
 * flow shorthand, style maps and the position rule are added here by hand.
 * React-free.
 */
import { toJsonSchema, type JsonSchema } from "@elabs-ai/components-ui/definition";
import { FLOW_DEF, NODE_DEF, ROOT_DEF, STYLE_DEF, ZONE_DEF } from "./definitions";
import { ARROW_PATTERN, ID_SOURCE } from "./ids";

type Def = Parameters<typeof toJsonSchema>[0];

// P4: library gap — toJsonSchema has no fragment mode; $schema/title are stripped here.
/** A definition's schema as a $defs entry: no $schema/title (only valid at the root). */
function fragment(def: Def): JsonSchema {
  const { $schema: _schema, title: _title, ...rest } = toJsonSchema(def);
  return rest;
}

function props(schema: JsonSchema): Record<string, JsonSchema> {
  return schema.properties as Record<string, JsonSchema>;
}

// P4: library gap — field.string has no pattern; the id grammar is added here.
function withIdPattern(schema: JsonSchema): JsonSchema {
  const all = props(schema);
  return { ...schema, properties: { ...all, id: { ...all.id, pattern: `^${ID_SOURCE}$` } } };
}

function withoutPosition(schema: JsonSchema): JsonSchema {
  const { position: _p, ...rest } = props(schema);
  return { ...schema, properties: rest };
}

export function buildArchSchema(): JsonSchema {
  const node = withIdPattern(fragment(NODE_DEF));
  const zone = withIdPattern(fragment(ZONE_DEF));
  const flowObject = fragment(FLOW_DEF);

  // P4: library gap — no recursive field kind; children point back at $defs by hand.
  const zoneWith = (zoneRef: string, nodeRef: string, base: JsonSchema): JsonSchema => ({
    ...base,
    properties: {
      ...props(base),
      children: {
        type: "array",
        description: "Nested zones and nodes.",
        items: { anyOf: [{ $ref: zoneRef }, { $ref: nodeRef }] },
      },
    },
  });

  // P4: library gap — no string pattern / patternProperties; the a -> b shorthand is written here.
  const { from: _f, to: _t, direction: _d, ...shorthandProps } = props(flowObject);
  const flowShorthandValue: JsonSchema = {
    type: "object",
    properties: shorthandProps,
    additionalProperties: false,
  };
  const flowItem: JsonSchema = {
    anyOf: [
      {
        type: "string",
        pattern: ARROW_PATTERN,
        description: "a -> b, a <- b, a <-> b",
      },
      {
        type: "object",
        minProperties: 1,
        maxProperties: 1,
        patternProperties: {
          [ARROW_PATTERN]: {
            anyOf: [{ type: "null" }, { type: "string" }, { $ref: "#/$defs/flowShorthandValue" }],
          },
        },
        additionalProperties: false,
      },
      { $ref: "#/$defs/flowObject" },
    ],
  };

  const root = toJsonSchema(ROOT_DEF);
  const rootProps = props(root);
  const { items: _zi, ...zonesBase } = rootProps.zones as JsonSchema;
  const { items: _ni, ...nodesBase } = rootProps.nodes as JsonSchema;

  return {
    ...root,
    title: "brand-ui architecture diagram (dialect v0)",
    properties: {
      ...rootProps,
      zones: zonesBase,
      nodes: nodesBase,
      flows: { type: "array", items: { $ref: "#/$defs/flowItem" } },
      // P4: library gap — no map-of field kind.
      styles: {
        type: "object",
        additionalProperties: { $ref: "#/$defs/style" },
      },
    },
    // P4: library gap — appliesWhen is not emitted as if/then; the position rule is written here.
    if: { required: ["layout"], properties: { layout: { const: "manual" } } },
    then: {
      properties: {
        zones: { type: "array", items: { $ref: "#/$defs/zone" } },
        nodes: { type: "array", items: { $ref: "#/$defs/node" } },
      },
    },
    else: {
      properties: {
        zones: { type: "array", items: { $ref: "#/$defs/zoneAuto" } },
        nodes: { type: "array", items: { $ref: "#/$defs/nodeAuto" } },
      },
    },
    $defs: {
      zone: zoneWith("#/$defs/zone", "#/$defs/node", zone),
      zoneAuto: zoneWith("#/$defs/zoneAuto", "#/$defs/nodeAuto", withoutPosition(zone)),
      node,
      nodeAuto: withoutPosition(node),
      flowItem,
      flowObject,
      flowShorthandValue,
      style: fragment(STYLE_DEF),
    },
  };
}
