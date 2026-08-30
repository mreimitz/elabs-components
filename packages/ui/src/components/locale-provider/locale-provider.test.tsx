import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createPortal } from "react-dom";
import { useDirection } from "@radix-ui/react-direction";
import { LocaleProvider, useLocale } from "./locale-provider";

// ---------------------------------------------------------------------------
// Helper component — renders all locale values as text
// ---------------------------------------------------------------------------

function LocaleReader({ numberInput, dateInput }: { numberInput?: number; dateInput?: Date }) {
  const { locale, dir, t, formatNumber, formatDate } = useLocale();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="dir">{dir}</span>
      <span data-testid="close">{t("close")}</span>
      <span data-testid="next">{t("next")}</span>
      <span data-testid="previous">{t("previous")}</span>
      {numberInput !== undefined && <span data-testid="number">{formatNumber(numberInput)}</span>}
      {dateInput !== undefined && <span data-testid="date">{formatDate(dateInput)}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useLocale (no provider)", () => {
  it("returns en-US locale and ltr direction", () => {
    render(<LocaleReader />);
    expect(screen.getByTestId("locale").textContent).toBe("en-US");
    expect(screen.getByTestId("dir").textContent).toBe("ltr");
  });

  it("t('close') returns the English default 'Close'", () => {
    render(<LocaleReader />);
    expect(screen.getByTestId("close").textContent).toBe("Close");
  });

  it("t('next') returns the English default 'Next'", () => {
    render(<LocaleReader />);
    expect(screen.getByTestId("next").textContent).toBe("Next");
  });
});

describe("LocaleProvider — default en-US", () => {
  it("provides locale and dir to children", () => {
    render(
      <LocaleProvider locale="en-US" dir="ltr">
        <LocaleReader />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("locale").textContent).toBe("en-US");
    expect(screen.getByTestId("dir").textContent).toBe("ltr");
  });

  it("applies dir attribute to the wrapper element", () => {
    const { container } = render(
      <LocaleProvider locale="en-US" dir="ltr">
        <span>content</span>
      </LocaleProvider>,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.getAttribute("dir")).toBe("ltr");
  });

  it("t('close') returns English default when no messages override provided", () => {
    render(
      <LocaleProvider>
        <LocaleReader />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("close").textContent).toBe("Close");
  });
});

describe("LocaleProvider — custom messages", () => {
  it("overrides t() for the provided keys", () => {
    render(
      <LocaleProvider messages={{ next: "Weiter", previous: "Zurück" }}>
        <LocaleReader />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("next").textContent).toBe("Weiter");
    expect(screen.getByTestId("previous").textContent).toBe("Zurück");
  });

  it("non-overridden keys fall through to English defaults", () => {
    render(
      <LocaleProvider messages={{ next: "Weiter" }}>
        <LocaleReader />
      </LocaleProvider>,
    );
    // "close" was not overridden
    expect(screen.getByTestId("close").textContent).toBe("Close");
  });
});

describe("LocaleProvider — RTL Arabic", () => {
  it("provides ar-EG locale and rtl direction", () => {
    render(
      <LocaleProvider locale="ar-EG" dir="rtl" messages={{ next: "التالي", previous: "السابق" }}>
        <LocaleReader />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("locale").textContent).toBe("ar-EG");
    expect(screen.getByTestId("dir").textContent).toBe("rtl");
  });

  it("applies dir='rtl' on the wrapper element", () => {
    const { container } = render(
      <LocaleProvider locale="ar-EG" dir="rtl">
        <span>content</span>
      </LocaleProvider>,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.getAttribute("dir")).toBe("rtl");
  });

  it("t() returns overridden Arabic strings", () => {
    render(
      <LocaleProvider locale="ar-EG" dir="rtl" messages={{ next: "التالي", previous: "السابق" }}>
        <LocaleReader />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("next").textContent).toBe("التالي");
    expect(screen.getByTestId("previous").textContent).toBe("السابق");
  });
});

