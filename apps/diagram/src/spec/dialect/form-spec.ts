/**
 * DG-14 — the inspector's forms, generated from the dialect definitions (one source with the
 * validator and the JSON Schema). A definition field becomes a ui `FieldSpec`; `tier:
 * "essential"` fields come first, the rest sit in a collapsed "Advanced" section, and
 * `appliesWhen` becomes `visibleWhen`. React-free: it only imports types from ui.
 */
import type { AnyComponentDefinition, AnyField } from "@elabs-ai/components-ui/definition";
import type { FieldSpec, FormSpec, FormValue, FormValues } from "@elabs-ai/components-ui";
import type { EntryPatch, WriteValue } from "./write-back";

/** The "Not set" option of an enum without a default. */
// P4: library gap — ui EnumControl has no clear option; a sentinel option stands in.
export const UNSET = "__unset";

export interface EntryFormOptions {
  /** Keys never shown (structure the canvas owns, e.g. `children`, `position`). */
  omit: readonly string[];
  /** Keys shown as read-only text (identity, e.g. `id`, `from`, `to`). */
  readOnly: readonly string[];
  /** Keys whose string field is a textarea. */
  multiline?: readonly string[];
  /** Advanced-section label. */
  advancedLabel: string;
  /** Label of the "Not set" enum option. */
  unsetLabel: string;
}

/** Every field of a definition, groups first, own fields overriding (as effective-fields does). */
// P4: library gap — ui's effective-fields (planOf) is not exported from the definition subpath.
function fieldsOf(def: AnyComponentDefinition): [string, AnyField][] {
  const merged = new Map<string, AnyField>();
  for (const group of def.groups) {
    for (const [key, f] of Object.entries(group.fields)) merged.set(key, f);
  }
  for (const [key, f] of Object.entries(def.fields)) {
    if (f) merged.set(key, f);
  }
  return [...merged];
}

function toFieldSpec(name: string, f: AnyField, options: EntryFormOptions): FieldSpec | null {
  const base = {
    name,
    description: f.description,
    readOnly: options.readOnly.includes(name) || undefined,
    // P4: library gap — FieldSpec.visibleWhen has `equals` only; `appliesWhen.in` is dropped.
    visibleWhen:
      f.appliesWhen && "equals" in f.appliesWhen
        ? { field: f.appliesWhen.field, equals: f.appliesWhen.equals }
        : undefined,
  };
  switch (f.kind) {
    case "string":
      return {
        ...base,
        type: "string",
        multiline: options.multiline?.includes(name) || undefined,
      };
    case "integer":
      return { ...base, type: "integer", min: f.min, max: f.max };
    case "number":
      return { ...base, type: "number", min: f.min, max: f.max };
    case "boolean":
      return { ...base, type: "boolean" };
    case "enum": {
      const values = f.values.map(String);
      const options_ =
        f.default === undefined ? [{ const: UNSET, title: options.unsetLabel }, ...values] : values;
      return { ...base, type: "enum", options: options_ };
    }
    case "array":
      // P4: library gap — no tag/chip input field kind; `list` (ListEditor) is the closest.
      return f.of.kind === "string" ? { ...base, type: "list" } : null;
    default:
      return null;
  }
}

/** The inspector form of one dialect entity. */
export function entryFormSpec(def: AnyComponentDefinition, options: EntryFormOptions): FormSpec {
  const identity: FieldSpec[] = [];
  const essential: FieldSpec[] = [];
  const advanced: FieldSpec[] = [];
  for (const [name, f] of fieldsOf(def)) {
    if (options.omit.includes(name)) continue;
    const spec = toFieldSpec(name, f, options);
    if (!spec) continue;
    if (options.readOnly.includes(name)) identity.push(spec);
    else (f.tier === "essential" ? essential : advanced).push(spec);
  }
  return {
    formName: def.id,
    fields: [...identity, ...essential, ...advanced],
    sections:
      advanced.length > 0
        ? [
            {
              id: "advanced",
              label: options.advancedLabel,
              fields: advanced.map((f) => f.name),
              collapsed: true,
            },
          ]
        : undefined,
  };
}

/** Default of each field that has a value default, so the form shows the effective value. */
function defaultsOf(def: AnyComponentDefinition): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, f] of fieldsOf(def)) {
    if (f.default !== undefined && typeof f.default !== "function") out[name] = f.default;
  }
  return out;
}

function toFormValue(value: unknown): FormValue | undefined {
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return value;
  if (Array.isArray(value)) return value.map(String);
  return undefined;
}

/**
 * The form values of an entry: its written keys over the definition defaults. DG-26 — a field
 * in `inherited` (a catalog reference supplies it, and the node does not write it) gets no
 * default: an enum shows "Not set", a text field is empty, so the field's help text (the
 * reference's value, set by the caller) is the only place the value shows.
 */
export function entryFormValues(
  spec: FormSpec,
  def: AnyComponentDefinition,
  written: Readonly<Record<string, unknown>>,
  inherited: ReadonlySet<string> = new Set(),
): FormValues {
  const defaults = defaultsOf(def);
  const values: FormValues = {};
  for (const field of spec.fields) {
    const fallback = inherited.has(field.name) ? undefined : defaults[field.name];
    const value = toFormValue(written[field.name] ?? fallback);
    if (value !== undefined) values[field.name] = value;
    else if (field.type === "enum") values[field.name] = UNSET;
  }
  return values;
}

/**
 * The spec with each field's `default` set to the entry's value: the form runs uncontrolled
 * and seeds from it (see the inspector for why not controlled).
 */
export function seedFormSpec(spec: FormSpec, values: FormValues): FormSpec {
  return {
    ...spec,
    fields: spec.fields.map((field) => ({ ...field, default: values[field.name] }) as FieldSpec),
  };
}

const isEmpty = (value: FormValue | undefined) =>
  value === undefined ||
  value === "" ||
  value === UNSET ||
  (Array.isArray(value) && value.length === 0);

function sameValue(a: FormValue | undefined, b: FormValue | undefined): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => item === b[i]);
  }
  return a === b || (isEmpty(a) && isEmpty(b));
}

/**
 * The keys that changed between two form value sets, as a write-back patch. An emptied field,
 * "Not set", and a boolean switched back to its default remove the key — except a text field
 * named in `referenceSupplied` (a catalog reference currently supplies a value for it): emptying
 * THAT one writes `""` instead, an explicit override that blocks the reference's value from
 * showing again (dialect-v1.md; `normalize.ts` already treats a written `""` this way). Removing
 * the key would mean "unwritten", which is what let the reference's value silently come back.
 */
export function entryFormPatch(
  def: AnyComponentDefinition,
  before: FormValues,
  after: FormValues,
  referenceSupplied: ReadonlySet<string> = new Set(),
): EntryPatch {
  const defaults = defaultsOf(def);
  const patch: Record<string, WriteValue | undefined> = {};
  for (const [name, value] of Object.entries(after)) {
    if (sameValue(before[name], value)) continue;
    if (
      (value === "" || (Array.isArray(value) && value.length === 0)) &&
      referenceSupplied.has(name)
    ) {
      patch[name] = value === "" ? "" : [];
    } else if (isEmpty(value) || (typeof value === "boolean" && value === defaults[name])) {
      patch[name] = undefined;
    } else if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      patch[name] = value;
    } else if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
      patch[name] = value as string[];
    }
  }
  return patch;
}
