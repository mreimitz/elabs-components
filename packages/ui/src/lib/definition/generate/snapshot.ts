/**
 * snapshot — a definition as plain, deterministic JSON: what the CLI's
 * manifest, the A2UI catalog and generated docs read, and what a snapshot
 * test pins so an accidental change to a kind's contract shows up in review.
 *
 * Group and own fields are flattened into one `fields` map; each entry says
 * which group it came from (`group`, `null` for an own field) and which group
 * field it replaces (`overrides`). A context default is written as
 * `{ "defaultFrom": "context" }`. Functions and `undefined` are dropped and
 * every object's keys are sorted, so the same definition always serialises
 * to the same string.
 *
 * React-free; no component imports it.
 */

import type { AnyComponentDefinition } from "../component-definition";
import { planOf } from "../effective-fields";
import { isContextDefault, type AnyField } from "../field";

/** A JSON value. */
export type SnapshotValue =
  | string
  | number
  | boolean
  | null
  | readonly SnapshotValue[]
  | { readonly [key: string]: SnapshotValue };

/** A definition snapshot: a JSON object with sorted keys. */
export type DefinitionSnapshot = { readonly [key: string]: SnapshotValue };

const CONTEXT_DEFAULT = { defaultFrom: "context" } as const;

/** Sorted-key, function-free JSON copy of `value` (`undefined` when nothing serialisable is left). */
function toJson(value: unknown): SnapshotValue | undefined {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) {
    const items: SnapshotValue[] = [];
    for (const item of value) {
      const json = toJson(item);
      if (json !== undefined) items.push(json);
    }
    return items;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const out: Record<string, SnapshotValue> = {};
    for (const key of Object.keys(record).sort()) {
      const json = toJson(record[key]);
      if (json !== undefined) out[key] = json;
    }
    return out;
  }
  return undefined;
}

/** A field as data; nested fields keep their own defaults. */
function fieldData(f: AnyField): Record<string, unknown> {
  const data: Record<string, unknown> = { ...f };
  if (isContextDefault(f.default)) data.default = CONTEXT_DEFAULT;
  switch (f.kind) {
    case "responsive":
    case "array":
      data.of = fieldData(f.of);
      break;
    case "union":
      data.of = f.of.map(fieldData);
      break;
    case "object": {
      const fields: Record<string, unknown> = {};
      for (const key of Object.keys(f.fields)) {
        const sub = f.fields[key];
        if (sub) fields[key] = fieldData(sub);
      }
      data.fields = fields;
      break;
    }
    default:
      break;
  }
  return data;
}

/** The deterministic, JSON-serialisable snapshot of a definition. */
export function toSnapshot(def: AnyComponentDefinition): DefinitionSnapshot {
  const plan = planOf(def);
  const fields: Record<string, unknown> = {};
  for (const f of plan.fields) {
    const data = fieldData(f.field);
    delete data.default;
    if (f.hasValueDefault) data.default = f.valueDefault;
    else if (f.contextDefault) data.default = CONTEXT_DEFAULT;
    data.group = f.group;
    if (f.overrides) data.overrides = f.overrides;
    fields[f.key] = data;
  }
  const snapshot = {
    id: def.id,
    version: def.version,
    label: def.label,
    description: def.description,
    groups: def.groups.map((group) => group.id),
    fields,
    codeOnly: [...def.codeOnly].sort(),
    targets: def.targets,
    aliases: plan.aliases,
    normalize: def.normalize ? true : undefined,
    migrate: def.migrate ? true : undefined,
  };
  return toJson(snapshot) as DefinitionSnapshot;
}
