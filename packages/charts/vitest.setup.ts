import "@testing-library/jest-dom/vitest";

// jsdom does not implement `ResizeObserver`. The chart families measure their
// own box through `useLayoutMeasure` (`src/charts/layout-size.ts`, directly or
// via `ChartParentSize`), and a few surfaces (ChartFrame, the tooltip, the
// navigator) observe on mount too. Standard no-op stub,
// mirroring the setup in @elabs-ai/components-ui / -data / -ai. A component's
// OWN test file that needs deterministic (nonzero) measured bounds still
// mocks `useLayoutMeasure` directly (see `bullet-chart.test.tsx`) — this
// stub only keeps components MOUNTABLE (e.g. in the generated `__contract__`
// probes), it never fires a callback.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
