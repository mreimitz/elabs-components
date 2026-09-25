import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetFlowWarnings } from "../lib/warn-once";
import { FLOW_TONES, flowToneVariants, resolveFlowTone } from "./flow-tone";
import { FlowToneIndicator } from "./flow-tone-indicator";

describe("resolveFlowTone", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    resetFlowWarnings();
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it("defaults to a neutral, default-emphasis tone", () => {
    expect(resolveFlowTone()).toEqual({ tone: "neutral", emphasis: "default" });
    expect(warn).not.toHaveBeenCalled();
  });

  it.each(FLOW_TONES)("passes %s through unchanged", (tone) => {
    expect(resolveFlowTone(tone, "featured")).toEqual({ tone, emphasis: "featured" });
    expect(warn).not.toHaveBeenCalled();
  });

  it('maps the legacy "accent" onto a neutral, featured tone and warns once', () => {
    expect(resolveFlowTone("accent")).toEqual({ tone: "neutral", emphasis: "featured" });
    resolveFlowTone("accent");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toMatch(/emphasis: "featured"/);
  });

  it('maps the legacy "default" onto "neutral" and warns once', () => {
    expect(resolveFlowTone("default", "featured")).toEqual({
      tone: "neutral",
      emphasis: "featured",
    });
    resolveFlowTone("default");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toMatch(/tone: "neutral"/);
  });

  it("falls back to neutral for a value outside the vocabulary", () => {
    // Untyped data (a file, a server payload) can carry anything.
    expect(resolveFlowTone("primary" as never)).toEqual({ tone: "neutral", emphasis: "default" });
  });
});

describe("flowToneVariants", () => {
  it("adds nothing for a neutral, default card", () => {
    expect(flowToneVariants().trim()).toBe("");
  });

  it("paints the border and both text rungs of a status tone", () => {
    const classes = flowToneVariants({ tone: "warning" });
    expect(classes).toContain("border-warning");
    expect(classes).toContain("**:data-[flow-tone-part=mark]:text-warning");
    expect(classes).toContain("**:data-[flow-tone-part=ink]:text-warning-text");
  });

  it("gives a neutral featured card the primary border and ink", () => {
    const classes = flowToneVariants({ tone: "neutral", emphasis: "featured" });
    expect(classes).toContain("border-primary");
    expect(classes).toContain("**:data-[flow-tone-part=ink]:text-primary-text");
    expect(classes).toContain("**:data-[flow-tone-part=emphasis]:text-primary");
  });

  it("keeps the status border on a featured card with a status tone", () => {
    const classes = flowToneVariants({ tone: "success", emphasis: "featured" });
    expect(classes).toContain("border-success");
    expect(classes).not.toContain("border-primary");
  });
});

describe("FlowToneIndicator", () => {
  it("renders nothing for a neutral, default tone", () => {
    const { container } = render(<FlowToneIndicator />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ["info", "Info"],
    ["success", "Success"],
    ["warning", "Warning"],
    ["destructive", "Destructive"],
  ] as const)("names the %s tone and draws its glyph", (tone, name) => {
    const { container } = render(<FlowToneIndicator tone={tone} />);
    expect(screen.getByText(name)).toHaveClass("sr-only");
    const glyph = container.querySelector('svg[data-flow-tone-part="ink"]');
    expect(glyph).toHaveAttribute("aria-hidden", "true");
  });

  it("draws the star and names a featured node", () => {
    const { container } = render(<FlowToneIndicator emphasis="featured" />);
    expect(screen.getByText("Featured")).toHaveClass("sr-only");
    expect(container.querySelector('svg[data-flow-tone-part="emphasis"]')).toBeInTheDocument();
  });

  it("names both axes when a featured node also has a status tone", () => {
    render(<FlowToneIndicator tone="destructive" emphasis="featured" />);
    expect(screen.getByText("Featured, Destructive")).toBeInTheDocument();
  });

  it("forwards its ref and merges className", () => {
    let node: HTMLSpanElement | null = null;
    render(
      <FlowToneIndicator
        tone="success"
        className="probe"
        ref={(el) => {
          node = el;
        }}
      />,
    );
    expect(node).toHaveAttribute("data-slot", "flow-tone-indicator");
    expect(node).toHaveClass("probe");
  });
});
