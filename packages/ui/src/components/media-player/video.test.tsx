import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MediaPlayerControls, MediaPlayerPlayButton, useMediaPlayer } from "./media-player";
import { Video } from "./video";

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

const captions = [
  { src: "captions.vtt", kind: "captions" as const, srclang: "en", label: "English" },
];

function setup(ui: React.ReactElement) {
  const utils = render(ui);
  const video = utils.container.querySelector("video") as HTMLVideoElement;
  const root = utils.container.firstElementChild as HTMLElement;
  return { ...utils, video, root, ...stubMedia(video) };
}

describe("Video", () => {
  it("is a focusable region with the base root slot, ref and className", () => {
    const ref = createRef<HTMLDivElement>();
    const { root } = setup(<Video ref={ref} src="clip.mp4" className="custom" tracks={captions} />);
    expect(ref.current).toBe(root);
    expect(root).toHaveAttribute("data-slot", "media-player");
    expect(root).toHaveAttribute("data-kind", "video");
    expect(root).toHaveAttribute("tabindex", "0");
    expect(root).toHaveClass("custom", "rounded-lg", "border", "bg-card");
    expect(screen.getByRole("region", { name: "Video player" })).toBe(root);
  });

  it("forwards element attributes, poster, fit and tracks", () => {
    const { video } = setup(
      <Video
        src="clip.mp4"
        poster="poster.svg"
        playsInline
        fit="cover"
        aria-label="Product tour"
        preload="metadata"
        tracks={[{ ...captions[0]!, default: true }]}
      />,
    );
    expect(video).toHaveAttribute("poster", "poster.svg");
    expect(video).toHaveAttribute("playsinline");
    expect(video).toHaveAttribute("aria-label", "Product tour");
    expect(video).toHaveClass("object-cover");
    expect(video).not.toHaveAttribute("controls");
    const track = video.querySelector("track")!;
    expect(track).toHaveAttribute("kind", "captions");
    expect(track).toHaveAttribute("srclang", "en");
    expect(track).toHaveAttribute("default");
  });

  it("wraps the element in an aspect-ratio frame when asked", () => {
    const { container, rerender } = render(<Video src="clip.mp4" aspectRatio={16 / 9} />);
    expect(container.querySelector("[data-radix-aspect-ratio-wrapper]")).not.toBeNull();
    rerender(<Video src="clip.mp4" />);
    expect(container.querySelector("[data-radix-aspect-ratio-wrapper]")).toBeNull();
  });

  it("renders the docked default bar after the viewport", () => {
    const { container } = setup(<Video src="clip.mp4" />);
    const controls = container.querySelector('[data-slot="media-player-controls"]')!;
    expect(controls).toHaveAttribute("data-placement", "docked");
    expect(controls.previousElementSibling).toHaveAttribute("data-slot", "media-player-viewport");
    expect(screen.getByRole("button", { name: "Playback speed: 1×" })).toBeInTheDocument();
  });

  it("toggles playback on a click on the video only when it has controls", () => {
    const { video, root } = setup(<Video src="clip.mp4" />);
    fireEvent.click(video);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    expect(root).toHaveAttribute("data-paused", "false");
    fireEvent.click(video);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
  });

  it("is a decorative thumbnail with controls={false} muted aria-hidden", () => {
    const { video, root, container } = setup(
      <Video src="clip.mp4" controls={false} muted fit="cover" aria-hidden />,
    );
    expect(container.querySelector('[data-slot="media-player-controls"]')).toBeNull();
    expect(root).toHaveAttribute("tabindex", "-1");
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(video.muted).toBe(true);
    fireEvent.click(video);
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it("toggles on Space at the root but not on a focused button", () => {
    const { root } = setup(<Video src="clip.mp4" />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Play" }), { key: " " });
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    act(() => root.focus());
    fireEvent.keyDown(root, { key: " " });
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  });

  describe("controls visibility", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("never hides docked controls", () => {
      const { root, set } = setup(<Video src="clip.mp4" />);
      set({ paused: false, readyState: 4 }, "play");
      fireEvent.pointerMove(root);
      act(() => vi.advanceTimersByTime(5000));
      expect(root).toHaveAttribute("data-controls", "visible");
    });

    it("auto-hides overlay controls 3 s after the pointer stops, while playing", () => {
      const { root, set, container } = setup(<Video src="clip.mp4" controlsPlacement="overlay" />);
      const controls = container.querySelector('[data-slot="media-player-controls"]')!;
      expect(controls).toHaveAttribute("data-placement", "overlay");
      expect(controls.parentElement).toHaveAttribute("data-slot", "media-player-viewport");
      expect(root).toHaveAttribute("data-controls", "visible");
      set({ paused: false, readyState: 4 }, "play");
      // Playing with no pointer activity: hidden at once.
      expect(root).toHaveAttribute("data-controls", "hidden");
      fireEvent.pointerMove(root);
      expect(root).toHaveAttribute("data-controls", "visible");
      act(() => vi.advanceTimersByTime(2900));
      expect(root).toHaveAttribute("data-controls", "visible");
      act(() => vi.advanceTimersByTime(200));
      expect(root).toHaveAttribute("data-controls", "hidden");
      fireEvent.pointerMove(root);
      fireEvent.pointerLeave(root);
      expect(root).toHaveAttribute("data-controls", "hidden");
      set({ paused: true }, "pause");
      expect(root).toHaveAttribute("data-controls", "visible");
    });

    it("stays shown while pinned (an open menu)", () => {
      function Pin() {
        const { meta } = useMediaPlayer();
        return (
          <button type="button" onClick={() => meta.pinControls(true)}>
            pin
          </button>
        );
      }
      const { container } = render(
        <Video src="clip.mp4">
          <MediaPlayerControls placement="overlay">
            <MediaPlayerPlayButton />
            <Pin />
          </MediaPlayerControls>
        </Video>,
      );
      const player = container.firstElementChild as HTMLElement;
      const media = stubMedia(container.querySelector("video")!);
      media.set({ paused: false, readyState: 4 }, "play");
      expect(player).toHaveAttribute("data-controls", "hidden");
      fireEvent.click(screen.getByText("pin"));
      expect(player).toHaveAttribute("data-controls", "visible");
    });
  });
  it("hides the secondary controls by bar width, never the scrubber", () => {
    const { container } = render(<Video src="clip.mp4" />);
    // Container-query classes: jsdom has no layout, so the class list is the contract.
    expect(screen.getByRole("button", { name: "Back 10 seconds" })).toHaveClass(
      "hidden",
      "@lg/controls:inline-flex",
    );
    expect(screen.getByRole("button", { name: "Forward 10 seconds" })).toHaveClass("hidden");
    expect(container.querySelector('[data-slot="media-player-volume-slider"]')).toHaveClass(
      "hidden",
      "@lg/controls:flex",
    );
    expect(screen.getByRole("button", { name: "Playback speed: 1×" })).toHaveClass(
      "hidden",
      "@md/controls:inline-flex",
    );
    expect(screen.getByRole("slider", { name: "Seek" })).not.toHaveClass("hidden");
    expect(screen.getByRole("button", { name: "Play" })).not.toHaveClass("hidden");
  });
});
