"use client";

import { useMemo, useSyncExternalStore } from "react";

/** A buffered time range, in seconds. */
export interface MediaTimeRange {
  start: number;
  end: number;
}

/** A caption/subtitle track the player can switch to. */
export interface MediaTextTrackInfo {
  /** The `<track id>`, or its position among caption/subtitle tracks when it has none. */
  id: string;
  label: string;
  language: string;
  kind: TextTrackKind;
}

/**
 * A snapshot of the media element. The element is the source of truth: every
 * field is read back from it on each media event, never kept in parallel.
 */
export interface MediaState {
  paused: boolean;
  ended: boolean;
  seeking: boolean;
  /** Playing but starved for data (`!paused && readyState < HAVE_FUTURE_DATA`). */
  waiting: boolean;
  currentTime: number;
  /** `NaN` until `loadedmetadata`; `Infinity` for a live stream. */
  duration: number;
  buffered: MediaTimeRange[];
  volume: number;
  muted: boolean;
  playbackRate: number;
  readyState: number;
  networkState: number;
  /** Set only once the element reports a terminal `MediaError`. */
  error: MediaError | null;
  /** The fullscreen target (the player root) is the document's fullscreen element. */
  fullscreen: boolean;
  /** The element is in picture-in-picture. */
  pip: boolean;
  textTracks: MediaTextTrackInfo[];
  /** `id` of the showing caption/subtitle track, `null` when captions are off. */
  activeTextTrack: string | null;
  /** The `poster` attribute (video), `""` when none. */
  poster: string;
  /** The `preload` attribute, `""` when unset. */
  preload: string;
  /** Fullscreen can be requested for the fullscreen target in this browser. */
  canFullscreen: boolean;
  /** Picture-in-picture can be requested for this element in this browser. */
  canPip: boolean;
  /**
   * The media has a picture: `null` until a `<video>`'s metadata is known,
   * `false` for sound only (an audio file in a `<video>`, or any `<audio>`).
   */
  hasPicture: boolean | null;
}

export interface MediaActions {
  /** Start playback; a rejected `play()` (autoplay policy, no source) is swallowed. */
  play: () => void;
  pause: () => void;
  toggle: () => void;
  /** Seek to `seconds`, clamped to `[0, duration]`. */
  seek: (seconds: number) => void;
  seekBy: (seconds: number) => void;
  /** Set volume, clamped to `[0, 1]`; a volume above 0 unmutes. */
  setVolume: (volume: number) => void;
  /** Mute / unmute; unmuting at volume 0 restores full volume. */
  toggleMute: () => void;
  setPlaybackRate: (rate: number) => void;
  /** Enter / exit fullscreen on the fullscreen target; a no-op when unsupported. */
  toggleFullscreen: () => void;
  /** Enter / exit picture-in-picture (video only); a no-op when unsupported. */
  togglePip: () => void;
  /** Show the caption/subtitle track with this `id`; `null` turns captions off. */
  setTextTrack: (id: string | null) => void;
}

export interface UseMediaStateOptions {
  /**
   * The element fullscreen is requested on — the player root, so the controls
   * come along. Defaults to the media element itself.
   */
  fullscreenTarget?: HTMLElement | null;
}

export interface UseMediaStateResult {
  state: MediaState;
  actions: MediaActions;
}

/** `HTMLMediaElement.HAVE_FUTURE_DATA`, spelled out so SSR never touches the global. */
const HAVE_FUTURE_DATA = 3;

const MEDIA_EVENTS = [
  "loadedmetadata",
  "loadeddata",
  "durationchange",
  "timeupdate",
  "progress",
  "play",
  "pause",
  "playing",
  "canplay",
  "canplaythrough",
  "waiting",
  "stalled",
  "seeking",
  "seeked",
  "ended",
  "volumechange",
  "ratechange",
  "error",
  "emptied",
  "loadstart",
  "abort",
  "enterpictureinpicture",
  "leavepictureinpicture",
  // A <video>'s picture size arrives (or changes) — `hasPicture` reads it.
  "resize",
] as const;

const TRACK_EVENTS = ["addtrack", "removetrack", "change"] as const;

