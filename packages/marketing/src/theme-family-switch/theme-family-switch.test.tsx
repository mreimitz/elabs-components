import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeFamilySwitch, type ThemeFamilySwitchFamily } from "./theme-family-switch";

const families: ThemeFamilySwitchFamily[] = [
  { id: "default", label: "Default", swatch: { background: "white", primary: "black" } },
  { id: "ocean", label: "Ocean", swatch: { background: "azure", primary: "navy" } },
  { id: "qlik", label: "Qlik", swatch: { background: "white", primary: "green" } },
];

describe("ThemeFamilySwitch", () => {
  it("names every chip by its family and marks the active one", () => {
    render(<ThemeFamilySwitch families={families} value="ocean" onChange={() => {}} />);
    expect(screen.getByRole("group", { name: "Theme family" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Ocean" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Qlik" })).toHaveAttribute("aria-checked", "false");
  });

  it("paints each chip from the host's swatch values", () => {
    const { container } = render(
      <ThemeFamilySwitch families={families} value="default" onChange={() => {}} />,
    );
    const chips = container.querySelectorAll<HTMLElement>(
      '[data-slot="theme-family-switch-swatch"]',
    );
    expect(chips).toHaveLength(3);
    expect(chips[1]?.style.background).toContain("navy");
  });

  it("roves focus with arrow keys without applying", async () => {
    const onChange = vi.fn();
    render(<ThemeFamilySwitch families={families} value="default" onChange={onChange} />);
    const first = screen.getByRole("radio", { name: "Default" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    // Radix moves roving focus on the next tick.
    await waitFor(() => expect(screen.getByRole("radio", { name: "Ocean" })).toHaveFocus());
    expect(onChange).not.toHaveBeenCalled();
  });

  it("applies a family on activation, and never un-applies the active one", () => {
    const onChange = vi.fn();
    render(<ThemeFamilySwitch families={families} value="default" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Qlik" }));
    expect(onChange).toHaveBeenCalledWith("qlik");
    fireEvent.click(screen.getByRole("radio", { name: "Default" }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("renders the mode toggle only with onModeChange, and reports the new mode", () => {
    const onModeChange = vi.fn();
    const { rerender } = render(
      <ThemeFamilySwitch families={families} value="default" onChange={() => {}} mode="light" />,
    );
    expect(screen.queryByRole("group", { name: "Colour mode" })).toBeNull();
    rerender(
      <ThemeFamilySwitch
        families={families}
        value="default"
        onChange={() => {}}
        mode="light"
        onModeChange={onModeChange}
        labels={{ dark: "Dunkel" }}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Dunkel" }));
    expect(onModeChange).toHaveBeenCalledWith("dark");
  });

  it("forwards its ref, merges className and exposes data-slot", () => {
    const ref = createRef<HTMLDivElement>();
    const { container } = render(
      <ThemeFamilySwitch
        ref={ref}
        className="probe"
        families={families}
        value="default"
        onChange={() => {}}
      />,
    );
    expect(ref.current).toBe(container.querySelector('[data-slot="theme-family-switch"]'));
    expect(ref.current).toHaveClass("probe");
  });
});
