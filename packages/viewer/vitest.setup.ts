import "@testing-library/jest-dom/vitest";

// jsdom does not implement `window.matchMedia`. Any `@elabs-ai/components-ui`
// component that reads a media query at runtime (Sidebar/Sheet fallbacks via
// `useIsMobile`, reduced-motion checks) throws on mount without it, and this
// package composes those. Standard "no match" stub, mirroring the setup in
// `@elabs-ai/components-ui` / `-ai` / `-data`.
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
// call it unconditionally on mount.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// jsdom has no layout: every box measures 0 × 0. `@tanstack/react-virtual`
// refuses to compute a range against a zero-height viewport (`outerSize > 0` is
// a hard condition in virtual-core), so the continuously-scrolling PDF and deck
// renderers would mount an empty column and NOTHING about them could be
// asserted. One fixed viewport-sized rect is enough: the tests here are about
// which pages mount and what they contain, never about pixel positions, and the
// real scrolling is exercised in a browser by the stories.
//
// `scrollHeight` is here for a second reason: virtual-core clamps every
// programmatic scroll to `scrollHeight - clientHeight`, which is `0` in a
// layout-less environment — so "scroll to page 3" would land on page 1 and no
// test could tell that apart from a broken request. A tall value says only "this
// pane can scroll".
//
// Deliberately narrow: virtual-core measures its scroll element with
// `offsetWidth`/`offsetHeight`, so those are the only two that need a value.
// `clientWidth`/`clientHeight` (what `useViewportSize` reads) and
// `getBoundingClientRect` (what page measurement falls back to) stay at zero on
// purpose — that keeps BOTH hidden-pane guards under test: a fit mode with
// nothing to measure must resolve to 100%, and a page that measures zero must
// keep its estimate instead of collapsing.
for (const [property, value] of [
  ["offsetWidth", 800],
  ["offsetHeight", 600],
  ["scrollHeight", 1_000_000],
] as const) {
  Object.defineProperty(HTMLElement.prototype, property, {
    configurable: true,
    get: () => value,
  });
}

// jsdom does not implement object URLs. This package mints one for every
// non-remote source it shows in an <img>/<video>, so without a stub the image
// adapter cannot render at all under test. Counted, so tests can assert the
// matching revoke actually happened.
if (typeof URL.createObjectURL !== "function") {
  let next = 0;
  URL.createObjectURL = () => `blob:brand-ui-viewer/${(next += 1)}`;
  URL.revokeObjectURL = () => {};
}
