/**
 * Smoke tests for DateRangePicker trigger rendering.
 *
 * NOTE: Opening the Radix Popover and interacting with the Calendar is NOT
 * tested here — Radix Portals do not render in jsdom reliably. Calendar open/
 * select interaction and accessibility are covered by the Storybook stories
 * (run via `pnpm --filter @elabs-ai/components-docs test-storybook` or the MCP story tests).
 */
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DateRangePicker, type DateRange } from "./date-range-picker";
import { LocaleProvider } from "../locale-provider";

describe("DateRangePicker", () => {
  it("renders the placeholder on the trigger when no range is set", () => {
    render(<DateRangePicker placeholder="Pick a date range" />);
    expect(screen.getByRole("button", { name: /pick a date range/i })).toBeInTheDocument();
  });

  it("renders a formatted 'from – to' label for a controlled value", () => {
    const from = new Date(2025, 0, 6); // Jan 6 2025
    const to = new Date(2025, 0, 20); // Jan 20 2025
    render(<DateRangePicker value={{ from, to }} />);

    const button = screen.getByRole("button");
    // The label should contain an EN DASH between the two dates
    expect(button.textContent).toMatch(/–/);
    // Both formatted dates should appear somewhere in the label
    const formatted = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
    expect(button.textContent).toContain(formatted.format(from));
    expect(button.textContent).toContain(formatted.format(to));
  });

  it("renders a partial label with '…' when only 'from' is set", () => {
    const from = new Date(2025, 3, 1); // Apr 1 2025
    render(<DateRangePicker value={{ from, to: undefined }} />);

    const button = screen.getByRole("button");
    expect(button.textContent).toMatch(/–\s*…/);
    const formatted = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
    expect(button.textContent).toContain(formatted.format(from));
  });

  it("applies the placeholder text-muted-foreground class when no range", () => {
    render(<DateRangePicker />);
    const button = screen.getByRole("button");
    expect(button.className).toContain("text-muted-foreground");
  });

  it("does not apply text-muted-foreground when a range is set", () => {
    const from = new Date(2025, 0, 1);
    const to = new Date(2025, 0, 15);
    render(<DateRangePicker value={{ from, to }} />);
    const button = screen.getByRole("button");
    expect(button.className).not.toContain("text-muted-foreground");
  });

  it("merges a custom className onto the trigger button", () => {
    render(<DateRangePicker className="my-custom-class" />);
    const button = screen.getByRole("button");
    expect(button.className).toContain("my-custom-class");
  });

  it("does not hard-fix the trigger width — fills its container by default", () => {
    render(<DateRangePicker />);
    expect(screen.getByRole("button").className).not.toMatch(/\bw-72\b/);
  });

  it("spreads extra props (e.g. data-testid) onto the trigger button", () => {
    render(<DateRangePicker data-testid="range-trigger" />);
    expect(screen.getByTestId("range-trigger")).toBeInTheDocument();
  });

  it("formats the range label using the active locale", () => {
    const from = new Date(2024, 0, 5);
    const to = new Date(2024, 0, 20);
    render(
      <LocaleProvider locale="de-DE">
        <DateRangePicker value={{ from, to }} />
      </LocaleProvider>,
    );
    // de-DE renders "5. Jan. 2024" style — distinct from the en-US default.
    expect(screen.getByRole("button").textContent).not.toMatch(/Jan 5, 2024/);
  });

  // #reviewed 1.7 — clearing a controlled range to `undefined` must not fall
  // through to a stale uncontrolled `internal` value: once controlled, the
  // component must stay controlled for its whole lifetime.
  it("collapses to a single month below the sm breakpoint (phone-width popover)", async () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 375,
    });
    try {
      const user = userEvent.setup();
      render(<DateRangePicker />);
      await user.click(screen.getByRole("button"));
      const grids = await screen.findAllByRole("grid");
      expect(grids).toHaveLength(1);
    } finally {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: originalWidth,
      });
    }
  });

  it("shows the placeholder (not a stale value) when a controlled range is cleared to undefined", async () => {
    function Harness() {
      const [range, setRange] = useState<DateRange | undefined>({
        from: new Date(2024, 0, 5),
        to: new Date(2024, 0, 20),
      });
      return (
        <>
          <DateRangePicker value={range} onValueChange={setRange} placeholder="Pick a range" />
          <button type="button" onClick={() => setRange(undefined)}>
            Clear
          </button>
        </>
      );
    }
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: /–/ });
    expect(trigger.textContent).not.toBe("Pick a range");

    await user.click(screen.getByRole("button", { name: "Clear" }));

    expect(trigger).toHaveTextContent("Pick a range");
  });
});
