import "@testing-library/jest-dom/vitest";

// jsdom does not implement `window.matchMedia`. Components that read media
// queries at runtime — `ThemeProvider`/`useReducedMotion` (reduced-motion),
// `ThemeSwitcher` (system color scheme), `useIsMobile` — would otherwise throw
// on mount under the jsdom environment. Provide the standard "no match" stub so
// those components render in tests exactly as they do in a real browser.
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
        // Deprecated MediaQueryList API — some libraries still call these.
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  });
}

// jsdom does not implement `ResizeObserver`. Radix's `useSize` hook (Slider,
// and other size-observing primitives) calls it unconditionally on mount, so
// rendering one under jsdom would otherwise throw. Standard no-op stub,
// mirroring the setup in @elabs-ai/components-data / -ai.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// NOTE: deliberately NO `Element.prototype.scrollIntoView` stub here. A stub in
// THIS package's setup would only make @elabs-ai/components-ui's own
// tests pass while every other jsdom consumer of a `@elabs-ai/components-ui`
// component (editor, charts, flow, …) still crashed. Components must therefore
// feature-detect scroll APIs themselves — see `scrollTriggerIntoStrip` in
// `src/components/tabs/tabs.tsx`.
