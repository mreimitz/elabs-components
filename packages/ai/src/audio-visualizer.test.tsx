import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider, useTheme } from "@elabs-ai/components-tokens";

import { AudioVisualizer } from "./audio-visualizer";
import { useAudioLevel } from "./use-audio-level";

// AudioVisualizer draws to a 2D canvas context, which jsdom does not
// implement (it returns `null`, same as every other canvas-drawing component
// in this repo — see packages/viewer/src/adapters/pdf/pdf-adapter.test.tsx).
// A bare object stands in so drawing calls resolve without throwing; nothing
// here asserts on pixels, only on the component's own state (the announced
// status text) and its refusal to crash without a real canvas.
beforeEach(() => {
  // Re-spied every test: `afterEach` below calls `vi.restoreAllMocks()`,
  // which restores the REAL jsdom implementation (not just mock state), so a
  // `beforeAll`-only spy stops intercepting after the first test.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    canvas: { width: 320, height: 64 },
  } as unknown as CanvasRenderingContext2D);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const SPEECH_LEVELS = Array.from({ length: 8 }, (_, i) => (i % 2 === 0 ? 0.8 : 0.6));
const QUIET_LEVELS = Array.from({ length: 8 }, () => 0.01);

describe("AudioVisualizer — presentation-layer boundary (D5, issue #21)", () => {
  it("renders with no microphone and no AudioContext available", () => {
    const originalAudioContext = (window as { AudioContext?: unknown }).AudioContext;
    // Deliberately deleting to simulate an environment with no Web Audio API.
    // (No ESLint rule in this repo's config flags a dot-notation `delete` — the
    // property is restored below regardless.)
    delete (window as { AudioContext?: unknown }).AudioContext;
    expect(() => render(<AudioVisualizer levels={SPEECH_LEVELS} />)).not.toThrow();
    (window as { AudioContext?: unknown }).AudioContext = originalAudioContext;
  });

  it("never touches getUserMedia", () => {
    const getUserMedia = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    render(<AudioVisualizer levels={SPEECH_LEVELS} loading />);
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("renders a canvas that is aria-hidden — the level is announced as text, not via the graphic", () => {
    const { container } = render(<AudioVisualizer levels={SPEECH_LEVELS} />);
    const canvas = container.querySelector('[data-slot="audio-visualizer-canvas"]');
    expect(canvas).not.toBeNull();
    expect(canvas).toHaveAttribute("aria-hidden", "true");
  });

  it("carries the root data-slot", () => {
    const { container } = render(<AudioVisualizer levels={SPEECH_LEVELS} />);
    expect(container.querySelector('[data-slot="audio-visualizer"]')).not.toBeNull();
  });
});

describe("AudioVisualizer — level announced to assistive tech", () => {
  it('announces "Microphone active" once the average level clears the silence threshold', () => {
    render(<AudioVisualizer levels={SPEECH_LEVELS} />);
    expect(screen.getByRole("status")).toHaveTextContent("Microphone active");
  });

  it('announces "No input detected" for a connected but quiet signal', () => {
    render(<AudioVisualizer levels={QUIET_LEVELS} />);
    expect(screen.getByRole("status")).toHaveTextContent("No input detected");
  });

  it('announces "Microphone not connected" while loading, ignoring any stale levels', () => {
    render(<AudioVisualizer levels={SPEECH_LEVELS} loading />);
    expect(screen.getByRole("status")).toHaveTextContent("Microphone not connected");
  });

  it("updates the SAME live region rather than remounting it when the state changes", () => {
    const { rerender } = render(<AudioVisualizer levels={QUIET_LEVELS} />);
    const region = screen.getByRole("status");
    expect(region).toHaveTextContent("No input detected");

    rerender(<AudioVisualizer levels={SPEECH_LEVELS} />);
    expect(screen.getByRole("status")).toBe(region);
    expect(region).toHaveTextContent("Microphone active");
  });

  it("renders no status region when statusLabel is explicitly null", () => {
    render(<AudioVisualizer levels={SPEECH_LEVELS} statusLabel={null} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders a caller-supplied statusLabel instead of the default", () => {
    render(<AudioVisualizer levels={SPEECH_LEVELS} statusLabel="Listening…" />);
    expect(screen.getByRole("status")).toHaveTextContent("Listening…");
  });
});

describe("AudioVisualizer — reduced motion (colour is never the only channel either)", () => {
  const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

  function mockPrefersReducedMotion(matches: boolean) {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === REDUCED_MOTION_QUERY ? matches : false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  }

  it("settles into the non-animating reduced-motion path and paints the current levels", () => {
    mockPrefersReducedMotion(true);
    const raf = vi.spyOn(window, "requestAnimationFrame");
    const caf = vi.spyOn(window, "cancelAnimationFrame");
    render(<AudioVisualizer levels={SPEECH_LEVELS} />);
    // `useReducedMotion` resolves the OS media query inside its own effect, so
    // the very first render pass can transiently see `false` before that
    // effect commits — the same one-render lag every consumer of the hook has
    // (Shimmer included). Any frame scheduled during that transient window is
    // cancelled before it can fire, so no animation is left running once
    // effects settle; that is the actual contract, not "never called".
    expect(caf.mock.calls.length).toBe(raf.mock.calls.length);
    expect(screen.getByRole("status")).toHaveTextContent("Microphone active");
  });

  it("schedules a smoothing animation frame when motion is allowed", () => {
    mockPrefersReducedMotion(false);
    const raf = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(0);
    render(<AudioVisualizer levels={SPEECH_LEVELS} />);
    expect(raf).toHaveBeenCalled();
  });
});

describe("AudioVisualizer — painted colour tracks the active theme, not a mount-time snapshot (F1)", () => {
  // `resolveFillColor` reads `--color-primary`/`--primary` via
  // `getComputedStyle(canvas)` — a value a REAL browser resolves by cascading
  // down from wherever `data-theme` lives (normally `<html>`, which
  // `ThemeProvider` writes in its own mount effect). jsdom implements neither
  // the cascade nor custom-property inheritance (`getComputedStyle` only ever
  // reflects an element's OWN inline style — verified against a live jsdom
  // instance while investigating this bug), so this mock stands in for the
  // browser's computed value while still exercising the REAL race: React
  // runs a child's `useEffect` before its parent's, so `AudioVisualizer`'s
  // paint effect (a child of `ThemeProvider`) fires before `ThemeProvider`'s
  // own effect has written `data-theme` — reading whatever the un-themed
  // `:root` fallback resolves to, exactly like the reported
  // `rgb(57, 105, 217)`.
  const ROOT_FALLBACK = "rgb(57, 105, 217)"; // :root's un-themed --primary
  const THEME_PRIMARY: Record<string, string> = {
    light: "rgb(10, 20, 30)",
    dark: "rgb(200, 210, 220)",
  };

  let paintedColor: string | undefined;

  beforeEach(() => {
    paintedColor = undefined;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      function mockGetContext() {
        const ctx = {
          clearRect: vi.fn(),
          fillRect: vi.fn(() => {
            paintedColor = ctx.fillStyle;
          }),
          beginPath: vi.fn(),
          moveTo: vi.fn(),
          lineTo: vi.fn(),
          closePath: vi.fn(),
          fill: vi.fn(() => {
            paintedColor = ctx.fillStyle;
          }),
          canvas: { width: 320, height: 64 },
          fillStyle: "",
        };
        return ctx as unknown as CanvasRenderingContext2D;
      },
    );

    vi.spyOn(window, "getComputedStyle").mockImplementation((..._args: unknown[]) => {
      const theme = document.documentElement.getAttribute("data-theme");
      const primary = (theme && THEME_PRIMARY[theme]) || ROOT_FALLBACK;
      return {
        getPropertyValue: (prop: string) =>
          prop === "--color-primary" || prop === "--primary" ? primary : "",
        color: "",
      } as CSSStyleDeclaration;
    });

    // `ThemeProvider` reads `window.matchMedia` on mount (OS reduced-motion
    // tracking). Re-defined here, not just relied on from the setup file's
    // default stub, because a sibling `describe` above permanently replaces
    // `window.matchMedia` with a `vi.fn()` — `vi.restoreAllMocks()` in that
    // block's own `afterEach` then resets (not removes) that mock function,
    // so it starts returning `undefined` for every test that runs after it in
    // this file. This block must render `ThemeProvider` correctly regardless
    // of what ran before it.
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
  });

  it("paints the active theme's --primary once ThemeProvider has applied data-theme — never the :root fallback", async () => {
    render(
      <ThemeProvider defaultTheme="dark" storageKey={null}>
        <AudioVisualizer loading />
      </ThemeProvider>,
    );

    // The attribute IS on <html> by the time render() returns...
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    // ...but the fix's own correction (the MutationObserver callback, and the
    // re-render it schedules) lands as a MICROTASK, same as it would in a
    // real browser — flush it inside `act` before asserting the FINAL painted
    // colour, not whatever was painted mid-race.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(paintedColor).not.toBe(ROOT_FALLBACK);
    expect(paintedColor).toBe(THEME_PRIMARY.dark);
  });

  it("repaints to track a theme change after mount, rather than keeping the colour painted at mount", async () => {
    function ThemeToggleButton() {
      const { setTheme } = useTheme();
      return (
        <button type="button" onClick={() => setTheme("light")}>
          switch to light
        </button>
      );
    }

    render(
      <ThemeProvider defaultTheme="dark" storageKey={null}>
        <AudioVisualizer loading />
        <ThemeToggleButton />
      </ThemeProvider>,
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(paintedColor).toBe(THEME_PRIMARY.dark);

    fireEvent.click(screen.getByRole("button", { name: "switch to light" }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(paintedColor).toBe(THEME_PRIMARY.light);
  });
});

describe("useAudioLevel — never requests the microphone itself", () => {
  it("returns empty levels and never calls getUserMedia when no stream is provided", () => {
    const getUserMedia = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });

    let result: ReturnType<typeof useAudioLevel> | undefined;
    function Probe() {
      result = useAudioLevel(null);
      return null;
    }
    render(<Probe />);

    expect(result).toEqual({ level: 0, levels: [] });
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("degrades to empty levels (never throws) when a stream is given but no Web Audio API exists", () => {
    const originalAudioContext = (window as { AudioContext?: unknown }).AudioContext;
    // Deliberately deleting to simulate an environment with no Web Audio API.
    // (No ESLint rule in this repo's config flags a dot-notation `delete` — the
    // property is restored below regardless.)
    delete (window as { AudioContext?: unknown }).AudioContext;

    const fakeStream = {} as MediaStream;
    let result: ReturnType<typeof useAudioLevel> | undefined;
    function Probe() {
      result = useAudioLevel(fakeStream);
      return null;
    }
    expect(() => render(<Probe />)).not.toThrow();
    expect(result).toEqual({ level: 0, levels: [] });

    (window as { AudioContext?: unknown }).AudioContext = originalAudioContext;
  });
});
