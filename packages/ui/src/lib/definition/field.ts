/**
 * field — the field vocabulary of the definition base.
 *
 * One small, closed set of kinds describes every serialisable prop a component
 * kind takes: `string | number | integer | boolean | enum | color | responsive |
 * object | array | union`. A field is plain data (a default, bounds, a unit, a
 * tier, a declarative `appliesWhen`, a deprecation), so a definition can be
 * validated, turned into JSON Schema and snapshotted without running a
 * component. Callbacks and `ReactNode` props have no kind; a definition lists
 * them by name in `codeOnly` instead.
 *
 * Every field is phantom-typed with the TypeScript value it describes, so a
 * `FieldMap<P>` is checked against a props type `P`: the field's value type
 * must match the prop's type exactly (readonly and mutable arrays count as
 * the same), and a required prop needs `required: true`.
 *
 * React-free: this module imports nothing.
 */

/** Phantom key carrying a field's value type. Never present at runtime. */
declare const FIELD_VALUE: unique symbol;

/** The closed set of field kinds. */
export type FieldKind =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "enum"
  | "color"
  | "responsive"
  | "object"
  | "array"
  | "union";

/** `essential` fields come first in an editor; `advanced` ones sit behind a disclosure. */
export type FieldTier = "essential" | "advanced";

/** The unit a numeric field is measured in (`fraction` is 0–1). */
export type FieldUnit = "px" | "ms" | "s" | "fraction" | "percent" | "deg";

/** A value an `enum` field can take, and what `appliesWhen` compares against. */
export type FieldPrimitive = string | number | boolean;

/**
 * When a field applies, as data (so it serialises and maps onto a form's
 * `visibleWhen`): another field of the same component equals one value, or is
 * one of several.
 */
export type AppliesWhen =
  | { readonly field: string; readonly equals: FieldPrimitive }
  | { readonly field: string; readonly in: readonly FieldPrimitive[] };

/** A field kept for compatibility: when it was deprecated, what replaces it, when it goes. */
export interface FieldDeprecation {
  readonly since: string;
  readonly replacement?: string;
  readonly removeIn: string;
}

/**
 * A default computed from context — the theme-token tier. Pure. The parameter
 * is checked bivariantly, so a function typed for a specific context
 * (`(ctx: ChartThemeContext) => …`) fits.
 */
export type DefaultFromContext<T> = {
  bivarianceHack(ctx: unknown): T;
}["bivarianceHack"];

/** Options every field kind takes. */
export interface FieldOptions<T> {
  /** A value, or a pure function of context (the theme-token tier). */
  readonly default?: T | DefaultFromContext<T>;
  /** The prop must be present. Must match the props type: required there, `true` here. */
  readonly required?: boolean;
  /** `null` is also a valid value. */
  readonly nullable?: boolean;
  readonly tier?: FieldTier;
  readonly appliesWhen?: AppliesWhen;
  readonly deprecated?: FieldDeprecation;
  /** One short line. Long prose stays in the prop's TSDoc. */
  readonly description?: string;
}

/** `min`/`max` bound the string's length. */
export interface StringFieldOptions extends FieldOptions<string> {
  readonly min?: number;
  readonly max?: number;
}

export interface NumberFieldOptions extends FieldOptions<number> {
  readonly min?: number;
  readonly max?: number;
  readonly unit?: FieldUnit;
}

export type BooleanFieldOptions = FieldOptions<boolean>;

export interface EnumFieldOptions extends FieldOptions<FieldPrimitive> {
  readonly values: readonly FieldPrimitive[];
}

/** A colour: a token reference or a CSS colour string. */
export type ColorFieldOptions = FieldOptions<string>;

/**
 * One value for every breakpoint, or `{ base, <breakpoint>?: … }`. The caller
 * passes its own override keys (`base` is always the fallback), so this module
 * never needs to know any package's breakpoints.
 */
export interface ResponsiveFieldOptions extends FieldOptions<unknown> {
  readonly of: AnyField;
  readonly breakpoints: readonly string[];
}

/** `open: true` accepts keys beyond `fields` (a data row, a free-form record). */
export interface ObjectFieldOptions extends FieldOptions<unknown> {
  readonly fields: Readonly<Record<string, AnyField>>;
  readonly open?: boolean;
}

/** `min`/`max` bound the number of items. */
export interface ArrayFieldOptions extends FieldOptions<unknown> {
  readonly of: AnyField;
  readonly min?: number;
  readonly max?: number;
}

