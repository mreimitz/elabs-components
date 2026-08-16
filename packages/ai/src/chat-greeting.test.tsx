import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatGreeting } from "./chat-greeting";

describe("ChatGreeting", () => {
  it("renders the title and accent text", () => {
    render(
      <ChatGreeting title="Good morning, Avery" subtitle="How can I" accent="assist you today?" />,
    );

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Good morning, Avery");
    expect(screen.getByText("assist you today?")).toBeInTheDocument();
  });

  // #254 follow-up: `accent` used to be nested inside the `subtitle` branch, so
  // an accent-without-subtitle combination silently rendered nothing past the
  // title. Both must be independently renderable.
  it("renders accent even when subtitle is omitted", () => {
    render(<ChatGreeting title="Hi Avery" accent="what are we building today?" />);

    expect(screen.getByText("what are we building today?")).toBeInTheDocument();
  });

  // #254 follow-up: a monochrome theme's --primary can be a near-white "pen",
  // ΔL/ΔC vs --foreground so small that `text-primary` alone is invisible as
  // an accent there. The underline + bold weight are a NON-hue channel that
  // must survive regardless of which theme resolves `text-primary`.
  it("carries a non-hue emphasis (bold + underline) on the accent, not color alone", () => {
    render(<ChatGreeting title="Hi Avery" accent="assist you today?" />);

    const accent = screen.getByText("assist you today?");
    const classes = accent.className.split(" ");
    expect(classes).toContain("font-bold");
    expect(classes).toContain("underline");
  });

  it("renders subtitle even when accent is omitted", () => {
    render(<ChatGreeting title="Hi Avery" subtitle="Ready when you are" />);

    // `subtitle` is a bare text node beside `title` inside the same heading (no
    // wrapping element of its own, unlike `accent`), so assert via the
    // heading's text content rather than `getByText` (which matches an
    // element's OWN text, not a node it merely contains).
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Ready when you are");
  });

  it("renders an aria-hidden orb by default and omits it when orb is false", () => {
    const { container, rerender } = render(<ChatGreeting title="Hello" />);

    const orb = container.querySelector('[aria-hidden="true"]');
    expect(orb).not.toBeNull();

    rerender(<ChatGreeting title="Hello" orb={false} />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  // #254 root-cause: without `isolate`, the negative-z-index orb paints BELOW
  // an opaque ancestor's own background (CSS painting order), so it's
  // invisible in every shipped usage (all wrap ChatGreeting in a filled
  // container). `isolate` gives ChatGreeting its own stacking context so the
  // whole subtree — orb included — paints as one unit above the ancestor fill.
  it("isolates its own stacking context so the orb can paint above an ancestor fill", () => {
    const { container } = render(<ChatGreeting title="Hello" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className.split(" ")).toContain("isolate");
  });

  it("defaults to a level-1 heading and honors an explicit level override", () => {
    const { rerender } = render(<ChatGreeting title="Hello" />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();

    rerender(<ChatGreeting title="Hello" level={2} />);
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });

  // Reuse audit: the headline is the shared `Heading` primitive so it carries
  // the `--font-display` brand seam, not a hand-rolled `<h1>`.
  it("renders the title through the shared Heading primitive (font-display seam)", () => {
    render(<ChatGreeting title="Hello" />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.className.split(" ")).toContain("font-display");
  });

  it("merges a custom className onto the root", () => {
    const { container } = render(<ChatGreeting title="Hello" className="custom-class" />);

    expect(container.firstElementChild).toHaveClass("custom-class");
  });
});
