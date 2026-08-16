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
  shouldCompact,
  valueFormatOptions,
  type ChartValueFormat,
} from "./value-format";
import { makeValueFmt } from "./chart-formatters";

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

describe("exactValueString — what lands on the clipboard", () => {
  it("is the unrounded, un-localised value", () => {
    expect(exactValueString(50012102.632741)).toBe("50012102.632741");
    expect(exactValueString(-0.5)).toBe("-0.5");
  });
});