/** A value that matches any one of `of` (`number | { aspect: number }`). */
export interface UnionFieldOptions extends FieldOptions<unknown> {
  readonly of: readonly AnyField[];
}

// ── Runtime shapes ───────────────────────────────────────────────────────────

interface FieldShapeBase {
  readonly default?: unknown;
  readonly required?: boolean;
  readonly nullable?: boolean;
  readonly tier?: FieldTier;
  readonly appliesWhen?: AppliesWhen;
  readonly deprecated?: FieldDeprecation;
  readonly description?: string;
}

export interface StringFieldShape extends FieldShapeBase {
  readonly kind: "string";
  readonly min?: number;
  readonly max?: number;
}

export interface NumberFieldShape extends FieldShapeBase {
  readonly kind: "number" | "integer";
  readonly min?: number;
  readonly max?: number;
  readonly unit?: FieldUnit;
}

export interface BooleanFieldShape extends FieldShapeBase {
  readonly kind: "boolean";
}

export interface EnumFieldShape extends FieldShapeBase {
  readonly kind: "enum";
  readonly values: readonly FieldPrimitive[];
}

export interface ColorFieldShape extends FieldShapeBase {
  readonly kind: "color";
}

export interface ResponsiveFieldShape extends FieldShapeBase {
  readonly kind: "responsive";
  readonly of: AnyField;
  readonly breakpoints: readonly string[];
}

export interface ObjectFieldShape extends FieldShapeBase {
  readonly kind: "object";
  readonly fields: Readonly<Record<string, AnyField>>;
  readonly open?: boolean;
}

export interface ArrayFieldShape extends FieldShapeBase {
  readonly kind: "array";
  readonly of: AnyField;
  readonly min?: number;
  readonly max?: number;
}

export interface UnionFieldShape extends FieldShapeBase {
  readonly kind: "union";
  readonly of: readonly AnyField[];
}

/** Any field, whatever value type it describes — what runtime code switches on. */
export type AnyField =
  | StringFieldShape
  | NumberFieldShape
  | BooleanFieldShape
  | EnumFieldShape
  | ColorFieldShape
  | ResponsiveFieldShape
  | ObjectFieldShape
  | ArrayFieldShape
  | UnionFieldShape;

// ── Type-level value mapping ─────────────────────────────────────────────────

type Phantom<T> = { readonly [FIELD_VALUE]?: (value: T) => T };

type Simplify<T> = { [K in keyof T]: T[K] } & unknown;

/** A field that describes values of type `T`. */
export type Field<T> = AnyField & Phantom<T>;

/** The value type a field describes (`unknown` for an untyped `AnyField`). */
export type FieldValue<F> = F extends { readonly [FIELD_VALUE]?: (value: infer T) => unknown }
  ? T
  : never;

/**
 * A value type in the form fields compare in: every array readonly, every
 * object mapped member by member. `string[]` and `readonly string[]` props
 * therefore match the same `field.array`.
 */
export type NormalizedValue<V> = V extends (...args: never[]) => unknown
  ? V
  : V extends readonly (infer E)[]
    ? readonly NormalizedValue<E>[]
    : V extends object
      ? { [K in keyof V]: NormalizedValue<V[K]> }
      : V;

/** `T`, or `{ base: T, <breakpoint>?: T }`. */
export type ResponsiveValue<T, B extends string> =
  | T
  | Simplify<{ readonly base: T } & { readonly [K in B]?: T }>;

type IsRequiredField<F> = F extends { readonly required: true } ? true : false;

/** The object a `field.object({ fields })` describes. */
export type ObjectValue<FS, Open> = Simplify<
  {
    [K in keyof FS as IsRequiredField<FS[K]> extends true ? K : never]: FieldValue<FS[K]>;
  } & {
    [K in keyof FS as IsRequiredField<FS[K]> extends true ? never : K]?: FieldValue<FS[K]>;
  }
> &
  (Open extends true ? { [key: string]: unknown } : unknown);

type RequiredFlag<O> = O extends { readonly required: true }
  ? { readonly required: true }
  : { readonly required?: false };

type WithNull<T, O> = O extends { readonly nullable: true } ? T | null : T;

/** What a builder returns: the kind, the options as passed, and the phantom value type. */
export type BuiltField<K extends FieldKind, T, O> = { readonly kind: K } & Omit<O, "required"> &
  RequiredFlag<O> &
  Phantom<NormalizedValue<WithNull<T, O>>>;

/** Rejects a `default` that is not a `T` (for kinds whose `T` comes from nested fields). */
type DefaultGuard<O, T> = O extends { readonly default: infer D }
  ? [D] extends [T | DefaultFromContext<T>]
    ? unknown
    : { readonly default: T | DefaultFromContext<T> }
  : unknown;

