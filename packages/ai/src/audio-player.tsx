"use client";

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
  useLocale,
  useMediaPlayer,
  type MediaPlayerButtonProps,
  type MediaPlayerControlsProps,
  type MediaPlayerElementProps,
  type MediaPlayerProps,
  type MediaPlayerTimeProps,
  type MediaPlayerTimeSliderProps,
  type MediaPlayerVolumeSliderProps,
} from "@elabs-ai/components-ui";
import type { Experimental_SpeechResult as SpeechResult } from "ai";
import type { ComponentProps, HTMLAttributes, Ref } from "react";

/**
 * `AudioPlayer*` — the chat-facing names for spoken agent replies, as thin
 * presets over ui's `MediaPlayer*` compound parts (ADR 0041). Each preset
 * keeps its own `data-slot="audio-player*"` so existing DOM selectors still
 * match; the ui part underneath owns the behaviour, labels and styling.
 */

/**
 * @deprecated The shared base of the former custom-element parts. Each part now
 * has its own prop type (`AudioPlayerPlayButtonProps`, …); removed in the next
 * major.
 */
export type AudioPlayerPartProps = HTMLAttributes<HTMLElement>;

/**
 * The former custom-element controller attributes. Kept so existing
 * call sites typecheck; `noHotkeys`/`keyboardControl` still map onto
 * `keyboardShortcuts`, every other member is accepted and ignored. All are
 * removed in the next major.
 */
interface AudioPlayerLegacyProps {
  /** @deprecated Ignored (legacy controller attribute); removed in the next major. */
  autohide?: string;
  /** @deprecated Ignored (legacy controller attribute); removed in the next major. */
  autohideOverControls?: boolean;
  /** @deprecated Ignored (legacy controller attribute); removed in the next major. */
  breakpoints?: string;
  /** @deprecated Ignored (legacy controller attribute); removed in the next major. */
  breakpointsComputed?: boolean;
  /** @deprecated Ignored (legacy controller attribute); removed in the next major. */
  defaultDuration?: number;
  /** @deprecated Ignored (legacy controller attribute); removed in the next major. */
  defaultStreamType?: string;
  /** @deprecated Ignored (legacy controller attribute); removed in the next major. */
  defaultSubtitles?: boolean;
  /** @deprecated Ignored (legacy controller attribute); removed in the next major. */
  gesturesDisabled?: boolean;
  /** @deprecated Use `keyboardShortcuts`. `false` turns the player's keyboard map off. */
  keyboardControl?: boolean;
  /** @deprecated Ignored (legacy controller attribute); removed in the next major. */
  keysUsed?: string;
  /** @deprecated Ignored (legacy controller attribute); removed in the next major. */
  liveEdgeOffset?: number;
  /** @deprecated Ignored (legacy controller attribute); removed in the next major. */
  noAutohide?: boolean;
  /** @deprecated Ignored (legacy controller attribute); removed in the next major. */
  noAutoSeekToLive?: boolean;
  /** @deprecated Ignored (legacy controller attribute); removed in the next major. */
  noDefaultStore?: boolean;
  /** @deprecated Use `keyboardShortcuts={false}`. */
  noHotkeys?: boolean;
  /** @deprecated Ignored (legacy controller attribute); removed in the next major. */
  noMutedPref?: boolean;
  /** @deprecated Ignored (legacy controller attribute); removed in the next major. */
  noSubtitlesLangPref?: boolean;
  /** @deprecated Ignored (legacy controller attribute); removed in the next major. */
  noVolumePref?: boolean;
  /** @deprecated Ignored (legacy controller attribute); removed in the next major. */
  resolvedLang?: string;
  /** @deprecated Ignored (legacy controller attribute); removed in the next major. */
  userInteractive?: boolean;
}

export interface AudioPlayerProps extends Omit<MediaPlayerProps, "kind">, AudioPlayerLegacyProps {}

/** Replaces the controls with the compact error panel once playback has terminally failed. */
function AudioPlayerErrorRung() {
  const { t } = useLocale();
  const { state } = useMediaPlayer();
  if (!state.error) return null;
  return <MediaPlayerError title={t("ai.audioPlayer.renderError")} />;
}

/**
 * The player root (`MediaPlayer kind="audio"`): transparent, so put it in the
 * bubble or card that is its surface. Compose `AudioPlayerElement` plus an
 * `AudioPlayerControlBar` inside.
 */
export const AudioPlayer = ({
  keyboardShortcuts,
  noHotkeys,
  keyboardControl,
  children,
  // Accepted and ignored (former legacy controller attributes).
  autohide: _autohide,
  autohideOverControls: _autohideOverControls,
  breakpoints: _breakpoints,
  breakpointsComputed: _breakpointsComputed,
  defaultDuration: _defaultDuration,
  defaultStreamType: _defaultStreamType,
  defaultSubtitles: _defaultSubtitles,
  gesturesDisabled: _gesturesDisabled,
  keysUsed: _keysUsed,
  liveEdgeOffset: _liveEdgeOffset,
  noAutohide: _noAutohide,
  noAutoSeekToLive: _noAutoSeekToLive,
  noDefaultStore: _noDefaultStore,
  noMutedPref: _noMutedPref,
  noSubtitlesLangPref: _noSubtitlesLangPref,
  noVolumePref: _noVolumePref,
  resolvedLang: _resolvedLang,
  userInteractive: _userInteractive,
  ...props
}: AudioPlayerProps) => (
  <MediaPlayer
    kind="audio"
    data-slot="audio-player"
    keyboardShortcuts={(keyboardShortcuts ?? true) && !noHotkeys && keyboardControl !== false}
    {...props}
  >
    {children}
    <MediaPlayerLoading />
    <AudioPlayerErrorRung />
  </MediaPlayer>
);

