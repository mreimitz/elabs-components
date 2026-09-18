import type * as React from "react";
import { act, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RevealOnEnter } from "./reveal-on-enter";

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;
let fire: ObserverCallback = () => {};

function stubObserver() {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: ObserverCallback) {
        fire = cb;
      }
      observe() {}
      disconnect() {}
    },
  );
}

function belowTheFold(el: Element) {
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({ top: 5000, bottom: 5100 } as DOMRect);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.documentElement.style.removeProperty("--motion-factor");
});

describe("RevealOnEnter", () => {
  it("server-renders its children fully visible", () => {
    const html = renderToString(
      <RevealOnEnter as="section" stagger>
        <p>One</p>
        <p>Two</p>
      </RevealOnEnter>,
    );
    expect(html).toContain("<section");
    expect(html).toContain("One");
    expect(html).not.toMatch(/opacity|hidden|data-reveal/);
  });

  it("hides off-screen content after hydration and reveals it once", () => {
    stubObserver();
    const proto = HTMLElement.prototype;
    belowTheFold(proto);
    const { container } = render(<RevealOnEnter>Hello</RevealOnEnter>);
    const el = container.firstElementChild!;
    expect(el).toHaveAttribute("data-reveal", "hidden");
    act(() => fire([{ isIntersecting: true }]));
    expect(el).toHaveAttribute("data-reveal", "shown");
    act(() => fire([{ isIntersecting: false }]));
    expect(el).toHaveAttribute("data-reveal", "shown");
  });

  it("indexes children for the stagger", () => {
    stubObserver();
    belowTheFold(HTMLElement.prototype);
    const { container } = render(
      <RevealOnEnter stagger>
        <p>One</p>
        <p>Two</p>
      </RevealOnEnter>,
    );
    const second = container.querySelectorAll("p")[1]!;
    expect(second.style.getPropertyValue("--reveal-index")).toBe("1");
  });

  it("never hides content at the motion floor or without an observer", () => {
    belowTheFold(HTMLElement.prototype);
    vi.stubGlobal("IntersectionObserver", undefined);
    const { container: noObserver } = render(<RevealOnEnter>A</RevealOnEnter>);
    expect(noObserver.firstElementChild).not.toHaveAttribute("data-reveal");
    stubObserver();
    // A subtree dials motion through --motion-factor; jsdom does not inherit custom
    // properties, so the dial sits on the element itself here.
    const { container: reduced } = render(
      <RevealOnEnter style={{ "--motion-factor": "0.0001" } as React.CSSProperties}>
        B
      </RevealOnEnter>,
    );
    expect(reduced.firstElementChild).not.toHaveAttribute("data-reveal");
  });
});
