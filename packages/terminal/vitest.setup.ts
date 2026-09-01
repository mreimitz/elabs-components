import "@testing-library/jest-dom/vitest";

// jsdom does not implement `window.matchMedia`. Any `@elabs-ai/components-ui`
// component that reads a media query at runtime (Sidebar/Sheet fallbacks via
// `useIsMobile`, reduced-motion checks) throws on mount without it, and this
// package composes those. Standard "no match" stub, mirroring the setup in
// `@elabs-ai/components-ui` / `-ai` / `-viewer`.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  });
}

// jsdom does not implement `ResizeObserver`; Radix's size-observing primitives
// and a terminal's own fit/resize path call it unconditionally on mount.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
