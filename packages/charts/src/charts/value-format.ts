/**
 * value-format.ts — the ONE answer to "how does a number become a string" in
 * `@elabs-ai/components-charts`.
 *
 * Pure by design: types, constants and an `Intl.NumberFormatOptions` builder,
 * with no React and no `Intl` instances (those live behind the locale-keyed
 * cache in `chart-formatters.ts`). That is what lets `chart-spec.ts` — a
 * deliberately React-free, serializable-types module — re-export the format
 * union without gaining a runtime dependency.
 *
 * The default is COMPACT. A chat client, a KPI tile and a chart axis are all
 * narrow surfaces; `50012102.632741` is not a number a reader can take in, and
 * the axis' old hand-rolled `(v / 1000).toFixed(0) + "k"` rendered 1.5 million
 * as `1500k`. Exactness does not disappear — it moves to click-to-copy
 * (`CopyableValue` in `@elabs-ai/components-ui`), which hands over
 * the unrounded value.
 */

/**
 * How a numeric value is rendered.
 *
 * - `"number"` — grouped, no compaction. The escape hatch when a reader needs
 *   the digits in place (`1,500,000`).
 * - `"compact"` — short compact notation above {@link COMPACT_THRESHOLD}
 *   (`1.5M`), plain grouped below it. The default.
 * - `"currency"` — same compaction rule, in a currency (`$1.5M`, `€820`).
 * - `"percent"` — `Intl` percent semantics, so **pass fractions**: `0.42`
 *   renders `42%`. Never compacted; a compact percentage reads as nonsense.
 */
export type ChartValueFormatPreset = "number" | "compact" | "currency" | "percent";

/**
 * The object form of {@link ChartValueFormat} (RM-109) — decimals, sign,
 * prefix/suffix and abbreviation as independent knobs, for the numeral-style
 * strings (`0.[0]`, `+0`, `(0)`, `$0`, `0%`) Datawrapper exposes without
 * shipping a numeral-string PARSER (`dw-charts.md` §3.2): a spec object is
 * type-checked and serializable (`ChartSpec`), a numeral string is neither.
 *
 * Every field is optional and composes with the others:
 * - `style` — `"number"` (default), `"currency"`, or `"percent"` (fraction
 *   in, `%` out, same contract as the `"percent"` preset).
 * - `decimals` — `maximumFractionDigits`. Omitted on a plain `"number"` spec,
 *   Intl's own default (3) applies — the exact-value escape hatch stays
 *   exact. Every other style defaults to {@link DEFAULT_MAX_FRACTION_DIGITS}.
 * - `optionalDecimals` — `true` (default): trailing zeros drop (`"12"`, not
 *   `"12.0"`). `false`: `decimals` is also the MINIMUM, so the count is fixed
 *   (`"12.0"`).
 * - `abbreviate` — `true`: always compact notation. `false`: never. `"auto"`
 *   (default): magnitude-based, {@link shouldCompact} — matches the preset
 *   strings' own rule. Ignored for `style: "percent"`, which is never
 *   compacted (module doc).
 * - `sign` — `"auto"` (default, Intl's own `signDisplay`): minus only.
 *   `"always"`: `+`/`-` on every value. `"parens"`: negatives wrapped in
 *   `(…)` with no minus sign (accounting style), positives unmarked.
 * - `prefix` / `suffix` — literal text glued to the formatted number, e.g.
 *   `suffix: "%"` for a non-percent-styled value already carrying its own
 *   `%` in the data, or `prefix: "$"` when `style: "currency"`'s own
 *   locale-placed symbol is not wanted.
 * - `grouping` — `false` drops the thousands separator (`useGrouping`).
 * - `currency` — ISO 4217 code for `style: "currency"`. Falls back to the
 *   formatter's own `currency` parameter, then `DEFAULT_CHART_CURRENCY`.
 */
