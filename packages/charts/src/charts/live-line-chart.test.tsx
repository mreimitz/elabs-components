// LiveLineChart measures through ChartParentSize (ResizeObserver + layout
// measurement) and a requestAnimationFrame-driven animation loop — neither
// works correctly in jsdom. We mock ParentSize to supply a fixed size and stub
// rAF as a no-op so the component can mount without stack-overflow or layout
// errors. Real render + a11y are covered by the Storybook build (same
// precedent as @elabs-ai/components-flow's canvas-shell.test.tsx).
//
// NOTE: forwardRef() returns an exotic object, not a plain function, so
// `typeof LiveLineChart` is "object". We verify the export shape via
// `$$typeof` instead of the naive "function" check.

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./chart-parent-size", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  return {
    ChartParentSize: ({
      children,
    }: {
      children: (dims: { width: number; height: number }) => React.ReactNode;
    }) =>
      React.createElement(
        "div",
        { "data-testid": "parent-size" },
        children({ width: 560, height: 288 }),
      ),
  };
});

// No-op rAF: returns a handle but never fires the callback, preventing the
// infinite rAF→tick→rAF loop that would stack-overflow jsdom.
global.requestAnimationFrame = (_cb) => 0;
global.cancelAnimationFrame = () => {};

// LiveLineChart's visibility-gated animation loop mounts framer-motion's
// `useInView`, which reads the global directly — jsdom has no
// IntersectionObserver at all (RM-038; same stub as auto-chart.test.tsx).
if (typeof window !== "undefined" && !("IntersectionObserver" in window)) {
  class StubIntersectionObserver {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds: readonly number[] = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  (globalThis as Record<string, unknown>).IntersectionObserver = StubIntersectionObserver;
}

import type { ReactElement } from "react";
import { resetWarnOnce } from "@elabs-ai/components-ui/definition";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import { LiveLineChart as LiveLineChartDouble } from "../test";
import { LiveLine } from "./live-line";
import { LiveLineChart, type LiveLineChartProps, type LiveLinePoint } from "./live-line-chart";
import { LiveXAxis } from "./live-x-axis";
import { LiveYAxis } from "./live-y-axis";

afterEach(cleanup);

const NOW_SEC = Math.floor(Date.now() / 1000);
const sampleData: LiveLinePoint[] = Array.from({ length: 10 }, (_, i) => ({
  time: NOW_SEC - (9 - i),
  value: 50 + i,
}));

function renderChart(props?: Partial<LiveLineChartProps>) {
  return render(
    <LiveLineChart data={sampleData} value={59} {...props}>
      <LiveLine dataKey="value" />
    </LiveLineChart>,
  );
}

describe("LiveLineChart", () => {
  it("is exported and is a valid React forwardRef component", () => {
    // forwardRef() returns an exotic object ($$typeof === REACT_FORWARD_REF_TYPE),
    // not a plain function — so we check it is non-null and renderable.
    expect(LiveLineChart).toBeDefined();
    expect(LiveLineChart).not.toBeNull();
  });

  it("mounts and the container is in the document", () => {
    const { container } = renderChart();
    expect(container.firstChild).toBeInTheDocument();
  });

  it("applies a custom className to the container", () => {
    const { container } = renderChart({ className: "my-live-chart" });
    expect(container.firstChild).toHaveClass("my-live-chart");
  });

  it("accepts a forwarded ref and attaches it to the container div", () => {
    const ref = { current: null as HTMLDivElement | null };
    const { container } = render(
      <LiveLineChart data={sampleData} value={59} ref={ref}>
        <LiveLine dataKey="value" />
      </LiveLineChart>,
    );
    expect(ref.current).toBe(container.firstChild);
  });

  it("adds role/aria-label/tabIndex when accessibleLabel is provided", () => {
    const { container } = renderChart({
      accessibleLabel: "CPU usage live chart",
      accessibleDescription: "Streaming CPU metric. Current value: ~59.",
    });
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("role")).toBe("figure");
    expect(root.getAttribute("aria-label")).toBe("CPU usage live chart");
    expect(root.getAttribute("tabindex")).toBe("0");
    const descSpan = root.querySelector("span.sr-only");
    expect(descSpan).toBeInTheDocument();
  });

  it("does NOT add role/aria-label when accessibleLabel is absent", () => {
    const { container } = renderChart();
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("role")).toBeNull();
    expect(root.getAttribute("aria-label")).toBeNull();
  });

  it("pulses the live ring with SMIL by default", () => {
    const { container } = renderChart();
    expect(container.querySelectorAll("circle animate").length).toBeGreaterThan(0);
  });

  it("keeps the live ring still under reduced motion (SMIL ignores the CSS gate)", () => {
    const { container } = render(
      <ThemeProvider defaultMotionPreference="reduced" storageKey={null}>
        <LiveLineChart data={sampleData} value={59}>
          <LiveLine dataKey="value" />
        </LiveLineChart>
      </ThemeProvider>,
    );
    expect(container.querySelector("circle animate")).toBeNull();
    // The ring itself stays, as the still cue for "live".
    expect(container.querySelectorAll("circle").length).toBeGreaterThan(1);
  });
});