export type AudioPlayerElementProps = Omit<ComponentProps<"audio">, "src"> &
  (
    | {
        data: SpeechResult["audio"];
      }
    | {
        src: string;
      }
  );

/**
 * The `<audio>` element. Pass a URL as `src`, or an AI SDK speech result's
 * `audio` as `data` (converted to a base64 data URL).
 */
export const AudioPlayerElement = ({ ref, ...props }: AudioPlayerElementProps) => {
  const { src, data, ...rest } = props as typeof props & {
    src?: string;
    data?: SpeechResult["audio"];
  };
  return (
    <MediaPlayerElement
      data-slot="audio-player-element"
      {...(rest as MediaPlayerElementProps)}
      ref={ref as Ref<HTMLMediaElement> | undefined}
      src={data ? `data:${data.mediaType};base64,${data.base64}` : src}
    />
  );
};

export type AudioPlayerControlBarProps = MediaPlayerControlsProps;

export const AudioPlayerControlBar = (props: AudioPlayerControlBarProps) => (
  <MediaPlayerControls data-slot="audio-player-control-bar" {...props} />
);

export type AudioPlayerPlayButtonProps = MediaPlayerButtonProps;

export const AudioPlayerPlayButton = (props: AudioPlayerPlayButtonProps) => (
  <MediaPlayerPlayButton data-slot="audio-player-play-button" {...props} />
);

/** Props shared by the two seek presets. */
interface AudioPlayerSeekPresetProps extends MediaPlayerButtonProps {
  /** Seconds to skip, as a positive distance; the button sets the direction. Default 10. */
  offset?: number;
  /** @deprecated Use `offset`. */
  seekOffset?: number;
}

export type AudioPlayerSeekBackwardButtonProps = AudioPlayerSeekPresetProps;

export const AudioPlayerSeekBackwardButton = ({
  offset,
  seekOffset,
  ...props
}: AudioPlayerSeekBackwardButtonProps) => (
  <MediaPlayerSeekButton
    data-slot="audio-player-seek-backward-button"
    {...props}
    offset={-Math.abs(offset ?? seekOffset ?? 10)}
  />
);

export interface AudioPlayerSeekForwardButtonProps extends AudioPlayerSeekPresetProps {
  /** @deprecated Ignored (legacy attribute); removed in the next major. */
  mediaController?: string;
  /** @deprecated Ignored (legacy attribute); removed in the next major. */
  mediaCurrentTime?: number;
  /** @deprecated Ignored (legacy attribute); removed in the next major. */
  noTooltip?: boolean;
  /** @deprecated Ignored (legacy attribute); removed in the next major. */
  preventClick?: boolean;
}

export const AudioPlayerSeekForwardButton = ({
  offset,
  seekOffset,
  mediaController: _mediaController,
  mediaCurrentTime: _mediaCurrentTime,
  noTooltip: _noTooltip,
  preventClick: _preventClick,
  ...props
}: AudioPlayerSeekForwardButtonProps) => (
  <MediaPlayerSeekButton
    data-slot="audio-player-seek-forward-button"
    {...props}
    offset={Math.abs(offset ?? seekOffset ?? 10)}
  />
);

export type AudioPlayerTimeDisplayProps = Omit<MediaPlayerTimeProps, "mode">;

/** The current playback position. */
export const AudioPlayerTimeDisplay = (props: AudioPlayerTimeDisplayProps) => (
  <MediaPlayerTime data-slot="audio-player-time-display" {...props} mode="current" />
);

export type AudioPlayerTimeRangeProps = MediaPlayerTimeSliderProps;

export const AudioPlayerTimeRange = (props: AudioPlayerTimeRangeProps) => (
  <MediaPlayerTimeSlider data-slot="audio-player-time-range" {...props} />
);

export type AudioPlayerDurationDisplayProps = Omit<MediaPlayerTimeProps, "mode">;

/** The total duration. */
export const AudioPlayerDurationDisplay = (props: AudioPlayerDurationDisplayProps) => (
  <MediaPlayerTime data-slot="audio-player-duration-display" {...props} mode="duration" />
);

export type AudioPlayerMuteButtonProps = MediaPlayerButtonProps;

export const AudioPlayerMuteButton = (props: AudioPlayerMuteButtonProps) => (
  <MediaPlayerMuteButton data-slot="audio-player-mute-button" {...props} />
);

export type AudioPlayerVolumeRangeProps = MediaPlayerVolumeSliderProps;

export const AudioPlayerVolumeRange = (props: AudioPlayerVolumeRangeProps) => (
  <MediaPlayerVolumeSlider data-slot="audio-player-volume-range" {...props} />
);