export interface ChartValueFormatSpec {
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

/**
 * How a numeric value is rendered — a preset string (the common case, matches
 * every existing call site) or a {@link ChartValueFormatSpec} object for
 * decimals/sign/prefix/suffix/abbreviation control (RM-109). Every consumer
 * (`YAxis`, `ChartLegend`, `MetricCard`, …) resolves either shape through
 * `makeValueFmt`/`valueFormatOptionsForSet`, so axis, labels, tooltip and
 * legend agree on one answer for the same format.
 */
export type ChartValueFormat = ChartValueFormatPreset | ChartValueFormatSpec;

/** Compact is the default everywhere — see the module doc for why. */
export const DEFAULT_CHART_VALUE_FORMAT: ChartValueFormat = "compact";

/** The preset strings' shape, expressed as specs — the union's one resolved shape. */
const PRESET_VALUE_FORMAT_SPECS: Record<ChartValueFormatPreset, ChartValueFormatSpec> = {
  number: { style: "number", abbreviate: false },
  compact: { style: "number", abbreviate: "auto" },
  currency: { style: "currency", abbreviate: "auto" },
  percent: { style: "percent", abbreviate: false },
};

/** Normalizes a preset string or a spec object to one {@link ChartValueFormatSpec} shape. */
export function resolveChartValueFormatSpec(format: ChartValueFormat): ChartValueFormatSpec {
  return typeof format === "string"
    ? (PRESET_VALUE_FORMAT_SPECS[format] ?? PRESET_VALUE_FORMAT_SPECS.compact)
    : format;
}

/**
 * Magnitude at or above which `compact`/`currency` switch to compact notation.
 *
 * Explicit rather than delegated to `Intl`, because ICU's own switch point has
 * moved between versions and a chart's tick labels must not change shape when
 * the runtime updates. Below it, compacting buys nothing: `840` is already as
 * short as it gets.
 */
export const COMPACT_THRESHOLD = 1000;

/** Used when neither the spec nor `ChartConfigProvider` names one. */
export const DEFAULT_CHART_CURRENCY = "USD";

/** One decimal keeps `1.5M` readable without implying precision it lacks. */
export const DEFAULT_MAX_FRACTION_DIGITS = 1;

/** Whether `value`'s magnitude earns compact notation. */
export function shouldCompact(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value) >= COMPACT_THRESHOLD;
}

/**
 * The full answer for `format` **at this magnitude**: `Intl.NumberFormatOptions`
 * plus the two things Intl cannot express — literal `prefix`/`suffix` text and
 * `sign: "parens"` (accounting-style negatives, no native `signDisplay`
 * equivalent outside currency). `value` is a parameter because compaction is
 * magnitude-dependent, and threading it here keeps that decision in one place
 * instead of at every call site.
 *
 * `maxFractionDigits` (or the spec's own `decimals`) is only applied where
 * it is meaningful; a plain `"number"`-styled value with neither set is left
 * to `Intl`'s own default (3), so the exact-value escape hatch really does
 * render the digits.
 */
export interface ResolvedChartValueFormat {
  /** Pure `Intl.NumberFormatOptions` — everything Intl itself can render. */
  options: Intl.NumberFormatOptions;
  /** Literal text before the formatted number (e.g. a spelled-out `"$"` prefix). */
  prefix: string;
  /** Literal text after the formatted number (e.g. `"%"`, `" unemployed"`). */
  suffix: string;
  /** `true` when a negative value renders as `(…)` instead of a minus sign. */
  parens: boolean;
}

