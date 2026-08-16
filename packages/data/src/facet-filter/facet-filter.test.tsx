/**
 * facet-filter.test.tsx — smoke + toggle-semantics lock for the faceted filter (#59).
 *
 * The behaviour that matters (and that no test covered before #59) is the
 * multi-select toggle contract: selecting emits the union, re-selecting the same
 * option emits the difference, and "Clear filters" only exists while something
 * is selected. It is a CONTROLLED component — it must never hold its own
 * selection state, so every assertion here is about what it EMITS.
 *
 * The menu is opened with a keyboard event on purpose: it is both the real
 * keyboard path (WCAG 2.1.1) and the one jsdom models faithfully — jsdom has no
 * pointer-capture, so a synthetic pointerdown would prove less, not more.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FacetFilter } from "./facet-filter";

const options = [
  { label: "Healthy", value: "healthy" },
  { label: "Degraded", value: "degraded" },
  { label: "Down", value: "down" },
];

/** Open the dropdown from the keyboard and return its trigger. */
function open(name = "Status") {
  const trigger = screen.getByRole("button", { name: new RegExp(`^${name}`) });
  fireEvent.keyDown(trigger, { key: "Enter" });
  return trigger;
}

describe("FacetFilter — trigger", () => {
  it("names the trigger with the facet title", () => {
    render(
      <FacetFilter title="Status" options={options} selected={[]} onSelectedChange={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Status" })).toBeInTheDocument();
  });

  it("shows the selected count on the trigger once a facet is active", () => {
    render(
      <FacetFilter
        title="Status"
        options={options}
        selected={["healthy", "down"]}
        onSelectedChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /^Status/ })).toHaveTextContent("2");
  });

  it("shows no count badge while nothing is selected", () => {
    render(
      <FacetFilter title="Status" options={options} selected={[]} onSelectedChange={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Status" }).textContent).toBe("Status");
  });

  /**
   * #346 — the trigger must take Button's DEFAULT size rung, not `sm`, so a
   * toolbar mixing FacetFilter with Select/Input/DatePicker (all h-9) lines up.
   * jsdom applies no Tailwind, so the class rung is what is assertable here; the
   * MEASURED proof lives in the `ToolbarAlignment` story's play function, which
   * compares real `getBoundingClientRect()` boxes in a browser.
   */
  it("renders the trigger at the shared default control height, not the sm rung", () => {
    render(
      <FacetFilter title="Status" options={options} selected={[]} onSelectedChange={vi.fn()} />,
    );
    const trigger = screen.getByRole("button", { name: "Status" });
    expect(trigger).toHaveClass("h-9");
    expect(trigger).not.toHaveClass("h-8");
  });
});

describe("FacetFilter — menu contents", () => {
  it("renders one menu item per option when opened", () => {
    render(
      <FacetFilter title="Status" options={options} selected={[]} onSelectedChange={vi.fn()} />,
    );
    open();
    for (const opt of options) {
      expect(screen.getByRole("menuitem", { name: opt.label })).toBeInTheDocument();
    }
  });

  it("hides the decorative check box from assistive tech", () => {
    render(
      <FacetFilter
        title="Status"
        options={options}
        selected={["healthy"]}
        onSelectedChange={vi.fn()}
      />,
    );
    open();
    // The ✓ swatch is a visual affordance; the item's own name carries meaning.
    const item = screen.getByRole("menuitem", { name: "Healthy" });
    expect(item.querySelector("[aria-hidden='true']")).not.toBeNull();
  });
});

describe("FacetFilter — controlled toggle semantics", () => {
  it("adds a value to the selection when an unselected option is chosen", () => {
    const onSelectedChange = vi.fn();
    render(
      <FacetFilter
        title="Status"
        options={options}
        selected={["healthy"]}
        onSelectedChange={onSelectedChange}
      />,
    );
    open();
    fireEvent.click(screen.getByRole("menuitem", { name: "Down" }));
    expect(onSelectedChange).toHaveBeenCalledWith(["healthy", "down"]);
  });

  it("removes a value when an already-selected option is chosen again", () => {
    const onSelectedChange = vi.fn();
    render(
      <FacetFilter
        title="Status"
        options={options}
        selected={["healthy", "down"]}
        onSelectedChange={onSelectedChange}
      />,
    );
    open();
    fireEvent.click(screen.getByRole("menuitem", { name: "Healthy" }));
    expect(onSelectedChange).toHaveBeenCalledWith(["down"]);
  });

  it("does NOT manage its own selection — the trigger still reflects the prop after a toggle", () => {
    const onSelectedChange = vi.fn();
    render(
      <FacetFilter
        title="Status"
        options={options}
        selected={[]}
        onSelectedChange={onSelectedChange}
      />,
    );
    // Hold onto the trigger: while the menu is open Radix marks the rest of the
    // tree aria-hidden, so a role query would no longer reach it.
    const trigger = open();
    fireEvent.click(screen.getByRole("menuitem", { name: "Down" }));
    // The parent owns the state; with the prop unchanged there is still no badge.
    expect(trigger.textContent).toBe("Status");
  });
});

describe("FacetFilter — clear affordance", () => {
  it("offers no Clear entry while nothing is selected", () => {
    render(
      <FacetFilter title="Status" options={options} selected={[]} onSelectedChange={vi.fn()} />,
    );
    open();
    expect(screen.queryByRole("menuitem", { name: "Clear filters" })).toBeNull();
  });

  it("emits an empty selection from the Clear entry", () => {
    const onSelectedChange = vi.fn();
    render(
      <FacetFilter
        title="Status"
        options={options}
        selected={["healthy", "down"]}
        onSelectedChange={onSelectedChange}
      />,
    );
    open();
    fireEvent.click(screen.getByRole("menuitem", { name: "Clear filters" }));
    expect(onSelectedChange).toHaveBeenCalledWith([]);
  });
});
