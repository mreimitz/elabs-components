/**
 * message-form-spec.ts — Serializable FormSpec for MessageForm.
 *
 * These are pure data types + zod schemas with no React dependency. The shape is
 * what an LLM tool-call emits when it wants the user to fill in a form inside a
 * chat message. It is deliberately compatible with MCP elicitation's
 * `requestedSchema` (spec 2025-11-25): flat primitive fields (string / number /
 * integer / boolean / single- and multi-select enum), each with a label,
 * optional description, `required`, and a `default`.
 *
 * The exported zod schemas are the source of truth downstream catalogs compile
 * prompts + validators from. Field types are intentionally limited to the safe
 * set — there is NO file input and NO password/credential type/format, so a spec
 * that asks for one fails validation (rejected, never rendered).
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Enum options
// ---------------------------------------------------------------------------

/** A single enum choice: a plain value, or a `{ const, title }` pair. */
export const enumOptionSchema = z.union([
  z.string(),
  z.object({ const: z.string(), title: z.string().optional() }),
]);
export type EnumOption = z.infer<typeof enumOptionSchema>;

/** The submitted value of an enum option. */
export function optionValue(option: EnumOption): string {
  return typeof option === "string" ? option : option.const;
}

/** The display label of an enum option (falls back to its value). */
export function optionLabel(option: EnumOption): string {
  return typeof option === "string" ? option : (option.title ?? option.const);
}

// ---------------------------------------------------------------------------
// Fields (a discriminated union on `type`)
// ---------------------------------------------------------------------------

/** Fields shared by every field type. `name` is the key in the emitted values. */
const baseField = {
  /** Value key in the emitted form state (the `values` object key). */
  name: z.string(),
  /** Human label. Falls back to a humanized `name` when omitted. */
  label: z.string().optional(),
  /** Helper text shown under the control. */
  description: z.string().optional(),
  /** Whether a value is required before the form can submit. */
  required: z.boolean().optional(),
};

/**
 * A single-line or multi-line text field.
 * `format` narrows the input type + validation. Note there is NO `"password"`
 * format — credential capture is deliberately unsupported.
 */
export const stringFieldSchema = z.object({
  type: z.literal("string"),
  ...baseField,
  default: z.string().optional(),
  format: z.enum(["email", "uri", "date", "date-time"]).optional(),
  minLength: z.number().int().nonnegative().optional(),
  maxLength: z.number().int().nonnegative().optional(),
  /** A serialized RegExp source string (client-enforced when present). */
  pattern: z.string().optional(),
  /** Render a textarea instead of a single-line input. */
  multiline: z.boolean().optional(),
});
export type StringFieldSpec = z.infer<typeof stringFieldSchema>;

/** A floating-point number field. */
export const numberFieldSchema = z.object({
  type: z.literal("number"),
  ...baseField,
  default: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
});
export type NumberFieldSpec = z.infer<typeof numberFieldSchema>;

/** A whole-number field. */
export const integerFieldSchema = z.object({
  type: z.literal("integer"),
  ...baseField,
  default: z.number().int().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
});
export type IntegerFieldSpec = z.infer<typeof integerFieldSchema>;

/** A boolean checkbox field. */
export const booleanFieldSchema = z.object({
  type: z.literal("boolean"),
  ...baseField,
  default: z.boolean().optional(),
});
export type BooleanFieldSpec = z.infer<typeof booleanFieldSchema>;

/** A single-select enum (one value from `options`). */
export const enumFieldSchema = z.object({
  type: z.literal("enum"),
  ...baseField,
  options: z.array(enumOptionSchema),
  default: z.string().optional(),
});
export type EnumFieldSpec = z.infer<typeof enumFieldSchema>;

/** A multi-select enum (zero or more values from `options`). */
export const multiEnumFieldSchema = z.object({
  type: z.literal("multi-enum"),
  ...baseField,
  options: z.array(enumOptionSchema),
  default: z.array(z.string()).optional(),
});
export type MultiEnumFieldSpec = z.infer<typeof multiEnumFieldSchema>;

/** Any one field in a FormSpec. */
export const fieldSpecSchema = z.discriminatedUnion("type", [
  stringFieldSchema,
  numberFieldSchema,
  integerFieldSchema,
  booleanFieldSchema,
  enumFieldSchema,
  multiEnumFieldSchema,
]);
export type FieldSpec = z.infer<typeof fieldSpecSchema>;

// ---------------------------------------------------------------------------
// FormSpec
// ---------------------------------------------------------------------------

/**
 * The serializable form specification produced by an LLM tool-call.
 * MessageForm reads this, renders the fields, and emits `{ formName, values }`.
 *
 * Export target for downstream catalogs: compile the prompt + a validator from
 * `formSpecSchema`.
 */
export const formSpecSchema = z.object({
  /** Stable identifier echoed back in the submit payload. */
  formName: z.string(),
  /** Heading rendered above the fields (also the accessible form name). */
  title: z.string().optional(),
  /** Supplemental description under the title. */
  description: z.string().optional(),
  /** The ordered fields to render. */
  fields: z.array(fieldSpecSchema),
  /** Submit button label. @default "Submit" */
  submitLabel: z.string().optional(),
});
export type FormSpec = z.infer<typeof formSpecSchema>;

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

/** A single field's value in the form state. */
export type FormValue = string | number | boolean | string[] | undefined;

/** The `values` object keyed by field `name`. */
export type FormValues = Record<string, FormValue>;