// #394: axis tick labels must reach the density-aware `text-meta` ROLE, not
// the raw `text-xs` UTILITY the type dial cannot see (styling-and-tokens.md
// "Type is a role, not a size").
describe("LiveXAxis / LiveYAxis — density-role className (#394)", () => {
  it("LiveXAxis renders its time label with the text-meta role, not the raw text-xs utility", () => {
    const { container } = render(
      <LiveLineChart data={sampleData} value={59}>
        <LiveLine dataKey="value" />
        <LiveXAxis />
      </LiveLineChart>,
    );
    const label = container.querySelector(".text-chart-label");
    expect(label).not.toBeNull();
    expect(label).toHaveClass("text-meta");
    expect(label).not.toHaveClass("text-xs");
  });

  it("LiveYAxis renders its tick label with the text-meta role, not the raw text-xs utility", () => {
    const { container } = render(
      <LiveLineChart data={sampleData} value={59}>
        <LiveLine dataKey="value" />
        <LiveYAxis />
      </LiveLineChart>,
    );
    const label = container.querySelector(".text-chart-label");
    expect(label).not.toBeNull();
    expect(label).toHaveClass("text-meta");
    expect(label).not.toHaveClass("text-xs");
  });
});

// ── RM-195: `window` → `windowSeconds` (ADR 0042 A.5 row 27) ──

/** One render's markup, `useId` tokens renumbered so two renders compare. */
function markupOf(ui: ReactElement): string {
  const { container, unmount } = render(ui);
  const html = container.innerHTML;
  unmount();
  const ids = [...new Set(html.match(/_r_[0-9a-z]+_|«r[0-9a-z]+»|:r[0-9a-z]+:/g) ?? [])];
  return ids.reduce((out, id, i) => out.split(id).join(`@id${i}@`), html);
}

/** The `console.warn` calls that are deprecation warnings. */
const deprecations = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.filter(([message]) => String(message).includes("is deprecated"));

describe("LiveLineChart renamed props (RM-195)", () => {
  const chart = (props: Record<string, unknown>) => (
    <LiveLineChart data={sampleData} value={59} {...props}>
      <LiveLine dataKey="value" />
      <LiveXAxis />
    </LiveLineChart>
  );

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("window renders exactly what windowSeconds renders", () => {
    // `now` (the ring's clock and the axis's right edge) is `Date.now()` — freeze it so
    // the two renders being compared land on the same instant.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW_SEC * 1000);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const viaOld = markupOf(chart({ window: 5 }));
    expect(viaOld).toBe(markupOf(chart({ windowSeconds: 5 })));
    expect(viaOld).not.toBe(markupOf(chart({})));
  });

  it("window warns once in development, naming windowSeconds", () => {
    resetWarnOnce();
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(chart({ window: 5 })).unmount();
    render(chart({ window: 5 })).unmount();
    expect(deprecations(spy)).toEqual([
      [
        '[LiveLineChart] "window" is deprecated and will be removed in 6.0.0. ' +
          'Use "windowSeconds".',
      ],
    ]);
  });

  it("window never warns in production", () => {
    resetWarnOnce();
    vi.stubEnv("NODE_ENV", "production");
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(chart({ window: 5 })).unmount();
    expect(deprecations(spy)).toEqual([]);
  });

  it("keeps the ./test double silent under the default deprecatedProps", () => {
    resetWarnOnce();
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <LiveLineChartDouble data={sampleData} value={59} window={5}>
        <LiveLine dataKey="value" />
      </LiveLineChartDouble>,
    ).unmount();
    expect(spy).not.toHaveBeenCalled();
  });

  it("lets windowSeconds win when both are given (new-wins)", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW_SEC * 1000);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const viaBoth = markupOf(chart({ window: 5, windowSeconds: 30 }));
    expect(viaBoth).toBe(markupOf(chart({ windowSeconds: 30 })));
  });

  it("says window was ignored when windowSeconds is also given", () => {
    resetWarnOnce();
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(chart({ window: 5, windowSeconds: 30 })).unmount();
    expect(deprecations(spy)).toEqual([
      [
        '[LiveLineChart] "window" is deprecated and will be removed in 6.0.0. ' +
          'Use "windowSeconds". "window" was ignored because "windowSeconds" is set.',
      ],
    ]);
  });
});
