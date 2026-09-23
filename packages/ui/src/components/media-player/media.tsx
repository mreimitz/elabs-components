"use client";

import { forwardRef, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { useLocale } from "../locale-provider";
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
  type MediaPlayerControlsPlacement,
  type MediaPlayerElementProps,
  type MediaPlayerProps,
} from "./media-player";
import { MediaPlayerWaveform } from "./media-player-waveform";
import {
  splitMediaProps,
  type MediaElementKey,
  type MediaElementPassthroughProps,
} from "./media-props";

/** A `<track>` rendered inside the `<video>`. */
export interface MediaTrack {
  src: string;
  kind: "captions" | "subtitles" | "descriptions" | "chapters" | "metadata";
  srclang: string;
  label: string;
  default?: boolean;
}

export interface MediaProps
  extends
    Omit<MediaPlayerProps, "kind" | "children" | MediaElementKey>,
    MediaElementPassthroughProps,
    Pick<MediaPlayerElementProps, "poster" | "playsInline" | "fit"> {
  /**
   * What the file holds. Omit to detect it: once the metadata loads, a file
   * with no picture plays as sound. Pass it to skip the wait (the waveform
   * shows before the file loads) or to overrule the file.
   */
  kind?: "audio" | "video";
  /**
   * A sound file's shape, 0–1, any length — the app supplies it (e.g. from
   * `AudioBuffer.getChannelData`); the player never fetches or decodes.
   * Omit for a stand-in shape drawn from `src`.
   */
  peaks?: readonly number[];
  /** Width ÷ height of the viewport (e.g. `16 / 9`). Omit to size by the video. */
  aspectRatio?: number;
  /** Render the default control bar. Default `true`. */
  controls?: boolean;
  /**
   * `docked` (default): an opaque bar under the video · `overlay`: floats over
   * it and auto-hides. Sound always docks — there is no picture to reveal.
   */
  controlsPlacement?: MediaPlayerControlsPlacement;
  /** Caption / subtitle tracks. Give every non-decorative video a captions track. */
  tracks?: MediaTrack[];
  /**
   * A full custom composition of `MediaPlayer*` parts, rendered after the
   * viewport; when given, the default bar is not rendered. For sound the
   * viewport's waveform is already the scrubber — leave `MediaPlayerTimeSlider`
   * out.
   */
  children?: ReactNode;
}

function MediaDefaultBar({
  placement,
  sound,
}: {
  placement: MediaPlayerControlsPlacement;
  sound: boolean;
}) {
  return (
    // Narrow bars keep the scrubber: below 32rem of bar width (`@lg`) the seek
    // buttons and the volume slider go, below 28rem (`@md`) the rate menu too.
    // Sound drops the time slider (the waveform above scrubs) and the picture
    // controls.
    <MediaPlayerControls placement={placement}>
      <MediaPlayerPlayButton />
      <MediaPlayerSeekButton offset={-10} className="hidden @lg/controls:inline-flex" />
      <MediaPlayerSeekButton offset={10} className="hidden @lg/controls:inline-flex" />
      {sound ? null : <MediaPlayerTimeSlider />}
      <MediaPlayerTime mode="current" />
      {/* Without the slider's flex-1, the clock ends the left group and the rest sits right. */}
      <MediaPlayerTime mode="duration" className={cn(sound && "me-auto")} />
      <MediaPlayerMuteButton />
      <MediaPlayerVolumeSlider className="hidden @lg/controls:flex" />
      <MediaPlayerPlaybackRateMenu className="hidden @md/controls:inline-flex" />
      <MediaPlayerCaptionsButton />
      {sound ? null : <MediaPlayerPipButton />}
      {sound ? null : <MediaPlayerFullscreenButton />}
    </MediaPlayerControls>
  );
}

interface MediaStageProps extends Pick<
  MediaProps,
  | "kind"
  | "peaks"
  | "poster"
  | "playsInline"
  | "fit"
  | "aspectRatio"
  | "controls"
  | "controlsPlacement"
  | "tracks"
  | "children"
> {
  elementProps: Partial<MediaElementPassthroughProps>;
}

/** Viewport + bar — inside the player, where the file's picture (or its absence) is known. */
function MediaStage({
  kind,
  peaks,
  poster,
  playsInline,
  fit,
  aspectRatio,
  controls = true,
  controlsPlacement = "docked",
  tracks,
  children,
  elementProps,
}: MediaStageProps) {
  const { state } = useMediaPlayer();
  const sound = kind ? kind === "audio" : state.hasPicture === false;
  const placement = sound ? "docked" : controlsPlacement;
  const bar =
    children ?? (controls ? <MediaDefaultBar placement={placement} sound={sound} /> : null);
  const overlay = children === undefined && placement === "overlay";
  const seed = typeof elementProps.src === "string" ? elementProps.src : undefined;
  // A decorative player (`controls={false}`, no parts) keeps the plain viewport.
  const stage = sound && (controls || children !== undefined);

  return (
    <>
      <MediaPlayerViewport
        aspectRatio={aspectRatio}
        // Sound has no intrinsic size: a stage of its own height, or room for the cover art.
        className={cn(stage && !aspectRatio && (poster ? "aspect-video" : "h-40"))}
      >
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
        {stage ? (
          <MediaPlayerWaveform placement={poster ? "strip" : "stage"} peaks={peaks} seed={seed} />
        ) : null}
        <MediaPlayerLoading />
        <MediaPlayerError />
        {overlay ? bar : null}
      </MediaPlayerViewport>
      {overlay ? null : bar}
    </>
  );
}

/**
 * One player for any file, composed from ui primitives: a bordered frame, the
 * `bg-muted` viewport, and an opaque control bar docked beneath (or
 * `controlsPlacement="overlay"`). A file with a picture plays as video; a
 * sound-only file draws its waveform where the picture would be (along the
 * bottom of the `poster`, kept as cover art), and the waveform is the
 * scrubber. `Video` is this component. `controls={false} muted fit="cover"
 * aria-hidden` is a decorative thumbnail; `Audio` is the compact row for tight
 * spots.
 */
export const Media = forwardRef<HTMLDivElement, MediaProps>(function Media(
  { kind, label, ...rest },
  ref,
) {
  const { t } = useLocale();
  const {
    peaks,
    poster,
    playsInline,
    fit,
    aspectRatio,
    controls,
    controlsPlacement,
    tracks,
    children,
    ...others
  } = rest;
  const [elementProps, rootProps] = splitMediaProps(others);
  // A forced kind names the region up front; detection names it once the metadata loads.
  const named =
    label ??
    (kind === "audio"
      ? t("ui.media.audioPlayer")
      : kind === "video"
        ? t("ui.media.videoPlayer")
        : undefined);
  return (
    // A preset keeps the base root slot (conventions); spelled out so the
    // `data-slot` ratchet sees this module declare the slot it emits. A wrapper's
    // own `data-slot` in `rootProps` still wins.
    <MediaPlayer ref={ref} kind="video" data-slot="media-player" label={named} {...rootProps}>
      <MediaStage
        kind={kind}
        peaks={peaks}
        poster={poster}
        playsInline={playsInline}
        fit={fit}
        aspectRatio={aspectRatio}
        controls={controls}
        controlsPlacement={controlsPlacement}
        tracks={tracks}
        elementProps={elementProps}
      >
        {children}
      </MediaStage>
    </MediaPlayer>
  );
});
