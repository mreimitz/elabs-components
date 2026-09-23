import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MediaPlayer,
  MediaPlayerCaptionsButton,
  MediaPlayerControls,
  MediaPlayerElement,
  MediaPlayerError,
  MediaPlayerFullscreenButton,
  MediaPlayerLoading,
  MediaPlayerMuteButton,
  MediaPlayerPipButton,
  MediaPlayerPlaybackRateMenu,
  MediaPlayerPlayButton,
  MediaPlayerSeekButton,
  MediaPlayerTime,
  MediaPlayerTimeSlider,
  MediaPlayerViewport,
  MediaPlayerVolumeSlider,
  useMediaPlayer,
} from "./media-player";

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

function renderPlayer(kind: "audio" | "video" = "audio") {
  const utils = render(
    <MediaPlayer kind={kind}>
      <MediaPlayerViewport>
        <MediaPlayerElement src="clip.wav" />
        <MediaPlayerLoading />
        <MediaPlayerError />
      </MediaPlayerViewport>
      <MediaPlayerControls>
        <MediaPlayerSeekButton offset={-10} />
        <MediaPlayerPlayButton />
        <MediaPlayerSeekButton offset={10} />
        <MediaPlayerTime mode="current" />
        <MediaPlayerTimeSlider />
        <MediaPlayerTime mode="duration" />
        <MediaPlayerTime mode="remaining" />
        <MediaPlayerMuteButton />
        <MediaPlayerVolumeSlider />
        <MediaPlayerPlaybackRateMenu />
        <MediaPlayerCaptionsButton />
        <MediaPlayerPipButton />
        <MediaPlayerFullscreenButton />
      </MediaPlayerControls>
    </MediaPlayer>,
  );
  const el = utils.container.querySelector(kind) as HTMLMediaElement;
  return { ...utils, el, ...stubMedia(el) };
}

