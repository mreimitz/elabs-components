import type * as React from "react";
import { render, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PARALLAX_MAX_TRAVEL, ParallaxPlane, parallaxOffset } from "./parallax-plane";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parallaxOffset", () => {
  it("moves ground behind and float ahead of content, clamped to the max travel", () => {
    expect(parallaxOffset(40, 0.15, 1)).toBeCloseTo(34);
    expect(parallaxOffset(400, 0.15, 1)).toBe(PARALLAX_MAX_TRAVEL);
    expect(parallaxOffset(200, 1.2, 1)).toBeCloseTo(-40);
    expect(parallaxOffset(400, 1.2, 1)).toBe(-PARALLAX_MAX_TRAVEL);
    expect(parallaxOffset(400, 1, 1)).toBe(0);
  });

  it("collapses to no parallax at the motion floor", () => {
    expect(Math.abs(parallaxOffset(4000, 0.15, 0.0001))).toBeLessThan(0.5);
  });
});

describe("ParallaxPlane", () => {
  it("server-renders with no transform and no motion state", () => {
    const html = renderToString(<ParallaxPlane plane="ground">x</ParallaxPlane>);
    expect(html).toContain('data-plane="ground"');
    expect(html).not.toContain("data-parallax");
    expect(html).not.toContain("transform");
  });

  it("uses the scroll timeline when the browser has one", async () => {
    vi.stubGlobal("CSS", { supports: () => true });
    const { container } = render(<ParallaxPlane plane="ground" />);
    const el = container.querySelector<HTMLElement>('[data-slot="parallax-plane"]')!;
    await waitFor(() => expect(el).toHaveAttribute("data-parallax", "timeline"));
    expect(el.style.getPropertyValue("--parallax-travel")).toBe("60px");
    expect(Number.parseFloat(el.style.getPropertyValue("--parallax-range"))).toBeCloseTo(70.59, 1);
  });

  it("never moves the content plane or any plane under reduced motion", async () => {
    vi.stubGlobal("CSS", { supports: () => true });
    const { container } = render(<ParallaxPlane plane="content" />);
    // jsdom does not inherit custom properties, so the reduce dial sits on the plane itself.
    const { container: reduced } = render(
      <ParallaxPlane
        plane="float"
        style={{ "--motion-factor": "0.0001" } as React.CSSProperties}
      />,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container.firstElementChild).not.toHaveAttribute("data-parallax");
    expect(reduced.firstElementChild).not.toHaveAttribute("data-parallax");
    expect((reduced.firstElementChild as HTMLElement).style.transform).toBe("");
  });
});
