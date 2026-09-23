/**
 * `AudioPlayer*` are presets over ui's `MediaPlayer*` parts (ADR 0041). These
 * lock the surface: every preset emits the shared `media-player*` slot (and no
 * `audio-player*` one), the former legacy pass-through props never reach the
 * DOM, and the controls
 * really drive the `<audio>` (play/pause, seek, mute, keyboard map).
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AudioPlayer,
  AudioPlayerControlBar,
  AudioPlayerDurationDisplay,
  AudioPlayerElement,
  AudioPlayerMuteButton,
  AudioPlayerPlayButton,
  AudioPlayerSeekBackwardButton,
  AudioPlayerSeekForwardButton,
  AudioPlayerTimeDisplay,
  AudioPlayerTimeRange,
  AudioPlayerVolumeRange,
  type AudioPlayerProps,
} from "./audio-player";

// jsdom has no media pipeline: stub per file (never in vitest.setup.ts).
beforeEach(() => {
  Object.defineProperty(HTMLMediaElement.prototype, "duration", {
    configurable: true,
    get: () => 60,
  });
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
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  // Drop the per-file duration stub so jsdom's own getter is back for other files.
  delete (HTMLMediaElement.prototype as { duration?: number }).duration;
});

/** Shared ui slots the presets emit; the seek and time presets share one each. */
const SLOTS = [
  "media-player",
  "media-player-element",
  "media-player-controls",
  "media-player-seek-button",
  "media-player-play-button",
  "media-player-time",
  "media-player-time-slider",
  "media-player-mute-button",
  "media-player-volume-slider",
];
const BACKWARD = '[data-slot="media-player-seek-button"][data-direction="backward"]';
const FORWARD = '[data-slot="media-player-seek-button"][data-direction="forward"]';

function renderPlayer(props: Partial<AudioPlayerProps> = {}) {
  const utils = render(
    <AudioPlayer {...props}>
      <AudioPlayerElement src="/speech.mp3" />
      <AudioPlayerControlBar>
        <AudioPlayerSeekBackwardButton />
        <AudioPlayerPlayButton />
        <AudioPlayerSeekForwardButton seekOffset={5} />
        <AudioPlayerTimeDisplay />
        <AudioPlayerTimeRange />
        <AudioPlayerDurationDisplay />
        <AudioPlayerMuteButton />
        <AudioPlayerVolumeRange />
      </AudioPlayerControlBar>
    </AudioPlayer>,
  );
  const audio = utils.container.querySelector("audio") as HTMLAudioElement;
  // Let `useMediaState` read the stubbed duration.
  act(() => {
    audio.dispatchEvent(new Event("loadedmetadata"));
    audio.dispatchEvent(new Event("durationchange"));
  });
  return { ...utils, audio };
}

describe("AudioPlayer presets", () => {
  it("emits the shared media-player* slots and none of the old audio-player* ones", () => {
    const { container } = renderPlayer();
    for (const slot of SLOTS) {
      expect(container.querySelector(`[data-slot="${slot}"]`), slot).not.toBeNull();
    }
    expect(container.querySelectorAll('[data-slot="media-player-seek-button"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-slot="media-player-time"]')).toHaveLength(2);
    expect(container.querySelector('[data-slot^="audio-player"]')).toBeNull();
    expect(container.querySelector("[slot]")).toBeNull();
  });

  it("renders a speech result as a data URL", () => {
    const { container } = render(
      <AudioPlayer>
        <AudioPlayerElement data={{ base64: "AAAA", mediaType: "audio/wav" } as never} />
      </AudioPlayer>,
    );
    const audio = container.querySelector("audio");
    expect(audio).toHaveAttribute("src", "data:audio/wav;base64,AAAA");
    expect(audio).not.toHaveAttribute("data");
  });

  it("never puts the deprecated legacy controller props on the DOM", () => {
    const { container } = renderPlayer({
      autohide: "2",
      breakpoints: "sm:300",
      defaultDuration: 10,
      gesturesDisabled: true,
      noAutohide: true,
      noVolumePref: true,
      resolvedLang: "en",
      userInteractive: true,
    });
    const root = container.querySelector('[data-slot="media-player"]') as HTMLElement;
    for (const attr of [
      "autohide",
      "breakpoints",
      "defaultduration",
      "gesturesdisabled",
      "noautohide",
      "novolumepref",
      "resolvedlang",
      "userinteractive",
    ]) {
      expect(root.hasAttribute(attr), attr).toBe(false);
    }
    const forward = container.querySelector(FORWARD) as HTMLElement;
    expect(forward.hasAttribute("seekoffset")).toBe(false);
  });

  it("plays and pauses", () => {
    const { audio } = renderPlayer();
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    expect(audio.paused).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    expect(audio.paused).toBe(true);
  });

  it("seeks by 10 s back by default and by the legacy seekOffset forward", () => {
    const { audio, container } = renderPlayer();
    audio.currentTime = 20;
    fireEvent.click(container.querySelector(BACKWARD) as HTMLElement);
    expect(audio.currentTime).toBe(10);
    fireEvent.click(container.querySelector(FORWARD) as HTMLElement);
    expect(audio.currentTime).toBe(15);
  });

  it("mutes and unmutes", () => {
    const { audio } = renderPlayer();
    fireEvent.click(screen.getByRole("button", { name: "Mute" }));
    expect(audio.muted).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Unmute" }));
    expect(audio.muted).toBe(false);
  });

  it("handles the keyboard map, and noHotkeys turns it off", () => {
    const { audio, container, unmount } = renderPlayer();
    const root = container.querySelector('[data-slot="media-player"]') as HTMLElement;
    fireEvent.keyDown(root, { key: "m" });
    expect(audio.muted).toBe(true);
    unmount();

    const off = renderPlayer({ noHotkeys: true });
    const offRoot = off.container.querySelector('[data-slot="media-player"]') as HTMLElement;
    fireEvent.keyDown(offRoot, { key: "m" });
    expect(off.audio.muted).toBe(false);
  });
});
