import "@testing-library/jest-dom/vitest";

// jsdom does not implement `ResizeObserver`. Several charts components measure
// their own container via `react-use-measure` (BulletChart, DumbbellChart,
// ScatterChart, BumpChart, CanvasLayer, ParallelCoordinatesChart) or a local
// hook (`Sparkline`'s `fit="fill"`), which calls it unconditionally on mount,
// so rendering one under jsdom would otherwise throw. Standard no-op stub,
// mirroring the setup in @elabs-ai/components-ui / -data / -ai. A component's
// OWN test file that needs deterministic (nonzero) measured bounds still
// mocks `react-use-measure` directly (see `bullet-chart.test.tsx`) — this
// stub only keeps components MOUNTABLE (e.g. in the generated `__contract__`
// probes), it never fires a callback.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
