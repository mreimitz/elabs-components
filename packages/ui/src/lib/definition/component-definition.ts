/**
 * component-definition — what a component kind is, as data.
 *
 * A definition lists a kind's props (own `fields` plus shared `groups`), the
 * props that only code can pass (`codeOnly`: callbacks, `ReactNode`), the
 * kind's defaults, what it can bind data to (`targets`), renamed props
 * (`aliases`) and how to upgrade old serialised input (`migrate`). It has no
 * `component`: a registry binds components to definitions elsewhere, so a
 * definition can be imported by a validator, a schema generator or a CLI
 * without pulling in React.
 *
 * React-free.
 */

import type { AliasInput } from "./aliases";
import type { AnyField, FieldFor, FieldMap, KnownKey, KnownProps } from "./field";
import type { AnyPropGroup } from "./prop-group";

/** Phantom key carrying a definition's props type. Never present at runtime. */
declare const DEFINITION_PROPS: unique symbol;

/**
 * Something a component binds data to: a chart's dimension or measure, a
 * node's port. `min`/`max` bound how many bindings it takes (`max: null` is
 * unbounded). Kinds extend it with their own keys (`role`, `side`, …).
 */
export interface TargetDescriptor {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly min: number;
  readonly max: number | null;
}

/**
 * The definition of a component kind with props `P`, a resolve context `Ctx`
 * (what context defaults and `normalize` read, e.g. the theme) and targets `T`.
 */
export interface ComponentDefinition<
  P,
  Ctx = unknown,
  T extends readonly TargetDescriptor[] = readonly TargetDescriptor[],
> {
  /** Stable id (`"BarChart"`, `"flow.task"`). */
  readonly id: string;
  /** Version of the serialised input shape; `migrate` upgrades older input. */
  readonly version: number;
  readonly label: string;
  readonly description?: string;
  /** Shared prop groups, in order; a later group's field wins over an earlier one's. */
  readonly groups: readonly AnyPropGroup[];
  /** The kind's own fields. An own field overrides a group field with the same key. */
  readonly fields: FieldMap<P>;
  /** Props only code can pass (callbacks, `ReactNode`): allowed, never described. */
  readonly codeOnly: readonly KnownKey<P>[];
  /** Kind defaults: win over field and group defaults. */
  readonly defaults?: Partial<P>;
  readonly targets: T;
  /** Final pure clean-up after defaults are filled (clamping, derived values). */
  normalize?(props: P, ctx: Ctx): P;
  /** Renamed props, as rows or the `{ oldName: "newName" }` shorthand. */
  readonly aliases?: AliasInput;
  /** Upgrades serialised input written against an older `version`. Pure. */
  migrate?(input: Readonly<Record<string, unknown>>, fromVersion: number): Record<string, unknown>;
  readonly [DEFINITION_PROPS]?: (props: P) => P;
}

/** Any definition, whatever its props — what runtime code (validate, schema, snapshot) reads. */
export interface AnyComponentDefinition {
  readonly id: string;
  readonly version: number;
  readonly label: string;
  readonly description?: string;
  readonly groups: readonly AnyPropGroup[];
  readonly fields: Readonly<Record<string, AnyField | undefined>>;
  readonly codeOnly: readonly string[];
  readonly defaults?: object;
  readonly targets: readonly TargetDescriptor[];
  normalize?(props: never, ctx: never): unknown;
  readonly aliases?: AliasInput;
  migrate?(input: Readonly<Record<string, unknown>>, fromVersion: number): Record<string, unknown>;
}

/** The props type a definition describes. */
export type PropsOf<D> = D extends {
  readonly [DEFINITION_PROPS]?: (props: infer P) => unknown;
}
  ? P
  : never;

type GroupOf<G> = G extends readonly (infer E)[] ? E : never;

/** Every key the definition's groups declare. */
export type GroupFieldKeys<G> =
  GroupOf<G> extends infer E
    ? E extends { readonly fields: infer GF }
      ? keyof GF & string
      : never
    : never;

/** Every old prop name the aliases list. */
export type AliasFromKeys<A> = A extends readonly (infer R)[]
  ? R extends { readonly from: infer K extends string }
    ? K
    : never
  : A extends Readonly<Record<string, string>>
    ? keyof A & string
    : never;

