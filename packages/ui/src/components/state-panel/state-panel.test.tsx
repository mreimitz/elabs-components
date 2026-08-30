import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatePanel } from "./state-panel";
import { EmptyListIllustration } from "../../illustrations";

describe("StatePanel", () => {
  it("renders empty kind with title and description", () => {
    render(<StatePanel kind="empty" title="No items" description="Nothing here yet" />);
    expect(screen.getByText("No items")).toBeInTheDocument();
    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
    // No ARIA role on empty panels
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders error kind with role=alert, structural eyebrow, and default copy", () => {
    render(<StatePanel kind="error" />);
    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    // Structural eyebrow label — non-color cue for monochrome themes (#179).
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("An unexpected error occurred. Please try again.")).toBeInTheDocument();
    // data-kind attribute hook for future CSS targeting.
    expect(alert).toHaveAttribute("data-kind", "error");
  });

  it("error eyebrow uses the destructive INK rung, not the fill rung (#40)", () => {
    // The eyebrow is running TEXT on the panel's own `bg-destructive/5` wash, so
    // it must reach for `text-destructive-text` (>= 4.5:1, the text-rung
    // contract) — never the bare `text-destructive` fill rung, whose contract
    // is only the 3:1 mark bar. See styling-and-tokens.md "Which status rung a
    // graphical MARK reaches for" (#381).
    render(<StatePanel kind="error" />);
    const eyebrow = screen.getByText("Error");
    expect(eyebrow.className).toContain("text-destructive-text");
    expect(eyebrow.className).not.toMatch(/(?<!-)\btext-destructive\b(?!-)/);
  });

  it("error icon keeps the destructive FILL rung (a mark, not text)", () => {
    // Inverse of the eyebrow lock above: an icon IS a mark, so it correctly
    // stays on the fill rung — the fix must not "tidy" it onto -text too.
    const { container } = render(<StatePanel kind="error" />);
    const iconWrapper = container.querySelector("svg")?.parentElement;
    expect(iconWrapper?.className ?? "").toMatch(/\btext-destructive\b/);
    expect(iconWrapper?.className ?? "").not.toContain("text-destructive-text");
  });

  it("renders error kind with custom title", () => {
    render(<StatePanel kind="error" title="Custom error" description="Custom description" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Custom error")).toBeInTheDocument();
    expect(screen.getByText("Custom description")).toBeInTheDocument();
  });

  it("renders loading kind with role=status and live region", () => {
    render(<StatePanel kind="loading" loadingLabel="Loading data…" />);
    const status = screen.getByRole("status");
    expect(status).toBeInTheDocument();
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("Loading data…")).toBeInTheDocument();
  });

  it("renders loading kind with default label", () => {
    render(<StatePanel kind="loading" />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders actions when provided", () => {
    render(
      <StatePanel kind="empty" title="Empty" actions={<button type="button">New item</button>} />,
    );
    expect(screen.getByRole("button", { name: "New item" })).toBeInTheDocument();
  });

  it("renders custom icon when provided", () => {
    render(
      <StatePanel
        kind="empty"
        title="Custom icon"
        icon={<span data-testid="custom-icon">icon</span>}
      />,
    );
    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });

  it("renders an illustration without the size-10 icon clamp, decoratively (#24)", () => {
    const { container } = render(
      <StatePanel kind="empty" title="No items" illustration={<EmptyListIllustration />} />,
    );
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    // The illustration's own wrapper must NOT carry the `[&_svg]:size-10`
    // clamp the default icon slot uses — its rem sizing governs instead.
    const wrapper = svg?.parentElement;
    expect(wrapper?.className ?? "").not.toContain("size-10");
  });

  it("prefers illustration over icon when both are given", () => {
    render(
      <StatePanel
        kind="empty"
        title="Both given"
        icon={<span data-testid="custom-icon">icon</span>}
        illustration={<EmptyListIllustration />}
      />,
    );
    expect(screen.queryByTestId("custom-icon")).toBeNull();
  });
});
