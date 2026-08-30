/**
 * schema-form-spec.ts — Serializable FormSpec for SchemaForm.
 *
 * SchemaForm is the GENERAL, app-UI spec-driven form renderer (issue #22):
 * describe a configuration form as data, render it. It is the sibling of
 * `@elabs-ai/components-ai`'s `MessageForm` / `fieldSpecSchema` — NOT a
 * generalization of it. The two are deliberately separate schemas because
 * they carry different trust models:
 *
 * - `MessageForm`'s `fieldSpecSchema` (`packages/ai/src/message-form-spec.ts`)
 *   is what an LLM tool-call emits inside a chat message. Its vocabulary is
 *   intentionally the SAFE subset — flat scalars only, no file input, no
 *   password/credential format — so a model can never ask a user to hand it
 *   a file or a secret through a chat-rendered form.
 * - `SchemaForm`'s `fieldSpecSchema` here is DEVELOPER-AUTHORED: a product
 *   describes an integration/config form (connector settings, environment
 *   variables, auth method) as data instead of hand-writing it. That is a
 *   fundamentally different trust boundary, so it is allowed the fuller
 *   vocabulary Onyx-style connector forms need: `list`, `key-value`, `file`,
 *   and grouped alternative field sets (`group`, tabs or advanced-collapsed).
 *
 * Shares its overall shape (fields/values/validate/normalize) with
 * `message-form-spec.ts` by convention, not by import — merging them into one
 * union would either smuggle `file`/`group` into the chat-safe schema or
 * strip the safety comment from this one. See the issue-#22 result file for
 * the full reasoning.
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
// Key-value rows (shared shape with `KeyValueEditor`'s `KeyValueRow`)
// ---------------------------------------------------------------------------

export const keyValueRowSchema = z.object({
  key: z.string(),
  value: z.string(),
  /** Mask this row's value (rendered as `type="password"` with a reveal toggle). */
  secret: z.boolean().optional(),
});
export type FieldKeyValueRow = z.infer<typeof keyValueRowSchema>;

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

/** A single-line or multi-line text field. */
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

/** A repeating list of strings (Onyx's `list`) → renders `ListEditor`. */
export const listFieldSchema = z.object({
  type: z.literal("list"),
  ...baseField,
  default: z.array(z.string()).optional(),
  minItems: z.number().int().nonnegative().optional(),
  maxItems: z.number().int().nonnegative().optional(),
  itemPlaceholder: z.string().optional(),
});
export type ListFieldSpec = z.infer<typeof listFieldSchema>;

/** A repeating key/value list, e.g. headers or env vars (Onyx's `string_pair_list`) → renders `KeyValueEditor`. */
export const keyValueFieldSchema = z.object({
  type: z.literal("key-value"),
  ...baseField,
  default: z.array(keyValueRowSchema).optional(),
  keyPlaceholder: z.string().optional(),
  valuePlaceholder: z.string().optional(),
});
export type KeyValueFieldSpec = z.infer<typeof keyValueFieldSchema>;

/** A file-upload field (Onyx's `file`) → renders `FileUpload`. No `default` — files cannot be defaulted. */
export const fileFieldSchema = z.object({
  type: z.literal("file"),
  ...baseField,
  /** Forwarded to the native `<input accept>` (comma-separated extensions/MIME types). */
  accept: z.string().optional(),
  multiple: z.boolean().optional(),
  /** Maximum individual file size, in bytes. */
  maxSize: z.number().positive().optional(),
  /** Maximum number of files (only meaningful when `multiple`). */
  maxFiles: z.number().int().positive().optional(),
});
export type FileFieldSpec = z.infer<typeof fileFieldSchema>;

/**
 * Any one field in a FormSpec — pre-declared here (a plain TS union, not
 * `z.infer`) so `GroupItemSpec`/`GroupFieldSpec` below can reference it and
 * vice versa. TypeScript resolves mutual recursion between `type`/`interface`
 * declarations regardless of file order (no runtime value is involved); only
 * the `const` zod schemas further down need an explicit `z.ZodType<…>`
 * annotation to break the equivalent circular VALUE reference through
 * `z.lazy`.
 */
export type FieldSpec =
  | StringFieldSpec
  | NumberFieldSpec
  | IntegerFieldSpec
  | BooleanFieldSpec
  | EnumFieldSpec
  | MultiEnumFieldSpec
  | ListFieldSpec
  | KeyValueFieldSpec
  | FileFieldSpec
  | GroupFieldSpec;

