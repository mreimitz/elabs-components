/**
 * value-format.test.ts — the number contract every chart surface shares.
 *
 * The compact rule is pinned to an EXPLICIT threshold rather than left to ICU,
 * so the small-number half of the contract can't drift under an Intl update.
 * The compact STRINGS themselves are ICU-dependent at the margins, so the
 * assertions below stay on the shape a reader cares about (`1.5M`, not
 * `1500000`) and on en-US/de-DE separators, never on exotic locales.
 */
import { describe, expect, it } from "vitest";
import {
  COMPACT_THRESHOLD,
  DEFAULT_CHART_CURRENCY,
  DEFAULT_CHART_VALUE_FORMAT,
  DEFAULT_MAX_FRACTION_DIGITS,
  exactValueString,
  resolveChartValueFormatSpec,
  shouldCompact,
  valueFormatOptions,
  valueFormatOptionsForSet,
  type ChartValueFormat,
} from "./value-format";
import { makeValueFmt, makeValueSetFmt } from "./chart-formatters";

const fmt = (
  value: number,
  format: ChartValueFormat = DEFAULT_CHART_VALUE_FORMAT,
  locale = "en-US",
  currency?: string,
): string => makeValueFmt(locale, format, currency)(value);

describe("value-format constants", () => {
  it("defaults to compact", () => {
    expect(DEFAULT_CHART_VALUE_FORMAT).toBe("compact");
  });

  it("keeps one fraction digit so 1.5M reads without implying precision", () => {
    expect(DEFAULT_MAX_FRACTION_DIGITS).toBe(1);
  });

  it("names USD as the fallback currency and never derives one from the locale", () => {
    expect(DEFAULT_CHART_CURRENCY).toBe("USD");
    // A de-DE reader of a USD figure still sees USD — currency is data, locale
    // is presentation.
    expect(fmt(1234, "currency", "de-DE")).toContain("$");
  });
});

