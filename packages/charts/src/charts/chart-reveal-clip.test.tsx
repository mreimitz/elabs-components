/**
 * RM-020 — `revealOn="inView"` + `replayOnClick` on `ChartRevealClip`.
 *
 * jsdom has no real `IntersectionObserver`, so these tests install a fake
 * that records every constructed instance and its callback, letting a test
 * fire a synthetic intersection deterministically instead of relying on real
 * scroll geometry (which is exactly what the Storybook `play` test —
 * `Charts/Reveal/InView` — verifies in a real browser).
 */

import { act, cleanup, fireEvent, render } from "@testing-library/react";
import type { RefObject } from "react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChartRevealClip, isRevealHeldForView, type RevealGateState } from "./chart-reveal-clip";

// ---------------------------------------------------------------------------
// Fake IntersectionObserver — captures constructor calls + lets a test fire a
// synthetic intersection via the callback it was constructed with.
// ---------------------------------------------------------------------------
class FakeIntersectionObserver implements IntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];
  observedTargets: Element[] = [];
  unobserveCalls: Element[] = [];
  disconnectCalls = 0;

  constructor(public callback: IntersectionObserverCallback) {
    FakeIntersectionObserver.instances.push(this);
  }
  observe(target: Element) {
    this.observedTargets.push(target);
  }
  unobserve(target: Element) {
    this.unobserveCalls.push(target);
  }
  disconnect() {
    this.disconnectCalls += 1;
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  /** Fire a synthetic intersection for `target` (defaults to the first observed one). */
  fireIntersecting(target?: Element) {
    const entryTarget = target ?? this.observedTargets[0];
    this.callback(
      [{ isIntersecting: true, target: entryTarget } as IntersectionObserverEntry],
      this,
    );
  }
}

describe("isRevealHeldForView (RM-020, pure gate decision)", () => {
  const base: RevealGateState = {
    mode: "reveal",
    revealOn: "mount",
    hasViewportRef: false,
    isInView: false,
    clickEpoch: 0,
  };

  it("never holds in default mount mode, whatever else is true", () => {
    expect(isRevealHeldForView(base)).toBe(false);
    expect(isRevealHeldForView({ ...base, hasViewportRef: true })).toBe(false);
    expect(isRevealHeldForView({ ...base, isInView: true })).toBe(false);
  });

  it("never holds for conceal mode, even with inView configured", () => {
    expect(
      isRevealHeldForView({
        ...base,
        mode: "conceal",
        revealOn: "inView",
        hasViewportRef: true,
      }),
    ).toBe(false);
  });

  it("holds for inView + a viewportRef, before the first intersection", () => {
    expect(isRevealHeldForView({ ...base, revealOn: "inView", hasViewportRef: true })).toBe(true);
  });

  it("degrades to mount (never holds) when inView is requested with no viewportRef", () => {
    expect(isRevealHeldForView({ ...base, revealOn: "inView", hasViewportRef: false })).toBe(false);
  });

  it("releases once isInView flips true", () => {
    expect(
      isRevealHeldForView({
        ...base,
        revealOn: "inView",
        hasViewportRef: true,
        isInView: true,
      }),
    ).toBe(false);
  });

  it("releases on any replay click, even if never intersected", () => {
    expect(
      isRevealHeldForView({
        ...base,
        revealOn: "inView",
        hasViewportRef: true,
        clickEpoch: 1,
      }),
    ).toBe(false);
  });
});

