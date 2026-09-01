import { describe, expect, it } from "vitest";
import { fromJsonSchema, UnsupportedJsonSchemaError } from "./from-json-schema";
import type {
  BooleanFieldSpec,
  EnumFieldSpec,
  GroupFieldSpec,
  IntegerFieldSpec,
  ListFieldSpec,
  NumberFieldSpec,
  StringFieldSpec,
} from "./schema-form-spec";

describe("fromJsonSchema — documented subset", () => {
  it("maps a string property, carrying title/description/required/format/length/pattern/default", () => {
    const form = fromJsonSchema(
      {
        type: "object",
        properties: {
          name: {
            type: "string",
            title: "Full name",
            description: "As it appears on your ID",
            minLength: 1,
            maxLength: 80,
            pattern: "^[A-Za-z ]+$",
            default: "Ada Lovelace",
          },
          email: { type: "string", format: "email" },
          weird: { type: "string", format: "binary" },
        },
        required: ["name"],
      },
      { formName: "profile" },
    );

    expect(form.formName).toBe("profile");
    expect(form.fields).toHaveLength(3);

    const name = form.fields[0] as StringFieldSpec;
    expect(name).toMatchObject({
      type: "string",
      name: "name",
      label: "Full name",
      description: "As it appears on your ID",
      required: true,
      minLength: 1,
      maxLength: 80,
      pattern: "^[A-Za-z ]+$",
      default: "Ada Lovelace",
    });

    const email = form.fields[1] as StringFieldSpec;
    expect(email.format).toBe("email");
    expect(email.required).toBeUndefined();

    // An unsupported `format` value is ignored predictably, not passed through.
    const weird = form.fields[2] as StringFieldSpec;
    expect(weird.format).toBeUndefined();
  });

  it("maps a string enum to an EnumFieldSpec", () => {
    const form = fromJsonSchema(
      {
        type: "object",
        properties: {
          plan: { type: "string", enum: ["free", "pro", "enterprise"], default: "free" },
        },
      },
      { formName: "f" },
    );
    const plan = form.fields[0] as EnumFieldSpec;
    expect(plan.type).toBe("enum");
    expect(plan.options).toEqual(["free", "pro", "enterprise"]);
    expect(plan.default).toBe("free");
  });

  it("maps number and integer properties independently, each with its own literal `type`", () => {
    const form = fromJsonSchema(
      {
        type: "object",
        properties: {
          rate: { type: "number", minimum: 0, maximum: 1, default: 0.5 },
          retries: { type: "integer", minimum: 0, maximum: 10, default: 3 },
          // A non-integer default on an integer property is dropped, not coerced.
          badRetries: { type: "integer", default: 1.5 },
        },
      },
      { formName: "f" },
    );
    const rate = form.fields[0] as NumberFieldSpec;
    expect(rate).toMatchObject({ type: "number", min: 0, max: 1, default: 0.5 });

    const retries = form.fields[1] as IntegerFieldSpec;
    expect(retries).toMatchObject({ type: "integer", min: 0, max: 10, default: 3 });

    const badRetries = form.fields[2] as IntegerFieldSpec;
    expect(badRetries.type).toBe("integer");
    expect(badRetries.default).toBeUndefined();
  });

  it("maps a boolean property", () => {
    const form = fromJsonSchema(
      { type: "object", properties: { enabled: { type: "boolean", default: true } } },
      { formName: "f" },
    );
    const enabled = form.fields[0] as BooleanFieldSpec;
    expect(enabled).toMatchObject({ type: "boolean", default: true });
  });

  it("maps an array-of-string property to a ListFieldSpec, and drops a non-string-item array", () => {
    const form = fromJsonSchema(
      {
        type: "object",
        properties: {
          tags: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5 },
          scores: { type: "array", items: { type: "number" } },
        },
      },
      { formName: "f" },
    );
    expect(form.fields).toHaveLength(1);
    const tags = form.fields[0] as ListFieldSpec;
    expect(tags).toMatchObject({ type: "list", minItems: 1, maxItems: 5 });
  });

  it("maps a nested object property to a single-branch advanced GroupFieldSpec", () => {
    const form = fromJsonSchema(
      {
        type: "object",
        properties: {
          address: {
            type: "object",
            title: "Address",
            properties: {
              city: { type: "string" },
              zip: { type: "string" },
            },
            required: ["city"],
          },
        },
      },
      { formName: "f" },
    );
    const address = form.fields[0] as GroupFieldSpec;
    expect(address.type).toBe("group");
    expect(address.variant).toBe("advanced");
    expect(address.groups).toHaveLength(1);
    expect(address.groups[0]?.fields.map((f) => f.name)).toEqual(["city", "zip"]);
    expect(address.groups[0]?.fields[0]).toMatchObject({ name: "city", required: true });
  });

  it("drops a property whose type/shape falls outside the subset instead of throwing", () => {
    const form = fromJsonSchema(
      {
        type: "object",
        properties: {
          kept: { type: "string" },
          nullish: { type: "null" },
          untyped: { description: "no type at all" },
          emptyObject: { type: "object" },
        },
      },
      { formName: "f" },
    );
    expect(form.fields.map((f) => f.name)).toEqual(["kept"]);
  });

  it("honors title/description/submitLabel overrides and falls back to the schema's own", () => {
    const form = fromJsonSchema(
      { type: "object", title: "Schema title", description: "Schema description", properties: {} },
      { formName: "f" },
    );
    expect(form.title).toBe("Schema title");
    expect(form.description).toBe("Schema description");

    const overridden = fromJsonSchema(
      { type: "object", title: "Schema title", properties: {} },
      { formName: "f", title: "Override title", submitLabel: "Save" },
    );
    expect(overridden.title).toBe("Override title");
    expect(overridden.submitLabel).toBe("Save");
  });
});

