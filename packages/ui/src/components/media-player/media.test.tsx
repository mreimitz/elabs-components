import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Media } from "./media";
import { Video } from "./video";

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
    videoWidth: 0,
    videoHeight: 0,
  };
  for (const name of Object.keys(values)) {
    Object.defineProperty(el, name, {
      configurable: true,
      get: () => values[name],
      set: (next: unknown) => {
        values[name] = next;
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

function setup(ui: React.ReactElement) {
  const utils = render(ui);
  const video = utils.container.querySelector("video") as HTMLVideoElement;
  const root = utils.container.firstElementChild as HTMLElement;
  const slot = (name: string) => utils.container.querySelector(`[data-slot="${name}"]`);
  return { ...utils, video, root, slot, ...stubMedia(video) };
}

const SOUND = { duration: 20, readyState: 1, videoWidth: 0, videoHeight: 0 };
const PICTURE = { duration: 20, readyState: 1, videoWidth: 640, videoHeight: 360 };

describe("Media", () => {
  it("is what `Video` names: one player under both", () => {
    expect(Video).toBe(Media);
  });

  it("plays any file through one <video> in the framed player", () => {
    const { video, root } = setup(<Media src="clip.mp3" />);
    expect(video).not.toBeNull();
    expect(root).toHaveAttribute("data-slot", "media-player");
    expect(root).toHaveClass("rounded-lg", "border", "bg-card");
  });

  it("shows the picture and the plain scrubber when the file has one", () => {
    const { slot, set, root } = setup(<Media src="clip.mp4" />);
    set(PICTURE, "loadedmetadata");
    expect(root).toHaveAttribute("data-picture", "true");
    expect(slot("media-player-waveform")).toBeNull();
    expect(slot("media-player-time-slider")).not.toBeNull();
  });

  it("draws the waveform where the picture would be when the file is sound only", () => {
    const { slot, set, root } = setup(<Media src="clip.mp3" />);
    set(SOUND, "loadedmetadata");
    expect(root).toHaveAttribute("data-picture", "false");
    expect(screen.getByRole("region", { name: "Audio player" })).toBe(root);
    expect(slot("media-player-viewport")!.contains(slot("media-player-waveform"))).toBe(true);
    // One scrubber: the waveform replaces the bar's time slider.
    expect(slot("media-player-time-slider")).toBeNull();
    expect(screen.getAllByRole("slider", { name: "Seek" })).toHaveLength(1);
  });

  it("gives a sound-only file a stage of its own height", () => {
    const { slot, set } = setup(<Media src="clip.mp3" />);
    set(SOUND, "loadedmetadata");
    expect(slot("media-player-viewport")).toHaveClass("h-40");
  });

  it("runs the waveform along the bottom of a poster, kept as cover art", () => {
    const { slot, set, video } = setup(<Media src="clip.mp3" poster="cover.svg" />);
    set(SOUND, "loadedmetadata");
    expect(video).toHaveAttribute("poster", "cover.svg");
    expect(slot("media-player-waveform")).toHaveAttribute("data-placement", "strip");
  });

  it("takes `kind` to skip detection", () => {
    const { slot, rerender } = setup(<Media src="clip.mp3" kind="audio" />);
    expect(slot("media-player-waveform")).not.toBeNull();
    rerender(<Media src="clip.mp3" kind="video" />);
    expect(slot("media-player-waveform")).toBeNull();
  });

  it("hides fullscreen and picture-in-picture for sound", () => {
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
    HTMLElement.prototype.requestFullscreen ??= () => Promise.resolve();
    const { set } = setup(<Media src="clip.mp4" />);
    set(PICTURE, "loadedmetadata");
    expect(screen.getByRole("button", { name: "Enter full screen" })).toBeInTheDocument();
    set(SOUND, "resize");
    expect(screen.queryByRole("button", { name: "Enter full screen" })).toBeNull();
  });

  it("passes the real peaks to the waveform", () => {
    const peaks = Array.from({ length: 48 }, (_, i) => (i % 2 ? 0.5 : 1));
    const { container, set } = setup(<Media src="clip.mp3" peaks={peaks} />);
    set(SOUND, "loadedmetadata");
    const heights = [
      ...container.querySelectorAll<HTMLElement>('[data-slot="media-player-waveform-bar"]'),
    ].map((bar) => bar.style.height);
    expect(heights).toHaveLength(48);
    expect(heights.slice(0, 2)).toEqual(["100%", "50%"]);
  });
});