/** The payload passed to `onSubmit`. */
export interface FormSubmitState {
  /** Echoes `spec.formName`. */
  formName: string;
  /** The current field values keyed by field name. */
  values: FormValues;
}

// ---------------------------------------------------------------------------
// Normalization (lenient — streaming-tolerant, never throws)
// ---------------------------------------------------------------------------

/** A validated, render-ready FormSpec. */
export interface NormalizedFormSpec {
  formName: string;
  title?: string;
  description?: string;
  submitLabel?: string;
  fields: FieldSpec[];
}

/**
 * Lenient parse for the render path. Mirrors AutoChart's guard philosophy:
 * NEVER throws. Individually invalid or half-streamed fields are dropped (not
 * fatal), so a partial spec still renders progressively. Returns `{ ok: false }`
 * only when the whole spec is unusable (not an object) — the caller then shows
 * `MessageFormFallback`.
 */
export function normalizeFormSpec(
  spec: unknown,
): { ok: true; spec: NormalizedFormSpec } | { ok: false; reason: string } {
  if (spec === null || typeof spec !== "object" || Array.isArray(spec)) {
    return { ok: false, reason: "Form specification is missing or malformed." };
  }
  const raw = spec as Record<string, unknown>;
  const rawFields = Array.isArray(raw.fields) ? raw.fields : [];

  const fields: FieldSpec[] = [];
  const seen = new Set<string>();
  for (const candidate of rawFields) {
    const parsed = fieldSpecSchema.safeParse(candidate);
    if (!parsed.success) continue; // drop invalid / still-streaming field
    if (seen.has(parsed.data.name)) continue; // de-dupe by name (last-writer avoided)
    seen.add(parsed.data.name);
    fields.push(parsed.data);
  }

  return {
    ok: true,
    spec: {
      formName: typeof raw.formName === "string" ? raw.formName : "",
      title: typeof raw.title === "string" ? raw.title : undefined,
      description: typeof raw.description === "string" ? raw.description : undefined,
      submitLabel: typeof raw.submitLabel === "string" ? raw.submitLabel : undefined,
      fields,
    },
  };
}

// ---------------------------------------------------------------------------
// Labels + initial values
// ---------------------------------------------------------------------------

/** Turn a field name into a human label ("first_name" / "firstName" → "First name"). */
function humanize(name: string): string {
  const spaced = name
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();
  if (!spaced) return name;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** The label to show for a field (explicit `label`, else a humanized `name`). */
export function fieldLabel(field: FieldSpec): string {
  return field.label && field.label.length > 0 ? field.label : humanize(field.name);
}

/** Seed the initial values from each field's `default` (+ sensible empties). */
export function initialFormValues(fields: FieldSpec[]): FormValues {
  const values: FormValues = {};
  for (const field of fields) {
    if (field.default !== undefined) {
      values[field.name] = field.default;
    } else if (field.type === "boolean") {
      values[field.name] = false;
    } else if (field.type === "multi-enum") {
      values[field.name] = [];
    }
  }
  return values;
}

// ---------------------------------------------------------------------------
// Client-side validation (the declarative vocabulary)
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isEmptyValue(value: FormValue): boolean {
  return value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
}

function isValidUrl(value: string): boolean {
  try {
    void new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate one field's value against its declarative constraints.
 * Returns a short human error message, or `null` when the value is valid.
 * The vocabulary: required · email · url · min · max · minLength · maxLength ·
 * pattern · numeric (integer whole-number).
 */
export function validateField(field: FieldSpec, value: FormValue): string | null {
  const empty = isEmptyValue(value);

  if (field.required) {
    // A required boolean must be affirmatively true (e.g. "accept terms");
    // `false` is otherwise a valid, non-empty value.
    if (field.type === "boolean") {
      if (value !== true) return "This field is required.";
    } else if (empty) {
      return "This field is required.";
    }
  }
  if (empty) return null; // optional + empty → valid, skip further checks

  switch (field.type) {
    case "string": {
      const text = String(value);
      if (field.minLength !== undefined && text.length < field.minLength) {
        return `Must be at least ${field.minLength} character${field.minLength === 1 ? "" : "s"}.`;
      }
      if (field.maxLength !== undefined && text.length > field.maxLength) {
        return `Must be at most ${field.maxLength} character${field.maxLength === 1 ? "" : "s"}.`;
      }
      if (field.format === "email" && !EMAIL_RE.test(text)) {
        return "Enter a valid email address.";
      }
      if (field.format === "uri" && !isValidUrl(text)) {
        return "Enter a valid URL.";
      }
      if (field.pattern) {
        let re: RegExp | null = null;
        try {
          re = new RegExp(field.pattern);
        } catch {
          re = null; // an invalid pattern from the model must not break validation
        }
        if (re && !re.test(text)) return "Value doesn't match the required format.";
      }
      return null;
    }
    case "number":
    case "integer": {
      const num = typeof value === "number" ? value : Number(value);
      if (Number.isNaN(num)) return "Enter a number.";
      if (field.type === "integer" && !Number.isInteger(num)) return "Enter a whole number.";
      if (field.min !== undefined && num < field.min) return `Must be at least ${field.min}.`;
      if (field.max !== undefined && num > field.max) return `Must be at most ${field.max}.`;
      return null;
    }
    default:
      return null;
  }
}

/** Validate every field; returns a `{ [name]: error | null }` map. */
export function validateForm(
  fields: FieldSpec[],
  values: FormValues,
): Record<string, string | null> {
  const errors: Record<string, string | null> = {};
  for (const field of fields) {
    errors[field.name] = validateField(field, values[field.name]);
  }
  return errors;
}
