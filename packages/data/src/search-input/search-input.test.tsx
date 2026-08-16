/**
 * search-input.test.tsx — smoke + behaviour lock for the table search field (#59).
 *
 * SearchInput is one of the four filter primitives DataTable's `toolbar`
 * render-prop drives; until #59 it was only exercised indirectly, inside
 * data-table.stories.tsx. The load-bearing contract is: a real labelled
 * `<input>` (no placeholder-as-label), every keystroke reported to the caller,
 * and a named clear affordance that only exists when there is something to clear.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SearchInput } from "./search-input";

describe("SearchInput — accessible name", () => {
  it("exposes a textbox named by the visually-hidden label (not the placeholder)", () => {
    render(<SearchInput value="" onValueChange={vi.fn()} />);
    expect(screen.getByRole("textbox", { name: "Search" })).toBeInTheDocument();
  });

  it("uses a custom label when supplied", () => {
    render(<SearchInput value="" onValueChange={vi.fn()} label="Filter deployments" />);
    expect(screen.getByRole("textbox", { name: "Filter deployments" })).toBeInTheDocument();
  });

  it("wires the <label> to the input via a generated id (clicking the label focuses it)", () => {
    render(<SearchInput value="" onValueChange={vi.fn()} />);
    const input = screen.getByRole("textbox", { name: "Search" });
    const label = document.querySelector("label");
    expect(label).not.toBeNull();
    expect(label).toHaveAttribute("for", input.getAttribute("id"));
  });
});

describe("SearchInput — value reporting", () => {
  it("calls onValueChange with the typed value", () => {
    const onValueChange = vi.fn();
    render(<SearchInput value="" onValueChange={onValueChange} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Search" }), {
      target: { value: "billing" },
    });
    expect(onValueChange).toHaveBeenCalledWith("billing");
  });

  it("is controlled — it renders the value prop, not internal state", () => {
    const { rerender } = render(<SearchInput value="alpha" onValueChange={vi.fn()} />);
    expect(screen.getByRole("textbox", { name: "Search" })).toHaveValue("alpha");
    rerender(<SearchInput value="beta" onValueChange={vi.fn()} />);
    expect(screen.getByRole("textbox", { name: "Search" })).toHaveValue("beta");
  });
});

describe("SearchInput — clear affordance", () => {
  it("renders no clear button while the field is empty", () => {
    render(<SearchInput value="" onValueChange={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
  });

  it("renders a NAMED clear button once there is a value (icon-only control, WCAG 4.1.2)", () => {
    render(<SearchInput value="billing" onValueChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Clear search" })).toBeInTheDocument();
  });

  it("clears the value through the caller's handler", () => {
    const onValueChange = vi.fn();
    render(<SearchInput value="billing" onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onValueChange).toHaveBeenCalledWith("");
  });

  it("hides its glyph from assistive tech (the button carries the name)", () => {
    render(<SearchInput value="billing" onValueChange={vi.fn()} />);
    const svg = screen.getByRole("button", { name: "Clear search" }).querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });
});

describe("SearchInput — composability", () => {
  it("spreads arbitrary input props (id/name/autocomplete) onto the field", () => {
    render(
      <SearchInput value="" onValueChange={vi.fn()} name="q" autoComplete="off" data-testid="f" />,
    );
    const input = screen.getByTestId("f");
    expect(input).toHaveAttribute("name", "q");
    expect(input).toHaveAttribute("autocomplete", "off");
  });

  it("merges className onto the input and containerClassName onto the wrapper", () => {
    const { container } = render(
      <SearchInput
        value=""
        onValueChange={vi.fn()}
        className="input-extra"
        containerClassName="wrap-extra"
      />,
    );
    expect(container.firstChild).toHaveClass("wrap-extra");
    expect(screen.getByRole("textbox", { name: "Search" })).toHaveClass("input-extra");
  });
});
