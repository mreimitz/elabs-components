import "@testing-library/jest-dom/vitest";

// jsdom does not implement `ResizeObserver`. Radix's `useSize` hook (Slider,
// behind `AbstractionControls`) calls it unconditionally on mount, so
// rendering one under jsdom would otherwise throw. Standard no-op stub,
// mirroring the setup in @elabs-ai/components-ui / -data / -ai.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// jsdom does not implement the Pointer Events capture API. Radix's `Select`
// (behind `MetricLayerSwitch`) calls `target.hasPointerCapture` from its
// pointer handlers, which throws under jsdom and aborts the interaction
// before the option list ever opens/selects. Standard no-op stubs — this is
// the package's first test to drive a Radix `Select` option click, so no
// sibling package's setup has this yet.
if (typeof Element.prototype.hasPointerCapture !== "function") {
  Element.prototype.hasPointerCapture = () => false;
}
if (typeof Element.prototype.setPointerCapture !== "function") {
  Element.prototype.setPointerCapture = () => {};
}
if (typeof Element.prototype.releasePointerCapture !== "function") {
  Element.prototype.releasePointerCapture = () => {};
}
if (typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = () => {};
}
