import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

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
