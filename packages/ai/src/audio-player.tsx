"use client";

import { Skeleton, isOptionalPeerMissing, useLocale } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import type { Experimental_SpeechResult as SpeechResult } from "ai";
import { VolumeOffIcon } from "lucide-react";
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

import { LazyEngineBoundary } from "./_lazy-engine-boundary";

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

/**
 * The settled-failure stand-in for the `LazyEngineBoundary` above — rendered
 * once the `media-chrome` load has genuinely failed, never while it is still
 * pending (that stays `Skeleton`, via the `Suspense fallback` below). A
 * loading skeleton left in place after a settled failure reads as "still
 * loading, forever" (loading-states.md) — this is a terminal state, so it
 * gets a real (if compact) notice instead, sized to the same `h-10` slot so
 * nothing shifts when the boundary trips.
 */
const AudioPlayerMissing = ({ className, error }: { className?: string; error: unknown }) => {
  const { t } = useLocale();
  const isPeerMissing = isOptionalPeerMissing(error);
  return (
    <div
      className={cn(
        "flex h-10 w-full items-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-3 text-caption text-muted-foreground",
        className,
      )}
      role={isPeerMissing ? "status" : "alert"}
    >
      <VolumeOffIcon aria-hidden="true" className="size-4 shrink-0" />
      <span className="truncate">
        {isPeerMissing
          ? t("ai.error.engineMissingBody", {
              feature: t("ai.audioPlayer.feature"),
              packages: "media-chrome",
            })
          : t("ai.audioPlayer.renderError")}
      </span>
    </div>
  );
};

export const AudioPlayer = ({ className, ...props }: AudioPlayerProps) => (
  <LazyEngineBoundary
    renderMissing={(error) => <AudioPlayerMissing className={className} error={error} />}
  >
    <Suspense fallback={<Skeleton className={cn("h-10 w-full rounded-md", className)} />}>
      <AudioPlayerImpl className={className} data-slot="audio-player" {...props} />
    </Suspense>
  </LazyEngineBoundary>
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
  <LazyEngineBoundary renderMissing={() => null}>
    <Suspense fallback={null}>
      <AudioPlayerControlBarImpl data-slot="audio-player-control-bar" {...props} />
    </Suspense>
  </LazyEngineBoundary>
);

export type AudioPlayerPlayButtonProps = ComponentProps<typeof MediaPlayButton>;

const AudioPlayerPlayButtonImpl = lazyPart<AudioPlayerPlayButtonProps>(
  (m) => m.AudioPlayerPlayButton,
);

export const AudioPlayerPlayButton = (props: AudioPlayerPlayButtonProps) => (
  <LazyEngineBoundary renderMissing={() => null}>
    <Suspense fallback={null}>
      <AudioPlayerPlayButtonImpl data-slot="audio-player-play-button" {...props} />
    </Suspense>
  </LazyEngineBoundary>
);

export type AudioPlayerSeekBackwardButtonProps = ComponentProps<typeof MediaSeekBackwardButton>;

const AudioPlayerSeekBackwardButtonImpl = lazyPart<AudioPlayerSeekBackwardButtonProps>(
  (m) => m.AudioPlayerSeekBackwardButton,
);

export const AudioPlayerSeekBackwardButton = (props: AudioPlayerSeekBackwardButtonProps) => (
  <LazyEngineBoundary renderMissing={() => null}>
    <Suspense fallback={null}>
      <AudioPlayerSeekBackwardButtonImpl data-slot="audio-player-seek-backward-button" {...props} />
    </Suspense>
  </LazyEngineBoundary>
);

export type AudioPlayerSeekForwardButtonProps = ComponentProps<typeof MediaSeekForwardButton>;

const AudioPlayerSeekForwardButtonImpl = lazyPart<AudioPlayerSeekForwardButtonProps>(
  (m) => m.AudioPlayerSeekForwardButton,
);

export const AudioPlayerSeekForwardButton = (props: AudioPlayerSeekForwardButtonProps) => (
  <LazyEngineBoundary renderMissing={() => null}>
    <Suspense fallback={null}>
      <AudioPlayerSeekForwardButtonImpl data-slot="audio-player-seek-forward-button" {...props} />
    </Suspense>
  </LazyEngineBoundary>
);

export type AudioPlayerTimeDisplayProps = ComponentProps<typeof MediaTimeDisplay>;

const AudioPlayerTimeDisplayImpl = lazyPart<AudioPlayerTimeDisplayProps>(
  (m) => m.AudioPlayerTimeDisplay,
);

export const AudioPlayerTimeDisplay = (props: AudioPlayerTimeDisplayProps) => (
  <LazyEngineBoundary renderMissing={() => null}>
    <Suspense fallback={null}>
      <AudioPlayerTimeDisplayImpl data-slot="audio-player-time-display" {...props} />
    </Suspense>
  </LazyEngineBoundary>
);

export type AudioPlayerTimeRangeProps = ComponentProps<typeof MediaTimeRange>;

const AudioPlayerTimeRangeImpl = lazyPart<AudioPlayerTimeRangeProps>((m) => m.AudioPlayerTimeRange);

export const AudioPlayerTimeRange = (props: AudioPlayerTimeRangeProps) => (
  <LazyEngineBoundary renderMissing={() => null}>
    <Suspense fallback={null}>
      <AudioPlayerTimeRangeImpl data-slot="audio-player-time-range" {...props} />
    </Suspense>
  </LazyEngineBoundary>
);

export type AudioPlayerDurationDisplayProps = ComponentProps<typeof MediaDurationDisplay>;

const AudioPlayerDurationDisplayImpl = lazyPart<AudioPlayerDurationDisplayProps>(
  (m) => m.AudioPlayerDurationDisplay,
);

export const AudioPlayerDurationDisplay = (props: AudioPlayerDurationDisplayProps) => (
  <LazyEngineBoundary renderMissing={() => null}>
    <Suspense fallback={null}>
      <AudioPlayerDurationDisplayImpl data-slot="audio-player-duration-display" {...props} />
    </Suspense>
  </LazyEngineBoundary>
);

export type AudioPlayerMuteButtonProps = ComponentProps<typeof MediaMuteButton>;

const AudioPlayerMuteButtonImpl = lazyPart<AudioPlayerMuteButtonProps>(
  (m) => m.AudioPlayerMuteButton,
);

export const AudioPlayerMuteButton = (props: AudioPlayerMuteButtonProps) => (
  <LazyEngineBoundary renderMissing={() => null}>
    <Suspense fallback={null}>
      <AudioPlayerMuteButtonImpl data-slot="audio-player-mute-button" {...props} />
    </Suspense>
  </LazyEngineBoundary>
);

export type AudioPlayerVolumeRangeProps = ComponentProps<typeof MediaVolumeRange>;

const AudioPlayerVolumeRangeImpl = lazyPart<AudioPlayerVolumeRangeProps>(
  (m) => m.AudioPlayerVolumeRange,
);

export const AudioPlayerVolumeRange = (props: AudioPlayerVolumeRangeProps) => (
  <LazyEngineBoundary renderMissing={() => null}>
    <Suspense fallback={null}>
      <AudioPlayerVolumeRangeImpl data-slot="audio-player-volume-range" {...props} />
    </Suspense>
  </LazyEngineBoundary>
);
