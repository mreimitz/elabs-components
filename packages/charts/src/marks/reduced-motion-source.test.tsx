/**
 * One reduced-motion source (RM-189): every chart reads the tokens package's
 * `useReducedMotion`, so the person's own motion setting from the theme wins
 * over the OS setting. Nothing is mocked here: `DrawPath` stands in for every
 * chart mark, since they all branch on the same hook.
 */
import { render } from "@testing-library/react";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DrawPath } from "./draw-path";

/** Make the OS report `prefers-reduced-motion: reduce` (or not). */
function stubOsReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    (query: string): MediaQueryList =>
      ({
        matches: reduce && query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
}

function renderPath(wrap: (children: ReactNode) => ReactNode) {
  return render(
    <>
      {wrap(
        <svg>
          <DrawPath d="M 0 0 L 50 50" stroke="currentColor" />
        </svg>,
      )}
    </>,
  );
}

/** The drawn path: a draw-in entrance carries a one-unit dash, a still path none. */
function drawsIn(container: Element): boolean {
  const path = container.querySelector('[data-slot="draw-path"]');
  expect(path).not.toBeNull();
  return path?.getAttribute("stroke-dasharray") === "1";
}

describe("reduced-motion source (RM-189)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("follows the OS setting when there is no theme provider", () => {
    stubOsReducedMotion(true);
    expect(drawsIn(renderPath((children) => children).container)).toBe(false);
  });

  it("lets the person's reduced setting win over an OS that allows motion", () => {
    stubOsReducedMotion(false);
    const { container } = renderPath((children) => (
      <ThemeProvider defaultMotionPreference="reduced" motionStorageKey={null}>
        {children}
      </ThemeProvider>
    ));
    expect(drawsIn(container)).toBe(false);
  });

  it("lets the person's full-motion setting win over an OS that asks for reduced", () => {
    stubOsReducedMotion(true);
    const { container } = renderPath((children) => (
      <ThemeProvider defaultMotionPreference="full" motionStorageKey={null}>
        {children}
      </ThemeProvider>
    ));
    expect(drawsIn(container)).toBe(true);
  });
});