describe("fromJsonSchema — refuses combinators rather than approximating them", () => {
  it.each(["$ref", "allOf", "oneOf", "anyOf", "not"] as const)(
    "throws UnsupportedJsonSchemaError for a top-level %s",
    (keyword) => {
      expect(() =>
        fromJsonSchema({ type: "object", properties: {}, [keyword]: {} }, { formName: "f" }),
      ).toThrow(UnsupportedJsonSchemaError);
    },
  );

  it("throws for a combinator nested inside a property schema", () => {
    expect(() =>
      fromJsonSchema(
        { type: "object", properties: { x: { $ref: "#/definitions/X" } } },
        { formName: "f" },
      ),
    ).toThrow(/\$ref/);
  });

  it("throws for a combinator nested inside an array's items schema", () => {
    expect(() =>
      fromJsonSchema(
        { type: "object", properties: { x: { type: "array", items: { oneOf: [] } } } },
        { formName: "f" },
      ),
    ).toThrow(/oneOf/);
  });

  it("throws for a combinator nested inside a nested object's properties", () => {
    expect(() =>
      fromJsonSchema(
        {
          type: "object",
          properties: { addr: { type: "object", properties: { city: { allOf: [] } } } },
        },
        { formName: "f" },
      ),
    ).toThrow(/allOf/);
  });

  it("throws when the top-level schema is not an object schema", () => {
    expect(() => fromJsonSchema({ type: "string" }, { formName: "f" })).toThrow(
      UnsupportedJsonSchemaError,
    );
  });

  it("the error message names the keyword and a JSON-Pointer-style path", () => {
    try {
      fromJsonSchema({ type: "object", properties: { x: { $ref: "#/X" } } }, { formName: "f" });
      throw new Error("expected fromJsonSchema to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(UnsupportedJsonSchemaError);
      expect((err as Error).message).toContain("$ref");
      expect((err as Error).message).toContain("#/properties/x");
    }
  });
});
