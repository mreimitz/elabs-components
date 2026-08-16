import "@testing-library/jest-dom/vitest";

// jsdom does not implement `ResizeObserver`. Radix overlays (Tooltip/Popover)
// and auto-sizing surfaces mount one on interaction, so any user-event click in
// a composer/chat surface would otherwise throw. Provide the standard no-op stub.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// jsdom does not implement `IntersectionObserver`. Embla's slides-in-view module
// (Carousel, used by Gallery) constructs one on mount. Standard no-op stub.
if (typeof globalThis.IntersectionObserver === "undefined") {
  globalThis.IntersectionObserver = class {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
}

// jsdom does not implement `URL.createObjectURL` / `revokeObjectURL`. PromptInput
// mints a blob URL per attachment (and revokes it on removal/unmount), so any
// test that uploads a file would otherwise throw. Hand back a unique, revocable
// `blob:` string — PromptInput's submit path branches on that prefix.
if (typeof URL.createObjectURL !== "function") {
  let n = 0;
  URL.createObjectURL = () => `blob:mock/${++n}`;
  URL.revokeObjectURL = () => {};
}

// jsdom does not implement `window.matchMedia`. Components/libraries that read
// media queries on mount — Embla (Carousel, used by Gallery), `useIsMobile`,
// reduced-motion checks — would otherwise throw. Mirror the canonical "no match"
// stub from @elabs/components-ui's setup (incl. the deprecated addListener/removeListener
// API that Embla still calls).
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
