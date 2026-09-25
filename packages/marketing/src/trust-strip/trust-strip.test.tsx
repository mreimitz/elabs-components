import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrustStrip } from "./trust-strip";

const FACTS = [
  { id: "packages", label: "13 packages", href: "https://github.com/x" },
  { id: "license", label: "MIT", href: "https://github.com/x/LICENSE" },
];

describe("TrustStrip", () => {
  it("renders each fact as a link to its proof", () => {
    render(<TrustStrip facts={FACTS} />);
    expect(screen.getByRole("link", { name: "13 packages" })).toHaveAttribute(
      "href",
      "https://github.com/x",
    );
    expect(screen.getByRole("link", { name: "MIT" })).toBeInTheDocument();
  });

  it("opens an off-site proof in a new tab and keeps an on-site one in place", () => {
    render(<TrustStrip facts={[...FACTS, { id: "docs", label: "Docs", href: "/docs" }]} />);
    const offsite = screen.getByRole("link", { name: "13 packages" });
    expect(offsite).toHaveAttribute("target", "_blank");
    expect(offsite).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("link", { name: "Docs" })).not.toHaveAttribute("target");
  });

  it("renders the counters slot only when passed", () => {
    const { container, rerender } = render(<TrustStrip facts={FACTS} />);
    expect(container.querySelector('[data-slot="trust-strip-counters"]')).toBeNull();
    rerender(<TrustStrip facts={FACTS} counters={<span>42 stars</span>} />);
    expect(container.querySelector('[data-slot="trust-strip-counters"]')).toHaveTextContent(
      "42 stars",
    );
  });
});
