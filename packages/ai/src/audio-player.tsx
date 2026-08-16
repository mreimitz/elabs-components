"use client";

import { Skeleton } from "@qlik-coe-emea/qlabs-components-ui";
import { cn } from "@qlik-coe-emea/qlabs-components-ui/lib/cn";
import type { Experimental_SpeechResult as SpeechResult } from "ai";
import type {
  MediaControlBar,
  MediaController,
  MediaDurationDisplay,
  MediaMuteButton,
  MediaPlayButton,
  MediaSeekBackwardButton,
  MediaSeekForwardButton,
  MediaTimeDisplay,
  MediaTimeRange,
  MediaVolumeRange,
} from "media-chrome/react";
import type { ComponentProps, ComponentType } from "react";
import { lazy, Suspense } from "react";

/**
 * media-chrome lives behind a dynamic import — it declares no `sideEffects`, so
 * a static import would put the whole custom-element library in every consumer's
 * entry chunk, `AudioPlayer` rendered or not. Every value import lives in
 * `_audio-player-media-chrome.tsx`; the element types above are TYPE imports and
 * erase. See ADR 0019 and `pnpm heavy-deps:check`.
 *
 * All ten parts resolve from the SAME module specifier, so they share one chunk:
 * once `AudioPlayer` has loaded it, the controls inside it resolve from cache.
 */
type MediaChromeModule = typeof import("./_audio-player-media-chrome");

const lazyPart = <P,>(pick: (module: MediaChromeModule) => ComponentType<P>) =>
  lazy(() => import("./_audio-player-media-chrome").then((m) => ({ default: pick(m) })));

export type AudioPlayerProps = Omit<ComponentProps<typeof MediaController>, "audio">;

const AudioPlayerImpl = lazyPart<AudioPlayerProps>((m) => m.AudioPlayer);

export const AudioPlayer = ({ className, ...props }: AudioPlayerProps) => (
  <Suspense fallback={<Skeleton className={cn("h-10 w-full rounded-md", className)} />}>
    <AudioPlayerImpl className={className} data-slot="audio-player" {...props} />
  </Suspense>
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

export const AudioPlayerElement = ({ ...props }: AudioPlayerElementProps) => (
  // oxlint-disable-next-line eslint-plugin-jsx-a11y(media-has-caption) -- audio player captions are provided by consumer
  <audio
    data-slot="audio-player-element"
    slot="media"
    src={"src" in props ? props.src : `data:${props.data.mediaType};base64,${props.data.base64}`}
    {...props}
  />
);

export type AudioPlayerControlBarProps = ComponentProps<typeof MediaControlBar>;

const AudioPlayerControlBarImpl = lazyPart<AudioPlayerControlBarProps>(
  (m) => m.AudioPlayerControlBar,
);

export const AudioPlayerControlBar = (props: AudioPlayerControlBarProps) => (
  <Suspense fallback={null}>
    <AudioPlayerControlBarImpl data-slot="audio-player-control-bar" {...props} />
  </Suspense>
);

export type AudioPlayerPlayButtonProps = ComponentProps<typeof MediaPlayButton>;

const AudioPlayerPlayButtonImpl = lazyPart<AudioPlayerPlayButtonProps>(
  (m) => m.AudioPlayerPlayButton,
);

export const AudioPlayerPlayButton = (props: AudioPlayerPlayButtonProps) => (
  <Suspense fallback={null}>
    <AudioPlayerPlayButtonImpl data-slot="audio-player-play-button" {...props} />
  </Suspense>
);

export type AudioPlayerSeekBackwardButtonProps = ComponentProps<typeof MediaSeekBackwardButton>;

const AudioPlayerSeekBackwardButtonImpl = lazyPart<AudioPlayerSeekBackwardButtonProps>(
  (m) => m.AudioPlayerSeekBackwardButton,
);

export const AudioPlayerSeekBackwardButton = (props: AudioPlayerSeekBackwardButtonProps) => (
  <Suspense fallback={null}>
    <AudioPlayerSeekBackwardButtonImpl data-slot="audio-player-seek-backward-button" {...props} />
  </Suspense>
);

export type AudioPlayerSeekForwardButtonProps = ComponentProps<typeof MediaSeekForwardButton>;

const AudioPlayerSeekForwardButtonImpl = lazyPart<AudioPlayerSeekForwardButtonProps>(
  (m) => m.AudioPlayerSeekForwardButton,
);

export const AudioPlayerSeekForwardButton = (props: AudioPlayerSeekForwardButtonProps) => (
  <Suspense fallback={null}>
    <AudioPlayerSeekForwardButtonImpl data-slot="audio-player-seek-forward-button" {...props} />
  </Suspense>
);

export type AudioPlayerTimeDisplayProps = ComponentProps<typeof MediaTimeDisplay>;

const AudioPlayerTimeDisplayImpl = lazyPart<AudioPlayerTimeDisplayProps>(
  (m) => m.AudioPlayerTimeDisplay,
);

export const AudioPlayerTimeDisplay = (props: AudioPlayerTimeDisplayProps) => (
  <Suspense fallback={null}>
    <AudioPlayerTimeDisplayImpl data-slot="audio-player-time-display" {...props} />
  </Suspense>
);

export type AudioPlayerTimeRangeProps = ComponentProps<typeof MediaTimeRange>;

const AudioPlayerTimeRangeImpl = lazyPart<AudioPlayerTimeRangeProps>((m) => m.AudioPlayerTimeRange);

export const AudioPlayerTimeRange = (props: AudioPlayerTimeRangeProps) => (
  <Suspense fallback={null}>
    <AudioPlayerTimeRangeImpl data-slot="audio-player-time-range" {...props} />
  </Suspense>
);

export type AudioPlayerDurationDisplayProps = ComponentProps<typeof MediaDurationDisplay>;

const AudioPlayerDurationDisplayImpl = lazyPart<AudioPlayerDurationDisplayProps>(
  (m) => m.AudioPlayerDurationDisplay,
);

export const AudioPlayerDurationDisplay = (props: AudioPlayerDurationDisplayProps) => (
  <Suspense fallback={null}>
    <AudioPlayerDurationDisplayImpl data-slot="audio-player-duration-display" {...props} />
  </Suspense>
);

export type AudioPlayerMuteButtonProps = ComponentProps<typeof MediaMuteButton>;

const AudioPlayerMuteButtonImpl = lazyPart<AudioPlayerMuteButtonProps>(
  (m) => m.AudioPlayerMuteButton,
);

export const AudioPlayerMuteButton = (props: AudioPlayerMuteButtonProps) => (
  <Suspense fallback={null}>
    <AudioPlayerMuteButtonImpl data-slot="audio-player-mute-button" {...props} />
  </Suspense>
);

export type AudioPlayerVolumeRangeProps = ComponentProps<typeof MediaVolumeRange>;

const AudioPlayerVolumeRangeImpl = lazyPart<AudioPlayerVolumeRangeProps>(
  (m) => m.AudioPlayerVolumeRange,
);

export const AudioPlayerVolumeRange = (props: AudioPlayerVolumeRangeProps) => (
  <Suspense fallback={null}>
    <AudioPlayerVolumeRangeImpl data-slot="audio-player-volume-range" {...props} />
  </Suspense>
);