type BadGroupKeys<P, G, F> =
  GroupOf<G> extends infer E
    ? E extends { readonly fields: infer GF }
      ? {
          [K in Exclude<keyof GF, keyof F>]: K extends keyof KnownProps<P>
            ? GF[K] extends FieldFor<KnownProps<P>, K>
              ? never
              : K
            : K;
        }[Exclude<keyof GF, keyof F>]
      : never
    : never;

type Problem<Name extends string, Keys> = [Keys] extends [never]
  ? unknown
  : { readonly [K in Name]: Keys };

/**
 * Compile-time checks on a definition: each failing check adds a required
 * property named after the problem, whose type lists the offending keys.
 */
export type DefinitionChecks<P, G, F, Dfl> = Problem<
  "fieldsNotInProps",
  Exclude<keyof F, keyof KnownProps<P>>
> &
  Problem<"defaultsNotInProps", Exclude<keyof Dfl, keyof KnownProps<P>>> &
  Problem<"groupFieldsNotMatchingProps", BadGroupKeys<P, G, F>>;

/** A definition as `defineComponent` returns it: the base type, plus its literal parts. */
export type DefinedComponent<
  P,
  Ctx,
  T extends readonly TargetDescriptor[],
  Id extends string,
  G extends readonly AnyPropGroup[],
  F extends FieldMap<P>,
  C extends readonly KnownKey<P>[],
  Dfl extends Partial<P>,
  A extends AliasInput,
> = Omit<
  ComponentDefinition<P, Ctx, T>,
  "id" | "groups" | "fields" | "codeOnly" | "defaults" | "aliases"
> & {
  readonly id: Id;
  readonly groups: G;
  readonly fields: F;
  readonly codeOnly: C;
  readonly defaults?: Dfl;
  readonly aliases?: A;
};

/**
 * Declares a component definition over a props type `P` (curried, so `P` is
 * explicit while the rest keeps its literal types). An identity function: the
 * value it returns is the object it was given.
 *
 * ```ts
 * export const BAR_CHART = defineComponent<BarChartProps>()({
 *   id: "BarChart", version: 1, label: "Bar chart",
 *   groups: [a11yGroup],
 *   fields: { barGap: field.number({ min: 0, max: 1, unit: "fraction" }) },
 *   codeOnly: ["children", "onDatapointClick"],
 *   defaults: { barGap: 0.2 },
 *   targets: [{ id: "x", label: "Category", min: 1, max: 1 }],
 * });
 * ```
 *
 * Checked at compile time: every field and default key is a prop of `P`,
 * each field's value type matches its prop (a required prop needs
 * `required: true`), every group field not overridden by an own field
 * matches `P` too, and every `codeOnly` key is a prop. `defaults` is checked
 * against `Partial<P>` without being made readonly, so a mutable array prop
 * takes an array default.
 */
export function defineComponent<
  P,
  Ctx = unknown,
  TD extends TargetDescriptor = TargetDescriptor,
>() {
  return <
    const Id extends string,
    const T extends readonly TD[],
    const G extends readonly AnyPropGroup[],
    F extends FieldMap<P>,
    const C extends readonly KnownKey<P>[],
    Dfl extends Partial<P> = Record<never, never>,
    const A extends AliasInput = readonly [],
  >(
    def: {
      readonly id: Id;
      readonly version: number;
      readonly label: string;
      readonly description?: string;
      readonly groups: G;
      readonly fields: F;
      readonly codeOnly: C;
      readonly defaults?: Dfl;
      readonly targets: T;
      normalize?(props: P, ctx: Ctx): P;
      readonly aliases?: A;
      migrate?(
        input: Readonly<Record<string, unknown>>,
        fromVersion: number,
      ): Record<string, unknown>;
    } & DefinitionChecks<P, G, F, Dfl>,
  ): DefinedComponent<P, Ctx, T, Id, G, F, C, Dfl, A> =>
    def as unknown as DefinedComponent<P, Ctx, T, Id, G, F, C, Dfl, A>;
}
