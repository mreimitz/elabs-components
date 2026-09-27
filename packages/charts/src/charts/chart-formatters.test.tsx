import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocaleProvider } from "@elabs-ai/components-ui";
import {
  getNumberFormat,
  intFmt,
  makeDateFmtForPreset,
  makeIntFmt,
  makeShortDateFmt,
  defaultChartTranslate,
  makeValueSetFmt,
  useChartFormatters,
  useChartValueFormatter,
  useChartValueSetFormatter,
  useChartValueSetFormatterFactory,
} from "./chart-formatters";
import { ChartMessagesScope, useChartTranslate } from "./chart-messages";

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

// ── RM-187: the one formatting path — locale override, set factory, messages ──

function OverrideReader({ locale }: { locale?: string }) {
  const { intFmt: fmt, shortDateFmt } = useChartFormatters(locale);
  const value = useChartValueFormatter("number", undefined, undefined, locale);
  return (
    <span data-testid="out">
      {fmt(1234567)} | {shortDateFmt.format(new Date(Date.UTC(2026, 2, 9)))} | {value(1234.5)}
    </span>
  );
}

describe("useChartFormatters / useChartValueFormatter — a chart's own locale (RM-187)", () => {
  it("the provider locale drives the default", () => {
    render(
      <LocaleProvider locale="de-DE">
        <OverrideReader />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("out").textContent).toBe("1.234.567 | 9. März | 1.234,5");
  });

  it("the chart's own locale wins over the provider's", () => {
    render(
      <LocaleProvider locale="en-US">
        <OverrideReader locale="de-DE" />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("out").textContent).toBe("1.234.567 | 9. März | 1.234,5");
  });

  it("no provider and no override keeps the en-US output", () => {
    render(<OverrideReader />);
    expect(screen.getByTestId("out").textContent).toBe("1,234,567 | Mar 9 | 1,234.5");
  });
});

function FactoryReader({ sets }: { sets: number[][] }) {
  const forSet = useChartValueSetFormatterFactory();
  return (
    <span data-testid="sets">{sets.map((set) => set.map(forSet(set)).join(" ")).join(" / ")}</span>
  );
}

describe("useChartValueSetFormatterFactory — one notation per set (#250)", () => {
  it("decides the notation once per set, in the provider locale", () => {
    render(
      <LocaleProvider locale="de-DE">
        <FactoryReader
          sets={[
            [800, 1000, 1200],
            [1_500_000, 1_200_000],
          ]}
        />
      </LocaleProvider>,
    );
    // Set 1 mixes 800 with thousands: no compact "1K" beside "800".
    // Set 2 qualifies whole: every member compacts, in German.
    // (German compact notation joins number and unit with a no-break space.)
    expect(screen.getByTestId("sets").textContent).toBe("800 1.000 1.200 / 1,5 Mio. 1,2 Mio.");
  });
});

describe("defaultChartTranslate — the no-provider words for pure helpers", () => {
  it("reads the ui catalogue with en-US plural rules and {name} interpolation", () => {
    expect(defaultChartTranslate("charts.network.nodes", { count: 1 })).toBe("1 node");
    expect(defaultChartTranslate("charts.network.nodes", { count: 3 })).toBe("3 nodes");
    expect(defaultChartTranslate("charts.treemap.zoomInto", { name: "CI" })).toBe("Zoom into CI");
  });

  it("an unknown key renders as the key itself, like useLocale().t", () => {
    expect(defaultChartTranslate("charts.nope")).toBe("charts.nope");
  });
});

function Word({ id, k, count }: { id: string; k: string; count?: number }) {
  const t = useChartTranslate();
  return <span data-testid={id}>{t(k, count === undefined ? undefined : { count })}</span>;
}

describe("ChartMessagesScope / useChartTranslate — per-chart messages (RM-187)", () => {
  it("a scoped override wins; every other key falls through to the provider", () => {
    render(
      <LocaleProvider locale="de-DE" messages={{ "charts.tooltip.value": "Wert" }}>
        <ChartMessagesScope messages={{ "charts.bump.rank": "Platz" }}>
          <Word id="rank" k="charts.bump.rank" />
          <Word id="value" k="charts.tooltip.value" />
        </ChartMessagesScope>
        <Word id="sibling" k="charts.bump.rank" />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("rank").textContent).toBe("Platz");
    expect(screen.getByTestId("value").textContent).toBe("Wert");
    // Outside the scope the override does not apply.
    expect(screen.getByTestId("sibling").textContent).toBe("Rank");
  });

  it("a plural override picks its form by the provider locale's rules", () => {
    render(
      <LocaleProvider locale="de-DE">
        <ChartMessagesScope
          messages={{ "charts.network.nodes": { one: "{count} Knoten", other: "{count} Knoten*" } }}
        >
          <Word count={1} id="one" k="charts.network.nodes" />
          <Word count={4} id="many" k="charts.network.nodes" />
        </ChartMessagesScope>
      </LocaleProvider>,
    );
    expect(screen.getByTestId("one").textContent).toBe("1 Knoten");
    expect(screen.getByTestId("many").textContent).toBe("4 Knoten*");
  });

  it("a nested scope merges over its parent scope", () => {
    render(
      <ChartMessagesScope messages={{ "charts.bump.rank": "Outer", "charts.bump.period": "Span" }}>
        <ChartMessagesScope messages={{ "charts.bump.rank": "Inner" }}>
          <Word id="rank" k="charts.bump.rank" />
          <Word id="period" k="charts.bump.period" />
        </ChartMessagesScope>
      </ChartMessagesScope>,
    );
    expect(screen.getByTestId("rank").textContent).toBe("Inner");
    expect(screen.getByTestId("period").textContent).toBe("Span");
  });

  it("renders no DOM of its own", () => {
    const { container } = render(
      <ChartMessagesScope messages={{ "charts.bump.rank": "Platz" }}>
        <i />
      </ChartMessagesScope>,
    );
    expect(container.innerHTML).toBe("<i></i>");
  });
});