describe("shouldCompact — the explicit threshold", () => {
  it("switches exactly at the threshold, not one below it", () => {
    expect(COMPACT_THRESHOLD).toBe(1000);
    expect(shouldCompact(999)).toBe(false);
    expect(shouldCompact(1000)).toBe(true);
  });

  it("is magnitude-based, so large negatives compact too", () => {
    expect(shouldCompact(-999)).toBe(false);
    expect(shouldCompact(-1000)).toBe(true);
  });

  it("never compacts a non-finite value", () => {
    expect(shouldCompact(Number.NaN)).toBe(false);
    expect(shouldCompact(Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe("valueFormatOptions — the format mapping", () => {
  it("maps number to plain grouped digits at any magnitude", () => {
    // No `maximumFractionDigits` — the exact-value escape hatch keeps Intl's
    // own default (3) so a small float is not rounded to one decimal.
    expect(valueFormatOptions("number", 1_500_000)).toEqual({});
    expect(valueFormatOptions("number", 1_500_000, undefined, 0)).toEqual({
      maximumFractionDigits: 0,
    });
  });

  it("maps percent to Intl percent (never compacted)", () => {
    expect(valueFormatOptions("percent", 5000)).toEqual({
      style: "percent",
      maximumFractionDigits: 1,
    });
  });

  it("compacts currency only above the threshold, keeping the currency style", () => {
    expect(valueFormatOptions("currency", 999)).toEqual({
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 1,
    });
    expect(valueFormatOptions("currency", 1000)).toMatchObject({
      style: "currency",
      currency: "USD",
      notation: "compact",
      compactDisplay: "short",
    });
  });

  it("honours an explicit currency", () => {
    expect(valueFormatOptions("currency", 10, "EUR")).toMatchObject({ currency: "EUR" });
  });

  it("treats an unknown format as compact (the default arm)", () => {
    expect(valueFormatOptions("compact", 1000)).toMatchObject({ notation: "compact" });
  });
});

describe("makeValueFmt — the rendered strings", () => {
  it("shortens above the threshold and spells out below it", () => {
    expect(fmt(999)).toBe("999");
    expect(fmt(1500)).toBe("1.5K");
    expect(fmt(1_500_000)).toBe("1.5M");
  });

  it("fixes the 1500k bug the hand-rolled formatter shipped", () => {
    // The old `y-axis.tsx` divided by 1000 unconditionally.
    expect(fmt(1_500_000)).not.toBe("1500k");
  });

  it("prints every digit for number", () => {
    expect(fmt(1_500_000, "number")).toBe("1,500,000");
  });

  it("keeps small-float precision on number, the exact-value escape hatch", () => {
    // Rounding this to "0.1" in a table cell or tooltip would be a fidelity
    // loss, not a shortening.
    expect(fmt(0.0512, "number")).toBe("0.051");
  });

  it("keeps the documented percent contract — the caller passes a fraction", () => {
    expect(fmt(0.42, "percent")).toBe("42%");
    // 10160.954286798% is what a raw ratio looks like when the caller already
    // multiplied; the contract is unchanged, so the caller stays responsible.
    expect(fmt(1, "percent")).toBe("100%");
  });

  it("localises separators without changing the format", () => {
    expect(fmt(1_500_000, "number", "de-DE")).toBe("1.500.000");
    expect(fmt(1234.5, "number", "de-DE")).toBe("1.234,5");
  });

  it("renders currency with the requested code", () => {
    expect(fmt(1234, "currency", "en-US", "EUR")).toContain("€");
    expect(fmt(1_500_000, "currency", "en-US", "EUR")).toContain("1.5M");
  });

  it("renders nothing for NaN rather than the literal NaN", () => {
    expect(fmt(Number.NaN)).toBe("");
  });
});

describe("valueFormatOptionsForSet — one notation across a whole label set (#250)", () => {
  it("does NOT compact a set with any non-compacting member, even if others would compact alone", () => {
    // The WaterfallChart gross-to-net fixture that surfaced the bug.
    const opts = valueFormatOptionsForSet("compact", [1000, -100, -300, -200, 400]);
    expect(opts.notation).not.toBe("compact");
    const strings = [1000, -100, -300, -200, 400].map((v) =>
      new Intl.NumberFormat("en-US", opts).format(v),
    );
    expect(strings).toEqual(["1,000", "-100", "-300", "-200", "400"]);
  });

  it("compacts a set only when EVERY member would compact on its own", () => {
    const opts = valueFormatOptionsForSet("compact", [1_500_000, 1_200_000, 900_000]);
    expect(opts).toMatchObject({ notation: "compact" });
  });

  it("does not let a zero member block compaction", () => {
    const opts = valueFormatOptionsForSet("compact", [1_500_000, 0, 1_200_000]);
    expect(opts).toMatchObject({ notation: "compact" });
  });

  it("never compacts percent, matching the single-value invariant", () => {
    const opts = valueFormatOptionsForSet("percent", [5000, 6000]);
    expect(opts).toEqual({ style: "percent", maximumFractionDigits: 1 });
  });

  it("does not throw on an empty or all-non-finite set", () => {
    expect(() => valueFormatOptionsForSet("compact", [])).not.toThrow();
    expect(() => valueFormatOptionsForSet("compact", [Number.NaN, Number.NaN])).not.toThrow();
    expect(valueFormatOptionsForSet("compact", []).notation).not.toBe("compact");
  });
});

describe("exactValueString — what lands on the clipboard", () => {
  it("is the unrounded, un-localised value", () => {
    expect(exactValueString(50012102.632741)).toBe("50012102.632741");
    expect(exactValueString(-0.5)).toBe("-0.5");
  });
});

describe("ChartValueFormatSpec — the object form (RM-109)", () => {
  it("every preset string resolves to the same options its spec twin would", () => {
    const presets: ChartValueFormat[] = ["number", "compact", "currency", "percent"];
    for (const preset of presets) {
      expect(valueFormatOptions(preset, 1234)).toEqual(
        valueFormatOptions(resolveChartValueFormatSpec(preset), 1234),
      );
    }
  });

  it("decimals + abbreviate + sign + suffix compose — the acceptance shape", () => {
    const spec: ChartValueFormat = { decimals: 1, abbreviate: true, sign: "always", suffix: "%" };
    expect(fmt(12_800, spec)).toBe("+12.8K%");
    // Forced abbreviate applies even below the magnitude threshold.
    expect(fmt(5, spec)).toBe("+5%");
    expect(fmt(-12_800, spec)).toBe("-12.8K%");
  });

  it("prefix glues literal text before the number", () => {
    expect(fmt(180, { prefix: "$" })).toBe("$180");
  });

  it("sign: always marks positives and negatives, sign: auto marks only negatives", () => {
    expect(fmt(42, { sign: "always" })).toBe("+42");
    expect(fmt(42, { sign: "auto" })).toBe("42");
    expect(fmt(-42, { sign: "auto" })).toBe("-42");
  });

  it("sign: parens wraps a negative in parens with no minus sign, leaves positives alone", () => {
    expect(fmt(-1234, { sign: "parens", abbreviate: false })).toBe("(1,234)");
    expect(fmt(1234, { sign: "parens", abbreviate: false })).toBe("1,234");
  });

  it("abbreviate: false never compacts, even far above the threshold", () => {
    expect(fmt(5_000_000, { abbreviate: false })).toBe("5,000,000");
  });

  it("optionalDecimals: false pads to the fixed decimal count", () => {
    expect(fmt(12, { decimals: 2, optionalDecimals: false })).toBe("12.00");
    // Default (optionalDecimals unset) drops trailing zeros.
    expect(fmt(12, { decimals: 2 })).toBe("12");
  });

  it("grouping: false drops the thousands separator", () => {
    expect(fmt(12345, { grouping: false, abbreviate: false })).toBe("12345");
  });

  it("style: percent still honours the fraction-is-input contract", () => {
    expect(fmt(0.5, { style: "percent" })).toBe("50%");
  });

  it("style: currency with an explicit currency code wins over the formatter's own", () => {
    expect(fmt(10, { style: "currency", currency: "EUR" }, "en-US")).toContain("€");
  });

  it("the set formatter keeps #250 set-consistency for an object spec, and shares its text wrapping", () => {
    const spec: ChartValueFormat = { suffix: "%" };
    const values = [1000, -100, -300, -200, 400];
    const strings = values.map(makeValueSetFmt(undefined, values, spec));
    expect(strings).toEqual(["1,000%", "-100%", "-300%", "-200%", "400%"]);
  });
});
