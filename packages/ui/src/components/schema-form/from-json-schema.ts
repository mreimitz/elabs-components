/**
 * from-json-schema.ts — `fromJsonSchema()`: the narrow, documented JSON
 * Schema → `FormSpec` adapter (issue #22, maintainer ruling 2026-09-01).
 *
 * Many consumers already have their config described as JSON Schema (an
 * OpenAPI request body, a connector manifest). This maps ONLY the common
 * subset such schemas actually use onto `SchemaForm`'s `FieldSpec`
 * vocabulary:
 *
 *   { type: "string" }                          → StringFieldSpec
 *   { type: "string", enum: [...] }              → EnumFieldSpec
 *   { type: "number" | "integer" }                → NumberFieldSpec / IntegerFieldSpec
 *   { type: "boolean" }                            → BooleanFieldSpec
 *   { type: "array", items: { type: "string" } }    → ListFieldSpec
 *   { type: "object", properties: {...} }            → GroupFieldSpec
 *                                                        (variant: "advanced",
 *                                                        one always-open branch)
 *
 * `title`/`description` map to `label`/`description`; `required` (the
 * enclosing object schema's array of property names) maps to `required:
 * true`; `default` maps when it is type-compatible; `minLength`/`maxLength`/
 * `pattern`/`minimum`/`maximum`/`minItems`/`maxItems` map to their FieldSpec
 * equivalents. `format` maps only the four values `StringFieldSpec` itself
 * understands (`email`/`uri`/`date`/`date-time`) — any other `format` value
 * (`"binary"`, `"password"`, a custom one) is ignored predictably, the same
 * way an unknown JSON Schema `format` is defined to be advisory, not
 * validating.
 *
 * Deliberately NOT a general draft-07/2020-12 implementation (the maintainer
 * ruling's explicit narrow option) — this module does not resolve `$ref` and
 * does not implement the `allOf`/`oneOf`/`anyOf`/`not` combinators. Those
 * keywords change what a schema actually MEANS, and approximating them would
 * risk producing a field that looks plausible but is wrong (e.g. rendering a
 * `$ref`'d object as an empty string field) — silently wrong is exactly what
 * this adapter must never be. So `fromJsonSchema()` REFUSES: any of those
 * five keywords, found anywhere in the input (top-level or nested inside a
 * property/items schema), throws `UnsupportedJsonSchemaError` naming the
 * keyword and its JSON-Pointer-style path. Pre-resolve/inline that part of
 * the schema before calling `fromJsonSchema()`, or hand-write the affected
 * `FieldSpec`.
 *
 * A property whose `type` this subset does not cover (e.g. `"null"`, a
 * JSON-Schema-2020-12 array-of-types, an array of non-string items, an
 * object schema with no `properties`) is DROPPED from the result —
 * predictable and non-fatal, the same lenient-parse philosophy
 * `normalizeFormSpec` already uses for the render path, because omitting one
 * field is recoverable in a way a mis-mapped `$ref`/combinator is not.
 *
 * Widening this subset later (more `format`s, multi-select array items,
 * `$ref` resolution) is an additive, non-breaking change to this one
 * function — see issue #22's "worth having alongside" list.
 */

import type { FieldSpec, FormSpec } from "./schema-form-spec";

/**
 * The JSON Schema keywords this adapter refuses to approximate. Each changes
 * a schema's actual shape in a way a narrow field-by-field mapping cannot
 * safely ignore.
 */
const UNSUPPORTED_COMBINATORS = ["$ref", "allOf", "oneOf", "anyOf", "not"] as const;

/**
 * Thrown by `fromJsonSchema()` when the input uses a JSON Schema keyword
 * outside its documented subset (see this module's doc comment) — never
 * silently mismapped.
 */
export class UnsupportedJsonSchemaError extends Error {
  constructor(keyword: string, path: string) {
    super(
      `fromJsonSchema: unsupported JSON Schema keyword "${keyword}" at "${path}". ` +
        "fromJsonSchema() maps only a narrow, documented subset (string/number/" +
        "integer/boolean/enum/array-of-string/object) and does not resolve " +
        "$ref or implement allOf/oneOf/anyOf/not. Pre-resolve or inline this " +
        "part of the schema before calling fromJsonSchema(), or build the " +
        "affected FieldSpec by hand.",
    );
    this.name = "UnsupportedJsonSchemaError";
  }
}

type JsonSchemaObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is JsonSchemaObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Recursively asserts none of `UNSUPPORTED_COMBINATORS` appears anywhere under `schema`. */
function assertSupported(schema: unknown, path: string): void {
  if (!isPlainObject(schema)) return;
  for (const keyword of UNSUPPORTED_COMBINATORS) {
    if (keyword in schema) throw new UnsupportedJsonSchemaError(keyword, path);
  }
  if (isPlainObject(schema.properties)) {
    for (const [key, sub] of Object.entries(schema.properties)) {
      assertSupported(sub, `${path}/properties/${key}`);
    }
  }
  if ("items" in schema) {
    assertSupported(schema.items, `${path}/items`);
  }
}

/** `values` narrowed to `string[]`, or `null` if any entry isn't a string. */
function stringArray(values: unknown): string[] | null {
  if (!Array.isArray(values) || !values.every((v) => typeof v === "string")) return null;
  return values as string[];
}

const SUPPORTED_STRING_FORMATS = new Set(["email", "uri", "date", "date-time"]);

