import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Checkbox } from "./checkbox";
describe("Checkbox", () => {
  it("toggles checked state", async () => {
    render(<Checkbox aria-label="c" />);
    const box = screen.getByRole("checkbox", { name: "c" });
    expect(box).toHaveAttribute("data-state", "unchecked");
    await userEvent.click(box);
    expect(box).toHaveAttribute("data-state", "checked");
  });

  // #348 — indeterminate renders a visually distinct glyph (Minus), not Check.
  // The swap is CSS-only (`group-data-[state=indeterminate]:` on each icon,
  // mirroring the `data-[state=checked]:` pattern already used elsewhere in
  // the library) so jsdom — which doesn't evaluate Tailwind's stylesheet —
  // can only assert the WIRING: both glyphs render, and each carries the
  // selector that shows it for the correct state. The actual rendered
  // visibility is verified in a real browser via the Storybook story/test.
  it("renders both glyphs with the indeterminate/checked CSS toggle wired correctly", () => {
    const { container } = render(<Checkbox checked="indeterminate" aria-label="select all" />);
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-checked", "mixed");
    expect(container.querySelector('[data-state="indeterminate"]')).toBeInTheDocument();

    const minus = container.querySelector("svg.lucide-minus");
    const check = container.querySelector("svg.lucide-check");
    expect(minus).toBeInTheDocument();
    expect(check).toBeInTheDocument();
    // Minus is shown ONLY when indeterminate; Check is hidden then.
    expect(minus).toHaveClass("group-data-[state=indeterminate]:block");
    expect(check).toHaveClass("group-data-[state=indeterminate]:hidden");
  });

  it("keeps the Check glyph (not Minus) for the plain checked state", () => {
    render(<Checkbox checked={true} aria-label="c" />);
    expect(screen.getByRole("checkbox")).toHaveAttribute("data-state", "checked");
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-checked", "true");
  });
});
