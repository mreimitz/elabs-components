/**
 * define-chart — the three definition kinds of the charts package (ADR 0042 §5, RM-175).
 *
 * - `defineChart`: a chart family (`LineChart`, `BarChart`, …). It adds `specTypes` (the
 *   `ChartSpec` types it renders, 0..n) and `contract` (its runtime value contract, the
 *   `CHART_CONTRACT_SPECS` entry of the test double).
 * - `definePart`: a child primitive that carries config (`XAxis`, `Grid`, `Bar`, …). Renames
 *   on a child primitive live on its part definition, never on the container.
 * - `defineSurface`: an A2UI surface that is not a chart family (`Gauge`, `Sparkline`, …).
 *
 * Each is a thin helper on the ui `ComponentDefinition`, with the same compile-time checks
 * as `defineComponent` (every field and default is a prop, field types match their props,
 * group fields match) plus one of its own: a target read from a container prop names a real
 * prop. Each returns the object it was given, with its `kind`.
 *
 * Pure: types only at the top level; nothing is imported at runtime.
 */

import type { ChartType } from "../auto-chart/chart-spec";
import type {
  AliasInput,
  AnyComponentDefinition,
  AnyPropGroup,
  DefinedComponent,
  DefinitionChecks,
  FieldMap,
  KnownKey,
  TargetDescriptor,
} from "@elabs-ai/components-ui/definition";

import type { ChartContractSpec } from "./contract-types";

/** Where a target's column comes from. */
export type ChartTargetSource =
  /** A container prop names the column (`xDataKey`). */
  | { readonly prop: string }
  /** Each child part of this kind names one column with its prop (`<Bar dataKey>`). */
  | { readonly part: string; readonly prop: string }
  /** A fixed row key the chart always reads (`open`, `time`). */
  | { readonly field: string };

/**
 * What a chart binds data to: a `dimension` (the categories or instants the marks sit at)
 * or a `measure` (the values they encode).
 */
export interface ChartTargetDescriptor extends TargetDescriptor {
  readonly role: "dimension" | "measure";
  readonly from: ChartTargetSource;
}

/** The definition kinds. */
export type ChartDefinitionKind = "chart" | "part" | "surface";

/** The keys every kind's input shares with `defineComponent`'s. */
interface DefinitionInput<
  P,
  Ctx,
  Id extends string,
  T,
  G extends readonly AnyPropGroup[],
  F extends FieldMap<P>,
  C extends readonly KnownKey<P>[],
  Dfl extends Partial<P>,
  A extends AliasInput,
> {
  readonly id: Id;
  readonly version: number;
  readonly label: string;
  readonly description?: string;
  readonly groups: G;
  readonly fields: F;
  readonly codeOnly: C;
  /** Kind defaults, copied verbatim from the component's destructuring. */
  readonly defaults: Dfl;
  readonly targets: T;
  normalize?(props: P, ctx: Ctx): P;
  readonly aliases?: A;
  migrate?(input: Readonly<Record<string, unknown>>, fromVersion: number): Record<string, unknown>;
}

type TargetPropKeys<T> = T extends readonly (infer E)[]
  ? E extends { readonly from: infer S }
    ? S extends { readonly part: string }
      ? never
      : S extends { readonly prop: infer K extends string }
        ? K
        : never
    : never
  : never;

/** A target read from a container prop must name a prop of `P`. */
type TargetChecks<P, T> = [Exclude<TargetPropKeys<T>, KnownKey<P>>] extends [never]
  ? unknown
  : { readonly targetPropsNotInProps: Exclude<TargetPropKeys<T>, KnownKey<P>> };

/** A chart family's definition, as `defineChart` returns it. */
export type DefinedChart<
  P,
  Ctx,
  Id extends string,
  S extends readonly ChartType[],
  T extends readonly ChartTargetDescriptor[],
  G extends readonly AnyPropGroup[],
  F extends FieldMap<P>,
  C extends readonly KnownKey<P>[],
  Dfl extends Partial<P>,
  A extends AliasInput,
> = DefinedComponent<P, Ctx, T, Id, G, F, C, Dfl, A> & {
  readonly kind: "chart";
  readonly defaults: Dfl;
  readonly specTypes: S;
  readonly contract: ChartContractSpec;
};

/** A part's definition, as `definePart` returns it. */
export type DefinedPart<
  P,
  Ctx,
  Id extends string,
  T extends readonly TargetDescriptor[],
  G extends readonly AnyPropGroup[],
  F extends FieldMap<P>,
  C extends readonly KnownKey<P>[],
  Dfl extends Partial<P>,
  A extends AliasInput,
> = DefinedComponent<P, Ctx, T, Id, G, F, C, Dfl, A> & {
  readonly kind: "part";
  readonly defaults: Dfl;
};

