"use client";

/**
 * The media-chrome half of `AudioPlayer`, split out so it can be `lazy()`-loaded.
 *
 * `media-chrome` declares no `sideEffects`, so a static import from
 * `audio-player.tsx` put the whole custom-element library (and the
 * `media-chrome/react` wrappers that register it) into the entry chunk of every
 * `@elabs/components-ai` consumer — including the vast majority that
 * never render an `AudioPlayer`. Keeping every media-chrome *value* import in
 * this module, reached only through
 * `lazy(() => import("./_audio-player-media-chrome"))`, confines it to its own
 * chunk. `audio-player.tsx` still owns the public prop types and imports the
 * media-chrome element types with `import type` (types erase).
 *
 * See ADR 0019 and `pnpm heavy-deps:check`.
 *
 * @lazy-boundary This module must only ever be reached via `import()`. The gate
 * fails if anything imports it statically, which would put media-chrome back in
 * the entry chunk and make the `lazy()` pointless.
 */
import { Button, ButtonGroup, ButtonGroupText } from "@elabs/components-ui";
import { cn } from "@elabs/components-ui/lib/cn";
import {
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
import type { CSSProperties } from "react";

import type {
  AudioPlayerControlBarProps,
  AudioPlayerDurationDisplayProps,
  AudioPlayerMuteButtonProps,
  AudioPlayerPlayButtonProps,
  AudioPlayerProps,
  AudioPlayerSeekBackwardButtonProps,
  AudioPlayerSeekForwardButtonProps,
  AudioPlayerTimeDisplayProps,
  AudioPlayerTimeRangeProps,
  AudioPlayerVolumeRangeProps,
} from "./audio-player";

export const AudioPlayer = ({ children, style, ...props }: AudioPlayerProps) => (
  <MediaController
    audio
    style={
      {
        "--media-background-color": "transparent",
        "--media-button-icon-height": "1rem",
        "--media-button-icon-width": "1rem",
        "--media-control-background": "transparent",
        "--media-control-hover-background": "var(--color-accent)",
        "--media-control-padding": "0",
        "--media-font": "var(--font-sans)",
        "--media-font-size": "10px",
        "--media-icon-color": "currentColor",
        "--media-preview-time-background": "var(--color-background)",
        "--media-preview-time-border-radius": "var(--radius-md)",
        "--media-preview-time-text-shadow": "none",
        "--media-primary-color": "var(--color-primary)",
        "--media-range-bar-color": "var(--color-primary)",
        "--media-range-track-background": "var(--color-secondary)",
        "--media-secondary-color": "var(--color-secondary)",
        "--media-text-color": "var(--color-foreground)",
        "--media-tooltip-arrow-display": "none",
        "--media-tooltip-background": "var(--color-background)",
        "--media-tooltip-border-radius": "var(--radius-md)",
        ...style,
      } as CSSProperties
    }
    {...props}
  >
    {children}
  </MediaController>
);

export const AudioPlayerControlBar = ({ children, ...props }: AudioPlayerControlBarProps) => (
  <MediaControlBar {...props}>
    <ButtonGroup orientation="horizontal">{children}</ButtonGroup>
  </MediaControlBar>
);

export const AudioPlayerPlayButton = ({ className, ...props }: AudioPlayerPlayButtonProps) => (
  <Button asChild size="icon-sm" variant="outline">
    <MediaPlayButton className={cn("bg-transparent", className)} {...props} />
  </Button>
);

export const AudioPlayerSeekBackwardButton = ({
  seekOffset = 10,
  ...props
}: AudioPlayerSeekBackwardButtonProps) => (
  <Button asChild size="icon-sm" variant="outline">
    <MediaSeekBackwardButton seekOffset={seekOffset} {...props} />
  </Button>
);

export const AudioPlayerSeekForwardButton = ({
  seekOffset = 10,
  ...props
}: AudioPlayerSeekForwardButtonProps) => (
  <Button asChild size="icon-sm" variant="outline">
    <MediaSeekForwardButton seekOffset={seekOffset} {...props} />
  </Button>
);

export const AudioPlayerTimeDisplay = ({ className, ...props }: AudioPlayerTimeDisplayProps) => (
  <ButtonGroupText asChild className="bg-transparent">
    <MediaTimeDisplay className={cn("tabular-nums", className)} {...props} />
  </ButtonGroupText>
);

export const AudioPlayerTimeRange = ({ className, ...props }: AudioPlayerTimeRangeProps) => (
  <ButtonGroupText asChild className="bg-transparent">
    <MediaTimeRange className={cn("", className)} {...props} />
  </ButtonGroupText>
);

export const AudioPlayerDurationDisplay = ({
  className,
  ...props
}: AudioPlayerDurationDisplayProps) => (
  <ButtonGroupText asChild className="bg-transparent">
    <MediaDurationDisplay className={cn("tabular-nums", className)} {...props} />
  </ButtonGroupText>
);

export const AudioPlayerMuteButton = ({ className, ...props }: AudioPlayerMuteButtonProps) => (
  <ButtonGroupText asChild className="bg-transparent">
    <MediaMuteButton className={cn("", className)} {...props} />
  </ButtonGroupText>
);

export const AudioPlayerVolumeRange = ({ className, ...props }: AudioPlayerVolumeRangeProps) => (
  <ButtonGroupText asChild className="bg-transparent">
    <MediaVolumeRange className={cn("", className)} {...props} />
  </ButtonGroupText>
);
