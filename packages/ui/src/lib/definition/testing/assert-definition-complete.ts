/**
 * assert-definition-complete — the completeness check a definition's test
 * runs, at compile time and at run time.
 *
 * Compile time: every prop of the props type is a field, a group field, a
 * `codeOnly` key or an old alias name. A prop added to the component but not
 * to its definition fails `tsc` at the `assertDefinitionComplete(...)` call,
 * naming the prop.
 *
 * Run time: `defaults` and `targets` are present and well formed, keys are
 * not claimed twice, `appliesWhen` and alias targets point at real fields,
 * the defaults validate, and every example input validates.
 *
 * React-free.
 */

import type {
  AliasFromKeys,
  AnyComponentDefinition,
  GroupFieldKeys,
  PropsOf,
} from "../component-definition";
import { planOf } from "../effective-fields";
import type { KnownKey } from "../field";
import { validateProps } from "../validate";

type AccountedKeys<D> =
  | (D extends { readonly fields: infer F } ? keyof F : never)
  | (D extends { readonly groups: infer G } ? GroupFieldKeys<G> : never)
  | (D extends { readonly codeOnly: readonly (infer K)[] } ? K : never)
  | (D extends { readonly aliases?: infer A } ? AliasFromKeys<NonNullable<A>> : never);

/** The props of a definition's props type that nothing in the definition accounts for. */
export type UnaccountedProps<D> = Exclude<KnownKey<PropsOf<D>>, AccountedKeys<D>>;

/** `true` when every prop is accounted for. */
export type DefinitionIsComplete<D> = [UnaccountedProps<D>] extends [never] ? true : false;

type CompletenessCheck<D> = [UnaccountedProps<D>] extends [never]
  ? unknown
  : { readonly unaccountedProps: UnaccountedProps<D> };

export interface AssertDefinitionOptions {
  /** Inputs that must validate without an error (e.g. every story's serialisable args). */
  readonly examples?: readonly unknown[];
}

/**
 * Throws, listing every problem, when `def` is incomplete. Also a compile
 * error (a missing `unaccountedProps` property naming the props) when the
 * props type has a prop the definition does not account for.
 */
export function assertDefinitionComplete<D extends AnyComponentDefinition>(
  def: D & CompletenessCheck<D>,
  options: AssertDefinitionOptions = {},
): void {
  const problems: string[] = [];
  const plan = planOf(def);

  if (!def.defaults || typeof def.defaults !== "object") problems.push("`defaults` is missing.");
  if (!Array.isArray(def.targets)) {
    problems.push("`targets` is missing.");
  } else {
    const seen = new Set<string>();
    for (const target of def.targets) {
      if (seen.has(target.id)) problems.push(`Target "${target.id}" is declared twice.`);
      seen.add(target.id);
      if (!(target.min >= 0)) problems.push(`Target "${target.id}" needs a min of 0 or more.`);
      if (target.max !== null && !(target.max >= target.min)) {
        problems.push(`Target "${target.id}" has a max below its min.`);
      }
    }
  }

  const groupOwner = new Map<string, string>();
  for (const group of def.groups) {
    for (const key of Object.keys(group.fields)) {
      const other = groupOwner.get(key);
      if (other && !def.fields[key]) {
        problems.push(`"${key}" is declared by both the "${other}" and "${group.id}" groups.`);
      }
      groupOwner.set(key, group.id);
    }
  }

  for (const key of def.codeOnly) {
    if (plan.byKey.has(key)) problems.push(`"${key}" is both a field and codeOnly.`);
  }

  for (const f of plan.fields) {
    const applies = f.field.appliesWhen;
    if (applies && !plan.byKey.has(applies.field)) {
      problems.push(`"${f.key}" applies when "${applies.field}" is set, but no such field exists.`);
    }
  }

  for (const row of plan.aliases) {
    if (!plan.byKey.has(row.to) && !plan.codeOnly.has(row.to)) {
      problems.push(`Alias "${row.from}" points at "${row.to}", which is not a prop.`);
    }
    if (plan.byKey.has(row.from)) problems.push(`Alias "${row.from}" is also a field.`);
  }

  if (def.defaults && typeof def.defaults === "object") {
    const result = validateProps(def, def.defaults);
    for (const issue of result.issues) {
      if (issue.code === "missing-prop" || issue.severity === "warning") continue;
      problems.push(`Default ${issue.message}`);
    }
  }

  (options.examples ?? []).forEach((example, index) => {
    const result = validateProps(def, example, { path: `examples[${index}]` });
    for (const issue of result.issues) {
      if (issue.severity === "warning") continue;
      problems.push(issue.message);
    }
  });

  if (problems.length) {
    throw new Error(
      `Definition "${def.id}" is incomplete:\n${problems.map((p) => `- ${p}`).join("\n")}`,
    );
  }
}
