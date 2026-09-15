import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DatePicker } from "./date-picker";
import { LocaleProvider } from "../locale-provider";

describe("DatePicker", () => {
  it("forwards the ref to the trigger button", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<DatePicker ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current).toBe(screen.getByRole("button"));
  });

  it("does not hard-fix the trigger width — fills its container by default", () => {
    render(<DatePicker />);
    expect(screen.getByRole("button").className).not.toMatch(/\bw-56\b/);
  });

  // #reviewed 1.7 — same `value ?? internal` / ternary-setter bug as Combobox:
  // an uncontrolled DatePicker with an onValueChange listener never updated
  // its own displayed date.
  it("updates its own displayed date when uncontrolled even with an onValueChange listener", async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(<DatePicker onValueChange={onValueChange} placeholder="Pick a date" />);
    const trigger = screen.getByRole("button", { name: /pick a date/i });
    await user.click(trigger);
    const grid = await screen.findByRole("grid");
    const dayButtons = within(grid)
      .getAllByRole("button")
      .filter((b) => !/previous|next/i.test(b.getAttribute("aria-label") ?? ""));
    const firstEnabled = dayButtons.find((b) => !(b as HTMLButtonElement).disabled)!;
    await user.click(firstEnabled);
    expect(onValueChange).toHaveBeenCalled();
    expect(trigger).not.toHaveTextContent("Pick a date");
  });

  it("formats the displayed date using the active locale", () => {
    const date = new Date(2024, 0, 15); // Jan 15, 2024
    render(
      <LocaleProvider locale="de-DE">
        <DatePicker value={date} />
      </LocaleProvider>,
    );
    // de-DE "medium" dateStyle renders like "15. Jan. 2024" — distinct from
    // the en-US default ("Jan 15, 2024").
    expect(screen.getByRole("button")).toHaveTextContent("2024");
    expect(screen.getByRole("button").textContent).not.toMatch(/Jan 15, 2024/);
  });
});
