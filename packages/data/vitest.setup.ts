import "@testing-library/jest-dom/vitest";

// jsdom does not implement `ResizeObserver`. Radix overlays (the DropdownMenu
// behind FacetFilter / ColumnPicker) construct one via floating-ui when their
// content mounts, so opening a menu in a test would otherwise throw. Standard
// no-op stub, mirroring the setup in @elabs-ai/components-ui / -ai.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