describe("LocaleProvider — formatNumber", () => {
  it("formats a number in en-US locale", () => {
    render(
      <LocaleProvider locale="en-US">
        <LocaleReader numberInput={1234567.89} />
      </LocaleProvider>,
    );
    // en-US formats with comma thousands separator
    const text = screen.getByTestId("number").textContent ?? "";
    expect(text).toMatch(/1[,.]?234/);
  });

  it("formats without a provider (en-US default)", () => {
    render(<LocaleReader numberInput={42} />);
    expect(screen.getByTestId("number").textContent).toBe("42");
  });
});

describe("LocaleProvider — formatDate", () => {
  it("formats a date in en-US locale", () => {
    render(
      <LocaleProvider locale="en-US">
        <LocaleReader dateInput={new Date(2026, 5, 8)} />
      </LocaleProvider>,
    );
    const text = screen.getByTestId("date").textContent ?? "";
    // en-US default format includes the year 2026
    expect(text).toContain("2026");
  });

  it("formats without a provider (en-US default)", () => {
    render(<LocaleReader dateInput={new Date(2026, 5, 8)} />);
    const text = screen.getByTestId("date").textContent ?? "";
    expect(text).toContain("2026");
  });
});

// ---------------------------------------------------------------------------
// DirectionProvider — RTL reaches portalled content (ADR-0014, #181)
// ---------------------------------------------------------------------------

/**
 * Reads Radix's direction context (the channel every portalled Radix overlay
 * uses) and renders it through a PORTAL to document.body — i.e. outside the
 * `<div dir>` DOM ancestor. React context flows through portals, so this proves
 * `DirectionProvider` (not the DOM `dir`) is what carries direction to overlays.
 */
function PortaledDirectionReader() {
  const dir = useDirection();
  return createPortal(<span data-testid="portal-dir">{dir}</span>, document.body);
}

describe("LocaleProvider — DirectionProvider (RTL portals)", () => {
  it("provides dir='rtl' to portalled content via Radix direction context", () => {
    render(
      <LocaleProvider locale="ar-EG" dir="rtl">
        <PortaledDirectionReader />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("portal-dir").textContent).toBe("rtl");
  });

  it("defaults portalled content to ltr", () => {
    render(
      <LocaleProvider>
        <PortaledDirectionReader />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("portal-dir").textContent).toBe("ltr");
  });
});

describe("t() — variable interpolation", () => {
  function Interpolated({ vars }: { vars: Record<string, string | number> }) {
    const { t } = useLocale();
    return <span data-testid="result">{t("greeting", vars)}</span>;
  }

  it("substitutes {name}-style placeholders", () => {
    render(
      <LocaleProvider messages={{ greeting: "Hello, {name}!" }}>
        <Interpolated vars={{ name: "World" }} />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("result").textContent).toBe("Hello, World!");
  });

  it("leaves unknown placeholders intact", () => {
    render(
      <LocaleProvider messages={{ greeting: "Hi {user}" }}>
        <Interpolated vars={{ notUser: "Alice" }} />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("result").textContent).toBe("Hi {user}");
  });

  it("returns the key itself when the key is absent", () => {
    render(
      <LocaleProvider>
        <Interpolated vars={{}} />
      </LocaleProvider>,
    );
    // "greeting" is not in DEFAULT_MESSAGES
    expect(screen.getByTestId("result").textContent).toBe("greeting");
  });
});

// ---------------------------------------------------------------------------
// t() — pluggable `translate` resolver bridge (#19)
// ---------------------------------------------------------------------------

