import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  ServiceLogo,
  clearServiceLogos,
  registerServiceLogos,
  type ServiceLogoRegistry,
} from "./service-logo";

afterEach(() => {
  clearServiceLogos();
});

describe("ServiceLogo", () => {
  it("renders a monogram fallback for an unregistered name — never broken/blank", () => {
    const { container } = render(<ServiceLogo name="unknown-service" />);
    // A real, visible glyph — not an empty wrapper.
    expect(container.querySelector('[data-slot="service-logo-fallback"]')).toBeInTheDocument();
    expect(container.querySelector("text")?.textContent).toBe("U");
    expect(screen.getByRole("img", { name: "Unknown Service" })).toBeInTheDocument();
  });

  it("renders the consumer-supplied mark for a registered name (global registry)", () => {
    registerServiceLogos({
      northwind: {
        render: ({ size }) => <svg data-testid="northwind-mark" width={size} height={size} />,
      },
    });
    render(<ServiceLogo name="northwind" />);
    expect(screen.getByTestId("northwind-mark")).toBeInTheDocument();
    // The fallback tile must NOT render once a mark is registered.
    expect(document.querySelector('[data-slot="service-logo-fallback"]')).not.toBeInTheDocument();
  });

  it("accepts a locally-scoped `logos` registry that overrides the global one", () => {
    const scoped: ServiceLogoRegistry = {
      northwind: { render: () => <svg data-testid="scoped-mark" /> },
    };
    render(<ServiceLogo name="northwind" logos={scoped} />);
    expect(screen.getByTestId("scoped-mark")).toBeInTheDocument();
  });

  it('variant="mono" renders the fallback tile via currentColor only — no other literal fill/stroke', () => {
    const { container } = render(<ServiceLogo name="unregistered" variant="mono" />);
    const svg = container.querySelector('[data-slot="service-logo-fallback"] svg');
    expect(svg).toBeInTheDocument();
    // Every fill/stroke attribute inside the fallback SVG must be "currentColor"
    // or "none" — never a literal color — regardless of variant.
    for (const el of svg?.querySelectorAll("[fill], [stroke]") ?? []) {
      for (const attr of ["fill", "stroke"]) {
        const value = el.getAttribute(attr);
        if (value !== null) expect(["currentColor", "none"]).toContain(value);
      }
    }
  });

  it("exposes an accessible name from `name` by default, and from `label` when given", () => {
    const { rerender } = render(<ServiceLogo name="github" />);
    expect(screen.getByRole("img", { name: "Github" })).toBeInTheDocument();
    rerender(<ServiceLogo name="github" label="GitHub" />);
    expect(screen.getByRole("img", { name: "GitHub" })).toBeInTheDocument();
  });

  it("a registered entry's own `label` supplies the accessible name", () => {
    registerServiceLogos({ gh: { render: () => <svg />, label: "GitHub" } });
    render(<ServiceLogo name="gh" />);
    expect(screen.getByRole("img", { name: "GitHub" })).toBeInTheDocument();
  });

  it("decorative=true hides the mark from AT instead of duplicating an adjacent label", () => {
    const { container } = render(
      <>
        <span>Slack</span>
        <ServiceLogo name="slack" decorative />
      </>,
    );
    expect(screen.queryByRole("img", { name: "Slack" })).not.toBeInTheDocument();
    expect(container.querySelector('[data-slot="service-logo"]')).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("sizes the root to the `size` prop (mirrors Icon's default of 24)", () => {
    const { container } = render(<ServiceLogo name="x" />);
    const root = container.querySelector('[data-slot="service-logo"]') as HTMLElement;
    expect(root.style.width).toBe("24px");
    expect(root.style.height).toBe("24px");
  });
});