describe('<ChartRevealClip> revealOn="inView" / replayOnClick (RM-020)', () => {
  let originalIO: typeof IntersectionObserver | undefined;

  beforeEach(() => {
    FakeIntersectionObserver.instances = [];
    originalIO = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = FakeIntersectionObserver;
  });

  afterEach(() => {
    cleanup();
    globalThis.IntersectionObserver = originalIO as typeof IntersectionObserver;
  });

  function renderClip(overrides: Partial<Parameters<typeof ChartRevealClip>[0]> = {}) {
    return render(
      <svg>
        <defs>
          <ChartRevealClip
            clipPathId="test-clip"
            height={100}
            revealEpoch={0}
            targetWidth={200}
            {...overrides}
          />
        </defs>
      </svg>,
    );
  }

  it("default (revealOn unset) never constructs an IntersectionObserver — byte-identical to pre-RM-020 mount behaviour", () => {
    renderClip();
    expect(FakeIntersectionObserver.instances).toHaveLength(0);
  });

  it('revealOn="inView" with a viewportRef observes that element and holds the clip at width 0 until it intersects', () => {
    const viewportRef = createRef<HTMLDivElement>();
    const { container } = render(
      <div ref={viewportRef}>
        <svg>
          <defs>
            <ChartRevealClip
              clipPathId="test-clip"
              height={100}
              revealEpoch={0}
              revealOn="inView"
              targetWidth={200}
              viewportRef={viewportRef as RefObject<Element | null>}
            />
          </defs>
        </svg>
      </div>,
    );

    expect(FakeIntersectionObserver.instances).toHaveLength(1);
    expect(FakeIntersectionObserver.instances[0]?.observedTargets).toEqual([viewportRef.current]);

    const rect = container.querySelector("clipPath > rect");
    expect(rect).not.toBeNull();
    expect(rect?.getAttribute("width")).toBe("0");
    expect(FakeIntersectionObserver.instances[0]?.unobserveCalls).toHaveLength(0);

    act(() => {
      FakeIntersectionObserver.instances[0]?.fireIntersecting();
    });

    // `once: true` — framer-motion's `useInView` unobserves right after the
    // first intersection, which is the cleanest cross-implementation signal
    // that the gate actually released (vs. asserting on mid-animation width,
    // which depends on framer-motion's own rAF scheduling).
    expect(FakeIntersectionObserver.instances[0]?.unobserveCalls).toEqual([viewportRef.current]);
  });

  it('revealOn="inView" with no viewportRef degrades to mount (dev warning, no observer, not held)', () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { container } = renderClip({ revealOn: "inView" });

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('revealOn="inView"'));
    expect(FakeIntersectionObserver.instances).toHaveLength(0);
    // Not held: renders straight into the animating `motion.rect` branch — its
    // very first (synchronous, pre-animation-frame) paint applies `initial`
    // with a unit suffix ("0px"), which is how this test tells it apart from
    // the HELD branch's bare, unanimated `<rect width={0}>` ("0", no unit).
    const rect = container.querySelector("clipPath > rect");
    expect(rect).not.toBeNull();
    expect(rect?.getAttribute("width")).toBe("0px");

    warnSpy.mockRestore();
  });

  it("replayOnClick bumps the epoch on click and releases the view gate even without an intersection", () => {
    const viewportRef = createRef<HTMLDivElement>();
    const { container } = render(
      <div ref={viewportRef}>
        <svg>
          <defs>
            <ChartRevealClip
              clipPathId="test-clip"
              height={100}
              replayOnClick
              revealEpoch={0}
              revealOn="inView"
              targetWidth={200}
              viewportRef={viewportRef as RefObject<Element | null>}
            />
          </defs>
        </svg>
      </div>,
    );

    expect(container.querySelector("clipPath > rect")?.getAttribute("width")).toBe("0");

    act(() => {
      if (viewportRef.current) {
        fireEvent.click(viewportRef.current);
      }
    });

    // The click bumped `clickEpoch`, which releases the gate and remounts the
    // animating `motion.rect` — its first paint is `initial` ("0px", unit
    // suffix), distinguishable from the held branch's bare "0".
    expect(container.querySelector("clipPath > rect")?.getAttribute("width")).toBe("0px");
  });

  it("shouldReplayOnClick can veto a click (e.g. it hit a datapoint target) — never swallows the caller's own click handling", () => {
    const viewportRef = createRef<HTMLDivElement>();
    const shouldReplayOnClick = vi.fn().mockReturnValue(false);
    const { container } = render(
      <div ref={viewportRef}>
        <svg>
          <defs>
            <ChartRevealClip
              clipPathId="test-clip"
              height={100}
              replayOnClick
              revealEpoch={0}
              revealOn="inView"
              shouldReplayOnClick={shouldReplayOnClick}
              targetWidth={200}
              viewportRef={viewportRef as RefObject<Element | null>}
            />
          </defs>
        </svg>
      </div>,
    );

    act(() => {
      if (viewportRef.current) {
        fireEvent.click(viewportRef.current);
      }
    });

    expect(shouldReplayOnClick).toHaveBeenCalledTimes(1);
    // Vetoed — still held at width 0, the click did not replay the reveal.
    expect(container.querySelector("clipPath > rect")?.getAttribute("width")).toBe("0");
  });

  it("replayOnClick=false (default) ignores clicks — the gate stays held", () => {
    const viewportRef = createRef<HTMLDivElement>();
    const { container } = render(
      <div ref={viewportRef}>
        <svg>
          <defs>
            <ChartRevealClip
              clipPathId="test-clip"
              height={100}
              revealEpoch={0}
              revealOn="inView"
              targetWidth={200}
              viewportRef={viewportRef as RefObject<Element | null>}
            />
          </defs>
        </svg>
      </div>,
    );

    act(() => {
      if (viewportRef.current) {
        fireEvent.click(viewportRef.current);
      }
    });

    // No replay wired — the gate stays held (bare, unanimated "0") even after
    // a click on the observed element.
    expect(container.querySelector("clipPath > rect")?.getAttribute("width")).toBe("0");
  });

  it('mode="conceal" ignores revealOn entirely (unchanged pre-RM-020 behaviour)', () => {
    const viewportRef = createRef<HTMLDivElement>();
    const { container } = render(
      <div ref={viewportRef}>
        <svg>
          <defs>
            <ChartRevealClip
              clipPathId="test-clip"
              height={100}
              mode="conceal"
              revealEpoch={0}
              revealOn="inView"
              targetWidth={200}
              viewportRef={viewportRef as RefObject<Element | null>}
            />
          </defs>
        </svg>
      </div>,
    );

    // Conceal is never gated — the rendered rect is `motion.rect`'s
    // full-width conceal start state ("200px", unit-suffixed — same rendering
    // path as every other `motion.rect` branch above), never the held/bare
    // "0" `<rect>`.
    const rect = container.querySelector("clipPath > rect");
    expect(rect).not.toBeNull();
    expect(rect?.getAttribute("width")).toBe("200px");
  });

  it('onEnterPlay fires once on mount (revealOn="mount", the default) and never for conceal', () => {
    const onEnterPlay = vi.fn();
    renderClip({ onEnterPlay });
    expect(onEnterPlay).toHaveBeenCalledTimes(1);

    onEnterPlay.mockClear();
    renderClip({ mode: "conceal", onEnterPlay });
    expect(onEnterPlay).not.toHaveBeenCalled();
  });

  it("onEnterPlay does NOT fire while held, fires once the view gate releases, and fires again on replay", () => {
    const viewportRef = createRef<HTMLDivElement>();
    const onEnterPlay = vi.fn();
    render(
      <div ref={viewportRef}>
        <svg>
          <defs>
            <ChartRevealClip
              clipPathId="test-clip"
              height={100}
              onEnterPlay={onEnterPlay}
              replayOnClick
              revealEpoch={0}
              revealOn="inView"
              targetWidth={200}
              viewportRef={viewportRef as RefObject<Element | null>}
            />
          </defs>
        </svg>
      </div>,
    );

    expect(onEnterPlay).not.toHaveBeenCalled();

    act(() => {
      FakeIntersectionObserver.instances[0]?.fireIntersecting();
    });
    expect(onEnterPlay).toHaveBeenCalledTimes(1);

    act(() => {
      if (viewportRef.current) {
        fireEvent.click(viewportRef.current);
      }
    });
    expect(onEnterPlay).toHaveBeenCalledTimes(2);
  });
});
