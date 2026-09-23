import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMediaState } from "./use-media-state";

// jsdom has no media pipeline: stub per file (never in vitest.setup.ts).
function fakeMedia(tag: "video" | "audio" = "video") {
  const el = document.createElement(tag);
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
  return { el, values, set };
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

describe("useMediaState", () => {
  it("returns defaults without an element", () => {
    const { result } = renderHook(() => useMediaState(null));
    expect(result.current.state.paused).toBe(true);
    expect(result.current.state.duration).toBeNaN();
    expect(() => result.current.actions.play()).not.toThrow();
  });

  it("reads metadata, time, playback and progress events", () => {
    const { el, set } = fakeMedia();
    const { result } = renderHook(() => useMediaState(el));
    set({ duration: 20, readyState: 1 }, "loadedmetadata");
    expect(result.current.state.duration).toBe(20);
    expect(result.current.state.readyState).toBe(1);
    set({ currentTime: 4 }, "timeupdate");
    expect(result.current.state.currentTime).toBe(4);
    set({ paused: false, readyState: 4 }, "play");
    expect(result.current.state.paused).toBe(false);
    expect(result.current.state.waiting).toBe(false);
    set({ readyState: 2 }, "waiting");
    expect(result.current.state.waiting).toBe(true);
    set({ ended: true, paused: true }, "ended");
    expect(result.current.state.ended).toBe(true);
    set({ playbackRate: 1.5 }, "ratechange");
    expect(result.current.state.playbackRate).toBe(1.5);
  });

  it("reports whether a <video> has a picture once its metadata is known", () => {
    const { el, set } = fakeMedia("video");
    const { result } = renderHook(() => useMediaState(el));
    expect(result.current.state.hasPicture).toBeNull();
    Object.defineProperty(el, "videoWidth", { configurable: true, value: 0 });
    set({ duration: 20, readyState: 1 }, "loadedmetadata");
    expect(result.current.state.hasPicture).toBe(false);
    Object.defineProperty(el, "videoWidth", { configurable: true, value: 640 });
    set({}, "resize");
    expect(result.current.state.hasPicture).toBe(true);
  });

  it("never reports a picture for an <audio>", () => {
    const { el, set } = fakeMedia("audio");
    const { result } = renderHook(() => useMediaState(el));
    expect(result.current.state.hasPicture).toBe(false);
    set({ duration: 20, readyState: 1 }, "loadedmetadata");
    expect(result.current.state.hasPicture).toBe(false);
  });

  it("ignores an error event while the element has no MediaError", () => {
    const { el, set } = fakeMedia();
    const { result } = renderHook(() => useMediaState(el));
    set({}, "error");
    expect(result.current.state.error).toBeNull();
    const failure = { code: 4, message: "unsupported" } as MediaError;
    set({ error: failure }, "error");
    expect(result.current.state.error).toBe(failure);
  });

  it("resets on emptied / loadstart", () => {
    const { el, set } = fakeMedia();
    const { result } = renderHook(() => useMediaState(el));
    set({ duration: 20, currentTime: 5 }, "loadedmetadata");
    set({ duration: Number.NaN, currentTime: 0 }, "emptied");
    expect(result.current.state.duration).toBeNaN();
    expect(result.current.state.currentTime).toBe(0);
  });

  it("plays, pauses and toggles through the element", () => {
    const { el } = fakeMedia();
    const { result } = renderHook(() => useMediaState(el));
    act(() => result.current.actions.play());
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    expect(result.current.state.paused).toBe(false);
    act(() => result.current.actions.toggle());
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
  });

  it("swallows a rejected play()", async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new Error("NotAllowed"));
    const { el } = fakeMedia();
    const { result } = renderHook(() => useMediaState(el));
    expect(() => result.current.actions.play()).not.toThrow();
    await Promise.resolve();
  });

  it("clamps seek and volume; a volume above 0 unmutes; unmute at 0 restores 1", () => {
    const { el, values, set } = fakeMedia();
    const { result } = renderHook(() => useMediaState(el));
    set({ duration: 20 }, "durationchange");
    act(() => result.current.actions.seek(99));
    expect(values.currentTime).toBe(20);
    act(() => result.current.actions.seekBy(-50));
    expect(values.currentTime).toBe(0);
    act(() => result.current.actions.setVolume(3));
    expect(values.volume).toBe(1);
    act(() => result.current.actions.setVolume(-1));
    expect(values.volume).toBe(0);
    act(() => result.current.actions.toggleMute());
    expect(values.volume).toBe(1);
    expect(values.muted).toBe(false);
    act(() => result.current.actions.toggleMute());
    expect(values.muted).toBe(true);
    expect(result.current.state.muted).toBe(true);
    act(() => result.current.actions.setVolume(0.4));
    expect(values.muted).toBe(false);
    expect(result.current.state.volume).toBe(0.4);
  });

  it("treats fullscreen and picture-in-picture as unsupported under jsdom", () => {
    const { el } = fakeMedia();
    const { result } = renderHook(() => useMediaState(el));
    expect(result.current.state.canFullscreen).toBe(false);
    expect(result.current.state.canPip).toBe(false);
    expect(() => result.current.actions.toggleFullscreen()).not.toThrow();
    expect(() => result.current.actions.togglePip()).not.toThrow();
  });

  it("removes every listener on unmount", () => {
    const { el } = fakeMedia();
    const add = vi.spyOn(el, "addEventListener");
    const remove = vi.spyOn(el, "removeEventListener");
    const { unmount } = renderHook(() => useMediaState(el));
    const added = add.mock.calls.length;
    expect(added).toBeGreaterThan(10);
    unmount();
    expect(remove.mock.calls.length).toBe(added);
  });
});
