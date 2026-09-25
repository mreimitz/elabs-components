/**
 * resolve-props — fills the props a caller left out, from the definition.
 *
 * Order, first defined wins: the caller's prop, the kind's `defaults`, the
 * kind's own field default, the group default, then a context default (a
 * field's `default` function, called with `ctx`). Deprecated fields are never
 * filled. Pure: when nothing needs filling the input object is returned
 * as is, so a memoised caller sees a stable reference.
 *
 * React-free.
 */

import type { AnyComponentDefinition } from "./component-definition";
import { planOf } from "./effective-fields";

type IsValueDefault<F> = F extends { readonly deprecated: object }
  ? false
  : F extends { readonly default: infer D }
    ? D extends (...args: never[]) => unknown
      ? false
      : true
    : false;

type OwnDefaultKeys<F> = {
  [K in keyof F]: IsValueDefault<F[K]> extends true ? K : never;
}[keyof F];

type GroupDefaultKeys<G> = G extends readonly (infer E)[]
  ? E extends { readonly defaults: infer GD }
    ? keyof GD
    : never
  : never;

/** Keys a literal defaults object sets (a `Partial<P>` sets none for sure). */
type RequiredKeys<T> = {
  [K in keyof T]-?: Record<never, never> extends Pick<T, K> ? never : K;
}[keyof T];

/**
 * The keys `resolveProps` always fills for a definition: its literal kind
 * defaults and the value defaults of its fields and groups. Context defaults
 * are not counted (they run only with a context).
 */
export type DefaultedKeys<D> =
  | (D extends { readonly defaults?: infer Dfl } ? RequiredKeys<NonNullable<Dfl>> : never)
  | (D extends { readonly fields: infer F } ? OwnDefaultKeys<F> : never)
  | (D extends { readonly groups: infer G } ? GroupDefaultKeys<G> : never);

/** `Props` with every key the definition defaults made non-optional. */
export type ResolvedProps<Props, D> =
  string extends DefaultedKeys<D>
    ? Props
    : Props & { [K in DefaultedKeys<D> & keyof Props]-?: Exclude<Props[K], undefined> };

/**
 * Fills defaults into `props`. Context defaults run only when `ctx` is given.
 * Only top-level props are filled; a caller's value is never merged into.
 */
export function resolveProps<D extends AnyComponentDefinition, Props extends object>(
  def: D,
  props: Props,
  ctx?: unknown,
): ResolvedProps<Props, D> {
  const plan = planOf(def);
  const input = props as Record<string, unknown>;
  let out: Record<string, unknown> | undefined;
  for (const step of plan.fill) {
    if (input[step.key] !== undefined) continue;
    let value: unknown;
    if ("value" in step) value = step.value;
    else if (ctx !== undefined) value = step.fromContext(ctx);
    if (value === undefined) continue;
    out ??= { ...input };
    out[step.key] = value;
  }
  return (out ?? props) as ResolvedProps<Props, D>;
}