/** One named branch of a `group` field's `groups` array. Recursive — a branch's `fields` are ordinary `FieldSpec`s, including nested groups. */
export interface GroupItemSpec {
  /** Stable key for this branch — also the value stored when `variant: "tabs"`. */
  key: string;
  label: string;
  description?: string;
  fields: FieldSpec[];
}

/**
 * Grouped alternative field sets (Onyx's `tab` / `string_tab`) → renders
 * `Tabs` (`variant: "tabs"`, mutually exclusive — e.g. "OAuth" vs "API key")
 * or a stack of `AdvancedGroup` disclosures (`variant: "advanced"` — always-
 * available secondary fields, not mutually exclusive).
 *
 * For `variant: "tabs"`, the field's OWN value (`values[field.name]`) is the
 * active branch's `key` — the group behaves like a single-select enum over
 * its branches. Only the active branch's fields are validated/required;
 * `variant: "advanced"` has no notion of an active branch, so every branch's
 * fields are always validated.
 */
export interface GroupFieldSpec {
  type: "group";
  name: string;
  label?: string;
  description?: string;
  required?: boolean;
  variant: "tabs" | "advanced";
  groups: GroupItemSpec[];
  /** Default active branch key. Only meaningful for `variant: "tabs"`. @default groups[0].key */
  default?: string;
}

export const groupItemSchema: z.ZodType<GroupItemSpec> = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string().optional(),
  fields: z.array(z.lazy((): z.ZodType<FieldSpec> => fieldSpecSchema)),
});

// A separate, non-widened binding for the object literal itself: passing the
// `z.ZodType<GroupFieldSpec>`-ANNOTATED `groupFieldSchema` into
// `z.discriminatedUnion` fails its `ZodObject`-shaped member constraint (the
// annotation is deliberately wider than what that constraint accepts), so the
// union is built from this one instead. Both are the exact same runtime
// value; only their STATIC types differ.
const groupFieldSchemaObject = z.object({
  type: z.literal("group"),
  ...baseField,
  variant: z.enum(["tabs", "advanced"]),
  groups: z.array(groupItemSchema),
  default: z.string().optional(),
});
export const groupFieldSchema: z.ZodType<GroupFieldSpec> = groupFieldSchemaObject;

/**
 * NOTE: cast through `unknown` — `z.discriminatedUnion`'s own inferred output
 * type is not assignable to the hand-declared `FieldSpec` union once one
 * member (`groupFieldSchema`) is itself hand-typed via `z.ZodType<…>` rather
 * than inferred; the runtime validator (discriminate on `type`, then run each
 * member's real `.parse`) is unaffected; only the static type is asserted.
 */
export const fieldSpecSchema = z.discriminatedUnion("type", [
  stringFieldSchema,
  numberFieldSchema,
  integerFieldSchema,
  booleanFieldSchema,
  enumFieldSchema,
  multiEnumFieldSchema,
  listFieldSchema,
  keyValueFieldSchema,
  fileFieldSchema,
  groupFieldSchemaObject,
]) as unknown as z.ZodType<FieldSpec>;

// ---------------------------------------------------------------------------
// FormSpec
// ---------------------------------------------------------------------------

/**
 * The serializable form specification SchemaForm reads, renders and submits
 * as `{ formName, values }`.
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
export type FormSpec = Omit<z.infer<typeof formSpecSchema>, "fields"> & { fields: FieldSpec[] };

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

/** A single field's value in the form state. */
export type FormValue =
  | string
  | number
  | boolean
  | string[]
  | FieldKeyValueRow[]
  | File[]
  | undefined;

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
// Normalization (lenient — never throws)
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
 * Lenient parse for the render path. Mirrors `MessageForm`'s
 * `normalizeFormSpec`: NEVER throws. Individually invalid top-level fields
 * are dropped (not fatal). Returns `{ ok: false }` only when the whole spec
 * is unusable (not an object).
 *
 * KNOWN LIMITATION: unlike the top-level field loop, a `group` field's
 * nested branches are validated as a single `fieldSpecSchema.safeParse` — one
 * invalid nested field drops the WHOLE group, not just that one nested field.
 * SchemaForm's specs are developer-authored (not streamed token-by-token like
 * a chat form), so partial-field tolerance inside a group is lower value than
 * it is for `MessageForm`; tightening this is a reasonable follow-up if a
 * consumer streams a spec into SchemaForm.
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
    if (!parsed.success) continue; // drop invalid field
    if (seen.has(parsed.data.name)) continue; // de-dupe by name (last-writer avoided)
    seen.add(parsed.data.name);
    fields.push(parsed.data as FieldSpec);
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
// Field tree helpers (fields can nest inside `group` branches)
// ---------------------------------------------------------------------------

