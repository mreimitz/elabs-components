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
   * A full custom composition of `MediaPlayer*` parts, rendered after the
   * `<audio>`; when given, the default bar is not rendered.
   */
  children?: ReactNode;
}

/** The default audio bar — replaced by the compact error panel once playback fails. */
function AudioDefaultBar({ controls }: { controls: boolean }) {
  const { state } = useMediaPlayer();
  if (state.error) return <MediaPlayerError />;
  if (!controls) return null;
  return (
    <MediaPlayerControls>
      <MediaPlayerSeekButton offset={-10} />
      <MediaPlayerPlayButton />
      <MediaPlayerSeekButton offset={10} />
      <MediaPlayerTime mode="current" />
      <MediaPlayerTimeSlider />
      <MediaPlayerTime mode="duration" />
      <MediaPlayerMuteButton />
      <MediaPlayerVolumeSlider />
    </MediaPlayerControls>
  );
}

/**
 * An audio player with its own controls, composed from ui primitives. The
 * root is transparent — put it inside the bubble or card that is its surface.
 * Native media attributes (`src`, `preload`, `crossOrigin`, `loop`, `muted`,
 * `autoPlay`, `aria-label`, media events) land on the `<audio>`; everything
 * else on the root.
 */
export const Audio = forwardRef<HTMLDivElement, AudioProps>(function Audio(
  { controls = true, children, ...rest },
  ref,
) {
  const [elementProps, rootProps] = splitMediaProps(rest);
  return (
    // A preset keeps the base root slot (conventions); spelled out so the
    // `data-slot` ratchet sees this module declare the slot it emits. A wrapper's
    // own `data-slot` in `rootProps` still wins.
    <MediaPlayer ref={ref} kind="audio" data-slot="media-player" {...rootProps}>
      <MediaPlayerElement {...elementProps} />
      <MediaPlayerLoading />
      {children ?? <AudioDefaultBar controls={controls} />}
    </MediaPlayer>
  );
});
