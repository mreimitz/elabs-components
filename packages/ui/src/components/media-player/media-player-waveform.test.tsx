import { act, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MediaPlayer, MediaPlayerElement } from "./media-player";
import {
  MediaPlayerWaveform,
  resamplePeaks,
  standInPeaks,
  type MediaPlayerWaveformProps,
} from "./media-player-waveform";

// jsdom has no media pipeline: stub per file (never in vitest.setup.ts).
function stubMedia(el: HTMLMediaElement) {
  const values: Record<string, unknown> = {
    paused: true,
    ended: false,
    duration: Number.NaN,
    currentTime: 0,
    volume: 1,
    muted: false,
    playbackRate: 1,
    readyState: 0,
    error: null,
  };
  for (const name of Object.keys(values)) {
    Object.defineProperty(el, name, {
      configurable: true,
      get: () => values[name],
      set: (next: unknown) => {
        values[name] = next;
        if (name === "currentTime") el.dispatchEvent(new Event("timeupdate"));
      },
    });
  }
  const set = (patch: Record<string, unknown>, event: string) =>
    act(() => {
      Object.assign(values, patch);
      el.dispatchEvent(new Event(event));
    });
  return { values, set };
}

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

function renderWaveform(
  props: Partial<MediaPlayerWaveformProps> = {},
  wrap: (node: ReactNode) => ReactNode = (node) => node,
) {
  const utils = render(
    wrap(
      <MediaPlayer kind="audio">
        <MediaPlayerElement src="clip.wav" />
        <MediaPlayerWaveform bars={10} {...props} />
      </MediaPlayer>,
    ),
  );
  const el = utils.container.querySelector("audio") as HTMLMediaElement;
  const bars = () => [
    ...utils.container.querySelectorAll('[data-slot="media-player-waveform-bar"]'),
  ];
  return { ...utils, el, bars, ...stubMedia(el) };
}

describe("MediaPlayerWaveform", () => {
  it("is the seek slider: named, disabled until the duration is known, speaking the time", () => {
    const { container, set } = renderWaveform();
    expect(container.querySelector('[data-slot="media-player-waveform"]')).not.toBeNull();
    const seek = screen.getByRole("slider", { name: "Seek" });
    expect(seek).toHaveAttribute("data-disabled");
    set({ duration: 20, readyState: 1 }, "loadedmetadata");
    set({ currentTime: 5 }, "timeupdate");
    expect(seek).not.toHaveAttribute("data-disabled");
    expect(seek).toHaveAttribute("aria-valuetext", "0:05 of 0:20");
  });

  it("seeks from the keyboard", () => {
    const { set, values } = renderWaveform();
    set({ duration: 20, currentTime: 5, readyState: 1 }, "loadedmetadata");
    const seek = screen.getByRole("slider", { name: "Seek" });
    act(() => seek.focus());
    fireEvent.keyDown(seek, { key: "ArrowRight" });
    expect(values.currentTime).toBeCloseTo(5.1);
  });

  it("draws one bar per `bars` and fills the played share", () => {
    const { bars, set } = renderWaveform();
    expect(bars()).toHaveLength(10);
    set({ duration: 20, readyState: 1 }, "loadedmetadata");
    expect(bars().filter((bar) => bar.hasAttribute("data-played"))).toHaveLength(0);
    set({ currentTime: 10 }, "timeupdate");
    expect(bars().filter((bar) => bar.hasAttribute("data-played"))).toHaveLength(5);
  });

  it("draws the peaks it is given", () => {
    const { bars } = renderWaveform({ peaks: [0.5, 1], bars: 2 });
    expect(bars().map((bar) => (bar as HTMLElement).style.height)).toEqual(["50%", "100%"]);
  });

  it("pulses the bars at the playhead only while playing", () => {
    const { bars, set } = renderWaveform();
    set({ duration: 20, currentTime: 10, readyState: 4 }, "loadedmetadata");
    expect(bars().some((bar) => bar.hasAttribute("data-active"))).toBe(false);
    set({ paused: false }, "play");
    const active = bars().filter((bar) => bar.hasAttribute("data-active"));
    expect(active.length).toBeGreaterThan(0);
    expect(active.length).toBeLessThan(10);
    set({ paused: true }, "pause");
    expect(bars().some((bar) => bar.hasAttribute("data-active"))).toBe(false);
  });

  it("never pulses under reduced motion", () => {
    const { bars, set } = renderWaveform({}, (node) => (
      <ThemeProvider defaultMotionPreference="reduced">{node}</ThemeProvider>
    ));
    set({ duration: 20, currentTime: 10, readyState: 4 }, "loadedmetadata");
    set({ paused: false }, "play");
    expect(bars().some((bar) => bar.hasAttribute("data-active"))).toBe(false);
  });
});

describe("resamplePeaks", () => {
  it("keeps the loudest peak of each bucket when shrinking", () => {
    expect(resamplePeaks([0.2, 0.8, 0.4, 0.6], 2)).toEqual([0.8, 0.6]);
  });

  it("repeats the nearest peak when stretching", () => {
    expect(resamplePeaks([0.2, 1], 4)).toEqual([0.2, 0.2, 1, 1]);
  });

  it("clamps into 0–1", () => {
    expect(resamplePeaks([-1, 2], 2)).toEqual([0, 1]);
  });
});

describe("standInPeaks", () => {
  it("is stable per seed and differs between seeds", () => {
    const a = standInPeaks("a.wav", 32);
    expect(standInPeaks("a.wav", 32)).toEqual(a);
    expect(standInPeaks("b.wav", 32)).not.toEqual(a);
    expect(a).toHaveLength(32);
    for (const peak of a) {
      expect(peak).toBeGreaterThanOrEqual(0.15);
      expect(peak).toBeLessThanOrEqual(1);
    }
  });
});
