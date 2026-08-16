import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { InputGroup } from "./input-group";

describe("InputGroup", () => {
  // Regression lock for #8: the auto-height selector must match ANY descendant
  // textarea (so it works through PromptInputBody's `display:contents` wrapper),
  // not just a direct child. jsdom can't compute `:has()` layout, so we lock the
  // class contract instead.
  it("uses a descendant `has-[textarea]` selector (not direct-child) to auto-grow", () => {
    const { container } = render(
      <InputGroup>
        <div className="contents">
          <textarea data-slot="input-group-control" />
        </div>
      </InputGroup>,
    );
    const group = container.querySelector('[data-slot="input-group"]') as HTMLElement;
    expect(group).not.toBeNull();
    expect(group.className).toContain("has-[textarea]:h-auto");
    expect(group.className).not.toContain("has-[>textarea]");
  });

  // #194 (research 08 §C.1/§D): the composer variant separates by soft fill +
  // focus ring, never a hard border; the default stays the form-field outline.
  it("variant='surface' uses the soft fill with no border; default keeps border-input", () => {
    const { container } = render(<InputGroup variant="surface" />);
    const surface = container.querySelector('[data-slot="input-group"]') as HTMLElement;
    expect(surface.className.split(" ")).toContain("bg-surface-muted");
    expect(surface.className.split(" ")).not.toContain("border");
    expect(surface.className).not.toContain("border-input");

    const { container: c2 } = render(<InputGroup />);
    const outline = c2.querySelector('[data-slot="input-group"]') as HTMLElement;
    expect(outline.className.split(" ")).toContain("border-input");
  });

  // #254: the "double card" needs a `bg-card` well with no border of its own
  // (the outer frame supplies the tint; the well's own fill is theme-driven,
  // not universally white — see the JSDoc on `inputGroupVariants`).
  it("variant='card' uses bg-card with no border", () => {
    const { container } = render(<InputGroup variant="card" />);
    const card = container.querySelector('[data-slot="input-group"]') as HTMLElement;
    expect(card.className.split(" ")).toContain("bg-card");
    expect(card.className.split(" ")).not.toContain("border");
    expect(card.className).not.toContain("border-input");
  });
});
