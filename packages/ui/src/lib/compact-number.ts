/**
 * compact-number.ts — the same "shown short, copied exact" number rule the
 * charts package applies to axis ticks and tooltips, available to `ui` surfaces
 * that display a figure (today: `MetricCard`).
 *
 * DELIBERATE TWIN of `packages/charts/src/charts/value-format.ts`. Dependencies
 * flow one way — `tokens → ui → charts` — so `ui` cannot import the charts
 * module, and a chart-domain union does not belong in the `ui` public API just
 * to be shared. The duplication is ~20 lines and the two must stay in step:
 * **change one, change the other**, and keep {@link COMPACT_THRESHOLD} equal in
 * both. `metric-card.test.tsx` and `value-format.test.ts` pin the same cases on
 * each side so a drift shows up as a failing test rather than as two surfaces
 * disagreeing about what `1500` looks like.
 */

/** How a numeric value is rendered. Mirrors the charts `ChartValueFormatPreset`. */
export type NumberFormatKind = "number" | "compact" | "currency" | "percent";

/**
 * The object form of {@link NumberFormat} (RM-109) — decimals, sign,
 * prefix/suffix and abbreviation as independent knobs. Mirrors the charts
 * `ChartValueFormatSpec` field-for-field; see that type's docblock
 * (`packages/charts/src/charts/value-format.ts`) for the full contract of
 * each field — this is the DELIBERATE TWIN, not a reinterpretation.
 */
export interface NumberFormatSpec {
  style?: "number" | "currency" | "percent";
  decimals?: number;
  optionalDecimals?: boolean;
  abbreviate?: boolean | "auto";
  sign?: "auto" | "always" | "parens";
  prefix?: string;
  suffix?: string;
  grouping?: boolean;
  currency?: string;
}

/** A preset string or the {@link NumberFormatSpec} object form (RM-109). */
export type NumberFormat = NumberFormatKind | NumberFormatSpec;

/** The preset strings' shape, expressed as specs — the union's one resolved shape. */
const PRESET_NUMBER_FORMAT_SPECS: Record<NumberFormatKind, NumberFormatSpec> = {
  number: { style: "number", abbreviate: false },
  compact: { style: "number", abbreviate: "auto" },
  currency: { style: "currency", abbreviate: "auto" },
  percent: { style: "percent", abbreviate: false },
};

/** Normalizes a preset string or a spec object to one {@link NumberFormatSpec} shape. */
export function resolveNumberFormatSpec(format: NumberFormat): NumberFormatSpec {
  return typeof format === "string"
    ? (PRESET_NUMBER_FORMAT_SPECS[format] ?? PRESET_NUMBER_FORMAT_SPECS.compact)
    : format;
}

/** Magnitude at or above which `compact`/`currency` switch to compact notation. */
export const COMPACT_THRESHOLD = 1000;

/** Used when a caller asks for currency without naming one. */
export const DEFAULT_CURRENCY = "USD";

/** One decimal keeps `1.5M` readable without implying precision it lacks. */
export const DEFAULT_MAX_FRACTION_DIGITS = 1;

/** Whether `value`'s magnitude earns compact notation. */
export function shouldCompact(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value) >= COMPACT_THRESHOLD;
}

/**
 * The full answer for `format` at this magnitude: `Intl.NumberFormatOptions`
 * plus the two things Intl cannot express — literal `prefix`/`suffix` text
 * and `sign: "parens"` (accounting-style negatives). Twin of
 * `resolveChartValueFormat` (`value-format.ts`) — same fields, same rules.
 */
export interface ResolvedNumberFormat {
  /** Pure `Intl.NumberFormatOptions` — everything Intl itself can render. */
  options: Intl.NumberFormatOptions;
  /** Literal text before the formatted number. */
  prefix: string;
  /** Literal text after the formatted number. */
  suffix: string;
  /** `true` when a negative value renders as `(…)` instead of a minus sign. */
  parens: boolean;
}

export function resolveNumberFormat(
  format: NumberFormat,
  value: number,
  currency: string = DEFAULT_CURRENCY,
  maxFractionDigits?: number,
): ResolvedNumberFormat {
  const spec = resolveNumberFormatSpec(format);
  const style = spec.style ?? "number";
  const isPercent = style === "percent";
  const options: Intl.NumberFormatOptions = {};

  if (style === "currency") {
    options.style = "currency";
    options.currency = spec.currency ?? currency;
  } else if (isPercent) {
    options.style = "percent";
  }

  const wantsAbbreviate =
    !isPercent && (spec.abbreviate === true || (spec.abbreviate !== false && shouldCompact(value)));
  if (wantsAbbreviate) {
    options.notation = "compact";
    options.compactDisplay = "short";
  }

  const exactValueEscapeHatch = style === "number" && spec.abbreviate === false;
  const digits =
    spec.decimals ??
    maxFractionDigits ??
    (exactValueEscapeHatch ? undefined : DEFAULT_MAX_FRACTION_DIGITS);
  if (digits !== undefined) {
    options.maximumFractionDigits = digits;
    if (spec.optionalDecimals === false) {
      options.minimumFractionDigits = digits;
    }
  }

  if (spec.grouping === false) {
    options.useGrouping = false;
  }

  let parens = false;
  if (spec.sign === "always") {
    options.signDisplay = "always";
  } else if (spec.sign === "parens") {
    options.signDisplay = "never";
    parens = true;
  }

  return { options, prefix: spec.prefix ?? "", suffix: spec.suffix ?? "", parens };
}

/**
 * `Intl.NumberFormatOptions` for `format` at this magnitude — the pure-Intl
 * subset of {@link resolveNumberFormat}, kept as its own export because it is
 * the one every existing call site (and test) already depends on.
 */
export function numberFormatOptions(
  format: NumberFormatKind,
  value: number,
  currency: string = DEFAULT_CURRENCY,
  maxFractionDigits?: number,
): Intl.NumberFormatOptions {
  return resolveNumberFormat(format, value, currency, maxFractionDigits).options;
}