/** Find a field by name anywhere in the tree, including inside `group` branches. */
export function findFieldByName(fields: FieldSpec[], name: string): FieldSpec | undefined {
  for (const field of fields) {
    if (field.name === name) return field;
    if (field.type === "group") {
      for (const group of field.groups) {
        const found = findFieldByName(group.fields, name);
        if (found) return found;
      }
    }
  }
  return undefined;
}

/**
 * The fields that currently participate in validation/submission: every
 * scalar field, plus — for a `group` field — either the ACTIVE branch's
 * fields (`variant: "tabs"`, keyed by `values[field.name]`) or ALL branches'
 * fields (`variant: "advanced"`, nothing is mutually exclusive there).
 */
export function collectValidatableFields(fields: FieldSpec[], values: FormValues): FieldSpec[] {
  const result: FieldSpec[] = [];
  for (const field of fields) {
    if (field.type !== "group") {
      result.push(field);
      continue;
    }
    if (field.variant === "tabs") {
      const activeKey =
        typeof values[field.name] === "string" ? (values[field.name] as string) : undefined;
      const active =
        field.groups.find((g) => g.key === activeKey) ??
        field.groups.find((g) => g.key === field.default) ??
        field.groups[0];
      if (active) result.push(...collectValidatableFields(active.fields, values));
    } else {
      for (const group of field.groups) {
        result.push(...collectValidatableFields(group.fields, values));
      }
    }
  }
  return result;
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

function seedField(field: FieldSpec, values: FormValues): void {
  if (field.type === "group") {
    if (field.variant === "tabs") {
      values[field.name] = field.default ?? field.groups[0]?.key;
    }
    for (const group of field.groups) {
      for (const child of group.fields) seedField(child, values);
    }
    return;
  }
  if (field.type === "file") {
    values[field.name] = [];
    return;
  }
  if (field.default !== undefined) {
    values[field.name] = field.default;
    return;
  }
  if (field.type === "boolean") values[field.name] = false;
  else if (field.type === "multi-enum" || field.type === "list") values[field.name] = [];
  else if (field.type === "key-value") values[field.name] = [];
}

/** Seed the initial values from every field's `default` (+ sensible empties), recursively. */
export function initialFormValues(fields: FieldSpec[]): FormValues {
  const values: FormValues = {};
  for (const field of fields) seedField(field, values);
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
 * pattern · numeric (integer whole-number) · minItems/maxItems (list).
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
          re = null; // an invalid pattern from the spec must not break validation
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
    case "list": {
      const items = Array.isArray(value) ? (value as string[]) : [];
      if (field.minItems !== undefined && items.length < field.minItems) {
        return `Add at least ${field.minItems} item${field.minItems === 1 ? "" : "s"}.`;
      }
      if (field.maxItems !== undefined && items.length > field.maxItems) {
        return `Add at most ${field.maxItems} item${field.maxItems === 1 ? "" : "s"}.`;
      }
      return null;
    }
    default:
      return null;
  }
}

/** Validate every VALIDATABLE field (see `collectValidatableFields`); returns a `{ [name]: error | null }` map. */
export function validateForm(
  fields: FieldSpec[],
  values: FormValues,
): Record<string, string | null> {
  const errors: Record<string, string | null> = {};
  for (const field of collectValidatableFields(fields, values)) {
    errors[field.name] = validateField(field, values[field.name]);
  }
  return errors;
}

// ---------------------------------------------------------------------------
// File validity (client-side, immediate — independent of `validateField`)
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Does `file` satisfy an `<input accept>`-style pattern (extensions, MIME types, or `type/*`)? */
export function fileMatchesAccept(file: File, accept: string | undefined): boolean {
  if (!accept) return true;
  const patterns = accept
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (patterns.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();
  return patterns.some((pattern) => {
    const p = pattern.toLowerCase();
    if (p.startsWith(".")) return name.endsWith(p);
    if (p.endsWith("/*")) return type.startsWith(p.slice(0, -1));
    return type === p;
  });
}

export interface FileIssue {
  reason: "wrong-type" | "too-large";
  message: string;
}

/** Client-side per-file check for the designed `file` field states: wrong type, too large. */
export function checkFileIssue(file: File, field: FileFieldSpec): FileIssue | null {
  if (!fileMatchesAccept(file, field.accept)) {
    return { reason: "wrong-type", message: "This file type isn't accepted." };
  }
  if (field.maxSize !== undefined && file.size > field.maxSize) {
    return {
      reason: "too-large",
      message: `File is larger than the ${formatBytes(field.maxSize)} limit.`,
    };
  }
  return null;
}
