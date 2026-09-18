import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocaleProvider } from "@elabs-ai/components-ui";
import {
  getNumberFormat,
  intFmt,
  makeDateFmtForPreset,
  makeIntFmt,
  makeShortDateFmt,
  makeValueSetFmt,
  useChartFormatters,
  useChartValueSetFormatter,
} from "./chart-formatters";

// ── Factory functions honor the passed locale (ADR-0014 §(b) non-hook path) ──

describe("chart-formatters — locale-aware factories (#181)", () => {
  it("makeIntFmt groups per the passed locale (de-DE with '.', en-US with ',')", () => {
    expect(makeIntFmt("de-DE")(1234)).toBe("1.234");
    expect(makeIntFmt("en-US")(1234)).toBe("1,234");
  });

  it("makeIntFmt differs between de-DE and en-US (no hardcoded en-US)", () => {
    expect(makeIntFmt("de-DE")(1234567)).not.toBe(makeIntFmt("en-US")(1234567));
  });

  it("makeShortDateFmt returns a locale-bound Intl.DateTimeFormat", () => {
    const fmt = makeShortDateFmt("de-DE");
    expect(fmt).toBeInstanceOf(Intl.DateTimeFormat);
    expect(fmt.resolvedOptions().locale).toMatch(/^de/);
  });

  it("getNumberFormat caches one instance per locale+opts", () => {
    const a = getNumberFormat("fr-FR", { style: "percent" });
    const b = getNumberFormat("fr-FR", { style: "percent" });
    expect(a).toBe(b);
  });

  it("the default intFmt binding is not hardcoded to en-US (uses the host default)", () => {
    // Same value the host-default factory produces — proves it is bound to
    // `undefined` (host locale), not a frozen "en-US".
    expect(intFmt(1234)).toBe(makeIntFmt()(1234));
  });

  it("makeDateFmtForPreset prepends the elision mark (U+2019) to yearShort only (date-ladder round, #478)", () => {
    const date = new Date("2016-03-03T00:00:00Z");
    expect(makeDateFmtForPreset("en-US", "yearShort")(date)).toBe("’16");
    // Never a straight apostrophe (repo micro-typography rule).
    expect(makeDateFmtForPreset("en-US", "yearShort")(date)).not.toContain("'");
    // Every other rung is unaffected.
    expect(makeDateFmtForPreset("en-US", "year")(date)).toBe("2016");
  });
});

// ── Hook path: formatters bound to the active LocaleProvider locale ──

function IntReader({ n }: { n: number }) {
  const { intFmt: fmt } = useChartFormatters();
  return <span data-testid="n">{fmt(n)}</span>;
}

describe("useChartFormatters — honors LocaleProvider (#181)", () => {
  it("formats numbers in the provider locale (de-DE)", () => {
    render(
      <LocaleProvider locale="de-DE">
        <IntReader n={1234567} />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("n").textContent).toBe("1.234.567");
  });

  it("formats numbers in the provider locale (en-US)", () => {
    render(
      <LocaleProvider locale="en-US">
        <IntReader n={1234567} />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("n").textContent).toBe("1,234,567");
  });
});

// ── makeValueSetFmt / useChartValueSetFormatter — one notation per set (#250) ──

describe("makeValueSetFmt — one notation across a whole set", () => {
  it("formats every member with the SAME resolved options, not per-value", () => {
    const fmt = makeValueSetFmt(undefined, [1000, -100, -300, -200, 400]);
    expect([1000, -100, -300, -200, 400].map(fmt)).toEqual([
      "1,000",
      "-100",
      "-300",
      "-200",
      "400",
    ]);
  });

  it("compacts every member once the whole set qualifies", () => {
    const fmt = makeValueSetFmt(undefined, [1_500_000, 1_200_000, 900_000]);
    expect(fmt(1_500_000)).toBe("1.5M");
    expect(fmt(900_000)).toBe("900K");
  });

  it("renders nothing for NaN, matching makeValueFmt", () => {
    const fmt = makeValueSetFmt(undefined, [100, 200]);
    expect(fmt(Number.NaN)).toBe("");
  });
});

function SetReader({ values }: { values: number[] }) {
  const fmt = useChartValueSetFormatter(values);
  return <span data-testid="labels">{values.map(fmt).join(" / ")}</span>;
}

describe("useChartValueSetFormatter — bound to LocaleProvider", () => {
  it("keeps one notation across the set, honoring the provider locale", () => {
    render(
      <LocaleProvider locale="de-DE">
        <SetReader values={[1000, -100, -300, -200, 400]} />
      </LocaleProvider>,
    );
    // de-DE groups with "." — the point is that every member shares ONE
    // notation (none is compact), not the exact separator.
    expect(screen.getByTestId("labels").textContent).toBe("1.000 / -100 / -300 / -200 / 400");
  });

  it("re-resolves when the values change to a different magnitude shape", () => {
    const { rerender } = render(<SetReader values={[100, 200]} />);
    expect(screen.getByTestId("labels").textContent).toBe("100 / 200");
    rerender(<SetReader values={[1_500_000, 1_200_000]} />);
    expect(screen.getByTestId("labels").textContent).toBe("1.5M / 1.2M");
  });
});