describe("LocaleProvider — translate resolver bridge", () => {
  function TranslateReader({ vars }: { vars?: Record<string, string | number> }) {
    const { t } = useLocale();
    return <span data-testid="result">{t("close", vars)}</span>;
  }

  it("a translate() result overrides both a messages override and the English default", () => {
    render(
      <LocaleProvider
        messages={{ close: "Fermer" }}
        translate={(key) => (key === "close" ? "Schließen" : undefined)}
      >
        <TranslateReader />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("result").textContent).toBe("Schließen");
  });

  it("translate() returning undefined falls through to messages, then DEFAULT_MESSAGES, then the key", () => {
    // Rung 1: messages override present -> used.
    const { rerender } = render(
      <LocaleProvider messages={{ close: "Fermer" }} translate={() => undefined}>
        <TranslateReader />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("result").textContent).toBe("Fermer");

    // Rung 2: no messages override -> DEFAULT_MESSAGES English default.
    rerender(
      <LocaleProvider translate={() => undefined}>
        <TranslateReader />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("result").textContent).toBe("Close");

    // Rung 3: a key with no default and no override -> the raw key itself.
    function UnknownKeyReader() {
      const { t } = useLocale();
      return <span data-testid="unknown">{t("totallyUnknownKey")}</span>;
    }
    rerender(
      <LocaleProvider translate={() => undefined}>
        <UnknownKeyReader />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("unknown").textContent).toBe("totallyUnknownKey");
  });

  it("passes the raw key and vars to translate(), not a pre-interpolated string", () => {
    const translate = vi.fn((_key: string, _vars?: Record<string, string | number>) => undefined);
    function CountReader() {
      const { t } = useLocale();
      return (
        <span data-testid="result">
          {t("ui.viewToolbar.countOfTotal", { count: 3, total: 10 })}
        </span>
      );
    }
    render(
      <LocaleProvider translate={translate}>
        <CountReader />
      </LocaleProvider>,
    );
    expect(translate).toHaveBeenCalledWith("ui.viewToolbar.countOfTotal", { count: 3, total: 10 });
  });

  it("does not double-interpolate a translate() return value that itself contains a literal '{'", () => {
    render(
      <LocaleProvider translate={(key) => (key === "close" ? "raw {not-a-var} text" : undefined)}>
        <TranslateReader />
      </LocaleProvider>,
    );
    // brand-ui's own {name}-replacement must NOT run a second time over the
    // resolver's own output — a real ICU formatter already interpolated it.
    expect(screen.getByTestId("result").textContent).toBe("raw {not-a-var} text");
  });

  it("with no resolver and no message, t() still falls back to the key exactly as today", () => {
    function UnknownKeyReader() {
      const { t } = useLocale();
      return <span data-testid="result">{t("anotherUnknownKey")}</span>;
    }
    render(
      <LocaleProvider>
        <UnknownKeyReader />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("result").textContent).toBe("anotherUnknownKey");
  });
});

// ---------------------------------------------------------------------------
// t() — ICU cardinal-plural forms via `Intl.PluralRules` (#19)
// ---------------------------------------------------------------------------

