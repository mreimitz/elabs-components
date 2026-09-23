"use client";

import { forwardRef, type ReactNode } from "react";
import {
  MediaPlayer,
  MediaPlayerControls,
  MediaPlayerElement,
  MediaPlayerError,
  MediaPlayerLoading,
  MediaPlayerMuteButton,
  MediaPlayerPlayButton,
  MediaPlayerSeekButton,
  MediaPlayerTime,
  MediaPlayerTimeSlider,
  MediaPlayerVolumeSlider,
  useMediaPlayer,
  type MediaPlayerProps,
} from "./media-player";
import { MediaPlayerWaveform } from "./media-player-waveform";
import {
  splitMediaProps,
  type MediaElementKey,
  type MediaElementPassthroughProps,
} from "./media-props";

export interface AudioProps
  extends
    Omit<MediaPlayerProps, "kind" | "children" | MediaElementKey>,
    MediaElementPassthroughProps {
  /** Render the default control bar. Default `true`. */
  controls?: boolean;
  /**
   * The default bar's scrubber: `waveform` (default) draws the recording's
   * bars, filling as it plays · `bar` is the plain time slider.
   */
  variant?: "waveform" | "bar";
  /**
   * The recording's shape, 0–1, any length — the app supplies it (e.g. from
   * `AudioBuffer.getChannelData`); the player never fetches or decodes. Omit
   * for a stand-in shape drawn from `src`.
   */
  peaks?: readonly number[];
  /**
   * A full custom composition of `MediaPlayer*` parts, rendered after the
   * `<audio>`; when given, the default bar is not rendered.
   */
  children?: ReactNode;
}

interface AudioDefaultBarProps extends Pick<AudioProps, "variant" | "peaks"> {
  controls: boolean;
  seed?: string;
}

/** The default audio bar — replaced by the compact error panel once playback fails. */
function AudioDefaultBar({ controls, variant = "waveform", peaks, seed }: AudioDefaultBarProps) {
  const { state } = useMediaPlayer();
  if (state.error) return <MediaPlayerError />;
  if (!controls) return null;
  if (variant === "bar") {
    return (
      // Narrow bars keep the scrubber: below 28rem of bar width (`@md`) the seek
      // buttons and the volume slider go.
      <MediaPlayerControls>
        <MediaPlayerSeekButton offset={-10} className="hidden @md/controls:inline-flex" />
        <MediaPlayerPlayButton />
        <MediaPlayerSeekButton offset={10} className="hidden @md/controls:inline-flex" />
        <MediaPlayerTime mode="current" />
        <MediaPlayerTimeSlider />
        <MediaPlayerTime mode="duration" />
        <MediaPlayerMuteButton />
        <MediaPlayerVolumeSlider className="hidden @md/controls:flex" />
      </MediaPlayerControls>
    );
  }
  return (
    // The waveform is the scrubber; the times sit together after it, and the
    // same `@md` breakpoint drops the seek buttons and the volume slider.
    <MediaPlayerControls>
      <MediaPlayerSeekButton offset={-10} className="hidden @md/controls:inline-flex" />
      <MediaPlayerPlayButton />
      <MediaPlayerSeekButton offset={10} className="hidden @md/controls:inline-flex" />
      <MediaPlayerWaveform placement="inline" peaks={peaks} seed={seed} className="mx-1" />
      <MediaPlayerTime mode="current" />
      <MediaPlayerTime mode="duration" />
      <MediaPlayerMuteButton />
      <MediaPlayerVolumeSlider className="hidden @md/controls:flex" />
    </MediaPlayerControls>
  );
}

/**
 * The compact audio row for tight spots (a chat bubble, a list), composed from
 * ui primitives: the recording's waveform is the scrubber, or `variant="bar"`
 * for the plain time slider. For a framed player, `Media` plays sound too. The
 * root is transparent — put it inside the bubble or card that is its surface.
 * Native media attributes (`src`, `preload`, `crossOrigin`, `loop`, `muted`,
 * `autoPlay`, `aria-label`, media events) land on the `<audio>`; everything
 * else on the root.
 */
export const Audio = forwardRef<HTMLDivElement, AudioProps>(function Audio(
  { controls = true, variant, peaks, children, ...rest },
  ref,
) {
  const [elementProps, rootProps] = splitMediaProps(rest);
  const seed = typeof elementProps.src === "string" ? elementProps.src : undefined;
  return (
    // A preset keeps the base root slot (conventions); spelled out so the
    // `data-slot` ratchet sees this module declare the slot it emits. A wrapper's
    // own `data-slot` in `rootProps` still wins.
    <MediaPlayer ref={ref} kind="audio" data-slot="media-player" {...rootProps}>
      <MediaPlayerElement {...elementProps} />
      <MediaPlayerLoading />
      {children ?? (
        <AudioDefaultBar controls={controls} variant={variant} peaks={peaks} seed={seed} />
      )}
    </MediaPlayer>
  );
});
