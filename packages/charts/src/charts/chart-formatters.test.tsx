import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocaleProvider } from "@elabs/components-ui";
import {
  getNumberFormat,
  intFmt,
  makeIntFmt,
  makeShortDateFmt,
  useChartFormatters,
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
