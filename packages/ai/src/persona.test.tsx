import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { PERSONA_SOURCES, Persona } from "./persona";

describe("Persona — remote artwork escape hatches", () => {
  it("renders a fallback rather than an empty box before the Rive chunk loads", () => {
    // The Rive runtime is behind `lazy()`, so the first frame is always the
    // Suspense fallback. Previously a blocked `.riv` left a bare 64px void.
    const { container } = render(<Persona state="idle" src="about:blank#offline" />);
    expect(container.firstElementChild).not.toBeNull();
    // The visually-hidden status announcement is the only text content now.
    expect(container.textContent).toBe("Assistant idle");
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it("renders a caller-supplied fallback", () => {
    render(<Persona state="idle" src="about:blank#offline" fallback={<span>resting</span>} />);
    expect(screen.getByText("resting")).toBeInTheDocument();
  });

  it("throws on an unknown variant, as before", () => {
    expect(() =>
      // @ts-expect-error — deliberately invalid variant
      render(<Persona state="idle" variant="nope" />),
    ).toThrow(/Invalid variant/);
  });
});

describe("Persona — state announced to assistive tech", () => {
  it("announces a localized status for the current state", () => {
    render(<Persona state="thinking" src="about:blank#offline" />);
    expect(screen.getByRole("status")).toHaveTextContent("Assistant thinking…");
  });

  it("updates the SAME live region rather than remounting it when state changes", () => {
    const { rerender } = render(<Persona state="thinking" src="about:blank#offline" />);
    const region = screen.getByRole("status");
    expect(region).toHaveTextContent("Assistant thinking…");

    rerender(<Persona state="speaking" src="about:blank#offline" />);
    expect(screen.getByRole("status")).toBe(region);
    expect(region).toHaveTextContent("Assistant speaking");
  });

  it("renders no status region when statusLabel is explicitly null", () => {
    render(<Persona state="thinking" src="about:blank#offline" statusLabel={null} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders a caller-supplied statusLabel instead of the default", () => {
    render(
      <Persona state="thinking" src="about:blank#offline" statusLabel={<span>Working</span>} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Working");
  });
});

describe("PERSONA_SOURCES", () => {
  it("is exported so consumers can self-host every artwork file", () => {
    const variants = Object.keys(PERSONA_SOURCES);
    expect(variants).toHaveLength(6);
    for (const source of Object.values(PERSONA_SOURCES)) {
      expect(source.source).toMatch(/^https:\/\/.*\.riv$/);
    }
  });
});
