/**
 * VirtualSelect — unit tests.
 *
 * Scope: things reachable WITHOUT opening the Radix Popover portal in jsdom
 * (Radix portals render outside the test container and are unreliable in jsdom).
 *
 * What is NOT tested here (covered by Storybook interaction tests + orchestrator
 * a11y / visual review on the real rendered surface):
 *   - Opening / closing the popover
 *   - Search filtering while open
 *   - Keyboard navigation (ArrowDown/Up/Enter/Escape) driving aria-activedescendant
 *   - Virtualizer scroll behavior with 10,000 options
 *   - Six-theme visual correctness
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { VirtualSelect } from "./virtual-select";
import type { VirtualSelectOption } from "./virtual-select";

const OPTIONS: VirtualSelectOption[] = [
  { label: "Alpha", value: "alpha" },
  { label: "Beta", value: "beta" },
  { label: "Gamma", value: "gamma" },
  { label: "Delta", value: "delta" },
];

// ---------------------------------------------------------------------------
// Trigger ARIA
// ---------------------------------------------------------------------------

describe("VirtualSelect trigger", () => {
  it("renders with role=combobox and aria-expanded=false when closed", () => {
    render(<VirtualSelect options={OPTIONS} />);
    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-haspopup", "listbox");
  });

  it("shows placeholder when no value is selected", () => {
    render(<VirtualSelect options={OPTIONS} placeholder="Pick one" />);
    expect(screen.getByText("Pick one")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Single — controlled value
// ---------------------------------------------------------------------------

describe("VirtualSelect single mode", () => {
  it("shows the selected option label on the trigger for a controlled value", () => {
    render(<VirtualSelect options={OPTIONS} value="beta" />);
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("falls back to placeholder when controlled value is empty string", () => {
    render(<VirtualSelect options={OPTIONS} value="" placeholder="Choose…" />);
    expect(screen.getByText("Choose…")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Multiple — chips + overflow
// ---------------------------------------------------------------------------

describe("VirtualSelect multiple mode", () => {
  it("renders a Badge chip for each selected value (up to 2)", () => {
    render(<VirtualSelect options={OPTIONS} multiple value={["alpha", "beta"]} />);
    // Both values fit within the 2-chip window
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("collapses overflow into a +N badge when more than 2 values are selected", () => {
    render(<VirtualSelect options={OPTIONS} multiple value={["alpha", "beta", "gamma"]} />);
    // First two chips visible
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    // Third is collapsed
    expect(screen.queryByText("Gamma")).not.toBeInTheDocument();
    expect(screen.getByText("+1")).toBeInTheDocument();
  });

  it("shows +N = 2 when 4 values are selected", () => {
    render(
      <VirtualSelect options={OPTIONS} multiple value={["alpha", "beta", "gamma", "delta"]} />,
    );
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("shows placeholder when multiple=true and value=[]", () => {
    render(<VirtualSelect options={OPTIONS} multiple value={[]} placeholder="Select items…" />);
    expect(screen.getByText("Select items…")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Uncontrolled defaultValue
// ---------------------------------------------------------------------------

describe("VirtualSelect defaultValue (uncontrolled)", () => {
  it("shows the pre-selected label on mount", () => {
    render(<VirtualSelect options={OPTIONS} defaultValue="gamma" />);
    expect(screen.getByText("Gamma")).toBeInTheDocument();
  });
});
