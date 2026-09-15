/**
 * speech-input.test.tsx — the MediaRecorder fallback path's two race bugs:
 * a double click starting two recorders before the first `getUserMedia()`
 * resolves, and an unmount during a pending `getUserMedia()` leaving the
 * microphone on with nothing left to stop it.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { SpeechInput } from "./speech-input";

class FakeMediaRecorder {
  state: "inactive" | "recording" = "inactive";
  private listeners = new Map<string, Set<(event: Event) => void>>();

  constructor(public stream: MediaStream) {}

  addEventListener(type: string, cb: (event: Event) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)?.add(cb);
  }

  removeEventListener(type: string, cb: (event: Event) => void) {
    this.listeners.get(type)?.delete(cb);
  }

  start() {
    this.state = "recording";
  }

  stop() {
    this.state = "inactive";
    for (const cb of this.listeners.get("stop") ?? []) cb(new Event("stop"));
  }
}

function makeFakeStream() {
  const tracks = [{ stop: vi.fn() }, { stop: vi.fn() }];
  return {
    getTracks: () => tracks,
    tracks,
  } as unknown as MediaStream & { tracks: { stop: ReturnType<typeof vi.fn> }[] };
}

function stubMediaRecorderEnvironment(getUserMedia: (...args: unknown[]) => unknown) {
  vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  // @ts-expect-error -- test-only cleanup of a property we defined above
  delete navigator.mediaDevices;
});

describe("SpeechInput — media-recorder fallback getUserMedia race guards", () => {
  it("does not call getUserMedia twice for a double click before the first call resolves", async () => {
    let resolveGetUserMedia: ((stream: MediaStream) => void) | undefined;
    const getUserMedia = vi.fn(
      () =>
        new Promise((resolve: (stream: MediaStream) => void) => {
          resolveGetUserMedia = resolve;
        }),
    );
    stubMediaRecorderEnvironment(getUserMedia);

    const startSpy = vi.spyOn(FakeMediaRecorder.prototype, "start");
    const { getByRole } = render(<SpeechInput onAudioRecorded={() => Promise.resolve("hi")} />);
    const button = getByRole("button");

    fireEvent.click(button);
    fireEvent.click(button);

    expect(getUserMedia).toHaveBeenCalledTimes(1);

    resolveGetUserMedia?.(makeFakeStream());
    // Only ONE recorder is ever created/started — the second click's
    // `getUserMedia()` call was suppressed by the in-flight guard, not merely
    // delayed.
    await waitFor(() => expect(startSpy).toHaveBeenCalledTimes(1));
  });

  it("stops the granted tracks when the component unmounts before getUserMedia resolves", async () => {
    let resolveGetUserMedia: ((stream: MediaStream) => void) | undefined;
    const getUserMedia = vi.fn(
      () =>
        new Promise((resolve: (stream: MediaStream) => void) => {
          resolveGetUserMedia = resolve;
        }),
    );
    stubMediaRecorderEnvironment(getUserMedia);

    const { getByRole, unmount } = render(
      <SpeechInput onAudioRecorded={() => Promise.resolve("hi")} />,
    );
    fireEvent.click(getByRole("button"));

    unmount();

    const stream = makeFakeStream();
    resolveGetUserMedia?.(stream);

    await waitFor(() => expect(stream.tracks[0]?.stop).toHaveBeenCalledTimes(1));
    expect(stream.tracks[1]?.stop).toHaveBeenCalledTimes(1);
  });
});