const DEFAULT_STATE: MediaState = {
  paused: true,
  ended: false,
  seeking: false,
  waiting: false,
  currentTime: 0,
  duration: Number.NaN,
  buffered: [],
  volume: 1,
  muted: false,
  playbackRate: 1,
  readyState: 0,
  networkState: 0,
  error: null,
  fullscreen: false,
  pip: false,
  textTracks: [],
  activeTextTrack: null,
  poster: "",
  preload: "",
  canFullscreen: false,
  canPip: false,
  hasPicture: null,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function isCaptionKind(kind: string): boolean {
  return kind === "captions" || kind === "subtitles";
}

/** Caption/subtitle tracks paired with the id the player addresses them by. */
function captionTracks(el: HTMLMediaElement): Array<[TextTrack, string]> {
  const list = el.textTracks as TextTrackList | undefined;
  if (!list) return [];
  const out: Array<[TextTrack, string]> = [];
  for (let i = 0; i < list.length; i += 1) {
    const track = list[i];
    if (!track || !isCaptionKind(track.kind)) continue;
    out.push([track, track.id || String(out.length)]);
  }
  return out;
}

function readBuffered(el: HTMLMediaElement): MediaTimeRange[] {
  const ranges = el.buffered as TimeRanges | undefined;
  if (!ranges) return [];
  const out: MediaTimeRange[] = [];
  for (let i = 0; i < ranges.length; i += 1) {
    out.push({ start: ranges.start(i), end: ranges.end(i) });
  }
  return out;
}

function isVideo(el: HTMLMediaElement): boolean {
  return el.tagName === "VIDEO";
}

/** `HTMLMediaElement.HAVE_METADATA`: the picture size, if any, is known from here on. */
const HAVE_METADATA = 1;

function readHasPicture(el: HTMLMediaElement, readyState: number): boolean | null {
  if (!isVideo(el)) return false;
  if (readyState < HAVE_METADATA) return null;
  const video = el as HTMLVideoElement;
  return (video.videoWidth ?? 0) > 0 || (video.videoHeight ?? 0) > 0;
}

function read(el: HTMLMediaElement | null, target: HTMLElement | null): MediaState {
  if (!el) return DEFAULT_STATE;
  const doc = el.ownerDocument;
  const fullscreenTarget = target ?? el;
  const tracks = captionTracks(el);
  const showing = tracks.find(([track]) => track.mode === "showing");
  const readyState = el.readyState ?? 0;
  return {
    paused: el.paused,
    ended: el.ended,
    seeking: el.seeking,
    waiting: !el.paused && !el.ended && readyState < HAVE_FUTURE_DATA,
    currentTime: el.currentTime,
    duration: el.duration,
    buffered: readBuffered(el),
    volume: el.volume,
    muted: el.muted,
    playbackRate: el.playbackRate,
    readyState,
    networkState: el.networkState ?? 0,
    error: el.error ?? null,
    fullscreen: doc.fullscreenElement != null && doc.fullscreenElement === fullscreenTarget,
    pip:
      (doc as Document & { pictureInPictureElement?: Element | null }).pictureInPictureElement ===
      el,
    textTracks: tracks.map(([track, id]) => ({
      id,
      label: track.label,
      language: track.language,
      kind: track.kind,
    })),
    activeTextTrack: showing ? showing[1] : null,
    poster: el.getAttribute("poster") ?? "",
    preload: el.getAttribute("preload") ?? "",
    canFullscreen:
      doc.fullscreenEnabled === true && typeof fullscreenTarget.requestFullscreen === "function",
    canPip:
      isVideo(el) &&
      (doc as Document & { pictureInPictureEnabled?: boolean }).pictureInPictureEnabled === true &&
      typeof (el as HTMLVideoElement).requestPictureInPicture === "function" &&
      !(el as HTMLVideoElement).disablePictureInPicture,
    hasPicture: readHasPicture(el, readyState),
  };
}

function sameState(a: MediaState, b: MediaState): boolean {
  for (const key of Object.keys(a) as Array<keyof MediaState>) {
    const x = a[key];
    const y = b[key];
    if (Array.isArray(x) || Array.isArray(y)) {
      if (JSON.stringify(x) !== JSON.stringify(y)) return false;
    } else if (!Object.is(x, y)) {
      return false;
    }
  }
  return true;
}

function swallow(result: unknown) {
  if (result && typeof (result as Promise<unknown>).catch === "function") {
    (result as Promise<unknown>).catch(() => {});
  }
}

function attempt(fn: () => unknown) {
  try {
    swallow(fn());
  } catch {
    // Unsupported or refused by the browser (autoplay policy, no user
    // gesture, jsdom) — the player's state simply does not change.
  }
}

function createStore(el: HTMLMediaElement | null, target: HTMLElement | null) {
  let snapshot = read(el, target);
  return {
    getSnapshot: () => snapshot,
    subscribe(onChange: () => void) {
      if (!el) return () => {};
      const refresh = () => {
        const next = read(el, target);
        if (sameState(next, snapshot)) return;
        snapshot = next;
        onChange();
      };
      const doc = el.ownerDocument;
      const tracks = el.textTracks as TextTrackList | undefined;
      for (const type of MEDIA_EVENTS) el.addEventListener(type, refresh);
      for (const type of TRACK_EVENTS) tracks?.addEventListener?.(type, refresh);
      doc.addEventListener("fullscreenchange", refresh);
      // The element may have moved on between render and subscribe.
      refresh();
      return () => {
        for (const type of MEDIA_EVENTS) el.removeEventListener(type, refresh);
        for (const type of TRACK_EVENTS) tracks?.removeEventListener?.(type, refresh);
        doc.removeEventListener("fullscreenchange", refresh);
      };
    },
  };
}

function createActions(el: HTMLMediaElement | null, target: HTMLElement | null): MediaActions {
  const seek = (seconds: number) => {
    if (!el) return;
    const max = Number.isFinite(el.duration) ? el.duration : Number.POSITIVE_INFINITY;
    attempt(() => {
      el.currentTime = clamp(seconds, 0, max);
    });
  };
  const play = () => {
    if (el) attempt(() => el.play());
  };
  const pause = () => {
    if (el) attempt(() => el.pause());
  };
  return {
    play,
    pause,
    toggle: () => {
      if (!el) return;
      if (el.paused || el.ended) play();
      else pause();
    },
    seek,
    seekBy: (seconds) => {
      if (el) seek(el.currentTime + seconds);
    },
    setVolume: (volume) => {
      if (!el) return;
      const next = clamp(volume, 0, 1);
      el.volume = next;
      if (next > 0 && el.muted) el.muted = false;
    },
    toggleMute: () => {
      if (!el) return;
      if (el.muted || el.volume === 0) {
        if (el.volume === 0) el.volume = 1;
        el.muted = false;
      } else {
        el.muted = true;
      }
    },
    setPlaybackRate: (rate) => {
      if (el) attempt(() => (el.playbackRate = rate));
    },
    toggleFullscreen: () => {
      if (!el) return;
      const doc = el.ownerDocument;
      const node = target ?? el;
      if (!doc.fullscreenEnabled) return;
      if (doc.fullscreenElement) attempt(() => doc.exitFullscreen?.());
      else attempt(() => node.requestFullscreen?.());
    },
    togglePip: () => {
      if (!el || !isVideo(el)) return;
      const doc = el.ownerDocument as Document & {
        pictureInPictureEnabled?: boolean;
        pictureInPictureElement?: Element | null;
        exitPictureInPicture?: () => Promise<void>;
      };
      if (!doc.pictureInPictureEnabled) return;
      if (doc.pictureInPictureElement === el) attempt(() => doc.exitPictureInPicture?.());
      else attempt(() => (el as HTMLVideoElement).requestPictureInPicture?.());
    },
    setTextTrack: (id) => {
      if (!el) return;
      for (const [track, trackId] of captionTracks(el)) {
        track.mode = trackId === id ? "showing" : "disabled";
      }
    },
  };
}

const getServerSnapshot = () => DEFAULT_STATE;

/**
 * Headless media state: subscribes to a `<video>`/`<audio>` element's events
 * and returns a snapshot of it plus feature-detected actions. Pass the element
 * itself (keep it in state via a callback ref), not a ref object — a new
 * element re-subscribes.
 *
 * `MediaPlayer` is built on it; use it directly to drive a fully custom UI.
 */
export function useMediaState(
  element: HTMLMediaElement | null,
  options: UseMediaStateOptions = {},
): UseMediaStateResult {
  const target = options.fullscreenTarget ?? null;
  const store = useMemo(() => createStore(element, target), [element, target]);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, getServerSnapshot);
  const actions = useMemo(() => createActions(element, target), [element, target]);
  return { state, actions };
}
