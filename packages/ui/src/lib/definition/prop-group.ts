/**
 * prop-group — a named, reusable set of fields shared by several component
 * kinds (`header`, `a11y`, `status` here; `motion`, `legend`, `palette`… in
 * charts). A group is declared once over a small props interface; every kind
 * that lists it in `groups` gets its fields, and its value defaults become the
 * group tier of `resolveProps`.
 *
 * React-free.
 */

import { isContextDefault, type AnyField, type CompleteFieldMap, type KnownProps } from "./field";

/** Phantom key carrying the props interface a group describes. Never present at runtime. */
declare const GROUP_PROPS: unique symbol;

type IsValueDefault<F> = F extends { readonly deprecated: object }
  ? false
  : F extends { readonly default: infer D }
    ? D extends (...args: never[]) => unknown
      ? false
      : true
    : false;

/**
 * The literal value defaults of a field map: every non-deprecated field whose
 * `default` is a value (a context function is resolved later, never here).
 */
export type GroupDefaults<F> = {
  readonly [K in keyof F as IsValueDefault<F[K]> extends true ? K : never]: F[K] extends {
    readonly default: infer D;
  }
    ? D
    : never;
};

/** A prop group: its id, its fields, and the value defaults read from them. */
export interface PropGroup<P, Id extends string = string, F = CompleteFieldMap<P>> {
  readonly id: Id;
  readonly fields: F;
  readonly defaults: GroupDefaults<F>;
  readonly [GROUP_PROPS]?: (props: P) => P;
}

/** Any prop group, whatever props it describes — what runtime code reads. */
export interface AnyPropGroup {
  readonly id: string;
  readonly fields: Readonly<Record<string, AnyField>>;
  readonly defaults: Readonly<Record<string, unknown>>;
}

type NoExtraKeys<F, P> = {
  readonly [K in Exclude<keyof F, keyof KnownProps<P>>]: "is not a prop of this group";
};

/** The value defaults of a field map, computed at runtime (see `GroupDefaults`). */
export function valueDefaultsOf(
  fields: Readonly<Record<string, AnyField | undefined>>,
): Readonly<Record<string, unknown>> {
  const defaults: Record<string, unknown> = {};
  for (const key of Object.keys(fields)) {
    const f = fields[key];
    if (!f || f.deprecated || f.default === undefined || isContextDefault(f.default)) continue;
    defaults[key] = f.default;
  }
  return Object.freeze(defaults);
}

/**
 * Declares a prop group over a props interface `P`. Curried so `P` is given
 * explicitly while the fields keep their literal types:
 *
 * ```ts
 * export const a11yGroup = definePropGroup<A11yGroupProps>()({
 *   id: "a11y",
 *   fields: { accessibleLabel: field.string(), accessibleDescription: field.string() },
 * });
 * ```
 *
 * Every prop of `P` needs a field, each field's value type must match its
 * prop, and a key `P` does not have is a compile error. `defaults` is typed
 * `as const` and holds every non-deprecated value default.
 */
export function definePropGroup<P>() {
  return <const Id extends string, const F extends CompleteFieldMap<P>>(group: {
    readonly id: Id;
    readonly fields: F & NoExtraKeys<F, P>;
  }): PropGroup<P, Id, F> => {
    const fields = group.fields as unknown as Readonly<Record<string, AnyField>>;
    return Object.freeze({
      id: group.id,
      fields: group.fields,
      defaults: valueDefaultsOf(fields),
    }) as unknown as PropGroup<P, Id, F>;
  };
}
