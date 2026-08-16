import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SegmentedField } from "./segmented-field";

const OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

describe("SegmentedField", () => {
  it("renders the label and every segment", () => {
    render(<SegmentedField label="Priority" options={OPTIONS} defaultValue="low" />);
    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Low" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Medium" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "High" })).toBeInTheDocument();
  });

  it("always reports exactly one selected value (uncontrolled)", async () => {
    const onValueChange = vi.fn();
    render(
      <SegmentedField
        label="Priority"
        options={OPTIONS}
        defaultValue="low"
        onValueChange={onValueChange}
      />,
    );
    await userEvent.click(screen.getByRole("radio", { name: "High" }));
    expect(onValueChange).toHaveBeenCalledWith("high");
    expect(screen.getByRole("radio", { name: "High" })).toHaveAttribute("aria-checked", "true");
  });

  it("clicking the already-active segment is a no-op (never emits '')", async () => {
    const onValueChange = vi.fn();
    render(
      <SegmentedField
        label="Priority"
        options={OPTIONS}
        value="medium"
        onValueChange={onValueChange}
      />,
    );
    const mediumSegment = screen.getByRole("radio", { name: "Medium" });
    await userEvent.click(mediumSegment);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(mediumSegment).toHaveAttribute("aria-checked", "true");
  });

  it("never calls onValueChange with an empty string", async () => {
    const onValueChange = vi.fn();
    render(
      <SegmentedField
        label="Priority"
        options={OPTIONS}
        defaultValue="low"
        onValueChange={onValueChange}
      />,
    );
    await userEvent.click(screen.getByRole("radio", { name: "Low" }));
    await userEvent.click(screen.getByRole("radio", { name: "Low" }));
    for (const call of onValueChange.mock.calls) {
      expect(call[0]).not.toBe("");
    }
  });

  it("moves selection with arrow-key navigation (selection follows focus)", async () => {
    const onValueChange = vi.fn();
    render(
      <SegmentedField
        label="Priority"
        options={OPTIONS}
        defaultValue="low"
        onValueChange={onValueChange}
      />,
    );
    const lowSegment = screen.getByRole("radio", { name: "Low" });
    act(() => {
      lowSegment.focus();
    });
    await userEvent.keyboard("{ArrowRight}");
    expect(onValueChange).toHaveBeenCalledWith("medium");
    expect(screen.getByRole("radio", { name: "Medium" })).toHaveAttribute("aria-checked", "true");
  });

  it("clicking the label focuses the SELECTED segment without changing the value", async () => {
    const onValueChange = vi.fn();
    render(
      <SegmentedField
        label="Priority"
        options={OPTIONS}
        defaultValue="medium"
        onValueChange={onValueChange}
      />,
    );
    await userEvent.click(screen.getByText("Priority"));
    // A `<label>` moves focus into its field — it never mutates it.
    expect(screen.getByRole("radio", { name: "Medium" })).toHaveFocus();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole("radio", { name: "Medium" })).toHaveAttribute("aria-checked", "true");
  });

  it("tabbing into a group with nothing selected does not auto-select", async () => {
    const onValueChange = vi.fn();
    render(
      <>
        <button>before</button>
        <SegmentedField label="Priority" options={OPTIONS} onValueChange={onValueChange} />
      </>,
    );
    screen.getByRole("button", { name: "before" }).focus();
    await userEvent.tab();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("radio", { checked: true })).not.toBeInTheDocument();
  });

  it("stays controlled for Radix even when nothing is selected yet", async () => {
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<SegmentedField label="Priority" options={OPTIONS} />);
    await userEvent.click(screen.getByRole("radio", { name: "High" }));
    // A `value` that starts `undefined` and becomes a string is a mode flip;
    // Radix reports it on console.error.
    expect(warn.mock.calls.flat().join(" ")).not.toMatch(/uncontrolled to controlled/i);
    warn.mockRestore();
  });

  it("disables every segment when disabled is set", () => {
    render(<SegmentedField label="Priority" options={OPTIONS} defaultValue="low" disabled />);
    expect(screen.getByRole("radio", { name: "Low" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Medium" })).toBeDisabled();
  });

  it("disables just the option marked disabled", () => {
    render(
      <SegmentedField
        label="Stage"
        options={[
          { value: "dev", label: "Dev" },
          { value: "prod", label: "Prod", disabled: true },
        ]}
        defaultValue="dev"
      />,
    );
    expect(screen.getByRole("radio", { name: "Prod" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Dev" })).not.toBeDisabled();
  });

  it("supports the controlled mode via value/onValueChange", async () => {
    const onValueChange = vi.fn();
    render(
      <SegmentedField
        label="Priority"
        options={OPTIONS}
        value="low"
        onValueChange={onValueChange}
      />,
    );
    await userEvent.click(screen.getByRole("radio", { name: "High" }));
    expect(onValueChange).toHaveBeenCalledWith("high");
  });
});
