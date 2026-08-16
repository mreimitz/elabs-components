import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SliderNumber } from "./slider-number";

describe("SliderNumber", () => {
  it("renders a slider and a synced number input", () => {
    render(<SliderNumber aria-label="Temperature" min={0} max={1} step={0.1} defaultValue={0.5} />);
    expect(screen.getByRole("slider", { name: "Temperature" })).toHaveAttribute(
      "aria-valuenow",
      "0.5",
    );
    expect(screen.getByRole("spinbutton", { name: "Temperature" })).toHaveValue(0.5);
  });

  it("rounds slider-driven and typed values identically (lockstep)", async () => {
    const onValueChange = vi.fn();
    render(
      <SliderNumber
        aria-label="Temperature"
        min={0}
        max={1}
        step={0.1}
        defaultValue={0}
        onValueChange={onValueChange}
      />,
    );
    const thumb = screen.getByRole("slider", { name: "Temperature" });
    thumb.focus();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
    expect(onValueChange).toHaveBeenLastCalledWith(0.3);

    const numberInput = screen.getByRole("spinbutton", { name: "Temperature" });
    await userEvent.clear(numberInput);
    await userEvent.type(numberInput, "0.3");
    await userEvent.tab();
    expect(onValueChange).toHaveBeenLastCalledWith(0.3);
  });

  it("null is a real state distinct from 0, reachable via reset", async () => {
    const onValueChange = vi.fn();
    render(
      <SliderNumber
        aria-label="Temperature"
        min={0}
        max={1}
        step={0.1}
        defaultValue={0.6}
        onValueChange={onValueChange}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(onValueChange).toHaveBeenCalledWith(null);
  });

  it("disables the reset control once the value is already null", () => {
    render(<SliderNumber aria-label="Temperature" defaultValue={null} />);
    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
  });

  it("shows the slider thumb as dimmed/inactive while value is the provider default (null)", () => {
    render(
      <SliderNumber aria-label="Temperature" min={0} max={1} step={0.1} defaultValue={null} />,
    );
    const classes = screen.getByRole("slider", { name: "Temperature" }).className.split(/\s+/);
    // Exact token match — `disabled:opacity-50` is always present as a base
    // (disabled-state) utility, so a substring match would false-positive.
    expect(classes).toContain("opacity-50");
    expect(classes).toContain("border-dashed");
  });

  it("shows the slider thumb as active (not dimmed) once a real value is set", () => {
    render(<SliderNumber aria-label="Temperature" min={0} max={1} step={0.1} defaultValue={0.4} />);
    const classes = screen.getByRole("slider", { name: "Temperature" }).className.split(/\s+/);
    expect(classes).not.toContain("opacity-50");
    expect(classes).not.toContain("border-dashed");
  });

  it("round-trips null -> non-null -> reset -> null", async () => {
    const onValueChange = vi.fn();
    render(
      <SliderNumber
        aria-label="Temperature"
        min={0}
        max={1}
        step={0.1}
        defaultValue={null}
        onValueChange={onValueChange}
      />,
    );
    const thumb = screen.getByRole("slider", { name: "Temperature" });
    thumb.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onValueChange).toHaveBeenLastCalledWith(0.1);

    const resetBtn = screen.getByRole("button", { name: "Reset" });
    await userEvent.click(resetBtn);
    expect(onValueChange).toHaveBeenLastCalledWith(null);
    expect(resetBtn).toBeDisabled();
  });

  it("supports the controlled mode via value/onValueChange", async () => {
    const onValueChange = vi.fn();
    render(
      <SliderNumber
        aria-label="Temperature"
        min={0}
        max={1}
        step={0.1}
        value={0.2}
        onValueChange={onValueChange}
      />,
    );
    const numberInput = screen.getByRole("spinbutton", { name: "Temperature" });
    await userEvent.clear(numberInput);
    await userEvent.type(numberInput, "0.9");
    await userEvent.tab();
    expect(onValueChange).toHaveBeenLastCalledWith(0.9);
  });

  it.each([
    ["rounds to the value already held", "0.44", "0.4"],
    ["rounds to a different value", "0.66", "0.7"],
    ["is clamped to max", "9", "1"],
  ])(
    "input display never disagrees with the slider when a typed value %s",
    async (_case, typed, expected) => {
      render(<SliderNumber aria-label="T" min={0} max={1} step={0.1} defaultValue={0.4} />);
      await userEvent.clear(screen.getByRole("spinbutton", { name: "T" }));
      await userEvent.type(screen.getByRole("spinbutton", { name: "T" }), typed);
      await userEvent.tab();
      // Re-query: correcting the display can remount the input, so a node
      // captured before the blur would be a detached copy.
      const shown = (screen.getByRole("spinbutton", { name: "T" }) as HTMLInputElement).value;
      const announced = screen.getByRole("slider", { name: "T" }).getAttribute("aria-valuenow");
      expect(announced).toBe(expected);
      // The "rounds to the value already held" row is the one that regressed:
      // `NumberInput` only re-derives its text when the controlled value
      // CHANGES, so it kept showing "0.44" beside a slider reading 0.4.
      expect(shown).toBe(expected);
    },
  );

  it("keeps its default width shrinkable and caller-overridable", () => {
    const { container, rerender } = render(<SliderNumber aria-label="Temperature" />);
    const root = () => container.querySelector('[data-slot="slider-number"]')!;
    // `w-80` is a PREFERRED width — `max-w-full` stops it overflowing a
    // narrower container instead of forcing a horizontal scrollbar.
    expect(root()).toHaveClass("w-80", "max-w-full");

    rerender(<SliderNumber aria-label="Temperature" className="w-full" />);
    expect(root()).toHaveClass("w-full");
    expect(root()).not.toHaveClass("w-80");
  });

  it("is disabled when disabled prop is set", () => {
    render(<SliderNumber aria-label="Temperature" defaultValue={0.5} disabled />);
    expect(screen.getByRole("slider", { name: "Temperature" })).toHaveAttribute(
      "data-disabled",
      "",
    );
    expect(screen.getByRole("spinbutton", { name: "Temperature" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
  });
});
