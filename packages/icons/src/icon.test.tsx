import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Icon, createIcon } from "./icon";

describe("Icon", () => {
  it("renders an svg element", () => {
    const { container } = render(<Icon />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("is decorative (role=presentation, aria-hidden) when no title is given", () => {
    const { container } = render(<Icon />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("role")).toBe("presentation");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("is an image (role=img, aria-label) when a title is provided", () => {
    render(<Icon title="Settings" />);
    const svg = screen.getByRole("img", { name: "Settings" });
    expect(svg).toBeInTheDocument();
    expect(svg.getAttribute("aria-label")).toBe("Settings");
  });

  it("renders a <title> element when title is provided", () => {
    const { container } = render(<Icon title="Close" />);
    const titleEl = container.querySelector("title");
    expect(titleEl).not.toBeNull();
    expect(titleEl?.textContent).toBe("Close");
  });

  it("does not render a <title> element when no title is given", () => {
    const { container } = render(<Icon />);
    expect(container.querySelector("title")).toBeNull();
  });

  it("applies the size prop to width and height", () => {
    const { container } = render(<Icon size={32} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("32");
    expect(svg?.getAttribute("height")).toBe("32");
  });

  it("ignores a variant prop given directly (no solid glyph to switch to)", () => {
    const { container } = render(
      <Icon variant="solid">
        <circle cx="12" cy="12" r="9" />
      </Icon>,
    );
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("variant")).toBeNull();
    expect(svg?.querySelector("circle")).not.toBeNull();
  });
});

describe("createIcon variant / solid glyph", () => {
  const OutlineOnlyIcon = createIcon(<circle cx="12" cy="12" r="9" />, "OutlineOnlyIcon");
  const DualGlyphIcon = createIcon(
    <circle cx="12" cy="12" r="9" data-testid="outline-path" />,
    "DualGlyphIcon",
    { solid: <circle cx="12" cy="12" r="9" data-testid="solid-path" /> },
  );

  it("an icon without a solid option renders byte-identical DOM for every variant (fallback to outline)", () => {
    const base = render(<OutlineOnlyIcon />).container.querySelector("svg")?.innerHTML;
    const outline = render(<OutlineOnlyIcon variant="outline" />).container.querySelector(
      "svg",
    )?.innerHTML;
    const solid = render(<OutlineOnlyIcon variant="solid" />).container.querySelector(
      "svg",
    )?.innerHTML;
    expect(outline).toBe(base);
    expect(solid).toBe(base);
    expect(base).not.toContain("data-icon-glyph");
    expect(base).not.toContain("<g");
  });

  it('variant="outline" renders only the outline node, unwrapped (as today)', () => {
    const { container } = render(<DualGlyphIcon variant="outline" />);
    expect(container.querySelector('[data-testid="outline-path"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="solid-path"]')).toBeNull();
    expect(container.querySelector("g")).toBeNull();
    expect(container.querySelector("[data-icon-glyph]")).toBeNull();
  });

  it('variant="solid" renders only the solid node, in a fill=currentColor stroke=none group', () => {
    const { container } = render(<DualGlyphIcon variant="solid" />);
    expect(container.querySelector('[data-testid="solid-path"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="outline-path"]')).toBeNull();
    const group = container.querySelector("g");
    expect(group).not.toBeNull();
    expect(group?.getAttribute("fill")).toBe("currentColor");
    expect(group?.getAttribute("stroke")).toBe("none");
    // Explicit variant bypasses the theme-token switch entirely.
    expect(container.querySelector("[data-icon-glyph]")).toBeNull();
  });

  it("no variant renders both glyph groups, gated by data-icon-glyph, for the theme token to pick between", () => {
    const { container } = render(<DualGlyphIcon />);
    const outlineGroup = container.querySelector('[data-icon-glyph="outline"]');
    const solidGroup = container.querySelector('[data-icon-glyph="solid"]');
    expect(outlineGroup).not.toBeNull();
    expect(solidGroup).not.toBeNull();
    expect(outlineGroup?.querySelector('[data-testid="outline-path"]')).not.toBeNull();
    expect(solidGroup?.querySelector('[data-testid="solid-path"]')).not.toBeNull();
    expect(solidGroup?.getAttribute("fill")).toBe("currentColor");
    expect(solidGroup?.getAttribute("stroke")).toBe("none");
  });

  it("does not duplicate the accessible name across the hidden glyph group", () => {
    render(<DualGlyphIcon title="Bookmark" />);
    // Exactly one accessible "Bookmark" image, even though the DOM contains
    // two glyph groups (CSS, not the accessibility tree, hides one of them).
    expect(screen.getAllByRole("img", { name: "Bookmark" })).toHaveLength(1);
  });

  it("TYPE LOCK: createIcon's third argument only accepts a `solid` ReactNode option", () => {
    const typeOnlyProbe = () =>
      createIcon(<circle />, "Probe", {
        // @ts-expect-error — `solid` is the only recognised CreateIconOptions key.
        outline: <circle />,
      });
    expect(typeof typeOnlyProbe).toBe("function");
  });
});
