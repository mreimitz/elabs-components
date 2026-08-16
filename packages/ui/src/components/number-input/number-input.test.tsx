import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NumberInput } from "./number-input";

describe("NumberInput", () => {
  it("renders a spinbutton input", () => {
    render(<NumberInput aria-label="Quantity" defaultValue={5} />);
    expect(screen.getByRole("spinbutton", { name: "Quantity" })).toBeInTheDocument();
  });

  it("renders Increase and Decrease buttons", () => {
    render(<NumberInput aria-label="Qty" />);
    expect(screen.getByRole("button", { name: "Decrease" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Increase" })).toBeInTheDocument();
  });

  it("increments value when Increase is clicked (uncontrolled)", async () => {
    const onValueChange = vi.fn();
    render(<NumberInput aria-label="Qty" defaultValue={3} onValueChange={onValueChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Increase" }));
    expect(onValueChange).toHaveBeenCalledWith(4);
  });

  it("decrements value when Decrease is clicked (uncontrolled)", async () => {
    const onValueChange = vi.fn();
    render(<NumberInput aria-label="Qty" defaultValue={3} onValueChange={onValueChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Decrease" }));
    expect(onValueChange).toHaveBeenCalledWith(2);
  });

  it("clamps to max on Increase at boundary", async () => {
    const onValueChange = vi.fn();
    render(
      <NumberInput
        aria-label="Qty"
        defaultValue={10}
        min={0}
        max={10}
        onValueChange={onValueChange}
      />,
    );
    const increaseBtn = screen.getByRole("button", { name: "Increase" });
    expect(increaseBtn).toBeDisabled();
  });

  it("clamps to min on Decrease at boundary", async () => {
    render(<NumberInput aria-label="Qty" defaultValue={0} min={0} max={10} />);
    expect(screen.getByRole("button", { name: "Decrease" })).toBeDisabled();
  });

  it("is disabled when disabled prop is set", () => {
    render(<NumberInput aria-label="Qty" defaultValue={5} disabled />);
    expect(screen.getByRole("spinbutton", { name: "Qty" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Increase" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Decrease" })).toBeDisabled();
  });

  it("clamps value on blur when clamp=true", async () => {
    const onValueChange = vi.fn();
    render(
      <NumberInput
        aria-label="Qty"
        defaultValue={5}
        min={0}
        max={10}
        onValueChange={onValueChange}
      />,
    );
    const input = screen.getByRole("spinbutton", { name: "Qty" });
    await userEvent.clear(input);
    await userEvent.type(input, "99");
    await userEvent.tab(); // trigger blur
    expect(onValueChange).toHaveBeenLastCalledWith(10);
  });

  it("calls onValueChange with null when cleared and blurred", async () => {
    const onValueChange = vi.fn();
    render(<NumberInput aria-label="Qty" defaultValue={5} onValueChange={onValueChange} />);
    const input = screen.getByRole("spinbutton", { name: "Qty" });
    await userEvent.clear(input);
    await userEvent.tab();
    expect(onValueChange).toHaveBeenLastCalledWith(null);
  });

  it("responds to keyboard ArrowUp/ArrowDown", async () => {
    const onValueChange = vi.fn();
    render(<NumberInput aria-label="Qty" defaultValue={5} onValueChange={onValueChange} />);
    const input = screen.getByRole("spinbutton", { name: "Qty" });
    input.focus();
    await userEvent.keyboard("{ArrowUp}");
    expect(onValueChange).toHaveBeenLastCalledWith(6);
    await userEvent.keyboard("{ArrowDown}");
    expect(onValueChange).toHaveBeenLastCalledWith(5);
  });
});