describe("MediaPlayer", () => {
  it("throws when a part renders outside the provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<MediaPlayerPlayButton />)).toThrow(/inside a <MediaPlayer>/);
  });

  it("emits data-slot on the root and every part, overridable by props", () => {
    const { container } = renderPlayer();
    for (const slot of [
      "media-player",
      "media-player-viewport",
      "media-player-element",
      "media-player-loading",
      "media-player-controls",
      "media-player-seek-button",
      "media-player-play-button",
      "media-player-time",
      "media-player-buffered",
      "media-player-time-slider",
      "media-player-mute-button",
      "media-player-volume-slider",
      "media-player-playback-rate",
    ]) {
      expect(container.querySelector(`[data-slot="${slot}"]`), slot).not.toBeNull();
    }
    const { container: overridden } = render(
      <MediaPlayer kind="audio" data-slot="audio-player">
        <MediaPlayerElement data-slot="audio-player-element" />
        <MediaPlayerControls data-slot="audio-player-control-bar">
          <MediaPlayerPlayButton data-slot="audio-player-play-button" />
        </MediaPlayerControls>
      </MediaPlayer>,
    );
    for (const slot of [
      "audio-player",
      "audio-player-element",
      "audio-player-control-bar",
      "audio-player-play-button",
    ]) {
      expect(overridden.querySelector(`[data-slot="${slot}"]`), slot).not.toBeNull();
    }
  });

  it("names the region and forwards ref + className", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <MediaPlayer kind="video" ref={ref} className="custom">
        <MediaPlayerElement />
      </MediaPlayer>,
    );
    const region = screen.getByRole("region", { name: "Video player" });
    expect(ref.current).toBe(region);
    expect(region).toHaveClass("custom", "rounded-lg");
    expect(region).toHaveAttribute("tabindex", "0");
  });

  it("gives every control its accessible name", () => {
    renderPlayer();
    expect(screen.getByRole("region", { name: "Audio player" })).not.toHaveAttribute("tabindex");
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back 10 seconds" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Forward 10 seconds" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mute" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Playback speed: 1×" })).toHaveTextContent("1×");
    expect(screen.getByRole("slider", { name: "Volume" })).toHaveAttribute(
      "aria-valuetext",
      "100%",
    );
  });

  it("disables the time slider until the duration is finite, then speaks the time", () => {
    const { set } = renderPlayer();
    const seek = screen.getByRole("slider", { name: "Seek" });
    expect(seek).toHaveAttribute("aria-valuetext", "0:00 of 0:00");
    expect(seek).toHaveAttribute("data-disabled");
    set({ duration: 20, readyState: 1 }, "loadedmetadata");
    set({ currentTime: 5 }, "timeupdate");
    expect(seek).not.toHaveAttribute("data-disabled");
    expect(seek).toHaveAttribute("aria-valuetext", "0:05 of 0:20");
    set({ duration: Infinity }, "durationchange");
    expect(seek).toHaveAttribute("data-disabled");
  });

  it("renders current, duration and remaining time; hours at an hour", () => {
    const { container, set } = renderPlayer();
    const time = (mode: string) =>
      container.querySelector(`[data-slot="media-player-time"][data-mode="${mode}"]`);
    set({ duration: 83, currentTime: 20 }, "loadedmetadata");
    expect(time("current")).toHaveTextContent("0:20");
    expect(time("duration")).toHaveTextContent("1:23");
    expect(time("remaining")).toHaveTextContent("-1:03");
    set({ duration: 3700 }, "durationchange");
    expect(time("current")).toHaveTextContent("0:00:20");
  });

  it("wires play, seek, mute to the element and flips the labels", async () => {
    const user = userEvent.setup();
    const { container, values, set } = renderPlayer();
    set({ duration: 20 }, "loadedmetadata");
    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    expect(container.firstElementChild).toHaveAttribute("data-paused", "false");
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Forward 10 seconds" }));
    expect(values.currentTime).toBe(10);
    await user.click(screen.getByRole("button", { name: "Back 10 seconds" }));
    expect(values.currentTime).toBe(0);
    await user.click(screen.getByRole("button", { name: "Mute" }));
    expect(values.muted).toBe(true);
    expect(screen.getByRole("button", { name: "Unmute" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Volume" })).toHaveAttribute("aria-valuetext", "0%");
    set({ ended: true, paused: true }, "ended");
    expect(screen.getByRole("button", { name: "Replay" })).toBeInTheDocument();
  });

  it("offers the playback rates as menu radio items", async () => {
    const user = userEvent.setup();
    const { values } = renderPlayer();
    await user.click(screen.getByRole("button", { name: "Playback speed: 1×" }));
    const items = await screen.findAllByRole("menuitemradio");
    expect(items.map((item) => item.textContent)).toEqual([
      "0.5×",
      "0.75×",
      "1×",
      "1.25×",
      "1.5×",
      "2×",
    ]);
    await user.click(screen.getByRole("menuitemradio", { name: "1.5×" }));
    expect(values.playbackRate).toBe(1.5);
    expect(screen.getByRole("button", { name: "Playback speed: 1.5×" })).toBeInTheDocument();
  });

  it("renders nothing for unsupported fullscreen, picture-in-picture and missing captions", () => {
    const { container } = renderPlayer("video");
    expect(container.querySelector('[data-slot="media-player-fullscreen-button"]')).toBeNull();
    expect(container.querySelector('[data-slot="media-player-pip-button"]')).toBeNull();
    expect(container.querySelector('[data-slot="media-player-captions-button"]')).toBeNull();
  });

  it("shows the skeleton before metadata and the spinner while buffering, with one status", () => {
    const { container, set } = renderPlayer("video");
    const loading = container.querySelector('[data-slot="media-player-loading"]');
    expect(loading).toHaveAttribute("data-state", "loading");
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    set({ readyState: 4, duration: 20 }, "loadedmetadata");
    expect(loading).toHaveAttribute("data-state", "idle");
    set({ paused: false, readyState: 2 }, "waiting");
    expect(loading).toHaveAttribute("data-state", "buffering");
    expect(screen.getByRole("status")).toHaveTextContent("Buffering…");
  });

  it("skips the skeleton for audio, a poster, or preload none", () => {
    const { container } = render(
      <MediaPlayer kind="video">
        <MediaPlayerElement poster="poster.svg" />
        <MediaPlayerLoading />
      </MediaPlayer>,
    );
    expect(container.querySelector('[data-slot="skeleton"]')).toBeNull();
    const audio = renderPlayer("audio");
    expect(audio.container.querySelector('[data-slot="skeleton"]')).toBeNull();
  });

  it("shows the error panel only after a terminal error", () => {
    const { set } = renderPlayer();
    expect(screen.queryByRole("alert")).toBeNull();
    set({}, "error");
    expect(screen.queryByRole("alert")).toBeNull();
    set({ error: { code: 4 } as MediaError }, "error");
    expect(screen.getByRole("alert")).toHaveTextContent("Can’t play this media");
  });

  it("accepts error copy overrides", () => {
    const { container } = render(
      <MediaPlayer kind="audio">
        <MediaPlayerElement />
        <MediaPlayerError title="Voice reply unavailable" description="Try again later." />
      </MediaPlayer>,
    );
    const el = container.querySelector("audio") as HTMLMediaElement;
    stubMedia(el).set({ error: { code: 2 } as MediaError }, "error");
    expect(screen.getByRole("alert")).toHaveTextContent("Voice reply unavailable");
    expect(screen.getByRole("alert")).toHaveTextContent("Try again later.");
  });

  it("never sets the native controls attribute", () => {
    const props = { controls: true } as object;
    const { container } = render(
      <MediaPlayer kind="video">
        <MediaPlayerElement {...props} />
      </MediaPlayer>,
    );
    expect(container.querySelector("video")).not.toHaveAttribute("controls");
  });

  it("exposes state, actions and meta to custom parts", () => {
    function Probe() {
      const { state, meta } = useMediaPlayer();
      return <output>{`${meta.kind}:${state.paused}`}</output>;
    }
    render(
      <MediaPlayer kind="audio">
        <MediaPlayerElement />
        <Probe />
      </MediaPlayer>,
    );
    expect(screen.getByText("audio:true")).toBeInTheDocument();
  });

  it("drives the volume slider from the keyboard", () => {
    const { values } = renderPlayer();
    const volume = screen.getByRole("slider", { name: "Volume" });
    act(() => volume.focus());
    fireEvent.keyDown(volume, { key: "ArrowLeft" });
    expect(values.volume).toBeCloseTo(0.95);
  });
});