type EmptyOptions = Record<never, never>;

// ── Checking a field map against a props type ────────────────────────────────

type IsOptionalKey<P, K extends keyof P> = Record<never, never> extends Pick<P, K> ? true : false;

/** The field a prop `K` of `P` needs: same value type, and `required: true` when `K` is required. */
export type FieldFor<P, K extends keyof P> = AnyField &
  Phantom<NormalizedValue<Exclude<P[K], undefined>>> &
  (IsOptionalKey<P, K> extends true ? { readonly required?: false } : { readonly required: true });

/**
 * `P` without its index signatures: only the props it names. React Flow node
 * data (`extends Record<string, unknown>`) is checked by its named props.
 */
export type KnownProps<P> = {
  [K in keyof P as string extends K
    ? never
    : number extends K
      ? never
      : symbol extends K
        ? never
        : K]: P[K];
};

/** The named prop keys of `P`. */
export type KnownKey<P> = keyof KnownProps<P> & string;

/** Fields for some props of `P`, each checked against its prop's type. */
export type FieldMap<P> = { readonly [K in KnownKey<P>]?: FieldFor<KnownProps<P>, K> };

/** Fields for every prop of `P` (a prop group describes its whole interface). */
export type CompleteFieldMap<P> = { readonly [K in KnownKey<P>]: FieldFor<KnownProps<P>, K> };

// ── Builders ─────────────────────────────────────────────────────────────────

function build<K extends FieldKind, T, O>(kind: K, options: O | undefined): BuiltField<K, T, O> {
  return { ...options, kind } as BuiltField<K, T, O>;
}

/**
 * The field builders. Each takes its options as one object and keeps their
 * literal types, so a group's `defaults` are typed `as const`.
 *
 * ```ts
 * field.number({ default: 0.2, min: 0, max: 1, unit: "fraction" })
 * field.enum({ values: ["vertical", "horizontal"], default: "vertical" })
 * field.responsive({ of: field.number({ min: 0 }), breakpoints: ["medium", "narrow"] })
 * ```
 */
export const field = {
  string<const O extends StringFieldOptions = EmptyOptions>(
    options?: O,
  ): BuiltField<"string", string, O> {
    return build("string", options);
  },
  number<const O extends NumberFieldOptions = EmptyOptions>(
    options?: O,
  ): BuiltField<"number", number, O> {
    return build("number", options);
  },
  integer<const O extends NumberFieldOptions = EmptyOptions>(
    options?: O,
  ): BuiltField<"integer", number, O> {
    return build("integer", options);
  },
  boolean<const O extends BooleanFieldOptions = EmptyOptions>(
    options?: O,
  ): BuiltField<"boolean", boolean, O> {
    return build("boolean", options);
  },
  enum<const O extends EnumFieldOptions>(
    options: O & DefaultGuard<O, O["values"][number]>,
  ): BuiltField<"enum", O["values"][number], O> {
    return build("enum", options);
  },
  color<const O extends ColorFieldOptions = EmptyOptions>(
    options?: O,
  ): BuiltField<"color", string, O> {
    return build("color", options);
  },
  responsive<const O extends ResponsiveFieldOptions>(
    options: O & DefaultGuard<O, ResponsiveValue<FieldValue<O["of"]>, O["breakpoints"][number]>>,
  ): BuiltField<"responsive", ResponsiveValue<FieldValue<O["of"]>, O["breakpoints"][number]>, O> {
    return build("responsive", options);
  },
  object<const O extends ObjectFieldOptions>(
    options: O & DefaultGuard<O, ObjectValue<O["fields"], O["open"]>>,
  ): BuiltField<"object", ObjectValue<O["fields"], O["open"]>, O> {
    return build("object", options);
  },
  array<const O extends ArrayFieldOptions>(
    options: O & DefaultGuard<O, readonly FieldValue<O["of"]>[]>,
  ): BuiltField<"array", readonly FieldValue<O["of"]>[], O> {
    return build("array", options);
  },
  union<const O extends UnionFieldOptions>(
    options: O & DefaultGuard<O, FieldValue<O["of"][number]>>,
  ): BuiltField<"union", FieldValue<O["of"][number]>, O> {
    return build("union", options);
  },
};

/** True when `value` is a context default (a function) rather than a value default. */
export function isContextDefault(value: unknown): value is DefaultFromContext<unknown> {
  return typeof value === "function";
}
