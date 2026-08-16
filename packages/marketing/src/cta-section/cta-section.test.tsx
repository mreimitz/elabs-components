import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CTASection } from "./cta-section";

describe("CTASection", () => {
  it("renders the title", () => {
    render(<CTASection title="Start building today" animate={false} />);
    expect(screen.getByText("Start building today")).toBeInTheDocument();
  });

  it("renders the title as an h2 heading", () => {
    render(<CTASection title="Get started for free" animate={false} />);
    expect(
      screen.getByRole("heading", { level: 2, name: "Get started for free" }),
    ).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(<CTASection title="Ready?" description="No credit card required" animate={false} />);
    expect(screen.getByText("No credit card required")).toBeInTheDocument();
  });

  it("renders actions when provided", () => {
    render(<CTASection title="Join us" actions={<button>Sign up free</button>} animate={false} />);
    expect(screen.getByRole("button", { name: "Sign up free" })).toBeInTheDocument();
  });

  it("renders a section element in the document", () => {
    const { container } = render(<CTASection title="Call to action" animate={false} />);
    expect(container.querySelector("section")).toBeInTheDocument();
  });

  it("does not hardcode an alpha-faded foreground color on the description (#393)", () => {
    // A `-foreground` companion-token utility is only theme-correct on the SAME
    // element that carries the paired `bg-*` fill class (the section root, which
    // sets `text-primary-foreground`); a descendant must INHERIT color, never
    // re-declare its own alpha-faded `text-*-foreground/N`, or it silently
    // bypasses decoration.css's high-decoration ink override (packages/tokens/src/
    // decoration.css) and renders ~1.20:1 contrast at high decoration.
    render(<CTASection title="Ready?" description="No credit card required" animate={false} />);
    const description = screen.getByText("No credit card required");
    expect(description.className).not.toMatch(/text-\S+-foreground\/\d/);
  });
});
