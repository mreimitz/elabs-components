/**
 * effective-fields — internal. Flattens a definition's own fields and group
 * fields into one table, computed once per definition object and cached.
 * Every reader (resolve, validate, JSON Schema, snapshot) goes through it, so
 * the override and default rules live in one place. Not exported from the
 * subpath.
 *
 * React-free.
 */

import { normalizeAliases, type NormalizedAliasRow } from "./aliases";
import type { AnyComponentDefinition } from "./component-definition";
import { isContextDefault, type AnyField, type DefaultFromContext } from "./field";

/** One prop as the definition describes it after groups and own fields are merged. */
export interface EffectiveField {
  readonly key: string;
  /** The own field if there is one, else the last group's. */
  readonly field: AnyField;
  /** The group the field comes from; `null` for an own field. */
  readonly group: string | null;
  /** For an own field that replaces a group field: that group's id. */
  readonly overrides: string | null;
  /** Whether a value default applies (kind default, own field, then group). */
  readonly hasValueDefault: boolean;
  readonly valueDefault: unknown;
  /** The context default (own field's, else the group field's), used when no value default applies. */
  readonly contextDefault: DefaultFromContext<unknown> | undefined;
}

/** What `resolveProps` fills, in order. */
export type FillStep =
  | { readonly key: string; readonly value: unknown }
  | { readonly key: string; readonly fromContext: DefaultFromContext<unknown> };

export interface DefinitionPlan {
  /** Every described prop, sorted by key. */
  readonly fields: readonly EffectiveField[];
  readonly byKey: ReadonlyMap<string, EffectiveField>;
  readonly codeOnly: ReadonlySet<string>;
  readonly aliases: readonly NormalizedAliasRow[];
  readonly aliasByFrom: ReadonlyMap<string, NormalizedAliasRow>;
  readonly fill: readonly FillStep[];
}

const plans = new WeakMap<AnyComponentDefinition, DefinitionPlan>();

function valueDefaultOf(f: AnyField | undefined): { has: boolean; value: unknown } {
  if (!f || f.default === undefined || isContextDefault(f.default))
    return { has: false, value: undefined };
  return { has: true, value: f.default };
}

function contextDefaultOf(f: AnyField | undefined): DefaultFromContext<unknown> | undefined {
  return f && isContextDefault(f.default) ? f.default : undefined;
}

/** The merged field table of a definition. Cached per definition object. */
export function planOf(def: AnyComponentDefinition): DefinitionPlan {
  const cached = plans.get(def);
  if (cached) return cached;

  const groupField = new Map<
    string,
    { group: string; field: AnyField; groupDefault: { has: boolean; value: unknown } }
  >();
  for (const group of def.groups) {
    for (const key of Object.keys(group.fields)) {
      const f = group.fields[key];
      if (!f) continue;
      const has = Object.prototype.hasOwnProperty.call(group.defaults, key);
      groupField.set(key, {
        group: group.id,
        field: f,
        groupDefault: { has, value: group.defaults[key] },
      });
    }
  }

  const kindDefaults = (def.defaults ?? {}) as Readonly<Record<string, unknown>>;
  const keys = new Set<string>([...groupField.keys()]);
  for (const key of Object.keys(def.fields)) if (def.fields[key]) keys.add(key);

  const fields: EffectiveField[] = [];
  for (const key of [...keys].sort()) {
    const own = def.fields[key];
    const fromGroup = groupField.get(key);
    const field = (own ?? fromGroup?.field) as AnyField;
    const ownDefault = valueDefaultOf(own);
    let hasValueDefault = false;
    let value: unknown;
    if (kindDefaults[key] !== undefined) {
      hasValueDefault = true;
      value = kindDefaults[key];
    } else if (ownDefault.has) {
      hasValueDefault = true;
      value = ownDefault.value;
    } else if (fromGroup?.groupDefault.has) {
      hasValueDefault = true;
      value = fromGroup.groupDefault.value;
    }
    fields.push({
      key,
      field,
      group: own ? null : (fromGroup?.group ?? null),
      overrides: own && fromGroup ? fromGroup.group : null,
      hasValueDefault,
      valueDefault: value,
      contextDefault: contextDefaultOf(own) ?? contextDefaultOf(fromGroup?.field),
    });
  }

  const byKey = new Map(fields.map((f) => [f.key, f]));
  const fill: FillStep[] = [];
  for (const f of fields) {
    if (f.field.deprecated) continue;
    if (f.hasValueDefault) fill.push({ key: f.key, value: f.valueDefault });
    else if (f.contextDefault) fill.push({ key: f.key, fromContext: f.contextDefault });
  }
  // Kind defaults for keys no field describes (a codeOnly formatter, say) still apply.
  for (const key of Object.keys(kindDefaults).sort()) {
    if (!byKey.has(key) && kindDefaults[key] !== undefined)
      fill.push({ key, value: kindDefaults[key] });
  }

  const aliases = normalizeAliases(def.aliases);
  const plan: DefinitionPlan = {
    fields,
    byKey,
    codeOnly: new Set(def.codeOnly),
    aliases,
    aliasByFrom: new Map(aliases.map((row) => [row.from, row])),
    fill,
  };
  plans.set(def, plan);
  return plan;
}