export function resolveChartValueFormat(
  format: ChartValueFormat,
  value: number,
  currency: string = DEFAULT_CHART_CURRENCY,
  maxFractionDigits?: number,
): ResolvedChartValueFormat {
  const spec = resolveChartValueFormatSpec(format);
  const style = spec.style ?? "number";
  const isPercent = style === "percent";
  const options: Intl.NumberFormatOptions = {};

  if (style === "currency") {
    options.style = "currency";
    options.currency = spec.currency ?? currency;
  } else if (isPercent) {
    options.style = "percent";
  }

  // Percent is never compacted (module doc: a compact percentage reads as
  // nonsense) — every other style honours `abbreviate`, default magnitude-based.
  const wantsAbbreviate =
    !isPercent && (spec.abbreviate === true || (spec.abbreviate !== false && shouldCompact(value)));
  if (wantsAbbreviate) {
    options.notation = "compact";
    options.compactDisplay = "short";
  }

  // The exact-value escape hatch — a plain, never-abbreviate `"number"` spec
  // (the `"number"` preset's own shape) — skips the forced default decimal so
  // Intl's own 3-digit default renders a small float without rounding it away.
  // Every other combination gets a concrete fraction-digit rung: the caller's
  // request, or the one-decimal compaction default.
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
    // No native `signDisplay` renders "(…)" outside `currencySign: "accounting"`
    // (currency-only) — suppress the sign here and let the string-level
    // formatter (`makeValueFmt`) wrap a negative in parens around `Math.abs`.
    options.signDisplay = "never";
    parens = true;
  }

  return { options, prefix: spec.prefix ?? "", suffix: spec.suffix ?? "", parens };
}

/**
 * `Intl.NumberFormatOptions` for `format` **at this magnitude** — the pure-Intl
 * subset of {@link resolveChartValueFormat}, kept as its own export because it
 * is the one every existing call site (and test) already depends on.
 */
export function valueFormatOptions(
  format: ChartValueFormat,
  value: number,
  currency: string = DEFAULT_CHART_CURRENCY,
  maxFractionDigits?: number,
): Intl.NumberFormatOptions {
  return resolveChartValueFormat(format, value, currency, maxFractionDigits).options;
}

/**
 * `Intl.NumberFormatOptions` for a whole LABEL SET — an axis' ticks, a bar
 * set's value labels, a legend's values — instead of one value.
 *
 * `valueFormatOptions` decides compaction from a single value's own
 * magnitude, which is right for a lone number (a KPI tile, one tooltip
 * value) but wrong for several numbers that form ONE scale: two independent
 * per-value decisions can mix notations within a set ("1K" beside "400"),
 * which makes a reader convert units mid-read (#250). The unit is a property
 * of the SCALE, not of each number in it.
 *
 * Policy: compact the set only when EVERY finite, non-zero member would
 * compact on its own (`shouldCompact`) — zero is exempt since `0` reads the
 * same in every notation. Compacting on the set's max would invent
 * fractional units for members that were already short (`1K` beside
 * `-0.1K`), which is worse than the defect this fixes.
 */
export function valueFormatOptionsForSet(
  format: ChartValueFormat,
  values: readonly number[],
  currency: string = DEFAULT_CHART_CURRENCY,
  maxFractionDigits?: number,
): Intl.NumberFormatOptions {
  const finite = values.filter((v) => Number.isFinite(v));
  const representative =
    finite.length > 0 && finite.every((v) => v === 0 || shouldCompact(v))
      ? // Every member compacts on its own — any one of them resolves the
        // same compact options as the whole set would.
        (finite.find((v) => v !== 0) ?? 0)
      : // At least one member stays plain — format the WHOLE set as if it
        // were the largest-magnitude member's neighbour: 0 never compacts,
        // so passing 0 forces the plain branch for every format.
        0;
  return valueFormatOptions(format, representative, currency, maxFractionDigits);
}

/**
 * The exact string to put on the clipboard for `value`.
 *
 * Deliberately NOT locale-formatted: a copied number is usually on its way into
 * a spreadsheet, a query or a message, where `1234.5` pastes correctly and
 * `1.234,5` does not. `Number.prototype.toString` never uses exponent notation
 * below 1e21, which covers every value a chart plots.
 */
export function exactValueString(value: number): string {
  return String(value);
}
