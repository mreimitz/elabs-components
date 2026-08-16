import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ColorPicker, COLOR_TOKENS } from "./color-picker";

describe("ColorPicker", () => {
  it("renders a trigger button with default aria-label", () => {
    render(<ColorPicker defaultValue="chart-1" />);
    expect(screen.getByRole("button", { name: "Pick color" })).toBeInTheDocument();
  });

  it("accepts a custom aria-label on the trigger", () => {
    render(<ColorPicker defaultValue="primary" aria-label="Chart color" />);
    expect(screen.getByRole("button", { name: "Chart color" })).toBeInTheDocument();
  });

  it("opens popover on trigger click and shows swatches", async () => {
    render(<ColorPicker defaultValue="chart-1" />);
    await userEvent.click(screen.getByRole("button", { name: "Pick color" }));
    expect(screen.getByRole("radiogroup", { name: "Color swatches" })).toBeInTheDocument();
    // Each default token should render as a radio
    expect(screen.getAllByRole("radio").length).toBe(COLOR_TOKENS.length);
  });

  it("marks the current value as checked", async () => {
    render(<ColorPicker defaultValue="primary" />);
    await userEvent.click(screen.getByRole("button", { name: "Pick color" }));
    expect(screen.getByRole("radio", { name: "primary" })).toHaveAttribute("aria-checked", "true");
  });

  it("calls onValueChange and closes popover when a swatch is selected", async () => {
    const onValueChange = vi.fn();
    render(<ColorPicker defaultValue="chart-1" onValueChange={onValueChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Pick color" }));
    await userEvent.click(screen.getByRole("radio", { name: "chart-2" }));
    expect(onValueChange).toHaveBeenCalledWith("chart-2");
    // Popover should close — radiogroup no longer visible
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });

  it("does not render custom hex section by default", async () => {
    render(<ColorPicker defaultValue="chart-1" />);
    await userEvent.click(screen.getByRole("button", { name: "Pick color" }));
    expect(screen.queryByLabelText("Custom hex color")).not.toBeInTheDocument();
  });

  it("renders custom hex input when allowCustom=true", async () => {
    render(<ColorPicker defaultValue="chart-1" allowCustom />);
    await userEvent.click(screen.getByRole("button", { name: "Pick color" }));
    expect(screen.getByLabelText("Custom hex color")).toBeInTheDocument();
  });

  it("applies a valid hex value from the custom input", async () => {
    const onValueChange = vi.fn();
    render(<ColorPicker defaultValue="chart-1" allowCustom onValueChange={onValueChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Pick color" }));
    const hexInput = screen.getByLabelText("Custom hex color");
    await userEvent.type(hexInput, "#ff0000");
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onValueChange).toHaveBeenCalledWith("#ff0000");
  });

  it("respects a custom swatches subset", async () => {
    render(<ColorPicker defaultValue="success" swatches={["success", "warning"]} />);
    await userEvent.click(screen.getByRole("button", { name: "Pick color" }));
    expect(screen.getAllByRole("radio").length).toBe(2);
    expect(screen.getByRole("radio", { name: "success" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "warning" })).toBeInTheDocument();
  });

  it("uses only bg-* token classes for swatches (no raw hex in class)", async () => {
    render(<ColorPicker defaultValue="chart-1" />);
    await userEvent.click(screen.getByRole("button", { name: "Pick color" }));
    const radios = screen.getAllByRole("radio");
    for (const radio of radios) {
      expect(radio.className).not.toMatch(/#[0-9a-fA-F]/);
    }
  });
});
