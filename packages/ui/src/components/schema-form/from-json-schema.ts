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
 *   { type: "array", items: { type: "string" } }    → ListFieldSpec (free text)
 *   { type: "array",
 *     items: { type: "string", enum: [...] } }       → MultiEnumFieldSpec
 *                                                        (a CONSTRAINED array
 *                                                        item schema maps onto
 *                                                        the field type that
 *                                                        actually enforces the
 *                                                        constraint — see
 *                                                        "Constraint keywords"
 *                                                        below for why this
 *                                                        one keyword IS read)
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
 * CONSTRAINT KEYWORDS this subset does not read: `const`, `if`/`then`/`else`,
 * `dependentSchemas`, `dependentRequired`, `additionalProperties`,
 * `patternProperties`, `propertyNames`, `contains`, `multipleOf`,
 * `exclusiveMinimum`/`exclusiveMaximum`, `uniqueItems`. These are
 * READ-IGNORED, not refused — unlike `$ref`/`allOf`/`oneOf`/`anyOf`/`not`,
 * none of them changes what TYPE a property maps to, so ignoring one never
 * produces a wrongly-shaped field. But ignoring one DOES widen what the
 * rendered form accepts relative to the source schema (a `const`-pinned
 * property renders as an ordinary editable field, not a fixed one; a
 * `multipleOf`-constrained number accepts any value in range). This is the
 * one place `fromJsonSchema()` is honestly silently-permissive rather than
 * silently-wrong or refusing — call it out in review when a schema leans on
 * one of these keywords for validation the mapped form will not enforce.
 * `items.enum` is the one exception among these: a constrained array-item
 * schema is common enough (and cheap enough to map faithfully) that it reads
 * `items.enum` and maps onto `MultiEnumFieldSpec` — see the table above —
 * rather than joining this ignore list and widening into a free-text
 * `ListFieldSpec`.
 *
 * Widening this subset later (more `format`s, `$ref` resolution) is an
 * additive, non-breaking change to this one function — see issue #22's
 * "worth having alongside" list.
 */

import type { FieldSpec, FormSpec, FormValues } from "./schema-form-spec";

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

      // A CONSTRAINED item schema (`items.enum`) is a multi-select from a
      // fixed option list, not free text — map it onto the FieldSpec that
      // actually enforces that constraint (`multi-enum`) rather than
      // relaxing it into an unconstrained `list` (fix-round-1, issue #22: a
      // validator probe found `{type:'array', items:{type:'string',
      // enum:[...]}}` was silently widening to free text). `minItems`/
      // `maxItems` have no `multi-enum` equivalent and are dropped here —
      // documented in this module's doc comment alongside the other
      // constraint keywords this subset does not enforce.
      const itemEnum = stringArray(schema.items.enum);
      if (itemEnum) {
        const enumDefault = stringArray(schema.default);
        return {
          type: "multi-enum",
          ...base,
          options: itemEnum,
          ...(enumDefault && enumDefault.every((v) => itemEnum.includes(v))
            ? { default: enumDefault }
            : {}),
        };
      }

      const listDefault = stringArray(schema.default);
      return {
        type: "list",
        ...base,
        ...(Number.isInteger(schema.minItems) && (schema.minItems as number) >= 0
          ? { minItems: schema.minItems as number }
          : {}),
        ...(Number.isInteger(schema.maxItems) && (schema.maxItems as number) >= 0
          ? { maxItems: schema.maxItems as number }
          : {}),
        ...(listDefault ? { default: listDefault } : {}),
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

/**
 * Reconstructs the NESTED JSON object shape that `fromJsonSchema()`'s
 * `{ type: "object", properties: {...} }` mapping flattens away (PR #119
 * review thread 3, P1). `SchemaForm` stores every field's value in one flat
 * `FormValues` map keyed by BARE property name (`GroupFieldSpec` — see the
 * "no notion of an active branch" comment on `schema-form-spec.ts`'s
 * `GroupFieldSpec` — has no value slot of its own), so a form built from a
 * nested schema like `{ address: { properties: { city, zip } } }` submits
 * `{ city, zip }` instead of the advertised `{ address: { city, zip } }`.
 *
 * Call this (instead of reading `effectiveValues`/`onSubmit`'s payload
 * directly) when the schema passed to `fromJsonSchema()` had nested
 * `"object"` properties and the caller needs the request body back in its
 * original shape — e.g. `SchemaFormTestAction`'s `onTest` or a submit
 * handler that forwards the payload to the API the schema describes.
 *
 * Walks `spec.fields` and, for each `group` field this adapter produced
 * (always `variant: "advanced"`, always exactly one branch — see
 * `mapProperty`'s `"object"` case), recurses into `groups[0].fields` and
 * nests the result under that group's own `name` instead of splicing its
 * children into the top level.
 *
 * Two known, out-of-scope limits (see the reply on review thread 3):
 *  1. Two properties at DIFFERENT nesting depths that happen to share a bare
 *     name (`{ name }` at the top level and `{ address: { name } }`) collide
 *     in the flat `FormValues` map itself, upstream of this function — this
 *     function cannot recover data `SchemaForm` never kept separate.
 *  2. A nested object's own `required` flag (`GroupFieldSpec.required`) is
 *     mapped but never validated anywhere in `schema-form-spec.ts`'s
 *     `collectValidatableFields` — fixing that touches a file outside this
 *     unit's scope fence and is called out, unfixed, in the PR review reply.
 */
export function jsonSchemaRequestBody(spec: FormSpec, values: FormValues): Record<string, unknown> {
  return collectRequestBody(spec.fields, values);
}

function collectRequestBody(fields: FieldSpec[], values: FormValues): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.type === "group") {
      // `fromJsonSchema()` only ever emits a single-branch `"advanced"`
      // group per nested object (`mapProperty`'s `"object"` case) — nest
      // the branch's reconstructed values under the group's own name.
      const branch = field.groups[0];
      if (branch) body[field.name] = collectRequestBody(branch.fields, values);
      continue;
    }
    const value = values[field.name];
    if (value !== undefined) body[field.name] = value;
  }
  return body;
}
