import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BoundedNumber } from "./bounded-number";

describe("BoundedNumber", () => {
  it("renders the empty label instead of a blank box when value is null", () => {
    render(<BoundedNumber aria-label="Limit" defaultValue={null} />);
    expect(screen.getByText("No limit")).toBeInTheDocument();
  });

  it("supports a custom emptyLabel", () => {
    render(<BoundedNumber aria-label="Limit" defaultValue={null} emptyLabel="Unlimited" />);
    expect(screen.getByText("Unlimited")).toBeInTheDocument();
    expect(screen.queryByText("No limit")).not.toBeInTheDocument();
  });

  it("hides the empty label once a value is set", () => {
    render(<BoundedNumber aria-label="Limit" defaultValue={250} />);
    expect(screen.queryByText("No limit")).not.toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Limit" })).toHaveValue(250);
  });

  it("hides the empty label while focused so the field reads as truly empty", async () => {
    render(<BoundedNumber aria-label="Limit" defaultValue={null} />);
    const input = screen.getByRole("spinbutton", { name: "Limit" });
    await userEvent.click(input);
    expect(screen.queryByText("No limit")).not.toBeInTheDocument();
  });

  it("round-trips to null (never 0 or max) when cleared and blurred", async () => {
    const onValueChange = vi.fn();
    render(
      <BoundedNumber
        aria-label="Limit"
        defaultValue={100}
        max={1000}
        onValueChange={onValueChange}
      />,
    );
    const input = screen.getByRole("spinbutton", { name: "Limit" });
    await userEvent.clear(input);
    await userEvent.tab();
    expect(onValueChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByText("No limit")).toBeInTheDocument();
  });

  it("supports the controlled mode via value/onValueChange", async () => {
    const onValueChange = vi.fn();
    render(<BoundedNumber aria-label="Limit" value={null} onValueChange={onValueChange} />);
    const input = screen.getByRole("spinbutton", { name: "Limit" });
    await userEvent.click(input);
    await userEvent.type(input, "42");
    await userEvent.tab();
    expect(onValueChange).toHaveBeenLastCalledWith(42);
  });

  it("is disabled when disabled prop is set", () => {
    render(<BoundedNumber aria-label="Limit" defaultValue={null} disabled />);
    expect(screen.getByRole("spinbutton", { name: "Limit" })).toBeDisabled();
  });

  it("merges className onto the ROOT so a caller can size the field", () => {
    const { container } = render(
      <BoundedNumber aria-label="Limit" defaultValue={null} className="w-full" />,
    );
    const root = container.querySelector('[data-slot="bounded-number"]');
    // A width utility on the inner control would resolve against a
    // shrink-to-fit wrapper and do nothing — it has to land on the root.
    expect(root).toHaveClass("w-full");
    expect(root).not.toHaveClass("w-36");
  });
});