describe("LocaleProvider — plural forms (Intl.PluralRules)", () => {
  const ITEM_COUNT_MESSAGE = {
    one: "{count} item selected",
    other: "{count} items selected",
  };

  function PluralReader({ count }: { count: number }) {
    const { t } = useLocale();
    return <span data-testid="result">{t("itemCount", { count })}</span>;
  }

  it("selects the English 'one' form for count=1 and 'other' for 0 and many", () => {
    const { rerender } = render(
      <LocaleProvider locale="en-US" messages={{ itemCount: ITEM_COUNT_MESSAGE }}>
        <PluralReader count={1} />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("result").textContent).toBe("1 item selected");

    rerender(
      <LocaleProvider locale="en-US" messages={{ itemCount: ITEM_COUNT_MESSAGE }}>
        <PluralReader count={0} />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("result").textContent).toBe("0 items selected");

    rerender(
      <LocaleProvider locale="en-US" messages={{ itemCount: ITEM_COUNT_MESSAGE }}>
        <PluralReader count={5} />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("result").textContent).toBe("5 items selected");
  });

  // Polish has FOUR cardinal categories (one/few/many/other) with different
  // boundaries than English's two (one/other) — this is the case a
  // design that only handles English silently gets wrong.
  const PL_FILE_MESSAGE = {
    one: "{count} plik",
    few: "{count} pliki",
    many: "{count} plików",
    other: "{count} pliku",
  };

  function PlPluralReader({ count }: { count: number }) {
    const { t } = useLocale();
    return <span data-testid="result">{t("fileCount", { count })}</span>;
  }

  it("selects the correct Polish plural category for 1 (one), 2 (few), 5 (many), 12 (many), and 22 (few) — teens boundary", () => {
    const { rerender } = render(
      <LocaleProvider locale="pl-PL" messages={{ fileCount: PL_FILE_MESSAGE }}>
        <PlPluralReader count={1} />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("result").textContent).toBe("1 plik");

    rerender(
      <LocaleProvider locale="pl-PL" messages={{ fileCount: PL_FILE_MESSAGE }}>
        <PlPluralReader count={2} />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("result").textContent).toBe("2 pliki");

    rerender(
      <LocaleProvider locale="pl-PL" messages={{ fileCount: PL_FILE_MESSAGE }}>
        <PlPluralReader count={5} />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("result").textContent).toBe("5 plików");

    // Polish teens (11–21) always use "many" category, breaking the pattern.
    // 12 → "many"; 22 → "few" demonstrates this non-contiguous boundary.
    rerender(
      <LocaleProvider locale="pl-PL" messages={{ fileCount: PL_FILE_MESSAGE }}>
        <PlPluralReader count={12} />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("result").textContent).toBe("12 plików");

    rerender(
      <LocaleProvider locale="pl-PL" messages={{ fileCount: PL_FILE_MESSAGE }}>
        <PlPluralReader count={22} />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("result").textContent).toBe("22 pliki");
  });

  it("falls back to the 'other' form when a category has no entry", () => {
    // Only "one" and "other" are supplied; Polish "few"/"many" counts must
    // fall back to "other" rather than rendering undefined/blank.
    const PARTIAL = { one: "{count} rzecz", other: "{count} rzeczy" };
    render(
      <LocaleProvider locale="pl-PL" messages={{ fileCount: PARTIAL }}>
        <PlPluralReader count={2} />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("result").textContent).toBe("2 rzeczy");
  });

  it("handles locales with zero/two categories (Arabic example)", () => {
    // Arabic (ar-EG) has categories: zero, one, two, few, many, other.
    // This test verifies that locales with non-English category sets work
    // and that partial maps (not providing every category) fall back correctly.
    const AR_MESSAGE: Record<string, string> = {
      zero: "{count} ملفات", // zero
      one: "{count} ملف", // one
      two: "{count} ملفان", // two
      few: "{count} ملفات", // few
      many: "{count} ملف", // many
      other: "{count} ملف", // other
    };

    function ArPluralReader({ count }: { count: number }) {
      const { t } = useLocale();
      return <span data-testid="result">{t("fileCount", { count })}</span>;
    }

    const { rerender } = render(
      <LocaleProvider locale="ar-EG" messages={{ fileCount: AR_MESSAGE }}>
        <ArPluralReader count={0} />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("result").textContent).toBe("0 ملفات");

    rerender(
      <LocaleProvider locale="ar-EG" messages={{ fileCount: AR_MESSAGE }}>
        <ArPluralReader count={1} />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("result").textContent).toBe("1 ملف");

    rerender(
      <LocaleProvider locale="ar-EG" messages={{ fileCount: AR_MESSAGE }}>
        <ArPluralReader count={2} />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("result").textContent).toBe("2 ملفان");
  });

  it("the no-provider default value also resolves plural forms (en-US)", () => {
    // No provider, so this exercises makeDefaultValue()'s t() directly against
    // the shipped DEFAULT_MESSAGES "itemsSelected" plural entry — proving the
    // singleton default value branches on plural forms too, not only a
    // provider's merged messages.
    function DefaultPluralReader({ count }: { count: number }) {
      const { t } = useLocale();
      return <span data-testid="result">{t("itemsSelected", { count })}</span>;
    }
    const { rerender } = render(<DefaultPluralReader count={1} />);
    expect(screen.getByTestId("result").textContent).toBe("1 item selected");

    rerender(<DefaultPluralReader count={5} />);
    expect(screen.getByTestId("result").textContent).toBe("5 items selected");
  });
});
