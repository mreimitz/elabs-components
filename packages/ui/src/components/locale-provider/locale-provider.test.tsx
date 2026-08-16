import { describe, expect, it } from "vitest";
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
