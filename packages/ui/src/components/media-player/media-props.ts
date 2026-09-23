import type { MediaPlayerElementProps } from "./media-player";

/**
 * Native media attributes and events a preset forwards to the `<video>`/
 * `<audio>` rather than the root `<div>` (every other prop goes to the root).
 * Internal — not exported from the barrel.
 */
export const MEDIA_ELEMENT_KEYS = [
  "src",
  "preload",
  "crossOrigin",
  "loop",
  "muted",
  "autoPlay",
  "aria-label",
  "onAbort",
  "onCanPlay",
  "onCanPlayThrough",
  "onDurationChange",
  "onEmptied",
  "onEnded",
  "onError",
  "onLoadedData",
  "onLoadedMetadata",
  "onLoadStart",
  "onPause",
  "onPlay",
  "onPlaying",
  "onProgress",
  "onRateChange",
  "onSeeked",
  "onSeeking",
  "onStalled",
  "onSuspend",
  "onTimeUpdate",
  "onVolumeChange",
  "onWaiting",
] as const satisfies ReadonlyArray<keyof MediaPlayerElementProps>;

export type MediaElementKey = (typeof MEDIA_ELEMENT_KEYS)[number];

/** The element-bound subset of a preset's props. */
export type MediaElementPassthroughProps = Pick<MediaPlayerElementProps, MediaElementKey>;

/** Split preset props into `[elementProps, rootProps]`. */
export function splitMediaProps<P extends object>(
  props: P,
): [Partial<MediaElementPassthroughProps>, Omit<P, MediaElementKey>] {
  const element: Record<string, unknown> = {};
  const root: Record<string, unknown> = {};
  const keys = new Set<string>(MEDIA_ELEMENT_KEYS);
  for (const [key, value] of Object.entries(props)) {
    if (keys.has(key)) element[key] = value;
    else root[key] = value;
  }
  return [element as Partial<MediaElementPassthroughProps>, root as Omit<P, MediaElementKey>];
}