function mapProperty(name: string, schema: unknown, required: boolean): FieldSpec | null {
  if (!isPlainObject(schema)) return null;

  const title = typeof schema.title === "string" ? schema.title : undefined;
  const description = typeof schema.description === "string" ? schema.description : undefined;
  const base = {
    name,
    ...(title !== undefined ? { label: title } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(required ? { required: true as const } : {}),
  };

  switch (schema.type) {
    case "string": {
      const enumValues = stringArray(schema.enum);
      if (enumValues) {
        return {
          type: "enum",
          ...base,
          options: enumValues,
          ...(typeof schema.default === "string" ? { default: schema.default } : {}),
        };
      }
      const format =
        typeof schema.format === "string" && SUPPORTED_STRING_FORMATS.has(schema.format)
          ? (schema.format as "email" | "uri" | "date" | "date-time")
          : undefined;
      return {
        type: "string",
        ...base,
        ...(format !== undefined ? { format } : {}),
        ...(Number.isInteger(schema.minLength) && (schema.minLength as number) >= 0
          ? { minLength: schema.minLength as number }
          : {}),
        ...(Number.isInteger(schema.maxLength) && (schema.maxLength as number) >= 0
          ? { maxLength: schema.maxLength as number }
          : {}),
        ...(typeof schema.pattern === "string" ? { pattern: schema.pattern } : {}),
        ...(typeof schema.default === "string" ? { default: schema.default } : {}),
      };
    }

    case "number": {
      const validDefault = typeof schema.default === "number";
      return {
        type: "number",
        ...base,
        ...(typeof schema.minimum === "number" ? { min: schema.minimum } : {}),
        ...(typeof schema.maximum === "number" ? { max: schema.maximum } : {}),
        ...(validDefault ? { default: schema.default as number } : {}),
      };
    }

    case "integer": {
      const validDefault = typeof schema.default === "number" && Number.isInteger(schema.default);
      return {
        type: "integer",
        ...base,
        ...(typeof schema.minimum === "number" ? { min: schema.minimum } : {}),
        ...(typeof schema.maximum === "number" ? { max: schema.maximum } : {}),
        ...(validDefault ? { default: schema.default as number } : {}),
      };
    }

    case "boolean":
      return {
        type: "boolean",
        ...base,
        ...(typeof schema.default === "boolean" ? { default: schema.default } : {}),
      };

    case "array": {
      // Only array-of-string is in the documented subset (issue #22's
      // "array-of-string" entry) — an array of numbers/objects/booleans, or
      // one with no `items` schema at all, is dropped predictably rather than
      // guessed at.
      if (!isPlainObject(schema.items) || schema.items.type !== "string") return null;
      return {
        type: "list",
        ...base,
        ...(Number.isInteger(schema.minItems) && (schema.minItems as number) >= 0
          ? { minItems: schema.minItems as number }
          : {}),
        ...(Number.isInteger(schema.maxItems) && (schema.maxItems as number) >= 0
          ? { maxItems: schema.maxItems as number }
          : {}),
      };
    }

    case "object": {
      const nested = mapProperties(schema);
      if (nested.length === 0) return null; // an empty/property-less object has nothing to render
      return {
        type: "group",
        name,
        ...(title !== undefined ? { label: title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(required ? { required: true } : {}),
        variant: "advanced",
        groups: [{ key: name, label: title ?? name, fields: nested }],
      };
    }

    default:
      // An unrecognized/absent `type` (JSON-Schema-2020-12 type arrays,
      // `"null"`, a schema with no `type` at all) — outside the documented
      // subset, dropped predictably rather than mismapped.
      return null;
  }
}

/** Maps every property of an OBJECT schema onto `FieldSpec[]`, dropping unsupported ones. */
function mapProperties(objectSchema: JsonSchemaObject): FieldSpec[] {
  const properties = isPlainObject(objectSchema.properties) ? objectSchema.properties : {};
  const required = stringArray(objectSchema.required) ?? [];
  const fields: FieldSpec[] = [];
  for (const [name, propertySchema] of Object.entries(properties)) {
    const field = mapProperty(name, propertySchema, required.includes(name));
    if (field) fields.push(field);
  }
  return fields;
}

export interface FromJsonSchemaOptions {
  /** `FormSpec.formName` — required; JSON Schema has no equivalent stable identifier. */
  formName: string;
  /** Overrides the mapped `schema.title`. */
  title?: string;
  /** Overrides the mapped `schema.description`. */
  description?: string;
  /** `FormSpec.submitLabel` — JSON Schema has no equivalent. */
  submitLabel?: string;
}

/**
 * Maps a JSON Schema OBJECT schema (an OpenAPI request body, a connector
 * manifest) onto a `FormSpec`, using only the documented subset described in
 * this module's doc comment. Throws `UnsupportedJsonSchemaError` if `schema`
 * (at any depth) uses `$ref`/`allOf`/`oneOf`/`anyOf`/`not`, or if the
 * top-level schema is not an object schema — never silently mismapped. A
 * property whose shape falls outside the subset is dropped, not thrown on.
 */
export function fromJsonSchema(schema: unknown, options: FromJsonSchemaOptions): FormSpec {
  assertSupported(schema, "#");
  if (!isPlainObject(schema) || schema.type !== "object") {
    throw new UnsupportedJsonSchemaError('type (expected "object" at the top level)', "#");
  }
  return {
    formName: options.formName,
    title: options.title ?? (typeof schema.title === "string" ? schema.title : undefined),
    description:
      options.description ??
      (typeof schema.description === "string" ? schema.description : undefined),
    submitLabel: options.submitLabel,
    fields: mapProperties(schema),
  };
}
