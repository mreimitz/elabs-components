import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Audio } from "./audio";
import { MediaPlayerControls, MediaPlayerPlayButton } from "./media-player";

// jsdom has no media pipeline: stub per file (never in vitest.setup.ts).
function stubMedia(el: HTMLMediaElement) {
  const values: Record<string, unknown> = {
    paused: true,
    ended: false,
    duration: Number.NaN,
    currentTime: 0,
    volume: 1,
    muted: el.muted,
    playbackRate: 1,
    readyState: 0,
    error: null,
  };
  const emit: Record<string, string> = {
    currentTime: "timeupdate",
    volume: "volumechange",
    muted: "volumechange",
    playbackRate: "ratechange",
  };
  for (const name of Object.keys(values)) {
    Object.defineProperty(el, name, {
      configurable: true,
      get: () => values[name],
      set: (next: unknown) => {
        values[name] = next;
        if (emit[name]) el.dispatchEvent(new Event(emit[name]));
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
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    Object.defineProperty(this, "paused", { configurable: true, value: false });
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    Object.defineProperty(this, "paused", { configurable: true, value: true });
    this.dispatchEvent(new Event("pause"));
  });
});
afterEach(() => vi.restoreAllMocks());

describe("Audio", () => {
  it("keeps the base root slot, forwards ref and merges className", () => {
    const ref = createRef<HTMLDivElement>();
    const { container } = render(<Audio ref={ref} src="clip.wav" className="custom" />);
    const root = container.firstElementChild as HTMLElement;
    expect(ref.current).toBe(root);
    expect(root).toHaveAttribute("data-slot", "media-player");
    expect(root).toHaveAttribute("data-kind", "audio");
    expect(root).toHaveClass("custom");
  });

  it("forwards native attributes to the <audio>, never controls", () => {
    const { container } = render(
      <Audio
        src="clip.wav"
        aria-label="Voice reply"
        preload="metadata"
        crossOrigin="anonymous"
        loop
        muted
        label="Reply player"
      />,
    );
    const audio = container.querySelector("audio")!;
    expect(audio).toHaveAttribute("src", "clip.wav");
    expect(audio).toHaveAttribute("aria-label", "Voice reply");
    expect(audio).toHaveAttribute("preload", "metadata");
    expect(audio).toHaveAttribute("crossorigin", "anonymous");
    expect(audio).toHaveAttribute("loop");
    expect(audio.muted).toBe(true);
    expect(audio).not.toHaveAttribute("controls");
    expect(screen.getByRole("region", { name: "Reply player" })).toBeInTheDocument();
  });

  it("renders the default bar in order", () => {
    const { container } = render(<Audio src="clip.wav" />);
    const slots = [
      ...container.querySelectorAll(
        '[data-slot="media-player-controls"] [data-slot^="media-player-"]:not([data-slot$="-thumb"])',
      ),
    ]
      .map((node) => node.getAttribute("data-slot"))
      .filter((slot) => slot !== "media-player-buffered");
    expect(slots).toEqual([
      "media-player-seek-button",
      "media-player-play-button",
      "media-player-seek-button",
      "media-player-time",
      "media-player-time-slider",
      "media-player-time",
      "media-player-mute-button",
      "media-player-volume-slider",
    ]);
  });

  it("renders no bar with controls={false}, and children replace the bar", () => {
    const { container, rerender } = render(<Audio src="clip.wav" controls={false} />);
    expect(container.querySelector('[data-slot="media-player-controls"]')).toBeNull();
    rerender(
      <Audio src="clip.wav">
        <MediaPlayerControls data-testid="custom">
          <MediaPlayerPlayButton />
        </MediaPlayerControls>
      </Audio>,
    );
    expect(screen.getByTestId("custom")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("replaces the bar with the error panel and still calls onError", () => {
    const onError = vi.fn();
    const { container } = render(<Audio src="broken.wav" onError={onError} />);
    const audio = container.querySelector("audio")!;
    stubMedia(audio).set({ error: { code: 4 } as MediaError }, "error");
    expect(onError).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(container.querySelector('[data-slot="media-player-controls"]')).toBeNull();
  });

  it("handles the keyboard map from a focused control", () => {
    const { container } = render(<Audio src="clip.wav" />);
    const audio = container.querySelector("audio")!;
    const { set, values } = stubMedia(audio);
    set({ duration: 20, readyState: 1 }, "loadedmetadata");
    const play = screen.getByRole("button", { name: "Play" });
    act(() => play.focus());
    fireEvent.keyDown(play, { key: "m" });
    expect(screen.getByRole("button", { name: "Unmute" })).toBeInTheDocument();
    fireEvent.keyDown(play, { key: "l" });
    expect(values.currentTime).toBe(10);
    expect(screen.getByRole("slider", { name: "Seek" })).toHaveAttribute(
      "aria-valuetext",
      "0:10 of 0:20",
    );
    fireEvent.keyDown(play, { key: "5" });
    expect(values.currentTime).toBe(10);
    fireEvent.keyDown(play, { key: "ArrowDown" });
    expect(values.volume).toBeCloseTo(0.9);
    // Space on a button is the button's own activation — the map ignores it.
    fireEvent.keyDown(play, { key: " " });
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it("does nothing with keyboardShortcuts={false}", () => {
    const { container } = render(<Audio src="clip.wav" keyboardShortcuts={false} />);
    const { values } = stubMedia(container.querySelector("audio")!);
    fireEvent.keyDown(screen.getByRole("button", { name: "Play" }), { key: "m" });
    expect(values.muted).toBe(false);
  });
  it("hides the seek buttons and the volume slider by bar width, never the scrubber", () => {
    const { container } = render(<Audio src="clip.wav" />);
    expect(screen.getByRole("button", { name: "Back 10 seconds" })).toHaveClass(
      "hidden",
      "@md/controls:inline-flex",
    );
    expect(container.querySelector('[data-slot="media-player-volume-slider"]')).toHaveClass(
      "hidden",
      "@md/controls:flex",
    );
    expect(screen.getByRole("slider", { name: "Seek" })).not.toHaveClass("hidden");
    expect(screen.getByRole("button", { name: "Play" })).not.toHaveClass("hidden");
  });
});
