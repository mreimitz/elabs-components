import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LinkPreview, LinkPreviewCard } from "./link-preview";

describe("LinkPreviewCard", () => {
  // -------------------------------------------------------------------------
  // Loaded state
  // -------------------------------------------------------------------------

  it("renders title, description, and domain", () => {
    render(
      <LinkPreviewCard
        title="React – Quick start"
        description="Learn the basics."
        domain="react.dev"
      />,
    );
    expect(screen.getByText("React – Quick start")).toBeInTheDocument();
    expect(screen.getByText("Learn the basics.")).toBeInTheDocument();
    expect(screen.getByText("react.dev")).toBeInTheDocument();
  });

  it("renders a real <a> link when href is provided", () => {
    render(
      <LinkPreviewCard title="React docs" href="https://react.dev/learn" domain="react.dev" />,
    );
    const link = screen.getByRole("link", { name: /react docs/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://react.dev/learn");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("renders no <a> element when href is absent", () => {
    render(<LinkPreviewCard title="Static card" domain="example.com" />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  it("sets aria-busy when loading", () => {
    render(<LinkPreviewCard loading data-testid="card" />);
    const card = screen.getByTestId("card");
    expect(card).toHaveAttribute("aria-busy", "true");
  });

  it("does not render real content when loading", () => {
    render(
      <LinkPreviewCard
        loading
        title="Should not appear"
        description="Hidden"
        domain="example.com"
      />,
    );
    expect(screen.queryByText("Should not appear")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("does not set aria-busy when not loading", () => {
    render(<LinkPreviewCard title="Loaded" data-testid="card" />);
    const card = screen.getByTestId("card");
    // aria-busy is undefined (not present) when not loading
    expect(card).not.toHaveAttribute("aria-busy");
  });

  // -------------------------------------------------------------------------
  // No image
  // -------------------------------------------------------------------------

  it("renders no <img> when image prop is absent", () => {
    const { container } = render(<LinkPreviewCard title="No image" />);
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders a decorative <img> with alt='' when image is provided", () => {
    const { container } = render(
      <LinkPreviewCard title="Has image" image="https://example.com/og.png" />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("alt", "");
    expect(img).toHaveAttribute("aria-hidden", "true");
    expect(img).toHaveAttribute("src", "https://example.com/og.png");
  });

  // -------------------------------------------------------------------------
  // Composability
  // -------------------------------------------------------------------------

  it("forwards className and extra props to the root element", () => {
    render(
      <LinkPreviewCard
        title="Composable"
        className="my-custom-class"
        data-testid="card"
        aria-label="Link preview"
      />,
    );
    const card = screen.getByTestId("card");
    expect(card).toHaveClass("my-custom-class");
    expect(card).toHaveAttribute("aria-label", "Link preview");
  });

  it("renders children inside the card", () => {
    render(
      <LinkPreviewCard title="With children">
        <span data-testid="child">Extra content</span>
      </LinkPreviewCard>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // LinkPreview alias
  // -------------------------------------------------------------------------

  it("LinkPreview is the same component as LinkPreviewCard", () => {
    expect(LinkPreview).toBe(LinkPreviewCard);
  });
});
