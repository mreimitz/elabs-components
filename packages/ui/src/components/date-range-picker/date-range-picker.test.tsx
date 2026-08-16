/**
 * Smoke tests for DateRangePicker trigger rendering.
 *
 * NOTE: Opening the Radix Popover and interacting with the Calendar is NOT
 * tested here — Radix Portals do not render in jsdom reliably. Calendar open/
 * select interaction and accessibility are covered by the Storybook stories
 * (run via `pnpm --filter @elabs/components-docs test-storybook` or the MCP story tests).
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DateRangePicker } from "./date-range-picker";

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
});
