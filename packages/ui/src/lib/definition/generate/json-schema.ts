/**
 * json-schema — a definition as JSON Schema (draft 2020-12), for tools and
 * agents that validate or complete props without this library.
 *
 * Carries enums, bounds, value defaults (context defaults are left out, as
 * they depend on the theme), `deprecated: true` for deprecated props and old
 * alias names, and `additionalProperties: false`. `codeOnly` props are
 * omitted: JSON cannot carry them. A responsive field is
 * `anyOf [T, { base: T, <breakpoint>?: T }]`.
 *
 * React-free; no component imports it.
 */

import type { AnyComponentDefinition } from "../component-definition";
import { planOf } from "../effective-fields";
import { isContextDefault, type AnyField } from "../field";

/** A JSON Schema document or sub-schema. */
export type JsonSchema = { [keyword: string]: unknown };

const JSON_SCHEMA_DIALECT = "https://json-schema.org/draft/2020-12/schema";

function sorted(keys: Iterable<string>): string[] {
  return [...keys].sort();
}

function valueSchema(f: AnyField): JsonSchema {
  switch (f.kind) {
    case "string": {
      const s: JsonSchema = { type: "string" };
      if (f.min !== undefined) s.minLength = f.min;
      if (f.max !== undefined) s.maxLength = f.max;
      return s;
    }
    case "number":
    case "integer": {
      const s: JsonSchema = { type: f.kind };
      if (f.min !== undefined) s.minimum = f.min;
      if (f.max !== undefined) s.maximum = f.max;
      return s;
    }
    case "boolean":
      return { type: "boolean" };
    case "enum":
      return { enum: [...f.values] };
    case "color":
      return { type: "string" };
    case "responsive": {
      const item = fieldSchema(f.of);
      const properties: JsonSchema = { base: item };
      for (const bp of f.breakpoints) properties[bp] = item;
      return {
        anyOf: [
          item,
          { type: "object", properties, required: ["base"], additionalProperties: false },
        ],
      };
    }
    case "object": {
      const properties: JsonSchema = {};
      const required: string[] = [];
      for (const key of sorted(Object.keys(f.fields))) {
        const sub = f.fields[key];
        if (!sub) continue;
        properties[key] = fieldSchema(sub);
        if (sub.required) required.push(key);
      }
      const s: JsonSchema = { type: "object", properties };
      if (required.length) s.required = required;
      s.additionalProperties = f.open === true;
      return s;
    }
    case "array": {
      const s: JsonSchema = { type: "array", items: fieldSchema(f.of) };
      if (f.min !== undefined) s.minItems = f.min;
      if (f.max !== undefined) s.maxItems = f.max;
      return s;
    }
    case "union":
      return { anyOf: f.of.map(fieldSchema) };
  }
}

function annotate(
  f: AnyField,
  schema: JsonSchema,
  defaultValue: { has: boolean; value?: unknown },
): JsonSchema {
  const s: JsonSchema = f.nullable ? { anyOf: [schema, { type: "null" }] } : { ...schema };
  if (f.description) s.description = f.description;
  if (defaultValue.has) s.default = defaultValue.value;
  if (f.deprecated) s.deprecated = true;
  return s;
}

function ownValueDefault(f: AnyField): { has: boolean; value?: unknown } {
  return f.default === undefined || isContextDefault(f.default)
    ? { has: false }
    : { has: true, value: f.default };
}

/** One field's schema (used for nested fields; top-level props also get the kind's defaults). */
function fieldSchema(f: AnyField): JsonSchema {
  return annotate(f, valueSchema(f), ownValueDefault(f));
}

/** The JSON Schema for a definition's serialisable props. Deterministic: keys are sorted. */
export function toJsonSchema(def: AnyComponentDefinition): JsonSchema {
  const plan = planOf(def);
  const properties: JsonSchema = {};
  const required: string[] = [];

  for (const f of plan.fields) {
    const has = f.hasValueDefault && !f.field.deprecated;
    properties[f.key] = annotate(f.field, valueSchema(f.field), { has, value: f.valueDefault });
    if (f.field.required && !f.field.deprecated) required.push(f.key);
  }
  for (const row of plan.aliases) {
    if (Object.hasOwn(properties, row.from)) continue;
    const target = plan.byKey.get(row.to);
    const schema: JsonSchema =
      row.transform === "identity" && target
        ? { ...valueSchema(target.field) }
        : { type: "boolean" };
    schema.description = `Deprecated: use "${row.to}".`;
    schema.deprecated = true;
    properties[row.from] = schema;
  }

  const ordered: JsonSchema = {};
  for (const key of sorted(Object.keys(properties))) ordered[key] = properties[key];

  const schema: JsonSchema = { $schema: JSON_SCHEMA_DIALECT, title: def.label };
  if (def.description) schema.description = def.description;
  schema.type = "object";
  schema.properties = ordered;
  if (required.length) schema.required = sorted(required);
  schema.additionalProperties = false;
  return schema;
}