/** A surface's definition, as `defineSurface` returns it. */
export type DefinedSurface<
  P,
  Ctx,
  Id extends string,
  T extends readonly ChartTargetDescriptor[],
  G extends readonly AnyPropGroup[],
  F extends FieldMap<P>,
  C extends readonly KnownKey<P>[],
  Dfl extends Partial<P>,
  A extends AliasInput,
> = DefinedComponent<P, Ctx, T, Id, G, F, C, Dfl, A> & {
  readonly kind: "surface";
  readonly defaults: Dfl;
};

/** Any chart family's definition — what the registry and the tests read. */
export interface AnyChartDefinition extends AnyComponentDefinition {
  readonly kind: "chart";
  readonly defaults: object;
  readonly specTypes: readonly ChartType[];
  readonly targets: readonly ChartTargetDescriptor[];
  readonly contract: ChartContractSpec;
}

/** Any part's definition. */
export interface AnyPartDefinition extends AnyComponentDefinition {
  readonly kind: "part";
  readonly defaults: object;
}

/** Any surface's definition. */
export interface AnySurfaceDefinition extends AnyComponentDefinition {
  readonly kind: "surface";
  readonly defaults: object;
  readonly targets: readonly ChartTargetDescriptor[];
}

/**
 * Declares a chart family's definition over its props type `P` (curried, so `P` is explicit
 * while the rest keeps its literal types).
 *
 * ```ts
 * export const BAR_CHART = defineChart<BarChartProps>()({
 *   id: "BarChart", version: 1, label: "Bar chart",
 *   specTypes: ["bar", "diverging-bar"],
 *   groups: [a11yGroup],
 *   fields: { barGap: field.number({ min: 0, max: 1, unit: "fraction" }) },
 *   codeOnly: ["children"],
 *   defaults: { xDataKey: "name", barGap: 0.2 },
 *   targets: [{ id: "x", label: "Category", role: "dimension", from: { prop: "xDataKey" }, min: 1, max: 1 }],
 *   contract: { dataKind: "array", requiredProps: ["data", "children"] },
 * });
 * ```
 */
export function defineChart<P, Ctx = unknown>() {
  return <
    const Id extends string,
    const S extends readonly ChartType[],
    const T extends readonly ChartTargetDescriptor[],
    const G extends readonly AnyPropGroup[],
    F extends FieldMap<P>,
    const C extends readonly KnownKey<P>[],
    Dfl extends Partial<P> = Record<never, never>,
    const A extends AliasInput = readonly [],
  >(
    def: DefinitionInput<P, Ctx, Id, T, G, F, C, Dfl, A> & {
      /** The `ChartSpec` types this family renders: 0..n (a family can serve several). */
      readonly specTypes: S;
      /** The family's runtime value contract, as the `./test` double asserts it. */
      readonly contract: ChartContractSpec;
    } & DefinitionChecks<P, G, F, Dfl> &
      TargetChecks<P, T>,
  ): DefinedChart<P, Ctx, Id, S, T, G, F, C, Dfl, A> =>
    ({ ...def, kind: "chart" }) as unknown as DefinedChart<P, Ctx, Id, S, T, G, F, C, Dfl, A>;
}

/**
 * Declares a part's definition over its props type `P`. A part binds no data of its own
 * (`targets: []` is the usual value): the chart's targets say which part prop names a column.
 */
export function definePart<P, Ctx = unknown>() {
  return <
    const Id extends string,
    const T extends readonly TargetDescriptor[],
    const G extends readonly AnyPropGroup[],
    F extends FieldMap<P>,
    const C extends readonly KnownKey<P>[],
    Dfl extends Partial<P> = Record<never, never>,
    const A extends AliasInput = readonly [],
  >(
    def: DefinitionInput<P, Ctx, Id, T, G, F, C, Dfl, A> & DefinitionChecks<P, G, F, Dfl>,
  ): DefinedPart<P, Ctx, Id, T, G, F, C, Dfl, A> =>
    ({ ...def, kind: "part" }) as unknown as DefinedPart<P, Ctx, Id, T, G, F, C, Dfl, A>;
}

/** Declares a surface's definition over its props type `P`. */
export function defineSurface<P, Ctx = unknown>() {
  return <
    const Id extends string,
    const T extends readonly ChartTargetDescriptor[],
    const G extends readonly AnyPropGroup[],
    F extends FieldMap<P>,
    const C extends readonly KnownKey<P>[],
    Dfl extends Partial<P> = Record<never, never>,
    const A extends AliasInput = readonly [],
  >(
    def: DefinitionInput<P, Ctx, Id, T, G, F, C, Dfl, A> &
      DefinitionChecks<P, G, F, Dfl> &
      TargetChecks<P, T>,
  ): DefinedSurface<P, Ctx, Id, T, G, F, C, Dfl, A> =>
    ({ ...def, kind: "surface" }) as unknown as DefinedSurface<P, Ctx, Id, T, G, F, C, Dfl, A>;
}
