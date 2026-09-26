/**
 * typed-field — pins a field to a prop type the field vocabulary cannot
 * describe exactly (ADR 0042 §3–4, RM-174).
 *
 * A prop group needs one field per member, and each field's value type must
 * equal its prop's type. A few chart members hold values JSON cannot carry:
 * a `ReactNode` inside a config (`legend.title`, `empty.action`), a DOM
 * element or ref (`tooltipAvoid`), a function inside a union (`enterTransition`,
 * `referenceLines[].value`). The field vocabulary has no kind for those, and a
 * definition's `codeOnly` names top-level props only. These two helpers say
 * how such a field relates to its prop, and the compiler checks the claim:
 *
 * - `partialFieldFor<T>()(f)`: `f` describes the serializable part of `T`.
 *   Every value `f` describes is a `T`; the members it leaves out stay
 *   code-only.
 * - `looseFieldFor<T>()(f)`: `f` accepts every `T`, but cannot narrow it
 *   further (a free-form record: the vocabulary has no record kind).
 *
 * Both return the field unchanged at runtime. Pure: types only at the top level.
 */

import type {
  AnyField,
  BuiltField,
  FieldValue,
  NormalizedValue,
} from "@elabs-ai/components-ui/definition";

/** The options `F` was built with: every member but its kind and its value type. */
type OptionsOf<F> = { [K in keyof F as K extends symbol | "kind" ? never : K]: F[K] };

/** The value type a prop of type `T` needs its field to describe. */
type PropValue<T> = NormalizedValue<Exclude<T, undefined>>;

/**
 * A field with `F`'s kind and options that a prop group accepts for a prop of
 * type `T`. Spelled as a `BuiltField` so a group's declared type stays short.
 */
export type TypedField<F extends AnyField, T> = BuiltField<
  F["kind"],
  Exclude<T, undefined>,
  OptionsOf<F>
>;

/** No extra argument when the claim holds; otherwise one the caller cannot pass. */
type DescribesPartOf<F, T> = [FieldValue<F>] extends [PropValue<T>]
  ? []
  : [describesValuesThePropRejects: never];

type AcceptsAllOf<F, T> = [PropValue<T>] extends [FieldValue<F>]
  ? []
  : [rejectsValuesThePropAccepts: never];

/**
 * A field that describes the serializable part of a prop of type `T`. A
 * description that admits a value `T` rejects is a compile error.
 *
 * ```ts
 * empty: partialFieldFor<ChartEmptyState>()(
 *   field.object({ fields: { title: field.string(), message: field.string() } }),
 * ), // `action` is a ReactNode: code-only
 * ```
 */
export function partialFieldFor<T>() {
  return <F extends AnyField>(described: F, ..._claim: DescribesPartOf<F, T>): TypedField<F, T> =>
    described as unknown as TypedField<F, T>;
}

/**
 * A field that accepts every value of a prop of type `T` and cannot narrow it
 * further. A description that rejects a value `T` accepts is a compile error.
 */
export function looseFieldFor<T>() {
  return <F extends AnyField>(described: F, ..._claim: AcceptsAllOf<F, T>): TypedField<F, T> =>
    described as unknown as TypedField<F, T>;
}
