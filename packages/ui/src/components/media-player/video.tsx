"use client";

import { forwardRef, type ReactNode } from "react";
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
  type MediaPlayerControlsPlacement,
  type MediaPlayerElementProps,
  type MediaPlayerProps,
} from "./media-player";
import {
  splitMediaProps,
  type MediaElementKey,
  type MediaElementPassthroughProps,
} from "./media-props";

/** A `<track>` rendered inside the `<video>`. */
export interface VideoTrack {
  src: string;
  kind: "captions" | "subtitles" | "descriptions" | "chapters" | "metadata";
  srclang: string;
  label: string;
  default?: boolean;
}

export interface VideoProps
  extends
    Omit<MediaPlayerProps, "kind" | "children" | MediaElementKey>,
    MediaElementPassthroughProps,
    Pick<MediaPlayerElementProps, "poster" | "playsInline" | "fit"> {
  /** Width ÷ height of the viewport (e.g. `16 / 9`). Omit to size by the video. */
  aspectRatio?: number;
  /** Render the default control bar. Default `true`. */
  controls?: boolean;
  /** `docked` (default): an opaque bar under the video · `overlay`: floats over it and auto-hides. */
  controlsPlacement?: MediaPlayerControlsPlacement;
  /** Caption / subtitle tracks. Give every non-decorative video a captions track. */
  tracks?: VideoTrack[];
  /**
   * A full custom composition of `MediaPlayer*` parts, rendered after the
   * viewport; when given, the default bar is not rendered.
   */
  children?: ReactNode;
}

function VideoDefaultBar({ placement }: { placement: MediaPlayerControlsPlacement }) {
  return (
    <MediaPlayerControls placement={placement}>
      <MediaPlayerPlayButton />
      <MediaPlayerSeekButton offset={-10} />
      <MediaPlayerSeekButton offset={10} />
      <MediaPlayerTimeSlider />
      <MediaPlayerTime mode="current" />
      <MediaPlayerTime mode="duration" />
      <MediaPlayerMuteButton />
      <MediaPlayerVolumeSlider />
      <MediaPlayerPlaybackRateMenu />
      <MediaPlayerCaptionsButton />
      <MediaPlayerPipButton />
      <MediaPlayerFullscreenButton />
    </MediaPlayerControls>
  );
}

/**
 * A video player with its own controls, composed from ui primitives: a
 * bordered frame, the `bg-muted` letterbox, and an opaque control bar docked
 * beneath (or `controlsPlacement="overlay"`). `controls={false} muted
 * fit="cover" aria-hidden` is a decorative thumbnail.
 */
export const Video = forwardRef<HTMLDivElement, VideoProps>(function Video(
  {
    poster,
    playsInline,
    fit,
    aspectRatio,
    controls = true,
    controlsPlacement = "docked",
    tracks,
    children,
    ...rest
  },
  ref,
) {
  const [elementProps, rootProps] = splitMediaProps(rest);
  const bar = children ?? (controls ? <VideoDefaultBar placement={controlsPlacement} /> : null);
  const overlay = children === undefined && controlsPlacement === "overlay";
  return (
    // A preset keeps the base root slot (conventions); spelled out so the
    // `data-slot` ratchet sees this module declare the slot it emits. A wrapper's
    // own `data-slot` in `rootProps` still wins.
    <MediaPlayer ref={ref} kind="video" data-slot="media-player" {...rootProps}>
      <MediaPlayerViewport aspectRatio={aspectRatio}>
        <MediaPlayerElement {...elementProps} poster={poster} playsInline={playsInline} fit={fit}>
          {tracks?.map((track) => (
            <track
              key={`${track.kind}-${track.srclang}-${track.src}`}
              src={track.src}
              kind={track.kind}
              srcLang={track.srclang}
              label={track.label}
              default={track.default}
            />
          ))}
        </MediaPlayerElement>
        <MediaPlayerLoading />
        <MediaPlayerError />
        {overlay ? bar : null}
      </MediaPlayerViewport>
      {overlay ? null : bar}
    </MediaPlayer>
  );
});
