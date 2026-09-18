/**
 * date-format.test.ts — the span/width ladder every axis and tooltip date in
 * `@elabs-ai/components-charts` resolves through (RM-109).
 */
import { describe, expect, it } from "vitest";
import {
  DATE_FORMAT_LADDER,
  dateFormatForSpan,
  dateFormatOptionsForPreset,
  finerDateFormatPreset,
  type DateFormatPreset,
} from "./date-format";

const YEAR = 365.25 * 86_400_000;

describe("dateFormatForSpan — the ladder", () => {
  it("walks coarsest → finest as the tick-to-tick gap shrinks", () => {
    const fourYears: [Date, Date] = [new Date("2020-01-01"), new Date("2024-01-01")];
    expect(dateFormatForSpan(fourYears, 3)).toBe("year");

    const sixMonths: [Date, Date] = [new Date("2024-01-01"), new Date("2024-07-01")];
    expect(dateFormatForSpan(sixMonths, 3)).toBe("month");

    const oneWeek: [Date, Date] = [new Date("2024-01-01"), new Date("2024-01-08")];
    expect(dateFormatForSpan(oneWeek, 5)).toBe("day");

    const twoDays: [Date, Date] = [
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-03T00:00:00Z"),
    ];
    expect(dateFormatForSpan(twoDays, 8)).toBe("weekday");

    const oneDay: [Date, Date] = [
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-02T00:00:00Z"),
    ];
    expect(dateFormatForSpan(oneDay, 6)).toBe("hour");

    const thirtySixHours: [Date, Date] = [
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-02T12:00:00Z"),
    ];
    expect(dateFormatForSpan(thirtySixHours, 12)).toBe("hour");

    const oneHour: [Date, Date] = [
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-01T01:00:00Z"),
    ];
    expect(dateFormatForSpan(oneHour, 6)).toBe("minute");
  });

  it("abbreviates the year rung once the tick set is dense, spells it out when it is not", () => {
    const tenYears: [Date, Date] = [new Date("2016-01-01"), new Date("2026-01-01")];
    // Few ticks over ten years: plenty of room, spell the year out.
    expect(dateFormatForSpan(tenYears, 3)).toBe("year");
    // Many ticks over the same span: the label repeats often enough to
    // abbreviate rather than crowd ten full years side by side.
    expect(dateFormatForSpan(tenYears, 10)).toBe("yearShort");
  });

  it("is a pure function of span + tick count — same inputs, same rung, regardless of call order", () => {
    const domain: [Date, Date] = [new Date("2020-01-01"), new Date("2020-02-01")];
    expect(dateFormatForSpan(domain, 4)).toBe(dateFormatForSpan(domain, 4));
  });

  it("degrades to a safe default on an invalid domain instead of throwing", () => {
    const invalid: [Date, Date] = [new Date("not-a-date"), new Date("2024-01-01")];
    expect(() => dateFormatForSpan(invalid, 5)).not.toThrow();
    expect(dateFormatForSpan(invalid, 5)).toBe("day");
  });

  it("never throws on a zero-width or reversed domain", () => {
    const point: [Date, Date] = [new Date("2024-01-01"), new Date("2024-01-01")];
    expect(() => dateFormatForSpan(point, 5)).not.toThrow();
    const reversed: [Date, Date] = [new Date("2024-06-01"), new Date("2024-01-01")];
    expect(() => dateFormatForSpan(reversed, 5)).not.toThrow();
  });
});

describe("finerDateFormatPreset — the tooltip/DateTicker sibling", () => {
  it("steps one rung finer for every non-terminal rung", () => {
    expect(finerDateFormatPreset("year")).toBe("month");
    expect(finerDateFormatPreset("month")).toBe("day");
    expect(finerDateFormatPreset("day")).toBe("weekday");
    expect(finerDateFormatPreset("weekday")).toBe("hour");
    expect(finerDateFormatPreset("hour")).toBe("minute");
  });

  it("treats yearShort as the same cadence as year — both step to month", () => {
    expect(finerDateFormatPreset("yearShort")).toBe("month");
  });

  it("holds at minute — there is no finer rung", () => {
    expect(finerDateFormatPreset("minute")).toBe("minute");
  });

  it("only ever returns a rung that is actually on the ladder", () => {
    for (const preset of DATE_FORMAT_LADDER) {
      expect(DATE_FORMAT_LADDER).toContain(finerDateFormatPreset(preset));
    }
  });
});

describe("dateFormatOptionsForPreset — the Intl mapping", () => {
  it("returns distinct options for every rung above the hour tier", () => {
    // `"hour"` and `"minute"` deliberately share one `HH:MM` shape — the
    // distinction between them is which Dates get ticked (on the hour vs
    // not), not the options object.
    const seen = new Set<string>();
    for (const preset of DATE_FORMAT_LADDER.filter((p) => p !== "minute")) {
      const key = JSON.stringify(dateFormatOptionsForPreset(preset));
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("renders the documented shapes", () => {
    const date = new Date("2024-03-03T14:32:00Z");
    const render = (preset: DateFormatPreset) =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: "UTC",
        ...dateFormatOptionsForPreset(preset),
      }).format(date);

    expect(render("year")).toBe("2024");
    expect(render("yearShort")).toBe("24");
    expect(render("day")).toBe("Mar 3");
  });

  it("falls back to the day shape for an unrecognized preset", () => {
    // @ts-expect-error — exercising the runtime default arm for a value TS would reject.
    expect(dateFormatOptionsForPreset("bogus")).toEqual({ month: "short", day: "numeric" });
  });
});

describe("MS_PER_YEAR-scale sanity", () => {
  it("keeps the ladder's year threshold at approximately a calendar year", () => {
    // Not exported, so pinned indirectly: a domain just over one year with
    // very few ticks still resolves to the year tier.
    const justOverAYear: [Date, Date] = [new Date(0), new Date(YEAR * 1.05)];
    expect(dateFormatForSpan(justOverAYear, 1)).toBe("year");
  });
});
